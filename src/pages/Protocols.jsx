import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import formatDateRu from "../utils/formatDateRu";
import "../styles/Protocols.css";
import { API_URL } from "../config";

export default function Protocols() {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const cached = sessionStorage.getItem("protocols_cache");

    if (cached) {
      try {
        setProtocols(JSON.parse(cached));
        setLoading(false);
      } catch (e) {
        console.error("Ошибка чтения кэша протоколов:", e);
      }
    }

    const fetchProtocols = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/protocols`);
        setProtocols(res.data);
        sessionStorage.setItem("protocols_cache", JSON.stringify(res.data));
      } catch (err) {
        console.error("Ошибка загрузки протоколов:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProtocols();
  }, []);

  const filteredProtocols = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return protocols;

    return protocols.filter((p) => {
      return (
        String(p.fio || "").toLowerCase().includes(q) ||
        String(p.vin || "").toLowerCase().includes(q) ||
        String(p.brand || "").toLowerCase().includes(q) ||
        String(p.model || "").toLowerCase().includes(q) ||
        String(p.protocolNumber || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.fuelType || "").toLowerCase().includes(q)
      );
    });
  }, [protocols, search]);

  const visibleIds = filteredProtocols.map((p) => p._id);

  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllVisible = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDelete = async (id) => {
    try {
      if (!window.confirm("Удалить протокол?")) return;

      await axios.delete(`${API_URL}/api/protocols/${id}`);

      setProtocols((prev) => {
        const updated = prev.filter((p) => p._id !== id);
        sessionStorage.setItem("protocols_cache", JSON.stringify(updated));
        return updated;
      });

      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении протокола");
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (!selectedIds.length) {
        alert("Сначала выберите протоколы");
        return;
      }

      if (!window.confirm(`Удалить выбранные протоколы: ${selectedIds.length} шт.?`)) {
        return;
      }

      await axios.post(`${API_URL}/api/protocols/bulk-delete`, {
        ids: selectedIds,
      });

      setProtocols((prev) => {
        const updated = prev.filter((p) => !selectedIds.includes(p._id));
        sessionStorage.setItem("protocols_cache", JSON.stringify(updated));
        return updated;
      });

      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert("Ошибка при массовом удалении");
    }
  };

  const handleDownload = (id) => {
    window.open(
      `${API_URL}/api/protocols/${id}/pdf-template`,
      "_blank"
    );
  };

  if (!protocols.length && !loading) {
    return (
      <div className="page-container">
      <div className="protocols-page">
        <div className="protocols-header">
          <h2>Сформированные протоколы</h2>

          <button
            onClick={() => navigate("/protocol-templates")}
            className="protocols-settings-btn"
          >
            Шаблоны протоколов
          </button>
        </div>

        <input
          className="protocols-search"
          type="text"
          placeholder="Поиск: ФИО, VIN, марка, модель, номер протокола..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="protocols-empty">Пока нет сформированных протоколов</div>
      </div>
      </div>
    );
  }

  return (
    <div className={`protocols-page ${loading ? "loading-page" : ""}`}>
      <div className="protocols-header">
        <h2>Сформированные протоколы</h2>

        <div className="protocols-header-actions">
          <button
            onClick={handleBulkDelete}
            className="protocols-bulk-delete-btn"
            disabled={!selectedIds.length}
          >
            Удалить выбранные ({selectedIds.length})
          </button>

          <button
            onClick={() => navigate("/protocol-templates")}
            className="protocols-settings-btn"
          >
            Шаблоны протоколов
          </button>
        </div>
      </div>

      <input
        className="protocols-search"
        type="text"
        placeholder="Поиск: ФИО, VIN, марка, модель, номер протокола..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="protocols-table">
        <div className="protocols-table-header">
          <div className="checkbox-col">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleAllVisible}
            />
          </div>
          <div>№</div>
          <div>Дата</div>
          <div>Номер</div>
          <div>ФИО</div>
          <div className="vin">VIN</div>
          <div>Марка</div>
          <div>Модель</div>
          <div>Тип</div>
          <div>Категория</div>
          <div>Топливо</div>
          <div className="actions">Действия</div>
        </div>

        {filteredProtocols.map((p, index) => (
          <div key={p._id} className="protocols-table-row">
            <div className="checkbox-col">
              <input
                type="checkbox"
                checked={selectedIds.includes(p._id)}
                onChange={() => toggleOne(p._id)}
              />
            </div>
            <div>{filteredProtocols.length - index}</div>
            <div>{formatDateRu(p.createdAt)}</div>
            <div>{p.protocolNumber || "-"}</div>
            <div>{p.fio || "-"}</div>
            <div className="vin">{p.vin || "-"}</div>
            <div>{p.brand || "-"}</div>
            <div>{p.model || "-"}</div>
            <div>{p.typ || "-"}</div>
            <div>{p.category || "-"}</div>
            <div>{p.fuelType || "-"}</div>

            <div className="actions">
              <button
                className="download-btn"
                onClick={() => handleDownload(p._id)}
              >
                Скачать
              </button>

              <button
                className="delete-btn"
                onClick={() => handleDelete(p._id)}
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