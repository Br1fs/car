import { useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";
import "./WorkNotes.jsx";

export default function Declaration() {
  const [fullName, setFullName] = useState("");
  const [carId, setCarId] = useState("");
  const [iccid, setIccid] = useState("");
  const [imei, setImei] = useState("");
  const [templateName, setTemplateName] = useState("declaration-template.pdf");
  const [loading, setLoading] = useState(false);

  const previewText = useMemo(
    () =>
      [
        `ФИО: ${fullName || "-"}`,
        `Автомобиль: ${carId || "-"}`,
        `ICCID: ${iccid || "-"}`,
        `IMEI: ${imei || "-"}`,
        `Шаблон: ${templateName || "-"}`,
      ].join("\n"),
    [fullName, carId, iccid, imei, templateName]
  );

  const handleGenerate = async () => {
    try {
      setLoading(true);

      // Placeholder route call for declaration generation payload.
      // Endpoint can be replaced with dedicated declaration API later.
      await axios.post(`${API_URL}/api/decisions/create`, {
        decisionNumber: `DECL-${Date.now()}`,
        decisionDate: new Date().toISOString().slice(0, 10),
        brand: "",
        model: "",
        vin: "",
        year: "",
        typ: "",
        category: "",
        declarationMeta: { fullName, carId, iccid, imei, templateName },
      });

      alert("Черновик декларации сформирован");
    } catch (error) {
      console.error(error);
      alert("Не удалось сформировать декларацию");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="work-notes-page">
      <div className="work-notes-card">
        <div className="work-notes-header">
          <h2>Декларация</h2>
          <button className="work-notes-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Формируем..." : "Сформировать декларацию"}
          </button>
        </div>

        <div className="work-notes-toolbar">
          <input
            className="work-notes-input"
            placeholder="ФИО"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="work-notes-input"
            placeholder="ID заявки / авто"
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
          />
          <input
            className="work-notes-input"
            placeholder="ICCID"
            value={iccid}
            onChange={(e) => setIccid(e.target.value)}
          />
          <input
            className="work-notes-input"
            placeholder="IMEI"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
          />
          <input
            className="work-notes-input"
            placeholder="Шаблон (pdf/docx)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </div>

        <pre className="work-notes-preview">{previewText}</pre>
      </div>
    </div>
  );
}