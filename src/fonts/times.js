import timesNormal from "./times.ttf";

export async function loadTimes(doc) {
  doc.addFileToVFS("times.ttf", timesNormal);
  doc.addFont("times.ttf", "Times", "normal");

  doc.addFileToVFS("timesbd.ttf", timesNormal);
  doc.addFont("timesbd.ttf", "Times", "bold");
}