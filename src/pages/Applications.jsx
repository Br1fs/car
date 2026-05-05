import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/Applications.css";
import formatDateRu from "../utils/formatDateRu";
import { buildCharacteristics } from "../utils/buildCharacteristics";
import { loadRoboto } from "../fonts/roboto";
import { API_URL } from "../config";

const statusOptions = [
  "На одобрении",
  "Одобрено",
  "Выполняется",
  "Ждем прозвона",
  "Прозвон есть",
  "Ждем фото",
  "Фото есть",
  "Выпущено",
  "Стоп",
];

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const navigate = useNavigate();

  const getStatusClass = (status) => {
    if (!status) return "status-default";

    const s = status.toLowerCase();

    if (s.includes("ждет прозвона") || s.includes("ждем прозвона") || s.includes("прозвона нет")) return "status-purple";
    if (s.includes("ждет фото") || s.includes("ждем фото")) return "status-pink";
    if (s.includes("одобр")) return "status-white";
    if (s.includes("выполня")) return "status-yellow";
    if (s.includes("выпущ")) return "status-green";
    if (s.includes("стоп")) return "status-red";
    if (s.includes("на одобрении")) return "status-white";

    return "status-default";
  };

  // =========================
  // LOAD DATA
  // =========================
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/applications`);

        const sorted = [...res.data].sort((a, b) => {
          const aManual = a?.source === "journal_manual" ? 1 : 0;
          const bManual = b?.source === "journal_manual" ? 1 : 0;
          if (aManual !== bManual) return bManual - aManual;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        setApps(sorted);
      } catch (err) {
        console.error("Ошибка загрузки заявок:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = apps.filter((app) => {
      return (
        app.fio?.toLowerCase().includes(q) ||
        app.vin?.toLowerCase().includes(q) ||
        app.brand?.toLowerCase().includes(q) ||
        app.model?.toLowerCase().includes(q) ||
        app.broker?.toLowerCase().includes(q) ||
        String(app.protocolNumber || "").includes(q)
      );
    });

    return result;
  }, [apps, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / pageSize));
  const pagedApps = filteredApps.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateStatus = async (id, nextStatus) => {
    try {
      setUpdatingStatusId(id);
      setApps((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status1: nextStatus } : item))
      );
      const res = await axios.patch(`${API_URL}/api/applications/${id}/status`, {
        status1: nextStatus,
        actorName: user?.login || user?.name || "unknown",
        sourcePage: "Список заявок",
        specialist: "",
      });
      setApps((prev) => prev.map((item) => (item._id === id ? { ...item, ...res.data } : item)));
    } catch (err) {
      console.error("Ошибка обновления статуса:", err);
      alert("Не удалось обновить статус");
    } finally {
      setUpdatingStatusId("");
    }
  };

  const handleGenerateMaket = async (applicationId) => {
    try {
      const appRes = await axios.get(`${API_URL}/api/applications/${applicationId}`);
      const appFull = appRes.data || {};
      const characteristics = buildCharacteristics(appFull);

      const doc = new jsPDF("p", "mm", "a4");
      await loadRoboto(doc);
      doc.setFont("Roboto", "normal");
      doc.setFontSize(16);
      doc.text("ОБЩИЕ ХАРАКТИРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА", 105, 15, {
        align: "center",
      });

      const tableData = characteristics.map((item) => [
        item.label || "",
        String(appFull[item.key] || item.value || "-"),
      ]);

      autoTable(doc, {
        startY: 25,
        theme: "grid",
        head: [["Параметр", "Значение"]],
        body: tableData,
        showHead: "firstPage",
        rowPageBreak: "avoid",
        styles: {
          font: "Roboto",
          fontSize: 10,
          cellPadding: 4,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          overflow: "linebreak",
          valign: "top",
          minCellHeight: 8,
        },
        headStyles: {
          font: "Roboto",
          fontStyle: "bold",
          fillColor: [220, 235, 255],
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 72 },
          1: { cellWidth: 108 },
        },
        margin: { top: 20, left: 15, right: 15, bottom: 15 },
      });

      doc.save(`${appFull.fio || "application"}_${appFull.vin || "no_vin"}.pdf`);
    } catch (error) {
      console.error("GENERATE MAKET ERROR:", error);
      alert("Не удалось сформировать макет");
    }
  };

  if (!apps.length && !loading) {
    return <div className="empty">Заявок пока нет</div>;
  }

  return (
    <div className="applications-page">

      <h2>Список заявок</h2>

      <div className="applications-toolbar">
        <input
          className="applications-search"
          type="text"
          placeholder="Поиск: ФИО, VIN, № протокола, марка, модель..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      <div className="applications-table">

        {/* HEADER */}
        <div className="table-header">
          <div>№</div>
          <div>№ протокола</div>
          <div>Дата</div>
          <div>Статус</div>
          <div>ФИО</div>
          <div className="vin">VIN</div>
          <div>Тип</div>
          <div>Марка</div>
          <div>Модель</div>
          <div>Год</div>
          <div>Объём</div>
          <div>Брокер</div>
          <div className="actions">Действия</div>
        </div>

        {/* ROWS */}
        {pagedApps.map((app, index) => (
          <div
            key={app._id}
            className="applications-table-row clickable"
            onClick={() => navigate(`/applications/${app._id}`)}
          >

            <div>{(currentPage - 1) * pageSize + index + 1}</div>
            <div>{app.protocolNumber || "-"}</div>
            <div>{formatDateRu(app.createdAt)}</div>

            <div className={`status ${getStatusClass(app.status1)}`} onClick={(e) => e.stopPropagation()}>
              <select
                value={app.status1 || "На одобрении"}
                disabled={updatingStatusId === app._id}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => updateStatus(app._id, e.target.value)}
                className="status-select"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>{app.fio || "-"}</div>
            <div className="vin">{app.vin || "-"}</div>
            <div>{app.typ || "-"}</div>
            <div>{app.brand || "-"}</div>
            <div>{app.model || "-"}</div>
            <div>{app.year || "-"}</div>
            <div>{app.volume || "-"}</div>
            <div>{app.broker || "-"}</div>

            <div className="actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/applications/new", {
                    state: { copiedData: app },
                  });
                }}
              >
                Копировать
              </button>

              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleGenerateMaket(app._id);
                }}
              >
                Скачать макет
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/applications/${app._id}`);
                }}
              >
                Открыть
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/create-application/${app._id}`);
                }}
              >
                Редактировать
              </button>

              <button
                className="danger"
                onClick={async (e) => {
                  e.stopPropagation();

                  if (!window.confirm("Удалить заявку?")) return;

                  await axios.delete(
                    `${API_URL}/api/applications/${app._id}`,
                    {
                      data: {
                        actorName: user?.login || user?.name || "unknown",
                        sourcePage: "Список заявок",
                      },
                    }
                  );

                  setApps((prev) =>
                    prev.filter((a) => a._id !== app._id)
                  );
                }}
              >
                Удалить
              </button>

            </div>
          </div>
        ))}

      </div>

      <div className="applications-pagination">
        <div className="applications-pagination-info">
          <span>Показывать</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {filteredApps.length === 0
              ? "0"
              : `${(currentPage - 1) * pageSize + 1}-${Math.min(
                  currentPage * pageSize,
                  filteredApps.length
                )} из ${filteredApps.length}`}
          </span>
        </div>

        <div className="applications-pagination-controls">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Назад
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}