import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { dogovorPdfLayouts } from "../config/dogovorPdfLayouts.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDateRu(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);

  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
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

// ================= GET все договоры =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const dogovors = await db
      .collection("dogovors")
      .find(
        {},
        {
          projection: {
            dogovorNumber: 1,
            dogovorDate: 1,
            fio: 1,
            address: 1,
            iin: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(dogovors);
  } catch (err) {
    console.error("Ошибка загрузки договоров:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= POST создать договор =================
router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const data = req.body;

    if (!data) {
      return res.status(400).json({ message: "no data" });
    }

    const result = await db.collection("dogovors").insertOne({
      applicationId: data.applicationId || null,
      dogovorNumber: data.dogovorNumber || "",
      dogovorDate: data.dogovorDate || "",
      fio: data.fio || "",
      address: data.address || "",
      iin: data.iin || "",
      createdAt: new Date(),
    });

    res.json({
      message: "ok",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("CREATE DOGOVOR ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET один договор =================
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const dogovor = await db
      .collection("dogovors")
      .findOne({ _id: new ObjectId(id) });

    if (!dogovor) {
      return res.status(404).json({ message: "Договор не найден" });
    }

    res.json(dogovor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= DELETE договор =================
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    await db.collection("dogovors").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({ message: "Удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= BULK DELETE =================
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

    const result = await db.collection("dogovors").deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE DOGOVORS ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});

// ================= PDF =================
router.get("/:id/pdf-template", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Неверный ID");
    }

    const dogovor = await db
      .collection("dogovors")
      .findOne({ _id: new ObjectId(id) });

    if (!dogovor) {
      return res.status(404).send("Договор не найден");
    }

    const templatePath = path.join(__dirname, "..", "templates", "dogovor.pdf");

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
    const layout = dogovorPdfLayouts.dogovor;

    if (layout.page1 && pages[0]) {
      const page = pages[0];
      const p1 = layout.page1;

      drawBold(page, p1.number1, dogovor.dogovorNumber || "", font);
      drawBold(page, p1.number2, dogovor.dogovorNumber || "", font);

      drawBold(page, p1.date1, formatDateRu(dogovor.dogovorDate), font);
      drawBold(page, p1.date2, formatDateRu(dogovor.dogovorDate), font);

      drawValue(page, p1.fio1, dogovor.fio || "", font);
      drawValue(page, p1.fio2, dogovor.fio || "", font);
      drawValue(page, p1.fio3, dogovor.fio || "", font);

      drawValue(page, p1.address, dogovor.address || "", font);
      drawValue(page, p1.iin, dogovor.iin || "", font);
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("DOGOVOR PDF TEMPLATE ERROR:", err);
    res.status(500).send(err.message);
  }
});

export default router;