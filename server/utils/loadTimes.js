// server/utils/loadTimes.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function loadTimes(doc) {
  // путь к шрифтам
  const regularPath = path.join(__dirname, "..", "fonts", "times.ttf");
  const boldPath = path.join(__dirname, "..", "fonts", "times.ttf"); 
  // если есть отдельный bold — поменяешь

  const regularBase64 = fs.readFileSync(regularPath).toString("base64");
  const boldBase64 = fs.readFileSync(boldPath).toString("base64");

  doc.addFileToVFS("times.ttf", regularBase64);
  doc.addFont("times.ttf", "Times", "normal");

  doc.addFileToVFS("times-bold.ttf", boldBase64);
  doc.addFont("times-bold.ttf", "Times", "bold");
}