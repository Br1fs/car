import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { API_URL } from "../config";

const actionLabels = {
  create_application: "Создание заявки",
  update_application: "Изменение заявки",
  specialist_change: "Смена специалиста",
  status_change: "Смена статуса",
  create_declaration: "Создание АКТ",
  create_work_note: "Создание рабочей записи",
};

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function getActionText(row) {
  const base = actionLabels[row.action] || row.action || "Действие";
  if (row.action === "status_change") {
    const from = row.details?.from || "—";
    const to = row.details?.to || "—";
    return `${base} - ${from} -> ${to}`;
  }
  if (row.action === "create_application") {
    return `${base} - создать заявку`;
  }
  if (row.action === "create_declaration") {
    return `${base} - сформировать АКТ`;
  }
  if (row.action === "create_work_note") {
    return `${base} - сформировать рабочую запись`;
  }
  if (row.action === "specialist_change") {
    const from = String(row.details?.fromSpecialist || "").trim();
    const to = String(row.details?.toSpecialist || "").trim();
    if (!from && to) return `${base} - ${to}`;
    if (from && to) return `${base} - ${from} -> ${to}`;
    return base;
  }
  return base;
}

function getObjectLabel(row) {
  const fromLabel = String(row.targetLabel || "").trim();
  if (fromLabel) return fromLabel;
  const fio = String(row.details?.fio || "").trim();
  const vin = String(row.details?.vin || "").trim();
  if (fio || vin) return `${fio}${fio && vin ? " | " : ""}${vin}`;
  return "—";
}

function getDetailsText(row) {
  const page = row.details?.page ? `Страница: ${row.details.page}` : "";
  const protocol = row.details?.protocolNumber ? `Протокол: ${row.details.protocolNumber}` : "";
  const list = [page, protocol].filter(Boolean);
  return list.join(" | ") || "—";
}

function getSpecialist(row) {
  const specialist = String(row.details?.specialist || "").trim();
  return specialist || "—";
}

function getTimeInterval(row) {
  const start = formatDateTime(row.startedAt || row.createdAt);
  const hasDuration = Number.isFinite(Number(row.durationMinutes));
  const finish = hasDuration ? formatDateTime(row.finishedAt || row.createdAt) : "—";
  return `${start} -> ${finish}`;
}

