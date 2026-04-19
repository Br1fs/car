import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const monthOptions = [
  { value: "all", label: "Все месяцы" },
  { value: "01", label: "Январь" },
  { value: "02", label: "Февраль" },
  { value: "03", label: "Март" },
  { value: "04", label: "Апрель" },
  { value: "05", label: "Май" },
  { value: "06", label: "Июнь" },
  { value: "07", label: "Июль" },
  { value: "08", label: "Август" },
  { value: "09", label: "Сентябрь" },
  { value: "10", label: "Октябрь" },
  { value: "11", label: "Ноябрь" },
  { value: "12", label: "Декабрь" },
];

const yearOptions = [
  { value: "all", label: "Все годы" },
  { value: "2026", label: "2026" },
  { value: "2027", label: "2027" },
  { value: "2028", label: "2028" },
];

const dayOptions = [
  { value: "all", label: "Все числа" },
  ...Array.from({ length: 31 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return { value: day, label: String(i + 1) };
  }),
];

const applicationStatusOptions = [
  "",
  "На рассмотрении",
  "Выпуск готов",
  "Выполняется",
  "Стоп",
  "Ждем фото",
];

const defaultSpecialistOptions = [
  "",
  "Эрик",
  "Нуржан",
  "Ару",
  "Ерке",
  "Ислам",
  "Айнура",
];

const defaultBrokerOptions = [
  "",
  "Алина",
  "Диас",
  "Асель",
];

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

function normalizeDate(value) {
  if (!value) return "";
  if (typeof value !== "string") return "";

  if (value.includes("T")) {
    return value.slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return value;
}

function getRowStatusColor(status) {
  const value = (status || "").toLowerCase();

  if (
    value.includes("выпуск готов") ||
    value.includes("готов") ||
    value.includes("заверш")
  ) {
    return "#b9f6ca";
  }

  if (
    value.includes("стоп") ||
    value.includes("отказ") ||
    value.includes("ошиб")
  ) {
    return "#FF0000";
  }

  if (
    value.includes("выполняется") ||
    value.includes("рассмотр") 
  ) {
    return "#fff176";
  }


   if (
    value.includes("ждем фото")
  ) {
    return "#FFC0CB";
  }

   if (
    value.includes("Стоп")
  ) {
    return "#FF0000";
  }


  return "#ffffff";
}

function sortRowsByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const dateA = a.submitDate || "";
    const dateB = b.submitDate || "";

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    const createdA = a.createdAt || "";
    const createdB = b.createdAt || "";

    return createdB.localeCompare(createdA);
  });
}

