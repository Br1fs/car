import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Applications.css";
import formatDateRu from "../utils/formatDateRu";
import { API_URL } from "../config";
import { buildAuthHeaders } from "../utils/authHeaders";

export default function Applications() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ fromDate: "", toDate: "" });
  const navigate = useNavigate();

  const fetchApps = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFilter.fromDate) params.fromDate = dateFilter.fromDate;
      if (dateFilter.toDate) params.toDate = dateFilter.toDate;

      const res = await axios.get(`${API_URL}/api/applications`, { params });
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setApps(sorted);
    } catch (err) {
      console.error("Ошибка загрузки заявок:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [dateFilter.fromDate, dateFilter.toDate]);

  const toggleSelectApplication = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredApps.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredApps.map((a) => a._id));
    }
  };

  const startCopyFromApplication = async (appId) => {
    try {
      const numberRes = await axios.get(`${API_URL}/api/applications/next-protocol-number`);
      const reservedProtocolNumber = String(numberRes.data?.nextProtocolNumber || "");
      navigate("/applications/new", {
        state: {
          copyFromApplicationId: appId,
          reservedProtocolNumber,
        },
      });
    } catch (error) {
      console.error(error);
      alert("Не удалось получить следующий номер протокола");
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      alert("Выберите заявки");
      return;
    }

    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`${API_URL}/api/applications/${id}`))
      );

      setApps((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  // ===== Статусы и цвета =====
  const getStatusClass = (status) => {
    if (!status) return "status-default";

    const s = status.toLowerCase();
    if (s.includes("прозвона нет")) return "status-red";
  if (s.includes("прозвонен")) return "status-green";

    // Статус №1
    if (s === "на одобрении") return "status-orange";
    if (s === "новая") return "status-red";
    if (s === "в работе") return "status-yellow";
    if (s === "готова" || s === "готово") return "status-green";

    return "status-default";
  };

  // ===== Поиск =====
  const filteredApps = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter((app) => {
      return (
        app.fio?.toLowerCase().includes(q) ||
        app.vin?.toLowerCase().includes(q) ||
        app.brand?.toLowerCase().includes(q) ||
        app.model?.toLowerCase().includes(q) ||
        app.broker?.toLowerCase().includes(q) ||
        String(app.protocolNumber || "").toLowerCase().includes(q)
      );
    });
  }, [apps, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const visibleApps = filteredApps.slice(startIndex, startIndex + rowsPerPage);

  const updateStatus = async (appId, field, value) => {
    try {
      const target = apps.find((item) => item._id === appId);
      const payload = {
        status1: field === "status1" ? value : target?.status1 || "",
        status2: field === "status2" ? value : target?.status2 || "",
      };

      const res = await axios.patch(`${API_URL}/api/applications/${appId}/status`, payload, {
        headers: buildAuthHeaders(),
      });

      const updated = res.data;
      setApps((prev) => prev.map((item) => (item._id === appId ? updated : item)));
    } catch (error) {
      console.error(error);
      alert("Не удалось обновить статус");
    }
  };

  if (!apps.length && !loading) {
    return <div className="empty">Заявок пока нет</div>;
  }

  return (
    <div className="applications-page">
      <div className="page-container"></div>
      <h2>Список заявок</h2>

      <div className="applications-toolbar">
        <input
          type="date"
          value={dateFilter.fromDate}
          onChange={(e) =>
            setDateFilter((prev) => ({ ...prev, fromDate: e.target.value }))
          }
          className="applications-filter-date"
        />
        <input
          type="date"
          value={dateFilter.toDate}
          onChange={(e) =>
            setDateFilter((prev) => ({ ...prev, toDate: e.target.value }))
          }
          className="applications-filter-date"
        />
        <button
          className="applications-filter-reset"
          onClick={() => setDateFilter({ fromDate: "", toDate: "" })}
        >
          Сбросить дату
        </button>
      </div>

      <input
        className="applications-search"
        type="text"
        placeholder="Поиск: ФИО, VIN, марка, модель, брокер..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
        <button
          className={`bulk-delete-btn ${selectedIds.length ? "active" : ""}`}
          onClick={deleteSelected}
        >
          Удалить выбранные ({selectedIds.length})
        </button>

      <div className="applications-table">
        {/* ===== HEADER ===== */}
        <div className="table-header">
          <div className="select-col">
    <input
      type="checkbox"
      onClick={(e) => e.stopPropagation()}
      onChange={toggleSelectAll}
      checked={filteredApps.length > 0 && selectedIds.length === filteredApps.length}
    />
  </div>
          <div>№</div>
          <div>№ протокола</div>
          <div>Дата</div>
          <div>Статус №1</div>
          <div>Статус №2</div>
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

        {/* ===== ROWS ===== */}
        {visibleApps.map((app, index) => (
  <div
    key={app._id}
    className="applications-table-row clickable"
    onClick={() => navigate(`/applications/${app._id}`)}
  >
    <div className="select-col">
      <input
        type="checkbox"
        checked={selectedIds.includes(app._id)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          toggleSelectApplication(app._id);
        }}
      />
    </div>

    <div>{filteredApps.length - (startIndex + index)}</div>

    <div>{app.protocolNumber || "-"}</div>

    <div>{formatDateRu(app.createdAt)}</div>

    <div>
      <select
        value={app.status1 || ""}
        className={`status ${getStatusClass(app.status1)}`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateStatus(app._id, "status1", e.target.value)}
      >
        <option value="">—</option>
        <option value="На одобрении">На одобрении</option>
        <option value="Новая">Новая</option>
        <option value="В работе">В работе</option>
        <option value="Выпуск готов">Выпуск готов</option>
        <option value="Стоп">Стоп</option>
      </select>
    </div>

    <div>
      <select
        value={app.status2 || ""}
        className={`status ${getStatusClass(app.status2)}`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateStatus(app._id, "status2", e.target.value)}
      >
        <option value="">—</option>
        <option value="Прозвона нет">Прозвона нет</option>
        <option value="Прозвонен">Прозвонен</option>
        <option value="Ожидает звонка">Ожидает звонка</option>
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
                onClick={(e) => {
                  e.stopPropagation();
                  startCopyFromApplication(app._id);
                }}
              >
                Копировать
              </button>

              <button
                className="danger"
                onClick={async (e) => {
                  e.stopPropagation();

                  if (!window.confirm("Удалить заявку?")) return;

                  try {
                    await axios.delete(
                      `${API_URL}/api/applications/${app._id}`
                    );
                    setApps((prev) =>
                      prev.filter((a) => a._id !== app._id)
                    );
                  } catch (err) {
                    console.error(err);
                    alert("Ошибка при удалении");
                  }
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="applications-pagination">
        <div className="applications-page-size">
          <label>Показывать:</label>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="applications-page-controls">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
          >
            Назад
          </button>
          <span>
            Страница {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}
