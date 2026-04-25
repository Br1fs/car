import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ObjectId } from "mongodb";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getDB } from "../db.js";
import { writeAuditLog } from "../utils/auditLog.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesUploadDir = path.join(__dirname, "..", "uploads", "work-note-templates");
const workNotesUploadDir = path.join(__dirname, "..", "uploads", "work-notes");
const defaultWorkNoteTemplatePath = path.join(__dirname, "..", "templates", "М1,M1G rab zapis.pdf");
if (!fs.existsSync(templatesUploadDir)) fs.mkdirSync(templatesUploadDir, { recursive: true });
if (!fs.existsSync(workNotesUploadDir)) fs.mkdirSync(workNotesUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: templatesUploadDir,
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "template").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
});

const resolveTemplatePath = (template) => {
  if (template?.fileName && /\.pdf$/i.test(String(template.fileName))) {
    const fromUploads = path.join(templatesUploadDir, template.fileName);
    if (fs.existsSync(fromUploads)) return fromUploads;
  }
  if (fs.existsSync(defaultWorkNoteTemplatePath)) return defaultWorkNoteTemplatePath;
  return "";
};

async function buildWorkNotePdf({ app, template }) {
  const templatePath = resolveTemplatePath(template);
  if (!templatePath) {
    throw new Error("PDF шаблон рабочей записи не найден");
  }

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const fontPath = path.join(__dirname, "..", "fonts", "times.ttf");
  const fontBytes = fs.readFileSync(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const draw = (value, x, y, size = 13) => {
    page.drawText(String(value || ""), { x, y, size, font, color: rgb(0, 0, 0) });
  };

  // Coordinates mapped for "М1,M1G раб запись.pdf"
  draw(app?.protocolNumber || "", 268, 736, 14); // № заявки = № протокола
  draw(app?.iccid || "", 305, 496);
  draw(app?.imei || "", 305, 474);
  draw(app?.serialNumber || "", 305, 452);
  draw(app?.vin || "", 305, 430);
  draw(`${app?.brand || ""} ${app?.model || ""}`.trim(), 305, 408);
  draw(app?.year || "", 305, 386);
  draw(app?.color || "", 305, 364);
  draw(app?.fio || "", 362, 240, 12); // заказчик внизу

  return pdfDoc.save();
}

router.get("/templates", async (req, res) => {
  try {
    const db = getDB();
    const templates = await db.collection("workNoteTemplates").find({}).sort({ createdAt: -1 }).toArray();
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/templates/upload", upload.single("templateFile"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Файл не передан" });
    const db = getDB();
    const created = {
      name: req.body.name || req.file.originalname,
      category: req.body.category || "",
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("workNoteTemplates").insertOne(created);
    return res.json({ _id: result.insertedId, ...created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Неверный id" });
    const db = getDB();
    const patch = {
      name: req.body.name || "",
      category: req.body.category || "",
      updatedAt: new Date(),
    };
    await db.collection("workNoteTemplates").updateOne({ _id: new ObjectId(id) }, { $set: patch });
    const updated = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(id) });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const list = await db.collection("workNotes").find({}).sort({ createdAt: -1 }).toArray();
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const { applicationId = "", templateId = "", actorName = "system" } = req.body || {};
    if (!ObjectId.isValid(applicationId)) return res.status(400).json({ error: "Выберите заявку" });

    const app = await db.collection("applications").findOne({ _id: new ObjectId(applicationId) });
    if (!app) return res.status(404).json({ error: "Заявка не найдена" });

    let template = null;
    if (ObjectId.isValid(templateId)) {
      template = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(templateId) });
      if (!template) return res.status(404).json({ error: "Шаблон не найден" });
    }

    const latestDeclaration = await db
      .collection("declarations")
      .find({ applicationId: String(app._id) })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
    app.iccid = latestDeclaration?.iccid || app.iccid || "";
    app.imei = latestDeclaration?.imei || app.imei || "";
    app.serialNumber = latestDeclaration?.serialNumber || app.serialNumber || "";

    const pdfBytes = await buildWorkNotePdf({
      app,
      template,
    });
    const fileName = `work-note-${Date.now()}-${String(app.vin || "no-vin").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    const savePath = path.join(workNotesUploadDir, fileName);
    fs.writeFileSync(savePath, pdfBytes);

    const created = {
      applicationId: String(app._id),
      templateId: template?._id ? String(template._id) : "",
      templateName: template?.name || "М1,M1G раб запись.pdf",
      category: template?.category || "",
      fio: app.fio || "",
      vin: app.vin || "",
      fileName,
      fileUrl: `/uploads/work-notes/${fileName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("workNotes").insertOne(created);

    await writeAuditLog(db, {
      action: "create_work_note",
      actorName: String(actorName || "system"),
      targetType: "application",
      targetId: String(app._id),
      targetLabel: `${app.fio || ""} | ${app.vin || ""}`.trim(),
      details: {
        workNoteId: result.insertedId.toString(),
        protocolNumber: app.protocolNumber || "",
        templateName: created.templateName || "",
        page: "Рабочая запись",
        specialist: app.specialist || "",
        fio: app.fio || "",
        vin: app.vin || "",
      },
    });

    return res.json({ _id: result.insertedId, ...created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
