import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/CMK.css";

const STORAGE_KEY = "cmk-documents-v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createEmptyDocument() {
  return {
    id: uid(),
    title: "Шаблон СМК",
    content: `
      <div class="cmk-doc-shell">
        <table class="cmk-doc-table">
          <tbody>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          </tbody>
        </table>
        <hr />
        <table class="cmk-doc-table">
          <tbody>
            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
          </tbody>
        </table>
      </div>
    `,
    updatedAt: new Date().toISOString(),
  };
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU");
}

export default function CMK() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [statusText, setStatusText] = useState("");
  const editorRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocuments(parsed);
          setSelectedId(parsed[0].id);
          return;
        }
      }
    } catch {
      // ignore malformed data
    }

    const initial = createEmptyDocument();
    setDocuments([initial]);
    setSelectedId(initial.id);
  }, []);

  useEffect(() => {
    if (!documents.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    setStatusText(`Сохранено: ${new Date().toLocaleTimeString("ru-RU")}`);
  }, [documents]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedId) || null,
    [documents, selectedId]
  );

  useEffect(() => {
    if (!editorRef.current || !selectedDoc) return;
    if (editorRef.current.innerHTML !== selectedDoc.content) {
      editorRef.current.innerHTML = selectedDoc.content || "";
    }
  }, [selectedDoc]);

  const updateSelectedDoc = (patch) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedId
          ? {
              ...doc,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : doc
      )
    );
  };

  const handleCreateDocument = () => {
    const doc = createEmptyDocument();
    setDocuments((prev) => [doc, ...prev]);
    setSelectedId(doc.id);
  };

  const handleDeleteDocument = () => {
    if (!selectedDoc) return;
    if (!window.confirm(`Удалить документ "${selectedDoc.title}"?`)) return;

    setDocuments((prev) => {
      const next = prev.filter((doc) => doc.id !== selectedId);
      if (next.length === 0) {
        const fallback = createEmptyDocument();
        setSelectedId(fallback.id);
        return [fallback];
      }
      setSelectedId(next[0].id);
      return next;
    });
  };

  const handleClearBody = () => {
    if (!window.confirm("Очистить содержимое текущего документа?")) return;
    updateSelectedDoc({ content: "" });
  };

  const focusEditor = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const insertHtml = (html) => {
    focusEditor();
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) {
      updateSelectedDoc({ content: editorRef.current.innerHTML });
    }
  };

  const addTable = () => {
    const rowsRaw = window.prompt("Сколько строк добавить?", "3");
    const colsRaw = window.prompt("Сколько столбцов добавить?", "3");
    const rows = Math.max(1, Number.parseInt(rowsRaw || "0", 10) || 0);
    const cols = Math.max(1, Number.parseInt(colsRaw || "0", 10) || 0);
    if (!rows || !cols) return;

    const body = Array.from({ length: rows })
      .map(
        () =>
          `<tr>${Array.from({ length: cols })
            .map(() => "<td>&nbsp;</td>")
            .join("")}</tr>`
      )
      .join("");

    insertHtml(`<table class="cmk-doc-table"><tbody>${body}</tbody></table><p><br/></p>`);
  };

  const addRowToLastTable = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll("table");
    const lastTable = tables[tables.length - 1];
    if (!lastTable) {
      alert("Сначала добавьте таблицу.");
      return;
    }
    const firstRow = lastTable.querySelector("tr");
    const cellCount = Math.max(1, firstRow?.children.length || 1);
    const row = document.createElement("tr");
    for (let i = 0; i < cellCount; i += 1) {
      const td = document.createElement("td");
      td.innerHTML = "&nbsp;";
      row.appendChild(td);
    }
    lastTable.querySelector("tbody")?.appendChild(row);
    updateSelectedDoc({ content: editorRef.current.innerHTML });
  };

  return (
    <div className="cmk-page">
      <aside className="cmk-sidebar">
        <div className="cmk-sidebar-head">
          <h2>CMK</h2>
          <button type="button" onClick={handleCreateDocument}>
            + Новый
          </button>
        </div>

        <div className="cmk-doc-list">
          {documents.map((doc) => (
            <button
              type="button"
              key={doc.id}
              className={`cmk-doc-item ${doc.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(doc.id)}
            >
              <span className="cmk-doc-title">{doc.title || "Без названия"}</span>
              <span className="cmk-doc-date">{formatDate(doc.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="cmk-editor-wrap">
        <div className="cmk-toolbar">
          <input
            type="text"
            value={selectedDoc?.title || ""}
            onChange={(e) => updateSelectedDoc({ title: e.target.value })}
            placeholder="Название документа"
          />
          <div className="cmk-toolbar-actions">
            <button type="button" onClick={addTable}>
              Таблица
            </button>
            <button type="button" onClick={addRowToLastTable}>
              + Строка
            </button>
            <button type="button" onClick={() => insertHtml("<hr />")}>
              Линия
            </button>
            <button type="button" onClick={() => insertHtml("<p><br/></p>")}>
              Пустая строка
            </button>
            <button type="button" onClick={() => window.print()}>
              Печать
            </button>
            <button type="button" onClick={handleClearBody}>
              Очистить
            </button>
            <button type="button" className="danger" onClick={handleDeleteDocument}>
              Удалить
            </button>
          </div>
        </div>

        <div className="cmk-status">{statusText || "Изменения сохраняются автоматически"}</div>

        <div
          ref={editorRef}
          className="cmk-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => updateSelectedDoc({ content: e.currentTarget.innerHTML })}
        />
      </section>
    </div>
  );
}
