import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { decisionPdfLayouts } from "../config/decisionPdfLayouts.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function drawBold(page, cfg, value, font) {
  if (!cfg) return;

  const text = String(value ?? "");

  page.drawText(text, {
    x: cfg.x,
    y: cfg.y,
    size: cfg.size || 10,
    font,
  });

  if (cfg.boldOffsetX) {
    page.drawText(text, {
      x: cfg.x + cfg.boldOffsetX,
      y: cfg.y,
      size: cfg.size || 10,
      font,
    });
  }
}
function formatDateRu(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);

  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} г.`;
}

function drawValue(page, cfg, value, font) {
  if (!cfg) return;

  page.drawText(String(value ?? ""), {
    x: cfg.x,
    y: cfg.y,
    size: cfg.size || 10,
    font,
  });
}

// ================= GET все решения =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const decisions = await db
      .collection("decisions")
      .find(
        {},
        {
          projection: {
            decisionNumber: 1,
            decisionDate: 1,
            createdAt: 1,
            vin: 1,
            brand: 1,
            model: 1,
            year: 1,
            typ: 1,
            category: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(decisions);
  } catch (err) {
    console.error("Ошибка загрузки решений:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= POST создать решение =================
router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const data = req.body;

    if (!data) {
      return res.status(400).json({ message: "no data" });
    }

    const result = await db.collection("decisions").insertOne({
      applicationId: data.applicationId || null,
      decisionNumber: data.decisionNumber || "",
      decisionDate: data.decisionDate || "",
      brand: data.brand || "",
      model: data.model || "",
      vin: data.vin || "",
      year: data.year || "",
      typ: data.typ || "",
      category: data.category || "",
      createdAt: new Date(),
    });

    res.json({
      message: "ok",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("CREATE DECISION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET одно решение =================
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const decision = await db
      .collection("decisions")
      .findOne({ _id: new ObjectId(id) });

    if (!decision) {
      return res.status(404).json({ message: "Решение не найдено" });
    }

    res.json(decision);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= DELETE решение =================
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    await db.collection("decisions").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({ message: "Удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= BULK DELETE решений =================
router.post("/bulk-delete", async (req, res) => {
  try {
    const db = getDB();
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Не переданы ID" });
    }

    const validIds = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (!validIds.length) {
      return res.status(400).json({ message: "Нет корректных ID" });
    }

    const result = await db.collection("decisions").deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE DECISIONS ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});

// ================= PDF решения =================
router.get("/:id/pdf-template", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Неверный ID");
    }

    const decision = await db
      .collection("decisions")
      .findOne({ _id: new ObjectId(id) });

    if (!decision) {
      return res.status(404).send("Решение не найдено");
    }

    const templatePath = path.join(__dirname, "..", "templates", "reshenie.pdf");

    if (!fs.existsSync(templatePath)) {
      return res.status(500).send(`Шаблон не найден: ${templatePath}`);
    }

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "..", "fonts", "times.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const layout = decisionPdfLayouts.reshenie;

    if (layout.page1 && pages[0]) {
      const page = pages[0];
      const p1 = layout.page1;

      drawBold(page, p1.decisionNumber1, decision.decisionNumber || "", font);

drawValue(page, p1.decisionDate1, formatDateRu(decision.decisionDate), font);

      drawValue(page, p1.brand, decision.brand || "", font);
      drawValue(page, p1.model, decision.model || "", font);
      drawValue(page, p1.vin, decision.vin || "", font);
      drawValue(page, p1.year, decision.year || "", font);
      drawValue(page, p1.typ, decision.typ || "", font);
      drawValue(page, p1.category, decision.category || "", font);
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("DECISION PDF TEMPLATE ERROR:", err);
    res.status(500).send(err.message);
  }
});

export default router;