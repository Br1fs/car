import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { writeAuditLog } from "../utils/auditLog.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesUploadDir = path.join(__dirname, "..", "uploads", "declaration-templates");
const declarationsUploadDir = path.join(__dirname, "..", "uploads", "declarations");
if (!fs.existsSync(templatesUploadDir)) fs.mkdirSync(templatesUploadDir, { recursive: true });
if (!fs.existsSync(declarationsUploadDir)) fs.mkdirSync(declarationsUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: templatesUploadDir,
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "template").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
});

const ACT_NUMBER_BASELINE = 59512;
const ACT_SERIAL_BASELINE = 49941585;

const parseActNumber = (value) => {
  const text = String(value || "").trim();
  const [left] = text.split("/");
  const parsed = Number.parseInt(left, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseSerialNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCurrentYear = () => new Date().getFullYear();

const formatActNumber = (number, year = getCurrentYear()) => `${number}/${year}`;

const getNextActNumber = async (db, year = getCurrentYear()) => {
  const rows = await db.collection("declarations").find({ actYear: year }).project({ actNumber: 1 }).toArray();
  const max = rows.reduce((acc, row) => {
    const current = parseActNumber(row?.actNumber);
    return current > acc ? current : acc;
  }, ACT_NUMBER_BASELINE);
  return max + 1;
};

const getNextActSerial = async (db) => {
  const rows = await db.collection("declarations").find({}).project({ serialNumber: 1 }).toArray();
  const max = rows.reduce((acc, row) => {
    const current = parseSerialNumber(row?.serialNumber);
    return current > acc ? current : acc;
  }, ACT_SERIAL_BASELINE);
  return max + 1;
};

async function buildDeclarationPdf({
  actNumber,
  fio,
  brand,
  model,
  year,
  vin,
  color,
  iccid,
  imei,
  serialNumber,
  customerType,
  customerDocNumber,
  customerDocDate,
  customerAddress,
  customerPhone,
  customerIin,
  extraEquipment,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("АКТ", { x: 280, y: 800, size: 20, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`№ ${actNumber || "-"}`, { x: 56, y: 802, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Сформировано автоматически", { x: 210, y: 782, size: 10, font, color: rgb(0.35, 0.35, 0.35) });

  const rows = [
    ["ФИО", fio],
    ["Тип клиента", customerType],
    ["ИИН", customerIin],
    ["Документ №", customerDocNumber],
    ["Дата документа", customerDocDate],
    ["Адрес", customerAddress],
    ["Телефон", customerPhone],
    ["Марка", brand],
    ["Модель", model],
    ["Год выпуска", year],
    ["VIN", vin],
    ["Цвет", color],
    ["ICCID", iccid],
    ["IMEI", imei],
    ["Серийный номер", serialNumber],
    ["Доп. оборудование", extraEquipment],
  ];

  let y = 740;
  rows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: 56, y, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(String(value || "-"), { x: 220, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 32;
  });

  return pdfDoc.save();
}

router.get("/templates", async (req, res) => {
  try {
    const db = getDB();
    const templates = await db.collection("declarationTemplates").find({}).sort({ createdAt: -1 }).toArray();
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
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("declarationTemplates").insertOne(created);
    return res.json({ _id: result.insertedId, ...created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const items = await db.collection("declarations").find({}).sort({ createdAt: -1 }).toArray();
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const {
      applicationId = "",
      templateId = "",
      iccid = "",
      imei = "",
      extraEquipment = "",
      customerType = "",
      customerDocNumber = "",
      customerDocDate = "",
      customerAddress = "",
      customerPhone = "",
      customerIin = "",
      actorName = "system",
    } = req.body || {};

    if (!ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: "Выберите заявку" });
    }

    const application = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(applicationId) });
    if (!application) return res.status(404).json({ error: "Заявка не найдена" });

    let template = null;
    if (ObjectId.isValid(templateId)) {
      template = await db.collection("declarationTemplates").findOne({ _id: new ObjectId(templateId) });
    }

    const fio = application.fio || "";
    const brand = application.brand || "";
    const model = application.model || "";
    const year = String(application.year || "");
    const vin = application.vin || "";
    const color = application.color || "";
    const actYear = getCurrentYear();
    const nextActNumber = await getNextActNumber(db, actYear);
    const actNumber = formatActNumber(nextActNumber, actYear);
    const serialNumber = String(await getNextActSerial(db));

    const pdfBytes = await buildDeclarationPdf({
      actNumber,
      fio,
      brand,
      model,
      year,
      vin,
      color,
      iccid,
      imei,
      serialNumber,
      customerType: customerType || "Частное лицо",
      customerDocNumber,
      customerDocDate,
      customerAddress: customerAddress || application.address || "",
      customerPhone: customerPhone || application.phone || "",
      customerIin: customerIin || application.iin || "",
      extraEquipment,
    });

    const fileName = `act-${Date.now()}-${String(vin || "no-vin").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    const savePath = path.join(declarationsUploadDir, fileName);
    fs.writeFileSync(savePath, pdfBytes);

    const created = {
      applicationId,
      templateId: template?._id ? String(template._id) : "",
      templateName: template?.name || "",
      fio,
      brand,
      model,
      vin,
      color,
      year,
      actNumber,
      actYear,
      serialNumber,
      iccid,
      imei,
      customerType: customerType || "Частное лицо",
      customerDocNumber,
      customerDocDate,
      customerAddress: customerAddress || application.address || "",
      customerPhone: customerPhone || application.phone || "",
      customerIin: customerIin || application.iin || "",
      extraEquipment,
      fileName,
      fileUrl: `/uploads/declarations/${fileName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection("declarations").insertOne(created);

    const existingFiles = application.files && typeof application.files === "object" ? application.files : {};
    const actDocEntry = {
      filename: `declarations/${fileName}`,
      originalname: `АКТ-${actNumber || vin || fileName}.pdf`,
      mimetype: "application/pdf",
      size: pdfBytes.length || 0,
    };

    await db.collection("applications").updateOne(
      { _id: new ObjectId(applicationId) },
      {
        $set: {
          "files.actDoc": [actDocEntry],
          extraEquipment: extraEquipment || application.extraEquipment || "",
          updatedAt: new Date(),
          files: {
            ...existingFiles,
            actDoc: [actDocEntry],
          },
        },
      }
    );

    await writeAuditLog(db, {
      action: "create_declaration",
      actorName: String(actorName || "system"),
      targetType: "application",
      targetId: applicationId,
      targetLabel: `${application.fio || ""} | ${application.vin || ""}`.trim(),
      details: {
        declarationId: insertResult.insertedId.toString(),
        actNumber,
        serialNumber,
        protocolNumber: application.protocolNumber || "",
        page: "Кнопка (АКТ)",
        specialist: application.specialist || "",
        fio: application.fio || "",
        vin: application.vin || "",
      },
    });

    return res.json({ _id: insertResult.insertedId, ...created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