export default function ActivityLogs() {
  const token = localStorage.getItem("token");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actorName, setActorName] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/admin/activity-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          actorName: actorName.trim(),
          action,
          dateFrom,
          dateTo,
          limit: 500,
        },
      });
      const rawRows = Array.isArray(res.data) ? res.data : [];
      const seen = new Set();
      const dedupedRows = rawRows.filter((row) => {
        const key = [
          row.actorName || "",
          row.action || "",
          row.targetType || "",
          row.targetId || "",
          row.targetLabel || "",
          row.startedAt || row.createdAt || "",
          row.finishedAt || "",
          Number.isFinite(Number(row.durationMinutes)) ? Number(row.durationMinutes) : "",
          row.details?.from || "",
          row.details?.to || "",
          row.details?.page || "",
          row.details?.specialist || "",
        ].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setRows(dedupedRows);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Не удалось загрузить журнал действий");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const actionOptions = useMemo(() => {
    const fromRows = Array.from(new Set(rows.map((item) => item.action).filter(Boolean)));
    return fromRows.sort();
  }, [rows]);

  const metrics = useMemo(() => {
    const byActor = new Map();
    let createCount = 0;
    let statusFinishCount = 0;
    let statusFinishDuration = 0;
    let photoDoneCount = 0;
    let photoDoneDuration = 0;
    let callDoneCount = 0;
    let callDoneDuration = 0;

    rows.forEach((row) => {
      const actor = row.actorName || "unknown";
      byActor.set(actor, (byActor.get(actor) || 0) + 1);

      if (row.action === "create_application") {
        createCount += 1;
      }

      if (row.action === "status_change" && Number.isFinite(Number(row.durationMinutes))) {
        const toStatus = String(row.details?.to || "").toLowerCase();
        if (toStatus.includes("выпущ")) {
          statusFinishCount += 1;
          statusFinishDuration += Number(row.durationMinutes);
        }
        if (toStatus.includes("фото есть")) {
          photoDoneCount += 1;
          photoDoneDuration += Number(row.durationMinutes);
        }
        if (toStatus.includes("прозвон есть")) {
          callDoneCount += 1;
          callDoneDuration += Number(row.durationMinutes);
        }
      }
    });

    const topActorEntry = [...byActor.entries()].sort((a, b) => b[1] - a[1])[0];
    const avgExecutionMinutes =
      statusFinishCount > 0 ? Math.round((statusFinishDuration / statusFinishCount) * 10) / 10 : 0;
    const avgPhotoMinutes =
      photoDoneCount > 0 ? Math.round((photoDoneDuration / photoDoneCount) * 10) / 10 : 0;
    const avgCallMinutes =
      callDoneCount > 0 ? Math.round((callDoneDuration / callDoneCount) * 10) / 10 : 0;

    return {
      total: rows.length,
      createdApplications: createCount,
      completedExecutions: statusFinishCount,
      avgExecutionMinutes,
      avgPhotoMinutes,
      avgCallMinutes,
      topActorName: topActorEntry?.[0] || "-",
      topActorCount: topActorEntry?.[1] || 0,
    };
  }, [rows]);

  const perUserKpi = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const userName = String(row.actorName || "unknown").trim() || "unknown";
      const item = map.get(userName) || {
        userName,
        createdCount: 0,
        createdDurationSum: 0,
        createdDurationCount: 0,
        issuedCount: 0,
        issuedDurationSum: 0,
        issuedDurationCount: 0,
        photoDoneDurationSum: 0,
        photoDoneDurationCount: 0,
        callDoneDurationSum: 0,
        callDoneDurationCount: 0,
      };

      if (row.action === "create_application") {
        item.createdCount += 1;
        const duration = Number(row.durationMinutes);
        if (Number.isFinite(duration)) {
          item.createdDurationSum += duration;
          item.createdDurationCount += 1;
        }
      }

      if (row.action === "status_change") {
        const toStatus = String(row.details?.to || "").toLowerCase();
        const duration = Number(row.durationMinutes);
        if (toStatus.includes("выпущ")) {
          item.issuedCount += 1;
          if (Number.isFinite(duration)) {
            item.issuedDurationSum += duration;
            item.issuedDurationCount += 1;
          }
        }
        if (toStatus.includes("фото есть") && Number.isFinite(duration)) {
          item.photoDoneDurationSum += duration;
          item.photoDoneDurationCount += 1;
        }
        if (toStatus.includes("прозвон есть") && Number.isFinite(duration)) {
          item.callDoneDurationSum += duration;
          item.callDoneDurationCount += 1;
        }
      }

      map.set(userName, item);
    });

    return [...map.values()]
      .map((item) => ({
        ...item,
        createdAvgMinutes:
          item.createdDurationCount > 0
            ? Math.round((item.createdDurationSum / item.createdDurationCount) * 10) / 10
            : 0,
        issuedAvgMinutes:
          item.issuedDurationCount > 0
            ? Math.round((item.issuedDurationSum / item.issuedDurationCount) * 10) / 10
            : 0,
        photoDoneAvgMinutes:
          item.photoDoneDurationCount > 0
            ? Math.round((item.photoDoneDurationSum / item.photoDoneDurationCount) * 10) / 10
            : 0,
        callDoneAvgMinutes:
          item.callDoneDurationCount > 0
            ? Math.round((item.callDoneDurationSum / item.callDoneDurationCount) * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.createdCount + b.issuedCount - (a.createdCount + a.issuedCount));
  }, [rows]);

  const kpiExtremes = useMemo(() => {
    const getExtremes = (field) => {
      const values = perUserKpi
        .map((item) => Number(item[field]))
        .filter((value) => Number.isFinite(value) && value > 0);
      if (!values.length) return { min: null, max: null };
      return {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    };

    return {
      createdAvgMinutes: getExtremes("createdAvgMinutes"),
      issuedAvgMinutes: getExtremes("issuedAvgMinutes"),
      photoDoneAvgMinutes: getExtremes("photoDoneAvgMinutes"),
      callDoneAvgMinutes: getExtremes("callDoneAvgMinutes"),
    };
  }, [perUserKpi]);

  const getKpiCellStyle = (field, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return { padding: "9px 12px", borderBottom: "1px solid #f1f5f9" };
    }

    const extremes = kpiExtremes[field];
    if (!extremes || extremes.min === null || extremes.max === null) {
      return { padding: "9px 12px", borderBottom: "1px solid #f1f5f9" };
    }

    let background = "transparent";
    let color = "#0f172a";
    let fontWeight = 400;

    if (numeric === extremes.min) {
      background = "#dcfce7";
      color = "#166534";
      fontWeight = 700;
    } else if (numeric === extremes.max) {
      background = "#fee2e2";
      color = "#991b1b";
      fontWeight = 700;
    }

    return {
      padding: "9px 12px",
      borderBottom: "1px solid #f1f5f9",
      background,
      color,
      fontWeight,
    };
  };

  const clearLogs = async () => {
    if (!window.confirm("Очистить весь журнал действий?")) return;
    try {
      try {
        await axios.delete(`${API_URL}/api/admin/activity-logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (firstError) {
        if (firstError?.response?.status !== 404) throw firstError;
        await axios.post(
          `${API_URL}/api/admin/activity-logs/clear`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setRows([]);
      alert("Журнал действий очищен");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Не удалось очистить журнал действий");
    }
  };

  const exportToExcel = () => {
    const data = rows.map((row) => ({
      "Время (старт)": formatDateTime(row.startedAt || row.createdAt),
      "Время (конец)": Number.isFinite(Number(row.durationMinutes))
        ? formatDateTime(row.finishedAt || row.createdAt)
        : "",
      "Пользователь": row.actorName || "",
      "Специалист": getSpecialist(row),
      "Действие": getActionText(row),
      "Объект": getObjectLabel(row),
      "Длительность (мин)": row.durationMinutes ?? "",
      "Детали": getDetailsText(row),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Logs");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `activity-logs-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div style={{ padding: "10px 18px 24px" }}>
      <h2 style={{ marginTop: 0 }}>Журнал действий пользователей</h2>

      <div style={{ marginTop: 12, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10 }}>
        <div style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #eef2f7" }}>
          KPI по пользователям
        </div>
        {perUserKpi.length === 0 ? (
          <div style={{ padding: 16, color: "#64748b" }}>Нет данных для KPI</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Пользователь",
                    "Создано заявок",
                    "Выпущено",
                    "Среднее создание (мин)",
                    "Среднее выпуск (мин)",
                    "Среднее Ждем фото -> Фото есть (мин)",
                    "Среднее Ждем прозвона -> Прозвон есть (мин)",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perUserKpi.map((item) => (
                  <tr key={item.userName}>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {item.userName}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {item.createdCount}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {item.issuedCount}
                    </td>
                    <td style={getKpiCellStyle("createdAvgMinutes", item.createdAvgMinutes)}>
                      {item.createdAvgMinutes}
                    </td>
                    <td style={getKpiCellStyle("issuedAvgMinutes", item.issuedAvgMinutes)}>
                      {item.issuedAvgMinutes}
                    </td>
                    <td style={getKpiCellStyle("photoDoneAvgMinutes", item.photoDoneAvgMinutes)}>
                      {item.photoDoneAvgMinutes}
                    </td>
                    <td style={getKpiCellStyle("callDoneAvgMinutes", item.callDoneAvgMinutes)}>
                      {item.callDoneAvgMinutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <MetricCard label="Всего действий" value={metrics.total} />
        <MetricCard label="Создано заявок" value={metrics.createdApplications} />
        <MetricCard label="Завершено (Выпущено)" value={metrics.completedExecutions} />
        <MetricCard label="Среднее время выполнения (мин)" value={metrics.avgExecutionMinutes} />
        <MetricCard label="Среднее Ждет фото -> Фото есть (мин)" value={metrics.avgPhotoMinutes} />
        <MetricCard label="Среднее Ждет прозвона -> Прозвон есть (мин)" value={metrics.avgCallMinutes} />
        <MetricCard
          label="Самый активный пользователь"
          value={`${metrics.topActorName} (${metrics.topActorCount})`}
        />
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 8,
          boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <input
          placeholder="Имя пользователя"
          value={actorName}
          onChange={(e) => setActorName(e.target.value)}
        />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Все действия</option>
          {actionOptions.map((item) => (
            <option key={item} value={item}>
              {actionLabels[item] || item}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button onClick={loadLogs}>Применить</button>
        <button onClick={exportToExcel}>Экспорт Excel</button>
        <button onClick={clearLogs}>Очистить журнал</button>
        <button
          onClick={() => {
            setActorName("");
            setAction("");
            setDateFrom("");
            setDateTo("");
            setTimeout(loadLogs, 0);
          }}
        >
          Сбросить
        </button>
      </div>

      <div style={{ marginTop: 12, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10 }}>
        {loading ? (
          <div style={{ padding: 16 }}>Загрузка...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16, color: "#64748b" }}>Записей пока нет</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Время", "Пользователь", "Специалист", "Действие", "Объект", "Длительность (мин)", "Где сделано"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {getTimeInterval(row)}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>{row.actorName || "-"}</td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>{getSpecialist(row)}</td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {getActionText(row)}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {getObjectLabel(row)}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {row.durationMinutes ?? "-"}
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {getDetailsText(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #dbe3ee", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}
