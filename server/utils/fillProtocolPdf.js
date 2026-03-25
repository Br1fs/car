import fs from "fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const BLACK = rgb(0, 0, 0);

function pick(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function toDateYYYYMMDD(v) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// простое разбиение по словам под maxWidth
function wrapText(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function fillProtocolPdf({
  templatePath,
  fontRegularPath,
  fontBoldPath,
  data,    // протокол + заявка (brand/model/vin/address/...)
  manual,  // ручные (noise/coMin/coHigh/...)
  weather, // temp/humidity/pressure
  debugGrid = false, // включишь на время настройки координат
}) {
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const fontRegularBytes = fs.readFileSync(fontRegularPath);
  const fontBoldBytes = fs.readFileSync(fontBoldPath);

  const fontRegular = await pdfDoc.embedFont(fontRegularBytes, { subset: true });
  const fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

  const pages = pdfDoc.getPages();

  // ====== ВАЖНО: ПОДСТАВЬ КООРДИНАТЫ ПОД СВОЙ PDF ======
  // page: индекс страницы (0-based), x/y: мм? нет — в PDF points, но pdf-lib работает в "points".
  // На практике: просто подбираешь x/y по факту (они не в мм).
  // Я оставляю структуру, чтобы было удобно.

  const FIELDS = {
    // --------- 1 страница (pages[0]) ----------
    protocolNumber: { page: 0, x: 520, y: 760, size: 11, font: "bold", align: "right" },
    protocolDate:   { page: 0, x: 520, y: 742, size: 11, font: "regular", align: "right" },

    headerLine:     { page: 0, x: 297, y: 720, size: 11, font: "regular", align: "center" },

    // пример идентификации
    brand: { page: 0, x: 320, y: 640, size: 10, font: "regular" },
    model: { page: 0, x: 320, y: 622, size: 10, font: "regular" },
    vin:   { page: 0, x: 320, y: 586, size: 10, font: "regular" },

    applicantAddress: { page: 0, x: 70, y: 520, size: 10, font: "regular", maxWidth: 450, lineHeight: 12 },

    temp:     { page: 0, x: 460, y: 445, size: 10, font: "regular" },
    humidity: { page: 0, x: 460, y: 430, size: 10, font: "regular" },
    pressure: { page: 0, x: 460, y: 400, size: 10, font: "regular" },

    // --------- 2 страница (УВЭОС) pages[1] ----------
    uveos: { page: 1, x: 510, y: 640, size: 10, font: "regular", align: "left" }, // <-- подгони

    // --------- 9 страница (Д/Ш/В + CO снизу) pages[8] ----------
    length: { page: 8, x: 510, y: 220, size: 10, font: "regular", align: "left" }, // <-- подгони
    width:  { page: 8, x: 510, y: 205, size: 10, font: "regular", align: "left" },
    height: { page: 8, x: 510, y: 190, size: 10, font: "regular", align: "left" },

    coMin:  { page: 8, x: 510, y: 120, size: 10, font: "regular", align: "left" }, // бензин
    coHigh: { page: 8, x: 510, y: 105, size: 10, font: "regular", align: "left" }, // бензин

    // --------- 10 страница (шум) pages[9] ----------
    noise: { page: 9, x: 510, y: 690, size: 10, font: "regular", align: "left" }, // <-- подгони
  };

  function getFont(kind) {
    return kind === "bold" ? fontBold : fontRegular;
  }

  function drawOne(fieldKey, text) {
    const cfg = FIELDS[fieldKey];
    if (!cfg) return;

    const page = pages[cfg.page];
    if (!page) return;

    const font = getFont(cfg.font);
    const size = cfg.size ?? 10;
    const t = pick(text, "");
    if (!t) return;

    // wrap если нужно
    if (cfg.maxWidth) {
      const lines = wrapText(t, font, size, cfg.maxWidth);
      const lh = cfg.lineHeight ?? (size + 2);

      lines.forEach((line, idx) => {
        const y = cfg.y - idx * lh;
        page.drawText(line, { x: cfg.x, y, size, font, color: BLACK });
      });
      return;
    }

    // align
    let x = cfg.x;
    if (cfg.align === "right") {
      x = cfg.x - font.widthOfTextAtSize(t, size);
    } else if (cfg.align === "center") {
      x = cfg.x - font.widthOfTextAtSize(t, size) / 2;
    }

    page.drawText(t, { x, y: cfg.y, size, font, color: BLACK });
  }

  // ---- Debug grid (быстро подобрать координаты) ----
  // Включишь debugGrid=true — на каждой странице нарисует точки и подписи.
  if (debugGrid) {
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const { width, height } = page.getSize();

      // точки каждые 50
      for (let x = 0; x < width; x += 50) {
        page.drawText(String(x), { x, y: 5, size: 6, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      }
      for (let y = 0; y < height; y += 50) {
        page.drawText(String(y), { x: 5, y, size: 6, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      }
      page.drawText(`PAGE ${p + 1}`, { x: width - 60, y: height - 20, size: 10, font: fontBold, color: rgb(1, 0, 0) });
    }
  }

  // ====== Заполнение значений ======
  const protocolNumber = pick(data.protocolNumber);
  const protocolDate = toDateYYYYMMDD(data.protocolDate);

  // строка заголовка как ты хочешь:
  const headerLine =
    `технической экспертизы и испытаний единичного транспортного средства № ${protocolNumber} от ${protocolDate}`;

  drawOne("protocolNumber", protocolNumber);
  drawOne("protocolDate", protocolDate);
  drawOne("headerLine", headerLine);

  drawOne("brand", data.brand);
  drawOne("model", data.model);
  drawOne("vin", data.vin);

  drawOne("applicantAddress", data.applicantAddress);

  // погода с единицами
  if (weather) {
    if (pick(weather.temp)) drawOne("temp", `${weather.temp} °C`);
    if (pick(weather.humidity)) drawOne("humidity", `${weather.humidity} %`);
    if (pick(weather.pressure)) drawOne("pressure", `${weather.pressure}`);
  }

  // УВЭОС на 2 странице (из заявки “дополнительное”)
  drawOne("uveos", data.uveosValue);

  // Д/Ш/В на 9 странице (из заявки)
  drawOne("length", data.lengthValue);
  drawOne("width", data.widthValue);
  drawOne("height", data.heightValue);

  // бензин: CO
  if (data.fuelType === "Бензин") {
    drawOne("coMin", manual.coMin);
    drawOne("coHigh", manual.coHigh);
  }

  // шум на 10 странице (для бензин/дизель, для электро можешь не рисовать)
  if (data.fuelType !== "Электрический") {
    drawOne("noise", manual.noise);
  }

  const outBytes = await pdfDoc.save();
  return outBytes;
}