import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const applicationStatusOptions = [
  "", "На одобрении", "Одобрено", "Выполняется", "Ждем прозвона", "Прозвон есть", "Ждем фото", "Фото есть", "Выпущено", "Стоп",
];

const reportStatusItems = [
  { key: "approved", label: "Одобрено" },
  { key: "inProgress", label: "Выполняется" },
  { key: "waitingCall", label: "Ждет прозвона" },
  { key: "waitingPhoto", label: "Ждет фото" },
  { key: "issued", label: "Выпущено" },
];

const defaultSpecialistOptions = ["", "Эрик", "Нуржан", "Ару", "Ерке", "Ислам", "Айнура"];
const defaultBrokerOptions = ["", "Алина", "Диас", "Асель"];

const emptyRow = {
  number: "", fio: "", type: "", brand: "", model: "", color: "",
  vinCode: "", broker: "", applicationStatus: "На рассмотрении", submitDate: "",
  applicationNumber: "", specialist: "", sbktsNumber: "", comment: "",
  sbktsEptsStatus: "", eptsStatus: "",
};

function normalizeDate(value) {
  if (!value || typeof value !== "string") return "";
  if (value.includes("T")) return value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value;
}

function getStatusBadge(status) {
  const v = (status || "").toLowerCase();
  if (v.includes("выпущ") || v.includes("выпуск готов") || v.includes("готов")) {
    return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", label: status };
  }
  if (v.includes("одобр")) {
    return { bg: "#ffffff", color: "#334155", border: "#e2e8f0", label: status };
  }
  if (v.includes("стоп") || v.includes("отказ")) {
    return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", label: status };
  }
  if (v.includes("выполняется")) {
    return { bg: "#fef9c3", color: "#854d0e", border: "#fef08a", label: status };
  }
  if (v.includes("прозвон")) {
    return { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe", label: status };
  }
  if (v.includes("ждем фото")) {
    return { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8", label: status };
  }
  if (v.includes("рассмотр") || v.includes("одобрении")) {
    return { bg: "#ffffff", color: "#334155", border: "#e2e8f0", label: status };
  }
  return { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb", label: status };
}

function getRowBg(status) {
  const v = (status || "").toLowerCase();
  if (v.includes("выпущ") || v.includes("выпуск готов") || v.includes("готов")) return "#f0fdf4";
  if (v.includes("одобр")) return "#ffffff";
  if (v.includes("стоп") || v.includes("отказ")) return "#fff1f2";
  if (v.includes("выполня")) return "#fefce8";
  if (v.includes("ждем фото")) return "#fdf2f8";
  if (v.includes("прозвон")) return "#f5f3ff";
  if (v.includes("рассмотр") || v.includes("одобрении")) return "#ffffff";
  return "#ffffff";
}

function sortRowsByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const dateA = a.submitDate || "";
    const dateB = b.submitDate || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized !== "") return value;
  }
  return "";
}

