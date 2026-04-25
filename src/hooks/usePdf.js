import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadRoboto } from "../fonts/roboto";

export function usePdf(form, cars) {

  const generate = async () => {
    const doc = new jsPDF();

    await loadRoboto(doc);
    doc.setFont("Roboto");

    doc.text("ЗАЯВКА", 105, 15, { align: "center" });

    autoTable(doc, {
      startY: 25,
      body: Object.entries(form),
    });

    doc.save("application.pdf");
  };

  return { generate };
}