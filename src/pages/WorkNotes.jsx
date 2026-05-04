import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

export default function WorkNotes() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [workNotes, setWorkNotes] = useState([]);
  const [templateFields, setTemplateFields] = useState([]);
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
      const [appsRes, templatesRes, notesRes, fieldsRes] = await Promise.all([
        axios.get(`${API_URL}/api/applications`),
        axios.get(`${API_URL}/api/work-notes/templates`),
        axios.get(`${API_URL}/api/work-notes`),
        axios.get(`${API_URL}/api/work-notes/templates/fields`).catch(() => ({ data: { fields: [] } })),
      ]);
      setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setWorkNotes(Array.isArray(notesRes.data) ? notesRes.data : []);
      setTemplateFields(Array.isArray(fieldsRes.data?.fields) ? fieldsRes.data.fields : []);
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

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkTheme(root.getAttribute("data-theme") === "dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
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

  const saveTemplateMeta = async (id, name, category) => {
    try {
      await axios.patch(`${API_URL}/api/work-notes/templates/${id}`, { name, category });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Ошибка сохранения шаблона");
    }
  };

  const replaceTemplateFile = async (id, name, category, file) => {
    if (!file) return alert("Выберите файл PDF или DOCX");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("category", category);
      fd.append("templateFile", file);
      await axios.patch(`${API_URL}/api/work-notes/templates/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadAll();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Ошибка замены файла шаблона");
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Удалить этот шаблон с сервера? Файл будет удалён, запись в списке — тоже.")) return;
    try {
      await axios.delete(`${API_URL}/api/work-notes/templates/${id}`);
      if (String(templateId) === String(id)) setTemplateId("");
      await loadAll();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Ошибка удаления шаблона");
    }
  };

  const downloadTemplateFile = async (template) => {
    try {
      const res = await axios.get(`${API_URL}/api/work-notes/templates/${template._id}/file`, {
        responseType: "blob",
      });
      const name = template.originalName || template.name || "template";
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Не удалось скачать файл шаблона");
    }
  };

  const downloadSampleDocx = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/work-notes/templates/sample-docx`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "work-note-placeholders.docx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Не удалось скачать пример шаблона");
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
    return <div style={{ padding: 20, color: isDarkTheme ? "#f8fafc" : "#0f172a" }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: "10px 18px 24px", color: isDarkTheme ? "#f8fafc" : "#0f172a" }}>
      <h2 style={{ marginTop: 0, color: isDarkTheme ? "#f8fafc" : "#0f172a" }}>Рабочая запись</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div
          style={{
            background: isDarkTheme ? "#0b3a58" : "#fff",
            border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#dbe3ee"}`,
            borderRadius: 10,
            padding: 14,
          }}
        >
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
              <div
                style={{
                  fontSize: 13,
                  color: isDarkTheme ? "#cbd5e1" : "#475569",
                  background: isDarkTheme ? "#0d4466" : "#f8fafc",
                  border: `1px solid ${isDarkTheme ? "#2d5d7a" : "transparent"}`,
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                Шаблон: {selectedTemplate.name || selectedTemplate.originalName} | Категория: {selectedTemplate.category || "-"}
              </div>
            ) : null}

            <button onClick={createWorkNote}>Сформировать документ</button>
          </div>
        </div>

        <div
          style={{
            background: isDarkTheme ? "#0b3a58" : "#fff",
            border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#dbe3ee"}`,
            borderRadius: 10,
            padding: 14,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Шаблоны рабочей записи</h3>
          <p style={{ fontSize: 13, color: isDarkTheme ? "#cbd5e1" : "#475569", marginTop: 0 }}>
            Список всех загруженных шаблонов. Скачать файл может любой пользователь с доступом к странице.
            {isAdmin ? " Администратор может добавлять, переименовывать, менять файл и удалять." : ""}
          </p>
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
                accept=".pdf,.docx"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
              />
              <button type="button" onClick={uploadTemplate}>
                Добавить шаблон
              </button>
              <div style={{ fontSize: 12, color: isDarkTheme ? "#cbd5e1" : "#475569" }}>
                DOCX: плейсхолдеры в фигурных скобках, как в примере ниже. PDF: координаты как в шаблоне по умолчанию.
              </div>
            </div>
          ) : null}

          <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#eef2f7"}` }}>
            <table
              style={{
                width: "100%",
                minWidth: 520,
                borderCollapse: "collapse",
                fontSize: 13,
                color: isDarkTheme ? "#e2e8f0" : "#1e293b",
              }}
            >
              <thead>
                <tr style={{ background: isDarkTheme ? "#0d4466" : "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                    Название
                  </th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                    Категория
                  </th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                    Формат
                  </th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                    Файл
                  </th>
                  {isAdmin ? (
                    <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                      Изменить
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <TemplateRow
                    key={t._id}
                    template={t}
                    canEdit={isAdmin}
                    isDarkTheme={isDarkTheme}
                    onSaveMeta={saveTemplateMeta}
                    onReplaceFile={replaceTemplateFile}
                    onDelete={deleteTemplate}
                    onDownload={downloadTemplateFile}
                  />
                ))}
              </tbody>
            </table>
            {templates.length === 0 ? (
              <div style={{ padding: 12, color: isDarkTheme ? "#cbd5e1" : "#64748b" }}>Пользовательских шаблонов пока нет — используется встроенный М1,M1G.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          background: isDarkTheme ? "#0b3a58" : "#fff",
          border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#dbe3ee"}`,
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Поля для DOCX-шаблона (docxtemplater)</h3>
          <button type="button" onClick={downloadSampleDocx}>
            Скачать пример шаблона DOCX
          </button>
        </div>
        <p style={{ fontSize: 13, color: isDarkTheme ? "#cbd5e1" : "#475569", marginTop: 8, marginBottom: 10 }}>
          В примере — таблица «как в PDF-бланке» (наименование | плейсхолдер) и отдельная справочная таблица всех полей.
        </p>
        <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#eef2f7"}` }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              color: isDarkTheme ? "#e2e8f0" : "#1e293b",
            }}
          >
            <thead>
              <tr style={{ background: isDarkTheme ? "#0d4466" : "#f1f5f9", textAlign: "left" }}>
                <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                  Плейсхолдер
                </th>
                <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                  Описание
                </th>
                <th style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#2d5d7a" : "#e2e8f0"}` }}>
                  Пример
                </th>
              </tr>
            </thead>
            <tbody>
              {templateFields.map((row) => (
                <tr key={row.key}>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `1px solid ${isDarkTheme ? "#1e4a66" : "#f1f5f9"}`,
                      fontFamily: "ui-monospace, monospace",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {`{${row.key}}`}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#1e4a66" : "#f1f5f9"}` }}>
                    {row.label}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${isDarkTheme ? "#1e4a66" : "#f1f5f9"}` }}>
                    {row.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {templateFields.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 13, color: isDarkTheme ? "#94a3b8" : "#64748b" }}>
            Список полей не загрузился. Обновите страницу после перезапуска сервера.
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 16,
          background: isDarkTheme ? "#0b3a58" : "#fff",
          border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#dbe3ee"}`,
          borderRadius: 10,
          padding: 14,
        }}
      >
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
                border: `1px solid ${isDarkTheme ? "#2d5d7a" : "#eef2f7"}`,
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <div style={{ fontSize: 14 }}>
                {item.fio || "-"} | {item.vin || "-"} | {item.templateName || "-"} {item.category ? `(${item.category})` : ""}
              </div>
              <a href={`${API_URL}${item.fileUrl}`} target="_blank" rel="noreferrer">
                {String(item.fileName || item.fileUrl || "").toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"}
              </a>
            </div>
          ))}
          {workNotes.length === 0 ? <div style={{ color: isDarkTheme ? "#cbd5e1" : "#64748b" }}>Записей пока нет</div> : null}
        </div>
      </div>
    </div>
  );
}