function buildMergedRows(applications, journalRows) {
  const journalByAppId = new Map(
    journalRows.filter((item) => item.applicationId).map((item) => [item.applicationId, item])
  );
  const appRows = applications.map((app) => {
    const appId = app._id || "";
    const journal = journalByAppId.get(appId);
    return {
      _id: appId, journalId: journal?._id || null, rowType: "application",
      createdAt: journal?.createdAt || app.createdAt || "",
      number: pickFirstNonEmpty(journal?.number, app.protocolNumber, app.number),
      fio: journal?.fio ?? app.fio ?? "",
      type: journal?.type ?? app.type ?? app.typ ?? "",
      brand: journal?.brand ?? app.brand ?? "",
      model: journal?.model ?? app.model ?? "",
      color: journal?.color ?? app.color ?? "",
      vinCode: journal?.vinCode ?? app.vin ?? app.vinCode ?? "",
      broker: journal?.broker ?? app.broker ?? "",
      applicationStatus: app.status1 ?? app.status ?? "",
      submitDate: journal?.submitDate ?? normalizeDate(app.createdAt) ?? "",
      applicationNumber: pickFirstNonEmpty(journal?.applicationNumber),
      specialist: pickFirstNonEmpty(journal?.specialist, app.specialist, app.manager),
      sbktsNumber: journal?.sbktsNumber ?? app.sbktsNumber ?? "",
      comment: journal?.comment ?? "",
      sbktsEptsStatus: journal?.sbktsEptsStatus ?? "",
      eptsStatus: journal?.eptsStatus ?? "",
    };
  });
  const manualRows = journalRows
    .filter((item) => !item.applicationId)
    .map((item) => ({
      _id: `manual-${item._id}`, journalId: item._id, rowType: "manual",
      createdAt: item.createdAt || "", number: item.number || "", fio: item.fio || "",
      type: item.type || "", brand: item.brand || "", model: item.model || "",
      color: item.color || "", vinCode: item.vinCode || "", broker: item.broker || "",
      applicationStatus: item.applicationStatus || "", submitDate: item.submitDate || "",
      applicationNumber: item.applicationNumber || "", specialist: item.specialist || "",
      sbktsNumber: item.sbktsNumber || "", comment: item.comment || "",
      sbktsEptsStatus: item.sbktsEptsStatus || "", eptsStatus: item.eptsStatus || "",
    }));
  return sortRowsByDateDesc([...appRows, ...manualRows]);
}

function addDailyNumeration(rows) {
  const counters = new Map();
  return rows.map((row) => {
    const key = row.submitDate || "no-date";
    const current = counters.get(key) || 0;
    const next = current + 1;
    counters.set(key, next);
    return { ...row, dailyNumeration: next };
  });
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function detectReportStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s.includes("одобр")) return "approved";
  if (s.includes("выполня")) return "inProgress";
  if (s.includes("прозвон")) return "waitingCall";
  if (s.includes("ждем фото") || s.includes("ждёт фото")) return "waitingPhoto";
  if (s.includes("выпуск готов") || s.includes("выпущ")) return "issued";
  return "other";
}

