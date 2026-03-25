export default async function loadRoboto(doc) {
  const load = async (url) => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();

    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    return btoa(binary); // base64
  };

  const regular = await load("/fonts/Roboto-Regular.ttf");
  const bold = await load("/fonts/Roboto-Bold.ttf");

  doc.addFileToVFS("Roboto-Regular.ttf", regular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  doc.addFileToVFS("Roboto-Bold.ttf", bold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}