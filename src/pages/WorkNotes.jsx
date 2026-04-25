import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

export default function WorkNotes() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";

  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [workNotes, setWorkNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [applicationId, setApplicationId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateFile, setTemplateFile] = useState(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item._id) === String(templateId)) || null,
    [templates, templateId]
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      const [appsRes, templatesRes, notesRes] = await Promise.all([
        axios.get(`${API_URL}/api/applications`),
        axios.get(`${API_URL}/api/work-notes/templates`),
        axios.get(`${API_URL}/api/work-notes`),
      ]);
      setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setWorkNotes(Array.isArray(notesRes.data) ? notesRes.data : []);
    } catch (error) {
      console.error(error);
      alert("Не удалось загрузить рабочие записи");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const uploadTemplate = async () => {
    if (!templateFile) return alert("Выберите шаблон");
    try {
      const fd = new FormData();
      fd.append("name", templateName || templateFile.name);
      fd.append("category", templateCategory);
      fd.append("templateFile", templateFile);
      await axios.post(`${API_URL}/api/work-notes/templates/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTemplateName("");
      setTemplateCategory("");
      setTemplateFile(null);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Ошибка загрузки шаблона");
    }
  };

  const updateTemplate = async (id, name, category) => {
    try {
      await axios.patch(`${API_URL}/api/work-notes/templates/${id}`, { name, category });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Ошибка изменения шаблона");
    }
  };

  const createWorkNote = async () => {
    if (!applicationId) return alert("Выберите заявку");
    try {
      const res = await axios.post(`${API_URL}/api/work-notes/create`, {
        applicationId,
        templateId,
        actorName: user?.login || user?.name || "unknown",
      });
      const fileUrl = res.data?.fileUrl ? `${API_URL}${res.data.fileUrl}` : "";
      if (fileUrl) window.open(fileUrl, "_blank");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Ошибка формирования рабочей записи");
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: "10px 18px 24px" }}>
      <h2 style={{ marginTop: 0 }}>Рабочая запись</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Сформировать рабочую запись</h3>
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
              <option value="">Шаблон по умолчанию (М1,M1G)</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name || t.originalName} {t.category ? `(${t.category})` : ""}
                </option>
              ))}
            </select>

            {selectedTemplate ? (
              <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                Шаблон: {selectedTemplate.name || selectedTemplate.originalName} | Категория: {selectedTemplate.category || "-"}
              </div>
            ) : null}

            <button onClick={createWorkNote}>Сформировать документ</button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Шаблоны рабочей записи</h3>
          {isAdmin ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Название шаблона"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <input
                placeholder="Категория (M1/N1...)"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
              />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
              />
              <button onClick={uploadTemplate}>Добавить шаблон</button>
            </div>
          ) : null}

          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #eef2f7", borderRadius: 8 }}>
            {templates.map((t) => (
              <TemplateRow key={t._id} template={t} canEdit={isAdmin} onSave={updateTemplate} />
            ))}
            {templates.length === 0 ? <div style={{ padding: 10, color: "#64748b" }}>Шаблонов пока нет</div> : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Список сформированных рабочих записей</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {workNotes.map((item) => (
            <div
              key={item._id}
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
                {item.fio || "-"} | {item.vin || "-"} | {item.templateName || "-"} {item.category ? `(${item.category})` : ""}
              </div>
              <a href={`${API_URL}${item.fileUrl}`} target="_blank" rel="noreferrer">
                PDF
              </a>
            </div>
          ))}
          {workNotes.length === 0 ? <div style={{ color: "#64748b" }}>Записей пока нет</div> : null}
        </div>
      </div>
    </div>
  );
}

function TemplateRow({ template, canEdit, onSave }) {
  const [name, setName] = useState(template.name || "");
  const [category, setCategory] = useState(template.category || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      await onSave(template._id, name, category);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "8px 10px", borderBottom: "1px solid #eef2f7", display: "grid", gap: 6 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
      <input value={category} onChange={(e) => setCategory(e.target.value)} disabled={!canEdit} />
      {canEdit ? (
        <button onClick={save} disabled={saving}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      ) : null}
    </div>
  );
}