import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import formatDateRu from "../utils/formatDateRu";
import "../styles/Dogovors.css";
import { API_URL } from "../config";

export default function Dogovors() {
  const [dogovors, setDogovors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchDogovors = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/dogovors`);
        setDogovors(res.data);
      } catch (err) {
        console.error("Ошибка загрузки договоров:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDogovors();
  }, []);

  const filteredDogovors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dogovors;

    return dogovors.filter((d) =>
      String(d.dogovorNumber || "").toLowerCase().includes(q) ||
      String(d.fio || "").toLowerCase().includes(q) ||
      String(d.address || "").toLowerCase().includes(q) ||
      String(d.iin || "").toLowerCase().includes(q)
    );
  }, [dogovors, search]);

  const handleDelete = async (id) => {
    try {
      if (!window.confirm("Удалить договор?")) return;
      await axios.delete(`${API_URL}/api/dogovors/${id}`);
      setDogovors((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении договора");
    }
  };

  const handleDownload = (id) => {
    window.open(`${API_URL}/api/dogovors/${id}/pdf-template`, "_blank");
  };

  if (!dogovors.length && !loading) {
    return (
      <div className="dogovors-page">
        <h2>Сформированные договоры</h2>
        <input
          className="dogovors-search"
          type="text"
          placeholder="Поиск: номер, ФИО, адрес, ИИН..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="dogovors-empty">Пока нет сформированных договоров</div>
      </div>
    );
  }

  return (
    <div className="dogovors-page">
      <div className="dogovors-header">
        <h2>Сформированные договоры</h2>
      </div>

      <input
        className="dogovors-search"
        type="text"
        placeholder="Поиск: номер, ФИО, адрес, ИИН..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="dogovors-table">
        <div className="dogovors-table-header">
          <div>№</div>
          <div>Дата</div>
          <div>Номер</div>
          <div>ФИО</div>
          <div>Адрес</div>
          <div>ИИН</div>
          <div className="actions">Действия</div>
        </div>

        {filteredDogovors.map((d, index) => (
          <div key={d._id} className="dogovors-table-row">
            <div>{filteredDogovors.length - index}</div>
            <div>{formatDateRu(d.createdAt)}</div>
            <div>{d.dogovorNumber || "-"}</div>
            <div>{d.fio || "-"}</div>
            <div>{d.address || "-"}</div>
            <div>{d.iin || "-"}</div>

            <div className="actions">
              <button className="download-btn" onClick={() => handleDownload(d._id)}>
                Скачать
              </button>
              <button className="delete-btn" onClick={() => handleDelete(d._id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}