function loadSavedOptions(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    const normalized = parsed.map((item) => String(item || "").trim())
      .filter((item, index, arr) => arr.indexOf(item) === index);
    if (!normalized.includes("")) normalized.unshift("");
    return normalized;
  } catch { return fallback; }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "56px 16px 32px",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid #f1f5f9",
  },
  title: { margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "2px 0 0", fontSize: "13px", color: "#94a3b8" },
  toolbar: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "14px 24px", borderBottom: "1px solid #f1f5f9",
    flexWrap: "wrap",
  },
  searchWrap: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: "8px", padding: "0 12px", flex: "1", minWidth: "200px",
  },
  searchInput: {
    border: "none", background: "transparent", outline: "none",
    fontSize: "14px", color: "#1e293b", padding: "9px 0", width: "100%",
  },
  filterBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: "8px", padding: "8px 14px", cursor: "pointer",
    fontSize: "14px", color: "#475569", fontWeight: 500,
    transition: "all 0.15s",
  },
  filterBtnActive: {
    background: "#0f172a", color: "#fff", border: "1px solid #0f172a",
  },
  addBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    background: "#0f172a", color: "#fff",
    border: "none", borderRadius: "8px",
    padding: "9px 16px", cursor: "pointer",
    fontSize: "14px", fontWeight: 600, marginLeft: "auto",
    transition: "background 0.15s",
  },
  saveAllBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    background: "#64748b", color: "#fff",
    border: "none", borderRadius: "8px",
    padding: "9px 14px", cursor: "pointer",
    fontSize: "14px", fontWeight: 500,
  },
  filterPanel: {
    display: "flex", gap: "10px", flexWrap: "wrap",
    padding: "12px 24px", background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  select: {
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: "8px", padding: "7px 10px",
    fontSize: "13px", color: "#374151", cursor: "pointer", outline: "none",
  },
  addRowPanel: {
    padding: "16px 24px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  addRowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "8px",
    marginBottom: "10px",
  },
  addInput: {
    border: "1px solid #e2e8f0", borderRadius: "7px",
    padding: "7px 10px", fontSize: "13px", outline: "none",
    background: "#fff", color: "#1e293b", width: "100%", boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  addSelect: {
    border: "1px solid #e2e8f0", borderRadius: "7px",
    padding: "7px 10px", fontSize: "13px", outline: "none",
    background: "#fff", color: "#1e293b", width: "100%", boxSizing: "border-box",
    cursor: "pointer",
  },
  confirmAddBtn: {
    background: "#0f172a", color: "#fff", border: "none",
    borderRadius: "7px", padding: "8px 20px",
    fontSize: "14px", fontWeight: 600, cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: {
    background: "#f8fafc", color: "#64748b", fontWeight: 600,
    fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "10px 12px", textAlign: "left",
    borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px", borderBottom: "1px solid #f1f5f9",
    color: "#1e293b", verticalAlign: "middle",
  },
  cellInput: {
  border: "1px solid #d1d5db", // было transparent
  borderRadius: "6px",
  padding: "5px 7px",
  fontSize: "13px",
  background: "#ffffff", // было transparent
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  color: "#1e293b",
  transition: "all 0.15s",
},

cellSelect: {
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  padding: "5px 7px",
  fontSize: "13px",
  background: "#ffffff",
  outline: "none",
  cursor: "pointer",
  color: "#1e293b",
  width: "100%",
  transition: "all 0.15s",
},
  deleteBtn: {
    background: "none", border: "1px solid #fecaca",
    color: "#ef4444", borderRadius: "6px",
    width: "28px", height: "28px", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: 700, transition: "all 0.15s",
  },
  pagination: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 24px", borderTop: "1px solid #f1f5f9",
    flexWrap: "wrap", gap: "10px",
  },
  pageInfo: { fontSize: "13px", color: "#64748b" },
  pageControls: { display: "flex", alignItems: "center", gap: "6px" },
  pageBtn: {
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: "7px", padding: "6px 12px",
    fontSize: "13px", cursor: "pointer", color: "#374151",
    fontWeight: 500, transition: "all 0.15s",
  },
  pageBtnActive: {
    background: "#0f172a", color: "#fff", border: "1px solid #0f172a",
  },
  pageBtnDisabled: { opacity: 0.4, cursor: "default" },
  pageSizeSelect: {
    border: "1px solid #e2e8f0", borderRadius: "7px",
    padding: "6px 8px", fontSize: "13px", cursor: "pointer",
    background: "#fff", color: "#374151",
  },
  badge: (status) => {
    const s = getStatusBadge(status);
    return {
      display: "inline-block",
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: "20px", padding: "3px 10px",
      fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
    };
  },
};

// ─── TableRow Component ───────────────────────────────────────────────────────

const TableRow = React.memo(function TableRow({
  row, brokerOptions, specialistOptions,
  savingId, onChange, onBlurSave, onSelectChangeAndSave, onClear,
}) {
  const rowBg = getRowBg(row.applicationStatus);
  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...styles.td, color: "#94a3b8", width: 36, textAlign: "center" }}>{row.dailyNumeration}</td>
      <td style={styles.td}>
        <input value={row.number || ""} onChange={e => onChange(row._id, "number", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput}
          onFocus={e => e.target.style.border = "1px solid #cbd5e1"}
          onBlurCapture={e => e.target.style.border = "1px solid transparent"} />
      </td>
      <td style={{ ...styles.td, minWidth: 140 }}>
        <input value={row.fio || ""} onChange={e => onChange(row._id, "fio", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input value={row.type || ""} onChange={e => onChange(row._id, "type", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input placeholder="Марка" value={row.brand || ""} onChange={e => onChange(row._id, "brand", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={{ ...styles.cellInput, marginBottom: 3 }} />
        <input placeholder="Модель" value={row.model || ""} onChange={e => onChange(row._id, "model", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input value={row.color || ""} onChange={e => onChange(row._id, "color", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={{ ...styles.td, minWidth: 160 }}>
        <input value={row.vinCode || ""} onChange={e => onChange(row._id, "vinCode", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={{ ...styles.cellInput, fontFamily: "monospace", fontSize: 12 }} />
      </td>
      <td style={styles.td}>
        <select value={row.broker || ""} onChange={e => onSelectChangeAndSave(row._id, "broker", e.target.value)} style={styles.cellSelect}>
          {brokerOptions.map(item => <option key={item} value={item}>{item || "—"}</option>)}
        </select>
      </td>
      <td style={styles.td}>
        <select value={row.applicationStatus || ""} onChange={e => onSelectChangeAndSave(row._id, "applicationStatus", e.target.value)} style={styles.cellSelect}>
          {applicationStatusOptions.map(item => <option key={item} value={item}>{item || "—"}</option>)}
        </select>
      </td>
      <td style={styles.td}>
        <input type="date" value={row.submitDate || ""} onChange={e => onChange(row._id, "submitDate", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input value={row.applicationNumber || ""} onChange={e => onChange(row._id, "applicationNumber", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <select value={row.specialist || ""} onChange={e => onSelectChangeAndSave(row._id, "specialist", e.target.value)} style={styles.cellSelect}>
          {specialistOptions.map(item => <option key={item} value={item}>{item || "—"}</option>)}
        </select>
      </td>
      <td style={styles.td}>
        <input value={row.sbktsNumber || ""} onChange={e => onChange(row._id, "sbktsNumber", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={{ ...styles.td, minWidth: 140 }}>
        <input value={row.comment || ""} onChange={e => onChange(row._id, "comment", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input value={row.sbktsEptsStatus || ""} onChange={e => onChange(row._id, "sbktsEptsStatus", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={styles.td}>
        <input value={row.eptsStatus || ""} onChange={e => onChange(row._id, "eptsStatus", e.target.value)}
          onBlur={() => onBlurSave(row._id)} style={styles.cellInput} />
      </td>
      <td style={{ ...styles.td, textAlign: "center" }}>
        <button onClick={() => onClear(row)} style={styles.deleteBtn}
          title={savingId === row._id ? "Сохраняется..." : "Удалить"}>✕</button>
      </td>
    </tr>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExcelTable() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [rows, setRows] = useState([]);
  const [journalRows, setJournalRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [newRow, setNewRow] = useState(emptyRow);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [specialistOptions, setSpecialistOptions] = useState(() =>
    loadSavedOptions("journal_specialist_options", defaultSpecialistOptions)
  );
  const [brokerOptions, setBrokerOptions] = useState(() =>
    loadSavedOptions("journal_broker_options", defaultBrokerOptions)
  );
  const [newSpecialistName, setNewSpecialistName] = useState("");
  const [newBrokerName, setNewBrokerName] = useState("");

  const [colWidths, setColWidths] = useState(() => {
  const saved = localStorage.getItem("table_col_widths");
  return saved ? JSON.parse(saved) : {};
});

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    localStorage.setItem("journal_specialist_options", JSON.stringify(specialistOptions));
  }, [specialistOptions]);
  useEffect(() => {
    localStorage.setItem("journal_broker_options", JSON.stringify(brokerOptions));
  }, [brokerOptions]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [appsRes, journalRes] = await Promise.all([
        axios.get(`${API_URL}/api/applications`),
        axios.get(`${API_URL}/api/table-journal`),
      ]);
      const apps = Array.isArray(appsRes.data) ? appsRes.data : [];
      const journal = Array.isArray(journalRes.data) ? journalRes.data : [];
      const brokersFromApps = Array.from(
        new Set(
          apps
            .map((item) => String(item.broker || "").trim())
            .filter(Boolean)
        )
      );
      if (brokersFromApps.length) {
        setBrokerOptions((prev) => {
          const merged = Array.from(new Set([...prev, ...brokersFromApps]));
          if (!merged.includes("")) merged.unshift("");
          return merged;
        });
      }
      setJournalRows(journal);
      setRows(buildMergedRows(apps, journal));
    } catch (error) {
      console.error("Ошибка загрузки:", error);
      alert("Не удалось загрузить таблицу");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (selectedDate) {
      result = result.filter((row) => row.submitDate === selectedDate);
    }

    if (selectedStatus !== "all") {
      result = result.filter((row) => {
        const s = (row.applicationStatus || "").toLowerCase();
        const selected = selectedStatus.toLowerCase();
        if (selected.includes("ждет фото")) return s.includes("ждем фото") || s.includes("ждет фото");
        if (selected.includes("ждет прозвона")) return s.includes("прозвон");
        if (selected.includes("выпущ")) return s.includes("выпуск готов") || s.includes("выпущ");
        if (selected.includes("одобр")) return s.includes("одобр");
        if (selected.includes("выполня")) return s.includes("выполня");
        if (selected.includes("рассмотр")) return s.includes("рассмотр");
        if (selected.includes("стоп")) return s.includes("стоп");
        return s.includes(selected);
      });
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((row) =>
        [row.number, row.fio, row.type, row.brand, row.model, row.color,
          row.vinCode, row.broker, row.applicationStatus, row.submitDate,
          row.applicationNumber, row.specialist, row.sbktsNumber, row.comment]
          .join(" ").toLowerCase().includes(q)
      );
    }

    return addDailyNumeration(result);
  }, [rows, search, selectedDate, selectedStatus]);

  const reportStats = useMemo(() => {
    const stats = {
      total: filteredRows.length,
      approved: 0,
      inProgress: 0,
      waitingCall: 0,
      waitingPhoto: 0,
      issued: 0,
    };
    filteredRows.forEach((row) => {
      const key = detectReportStatus(row.applicationStatus);
      if (key in stats) stats[key] += 1;
    });
    return stats;
  }, [filteredRows]);

  const startResize = (index, e) => {
  e.preventDefault();

  const startX = e.clientX;
  const startWidth = colWidths[index] || 120;

  const onMouseMove = (eMove) => {
    const newWidth = Math.max(60, startWidth + (eMove.clientX - startX));

    setColWidths(prev => ({
      ...prev,
      [index]: newWidth
    }));
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};
useEffect(() => {
  localStorage.setItem("table_col_widths", JSON.stringify(colWidths));
}, [colWidths]);

  useEffect(() => {
    const today = getTodayString();
    const raw = localStorage.getItem("journal_selected_date");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.savedOn === today && parsed?.date) {
        setSelectedDate(parsed.date);
      } else {
        localStorage.removeItem("journal_selected_date");
      }
    } catch {
      localStorage.removeItem("journal_selected_date");
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      localStorage.removeItem("journal_selected_date");
      return;
    }
    localStorage.setItem(
      "journal_selected_date",
      JSON.stringify({ date: selectedDate, savedOn: getTodayString() })
    );
  }, [selectedDate]);

  // Reset to page 1 on filter/search change
  useEffect(() => { setCurrentPage(1); }, [search, selectedDate, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const saveRow = async (row) => {
    try {
      setSavingId(row._id);
      const payload = {
        applicationId: row.rowType === "application" ? row._id : "",
        number: row.number || "", fio: row.fio || "", type: row.type || "",
        brand: row.brand || "", model: row.model || "", color: row.color || "",
        vinCode: row.vinCode || "", broker: row.broker || "",
        applicationStatus: row.rowType === "manual" ? (row.applicationStatus || "") : "",
        submitDate: row.submitDate || "",
        applicationNumber: row.applicationNumber || "", specialist: row.specialist || "",
        sbktsNumber: row.sbktsNumber || "", comment: row.comment || "",
        sbktsEptsStatus: row.sbktsEptsStatus || "", eptsStatus: row.eptsStatus || "",
      };
      let saved;
      if (row.journalId) {
        const res = await axios.put(`${API_URL}/api/table-journal/${row.journalId}`, payload);
        saved = res.data;
      } else {
        const res = await axios.post(`${API_URL}/api/table-journal`, payload);
        saved = res.data;
      }
      setJournalRows((prev) => {
        const exists = prev.some((item) => item._id === saved._id);
        if (exists) return prev.map((item) => (item._id === saved._id ? saved : item));
        return [saved, ...prev];
      });
      setRows((prev) =>
        sortRowsByDateDesc(prev.map((item) =>
          item._id === row._id ? { ...item, journalId: saved._id } : item
        ))
      );
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      alert(error.response?.data?.error || "Не удалось сохранить запись");
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((row) => (row._id === id ? { ...row, [field]: value } : row)));
  }, []);

  const handleBlurSave = useCallback((id) => {
    setRows((prev) => {
      const row = prev.find((item) => item._id === id);
      if (row) Promise.resolve().then(() => saveRow(row));
      return prev;
    });
  }, []);

  const handleSelectChangeAndSave = useCallback((id, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) => row._id === id ? { ...row, [field]: value } : row);
      const changedRow = updated.find((row) => row._id === id);
      if (changedRow) {
        if (field === "applicationStatus" && changedRow.rowType === "application") {
          setTimeout(async () => {
            try {
              await axios.patch(`${API_URL}/api/applications/${changedRow._id}/status`, {
                status1: value,
                actorName: user?.login || user?.name || "unknown",
                sourcePage: "Журнал",
                specialist: changedRow.specialist || "",
              });
              setRows((inner) =>
                inner.map((item) =>
                  item._id === changedRow._id ? { ...item, applicationStatus: value } : item
                )
              );
            } catch (error) {
              console.error("Ошибка обновления статуса заявки:", error);
              alert("Не удалось обновить статус заявки");
            }
          }, 0);
        } else if (field === "specialist" && changedRow.rowType === "application") {
          setTimeout(async () => {
            try {
              const payload = new FormData();
              payload.append(
                "form",
                JSON.stringify({
                  specialist: value,
                  actorName: user?.login || user?.name || "unknown",
                  sourcePage: "Журнал",
                })
              );
              await axios.put(`${API_URL}/api/applications/${changedRow._id}`, payload, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              setRows((inner) =>
                inner.map((item) =>
                  item._id === changedRow._id ? { ...item, specialist: value } : item
                )
              );
            } catch (error) {
              if (error?.response?.status === 409) {
                try {
                  const latest = await axios.get(`${API_URL}/api/applications/${changedRow._id}`);
                  const latestSpecialist = String(latest?.data?.specialist || value || "").trim();
                  setRows((inner) =>
                    inner.map((item) =>
                      item._id === changedRow._id ? { ...item, specialist: latestSpecialist } : item
                    )
                  );
                  return;
                } catch (refreshError) {
                  console.error("Ошибка синхронизации специалиста после 409:", refreshError);
                }
              }
              console.error("Ошибка обновления специалиста заявки:", error);
              alert("Не удалось обновить специалиста");
            }
          }, 0);
        } else {
          setTimeout(() => saveRow(changedRow), 0);
        }
      }
      return updated;
    });
  }, [user]);

  const addManualRow = async () => {
    try {
      const payload = {
        applicationId: "",
        ...newRow,
        submitDate: newRow.submitDate || getTodayString(),
      };
      const res = await axios.post(`${API_URL}/api/table-journal`, payload);
      const created = {
        _id: `manual-${res.data._id}`, journalId: res.data._id, rowType: "manual",
        createdAt: res.data.createdAt || "", ...res.data,
      };
      setJournalRows((prev) => [res.data, ...prev]);
      setRows((prev) => sortRowsByDateDesc([created, ...prev]));
      setNewRow(emptyRow);
      setShowAddPanel(false);
    } catch (error) {
      console.error("Ошибка добавления:", error);
      alert(error.response?.data?.error || "Не удалось добавить запись");
    }
  };


  const clearJournalFields = useCallback(async (row) => {
    try {
      if (!row.journalId) {
        if (row.rowType === "application") {
          alert("Эта строка связана с заявкой. Удаление доступно в разделе 'Список заявок'.");
          return;
        }
        setRows((prev) => prev.filter((item) => item._id !== row._id));
        return;
      }
      await axios.delete(`${API_URL}/api/table-journal/${row.journalId}`);
      setJournalRows((prev) => prev.filter((item) => item._id !== row.journalId));
      if (row.rowType === "manual") {
        setRows((prev) => prev.filter((item) => item._id !== row._id));
        return;
      }
      setRows((prev) => prev.map((item) =>
        item._id === row._id ? { ...item, journalId: null, sbktsNumber: "", comment: "", sbktsEptsStatus: "", eptsStatus: "" } : item
      ));
    } catch (error) {
      console.error("Ошибка удаления:", error);
      alert(error.response?.data?.error || "Не удалось удалить запись");
    }
  }, []);

  const exportToExcel = () => {
    const dataForExcel = filteredRows.map((row) => ({
      "Нумерация": row.dailyNumeration, "НОМЕР": row.number, "ФИО": row.fio,
      "Тип": row.type, "МАРКА / МОДЕЛЬ": `${row.brand || ""} ${row.model || ""}`.trim(),
      "ЦВЕТ": row.color, "VIN КОД": row.vinCode, "БРОКЕР": row.broker,
      "Статус ЗАЯВКИ": row.applicationStatus, "Дата ПОДАЧИ": row.submitDate,
      "НОМЕР ЗАЯВКИ": row.applicationNumber, "СПЕЦИАЛИСТ": row.specialist,
      "Номер СБКТС": row.sbktsNumber, "Комментарий": row.comment,
      "Статус СБКТС в ЭПТС": row.sbktsEptsStatus, "Статус ЭПТС": row.eptsStatus,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Таблица заявок");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "table_journal.xlsx");
  };

  const columns = [
    "#", "НОМЕР", "ФИО", "ТИП", "МАРКА / МОДЕЛЬ", "ЦВЕТ", "VIN КОД",
    "БРОКЕР", "СТАТУС", "ДАТА ПОДАЧИ", "№ ЗАЯВКИ", "СПЕЦИАЛИСТ",
    "СБКТС №", "КОММЕНТАРИЙ", "СБКТС/ЭПТС", "ЭПТС", "",
  ];

  // Pagination buttons
  const renderPageButtons = () => {
    const pages = [];
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages.map((p, idx) =>
      p === "..." ? (
        <span key={`dots-${idx}`} style={{ padding: "6px 4px", color: "#94a3b8", fontSize: 13 }}>…</span>
      ) : (
        <button key={p} onClick={() => setCurrentPage(p)}
          style={{ ...styles.pageBtn, ...(p === currentPage ? styles.pageBtnActive : {}) }}>
          {p}
        </button>
      )
    );
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center", color: "#94a3b8" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 14 }}>Загрузка...</div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Таблица заявок</h2>
          <p style={styles.subtitle}>Управление и отслеживание заявок на регистрацию ТС</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
            padding: "12px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#eff6ff",
          }}
        >
          <div style={{ ...styles.card, padding: "10px 12px", borderRadius: 10, borderColor: "#bfdbfe" }}>
            <div style={{ color: "#64748b", fontSize: 12 }}>Всего заявок</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{reportStats.total}</div>
          </div>
          {reportStatusItems.map((item) => (
            <div key={item.key} style={{ ...styles.card, padding: "10px 12px", borderRadius: 10, borderColor: "#bfdbfe" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{reportStats[item.key]}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...styles.toolbar, position: "sticky", top: 0, zIndex: 9, background: "#ffffff" }}>
          {/* Search */}
          <div style={styles.searchWrap}>
            <svg width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text" placeholder="Поиск по таблице..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilterPanel(v => !v)}
            style={{ ...styles.filterBtn, ...(showFilterPanel ? styles.filterBtnActive : {}) }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Фильтр
          </button>

          {/* Export */}
          <button onClick={exportToExcel} style={styles.saveAllBtn}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Экспорт
          </button>
          {/* Add row */}
          <button onClick={() => setShowAddPanel(v => !v)} style={styles.addBtn}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {showAddPanel ? "Скрыть форму" : "Добавить заявку вручную"}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div style={styles.filterPanel}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={styles.select}
            />
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={styles.select}>
              <option value="all">Все статусы</option>
              {applicationStatusOptions.filter(Boolean).map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
            <button
              onClick={() => { setSelectedDate(""); setSelectedStatus("all"); }}
              style={{ ...styles.filterBtn, fontSize: 13, padding: "7px 12px" }}
            >
              Сбросить
            </button>
          </div>
        )}

        {/* Add Row Panel */}
        {showAddPanel && (
          <div style={styles.addRowPanel}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#475569" }}>
              Добавить заявку вручную
            </p>
            <div style={styles.addRowGrid}>
              {[
                ["number", "Номер", "text"],
                ["fio", "ФИО", "text"],
                ["brand", "Марка", "text"],
                ["vinCode", "VIN код", "text"],
              ].map(([field, placeholder, type]) => (
                <input key={field} type={type} placeholder={placeholder}
                  value={newRow[field] || ""}
                  onChange={e => setNewRow(prev => ({ ...prev, [field]: e.target.value }))}
                  style={styles.addInput} />
              ))}
              <select value={newRow.broker || ""} onChange={e => setNewRow(prev => ({ ...prev, broker: e.target.value }))} style={styles.addSelect}>
                {brokerOptions.map(item => <option key={item} value={item}>{item || "Брокер"}</option>)}
              </select>
              <select value={newRow.specialist || ""} onChange={e => setNewRow(prev => ({ ...prev, specialist: e.target.value }))} style={styles.addSelect}>
                {specialistOptions.map(item => <option key={item} value={item}>{item || "Специалист"}</option>)}
              </select>
            </div>

            {/* Manage specialists/brokers */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <input placeholder="Новый специалист" value={newSpecialistName}
                onChange={e => setNewSpecialistName(e.target.value)}
                style={{ ...styles.addInput, width: 160 }} />
              <button onClick={() => {
                const n = newSpecialistName.trim();
                if (!n || specialistOptions.some(i => i.toLowerCase() === n.toLowerCase())) return;
                setSpecialistOptions(p => [...p, n]); setNewSpecialistName("");
              }} style={styles.confirmAddBtn}>+ Специалист</button>

              <input placeholder="Новый брокер" value={newBrokerName}
                onChange={e => setNewBrokerName(e.target.value)}
                style={{ ...styles.addInput, width: 160 }} />
              <button onClick={() => {
                const n = newBrokerName.trim();
                if (!n || brokerOptions.some(i => i.toLowerCase() === n.toLowerCase())) return;
                setBrokerOptions(p => [...p, n]); setNewBrokerName("");
              }} style={styles.confirmAddBtn}>+ Брокер</button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={addManualRow} style={styles.confirmAddBtn}>Добавить запись</button>
              <button onClick={() => { setNewRow(emptyRow); setShowAddPanel(false); }}
                style={{ ...styles.confirmAddBtn, background: "#94a3b8" }}>Отмена</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            
            <thead>
              <tr>
                {columns.map((col, i) => (
  <th
    key={i}
    style={{
      ...styles.th,
      position: "relative",
      width: colWidths[i] || 120,
      minWidth: colWidths[i] || 120,
    }}
  >
    {col}

    <div
      onMouseDown={(e) => startResize(i, e)}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        width: "6px",
        height: "100%",
        cursor: "col-resize",
        zIndex: 10,
      }}
    />
  </th>
))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ ...styles.td, textAlign: "center", color: "#94a3b8", padding: "32px" }}>
                    Записей не найдено
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <TableRow
                    key={row._id}
                    row={row}
                    brokerOptions={brokerOptions}
                    specialistOptions={specialistOptions}
                    savingId={savingId}
                    onChange={handleChange}
                    onBlurSave={handleBlurSave}
                    onSelectChangeAndSave={handleSelectChangeAndSave}
                    onClear={clearJournalFields}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={styles.pagination}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.pageInfo}>Показывать</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={styles.pageSizeSelect}>
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={styles.pageInfo}>
              {filteredRows.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)}`} из {filteredRows.length}
            </span>
          </div>

          <div style={styles.pageControls}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }}
            >
              ‹ Назад
            </button>
            {renderPageButtons()}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }}
            >
              Вперёд ›
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
