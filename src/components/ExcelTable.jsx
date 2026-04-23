import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const JOURNAL_DATE_FILTER_KEY = "journal_date_filter_v2";

const applicationStatusOptions = [
  "",
  "На одобрении",
  "На рассмотрении",
  "Выполняется",
  "Прозвона нет",
  "Ждем фото",
  "Выпуск готов",
  "Стоп",
];

const defaultSpecialistOptions = ["", "Эрик", "Нуржан", "Ару", "Ерке", "Ислам", "Айнура"];
const defaultBrokerOptions = ["", "Алина", "Диас", "Асель"];

const emptyRow = {
  number: "",
  fio: "",
  type: "",
  brand: "",
  model: "",
  color: "",
  vinCode: "",
  broker: "",
  applicationStatus: "",
  submitDate: "",
  applicationNumber: "",
  specialist: "",
  sbktsNumber: "",
  comment: "",
  sbktsEptsStatus: "",
  eptsStatus: "",
};

const defaultColumnWidths = {
  num: 50,
  number: 76,
  fio: 190,
  type: 90,
  brandModel: 220,
  color: 90,
  vin: 160,
  broker: 120,
  status: 160,
  date: 130,
  appNumber: 140,
  specialist: 140,
  sbkts: 150,
  comment: 200,
  smallStatus: 170,
  action: 72,
};

const toDateInput = (value) => {
  if (!value) return "";
  if (typeof value !== "string") return "";
  if (value.includes("T")) return value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getInitialDateFilter = () => {
  try {
    const raw = localStorage.getItem(JOURNAL_DATE_FILTER_KEY);
    if (!raw) return { fromDate: "", toDate: "" };
    const parsed = JSON.parse(raw);
    if (parsed?.savedForDay !== getTodayKey()) return { fromDate: "", toDate: "" };
    return {
      fromDate: parsed?.fromDate || "",
      toDate: parsed?.toDate || "",
    };
  } catch {
    return { fromDate: "", toDate: "" };
  }
};

const loadSavedOptions = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const normalized = parsed
      .map((item) => String(item || "").trim())
      .filter((item, idx, arr) => item && arr.indexOf(item) === idx);
    return ["", ...normalized];
  } catch {
    return fallback;
  }
};

const getRowStatusColor = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("выпуск готов") || value.includes("готов")) return "#d7f6de";
  if (value.includes("ждем фото")) return "#ffe0ec";
  if (value.includes("прозвона нет") || value.includes("стоп")) return "#ffd7d7";
  if (value.includes("выполняется") || value.includes("рассмотр") || value.includes("одобр")) {
    return "#fff3c9";
  }
  return "#ffffff";
};

