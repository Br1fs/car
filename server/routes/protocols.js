// server/routes/protocols.js
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import loadTimes from "../utils/loadTimes.js";
import { protocolPdfLayouts } from "../config/protocolPdfLayouts.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAB_ADDRESS = "РК, г. Алматы, Турксибский район, мкр. Кайрат, дом 181";
const LOGO_PATH = path.join(__dirname, "..", "templates", "logo.png");

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

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year} г.`;
}

function normalizeFuelType(fuel) {
  const value = String(fuel || "").trim().toLowerCase();

  if (
    value.includes("бенз") ||
    value.includes("gasoline") ||
    value.includes("petrol")
  ) {
    return "benz";
  }

  if (value.includes("диз") || value.includes("diesel")) {
    return "diesel";
  }

  if (
    value.includes("элект") ||
    value.includes("electric") ||
    value.includes("ev")
  ) {
    return "electro";
  }

  return "benz";
}



function isTrailerCategory(category) {
  const value = String(category || "").trim().toLowerCase();
  return (
    value.startsWith("o1") ||
    value.startsWith("o2") ||
    value.startsWith("o3") ||
    value.startsWith("o4")
  );
}

function isN3Category(category) {
  return String(category || "").trim().toLowerCase().startsWith("n3");
}
function normalizeCategory(category) {
  const value = String(category || "").trim().toLowerCase();

  if (value.startsWith("m1")) return "m1";
  if (value.startsWith("m2")) return "m2";
  if (value.startsWith("m3")) return "m3";

  if (value.startsWith("n1")) return "n1";
  if (value.startsWith("n2")) return "n2";
  if (value.startsWith("n3")) return "n3";

  if (value.startsWith("o1")) return "o1";
  if (value.startsWith("o2")) return "o2";
  if (value.startsWith("o3")) return "o3";
  if (value.startsWith("o4")) return "o4";

  return value;
}

function normalizeTemplateCategory(category) {
  const value = String(category || "").trim().toLowerCase();

  if (value === "m1" || value === "m1g") return "m1";
  if (value === "m2" || value === "m2g") return "m2";
  if (value === "m3" || value === "m3g") return "m3";

  if (value === "n1" || value === "n1g") return "n1";
  if (value === "n2" || value === "n2g") return "n2";
  if (value === "n3" || value === "n3g") return "n3";

  if (value === "o1") return "o1";
  if (value === "o2") return "o2";
  if (value === "o3") return "o3";
  if (value === "o4") return "o4";

  return value;
}

function getTemplateKey(protocol) {
  const rawCategory = protocol.templateCategory || protocol.category;
  const category = normalizeTemplateCategory(rawCategory);
  const fuelKey = normalizeFuelType(protocol.fuelType || protocol.fuel);
  const n3Type = String(protocol.n3Type || "").trim().toLowerCase();

  if (
  category === "o1" ||
  category === "o2" ||
  category === "o3" ||
  category === "o4"
) {
  return "o";
}

  if (category === "n3") {
    if (n3Type === "sedelnyi") return "n3_diesel_sedelnyi";
    if (n3Type === "gruzovoi") return "n3_diesel_gruzovoi";
    throw new Error("Для N3 не выбран тип: sedelnyi / gruzovoi");
  }

  return `${category}_${fuelKey}`;
}

function getTemplatePath(protocol) {
  if (protocol.pdfTemplate) {
    return path.join(__dirname, "..", "templates", protocol.pdfTemplate);
  }

  const templateKey = getTemplateKey(protocol);

  const fileMap = {
    m1_benz: "m1_benz.pdf",
    m1_diesel: "m1_diesel.pdf",
    m1_electro: "m1_electro.pdf",

    m2_benz: "m2_benz.pdf",
    m2_diesel: "m2_diesel.pdf",
    m2_electro: "m2_electro.pdf",

    m3_benz: "m3_benz.pdf",
    m3_diesel: "m3_diesel.pdf",
    m3_electro: "m3_electro.pdf",

    n1_benz: "n1_benz.pdf",
    n1_diesel: "n1_diesel.pdf",
    n1_electro: "n1_electro.pdf",

    n2_benz: "n2_benz.pdf",
    n2_diesel: "n2_diesel.pdf",
    n2_electro: "n2_electro.pdf",

    n3_diesel_sedelnyi: "n3_diesel_sedelnyi.pdf",
    n3_diesel_gruzovoi: "n3_diesel_gruzovoi.pdf",

    o: "o.pdf",
  };

  const fileName = fileMap[templateKey];

  if (!fileName) {
    throw new Error(
      `Шаблон не найден: category=${protocol.category}, templateCategory=${protocol.templateCategory}, fuel=${protocol.fuelType}, n3Type=${protocol.n3Type}, templateKey=${templateKey}`
    );
  }

  return path.join(__dirname, "..", "templates", fileName);
}

function drawMultilineText(page, text, x, y, maxWidth, font, size, lineGap = 1) {
  const str = String(text ?? "").trim();
  if (!str) return 0;

  const words = str.split(/\s+/);
  let line = "";
  let lines = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const w = font.widthOfTextAtSize(testLine, size);

    if (w > maxWidth && line) {
      page.drawText(line, {
        x,
        y: y - lines * (size + lineGap),
        size,
        font,
      });
      lines++;
      line = words[i];
    } else {
      line = testLine;
    }
  }

  page.drawText(line, {
    x,
    y: y - lines * (size + lineGap),
    size,
    font,
  });

  lines++;
  return lines;
}

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const oneDec = (n) => (Math.round(n * 10) / 10).toFixed(1);

function buildM1GeneratedValues() {
  return {
    page4: {
      r1: randInt(729, 780),
      r2: randInt(690, 727),
      r3: oneDec(randInt(700, 850) / 10),
      r4: randInt(729, 780),
      r5: randInt(690, 727),
    },
    page5: {
      r1: oneDec(randInt(650, 750) / 10),
      r2: randInt(721, 780),
      r3: randInt(690, 719),
      r4: randInt(720, 780),
      r5: randInt(690, 719),
      r6: oneDec(randInt(80, 120) * 1000),
      r7: randInt(65, 100),
    },
    page6: {
      r1: randInt(50, 150) / 100,
      r2: randInt(180, 360),
      r3: randInt(77, 95),
      r4: randInt(20, 60) / 10,
      r5: randInt(20, 60) / 10,
    },
    page11: {
      r1: randInt(700, 719),
      r2: randInt(724, 740),
    },
  };
}

function buildN3GeneratedValues() {
  const m1 = buildM1GeneratedValues();

  return {
    // 4 страница N3: первые 5 как у M1 page4,
    // остальные 4 по наиболее логичной схеме взяты из M1 diesel page5 (r2-r5)
    page4: {
      r1: m1.page4.r1,
      r2: m1.page4.r2,
      r3: m1.page4.r3,
      r4: m1.page4.r4,
      r5: m1.page4.r5,
      r6: randInt(721, 780),
      r7: randInt(690, 719),
      r8: oneDec(randInt(80, 120) * 1000),
      r9: randInt(65, 100),
    },

    // 5 страница N3: 5 значений
    // тут собрал максимально близко к тому, как ты описал:
    // 1 = M6 r1
    // 2 = СЛУЧМЕЖДУ(25;90)/100
    // 3 = M6 r3
    // 4 = M6 r4
    // 5 = M6 r5
    page5: {
      r1: randInt(50, 150) / 100,
      r2: randInt(25, 90) / 100,
      r3: randInt(77, 95),
      r4: randInt(150, 400),
      r5: randInt(15, 40) / 10,
    },

    // 6 страница N3: 2 значения = M6 r4, r5
    page6: {
      r1: randInt(80, 99),
      r2: randInt(0, 90) / 10,
    },

    page13: {
      r1: randInt(700, 719),
      r2: randInt(724, 740),
    },
  };
}

function buildOTrailerGeneratedValues() {
  return {
    page2: {
      r1: oneDec(randInt(700, 850) / 10),
      r2: randInt(500, 600),
      r3: randInt(620, 680),
      r4: randInt(12, 20) / 10,
    },
    page3: {
      r1: randInt(650, 710),
      r2: randInt(720, 780),
    },
    page4: {
      r1: randInt(40, 80),
      r2: randInt(110, 150),
      r3: randInt(100, 300),
      r4: randInt(40, 90),
      r5: randInt(200, 420),
    },
  };
}

function getGeneratedValues(protocol) {
  const category = normalizeCategory(protocol.templateCategory || protocol.category);

  if (category === "n3") return buildN3GeneratedValues();

  if (
    category === "o1" ||
    category === "o2" ||
    category === "o3" ||
    category === "o4" ||
    category === "o"
  ) {
    return buildOTrailerGeneratedValues();
  }

  // M1 + временно N1/N2 = как M1
  return buildM1GeneratedValues();
}

function drawValue(page, cfg, value, font) {
  if (!cfg) return;
  page.drawText(String(value ?? ""), {
    x: cfg.x,
    y: cfg.y,
    size: cfg.size,
    font,
  });
}

function drawPage1(page, p1, protocol, font) {
  const rc = p1.rightColumn;

  const protocolNumberText = `${protocol.protocolNumber ?? ""}`;
  page.drawText(protocolNumberText, {
    x: p1.protocolNumber.x,
    y: p1.protocolNumber.y,
    size: p1.protocolNumber.size,
    font,
  });

  page.drawText(protocolNumberText, {
    x: p1.protocolNumber.x + (p1.protocolNumber.boldOffsetX || 0),
    y: p1.protocolNumber.y,
    size: p1.protocolNumber.size,
    font,
  });

  const dateText = formatDateRu(protocol.protocolDate);

  page.drawText(dateText, {
    x: p1.protocolDate.x,
    y: p1.protocolDate.y,
    size: p1.protocolDate.size,
    font,
  });

  page.drawText(dateText, {
    x: p1.protocolDate.x + (p1.protocolDate.boldOffsetX || 0),
    y: p1.protocolDate.y,
    size: p1.protocolDate.size,
    font,
  });

  const xRight = rc.x;
  let yRight = rc.startY;
  const step = rc.step;

  function putRight(value, opts = {}) {
    const text = String(value ?? "").trim();

    if (!text) {
      yRight -= step;
      return;
    }

    page.drawText(text, {
      x: xRight,
      y: yRight,
      size: opts.size ?? rc.defaultSize ?? 6,
      font,
    });

    yRight -= step;
  }

  function putRightWrap(value, opts = {}) {
    const text = String(value ?? "").trim();

    if (!text) {
      yRight -= step;
      return;
    }

    const size = opts.size ?? rc.defaultSize ?? 6;
    const maxWidth = opts.maxWidth ?? rc.wrapMaxWidth ?? 170;
    const gap = opts.gap ?? 1;

    const usedLines = drawMultilineText(
      page,
      text,
      xRight,
      yRight,
      maxWidth,
      font,
      size,
      gap
    );

    const lineHeight = size + gap;
    yRight -= usedLines * lineHeight + 2;
  }

  putRight(protocol.brand, { size: rc.defaultSize ?? 6 });
  putRight(protocol.model, { size: rc.defaultSize ?? 6 });
  putRight(protocol.typ, { size: rc.defaultSize ?? 6 });
  putRight(protocol.vin, { size: rc.defaultSize ?? 6 });
  putRight(protocol.category, { size: rc.defaultSize ?? 6 });

  if (!isTrailerCategory(protocol.category)) {
    putRight(protocol.EcologicalClass, {
      size: rc.defaultSize ?? 6,
    });
  }

  putRight(`${protocol.year ?? ""} г.в.`, {
    size: rc.yearSize ?? rc.defaultSize ?? 6,
  });

  putRight(formatDateRu(protocol.protocolDate), {
    size: rc.defaultSize ?? 6,
  });

  yRight -= step * (rc.afterFirstDateGap ?? 0.01);

  putRight(formatDateRu(protocol.protocolDate), {
    size: rc.defaultSize ?? 6,
  });

  yRight -= step * (rc.afterSecondDateGap ?? 2.6);

  putRight(protocol.fio, {
    size: rc.fioSize ?? rc.defaultSize ?? 6,
  });

  yRight -= step * (rc.afterFioGap ?? 0.2);

  putRightWrap(protocol.address, {
    size: rc.addressSize ?? 6,
    maxWidth: rc.addressMaxWidth ?? 165,
    gap: 1,
  });

  yRight -= step * (rc.afterAddressGap ?? 0.8);

  page.drawText(String(protocol.MANUFACTURER || ""), {
    x: p1.manufacturer.x,
    y: p1.manufacturer.y,
    size: p1.manufacturer.size,
    font,
  });

  drawMultilineText(
    page,
    protocol.legaladdressoftheMANUFACTURER || "",
    p1.manufacturerAddress.x,
    p1.manufacturerAddress.y,
    p1.manufacturerAddress.maxWidth,
    font,
    p1.manufacturerAddress.size,
    p1.manufacturerAddress.lineGap
  );

  page.drawText(String(protocol.ASSEMBLYPLANT || ""), {
    x: p1.assemblyPlant.x,
    y: p1.assemblyPlant.y,
    size: p1.assemblyPlant.size,
    font,
  });

  drawMultilineText(
    page,
    protocol.addressoftheassemblyplant || "",
    p1.assemblyPlantAddress.x,
    p1.assemblyPlantAddress.y,
    p1.assemblyPlantAddress.maxWidth,
    font,
    p1.assemblyPlantAddress.size,
    p1.assemblyPlantAddress.lineGap
  );

  page.drawText(`${protocol.temperature || ""} °C`, {
    x: p1.conditions.x,
    y: p1.conditions.temperatureY,
    size: p1.conditions.size,
    font,
  });

  page.drawText(`${protocol.humidity || ""} %`, {
    x: p1.conditions.x,
    y: p1.conditions.humidityY,
    size: p1.conditions.size,
    font,
  });

  page.drawText(`${protocol.pressure || ""} мм рт. ст.`, {
    x: p1.conditions.x,
    y: p1.conditions.pressureY,
    size: p1.conditions.size,
    font,
  });
}

router.get("/:id/pdf-template", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Неверный ID");
    }

    const protocol = await db
      .collection("protocols")
      .findOne({ _id: new ObjectId(id) });

    if (!protocol) {
      return res.status(404).send("Протокол не найден");
    }

    const templatePath = getTemplatePath(protocol);

    if (!fs.existsSync(templatePath)) {
      return res.status(500).send(`Шаблон не найден: ${templatePath}`);
    }

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "..", "fonts", "times.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    const fuelKey = normalizeFuelType(protocol.fuelType || protocol.fuel);
    const categoryKey = normalizeCategory(
      protocol.templateCategory || protocol.category
);
    const templateKey = getTemplateKey(protocol);
    const layout = protocolPdfLayouts[templateKey];
    const generated = getGeneratedValues(protocol);

    if (!layout) {
      return res.status(500).send(`Нет layout для шаблона: ${templateKey}`);
    }

    // page 1
    if (layout.page1 && pages[0]) {
      drawPage1(pages[0], layout.page1, protocol, font);
    }

    // page 2
    if (categoryKey === "o") {
      if (layout.page2 && pages[1]) {
        const page2 = pages[1];
        const p2 = layout.page2;

        drawValue(page2, p2.r1, generated.page2.r1, font);
        drawValue(page2, p2.r2, generated.page2.r2, font);
        drawValue(page2, p2.r3, generated.page2.r3, font);
        drawValue(page2, p2.r4, generated.page2.r4, font);
      }
    } else {
      if (layout.page2?.extraEquipment && pages[1]) {
        const page2 = pages[1];
        const p2 = layout.page2;

        drawMultilineText(
          page2,
          protocol.extraEquipment || "",
          p2.extraEquipment.x,
          p2.extraEquipment.y,
          p2.extraEquipment.maxWidth,
          font,
          p2.extraEquipment.size
        );
      }
    }

    // page 3 only O
    if (categoryKey === "o" && layout.page3 && pages[2]) {
      const page3 = pages[2];
      const p3 = layout.page3;

      drawValue(page3, p3.r1, generated.page3.r1, font);
      drawValue(page3, p3.r2, generated.page3.r2, font);
    }

    // page 4
    if (layout.page4 && pages[3]) {
      const page4 = pages[3];
      const p4 = layout.page4;

      if (categoryKey === "n3") {
        drawValue(page4, p4.r1, generated.page4.r1, font);
        drawValue(page4, p4.r2, generated.page4.r2, font);
        drawValue(page4, p4.r3, generated.page4.r3, font);
        drawValue(page4, p4.r4, generated.page4.r4, font);
        drawValue(page4, p4.r5, generated.page4.r5, font);
        drawValue(page4, p4.r6, generated.page4.r6, font);
        drawValue(page4, p4.r7, generated.page4.r7, font);
        drawValue(page4, p4.r8, generated.page4.r8, font);
        drawValue(page4, p4.r9, generated.page4.r9, font);
      } else if (categoryKey === "o") {
        drawValue(page4, p4.r1, generated.page4.r1, font);
        drawValue(page4, p4.r2, generated.page4.r2, font);
        drawValue(page4, p4.r3, generated.page4.r3, font);
        drawValue(page4, p4.r4, generated.page4.r4, font);
        drawValue(page4, p4.r5, generated.page4.r5, font);
      } else {
        drawValue(page4, p4.r1, generated.page4.r1, font);
        drawValue(page4, p4.r2, generated.page4.r2, font);
        drawValue(page4, p4.r3, generated.page4.r3, font);
        drawValue(page4, p4.r4, generated.page4.r4, font);
        drawValue(page4, p4.r5, generated.page4.r5, font);
      }
    }

    // page 5
    if (categoryKey === "n3") {
      if (layout.page5 && pages[4]) {
        const page5 = pages[4];
        const p5 = layout.page5;

        drawValue(page5, p5.r1, generated.page5.r1, font);
        drawValue(page5, p5.r2, generated.page5.r2, font);
        drawValue(page5, p5.r3, generated.page5.r3, font);
        drawValue(page5, p5.r4, generated.page5.r4, font);
        drawValue(page5, p5.r5, generated.page5.r5, font);
      }
    } else if (categoryKey === "m1" || categoryKey === "n1" || categoryKey === "n2") {
      if (layout.page5 && pages[4]) {
        const page5 = pages[4];
        const p5 = layout.page5;

        drawValue(page5, p5.r1, generated.page5.r1, font);
        drawValue(page5, p5.r2, generated.page5.r2, font);
        drawValue(page5, p5.r3, generated.page5.r3, font);
        drawValue(page5, p5.r4, generated.page5.r4, font);
        drawValue(page5, p5.r5, generated.page5.r5, font);
        drawValue(page5, p5.r6, generated.page5.r6, font);
        drawValue(page5, p5.r7, generated.page5.r7, font);
      }
    }

    // page 6
    // page 6
if (categoryKey === "n3") {
  if (layout.page6 && pages[5]) {
    const page6 = pages[5];
    const p6 = layout.page6;

    drawValue(page6, p6.r1, generated.page6.r1, font);
    drawValue(page6, p6.r2, generated.page6.r2, font);
  }
} else if (categoryKey === "m1" || categoryKey === "n1" || categoryKey === "n2") {
  if (layout.page6 && pages[5]) {
    const page6 = pages[5];
    const p6 = layout.page6;

    drawValue(page6, p6.r1, generated.page6.r1, font);
    drawValue(page6, p6.r2, generated.page6.r2, font);
    drawValue(page6, p6.r3, generated.page6.r3, font);
    drawValue(page6, p6.r4, generated.page6.r4, font);
    drawValue(page6, p6.r5, generated.page6.r5, font);

    if (categoryKey === "n2" && p6.r6) {
      drawValue(page6, p6.r6, randInt(25, 90) / 100, font);
    }
  }
}

    // page 9 for M1
    if (categoryKey === "m1" && layout.page9 && pages[8]) {
      const page9 = pages[8];
      const p9 = layout.page9;

      drawValue(page9, p9.year, protocol.year || "", font);
      drawValue(page9, p9.yearSuffix, "г.в.", font);

      if (fuelKey === "benz") {
        drawValue(page9, p9.coMin, protocol.coMin || "", font);
        drawValue(page9, p9.coMax, protocol.coMax || "", font);
      }

      if (fuelKey === "diesel") {
        drawValue(page9, p9.smoke, protocol.smokeValue || "", font);
      }
    }

    // page 10
    if (categoryKey === "m1" && layout.page10 && pages[9]) {
      const page10 = pages[9];
      const p10 = layout.page10;

      const w = protocol.width ?? protocol.Width ?? "";
      const h = protocol.height ?? protocol.Height ?? "";
      const l = protocol.length ?? protocol.Length ?? "";

      drawValue(page10, p10.length, l, font);
      drawValue(page10, p10.width, w, font);
      drawValue(page10, p10.height, h, font);
    }

    // N3 page 10 = дым
    if (categoryKey === "n3" && layout.page10 && pages[9]) {
      const page10 = pages[9];
      const p10 = layout.page10;

      drawValue(page10, p10.year, protocol.year || "", font);
      drawValue(page10, p10.yearSuffix, "г.в.", font);
      drawValue(page10, p10.smoke, protocol.smokeValue || "", font);
    }

    // page 11 M1 = шум
    if (categoryKey === "m1" && layout.page11 && pages[10]) {
      const page11 = pages[10];
      const p11 = layout.page11;

      if (fuelKey !== "electro" && p11.noise) {
        drawValue(page11, p11.noise, protocol.noiseValue || "", font);
      }

      drawValue(page11, p11.r1, generated.page11.r1, font);
      drawValue(page11, p11.r2, generated.page11.r2, font);
    }

    // N3 page 12 = габариты
    if (categoryKey === "n3" && layout.page12 && pages[11]) {
      const page12 = pages[11];
      const p12 = layout.page12;

      const w = protocol.width ?? protocol.Width ?? "";
      const h = protocol.height ?? protocol.Height ?? "";
      const l = protocol.length ?? protocol.Length ?? "";

      drawValue(page12, p12.length, l, font);
      drawValue(page12, p12.width, w, font);
      drawValue(page12, p12.height, h, font);
    }

    // N3 page 13 = шум
    if (categoryKey === "n3" && layout.page13 && pages[12]) {
      const page13 = pages[12];
      const p13 = layout.page13;

      drawValue(page13, p13.noise, protocol.noiseValue || "", font);
      drawValue(page13, p13.r1, generated.page13.r1, font);
      drawValue(page13, p13.r2, generated.page13.r2, font);
    }
  
// N1 page 9 = год + CO/дым
if (categoryKey === "n1" && layout.page9 && pages[8]) {
  const page9 = pages[8];
  const p9 = layout.page9;

  drawValue(page9, p9.year, protocol.year || "", font);
  drawValue(page9, p9.yearSuffix, "г.в.", font);

  if (fuelKey === "benz") {
    drawValue(page9, p9.coMin, protocol.coMin || "", font);
    drawValue(page9, p9.coMax, protocol.coMax || "", font);
  }

  if (fuelKey === "diesel") {
    drawValue(page9, p9.smoke, protocol.smokeValue || "", font);
  }
}

// N1 page 10 = габариты
if (categoryKey === "n1" && layout.page10 && pages[9]) {
  const page10 = pages[9];
  const p10 = layout.page10;

  const w = protocol.width ?? protocol.Width ?? "";
  const h = protocol.height ?? protocol.Height ?? "";
  const l = protocol.length ?? protocol.Length ?? "";

  drawValue(page10, p10.length, l, font);
  drawValue(page10, p10.width, w, font);
  drawValue(page10, p10.height, h, font);
}

// N1 page 11 = шум
if (categoryKey === "n1" && layout.page11 && pages[10]) {
  const page11 = pages[10];
  const p11 = layout.page11;

  if (fuelKey !== "electro" && p11.noise) {
    drawValue(page11, p11.noise, protocol.noiseValue || "", font);
  }
}    
// N2 page 9 = год
if (categoryKey === "n2" && layout.page9 && pages[8]) {
  const page9 = pages[8];
  const p9 = layout.page9;

  if (p9.year) {
    drawValue(page9, p9.year, protocol.year || "", font);
  }

  if (p9.yearSuffix) {
    drawValue(page9, p9.yearSuffix, "г.в.", font);
  }
}
// N2 page 10 = дым
if (categoryKey === "n2" && layout.page10 && pages[9]) {
  const page10 = pages[9];
  const p10 = layout.page10;

  if (fuelKey === "diesel" && p10.smoke) {
    drawValue(page10, p10.smoke, protocol.smokeValue || "", font);
  }

  if (fuelKey === "benz") {
    if (p10.coMin) drawValue(page10, p10.coMin, protocol.coMin || "", font);
    if (p10.coMax) drawValue(page10, p10.coMax, protocol.coMax || "", font);
  }
}
// N2 page 10 = CO
if (categoryKey === "n2" && layout.page10 && pages[9]) {
  console.log("DRAW N2 PAGE10");
  const page10 = pages[9];
  const p10 = layout.page10;

  if (fuelKey === "benz") {
    if (p10.coMin) drawValue(page10, p10.coMin, protocol.coMin || "", font);
    if (p10.coMax) drawValue(page10, p10.coMax, protocol.coMax || "", font);
  }
}

if (categoryKey === "n2" && layout.page11 && pages[10]) {
  const page11 = pages[10];
  const p11 = layout.page11;

  const w = protocol.width ?? protocol.Width ?? "";
  const h = protocol.height ?? protocol.Height ?? "";
  const l = protocol.length ?? protocol.Length ?? "";


  if (p11.length) drawValue(page11, p11.length, l, font);
  if (p11.width) drawValue(page11, p11.width, w, font);
  if (p11.height) drawValue(page11, p11.height, h, font);
}

if (categoryKey === "n2" && layout.page12 && pages[11]) {
  const page12 = pages[11];
  const p12 = layout.page12;

  console.log("DRAW N2 smoke/noise:", protocol.smokeValue, protocol.noiseValue);

  if (fuelKey === "diesel" && p12.smoke) {
    drawValue(page12, p12.smoke, protocol.smokeValue || "", font);
  }

  if (p12.noise) {
    drawValue(page12, p12.noise, protocol.noiseValue || "", font);
  }
}

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("PDF TEMPLATE ERROR:", err);
    res.status(500).send(err.message);
  }
});

// ================= GET все протоколы =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const protocols = await db
      .collection("protocols")
      .find(
        {},
        {
          projection: {
            protocolNumber: 1,
            createdAt: 1,
            fio: 1,
            vin: 1,
            brand: 1,
            model: 1,
            typ: 1,
            category: 1,
            fuelType: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(protocols);
  } catch (err) {
    console.error("Ошибка загрузки протоколов:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= POST создать протокол =================
router.post("/create", async (req, res) => {
  try {
    const db = getDB();
    const data = req.body;

    if (!data) return res.status(400).json({ message: "no data" });

    const result = await db.collection("protocols").insertOne({
      ...data,
      createdAt: new Date(),
    });

    res.json({ message: "ok", _id: result.insertedId.toString() });
  } catch (err) {
    console.error("CREATE PROTOCOL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET PDF протокола =================
router.get("/:id/pdf", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.status(400).send("Неверный ID");

    const protocol = await db.collection("protocols").findOne({ _id: new ObjectId(id) });
    if (!protocol) return res.status(404).send("Протокол не найден");

    const doc = new jsPDF("p", "mm", "a4");

    await loadTimes(doc);
    doc.setFont("Times", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const usableWidth = pageWidth - margin * 2;
    const normalizedCategory = normalizeCategory(protocol.category);
    const fuel = String(protocol.fuelType || protocol.fuel || "").trim().toLowerCase();

    const grid = {
      theme: "grid",
      styles: {
        font: "Times",
        fontSize: 9,
        cellPadding: 1.2,
        textColor: [0, 0, 0],
        lineColor: [190, 190, 190],
        lineWidth: 0.1,
        fillColor: [255, 255, 255],
        valign: "top",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [190, 190, 190],
        lineWidth: 0.1,
        fontStyle: "bold",
      },
    };

    let logoBase64 = null;
    try {
      const buf = fs.readFileSync(LOGO_PATH);
      logoBase64 = "data:image/png;base64," + buf.toString("base64");
    } catch {
      logoBase64 = null;
    }

    const getVal = (label) => {
      const arr = Array.isArray(protocol.identificationResults)
        ? protocol.identificationResults
        : [];
      const found = arr.find((x) => (x?.label || "").trim() === label.trim());
      return found?.value != null ? String(found.value) : "";
    };

    let y = 10;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      ...grid,
      body: [
        [
          { content: "", styles: { minCellHeight: 22 } },
          { content: protocol.countryText || "", styles: { halign: "left", minCellHeight: 22 } },
          { content: protocol.accreditationText || "", styles: { halign: "right", minCellHeight: 22 } },
        ],
        [
          { content: LAB_ADDRESS, colSpan: 3, styles: { halign: "center", minCellHeight: 10, valign: "middle" } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: usableWidth * 0.16 },
        1: { cellWidth: usableWidth * 0.42 },
        2: { cellWidth: usableWidth * 0.42 },
      },
      styles: { ...grid.styles, cellPadding: 1.0 },
      didDrawCell: (data) => {
        if (!logoBase64) return;
        if (data.row.index !== 0 || data.column.index !== 0) return;

        const cell = data.cell;
        const pad = 1.2;
        const boxW = cell.width - pad * 2;
        const boxH = cell.height - pad * 2;

        const props = doc.getImageProperties(logoBase64);
        const ratio = props.width / props.height;

        let w = boxW;
        let h = w / ratio;
        if (h > boxH) {
          h = boxH;
          w = h * ratio;
        }

        const x = cell.x + (cell.width - w) / 2;
        const yy = cell.y + (cell.height - h) / 2;
        doc.addImage(logoBase64, "PNG", x, yy, w, h);
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    const dateStr = formatDateRu(protocol.protocolDate) || "-";
    const numStr = protocol.protocolNumber || "-";

    doc.setFont("Times", "bold");
    doc.setFontSize(16);
    doc.text("ПРОТОКОЛ", pageWidth / 2, y, { align: "center" });

    y += 7;
    doc.setFont("Times", "normal");
    doc.setFontSize(11);

    doc.text(
      `технической экспертизы и испытаний единичного транспортного средства № ${numStr} от ${dateStr}`,
      pageWidth / 2,
      y,
      { align: "center", maxWidth: usableWidth }
    );

    y += 7;
    doc.text(
      "На соответствие требованиям ТР ТС 018/2011 «О безопасности колесных транспортных средств» п. 11-14, приложение № 4-6, п. 4 приложение 7",
      pageWidth / 2,
      y,
      { align: "center", maxWidth: usableWidth }
    );

    y += 12;

    doc.setFont("Times", "bold");
    doc.setFontSize(12);
    doc.text("РЕЗУЛЬТАТЫ ИДЕНТИФИКАЦИИ:", pageWidth / 2, y, { align: "center" });

    y += 6;
    doc.setFont("Times", "normal");
    doc.setFontSize(10);

    const idRowsBase = [
      ["Марка", getVal("Марка") || protocol.brand || ""],
      ["Коммерческое наименование", getVal("Коммерческое наименование") || protocol.model || ""],
      ["Тип", getVal("Тип") || protocol.typ || ""],
      ["VIN", getVal("VIN") || protocol.vin || ""],
      ["Категория", getVal("Категория") || protocol.category || ""],
      ["Экологический класс", getVal("Экологический класс") || protocol.EcologicalClass || ""],
      ["Год выпуска", getVal("Год выпуска") || protocol.year || ""],
      ["Дата предоставления объекта", getVal("Дата предоставления объекта") || formatDateRu(protocol.protocolDate)],
      ["Собственник", getVal("Собственник") || protocol.fio || ""],
      ["Место проведения испытаний", getVal("Место проведения испытаний") || protocol.address || ""],
      ["НД на продукцию", getVal("НД на продукцию")],
      ["Сведение о собственнике транспортного средства (фамилия, имя, отчество или", getVal("Сведение о собственнике транспортного средства (фамилия, имя, отчество или")],
      ["Наименование организации, адрес места жительства или юридический адрес)", getVal("Наименование организации, адрес места жительства или юридический адрес)")],
      ["Адрес собственника", getVal("Адрес собственника") || protocol.address || ""],
      ["Изготовитель", getVal("Изготовитель") || protocol.MANUFACTURER || ""],
      ["Сборочный завод", getVal("Сборочный завод") || protocol.ASSEMBLYPLANT || ""],
    ];

    const idRows =
      normalizedCategory === "o"
        ? idRowsBase.filter(([label]) => label !== "Экологический класс")
        : idRowsBase;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      ...grid,
      styles: { ...grid.styles, fontSize: 10, cellPadding: 2.5, valign: "middle" },
      body: idRows.map(([l, v]) => [
        { content: l || "", styles: { halign: "center" } },
        { content: v || "", styles: { halign: "center" } },
      ]),
      columnStyles: {
        0: { cellWidth: usableWidth * 0.70 },
        1: { cellWidth: usableWidth * 0.30 },
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    doc.setFont("Times", "bold");
    doc.setFontSize(12);
    doc.text("УСЛОВИЯ ПРОВЕДЕНИЯ ИСПЫТАНИЙ", pageWidth / 2, y, { align: "center" });

    y += 6;
    doc.setFont("Times", "normal");
    doc.setFontSize(10);

    const condRows = (protocol.testConditions || []).map((c) => [
      c.label || "",
      Array.isArray(c.value) ? c.value.filter(Boolean).join(" ") : String(c.value ?? ""),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      ...grid,
      head: [[
        { content: "УСЛОВИЯ ПРОВЕДЕНИЯ ИСПЫТАНИЙ", styles: { halign: "left" } },
        { content: "Значение", styles: { halign: "left" } },
      ]],
      body: condRows,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.70 },
        1: { cellWidth: usableWidth * 0.30 },
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    doc.setFont("Times", "bold");
    doc.setFontSize(12);
    doc.text("ПЕРЕЧЕНЬ СРЕДСТВ ИСПЫТАНИЙ И ИЗМЕРЕНИЙ", pageWidth / 2, y, { align: "center" });

    y += 6;
    doc.setFont("Times", "normal");
    doc.setFontSize(9);

    const equipment = Array.isArray(protocol.testEquipment) ? protocol.testEquipment : [];
    const equipmentRows = Array.from({ length: 18 }, (_, i) => {
      const row = equipment[i] || {};
      return [String(i + 1), row.name || "", row.certificate || ""];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      ...grid,
      head: [[
        { content: "№ п/п", styles: { halign: "center" } },
        { content: "Наименование средств испытаний и измерений", styles: { halign: "center" } },
        { content: "Срок действия сертификата о поверке", styles: { halign: "center" } },
      ]],
      body: equipmentRows,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.15 },
        1: { cellWidth: usableWidth * 0.50 },
        2: { cellWidth: usableWidth * 0.35 },
      },
      styles: { ...grid.styles, fontSize: 9, cellPadding: 2.0, valign: "middle" },
    });

    y = doc.lastAutoTable.finalY + 10;

    doc.setFont("Times", "bold");
    doc.setFontSize(12);
    doc.text("РЕЗУЛЬТАТЫ ТЕХНИЧЕСКОЙ ЭКСПЕРТИЗЫ И ИСПЫТАНИЙ", pageWidth / 2, y, { align: "center" });

    y += 6;
    doc.setFont("Times", "normal");
    doc.setFontSize(9);

    const base = Array.isArray(protocol.technicalResults) ? protocol.technicalResults : [];
    const filtered = base.filter((r) => {
      const p = String(r?.parameter || "").toLowerCase();
      return !["уровень шума", "выбросы газа", "выбросы дыма"].includes(p);
    });

    const extra = [];

    if (normalizedCategory === "m1") {
      if (fuel.includes("бенз")) {
        if (protocol.noiseValue != null) {
          extra.push({ parameter: "Уровень шума", method: "-", normValue: "-", actualValue: String(protocol.noiseValue) });
        }
        if (protocol.gasValue != null) {
          extra.push({ parameter: "Выбросы газа", method: "-", normValue: "-", actualValue: String(protocol.gasValue) });
        }
      } else if (fuel.includes("диз")) {
        if (protocol.noiseValue != null) {
          extra.push({ parameter: "Уровень шума", method: "-", normValue: "-", actualValue: String(protocol.noiseValue) });
        }
        if (protocol.smokeValue != null) {
          extra.push({ parameter: "Выбросы дыма", method: "-", normValue: "-", actualValue: String(protocol.smokeValue) });
        }
      }
    }

    if (normalizedCategory === "n3") {
      if (protocol.noiseValue != null) {
        extra.push({ parameter: "Уровень шума", method: "-", normValue: "-", actualValue: String(protocol.noiseValue) });
      }
      if (protocol.smokeValue != null) {
        extra.push({ parameter: "Выбросы дыма", method: "-", normValue: "-", actualValue: String(protocol.smokeValue) });
      }
    }

    const resultsRows = [...filtered, ...extra].map((r) => [
      r.parameter || "",
      r.method || "",
      r.normValue || "",
      r.actualValue || "",
    ]);

    while (resultsRows.length < 20) resultsRows.push(["", "", "", ""]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      ...grid,
      head: [[
        { content: "Определяемый параметр", styles: { halign: "center" } },
        { content: "НД на методы испытаний", styles: { halign: "center" } },
        { content: "Значение по НД", styles: { halign: "center" } },
        { content: "Фактические значения", styles: { halign: "center" } },
      ]],
      body: resultsRows,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.15 },
        1: { cellWidth: usableWidth * 0.15 },
        2: { cellWidth: usableWidth * 0.40 },
        3: { cellWidth: usableWidth * 0.30 },
      },
      styles: { ...grid.styles, fontSize: 9, cellPadding: 2.0, valign: "middle" },
    });

    const pdfBuffer = doc.output("arraybuffer");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=protocol_${protocol._id}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("PDF ERROR:", err);
    res.status(500).send("Ошибка генерации PDF");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });

    const protocol = await db.collection("protocols").findOne({ _id: new ObjectId(id) });
    if (!protocol) return res.status(404).json({ message: "Протокол не найден" });

    res.json(protocol);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    await db.collection("protocols").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({ message: "Удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

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

    const result = await db.collection("protocols").deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE PROTOCOLS ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});

export default router;