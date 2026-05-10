import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/AddCar.css";
import { API_URL } from "../config";

const characteristics = [
  { label: "Тип автомобиля", key: "type" },
  { label: "Тип", key: "typ" },
  { label: "Марка", key: "brand" },
  { label: "Коммерческое наименование", key: "model" },
  { label: "Поколение: подпись (опционально)", key: "generationLabel" },
  { label: "Поколение: год от", key: "generationYearFrom" },
  { label: "Поколение: год до (можно н.в.)", key: "generationYearTo" },
  { label: "Поколение: шасси / индекс (E39, F10…)", key: "generationChassis" },
  { label: "Поколение: рестайлинг (да / нет)", key: "generationFacelift" },
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

const generationImagePreviewSrc = (raw, apiBase) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${apiBase}${s}`;
  return `${apiBase}/uploads/${s}`;
};

export default function AddCar() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingGenCover, setUploadingGenCover] = useState(false);
  const [genCoverErr, setGenCoverErr] = useState("");

  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

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

  useEffect(() => {
    if (!id && location.state?.copiedCar) {
      setForm(location.state.copiedCar);
    }
  }, [id, location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    let cleanedValue = value;

    if (name === "year") {
      cleanedValue = value.replace(/[^\d]/g, "");
    }

    if (name === "generationYearFrom") {
      cleanedValue = value.replace(/[^\d]/g, "");
    }
    if (name === "generationYearTo") {
      cleanedValue = String(value).slice(0, 40);
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
        generationYearFrom: cleanInt(form.generationYearFrom),
        generationYearTo: String(form.generationYearTo ?? "").trim().slice(0, 40) || null,
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

  const handleGenerationCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setGenCoverErr("");
    setUploadingGenCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API_URL}/api/cars/upload-generation-cover`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const path = res.data?.path;
      if (!path) throw new Error("Нет пути в ответе");
      setForm((prev) => ({ ...prev, generationImage: path }));
    } catch (err) {
      console.error(err);
      setGenCoverErr(err.response?.data?.message || err.message || "Не удалось загрузить");
    } finally {
      setUploadingGenCover(false);
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
          <button
            type="button"
            className="add-car-back-btn"
            onClick={() => navigate("/cars-management")}
          >
            Назад
          </button>
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

              <div className="cars-form-row cars-generation-cover-row">
                <label>Обложка поколения (фото с компьютера)</label>
                <div className="cars-generation-cover-box">
                  {generationImagePreviewSrc(form.generationImage, API_URL) ? (
                    <img
                      src={generationImagePreviewSrc(form.generationImage, API_URL)}
                      alt="Обложка поколения"
                      className="cars-generation-cover-preview"
                    />
                  ) : (
                    <div className="cars-generation-cover-placeholder">Нет фото</div>
                  )}
                  <label className="cars-generation-cover-upload">
                    {uploadingGenCover ? "Загрузка…" : "Выбрать файл"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      disabled={uploadingGenCover}
                      onChange={handleGenerationCoverFile}
                    />
                  </label>
                  {form.generationImage ? (
                    <button
                      type="button"
                      className="cars-generation-cover-remove"
                      onClick={() => setForm((prev) => ({ ...prev, generationImage: "" }))}
                    >
                      Убрать обложку
                    </button>
                  ) : null}
                  {genCoverErr ? <div className="cars-generation-cover-error">{genCoverErr}</div> : null}
                  <p className="cars-generation-cover-hint">
                    JPEG, PNG, GIF или WebP, до 4 МБ. Файл лежит на диске сервера; в базе сохраняется только путь к
                    файлу (не «забивает оперативную память» — растёт место на диске, как у любого каталога с фото).
                  </p>
                </div>
              </div>
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