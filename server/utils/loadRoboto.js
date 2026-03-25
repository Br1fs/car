// server/utils/loadRoboto.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function loadRoboto(doc) {
  const regularPath = path.join(__dirname, "Roboto-Regular.ttf");
  const boldPath = path.join(__dirname, "Roboto-Bold.ttf");

  const regularBase64 = fs.readFileSync(regularPath).toString("base64");
  const boldBase64 = fs.readFileSync(boldPath).toString("base64");

  doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}