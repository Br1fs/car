import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import formatDateRu from "../utils/formatDateRu";
import "../styles/Zayavki.css";
import { API_URL } from "../config";

export default function Zayavki() {
  const [zayavki, setZayavki] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const fetchZayavki = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/zayavki");
        setZayavki(res.data);
      } catch (err) {
        console.error("Ошибка загрузки заявок:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchZayavki();
  }, []);

  const filteredZayavki = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zayavki;

    return zayavki.filter((z) =>
      String(z.zayavkaNumber || "").toLowerCase().includes(q) ||
      String(z.fio || "").toLowerCase().includes(q) ||
      String(z.vin || "").toLowerCase().includes(q) ||
      String(z.brand || "").toLowerCase().includes(q) ||
      String(z.model || "").toLowerCase().includes(q)
    );
  }, [zayavki, search]);

  const visibleIds = filteredZayavki.map((z) => z._id);
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
      if (!window.confirm("Удалить сформированную заявку?")) return;

      await axios.delete(`http://localhost:5000/api/zayavki/${id}`);
      setZayavki((prev) => prev.filter((z) => z._id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении");
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (!selectedIds.length) {
        alert("Сначала выберите заявки");
        return;
      }

      if (!window.confirm(`Удалить выбранные заявки: ${selectedIds.length} шт.?`)) {
        return;
      }

      await axios.post(`${API_URL}/api/zayavki/bulk-delete`, {
        ids: selectedIds,
      });

      setZayavki((prev) => prev.filter((z) => !selectedIds.includes(z._id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert("Ошибка при массовом удалении");
    }
  };

  const handleDownload = (id) => {
    window.open(`http://localhost:5000/api/zayavki/${id}/pdf`, "_blank");
  };

  if (!zayavki.length && !loading) {
    return (
      <div className="zayavki-page">
        <h2>Сформированные заявки</h2>

        <input
          className="zayavki-search"
          type="text"
          placeholder="Поиск: номер, ФИО, VIN, марка, модель..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="zayavki-empty">Пока нет сформированных заявок</div>
      </div>
    );
  }

  return (
    <div className="zayavki-page">
      <div className="zayavki-header">
        <h2>Сформированные заявки</h2>

        <button
          onClick={handleBulkDelete}
          className={`zayavki-bulk-delete-btn ${selectedIds.length ? "active" : ""}`}
          disabled={!selectedIds.length}
        >
          Удалить выбранные ({selectedIds.length})
        </button>
      </div>

      <input
        className="zayavki-search"
        type="text"
        placeholder="Поиск: номер, ФИО, VIN, марка, модель..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="zayavki-table">
        <div className="zayavki-table-header">
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
          <div className="actions">Действия</div>
        </div>

        {filteredZayavki.map((z, index) => (
          <div key={z._id} className="zayavki-table-row">
            <div className="checkbox-col">
              <input
                type="checkbox"
                checked={selectedIds.includes(z._id)}
                onChange={() => toggleOne(z._id)}
              />
            </div>
            <div>{filteredZayavki.length - index}</div>
            <div>{formatDateRu(z.createdAt)}</div>
            <div>{z.zayavkaNumber || "-"}</div>
            <div>{z.fio || "-"}</div>
            <div className="vin">{z.vin || "-"}</div>
            <div>{z.brand || "-"}</div>
            <div>{z.model || "-"}</div>

            <div className="actions">
              <button className="download-btn" onClick={() => handleDownload(z._id)}>
                Скачать
              </button>
              <button className="delete-btn" onClick={() => handleDelete(z._id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}