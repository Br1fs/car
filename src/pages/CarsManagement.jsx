import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/CarsManagement.css";
import { API_URL } from "../config";

export default function CarsManagement() {
  const [cars, setCars] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/cars`);
        setCars(res.data || []);
      } catch (err) {
        console.error("Ошибка загрузки машин:", err);
        alert("Ошибка загрузки машин");
      }
    };

    fetchCars();
  }, []);

  const filteredCars = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...cars]
      .filter((car) => {
        return (
          String(car.type || "").toLowerCase().includes(q) ||
          String(car.typ || "").toLowerCase().includes(q) ||
          String(car.brand || "").toLowerCase().includes(q) ||
          String(car.model || "").toLowerCase().includes(q) ||
          String(car.category || "").toLowerCase().includes(q) ||
          String(car.volume || car.engineVolume || "").toLowerCase().includes(q) ||
          String(car.year || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const brandCmp = String(a.brand || "").localeCompare(String(b.brand || ""), "ru", {
          sensitivity: "base",
          numeric: true,
        });
        if (brandCmp !== 0) return brandCmp;
        const modelCmp = String(a.model || "").localeCompare(String(b.model || ""), "ru", {
          sensitivity: "base",
          numeric: true,
        });
        if (modelCmp !== 0) return modelCmp;
        return a._id < b._id ? 1 : -1;
      });
  }, [cars, search]);

  const groupedRows = useMemo(() => {
    const rows = [];
    let lastLetter = "";
    filteredCars.forEach((car) => {
      const brand = String(car.brand || "").trim();
      const letter = brand ? brand[0].toUpperCase() : "#";
      if (letter !== lastLetter) {
        rows.push({ rowType: "letter", letter, _id: `letter-${letter}-${rows.length}` });
        lastLetter = letter;
      }
      rows.push({ rowType: "car", car, _id: car._id });
    });
    return rows;
  }, [filteredCars]);

  const visibleIds = filteredCars.map((car) => car._id);

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
      if (!window.confirm("Удалить машину?")) return;

      await axios.delete(`${API_URL}/api/cars/${id}`);

      setCars((prev) => prev.filter((car) => car._id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
      alert("Ошибка удаления");
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (!selectedIds.length) {
        alert("Сначала выберите машины");
        return;
      }

      if (!window.confirm(`Удалить выбранные машины: ${selectedIds.length} шт.?`)) {
        return;
      }

      await axios.post(`${API_URL}/api/cars/bulk-delete`, {
        ids: selectedIds,
      });

      setCars((prev) => prev.filter((car) => !selectedIds.includes(car._id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert("Ошибка массового удаления");
    }
  };

  const handleCopy = (car) => {
    const copiedCar = { ...car };

    delete copiedCar._id;
    delete copiedCar.createdAt;
    delete copiedCar.updatedAt;
    delete copiedCar.__v;

    navigate("/cars/add", {
      state: {
        copiedCar,
      },
    });
  };

  return (
    <div className="cars-page">
      <div className="page-container">
        <h2>База машин</h2>
        <div className="cars-stats">
          <div className="cars-stat-card">
            <div className="label">Всего машин</div>
            <div className="value">{cars.length}</div>
          </div>
          <div className="cars-stat-card">
            <div className="label">Найдено по фильтру</div>
            <div className="value">{filteredCars.length}</div>
          </div>
          <div className="cars-stat-card">
            <div className="label">Выбрано</div>
            <div className="value">{selectedIds.length}</div>
          </div>
        </div>

        <div className="cars-page-actions">
          <button
            className="bulk-delete-btn"
            disabled={!selectedIds.length}
            onClick={handleBulkDelete}
          >
            Удалить выбранные ({selectedIds.length})
          </button>

          <button
            type="button"
            className="add-car-btn"
            onClick={() => navigate("/cars/add")}
          >
            Добавить машину
          </button>
        </div>
      </div>

      <div className="cars-page-header">
        <input
          type="text"
          placeholder="Поиск: тип, марка, модель, объём..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="cars-table">
        <div className="cars-table-header">
          <div className="checkbox-col">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleAllVisible}
            />
          </div>
          <div>№</div>
          <div>Тип автомобиля</div>
          <div>Тип</div>
          <div>Марка</div>
          <div>Модель</div>
          <div>Объём</div>
          <div>Год</div>
          <div className="actions">Действия</div>
        </div>

        {groupedRows.map((entry, index) => {
          if (entry.rowType === "letter") {
            return (
              <div key={entry._id} className="cars-brand-separator">
                <span>{entry.letter}</span>
              </div>
            );
          }
          const car = entry.car;
          const carNumber =
            filteredCars.length -
            groupedRows
              .slice(0, index + 1)
              .filter((item) => item.rowType === "car")
              .length +
            1;
          return (
          <div key={car._id} className="cars-table-row">
            <div className="checkbox-col">
              <input
                type="checkbox"
                checked={selectedIds.includes(car._id)}
                onChange={() => toggleOne(car._id)}
              />
            </div>
            <div>{carNumber}</div>
            <div>{car.type || "-"}</div>
            <div>{car.typ || "-"}</div>
            <div>{car.brand || "-"}</div>
            <div>{car.model || "-"}</div>
            <div>{car.volume || car.engineVolume || "-"}</div>
            <div>{car.year || "-"}</div>

            <div className="actions">
              <button
                type="button"
                className="copy-btn"
                title="Копировать"
                onClick={() => handleCopy(car)}
              >
                📋
              </button>

              <button
                type="button"
                className="open-btn"
                onClick={() => navigate(`/cars/${car._id}`)}
              >
                Открыть
              </button>

              <button
                type="button"
                className="delete-btn"
                onClick={() => handleDelete(car._id)}
              >
                Удалить
              </button>
            </div>
          </div>
          );
        })}

        {!filteredCars.length && (
          <div className="cars-empty">Машин не найдено</div>
        )}
      </div>
    </div>
  );
}