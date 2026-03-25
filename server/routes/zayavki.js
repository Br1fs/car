// server/routes/zayavki.js
import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function wrapText(font, text, size, maxWidth) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function calcRowHeight(font, label, value, size, labelWidth, valueWidth) {
  const labelLines = wrapText(font, label, size, labelWidth - 10);
  const valueLines = wrapText(font, value, size, valueWidth - 10);
  const lineHeight = size + 3;
  const maxLines = Math.max(labelLines.length, valueLines.length);
  return Math.max(24, 8 + maxLines * lineHeight);
}

function drawWrappedLines(page, font, text, x, y, size, maxWidth, lineGap = 3) {
  const lines = wrapText(font, text, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * (size + lineGap),
      size,
      font,
    });
  });
  return lines.length;
}

function drawText(page, font, text, x, y, size = 11) {
  page.drawText(String(text ?? ""), {
    x,
    y,
    size,
    font,
  });
}

function drawBoldLike(page, font, text, x, y, size = 11, offset = 0.35) {
  const value = String(text ?? "");
  page.drawText(value, { x, y, size, font });
  page.drawText(value, { x: x + offset, y, size, font });
}

function drawCenteredBoldLike(page, font, text, pageWidth, y, size = 12, offset = 0.35) {
  const value = String(text ?? "");
  const textWidth = font.widthOfTextAtSize(value, size);
  const x = (pageWidth - textWidth) / 2;
  drawBoldLike(page, font, value, x, y, size, offset);
}

function createPage(pdfDoc) {
  return pdfDoc.addPage([595.28, 841.89]); // A4
}

function drawTableRow(page, font, row, left, y, labelWidth, valueWidth, size = 10) {
  const value = row?.value ?? "-";
  const label = row?.label ?? "";
  const rowHeight = calcRowHeight(font, label, value, size, labelWidth, valueWidth);
  const bottomY = y - rowHeight;

  page.drawRectangle({
  x: left,
  y: bottomY,
  width: labelWidth,
  height: rowHeight,
  borderWidth: 1,
  borderColor: rgb(0, 0, 0),
  color: rgb(1, 1, 1),
});

page.drawRectangle({
  x: left + labelWidth,
  y: bottomY,
  width: valueWidth,
  height: rowHeight,
  borderWidth: 1,
  borderColor: rgb(0, 0, 0),
  color: rgb(1, 1, 1),
});

  const textTopY = y - 14;

  drawWrappedLines(page, font, label, left + 5, textTopY, size, labelWidth - 10, 2);
  drawWrappedLines(
    page,
    font,
    String(value),
    left + labelWidth + 5,
    textTopY,
    size,
    valueWidth - 10,
    2
  );

  return rowHeight;
}