const sortRowsByDateDesc = (rows) =>
  [...rows].sort((a, b) => {
    const dateA = a.submitDate || "";
    const dateB = b.submitDate || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

const addDailyNumeration = (rows) => {
  const counters = new Map();
  return rows.map((row) => {
    const key = row.submitDate || "no-date";
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    return { ...row, dailyNumeration: next };
  });
};

const buildMergedRows = (applications, journalRows) => {
  const journalByAppId = new Map(
    journalRows.filter((item) => item.applicationId).map((item) => [item.applicationId, item])
  );

  const appRows = applications.map((app) => {
    const appId = app._id || "";
    const journal = journalByAppId.get(appId);
    return {
      _id: appId,
      journalId: journal?._id || null,
      rowType: "application",
      createdAt: journal?.createdAt || app.createdAt || "",
      number: journal?.number ?? app.protocolNumber ?? "",
      fio: journal?.fio ?? app.fio ?? "",
      type: journal?.type ?? app.typ ?? "",
      brand: journal?.brand ?? app.brand ?? "",
      model: journal?.model ?? app.model ?? "",
      color: journal?.color ?? app.color ?? "",
      vinCode: journal?.vinCode ?? app.vin ?? "",
      broker: journal?.broker ?? app.broker ?? "",
      applicationStatus: journal?.applicationStatus ?? app.status1 ?? "",
      submitDate: journal?.submitDate ?? toDateInput(app.createdAt),
      applicationNumber: journal?.applicationNumber ?? app.protocolNumber ?? "",
      specialist: journal?.specialist ?? app.specialist ?? "",
      sbktsNumber: journal?.sbktsNumber ?? "",
      comment: journal?.comment ?? "",
      sbktsEptsStatus: journal?.sbktsEptsStatus ?? "",
      eptsStatus: journal?.eptsStatus ?? "",
    };
  });

  const manualRows = journalRows
    .filter((item) => !item.applicationId)
    .map((item) => ({
      _id: `manual-${item._id}`,
      journalId: item._id,
      rowType: "manual",
      createdAt: item.createdAt || "",
      number: item.number || "",
      fio: item.fio || "",
      type: item.type || "",
      brand: item.brand || "",
      model: item.model || "",
      color: item.color || "",
      vinCode: item.vinCode || "",
      broker: item.broker || "",
      applicationStatus: item.applicationStatus || "",
      submitDate: item.submitDate || "",
      applicationNumber: item.applicationNumber || "",
      specialist: item.specialist || "",
      sbktsNumber: item.sbktsNumber || "",
      comment: item.comment || "",
      sbktsEptsStatus: item.sbktsEptsStatus || "",
      eptsStatus: item.eptsStatus || "",
    }));

  return sortRowsByDateDesc([...appRows, ...manualRows]);
};

const HeaderCell = ({ label, widthKey, columnWidths, onResizeStart }) => (
  <th style={{ ...thStyle, width: columnWidths[widthKey] }}>
    <div style={thContentStyle}>
      <span>{label}</span>
      <span
        role="presentation"
        style={resizerStyle}
        onMouseDown={(event) => onResizeStart(widthKey, event)}
      />
    </div>
  </th>
);

const TableRow = React.memo(function TableRow({
  row,
  rowColor,
  columnWidths,
  brokerOptions,
  specialistOptions,
  savingId,
  onChange,
  onBlurSave,
  onSelectChangeAndSave,
  onClear,
}) {
  return (
    <tr>
      <td style={{ ...tdStyle, width: columnWidths.num, background: rowColor }}>{row.dailyNumeration}</td>
      <td style={{ ...tdStyle, width: columnWidths.number, background: rowColor }}>
        <input value={row.number || ""} onChange={(e) => onChange(row._id, "number", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.fio, background: rowColor }}>
        <input value={row.fio || ""} onChange={(e) => onChange(row._id, "fio", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.type, background: rowColor }}>
        <input value={row.type || ""} onChange={(e) => onChange(row._id, "type", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.brandModel, background: rowColor }}>
        <div style={{ display: "grid", gap: 4 }}>
          <input placeholder="Марка" value={row.brand || ""} onChange={(e) => onChange(row._id, "brand", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
          <input placeholder="Модель" value={row.model || ""} onChange={(e) => onChange(row._id, "model", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
        </div>
      </td>
      <td style={{ ...tdStyle, width: columnWidths.color, background: rowColor }}>
        <input value={row.color || ""} onChange={(e) => onChange(row._id, "color", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.vin, background: rowColor }}>
        <input value={row.vinCode || ""} onChange={(e) => onChange(row._id, "vinCode", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.broker, background: rowColor }}>
        <select value={row.broker || ""} onChange={(e) => onSelectChangeAndSave(row._id, "broker", e.target.value)} style={tableInputStyle}>
          {brokerOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>
      <td style={{ ...tdStyle, width: columnWidths.status, background: rowColor }}>
        <select value={row.applicationStatus || ""} onChange={(e) => onSelectChangeAndSave(row._id, "applicationStatus", e.target.value)} style={tableInputStyle}>
          {applicationStatusOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>
      <td style={{ ...tdStyle, width: columnWidths.date, background: rowColor }}>
        <input type="date" value={row.submitDate || ""} onChange={(e) => onChange(row._id, "submitDate", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.appNumber, background: rowColor }}>
        <input value={row.applicationNumber || ""} onChange={(e) => onChange(row._id, "applicationNumber", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.specialist, background: rowColor }}>
        <select value={row.specialist || ""} onChange={(e) => onSelectChangeAndSave(row._id, "specialist", e.target.value)} style={tableInputStyle}>
          {specialistOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>
      <td style={{ ...tdStyle, width: columnWidths.sbkts, background: rowColor }}>
        <input value={row.sbktsNumber || ""} onChange={(e) => onChange(row._id, "sbktsNumber", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.comment, background: rowColor }}>
        <input value={row.comment || ""} onChange={(e) => onChange(row._id, "comment", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.smallStatus, background: rowColor }}>
        <input value={row.sbktsEptsStatus || ""} onChange={(e) => onChange(row._id, "sbktsEptsStatus", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.smallStatus, background: rowColor }}>
        <input value={row.eptsStatus || ""} onChange={(e) => onChange(row._id, "eptsStatus", e.target.value)} onBlur={() => onBlurSave(row._id)} style={tableInputStyle} />
      </td>
      <td style={{ ...tdStyle, width: columnWidths.action, background: rowColor }}>
        <button onClick={() => onClear(row)} style={smallDeleteButtonStyle} title={savingId === row._id ? "Сохраняется..." : "Очистить"}>
          X
        </button>
      </td>
    </tr>
  );
});

export default function ExcelTable() {
  const [rows, setRows] = useState([]);
  const [journalRows, setJournalRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [newRow, setNewRow] = useState(emptyRow);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(getInitialDateFilter);
  const [specialistOptions, setSpecialistOptions] = useState(() =>
    loadSavedOptions("journal_specialist_options", defaultSpecialistOptions)
  );
  const [brokerOptions, setBrokerOptions] = useState(() =>
    loadSavedOptions("journal_broker_options", defaultBrokerOptions)
  );
  const [newSpecialistName, setNewSpecialistName] = useState("");
  const [newBrokerName, setNewBrokerName] = useState("");
  const [selectedBrokerToDelete, setSelectedBrokerToDelete] = useState("");
  const [selectedSpecialistToDelete, setSelectedSpecialistToDelete] = useState("");
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
  const resizeStateRef = useRef({ key: "", startX: 0, startWidth: 0 });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        fromDate: dateFilter.fromDate || undefined,
        toDate: dateFilter.toDate || undefined,
      };

      const [appsRes, journalRes] = await Promise.all([
        axios.get(`${API_URL}/api/applications`, { params }),
        axios.get(`${API_URL}/api/table-journal`, { params }),
      ]);

      const apps = Array.isArray(appsRes.data) ? appsRes.data : [];
      const journal = Array.isArray(journalRes.data) ? journalRes.data : [];
      const merged = buildMergedRows(apps, journal);
      setJournalRows(journal);
      setRows(merged);
    } catch (error) {
      console.error("Ошибка загрузки таблицы:", error);
      alert("Не удалось загрузить таблицу");
    } finally {
      setLoading(false);
    }
  }, [dateFilter.fromDate, dateFilter.toDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    localStorage.setItem("journal_specialist_options", JSON.stringify(specialistOptions));
  }, [specialistOptions]);

  useEffect(() => {
    localStorage.setItem("journal_broker_options", JSON.stringify(brokerOptions));
  }, [brokerOptions]);

  useEffect(() => {
    localStorage.setItem(
      JOURNAL_DATE_FILTER_KEY,
      JSON.stringify({
        ...dateFilter,
        savedForDay: getTodayKey(),
      })
    );
  }, [dateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, search, dateFilter.fromDate, dateFilter.toDate]);

  const onResizeStart = (key, event) => {
    event.preventDefault();
    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key] || 100,
    };

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const nextWidth = Math.max(56, resizeStateRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [key]: nextWidth }));
    };

    const onMouseUp = () => {
      resizeStateRef.current = { key: "", startX: 0, startWidth: 0 };
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (dateFilter.fromDate || dateFilter.toDate) {
      result = result.filter((row) => {
        if (!row.submitDate) return false;
        if (dateFilter.fromDate && row.submitDate < dateFilter.fromDate) return false;
        if (dateFilter.toDate && row.submitDate > dateFilter.toDate) return false;
        return true;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((row) =>
        [
          row.number,
          row.fio,
          row.type,
          row.brand,
          row.model,
          row.color,
          row.vinCode,
          row.broker,
          row.applicationStatus,
          row.submitDate,
          row.applicationNumber,
          row.specialist,
          row.sbktsNumber,
          row.comment,
          row.sbktsEptsStatus,
          row.eptsStatus,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return addDailyNumeration(result);
  }, [rows, search, dateFilter.fromDate, dateFilter.toDate]);

  const dailyStats = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase();
    const total = filteredRows.length;
    const inProgress = filteredRows.filter((row) => {
      const status = normalize(row.applicationStatus);
      return (
        status.includes("выполняется") ||
        status.includes("в работе") ||
        status.includes("рассмотр") ||
        status.includes("одобр")
      );
    }).length;
    const waitingCall = filteredRows.filter((row) =>
      normalize(row.applicationStatus).includes("прозвона нет")
    ).length;
    const waitingPhoto = filteredRows.filter((row) =>
      normalize(row.applicationStatus).includes("ждем фото")
    ).length;
    const released = filteredRows.filter((row) => {
      const status = normalize(row.applicationStatus);
      return status.includes("выпуск готов") || status === "готова" || status === "готово";
    }).length;

    return { total, inProgress, waitingCall, waitingPhoto, released };
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const syncApplicationStatus = async (row) => {
    if (row.rowType !== "application") return;
    try {
      await axios.patch(`${API_URL}/api/applications/${row._id}/status`, {
        status1: row.applicationStatus || "",
      });
    } catch (error) {
      console.error("Не удалось обновить статус заявки:", error);
    }
  };

  const saveRow = async (row) => {
    try {
      setSavingId(row._id);
      const payload = {
        applicationId: row.rowType === "application" ? row._id : "",
        number: row.number || "",
        fio: row.fio || "",
        type: row.type || "",
        brand: row.brand || "",
        model: row.model || "",
        color: row.color || "",
        vinCode: row.vinCode || "",
        broker: row.broker || "",
        applicationStatus: row.applicationStatus || "",
        submitDate: row.submitDate || "",
        applicationNumber: row.applicationNumber || "",
        specialist: row.specialist || "",
        sbktsNumber: row.sbktsNumber || "",
        comment: row.comment || "",
        sbktsEptsStatus: row.sbktsEptsStatus || "",
        eptsStatus: row.eptsStatus || "",
      };

      const saved = row.journalId
        ? (await axios.put(`${API_URL}/api/table-journal/${row.journalId}`, payload)).data
        : (await axios.post(`${API_URL}/api/table-journal`, payload)).data;

      await syncApplicationStatus(row);

      setJournalRows((prev) => {
        const exists = prev.some((item) => item._id === saved._id);
        return exists ? prev.map((item) => (item._id === saved._id ? saved : item)) : [saved, ...prev];
      });

      setRows((prev) =>
        sortRowsByDateDesc(
          prev.map((item) =>
            item._id === row._id
              ? {
                  ...item,
                  journalId: saved._id,
                  createdAt: item.createdAt,
                }
              : item
          )
        )
      );
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      alert(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Не удалось сохранить запись"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = (id, field, value) => {
    setRows((prev) => prev.map((row) => (row._id === id ? { ...row, [field]: value } : row)));
  };

  const handleBlurSave = (id) => {
    setRows((prev) => {
      const row = prev.find((item) => item._id === id);
      if (row) Promise.resolve().then(() => saveRow(row));
      return prev;
    });
  };

  const handleSelectChangeAndSave = (id, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) => (row._id === id ? { ...row, [field]: value } : row));
      const changedRow = updated.find((row) => row._id === id);
      if (changedRow) setTimeout(() => saveRow(changedRow), 0);
      return updated;
    });
  };

  const handleNewRowChange = (field, value) => {
    setNewRow((prev) => ({ ...prev, [field]: value }));
  };

  const addSpecialistOption = () => {
    const name = newSpecialistName.trim();
    if (!name) return;
    const exists = specialistOptions.some((item) => item.toLowerCase() === name.toLowerCase());
    if (exists) return alert("Такой специалист уже есть");
    setSpecialistOptions((prev) => [...prev, name]);
    setNewSpecialistName("");
  };

  const addBrokerOption = () => {
    const name = newBrokerName.trim();
    if (!name) return;
    const exists = brokerOptions.some((item) => item.toLowerCase() === name.toLowerCase());
    if (exists) return alert("Такой брокер уже есть");
    setBrokerOptions((prev) => [...prev, name]);
    setNewBrokerName("");
  };

  const deleteBrokerOption = () => {
    const name = selectedBrokerToDelete.trim();
    if (!name) return;
    if (defaultBrokerOptions.includes(name)) return alert("Стандартного брокера удалять нельзя");
    setBrokerOptions((prev) => prev.filter((item) => item !== name));
    setRows((prev) => prev.map((row) => (row.broker === name ? { ...row, broker: "" } : row)));
    setSelectedBrokerToDelete("");
  };

  const deleteSpecialistOption = () => {
    const name = selectedSpecialistToDelete.trim();
    if (!name) return;
    if (defaultSpecialistOptions.includes(name)) return alert("Стандартного специалиста удалять нельзя");
    setSpecialistOptions((prev) => prev.filter((item) => item !== name));
    setRows((prev) =>
      prev.map((row) => (row.specialist === name ? { ...row, specialist: "" } : row))
    );
    setSelectedSpecialistToDelete("");
  };

  const addManualRow = async () => {
    try {
      const payload = { applicationId: "", ...newRow };
      const saved = (await axios.post(`${API_URL}/api/table-journal`, payload)).data;
      const created = {
        _id: `manual-${saved._id}`,
        journalId: saved._id,
        rowType: "manual",
        createdAt: saved.createdAt || "",
        ...saved,
      };
      setJournalRows((prev) => [saved, ...prev]);
      setRows((prev) => sortRowsByDateDesc([created, ...prev]));
      setNewRow(emptyRow);
    } catch (error) {
      console.error("Ошибка добавления:", error);
      alert(error?.response?.data?.message || "Не удалось добавить запись");
    }
  };

  const clearJournalFields = async (row) => {
    try {
      if (!row.journalId) {
        setRows((prev) =>
          prev.map((item) =>
            item._id === row._id
              ? {
                  ...item,
                  sbktsNumber: "",
                  comment: "",
                  sbktsEptsStatus: "",
                  eptsStatus: "",
                }
              : item
          )
        );
        return;
      }

      await axios.delete(`${API_URL}/api/table-journal/${row.journalId}`);
      setJournalRows((prev) => prev.filter((item) => item._id !== row.journalId));

      if (row.rowType === "manual") {
        setRows((prev) => prev.filter((item) => item._id !== row._id));
      } else {
        setRows((prev) =>
          prev.map((item) =>
            item._id === row._id
              ? {
                  ...item,
                  journalId: null,
                  sbktsNumber: "",
                  comment: "",
                  sbktsEptsStatus: "",
                  eptsStatus: "",
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Ошибка очистки:", error);
      alert(error?.response?.data?.message || "Не удалось очистить запись");
    }
  };

  const exportToExcel = () => {
    const dataForExcel = filteredRows.map((row) => ({
      Нумерация: row.dailyNumeration,
      НОМЕР: row.number,
      ФИО: row.fio,
      Тип: row.type,
      "МАРКА / МОДЕЛЬ": `${row.brand || ""} ${row.model || ""}`.trim(),
      ЦВЕТ: row.color,
      "VIN КОД": row.vinCode,
      БРОКЕР: row.broker,
      "Статус ЗАЯВКИ": row.applicationStatus,
      "Дата ПОДАЧИ": row.submitDate,
      "НОМЕР ЗАЯВКИ": row.applicationNumber,
      СПЕЦИАЛИСТ: row.specialist,
      "Номер СБКТС": row.sbktsNumber,
      Комментарий: row.comment,
      "Статус СБКТС в ЭПТС": row.sbktsEptsStatus,
      "Статус ЭПТС": row.eptsStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Таблица заявок");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const fileData = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });
    saveAs(fileData, "table_journal.xlsx");
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={topLineStyle}>
          <h2 style={{ margin: 0 }}>Журнал заявок</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: 280 }}
            />
            <button onClick={exportToExcel} style={{ ...primaryButtonStyle, background: "#2e7d32" }}>
              Скачать Excel
            </button>
          </div>
        </div>

        <div style={kpiGridStyle}>
          <div style={kpiCardStyle}><div style={kpiTitleStyle}>Всего заявок</div><div style={kpiValueStyle}>{dailyStats.total}</div></div>
          <div style={kpiCardStyle}><div style={kpiTitleStyle}>В процессе</div><div style={kpiValueStyle}>{dailyStats.inProgress}</div></div>
          <div style={kpiCardStyle}><div style={kpiTitleStyle}>Ожидают звонка</div><div style={kpiValueStyle}>{dailyStats.waitingCall}</div></div>
          <div style={kpiCardStyle}><div style={kpiTitleStyle}>Ожидают фото</div><div style={kpiValueStyle}>{dailyStats.waitingPhoto}</div></div>
          <div style={kpiCardStyle}><div style={kpiTitleStyle}>Выпущены</div><div style={kpiValueStyle}>{dailyStats.released}</div></div>
        </div>

        <div style={filtersStyle}>
          <label style={filterLabelStyle}>
            C даты
            <input
              type="date"
              value={dateFilter.fromDate}
              onChange={(e) => setDateFilter((prev) => ({ ...prev, fromDate: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={filterLabelStyle}>
            По дату
            <input
              type="date"
              value={dateFilter.toDate}
              onChange={(e) => setDateFilter((prev) => ({ ...prev, toDate: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <button
            onClick={() => setDateFilter({ fromDate: "", toDate: "" })}
            style={secondaryButtonStyle}
          >
            Сбросить фильтр
          </button>
          <button onClick={() => setManualFormOpen((prev) => !prev)} style={primaryButtonStyle}>
            {manualFormOpen ? "Скрыть ручное добавление" : "Добавить заявку вручную"}
          </button>
        </div>

        {manualFormOpen && (
          <div style={manualCardStyle}>
            <div style={manualGridStyle}>
              <input placeholder="НОМЕР" value={newRow.number} onChange={(e) => handleNewRowChange("number", e.target.value)} style={inputStyle} />
              <input placeholder="ФИО" value={newRow.fio} onChange={(e) => handleNewRowChange("fio", e.target.value)} style={inputStyle} />
              <input placeholder="Тип" value={newRow.type} onChange={(e) => handleNewRowChange("type", e.target.value)} style={inputStyle} />
              <input placeholder="МАРКА" value={newRow.brand} onChange={(e) => handleNewRowChange("brand", e.target.value)} style={inputStyle} />
              <input placeholder="МОДЕЛЬ" value={newRow.model} onChange={(e) => handleNewRowChange("model", e.target.value)} style={inputStyle} />
              <input placeholder="ЦВЕТ" value={newRow.color} onChange={(e) => handleNewRowChange("color", e.target.value)} style={inputStyle} />
              <input placeholder="VIN" value={newRow.vinCode} onChange={(e) => handleNewRowChange("vinCode", e.target.value)} style={inputStyle} />
              <select value={newRow.broker} onChange={(e) => handleNewRowChange("broker", e.target.value)} style={inputStyle}>
                {brokerOptions.map((item) => <option key={item} value={item}>{item || "Брокер"}</option>)}
              </select>
              <select value={newRow.applicationStatus} onChange={(e) => handleNewRowChange("applicationStatus", e.target.value)} style={inputStyle}>
                {applicationStatusOptions.map((item) => <option key={item} value={item}>{item || "Статус"}</option>)}
              </select>
              <input type="date" value={newRow.submitDate} onChange={(e) => handleNewRowChange("submitDate", e.target.value)} style={inputStyle} />
              <input placeholder="Номер заявки" value={newRow.applicationNumber} onChange={(e) => handleNewRowChange("applicationNumber", e.target.value)} style={inputStyle} />
              <select value={newRow.specialist} onChange={(e) => handleNewRowChange("specialist", e.target.value)} style={inputStyle}>
                {specialistOptions.map((item) => <option key={item} value={item}>{item || "Специалист"}</option>)}
              </select>
              <input placeholder="Номер СБКТС" value={newRow.sbktsNumber} onChange={(e) => handleNewRowChange("sbktsNumber", e.target.value)} style={inputStyle} />
              <input placeholder="Комментарий" value={newRow.comment} onChange={(e) => handleNewRowChange("comment", e.target.value)} style={inputStyle} />
              <input placeholder="Статус СБКТС в ЭПТС" value={newRow.sbktsEptsStatus} onChange={(e) => handleNewRowChange("sbktsEptsStatus", e.target.value)} style={inputStyle} />
              <input placeholder="Статус ЭПТС" value={newRow.eptsStatus} onChange={(e) => handleNewRowChange("eptsStatus", e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="Добавить брокера" value={newBrokerName} onChange={(e) => setNewBrokerName(e.target.value)} style={inputStyle} />
                <button onClick={addBrokerOption} style={smallAddButtonStyle}>+</button>
                <select value={selectedBrokerToDelete} onChange={(e) => setSelectedBrokerToDelete(e.target.value)} style={inputStyle}>
                  <option value="">Удалить брокера</option>
                  {brokerOptions.filter((item) => item && !defaultBrokerOptions.includes(item)).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <button onClick={deleteBrokerOption} style={smallRemoveButtonStyle}>−</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="Добавить специалиста" value={newSpecialistName} onChange={(e) => setNewSpecialistName(e.target.value)} style={inputStyle} />
                <button onClick={addSpecialistOption} style={smallAddButtonStyle}>+</button>
                <select value={selectedSpecialistToDelete} onChange={(e) => setSelectedSpecialistToDelete(e.target.value)} style={inputStyle}>
                  <option value="">Удалить специалиста</option>
                  {specialistOptions.filter((item) => item && !defaultSpecialistOptions.includes(item)).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <button onClick={deleteSpecialistOption} style={smallRemoveButtonStyle}>−</button>
              </div>
              <div>
                <button onClick={addManualRow} style={primaryButtonStyle}>Добавить запись</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 20, textAlign: "center" }}>Загрузка...</div>
        ) : (
          <>
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <HeaderCell label="Нум." widthKey="num" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Номер" widthKey="number" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="ФИО" widthKey="fio" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Тип" widthKey="type" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Марка / Модель" widthKey="brandModel" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Цвет" widthKey="color" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="VIN код" widthKey="vin" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Брокер" widthKey="broker" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Статус заявки" widthKey="status" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Дата подачи" widthKey="date" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Номер заявки" widthKey="appNumber" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Специалист" widthKey="specialist" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Номер СБКТС" widthKey="sbkts" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Комментарий" widthKey="comment" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Статус СБКТС в ЭПТС" widthKey="smallStatus" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Статус ЭПТС" widthKey="smallStatus" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                    <HeaderCell label="Очист." widthKey="action" columnWidths={columnWidths} onResizeStart={onResizeStart} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((row) => (
                      <TableRow
                        key={row._id}
                        row={row}
                        rowColor={getRowStatusColor(row.applicationStatus)}
                        columnWidths={columnWidths}
                        brokerOptions={brokerOptions}
                        specialistOptions={specialistOptions}
                        savingId={savingId}
                        onChange={handleChange}
                        onBlurSave={handleBlurSave}
                        onSelectChangeAndSave={handleSelectChangeAndSave}
                        onClear={clearJournalFields}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={17} style={emptyStyle}>
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={paginationStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Показывать:</span>
                <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} style={inputStyle}>
                  {[10, 20, 30, 50, 100].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button disabled={safePage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} style={secondaryButtonStyle}>Назад</button>
                <span>Страница {safePage} / {totalPages}</span>
                <button disabled={safePage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} style={secondaryButtonStyle}>Вперед</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "16px",
  background: "#f4f6f8",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #d0d7de",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const topLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const filtersStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
  alignItems: "flex-end",
};

const filterLabelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#3d4b5e",
};

const inputStyle = {
  padding: "9px 10px",
  border: "1px solid #c5ccd3",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const tableInputStyle = {
  width: "100%",
  padding: "6px 7px",
  border: "1px solid #cfd6dd",
  borderRadius: 5,
  fontSize: 12,
  boxSizing: "border-box",
  background: "#fff",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  border: "1px solid #c5ccd3",
  borderRadius: 8,
  background: "#fff",
  color: "#333",
  cursor: "pointer",
  fontWeight: 600,
};

const smallAddButtonStyle = {
  minWidth: 42,
  padding: "0 12px",
  border: "none",
  borderRadius: 8,
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 18,
};

const smallRemoveButtonStyle = {
  minWidth: 42,
  padding: "0 12px",
  border: "none",
  borderRadius: 8,
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 18,
};

const smallDeleteButtonStyle = {
  width: "100%",
  padding: "7px 6px",
  border: "none",
  borderRadius: 6,
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const tableContainerStyle = {
  width: "100%",
  overflowX: "auto",
  overflowY: "auto",
  maxHeight: "calc(100vh - 330px)",
  border: "1px solid #c9d1d9",
  background: "#fff",
};

const tableStyle = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: 12,
};

const thStyle = {
  border: "1px solid #bfc5cc",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 11,
  lineHeight: 1.1,
  background: "#e9edf2",
  position: "sticky",
  top: 0,
  zIndex: 5,
};

const thContentStyle = {
  position: "relative",
  minHeight: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingRight: 8,
};

const resizerStyle = {
  position: "absolute",
  top: -8,
  right: -6,
  width: 10,
  height: 26,
  cursor: "col-resize",
  borderRight: "2px solid rgba(25, 118, 210, 0.35)",
};

const tdStyle = {
  border: "1px solid #d6dbe1",
  padding: 4,
  textAlign: "left",
  verticalAlign: "middle",
};

const emptyStyle = {
  border: "1px solid #d6dbe1",
  padding: 18,
  textAlign: "center",
  background: "#fff",
};

const kpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const kpiCardStyle = {
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  background: "#f7fbff",
  padding: "10px 12px",
};

const kpiTitleStyle = {
  fontSize: 12,
  color: "#4a5b72",
};

const kpiValueStyle = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 700,
  color: "#114a8f",
};

const manualCardStyle = {
  border: "1px solid #d6dbe1",
  borderRadius: 8,
  padding: 10,
  marginBottom: 12,
  background: "#fafbfc",
};

const manualGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const paginationStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginTop: 10,
  flexWrap: "wrap",
};
