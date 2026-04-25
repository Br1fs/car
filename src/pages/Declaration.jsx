import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

export default function Declaration() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";

  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [applicationId, setApplicationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [iccid, setIccid] = useState("");
  const [imei, setImei] = useState("");
  const [extraEquipment, setExtraEquipment] = useState("");
  const [customerType, setCustomerType] = useState("Частное лицо");
  const [customerDocNumber, setCustomerDocNumber] = useState("");
  const [customerDocDate, setCustomerDocDate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerIin, setCustomerIin] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState(null);

  const selectedApp = useMemo(
    () => applications.find((item) => item._id === applicationId) || null,
    [applications, applicationId]
  );

  useEffect(() => {
    if (!selectedApp) return;
    setCustomerAddress((prev) => prev || selectedApp.address || "");
    setCustomerPhone((prev) => prev || selectedApp.phone || "");
    setCustomerIin((prev) => prev || selectedApp.iin || "");
  }, [selectedApp]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [appsRes, templatesRes, docsRes] = await Promise.all([
        axios.get(`${API_URL}/api/applications`),
        axios.get(`${API_URL}/api/declarations/templates`),
        axios.get(`${API_URL}/api/declarations`),
      ]);
      setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
    } catch (error) {
      console.error(error);
      alert("Не удалось загрузить страницу АКТ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const uploadTemplate = async () => {
    if (!templateFile) return alert("Выберите файл шаблона");
    try {
      const fd = new FormData();
      fd.append("name", templateName || templateFile.name);
      fd.append("templateFile", templateFile);
      await axios.post(`${API_URL}/api/declarations/templates/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTemplateName("");
      setTemplateFile(null);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Ошибка загрузки шаблона");
    }
  };

  const createAct = async () => {
    if (!applicationId) return alert("Выберите заявку");
    if (!iccid.trim()) return alert("Введите ICCID");
    if (!imei.trim()) return alert("Введите IMEI");
    try {
      const res = await axios.post(`${API_URL}/api/declarations/create`, {
        applicationId,
        templateId,
        iccid: iccid.trim(),
        imei: imei.trim(),
        extraEquipment: extraEquipment.trim(),
        customerType: customerType.trim(),
        customerDocNumber: customerDocNumber.trim(),
        customerDocDate: customerDocDate.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim(),
        customerIin: customerIin.trim(),
        actorName: user?.login || user?.name || "unknown",
      });
      const fileUrl = res.data?.fileUrl ? `${API_URL}${res.data.fileUrl}` : "";
      if (fileUrl) window.open(fileUrl, "_blank");
      await loadAll();
      alert("АКТ создан и автоматически прикреплен в документ АКТ заявки");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Ошибка создания АКТ");
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: "10px 18px 24px" }}>
      <h2 style={{ marginTop: 0 }}>Кнопка (АКТ)</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Сформировать АКТ</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Выберите заявку</option>
              {applications.map((app) => (
                <option key={app._id} value={app._id}>
                  {(app.fio || "Без ФИО")} | {app.brand || "-"} {app.model || "-"} | {app.vin || "-"}
                </option>
              ))}
            </select>

            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Шаблон (необязательно)</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name || t.originalName}
                </option>
              ))}
            </select>

            <input placeholder="ICCID" value={iccid} onChange={(e) => setIccid(e.target.value)} />
            <input placeholder="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} />
            <input placeholder="Тип клиента" value={customerType} onChange={(e) => setCustomerType(e.target.value)} />
            <input placeholder="ИИН клиента" value={customerIin} onChange={(e) => setCustomerIin(e.target.value)} />
            <input
              placeholder="Номер документа клиента"
              value={customerDocNumber}
              onChange={(e) => setCustomerDocNumber(e.target.value)}
            />
            <input
              placeholder="Дата документа (например 27.02.2024)"
              value={customerDocDate}
              onChange={(e) => setCustomerDocDate(e.target.value)}
            />
            <input placeholder="Адрес клиента" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            <input placeholder="Телефон клиента" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <input
              placeholder="Дополнительное оборудование (текст из АКТ)"
              value={extraEquipment}
              onChange={(e) => setExtraEquipment(e.target.value)}
            />

            {selectedApp ? (
              <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                ФИО: {selectedApp.fio || "-"} | Марка: {selectedApp.brand || "-"} | Модель: {selectedApp.model || "-"} |
                VIN: {selectedApp.vin || "-"} | Цвет: {selectedApp.color || "-"}
              </div>
            ) : null}

            <button onClick={createAct}>Сформировать PDF</button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Шаблоны АКТ</h3>
          {isAdmin ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Название шаблона"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
              />
              <button onClick={uploadTemplate}>Загрузить шаблон</button>
            </div>
          ) : null}

          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #eef2f7", borderRadius: 8 }}>
            {templates.map((t) => (
              <div key={t._id} style={{ padding: "8px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                {t.name || t.originalName}
              </div>
            ))}
            {templates.length === 0 ? <div style={{ padding: 10, color: "#64748b" }}>Шаблонов пока нет</div> : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Список сформированных АКТ</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {documents.map((doc) => (
            <div
              key={doc._id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
                border: "1px solid #eef2f7",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <div style={{ fontSize: 14 }}>
                № {doc.actNumber || "-"} | {doc.fio || "-"} | {doc.brand || "-"} {doc.model || "-"} | {doc.vin || "-"} | ICCID:{" "}
                {doc.iccid || "-"} | IMEI: {doc.imei || "-"} | Серийный: {doc.serialNumber || "-"}
              </div>
              <a href={`${API_URL}${doc.fileUrl}`} target="_blank" rel="noreferrer">
                PDF
              </a>
            </div>
          ))}
          {documents.length === 0 ? <div style={{ color: "#64748b" }}>Сформированных актов пока нет</div> : null}
        </div>
      </div>
    </div>
  );
}