// ================= создать =================
router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const data = req.body;

    if (!data) {
      return res.status(400).json({ message: "no data" });
    }

    const result = await db.collection("zayavki").insertOne({
      applicationId: data.applicationId || null,
      zayavkaNumber: data.zayavkaNumber || "",
      zayavkaDate: data.zayavkaDate || "",
      brand: data.brand || "",
      model: data.model || "",
      vin: data.vin || "",
      year: data.year || "",
      typ: data.typ || "",
      category: data.category || "",
      manufacturer: data.manufacturer || "",
      fio: data.fio || "",
      address: data.address || "",
      iin: data.iin || "",
      characteristics: Array.isArray(data.characteristics) ? data.characteristics : [],
      createdAt: new Date(),
    });

    res.json({
      message: "ok",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("CREATE ZAYAVKA ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= список =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const zayavki = await db
      .collection("zayavki")
      .find(
        {},
        {
          projection: {
            zayavkaNumber: 1,
            zayavkaDate: 1,
            fio: 1,
            vin: 1,
            brand: 1,
            model: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(zayavki);
  } catch (err) {
    console.error("GET ZAYAVKI ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= одна =================
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const doc = await db.collection("zayavki").findOne({
      _id: new ObjectId(id),
    });

    if (!doc) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= удалить =================
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    await db.collection("zayavki").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({ message: "Удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= массовое удаление =================
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

    const result = await db.collection("zayavki").deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE ZAYAVKI ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});

// ================= pdf =================
router.get("/:id/pdf", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Неверный ID");
    }

    const z = await db.collection("zayavki").findOne({
      _id: new ObjectId(id),
    });

    if (!z) {
      return res.status(404).send("Заявка не найдена");
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "..", "fonts", "times.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    let page = createPage(pdfDoc);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const left = 40;
    const right = 40;
    const contentWidth = pageWidth - left - right;

    let y = pageHeight - 40;

    const ensureSpace = (neededHeight = 30) => {
      if (y - neededHeight < 50) {
        page = createPage(pdfDoc);
        y = pageHeight - 40;
      }
    };

    // ===== Верхний правый блок =====
    drawBoldLike(page, font, "Испытательная лаборатория", pageWidth - right - 150, y, 11);
    y -= 16;
    drawBoldLike(page, font, 'ТОО «Ala-test»', pageWidth - right - 95, y, 11);
    y -= 16;
    drawBoldLike(page, font, "№ KZ.T.02.2997", pageWidth - right - 100, y, 11);
    y -= 16;
    drawBoldLike(page, font, "от 19.12.2025 г.", pageWidth - right - 90, y, 11);

    y -= 28;

    // ===== Номер =====
    drawCenteredBoldLike(page, font, `ЗАЯВКА № ${z.zayavkaNumber || "-"}`, pageWidth, y, 13);

    y -= 18;

    // ===== Дата жирным =====
    drawCenteredBoldLike(page, font, formatDateRu(z.zayavkaDate), pageWidth, y, 11);

    y -= 28;

    // ===== Основной текст =====
    drawBoldLike(
      page,
      font,
      "На проведение работ по оценке соответствия ТС требованиям ТР ТС 018/2011",
      left,
      y,
      11
    );
    y -= 16;

    drawBoldLike(
      page,
      font,
      "в форме «Свидетельства о безопасности конструкции транспортного средства» (СБКТС)",
      left,
      y,
      11
    );
    y -= 20;

    drawBoldLike(
      page,
      font,
      "Прошу оформить СБКТС на единичное транспортное средство (далее – ТС):",
      left,
      y,
      11
    );

    y -= 20;

    // ===== Верхняя таблица =====
    const topRows = [
      { label: "Модель", value: z.model || "-" },
      { label: "Марка", value: z.brand || "-" },
      { label: "Идентификационный номер (VIN)", value: z.vin || "-" },
      { label: "Название изготовителя", value: z.manufacturer || "-" },
      { label: "Ф.И.О. заявителя", value: z.fio || "-" },
      { label: "Адрес заявителя", value: z.address || "-" },
      { label: "ИИН", value: z.iin || "-" },
    ];

    for (const row of topRows) {
      ensureSpace(34);
      const usedHeight = drawTableRow(page, font, row, left, y, 170, contentWidth - 170, 10);
      y -= usedHeight;
    }

    y -= 18;
    ensureSpace(40);

    // ===== Заголовок характеристик =====
    drawCenteredBoldLike(
      page,
      font,
      "ОБЩИЕ ХАРАКТЕРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА",
      pageWidth,
      y,
      12
    );

    y -= 18;

    // ===== Характеристики =====
    const filteredCharacteristics = (z.characteristics || []).filter(
      (item) => !["fio", "iin", "address", "type", "typ"].includes(item.key)
    );

    for (const item of filteredCharacteristics) {
      const label = item?.label || "";
      const value = item?.value || "-";

      const neededHeight = calcRowHeight(font, label, value, 10, 240, contentWidth - 240) + 4;
      ensureSpace(neededHeight);

      const usedHeight = drawTableRow(
        page,
        font,
        { label, value },
        left,
        y,
        240,
        contentWidth - 240,
        10
      );

      y -= usedHeight;
    }

    y -= 20;
    ensureSpace(90);

    // ===== Дополнительная информация =====
    drawBoldLike(
      page,
      font,
      "ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ (возможность использования на дорогах общего пользования",
      left,
      y,
      10.5
    );
    y -= 15;

    drawBoldLike(
      page,
      font,
      "без ограничений или с ограничениями из-за превышения нормативов по габаритам и осевым",
      left,
      y,
      10.5
    );
    y -= 15;

    drawBoldLike(
      page,
      font,
      "массам, возможность использования в качестве маршрутного транспортного средства и др.)",
      left,
      y,
      10.5
    );

    y -= 28;

    // ===== Подпись заявителя =====
drawText(page, font, "Подпись заявителя __________________________", left, y, 11);

// ФИО в одной линии справа от подписи
drawText(page, font, String(z.fio || "-"), left + 250, y, 11);

y -= 22;

// М.П. слева
drawText(page, font, "М.П. (для юр. лиц)", left, y, 11);

// Дата оформления справа, без наложения
drawText(page, font, "Дата оформления:", pageWidth - 200, y, 11);
drawText(page, font, formatDateRu(z.zayavkaDate), pageWidth - 110, y, 11);

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=zayavka_${z._id}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("ZAYAVKA PDF ERROR:", err);
    res.status(500).send("Ошибка генерации PDF");
  }
});

export default router;