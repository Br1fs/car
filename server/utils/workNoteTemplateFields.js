/**
 * Поля для DOCX-шаблонов рабочей записи (docxtemplater).
 * В Word вставляйте плейсхолдеры ровно в таком виде: {protocolNumber}
 */
import PizZip from "pizzip";

const sanitize = (value) => String(value ?? "").trim();

export const WORK_NOTE_TEMPLATE_FIELDS = [
  { key: "protocolNumber", label: "№ протокола", example: "0566" },
  { key: "fio", label: "ФИО заявителя", example: "Иванов Иван Иванович" },
  { key: "vin", label: "VIN", example: "JTDKN3DU0E0123456" },
  { key: "brand", label: "Марка", example: "Toyota" },
  { key: "model", label: "Модель", example: "Camry" },
  { key: "year", label: "Год выпуска", example: "2020" },
  { key: "color", label: "Цвет", example: "Белый" },
  { key: "fullCarName", label: "Марка и модель (одной строкой)", example: "Toyota Camry" },
  { key: "specialist", label: "Специалист", example: "Петров П.П." },
  { key: "broker", label: "Брокер", example: "ООО «Брокер»" },
  { key: "category", label: "Категория ТС", example: "M1" },
  { key: "fuelType", label: "Топливо", example: "Бензин" },
  { key: "iccid", label: "ICCID (из АКТ)", example: "89990100000000000000" },
  { key: "imei", label: "IMEI (из АКТ)", example: "353456789012345" },
  { key: "serialNumber", label: "Серийный номер (из АКТ)", example: "SN123456" },
  { key: "createdAt", label: "Дата создания заявки (локаль ru)", example: "05.05.2026" },
];

export function getWorkNoteTemplateData(app = {}) {
  return {
    protocolNumber: sanitize(app.protocolNumber),
    fio: sanitize(app.fio),
    vin: sanitize(app.vin),
    brand: sanitize(app.brand),
    model: sanitize(app.model),
    year: sanitize(app.year),
    color: sanitize(app.color),
    specialist: sanitize(app.specialist),
    broker: sanitize(app.broker),
    category: sanitize(app.category || app.templateCategory),
    fuelType: sanitize(app.fuelType || app.fuel),
    iccid: sanitize(app.iccid),
    imei: sanitize(app.imei),
    serialNumber: sanitize(app.serialNumber),
    fullCarName: sanitize(`${app.brand || ""} ${app.model || ""}`),
    createdAt: app.createdAt ? new Date(app.createdAt).toLocaleDateString("ru-RU") : "",
  };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ooxmlParagraph(text, opts = {}) {
  const safe = escapeXml(text);
  const jc = opts.center ? "<w:pPr><w:jc w:val=\"center\"/></w:pPr>" : "";
  const bold = opts.bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:p>${jc}<w:r>${bold}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
}

/** Порядок строк как в PDF «М1,M1G rab zapis» (подстановки в правой колонке). */
const SAMPLE_FORM_ROWS = [
  ["№ заявки (протокол)", "{protocolNumber}"],
  ["ICCID", "{iccid}"],
  ["IMEI", "{imei}"],
  ["Серийный номер оборудования", "{serialNumber}"],
  ["VIN", "{vin}"],
  ["Марка, модель", "{fullCarName}"],
  ["Год выпуска", "{year}"],
  ["Цвет", "{color}"],
  ["Категория ТС", "{category}"],
  ["Топливо", "{fuelType}"],
  ["Специалист", "{specialist}"],
  ["Брокер", "{broker}"],
  ["Дата создания заявки", "{createdAt}"],
  ["Заказчик (ФИО)", "{fio}"],
];

const TBL_BORDERS = `<w:tblBorders>
  <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
  <w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>
  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
  <w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>
  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="666666"/>
  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="666666"/>
</w:tblBorders>`;

function tc(text, widthTwip, opts = {}) {
  const safe = escapeXml(text);
  const span = opts.gridSpan ? `<w:gridSpan w:val="${opts.gridSpan}"/>` : "";
  const w = opts.fullWidth ? opts.fullWidth : widthTwip;
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${w}" w:type="dxa"/>
      ${span}
      <w:tcMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tcMar>
    </w:tcPr>
    <w:p>${opts.center ? "<w:pPr><w:jc w:val=\"center\"/></w:pPr>" : ""}<w:r>${opts.bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>
  </w:tc>`;
}

function buildFormTable() {
  const wLabel = 3600;
  const wVal = 5400;
  const headerRow = `<w:tr>${tc("Рабочая запись — пример DOCX (как в PDF-бланке)", wLabel + wVal, {
    gridSpan: 2,
    fullWidth: wLabel + wVal,
    center: true,
    bold: true,
  })}</w:tr>`;
  const dataRows = SAMPLE_FORM_ROWS.map(
    ([label, ph]) =>
      `<w:tr>${tc(label, wLabel, { bold: false })}${tc(ph, wVal, {
        bold: false,
      })}</w:tr>`
  ).join("");
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${wLabel + wVal}" w:type="dxa"/>
      ${TBL_BORDERS}
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="${wLabel}"/><w:gridCol w:w="${wVal}"/></w:tblGrid>
    ${headerRow}
    ${dataRows}
  </w:tbl>`;
}

function buildReferenceTable() {
  const c1 = 2400;
  const c2 = 4200;
  const c3 = 2400;
  const head = `<w:tr>
    ${tc("Плейсхолдер", c1, { bold: true })}
    ${tc("Описание", c2, { bold: true })}
    ${tc("Пример значения", c3, { bold: true })}
  </w:tr>`;
  const rows = WORK_NOTE_TEMPLATE_FIELDS.map(
    (f) =>
      `<w:tr>
        ${tc(`{${f.key}}`, c1)}
        ${tc(f.label, c2)}
        ${tc(f.example, c3)}
      </w:tr>`
  ).join("");
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${c1 + c2 + c3}" w:type="dxa"/>
      ${TBL_BORDERS}
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="${c1}"/><w:gridCol w:w="${c2}"/><w:gridCol w:w="${c3}"/></w:tblGrid>
    ${head}
    ${rows}
  </w:tbl>`;
}

/**
 * DOCX-пример: основная таблица «как в PDF» (наименование | плейсхолдер) + справочная таблица полей.
 */
export function buildSampleWorkNoteDocxBuffer() {
  const bodyInner = [
    ooxmlParagraph(
      "Скопируйте таблицу в свой шаблон или расставьте поля {…} вручную. При формировании записи docxtemplater подставит данные заявки."
    ),
    buildFormTable(),
    ooxmlParagraph(""),
    ooxmlParagraph("Справка по всем полям (таблица):", { bold: true }),
    buildReferenceTable(),
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyInner}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const zip = new PizZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", wordRels);

  return zip.generate({ type: "nodebuffer" });
}
