import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ObjectId } from "mongodb";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getDB } from "../db.js";
import { writeAuditLog } from "../utils/auditLog.js";
import {
  WORK_NOTE_TEMPLATE_FIELDS,
  buildSampleWorkNoteDocxBuffer,
  getWorkNoteTemplateData,
} from "../utils/workNoteTemplateFields.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesUploadDir = path.join(__dirname, "..", "uploads", "work-note-templates");
const workNotesUploadDir = path.join(__dirname, "..", "uploads", "work-notes");
const defaultWorkNoteTemplatePath = path.join(__dirname, "..", "templates", "М1,M1G rab zapis.pdf");
const defaultWorkNoteTemplateDocxPath = path.join(__dirname, "..", "templates", "work-note-template.docx");
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

const uploadTemplateFileIfMultipart = (req, res, next) => {
  const ct = String(req.headers["content-type"] || "");
  if (ct.includes("multipart/form-data")) {
    return upload.single("templateFile")(req, res, next);
  }
  return next();
};

const resolveTemplateDescriptor = (template) => {
  if (template?.fileName) {
    const uploadedPath = path.join(templatesUploadDir, String(template.fileName));
    if (fs.existsSync(uploadedPath)) {
      const ext = String(path.extname(template.fileName || "") || "").toLowerCase();
      if (ext === ".docx") return { path: uploadedPath, ext: ".docx" };
      if (ext === ".pdf") return { path: uploadedPath, ext: ".pdf" };
    }
  }
  if (fs.existsSync(defaultWorkNoteTemplateDocxPath)) {
    return { path: defaultWorkNoteTemplateDocxPath, ext: ".docx" };
  }
  if (fs.existsSync(defaultWorkNoteTemplatePath)) {
    return { path: defaultWorkNoteTemplatePath, ext: ".pdf" };
  }
  return null;
};

async function buildWorkNotePdf({ app, template }) {
  const descriptor = resolveTemplateDescriptor(template);
  const templatePath = descriptor?.path || "";
  if (!templatePath || descriptor?.ext !== ".pdf") {
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

async function buildWorkNoteDocx({ app, template }) {
  const descriptor = resolveTemplateDescriptor(template);
  const templatePath = descriptor?.path || "";
  if (!templatePath || descriptor?.ext !== ".docx") {
    throw new Error("DOCX шаблон рабочей записи не найден");
  }

  const docxBinary = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(docxBinary);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const payload = getWorkNoteTemplateData(app);

  doc.render(payload);
  return doc.getZip().generate({ type: "nodebuffer" });
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

router.get("/templates/fields", (req, res) => {
  try {
    return res.json({ fields: WORK_NOTE_TEMPLATE_FIELDS });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/templates/sample-docx", (req, res) => {
  try {
    const buffer = buildSampleWorkNoteDocxBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="work-note-placeholders.docx"');
    return res.send(buffer);
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

router.get("/templates/:id/file", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Неверный id" });
    const db = getDB();
    const template = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(id) });
    if (!template?.fileName) return res.status(404).json({ error: "Шаблон не найден" });
    const filePath = path.join(templatesUploadDir, String(template.fileName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Файл шаблона отсутствует на сервере" });

    const downloadName = String(template.originalName || template.fileName || "template").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    res.setHeader("Content-Type", template.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    return res.send(fs.readFileSync(filePath));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/templates/:id", uploadTemplateFileIfMultipart, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Неверный id" });
    const db = getDB();
    const existing = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: "Шаблон не найден" });

    const patch = {
      name: req.body.name !== undefined ? String(req.body.name) : existing.name || "",
      category: req.body.category !== undefined ? String(req.body.category) : existing.category || "",
      updatedAt: new Date(),
    };

    if (req.file) {
      const ext = String(path.extname(req.file.filename || "") || "").toLowerCase();
      if (ext !== ".docx" && ext !== ".pdf") {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ error: "Разрешены только файлы .pdf и .docx" });
      }
      if (existing.fileName) {
        const oldPath = path.join(templatesUploadDir, String(existing.fileName));
        if (fs.existsSync(oldPath) && oldPath !== req.file.path) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            /* ignore */
          }
        }
      }
      patch.fileName = req.file.filename;
      patch.originalName = req.file.originalname;
      patch.mimeType = req.file.mimetype || "";
    }

    await db.collection("workNoteTemplates").updateOne({ _id: new ObjectId(id) }, { $set: patch });
    const updated = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(id) });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Неверный id" });
    const db = getDB();
    const existing = await db.collection("workNoteTemplates").findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: "Шаблон не найден" });
    if (existing.fileName) {
      const filePath = path.join(templatesUploadDir, String(existing.fileName));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }
    await db.collection("workNoteTemplates").deleteOne({ _id: new ObjectId(id) });
    return res.json({ ok: true });
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

    const descriptor = resolveTemplateDescriptor(template);
    if (!descriptor) {
      return res.status(400).json({ error: "Шаблон рабочей записи не найден" });
    }

    let fileBuffer;
    let outputExt = ".pdf";
    if (descriptor.ext === ".docx") {
      fileBuffer = await buildWorkNoteDocx({ app, template });
      outputExt = ".docx";
    } else {
      fileBuffer = await buildWorkNotePdf({ app, template });
      outputExt = ".pdf";
    }

    const fileName = `work-note-${Date.now()}-${String(app.vin || "no-vin").replace(/[^a-zA-Z0-9-_]/g, "_")}${outputExt}`;
    const savePath = path.join(workNotesUploadDir, fileName);
    fs.writeFileSync(savePath, fileBuffer);

    const created = {
      applicationId: String(app._id),
      templateId: template?._id ? String(template._id) : "",
      templateName: template?.name || path.basename(descriptor.path),
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
