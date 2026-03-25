import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/CarsManagement.css";
import { API_URL } from "../config";

export default function CarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== Поля с русскими названиями и точными ключами из БД =====
  const characteristics = [
    { label: "Тип АВТОБИЛЯ", key: "type" },
  { label: "Тип", key: "typ" },
  { label: "Марка", key: "brand" },
  { label: "КОММЕРЧЕСКОЕ НАИМЕНОВАНИЕ", key: "model" },
  { label: "Год выпуска", key: "year" },
  { label: "Объём двигателя", key: "volume" },
  { label: "Категория", key: "category" },
  { label: "Экологический Класс", key: "EcologicalClass" },
  { label: "Заявитель", key: "fio" },
  { label: "Адрес заявителя", key: "iin" },
  { label: "Адрес", key: "address" },
  { label: "Телефон", key: "phone" },
  { label: "ИЗГОТОВИТЕЛЬ", key: "MANUFACTURER" },
  { label: "-юридический адрес ИЗГОТОВИТЕЛЬЯ", key: "legaladdressoftheMANUFACTURER" },
  { label: "-фактический адрес ИЗГОТОВИТЕЛЬЯ", key: "actualaddressoftheMANUFACTURER" },
  { label: "Колесная формула",key: "Wheelarrangement" },
    { label: "ведущие колеса", key: "drivingwheels" },
    { label: "Схема компоновки транспортного средства",key: "Vehiclelayoutdiagram" },
    { label: "Тип кузова / двери", key: "bodyType" },
      { label: "Количество мест спереди/сзади", key: "seats" },
      { label: "Масса транспортного средства в снаряженном состоянии, кг", key: "curbWeight" },
    { label: "Технически допустимая максимальная масса транспортного средства, кг", key: "maxWeight" },
    { label: "Габаритные размеры", key: "overallsize" },
    { label: "Длина", key: "length" },
    { label: "Ширина", key: "width" },
    { label: "Высота", key: "height" },
    { label: "База", key: "base" },
    { label: "Колея передних/задних колес, мм", key: "Wheeltrack" },
    { label: "Описание гибридного транспортного средства", key: "Descriptionhybrid" },
    { label: "Двигатель внутреннего сгорания (марка, тип)", key: "engine" },
    { label: "- количество и расположение цилиндров", key: "cylinders" },
    { label: "- рабочий объем цилиндров, см3", key: "cylinderVolume" },
    { label: "- степень сжатия", key: "compressionratio" },
    { label: "- максимальная мощность, кВт (мин.-1)", key: "power" },
    { label: "Топливо", key: "fuel" },
    { label: "Система питания (тип)", key: "Powersystem" },
    { label: "Система зажигания (тип)", key: "Ignitionsystem" },
    { label: "Система выпуска и нейтрализации отработавших газов", key: "Exhaustsystem" },
    { label: "Электродвигатель электромобиля", key: "electricMotor" },
    { label: "Рабочее напряжение, В", key: "emVoltage" },
    { label: "Макс. мощность 30 мин ЭМ", key: "maxPowerEM" },
    { label: "Устройство накопления энергии ", key: "Energystorage" },
    { label: "Трансмиссия", key: "transmission" },
    { label: "Электромашина (марка, тип)", key: "Electricmachine" },
    { label: "Рабочее напряжение, В (для гибрида)", key: "emVoltage1" },
    { label: "Макс. мощность 30 мин ЭМ (для гибрида)" , key: "maxPowerEM1" },
    { label: "Сцепление", key: "clutch" },
    { label: "Коробка передач (марка, тип)", key: "Transmissionbox" },
    { label: "Подвеска передняя", key: "frontSuspension" },
    { label: "Подвеска задняя", key: "rearSuspension" },
    { label: "Рулевое управление", key: "steering" },
    { label: "Тормозные системы (тип):", key: "brakes" },
    { label: "- рабочая", key: "brakes1" },
    { label: "- запасная", key: "brakes2" },
    { label: "- стояночная", key: "brakes3" },
    { label: "Шины", key: "tires" },
    { label: "Дополнительное оборудование", key: "extraEquipment" }
  ];

  // ===== Загрузка данных машины =====
  useEffect(() => {
    const fetchCar = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/cars/${id}`);
        setForm(res.data);
      } catch (err) {
        console.error(err);
        alert("Ошибка при загрузке машины");
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await axios.put(`http://localhost:5000/api/cars/${id}`, form);
      alert("Изменения сохранены!");
    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Удалить эту машину?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/cars/${id}`);
      alert("Машина удалена!");
      navigate("/cars");
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении");
    }
  };

  if (loading) return <div>Загрузка данных...</div>;
  if (!form) return <div>Машина не найдена</div>;

  return (
    <div className="car-detail-page">
      <h2>Просмотр/Редактирование машины</h2>
      <div className="cars-form">
        {characteristics.map(char => (
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
      <div className="form-buttons">
        <button className="save-button" onClick={handleSave}>
          Сохранить изменения
        </button>
        <button className="delete-button" onClick={handleDelete}>
          Удалить машину
        </button>
      </div>
    </div>
  );
}
