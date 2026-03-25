import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Applications.css";
import formatDateRu from "../utils/formatDateRu";
import { API_URL } from "../config";

export default function Applications() {
  // const [applications, setApplications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const toggleSelectApplication = (id) => {
  setSelectedIds((prev) =>
    prev.includes(id)
      ? prev.filter((i) => i !== id)
      : [...prev, id]
  );
};

const toggleSelectAll = () => {
  if (selectedIds.length === apps.length) {
    setSelectedIds([]);
  } else {
    setSelectedIds(apps.map(a => a._id));
  }
};

const deleteSelected = async () => {
  if (!selectedIds.length) {
    alert("Выберите заявки");
    return;
  }

  try {
    await Promise.all(
      selectedIds.map(id =>
        axios.delete(
          `${API_URL}/api/applications/${id}`
        )
      )
    );

    setApps(prev =>
      prev.filter(a => !selectedIds.includes(a._id))
    );

    setSelectedIds([]);

  } catch (err) {
    console.error(err);
  }
};

  // ===== Статусы и цвета =====
  const getStatusClass = (status) => {
    if (!status) return "status-default";

    const s = status.toLowerCase();

    // Статус №1
    if (s === "на одобрении") return "status-orange";
    if (s === "новая") return "status-red";
    if (s === "в работе") return "status-yellow";
    if (s === "готова" || s === "готово") return "status-green";

    return "status-default";
  };

  // ===== Загрузка заявок =====
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/applications`);

        // новые сверху
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

    fetchApps();
  }, []);

  if (!apps.length && !loading) {
  return <div className="empty">Заявок пока нет</div>;
}

  // ===== Поиск =====
  const filteredApps = apps.filter((app) => {
    const q = search.toLowerCase();
    return (
      app.fio?.toLowerCase().includes(q) ||
      app.vin?.toLowerCase().includes(q) ||
      app.brand?.toLowerCase().includes(q) ||
      app.model?.toLowerCase().includes(q) ||
      app.broker?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="applications-page">
      <div className="page-container"></div>
      <h2>Список заявок</h2>

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
      checked={apps.length > 0 && selectedIds.length === apps.length}
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
        {filteredApps.map((app, index) => (
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

    <div>{filteredApps.length - index}</div>

    <div>{app.protocolNumber || "-"}</div>

    <div>{formatDateRu(app.createdAt)}</div>

    <div className={`status ${getStatusClass(app.status1)}`}>
      {app.status1 || "На одобрении"}
    </div>

    <div className={`status ${getStatusClass(app.status2)}`}>
      {app.status2 || "—"}
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
    </div>
  );
}
