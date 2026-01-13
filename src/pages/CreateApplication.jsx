import { useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import { buildCharacteristics } from "../utils/buildCharacteristics";
import "../styles/CreateApplication.css";

export default function CreateApplication() {
  const [form, setForm] = useState({
    ФИО: "",
    ИИН: "",
    Адрес: "",
    Телефон: "",
    email: "",
    VIN: "",
    Марка: "",
    Наименование: "",
    Год: "",
    Объем: "",
    category: "",

    // динамические поля
    seats: "",
    cab: "",
    frame: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const characteristics = useMemo(
    () => buildCharacteristics(form),
    [form]
  );

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ", 20, 20);

    let y = 30;
    characteristics.forEach((item) => {
      doc.setFontSize(10);
      doc.text(`${item.label}: ${item.value || "-"}`, 20, y);
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("zayavka.pdf");
  };

  return (
    <div className="app-form">
      {/* ЛЕВАЯ КОЛОНКА */}
      <div className="left">
        <h2>Исходные данные</h2>

        <input name="ФИО" placeholder="ФИО" onChange={handleChange} />
        <input name="ИИН" placeholder="ИИН" onChange={handleChange} />
        <input name="Адрес" placeholder="Адрес" onChange={handleChange} />
        <input name="Телефон" placeholder="Телефон" onChange={handleChange} />
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="VIN" placeholder="VIN" onChange={handleChange} />
        <input name="Марка" placeholder="Марка" onChange={handleChange} />
        <input name="Наименование" placeholder="Коммерческое наименование" onChange={handleChange} />
        <input name="Год" placeholder="Год выпуска" onChange={handleChange} />
        <input name="Объем" placeholder="Объём двигателя" onChange={handleChange} />

        {/* КАТЕГОРИЯ */}
        <select name="category" value={form.category} onChange={handleChange}>
          <option value="">Категория ТС</option>
          <option value="M1">M1 — легковые</option>
          <option value="M2">M2 — автобусы</option>
          <option value="M3">M3 — автобусы</option>
          <option value="N1">N1 — грузовые</option>
          <option value="L">L — мототехника</option>
          <option value="O">O — прицепы</option>
        </select>

        {/* УСЛОВНЫЕ ПОЛЯ */}
        {form.category === "M1" && (
          <input
            name="seats"
            placeholder="Места спереди / сзади"
            onChange={handleChange}
          />
        )}

        {form.category.startsWith("N") && (
          <input
            name="cab"
            placeholder="Тип кабины"
            onChange={handleChange}
          />
        )}

        {form.category === "L" && (
          <input
            name="frame"
            placeholder="Рама"
            onChange={handleChange}
          />
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА */}
      <div className="right">
        <h2>Сформированные характеристики</h2>

        {characteristics.map((item, index) => (
          <div className="row" key={index}>
            <span>{item.label}</span>
            <strong>{item.value || "-"}</strong>
          </div>
        ))}

        <button onClick={generatePDF}>
          Сформировать и скачать PDF
        </button>
      </div>
    </div>
  );
}
