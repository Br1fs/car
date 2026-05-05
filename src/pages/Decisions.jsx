import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import formatDateRu from "../utils/formatDateRu";
import "../styles/Decisions.css";
import { API_URL } from "../config";

export default function Decisions() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/decisions`);
        setDecisions(res.data);
      } catch (err) {
        console.error("Ошибка загрузки решений:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDecisions();
  }, []);

  const filteredDecisions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return decisions;

    return decisions.filter((d) => {
      return (
        String(d.decisionNumber || "").toLowerCase().includes(q) ||
        String(d.vin || "").toLowerCase().includes(q) ||
        String(d.brand || "").toLowerCase().includes(q) ||
        String(d.model || "").toLowerCase().includes(q) ||
        String(d.typ || "").toLowerCase().includes(q) ||
        String(d.category || "").toLowerCase().includes(q)
      );
    });
  }, [decisions, search]);

  const handleDelete = async (id) => {
    try {
      if (!window.confirm("Удалить решение?")) return;

      await axios.delete(`${API_URL}/api/decisions/${id}`);
      setDecisions((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении решения");
    }
  };

  const handleDownload = (id) => {
    window.open(`${API_URL}/api/decisions/${id}/pdf-template`, "_blank");
  };

  if (!decisions.length && !loading) {
    return (
      <div className="decisions-page">
        <h2>Сформированные решения</h2>

        <input
          className="decisions-search"
          type="text"
          placeholder="Поиск: номер, VIN, марка, модель..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="decisions-empty">Пока нет сформированных решений</div>
      </div>
    );
  }

  return (
    <div className="decisions-page">
      <div className="decisions-header">
        <h2>Сформированные решения</h2>
      </div>

      <input
        className="decisions-search"
        type="text"
        placeholder="Поиск: номер, VIN, марка, модель..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="decisions-table">
        <div className="decisions-table-header">
          <div>№</div>
          <div>Дата</div>
          <div>Номер</div>
          <div>VIN</div>
          <div>Марка</div>
          <div>Модель</div>
          <div>Год</div>
          <div>Тип</div>
          <div>Категория</div>
          <div className="actions">Действия</div>
        </div>

        {filteredDecisions.map((d, index) => (
          <div key={d._id} className="decisions-table-row">
            <div>{filteredDecisions.length - index}</div>
            <div>{formatDateRu(d.createdAt)}</div>
            <div>{d.decisionNumber || "-"}</div>
            <div>{d.vin || "-"}</div>
            <div>{d.brand || "-"}</div>
            <div>{d.model || "-"}</div>
            <div>{d.year || "-"}</div>
            <div>{d.typ || "-"}</div>
            <div>{d.category || "-"}</div>

            <div className="actions">
              <button
                className="download-btn"
                onClick={() => handleDownload(d._id)}
              >
                Скачать
              </button>

              <button
                className="delete-btn"
                onClick={() => handleDelete(d._id)}
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