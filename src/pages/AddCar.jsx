import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "../styles/AddCar.css";
import { API_URL } from "../config";

const characteristics = [
  { label: "Тип автомобиля", key: "type" },
  { label: "Тип", key: "typ" },
  { label: "Марка", key: "brand" },
  { label: "Коммерческое наименование", key: "model" },
  { label: "Год выпуска", key: "year" },
  { label: "Объём", key: "volume" },
  { label: "Категория", key: "category" },
  { label: "Экологический класс", key: "EcologicalClass" },

  { label: "Изготовитель", key: "MANUFACTURER" },
  { label: "Юр. адрес изготовителя", key: "legaladdressoftheMANUFACTURER" },
  { label: "Факт. адрес изготовителя", key: "actualaddressoftheMANUFACTURER" },

  { label: "Сборочный завод", key: "ASSEMBLYPLANT" },
  { label: "Адрес сборочного завода", key: "addressoftheassemblyplant" },

  { label: "Колесная формула", key: "Wheelarrangement" },
  { label: "Ведущие колеса", key: "drivingwheels" },
  { label: "Схема компоновки транспортного средства", key: "Vehiclelayoutdiagram" },
  { label: "Тип кузова / количество двери", key: "bodyType" },
  { label: "Количество мест спереди/сзади", key: "seats" },
  { label: "Исполнение загрузочного пространства", key: "loadSpace" },
  { label: "Кабина", key: "cab" },
  { label: "Снаряжённая масса", key: "curbWeight" },
  { label: "Макс. масса", key: "maxWeight" },

  { label: "Длина", key: "length" },
  { label: "Ширина", key: "width" },
  { label: "Высота", key: "height" },
  { label: "База", key: "base" },
  { label: "Колея", key: "Wheeltrack" },

  { label: "Описание гибридного транспортного средства", key: "Descriptionhybrid" },

  { label: "Двигатель внутреннего сгорания (марка, тип)", key: "engine" },
  { label: "- количество и расположение цилиндров", key: "cylinders" },
  { label: "- рабочий объем цилиндров, см3", key: "cylinderVolume" },
  { label: "- степень сжатия", key: "compressionratio" },
  { label: "- максимальная мощность, кВт (мин.-1)", key: "power" },
  { label: "Топливо", key: "fuel" },
  { label: "Система питания", key: "Powersystem" },
  { label: "Система зажигания", key: "Ignitionsystem" },
  { label: "Система выпуска и нейтрализации отработавших газов", key: "Exhaustsystem" },

  { label: "Электродвигатель электромобиля", key: "electricMotor" },
  { label: "Рабочее напряжение, В", key: "emVoltage" },
  { label: "Макс. мощность 30 мин ЭМ", key: "maxPowerEM" },
  { label: "Устройство накопления энергии ", key: "Energystorage" },
  { label: "Трансмиссия", key: "transmission" },

  { label: "Электромашина (марка, тип)", key: "Electricmachine" },
  { label: "Рабочее напряжение, В (для гибрида)", key: "emVoltage1" },
  { label: "Макс. мощность 30 мин ЭМ (для гибрида)", key: "maxPowerEM1" },

  { label: "Сцепление", key: "clutch" },
  { label: "Коробка передач(марка, тип)", key: "Transmissionbox" },

  { label: "Подвеска передняя", key: "frontSuspension" },
  { label: "Подвеска задняя", key: "rearSuspension" },
  { label: "Рулевое управление", key: "steering" },

  { label: "Тормозные системы (тип):", key: "brakes" },
  { label: "- рабочая", key: "brakes1" },
  { label: "- запасная", key: "brakes2" },
  { label: "- стояночная", key: "brakes3" },
  { label: "Шины", key: "tires" },
  { label: "Доп. оборудование", key: "extraEquipment" },
];

export default function AddCar() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  const cleanInt = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const cleaned = String(v).trim().replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : null;
  };

  const cleanFloat = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const cleaned = String(v)
      .trim()
      .replace(",", ".")
      .replace(/[^\d.]/g, "");
    return cleaned ? parseFloat(cleaned) : null;
  };

  useEffect(() => {
    if (!id) return;

    const loadCar = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/cars/${id}`);
        setForm(res.data || {});
      } catch (err) {
        console.error(err);
        alert("Не удалось загрузить машину");
      } finally {
        setLoading(false);
      }
    };

    loadCar();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let cleanedValue = value;

    if (name === "year") {
      cleanedValue = value.replace(/[^\d]/g, "");
    }

    if (name === "volume") {
      cleanedValue = value.replace(",", ".").replace(/[^\d.]/g, "");
    }

    setForm((prev) => ({
      ...prev,
      [name]: cleanedValue,
    }));
  };

  const handleSave = async () => {
    try {
      const preparedForm = {
        ...form,
        year: cleanInt(form.year),
        volume: cleanFloat(form.volume),
      };

      if (id) {
        await axios.put(`${API_URL}/api/cars/${id}`, preparedForm);
        alert("Изменения сохранены");
      } else {
        await axios.post(`${API_URL}/api/cars/add`, preparedForm);
        alert("Машина добавлена");
        setForm({});
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сохранения");
    }
  };

  const handleDelete = async () => {
    try {
      if (!id) return;
      if (!window.confirm("Удалить машину?")) return;

      await axios.delete(`${API_URL}/api/cars/${id}`);
      alert("Машина удалена");
      navigate("/cars-management");
    } catch (err) {
      console.error(err);
      alert("Ошибка удаления");
    }
  };

  return (
    <div className="page-container">
    <div className="add-car-page">
      <div className="add-car-topbar">
        <h2>{id ? "Редактирование машины" : "Добавление новой машины"}</h2>
      </div>

      {loading ? (
        <div className="cars-loading">Загрузка...</div>
      ) : (
        <>
          <div className="cars-form">
            {characteristics.map((char) => (
              <div key={char.key} className="cars-form-row">
                <label>{char.label}</label>
                <input
                  name={char.key}
                  value={form[char.key] || ""}
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>

          <div className="add-car-bottom-bar">
            <button className="save-button" onClick={handleSave}>
              {id ? "Сохранить изменения" : "Добавить машину"}
            </button>

            {id && (
              <button className="delete-bottom-button" onClick={handleDelete}>
                Удалить
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </div>
  );
}