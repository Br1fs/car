import RobotoRegular from "./Roboto-Regular.ttf";
import RobotoBold from "./Roboto-Bold.ttf";

export const loadRoboto = async (doc) => {
  const loadFont = async (url) => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();

    let binary = "";
    const bytes = new Uint8Array(buffer);
    bytes.forEach(b => binary += String.fromCharCode(b));

    return btoa(binary);
  };

  const regular = await loadFont(RobotoRegular);
  const bold = await loadFont(RobotoBold);

  doc.addFileToVFS("Roboto-Regular.ttf", regular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  doc.addFileToVFS("Roboto-Bold.ttf", bold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
};
