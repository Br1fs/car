import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import "../styles/ProtocolTemplates.css";

export default function ProtocolTemplates() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    category: "",
    fuelType: "",
    pdfTemplate: "",
  });
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_URL}/api/protocol-templates`)
      .then((res) => setList(res.data))
      .catch((err) => console.error(err));
  }, []);

  const createTemplate = async () => {
    try {
      if (!form.category || !form.pdfTemplate) {
        alert("Заполните категорию и файл шаблона");
        return;
      }
      const res = await axios.post(`${API_URL}/api/protocol-templates`, form);
      const created = await axios.get(`${API_URL}/api/protocol-templates/${res.data._id}`);
      setList((prev) => [created.data, ...prev]);
      setForm({ category: "", fuelType: "", pdfTemplate: "" });
    } catch (err) {
      console.error(err);
      alert("Ошибка создания шаблона");
    }
  };

  const uploadTemplateFile = async (file) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("templateFile", file);
      const res = await axios.post(`${API_URL}/api/protocol-templates/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({ ...prev, pdfTemplate: res.data.filePath || "" }));
    } catch (err) {
      console.error(err);
      alert("Ошибка загрузки файла шаблона");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Удалить шаблон?")) return;

    try {
      await axios.delete(`${API_URL}/api/protocol-templates/${id}`);
      setList((prev) => prev.filter((x) => x._id !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка удаления шаблона");
    }
  };

  return (
    <div className="protocol-templates-page">
      <h2>Шаблоны протоколов</h2>

      <div className="protocol-templates-form">
        <select
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
        >
          <option value="">Категория</option>
          {["M1", "M2", "M3", "N1", "N2", "N3", "O1", "O2", "O3", "O4"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={form.fuelType}
          onChange={(e) => setForm((prev) => ({ ...prev, fuelType: e.target.value }))}
        >
          <option value="">Топливо (если нужно)</option>
          <option value="Бензин">Бензин</option>
          <option value="Дизель">Дизель</option>
          <option value="Электрический">Электрический</option>
        </select>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadTemplateFile(file);
          }}
        />
        <input
          value={form.pdfTemplate}
          onChange={(e) => setForm((prev) => ({ ...prev, pdfTemplate: e.target.value }))}
          placeholder="Имя загруженного файла"
        />
        <button className="protocol-templates-primary" onClick={createTemplate} disabled={uploading}>
          {uploading ? "Загрузка..." : "+ Добавить шаблон"}
        </button>
      </div>

      <button className="protocol-templates-secondary" onClick={() => navigate("/protocol-templates/create")}>
        Открыть расширенную форму шаблона
      </button>

      <div className="protocol-templates-list">
        {list.length === 0 ? (
          <div>Шаблоны пока не добавлены</div>
        ) : (
          list.map((t) => (
            <div key={t._id} className="protocol-template-card">
              <div>
                <b>Категория:</b> {t.category || "-"}
              </div>

              <div>
                <b>Топливо:</b> {t.fuelType || "Электро"}
              </div>

              <div>
                <b>PDF файл:</b> {t.pdfTemplate || "-"}
              </div>

              <div>
                <b>Номер:</b> {t.protocolNumber || "-"}
              </div>

              <div className="protocol-template-actions">
                <button
                  onClick={() => navigate(`/protocol-templates/${t._id}/edit`)}
                >
                  Редактировать
                </button>

                <button onClick={() => remove(t._id)}>Удалить</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}