function buildMergedRows(applications, journalRows) {
  const journalByAppId = new Map(
    journalRows
      .filter((item) => item.applicationId)
      .map((item) => [item.applicationId, item])
  );

  const appRows = applications.map((app) => {
    const appId = app._id || "";
    const journal = journalByAppId.get(appId);

    return {
      _id: appId,
      journalId: journal?._id || null,
      rowType: "application",
      createdAt: journal?.createdAt || app.createdAt || "",

      number: journal?.number ?? app.number ?? app.protocolNumber ?? "",
      fio: journal?.fio ?? app.fio ?? "",
      type: journal?.type ?? app.type ?? app.typ ?? "",
      brand: journal?.brand ?? app.brand ?? "",
      model: journal?.model ?? app.model ?? "",
      color: journal?.color ?? app.color ?? "",
      vinCode: journal?.vinCode ?? app.vin ?? app.vinCode ?? "",
      broker: journal?.broker ?? app.broker ?? "",
      applicationStatus:
        journal?.applicationStatus ?? app.status1 ?? app.status ?? "",
      submitDate: journal?.submitDate ?? normalizeDate(app.createdAt) ?? "",
      applicationNumber:
        journal?.applicationNumber ??
        app.applicationNumber ??
        app.protocolNumber ??
        "",
      specialist: journal?.specialist ?? app.specialist ?? app.manager ?? "",
      sbktsNumber: journal?.sbktsNumber ?? app.sbktsNumber ?? "",
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
}

function addDailyNumeration(rows) {
  const counters = new Map();

  return rows.map((row) => {
    const key = row.submitDate || "no-date";
    const current = counters.get(key) || 0;
    const next = current + 1;
    counters.set(key, next);

    return {
      ...row,
      dailyNumeration: next,
    };
  });
}

function loadSavedOptions(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;

    const normalized = parsed
      .map((item) => String(item || "").trim())
      .filter((item, index, arr) => arr.indexOf(item) === index);

    if (!normalized.includes("")) {
      normalized.unshift("");
    }

    return normalized;
  } catch {
    return fallback;
  }
}

const TableRow = React.memo(function TableRow({
  row,
  rowColor,
  brokerOptions,
  specialistOptions,
  applicationStatusOptions,
  savingId,
  onChange,
  onBlurSave,
  onSelectChangeAndSave,
  onClear,
}) {
  return (
    <tr>
      <td style={{ ...tdStyle, ...wNum, background: rowColor }}>
        {row.dailyNumeration}
      </td>

      <td style={{ ...tdStyle, ...wNumber, background: rowColor }}>
        <input
          type="text"
          value={row.number || ""}
          onChange={(e) => onChange(row._id, "number", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wFio, background: rowColor }}>
        <input
          type="text"
          value={row.fio || ""}
          onChange={(e) => onChange(row._id, "fio", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wType, background: rowColor }}>
        <input
          type="text"
          value={row.type || ""}
          onChange={(e) => onChange(row._id, "type", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td
        style={{
          ...tdStyle,
          ...wBrandModel,
          background: rowColor,
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <input
            type="text"
            placeholder="Марка"
            value={row.brand || ""}
            onChange={(e) => onChange(row._id, "brand", e.target.value)}
            onBlur={() => onBlurSave(row._id)}
            style={tableInputStyle}
          />
          <input
            type="text"
            placeholder="Модель"
            value={row.model || ""}
            onChange={(e) => onChange(row._id, "model", e.target.value)}
            onBlur={() => onBlurSave(row._id)}
            style={tableInputStyle}
          />
        </div>
      </td>

      <td style={{ ...tdStyle, ...wColor, background: rowColor }}>
        <input
          type="text"
          value={row.color || ""}
          onChange={(e) => onChange(row._id, "color", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wVin, background: rowColor }}>
        <input
          type="text"
          value={row.vinCode || ""}
          onChange={(e) => onChange(row._id, "vinCode", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wBroker, background: rowColor }}>
        <select
          value={row.broker || ""}
          onChange={(e) =>
            onSelectChangeAndSave(row._id, "broker", e.target.value)
          }
          style={tableInputStyle}
        >
          {brokerOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>

      <td style={{ ...tdStyle, ...wStatus, background: rowColor }}>
        <select
          value={row.applicationStatus || ""}
          onChange={(e) =>
            onSelectChangeAndSave(row._id, "applicationStatus", e.target.value)
          }
          style={tableInputStyle}
        >
          {applicationStatusOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>

      <td style={{ ...tdStyle, ...wDate, background: rowColor }}>
        <input
          type="date"
          value={row.submitDate || ""}
          onChange={(e) => onChange(row._id, "submitDate", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wAppNumber, background: rowColor }}>
        <input
          type="text"
          value={row.applicationNumber || ""}
          onChange={(e) =>
            onChange(row._id, "applicationNumber", e.target.value)
          }
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wSpecialist, background: rowColor }}>
        <select
          value={row.specialist || ""}
          onChange={(e) =>
            onSelectChangeAndSave(row._id, "specialist", e.target.value)
          }
          style={tableInputStyle}
        >
          {specialistOptions.map((item) => (
            <option key={item} value={item}>
              {item || "Выбрать"}
            </option>
          ))}
        </select>
      </td>

      <td style={{ ...tdStyle, ...wSbkts, background: rowColor }}>
        <input
          type="text"
          value={row.sbktsNumber || ""}
          onChange={(e) => onChange(row._id, "sbktsNumber", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wComment, background: rowColor }}>
        <input
          type="text"
          value={row.comment || ""}
          onChange={(e) => onChange(row._id, "comment", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wSmallStatus, background: rowColor }}>
        <input
          type="text"
          value={row.sbktsEptsStatus || ""}
          onChange={(e) => onChange(row._id, "sbktsEptsStatus", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wSmallStatus, background: rowColor }}>
        <input
          type="text"
          value={row.eptsStatus || ""}
          onChange={(e) => onChange(row._id, "eptsStatus", e.target.value)}
          onBlur={() => onBlurSave(row._id)}
          style={tableInputStyle}
        />
      </td>

      <td style={{ ...tdStyle, ...wAction, background: rowColor }}>
        <button
          onClick={() => onClear(row)}
          style={smallDeleteButtonStyle}
          title={savingId === row._id ? "Сохраняется..." : "Очистить"}
        >
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

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedDay, setSelectedDay] = useState("all");

  const [specialistOptions, setSpecialistOptions] = useState(() =>
    loadSavedOptions("journal_specialist_options", defaultSpecialistOptions)
  );
  const [brokerOptions, setBrokerOptions] = useState(() =>
    loadSavedOptions("journal_broker_options", defaultBrokerOptions)
  );

  const [newSpecialistName, setNewSpecialistName] = useState("");
  const [newBrokerName, setNewBrokerName] = useState("");

  const [selectedBrokerToDelete, setSelectedBrokerToDelete] = useState("");
  const [selectedSpecialistToDelete, setSelectedSpecialistToDelete] =
    useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "journal_specialist_options",
      JSON.stringify(specialistOptions)
    );
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

      const merged = buildMergedRows(apps, journal);

      setJournalRows(journal);
      setRows(merged);
    } catch (error) {
      console.error("Ошибка загрузки таблицы:", error);
      alert("Не удалось загрузить таблицу");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (
      selectedMonth !== "all" ||
      selectedYear !== "all" ||
      selectedDay !== "all"
    ) {
      result = result.filter((row) => {
        if (!row.submitDate) return false;

        const parts = row.submitDate.split("-");
        if (parts.length < 3) return false;

        const year = parts[0];
        const month = parts[1];
        const day = parts[2];

        const monthMatch =
          selectedMonth === "all" ? true : month === selectedMonth;
        const yearMatch =
          selectedYear === "all" ? true : year === selectedYear;
        const dayMatch = selectedDay === "all" ? true : day === selectedDay;

        return monthMatch && yearMatch && dayMatch;
      });
    }

    const q = search.toLowerCase().trim();

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
  }, [rows, search, selectedMonth, selectedYear, selectedDay]);

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

      let saved;

      if (row.journalId) {
        const res = await axios.put(
          `${API_URL}/api/table-journal/${row.journalId}`,
          payload
        );
        saved = res.data;
      } else {
        const res = await axios.post(`${API_URL}/api/table-journal`, payload);
        saved = res.data;
      }

      setJournalRows((prev) => {
        const exists = prev.some((item) => item._id === saved._id);
        if (exists) {
          return prev.map((item) => (item._id === saved._id ? saved : item));
        }
        return [saved, ...prev];
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
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Не удалось сохранить запись"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = React.useCallback((id, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row._id === id ? { ...row, [field]: value } : row))
    );
  }, []);

  const handleBlurSave = React.useCallback(
    (id) => {
      setRows((prev) => {
        const row = prev.find((item) => item._id === id);
        if (row) {
          Promise.resolve().then(() => saveRow(row));
        }
        return prev;
      });
    },
    []
  );

  const handleSelectChangeAndSave = React.useCallback((id, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) =>
        row._id === id ? { ...row, [field]: value } : row
      );

      const changedRow = updated.find((row) => row._id === id);
      if (changedRow) {
        setTimeout(() => saveRow(changedRow), 0);
      }

      return updated;
    });
  }, []);

  const handleNewRowChange = (field, value) => {
    setNewRow((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addSpecialistOption = () => {
    const name = newSpecialistName.trim();
    if (!name) return;

    const exists = specialistOptions.some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("Такой специалист уже есть в списке");
      return;
    }

    setSpecialistOptions((prev) => [...prev, name]);
    setNewSpecialistName("");
  };

  const addBrokerOption = () => {
    const name = newBrokerName.trim();
    if (!name) return;

    const exists = brokerOptions.some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("Такой брокер уже есть в списке");
      return;
    }

    setBrokerOptions((prev) => [...prev, name]);
    setNewBrokerName("");
  };

  const deleteBrokerOption = () => {
    const name = selectedBrokerToDelete.trim();
    if (!name) return;

    const protectedNames = defaultBrokerOptions.filter(Boolean);
    if (protectedNames.includes(name)) {
      alert("Стандартного брокера удалять нельзя");
      return;
    }

    setBrokerOptions((prev) => prev.filter((item) => item !== name));

    setRows((prev) =>
      prev.map((row) => (row.broker === name ? { ...row, broker: "" } : row))
    );

    setNewRow((prev) => (prev.broker === name ? { ...prev, broker: "" } : prev));

    setSelectedBrokerToDelete("");
  };

  const deleteSpecialistOption = () => {
    const name = selectedSpecialistToDelete.trim();
    if (!name) return;

    const protectedNames = defaultSpecialistOptions.filter(Boolean);
    if (protectedNames.includes(name)) {
      alert("Стандартного специалиста удалять нельзя");
      return;
    }

    setSpecialistOptions((prev) => prev.filter((item) => item !== name));

    setRows((prev) =>
      prev.map((row) =>
        row.specialist === name ? { ...row, specialist: "" } : row
      )
    );

    setNewRow((prev) =>
      prev.specialist === name ? { ...prev, specialist: "" } : prev
    );

    setSelectedSpecialistToDelete("");
  };

  const addManualRow = async () => {
    try {
      const payload = {
        applicationId: "",
        number: newRow.number || "",
        fio: newRow.fio || "",
        type: newRow.type || "",
        brand: newRow.brand || "",
        model: newRow.model || "",
        color: newRow.color || "",
        vinCode: newRow.vinCode || "",
        broker: newRow.broker || "",
        applicationStatus: newRow.applicationStatus || "",
        submitDate: newRow.submitDate || "",
        applicationNumber: newRow.applicationNumber || "",
        specialist: newRow.specialist || "",
        sbktsNumber: newRow.sbktsNumber || "",
        comment: newRow.comment || "",
        sbktsEptsStatus: newRow.sbktsEptsStatus || "",
        eptsStatus: newRow.eptsStatus || "",
      };

      const res = await axios.post(`${API_URL}/api/table-journal`, payload);

      const created = {
        _id: `manual-${res.data._id}`,
        journalId: res.data._id,
        rowType: "manual",
        createdAt: res.data.createdAt || "",

        number: res.data.number || "",
        fio: res.data.fio || "",
        type: res.data.type || "",
        brand: res.data.brand || "",
        model: res.data.model || "",
        color: res.data.color || "",
        vinCode: res.data.vinCode || "",
        broker: res.data.broker || "",
        applicationStatus: res.data.applicationStatus || "",
        submitDate: res.data.submitDate || "",
        applicationNumber: res.data.applicationNumber || "",
        specialist: res.data.specialist || "",
        sbktsNumber: res.data.sbktsNumber || "",
        comment: res.data.comment || "",
        sbktsEptsStatus: res.data.sbktsEptsStatus || "",
        eptsStatus: res.data.eptsStatus || "",
      };

      setJournalRows((prev) => [res.data, ...prev]);
      setRows((prev) => sortRowsByDateDesc([created, ...prev]));
      setNewRow(emptyRow);
    } catch (error) {
      console.error("Ошибка добавления:", error);
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Не удалось добавить запись"
      );
    }
  };

  const clearJournalFields = React.useCallback(async (row) => {
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

      setJournalRows((prev) =>
        prev.filter((item) => item._id !== row.journalId)
      );

      if (row.rowType === "manual") {
        setRows((prev) => prev.filter((item) => item._id !== row._id));
        return;
      }

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
    } catch (error) {
      console.error("Ошибка очистки:", error);
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Не удалось очистить запись"
      );
    }
  }, []);

  const exportToExcel = () => {
    const dataForExcel = filteredRows.map((row) => ({
      "Нумерация": row.dailyNumeration,
      "НОМЕР": row.number,
      "ФИО": row.fio,
      "Тип": row.type,
      "МАРКА / МОДЕЛЬ": `${row.brand || ""} ${row.model || ""}`.trim(),
      "ЦВЕТ": row.color,
      "VIN КОД": row.vinCode,
      "БРОКЕР": row.broker,
      "Статус ЗАЯВКИ": row.applicationStatus,
      "Дата ПОДАЧИ": row.submitDate,
      "НОМЕР ЗАЯВКИ": row.applicationNumber,
      "СПЕЦИАЛИСТ": row.specialist,
      "Номер СБКТС": row.sbktsNumber,
      "Комментарий": row.comment,
      "Статус СБКТС в ЭПТС": row.sbktsEptsStatus,
      "Статус ЭПТС": row.eptsStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Таблица заявок");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(fileData, "table_journal.xlsx");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        padding: "56px 10px 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            padding: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "20px" }}>Таблица заявок</h2>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  ...inputStyle,
                  width: "260px",
                }}
              />

              <button
                onClick={exportToExcel}
                style={{
                  ...primaryButtonStyle,
                  background: "#2e7d32",
                }}
              >
                Скачать Excel
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={filterSelectStyle}
            >
              {monthOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={filterSelectStyle}
            >
              {yearOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              style={filterSelectStyle}
            >
              {dayOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSelectedMonth("all");
                setSelectedYear("all");
                setSelectedDay("all");
              }}
              style={secondaryButtonStyle}
            >
              Сбросить фильтр
            </button>
          </div>

          <div
            style={{
              border: "1px solid #d6dbe1",
              borderRadius: "8px",
              padding: "10px",
              marginBottom: "16px",
              background: "#fafbfc",
            }}
          >
            <div
              style={{
                fontWeight: "700",
                marginBottom: "10px",
                fontSize: "15px",
              }}
            >
              Добавить заявку вручную
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              <input
                type="text"
                placeholder="НОМЕР"
                value={newRow.number}
                onChange={(e) => handleNewRowChange("number", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="ФИО"
                value={newRow.fio}
                onChange={(e) => handleNewRowChange("fio", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Тип"
                value={newRow.type}
                onChange={(e) => handleNewRowChange("type", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="МАРКА"
                value={newRow.brand}
                onChange={(e) => handleNewRowChange("brand", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="МОДЕЛЬ"
                value={newRow.model}
                onChange={(e) => handleNewRowChange("model", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="ЦВЕТ"
                value={newRow.color}
                onChange={(e) => handleNewRowChange("color", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="VIN КОД"
                value={newRow.vinCode}
                onChange={(e) => handleNewRowChange("vinCode", e.target.value)}
                style={inputStyle}
              />

              <select
                value={newRow.broker}
                onChange={(e) => handleNewRowChange("broker", e.target.value)}
                style={inputStyle}
              >
                {brokerOptions.map((item) => (
                  <option key={item} value={item}>
                    {item || "Брокер"}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Добавить брокера"
                  value={newBrokerName}
                  onChange={(e) => setNewBrokerName(e.target.value)}
                  style={inputStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBrokerOption();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addBrokerOption}
                  style={smallAddButtonStyle}
                >
                  +
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={selectedBrokerToDelete}
                  onChange={(e) => setSelectedBrokerToDelete(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Удалить брокера</option>
                  {brokerOptions
                    .filter((item) => item && !defaultBrokerOptions.includes(item))
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={deleteBrokerOption}
                  style={smallRemoveButtonStyle}
                >
                  −
                </button>
              </div>

              <select
                value={newRow.applicationStatus}
                onChange={(e) =>
                  handleNewRowChange("applicationStatus", e.target.value)
                }
                style={inputStyle}
              >
                {applicationStatusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item || "Статус заявки"}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={newRow.submitDate}
                onChange={(e) =>
                  handleNewRowChange("submitDate", e.target.value)
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="НОМЕР ЗАЯВКИ"
                value={newRow.applicationNumber}
                onChange={(e) =>
                  handleNewRowChange("applicationNumber", e.target.value)
                }
                style={inputStyle}
              />

              <select
                value={newRow.specialist}
                onChange={(e) =>
                  handleNewRowChange("specialist", e.target.value)
                }
                style={inputStyle}
              >
                {specialistOptions.map((item) => (
                  <option key={item} value={item}>
                    {item || "Специалист"}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Добавить специалиста"
                  value={newSpecialistName}
                  onChange={(e) => setNewSpecialistName(e.target.value)}
                  style={inputStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSpecialistOption();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addSpecialistOption}
                  style={smallAddButtonStyle}
                >
                  +
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={selectedSpecialistToDelete}
                  onChange={(e) => setSelectedSpecialistToDelete(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Удалить специалиста</option>
                  {specialistOptions
                    .filter(
                      (item) => item && !defaultSpecialistOptions.includes(item)
                    )
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={deleteSpecialistOption}
                  style={smallRemoveButtonStyle}
                >
                  −
                </button>
              </div>

              <input
                type="text"
                placeholder="Номер СБКТС"
                value={newRow.sbktsNumber}
                onChange={(e) =>
                  handleNewRowChange("sbktsNumber", e.target.value)
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Комментарий"
                value={newRow.comment}
                onChange={(e) => handleNewRowChange("comment", e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Статус СБКТС в ЭПТС"
                value={newRow.sbktsEptsStatus}
                onChange={(e) =>
                  handleNewRowChange("sbktsEptsStatus", e.target.value)
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Статус ЭПТС"
                value={newRow.eptsStatus}
                onChange={(e) =>
                  handleNewRowChange("eptsStatus", e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: "10px" }}>
              <button onClick={addManualRow} style={primaryButtonStyle}>
                Добавить запись
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              Загрузка...
            </div>
          ) : (
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, ...wNum }}>Нум.</th>
                    <th style={{ ...thStyle, ...wNumber }}>Номер</th>
                    <th style={{ ...thStyle, ...wFio }}>ФИО</th>
                    <th style={{ ...thStyle, ...wType }}>Тип</th>
                    <th style={{ ...thStyle, ...wBrandModel }}>
                      Марка / Модель
                    </th>
                    <th style={{ ...thStyle, ...wColor }}>Цвет</th>
                    <th style={{ ...thStyle, ...wVin }}>VIN код</th>
                    <th style={{ ...thStyle, ...wBroker }}>Брокер</th>
                    <th style={{ ...thStyle, ...wStatus }}>Статус заявки</th>
                    <th style={{ ...thStyle, ...wDate }}>Дата подачи</th>
                    <th style={{ ...thStyle, ...wAppNumber }}>
                      Номер заявки
                    </th>
                    <th style={{ ...thStyle, ...wSpecialist }}>
                      Специалист
                    </th>
                    <th style={{ ...thStyle, ...wSbkts }}>Номер СБКТС</th>
                    <th style={{ ...thStyle, ...wComment }}>Комментарий</th>
                    <th style={{ ...thStyle, ...wSmallStatus }}>
                      Статус СБКТС в ЭПТС
                    </th>
                    <th style={{ ...thStyle, ...wSmallStatus }}>
                      Статус ЭПТС
                    </th>
                    <th style={{ ...thStyle, ...wAction }}>Очист.</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => {
                      const rowColor = getRowStatusColor(row.applicationStatus);

                      return (
                        <TableRow
                          key={row._id}
                          row={row}
                          rowColor={rowColor}
                          brokerOptions={brokerOptions}
                          specialistOptions={specialistOptions}
                          applicationStatusOptions={applicationStatusOptions}
                          savingId={savingId}
                          onChange={handleChange}
                          onBlurSave={handleBlurSave}
                          onSelectChangeAndSave={handleSelectChangeAndSave}
                          onClear={clearJournalFields}
                        />
                      );
                    })
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
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "9px 10px",
  border: "1px solid #c5ccd3",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const tableInputStyle = {
  width: "100%",
  padding: "6px 7px",
  border: "1px solid #cfd6dd",
  borderRadius: "5px",
  fontSize: "12px",
  boxSizing: "border-box",
  background: "#fff",
};

const filterSelectStyle = {
  padding: "9px 10px",
  border: "1px solid #c5ccd3",
  borderRadius: "8px",
  fontSize: "13px",
  background: "#fff",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  border: "1px solid #c5ccd3",
  borderRadius: "8px",
  background: "#fff",
  color: "#333",
  cursor: "pointer",
  fontWeight: "600",
};

const smallAddButtonStyle = {
  minWidth: "42px",
  padding: "0 12px",
  border: "none",
  borderRadius: "8px",
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "18px",
};

const smallRemoveButtonStyle = {
  minWidth: "42px",
  padding: "0 12px",
  border: "none",
  borderRadius: "8px",
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "18px",
};

const smallDeleteButtonStyle = {
  width: "100%",
  padding: "7px 6px",
  border: "none",
  borderRadius: "6px",
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "12px",
};

const tableContainerStyle = {
  width: "100%",
  overflowX: "hidden",
  overflowY: "auto",
  maxHeight: "calc(100vh - 280px)",
  border: "1px solid #c9d1d9",
  background: "#fff",
};

const tableStyle = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: "12px",
};

const thStyle = {
  border: "1px solid #bfc5cc",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: "700",
  fontSize: "11px",
  lineHeight: "1.1",
  whiteSpace: "normal",
  wordBreak: "break-word",
  background: "#e9edf2",
  position: "sticky",
  top: 0,
  zIndex: 5,
};

const tdStyle = {
  border: "1px solid #d6dbe1",
  padding: "4px",
  textAlign: "left",
  verticalAlign: "middle",
};

const emptyStyle = {
  border: "1px solid #d6dbe1",
  padding: "18px",
  textAlign: "center",
  background: "#fff",
};

const wNum = { width: "38px" };
const wNumber = { width: "52px" };
const wFio = { width: "150px" };
const wType = { width: "62px" };
const wBrandModel = { width: "125px" };
const wColor = { width: "60px" };
const wVin = { width: "108px" };
const wBroker = { width: "68px" };
const wStatus = { width: "92px" };
const wDate = { width: "82px" };
const wAppNumber = { width: "78px" };
const wSpecialist = { width: "74px" };
const wSbkts = { width: "125px" };
const wComment = { width: "115px" };
const wSmallStatus = { width: "96px" };
const wAction = { width: "48px" };