function templateFormatLabel(t) {
  const ext = String(t.originalName || t.fileName || "").toLowerCase();
  if (ext.endsWith(".docx")) return "DOCX";
  if (ext.endsWith(".pdf")) return "PDF";
  const mime = String(t.mimeType || "").toLowerCase();
  if (mime.includes("word")) return "DOCX";
  if (mime.includes("pdf")) return "PDF";
  return "—";
}

function TemplateRow({ template, canEdit, isDarkTheme, onSaveMeta, onReplaceFile, onDelete, onDownload }) {
  const [name, setName] = useState(template.name || "");
  const [category, setCategory] = useState(template.category || "");
  const [newFile, setNewFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(template.name || "");
    setCategory(template.category || "");
    setNewFile(null);
  }, [template._id, template.name, template.category]);

  const border = `1px solid ${isDarkTheme ? "#1e4a66" : "#f1f5f9"}`;
  const cell = { padding: "8px 10px", borderBottom: border, verticalAlign: "top" };

  const saveMeta = async () => {
    if (!canEdit) return;
    try {
      setBusy(true);
      await onSaveMeta(template._id, name, category);
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!canEdit) return;
    try {
      setBusy(true);
      await onReplaceFile(template._id, name, category, newFile);
      setNewFile(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!canEdit) return;
    try {
      setBusy(true);
      await onDelete(template._id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td style={cell}>
        {canEdit ? (
          <input style={{ width: "100%", minWidth: 120 }} value={name} onChange={(e) => setName(e.target.value)} />
        ) : (
          template.name || template.originalName || "—"
        )}
      </td>
      <td style={cell}>
        {canEdit ? (
          <input style={{ width: "100%", minWidth: 72 }} value={category} onChange={(e) => setCategory(e.target.value)} />
        ) : (
          template.category || "—"
        )}
      </td>
      <td style={cell}>{templateFormatLabel(template)}</td>
      <td style={cell}>
        <button type="button" onClick={() => onDownload(template)} disabled={busy}>
          Скачать
        </button>
        <div style={{ fontSize: 11, color: isDarkTheme ? "#94a3b8" : "#64748b", marginTop: 4 }}>
          {template.originalName || template.fileName || ""}
        </div>
      </td>
      {canEdit ? (
        <td style={cell}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
            <button type="button" onClick={saveMeta} disabled={busy}>
              {busy ? "…" : "Сохранить название"}
            </button>
            <input type="file" accept=".pdf,.docx" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={replace} disabled={busy || !newFile}>
              Заменить файл
            </button>
            <button type="button" onClick={remove} disabled={busy} style={{ color: "#b91c1c" }}>
              Удалить шаблон
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}