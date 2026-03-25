import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/ProtocolTemplateForm.css";
import ProtocolIdentification from "../components/protocol/ProtocolIdentification";
import TestConditions from "../components/protocol/TestConditions";
import TestEquipment from "../components/protocol/TestEquipment";
import TechnicalResults from "../components/protocol/TechnicalResults";
import ProtocolHeader from "../components/protocol/ProtocolHeader";
import { API_URL } from "../config";

export default function ProtocolTemplateForm({ isNew }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNew) {
      axios
        .get(`${API_URL}/api/protocol-templates/${id}`)
        .then((res) => setTemplate(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      const defaultTemplate = {
        category: "",
        fuelType: "",
        pdfTemplate: "",
        protocolNumber: "",
        protocolDate: "",
        address: "РК, г. Алматы, Турксибский район, мкр. Кайрат, дом 181",
        countryText: `Қазақстан Республикасы
Мемлекеттік техникалық реттеу жүйесі
ЖШС «Ala-test» сынақ зертханасы
2025 жыл «19» желтоқсан
№ KZ.T.02.2997`,
        accreditationText: `Государственная система технического
регулирования Республики Казахстан
Испытательная лаборатория
Аттестат аккредитации
№ KZ.T.02.2997
от «19» декабря 2025 г.`,
        identificationResults: Array.from({ length: 16 }, () => ({
          label: "",
          value: "",
        })),
        testConditions: Array.from({ length: 5 }, (_, i) => ({
          label:
            i === 0
              ? "Температура воздуха"
              : i === 1
              ? "Относительная влажность воздуха"
              : i === 2
              ? "Частота переменного тока"
              : i === 3
              ? "Напряжение сети"
              : "Атмосферное давление",
          value: i === 3 ? Array(8).fill("") : "",
        })),
        testEquipment: Array.from({ length: 14 }, (_, i) => ({
          number: i + 1,
          name: "",
          certificate: "",
        })),
        technicalResults: Array.from({ length: 20 }, () => ({
          parameter: "",
          method: "",
          normValue: "",
          actualValue: "",
        })),
      };

      setTemplate(defaultTemplate);
      setLoading(false);
    }
  }, [id, isNew]);

  const saveTemplate = async () => {
    try {
      if (!template) return;

      const dataToSend = {
        ...template,
        category: template.category,
        fuelType: template.fuelType || "",
        pdfTemplate: template.pdfTemplate || "",
      };

      if (isNew) {
        const res = await axios.post(
          `${API_URL}/api/protocol-templates`,
          dataToSend
        );
        alert("Шаблон создан ✅");
        navigate(`/protocol-templates/${res.data._id}/edit`);
      } else {
        await axios.put(
          `${API_URL}/api/protocol-templates/${id}`,
          dataToSend
        );
        alert("Шаблон сохранён ✅");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении: " + err.message);
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (!template) return <div>Шаблон не найден</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>
        {isNew ? "Создание шаблона" : "Редактирование шаблона"}
      </h2>

      <div className="a4-wrapper">
        <div className="a4-page">
          <ProtocolHeader template={template} />
          <ProtocolIdentification template={template} setTemplate={setTemplate} />
          <TestConditions template={template} setTemplate={setTemplate} />
          <TestEquipment template={template} setTemplate={setTemplate} />
          <TechnicalResults template={template} setTemplate={setTemplate} />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Категория</label>
        <select
          value={template.category || ""}
          onChange={(e) =>
            setTemplate((prev) => ({ ...prev, category: e.target.value }))
          }
        >
          <option value="">Выберите категорию</option>
          {["M1", "M2", "M3", "N1", "N2", "N3", "O1", "O2", "O3", "O4"].map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            )
          )}
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Тип топлива</label>
        <select
          value={template.fuelType || ""}
          onChange={(e) =>
            setTemplate((prev) => ({ ...prev, fuelType: e.target.value }))
          }
        >
          <option value="">Выберите топливо</option>
          <option value="Бензин">Бензин</option>
          <option value="Дизель">Дизель</option>
          <option value="Электрический">Электрический</option>
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>PDF шаблон</label>
        <select
          value={template.pdfTemplate || ""}
          onChange={(e) =>
            setTemplate((prev) => ({ ...prev, pdfTemplate: e.target.value }))
          }
        >
          <option value="">Выберите PDF шаблон</option>
          <option value="m1_benz.pdf">m1_benz.pdf</option>
          <option value="m1_diesel.pdf">m1_diesel.pdf</option>
          <option value="m1_electro.pdf">m1_electro.pdf</option>
        </select>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={saveTemplate} className="save-btn">
          💾 Сохранить
        </button>
      </div>
    </div>
  );
}