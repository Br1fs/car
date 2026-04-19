import timesFontUrl from "./times.ttf?url";

async function fetchFontAsBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export default async function loadTimes(doc) {
  const base64 = await fetchFontAsBase64(timesFontUrl);

  // один и тот же файл используем для normal и bold
  doc.addFileToVFS("Times.ttf", base64);

  doc.addFont("Times.ttf", "Times", "normal");
  doc.addFont("Times.ttf", "Times", "bold");
}