import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { buildCharacteristics } from "../utils/buildCharacteristics";
import { loadRoboto } from "../fonts/roboto";
// import { loadTimes } from "../fonts/times";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import formatDateRu from "../utils/formatDateRu";
import { API_URL } from "../config";



import { useParams } from "react-router-dom";
import "../styles/CreateApplication.css";

const isMCategory = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return c.startsWith("m");
};

const isN3Category = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return c.startsWith("n3");
};

const isOCategory = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return (
    c.startsWith("o1") ||
    c.startsWith("o2") ||
    c.startsWith("o3") ||
    c.startsWith("o4")
  );
};

export default function CreateApplication() {
  const [form, setForm] = useState({
    type: "",
    typ: "",
    brand: "",
    model: "",
    year: "",
    volume: "",
    vin: "",
    category: "",
    EcologicalClass: "",
    fio: "",
    iin: "",
    address: "",
    phone: "",
    email: "",
    broker: "",
    MANUFACTURER:"",
    legaladdressoftheMANUFACTURER:"",
    actualaddressoftheMANUFACTURER:"",
    ASSEMBLYPLANT:"",
    addressoftheassemblyplant:"",
    createdAt: "",
    seats: "",
    cab: "",
    frame: "",
    bodyType: "",
    loadSpace: "",
    axles: "",
    curbWeight: "",
    maxWeight: "",
    length: "",
    width: "",
    height: "",
    base: "",
    Wheeltrack: "",
    Descriptionhybrid:"",
    compressionratio:"",
    tires: "",
    chassis: "",
    engine: "",
    cylinderVolume: "",
    cylinders: "",
    power: "",
    fuel: "",
    n3Type: "",
    Ignitionsystem:"",
    Exhaustsystem:"",
    Powersystem:"",
    Energystorage:"",
    Electricmachine:"",
    transmission: "",
    clutch: "",
    frontSuspension: "",
    rearSuspension: "",
    steering: "",
    brakes: "",
    extraEquipment: "",
    electricMotor: "",
    batterySystem: "",
    emVoltage: "",
    emVoltage1:"",
    maxPowerEM: "",
    maxPowerEM1:"",
    Transmissionbox:"",
    brakes1:"",
    brakes2:"",
    brakes3:""
  });

  const [cars, setCars] = useState([]);
  const [files, setFiles] = useState({}); 
  const [filesUploaded, setFilesUploaded] = useState([]); // Для отображения оригинальных имён

// для протоколов 
const [protocolNumber, setProtocolNumber] = useState("");
const [protocolDate, setProtocolDate] = useState("");
const [noiseValue, setNoiseValue] = useState("");
const [gasValue, setGasValue] = useState("");
const [coMin, setCoMin] = useState("");
const [coMax, setCoMax] = useState("");
const [temperature, setTemperature] = useState("");
const [humidity, setHumidity] = useState("");
const [pressure, setPressure] = useState("");
const [smokeValue, setSmokeValue] = useState("");
const [showProtocolModal, setShowProtocolModal] = useState(false);
const effectiveFuelType = isN3Category(form.category) ? "Дизель" : form.fuelType;

const protocolFuel = String(effectiveFuelType || "").trim().toLowerCase();
const isBenzin = protocolFuel === "бензин";
const isDiesel = protocolFuel === "дизель";
const isElectro = protocolFuel === "электро" || protocolFuel === "электрический";
const [showDecisionModal, setShowDecisionModal] = useState(false);
const [decisionNumber, setDecisionNumber] = useState("");
const [decisionDate, setDecisionDate] = useState("");
const [showDogovorModal, setShowDogovorModal] = useState(false);
const [dogovorNumber, setDogovorNumber] = useState("");
const [dogovorDate, setDogovorDate] = useState("");
const [showZayavkaModal, setShowZayavkaModal] = useState(false);
const [zayavkaNumber, setZayavkaNumber] = useState("");
const [zayavkaDate, setZayavkaDate] = useState("");

  const { id } = useParams();

  useEffect(() => {
    const loadCars = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/cars`);
        setCars(res.data);
      } catch (err) {
        console.error("Ошибка загрузки машин:", err);
      }
    };
    loadCars();
  }, []);

  useEffect(() => {
    if (form.type && form.brand && form.model && form.year && form.volume) {
      const selectedCar = cars.find(c =>
        c.type === form.type &&
        c.brand === form.brand &&
        c.model === form.model &&
        Number(c.year) === Number(form.year) &&
        Number(c.volume) === Number(form.volume)
      );

      if (selectedCar) {
        setForm(prev => ({
          ...prev,
          ...selectedCar,
          type: prev.type,
          brand: prev.brand,
          model: prev.model,
          year: prev.year,
          volume: prev.volume
        }));
      }
    }
  }, [form.type, form.brand, form.model, form.year, form.volume, cars]);

  useEffect(() => {
  if (!id) return;

  const formatDate = (date) =>
    date ? new Date(date).toISOString().split("T")[0] : "";

  axios.get(`${API_URL}/api/applications/${id}`)
    .then(res => {
      const data = res.data;

      setForm({
        ...data,
        createdAt: formatDate(data.createdAt),
        protocolDate: formatDate(data.protocolDate),
      });
    })
    .catch(err => {
      console.error(err);
      alert("Заявка не найдена");
    });

}, [id]);
//для заявок
const handleCreateZayavka = async () => {
  try {
    if (!zayavkaNumber) return alert("Введите номер заявки");
    if (!zayavkaDate) return alert("Введите дату заявки");

    const filteredCharacteristics = characteristics.filter(
      (item) => !["fio", "iin", "address", "type"].includes(item.key)
    );

    const zayavkaData = {
      applicationId: id || null,
      zayavkaNumber,
      zayavkaDate,
      brand: form.brand || "",
      model: form.model || "",
      vin: form.vin || "",
      year: form.year || "",
      typ: form.typ || "",
      category: form.category || "",
      manufacturer: form.MANUFACTURER || "",
      fio: form.fio || "",
      address: form.address || "",
      iin: form.iin || "",
      characteristics: filteredCharacteristics.map((item) => ({
        key: item.key || "",
        label: item.label || "",
        value: form[item.key] || item.value || "",
      })),
    };

    const res = await axios.post(`${API_URL}/api/zayavki/create`,
      zayavkaData
    );

    const zayavkaId = res.data._id;

    alert("Заявка сформирована");

    window.open(
      `${API_URL}/api/zayavki/${zayavkaId}/pdf`,
      "_blank"
    );

    setShowZayavkaModal(false);
  } catch (err) {
    console.error(err);
    alert("Ошибка создания заявки");
  }
};
//для договора
const handleCreateDogovor = async () => {
  try {
    if (!dogovorNumber) return alert("Введите номер");
    if (!dogovorDate) return alert("Введите дату");

    const dogovorData = {
      applicationId: id || null,
      dogovorNumber,
      dogovorDate,
      fio: form.fio || "",
      address: form.address || "",
      iin: form.iin || "",
    };

    const res = await axios.post(
      `${API_URL}/api/dogovors/create`,
      dogovorData
    );

    const dogovorId = res.data._id;

    alert("Договор создан");

    window.open(
      `${API_URL}/api/dogovors/${dogovorId}/pdf-template`,
      "_blank"
    );

    setShowDogovorModal(false);
  } catch (err) {
    console.error(err);
    alert("Ошибка создания договора");
  }
};

const handleCreateDecision = async () => {
  try {
    if (!decisionNumber) return alert("Введите номер решения");
    if (!decisionDate) return alert("Введите дату решения");

    const decisionData = {
      applicationId: id || null,
      decisionNumber,
      decisionDate,
      brand: form.brand || "",
      model: form.model || "",
      vin: form.vin || "",
      year: form.year || "",
      typ: form.typ || "",
      category: form.category || "",
    };

    const res = await axios.post(
      `${API_URL}/api/decisions/create`,
      decisionData
    );

    const decisionId = res.data._id;

    alert("Решение создано");

    window.open(
      `${API_URL}/api/decisions/${decisionId}/pdf-template`,
      "_blank"
    );

    setShowDecisionModal(false);
  } catch (err) {
    console.error(err);
    alert("Ошибка создания решения");
  }
};
// protocol

  

const handleCreateProtocol = async () => {
  try {
    const finalFuelType = isN3Category(form.category) ? "Дизель" : form.fuelType;

    if (!form.category) return alert("Выберите категорию");

    if (!isOCategory(form.category) && !finalFuelType) {
      return alert("Выберите тип топлива");
    }

    if (isN3Category(form.category) && !form.n3Type) {
      return alert("Выберите тип N3: седельный или грузовой");
    }

    if (!protocolNumber) return alert("Введите номер");
    if (!protocolDate) return alert("Введите дату");

    let weather = { temp: "", humidity: "", pressure: "" };

    try {
      const w = await axios.get(`${API_URL}/api/weather`, {
        params: { city: "Almaty", date: protocolDate }
      });

      weather = {
        temp: String(w.data.temp ?? ""),
        humidity: String(w.data.humidity ?? ""),
        pressure: String(w.data.pressure ?? "")
      };
    } catch (e) {
      console.warn("Weather API fail, fallback to manual");
    }

    const protocolData = {
      applicationId: id || null,

      category: form.category,
      fuelType: finalFuelType,
      n3Type: String(form.n3Type || "").trim().toLowerCase(),

      protocolNumber,
      protocolDate,

      brand: form.brand || "",
      model: form.model || "",
      typ: form.typ || "",
      vin: form.vin || "",
      EcologicalClass: form.EcologicalClass || "",
      year: form.year || "",
      fio: form.fio || "",

      MANUFACTURER: form.MANUFACTURER || "",
      legaladdressoftheMANUFACTURER: form.legaladdressoftheMANUFACTURER || "",
      ASSEMBLYPLANT: form.ASSEMBLYPLANT || "",
      addressoftheassemblyplant: form.addressoftheassemblyplant || "",

      address: form.address || "",
      extraEquipment: form.extraEquipment || "",
      length: form.length || "",
      width: form.width ?? form.Width ?? "",
      height: form.height ?? form.Height ?? "",

      coMin: coMin || "",
      coMax: coMax || "",
      noiseValue: noiseValue || "",
      smokeValue: smokeValue || "",

      temperature: String(temperature ?? "").trim() || weather.temp,
      humidity: String(humidity ?? "").trim() || weather.humidity,
      pressure: String(pressure ?? "").trim() || weather.pressure,
    };

    const res = await axios.post(
      `${API_URL}/api/protocols/create`,
      protocolData
    );

    const protocolId = res.data._id;
    alert("Протокол создан!");

    window.open(
      `${API_URL}/api/protocols/${protocolId}/pdf-template`,
      "_blank"
    );

    setShowProtocolModal(false);
  } catch (err) {
    console.error(err);
    alert("Ошибка создания протокола");
  }
};

  const characteristics = useMemo(() => buildCharacteristics(form), [form]);

  const handleChange = (e) => {
  const { name, value } = e.target;

  setForm((prev) => {
    const next = {
      ...prev,
      [name]: value,
    };

    if (name === "category") {
      if (isN3Category(value)) {
        next.fuelType = "Дизель";
        next.n3Type = "";
      } else if (isOCategory(value)) {
        next.fuelType = "";
        next.n3Type = "";
        next.EcologicalClass = "";
      } else if (isMCategory(value)) {
        next.fuelType = "";
        next.n3Type = "";
      } else {
        next.fuelType = "";
        next.n3Type = "";
      }
    }

    if (name === "fuelType" && isN3Category(prev.category)) {
      next.fuelType = "Дизель";
    }

    return next;
  });
};

  const handleFileChange = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    setFiles(prev => ({ ...prev, [key]: file }));
    setFilesUploaded(prev => [
      ...prev,
      { key, savedName: file.name, originalName: file.name }
    ]);
  };

  const sendToWhatsapp = async () => {
    if (!form.phone) return alert("Укажите телефон!");

    const message = characteristics.map(c => `${c.label}: ${form[c.key] || "-"}`).join("\n");

    try {
      await axios.post(`${API_URL}/api/send-whatsapp`, {
        phone: form.phone,
        message
      });
      alert("Сообщение отправлено!");
    } catch (err) {
      console.error(err);
      alert("Ошибка отправки в WhatsApp");
    }
  };

  const saveApplication = async () => {
  try {
    if (!id) {
      return await createNewApplication();
    }

    const formDataToSend = new FormData();
    const { _id, createdAt, updatedAt, ...safeForm } = form;

    formDataToSend.append(
      "form",
      JSON.stringify({
        
        ...safeForm,
        protocolNumber: protocolNumber || "",
        characteristics: buildCharacteristics(safeForm),
        status1: safeForm.status1 || "На одобрении",
        status2: safeForm.status2 || ""
      })
    );

    Object.entries(files).forEach(([key, file]) => {
      if (file) formDataToSend.append(key, file);
    });
console.log("SAVE TO APPLICATION:", {
  ...safeForm,
  protocolNumber,
  protocolDate,
  protocolId,
});
    await axios.put(
      `${API_URL}/api/applications/${id}`,
      formDataToSend,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    alert("Изменения сохранены");
  } catch (err) {
    console.error(err.response?.data || err);
    alert("Ошибка сохранения: " + (err.response?.data?.message || err.message));
  }
};
const createNewApplication = async () => {
  try {
    const formDataToSend = new FormData();
    const { _id, createdAt, updatedAt, ...safeForm } = form;

    formDataToSend.append(
      "form",
      JSON.stringify({
        ...safeForm,
        characteristics: buildCharacteristics(safeForm),
        status1: safeForm.status1 || "На одобрении",
        status2: safeForm.status2 || ""
      })
    );

    Object.entries(files).forEach(([key, file]) => {
      if (file) formDataToSend.append(key, file);
    });

    const res = await axios.post(
      `${API_URL}/api/applications/save`,
      formDataToSend,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    alert("Новая заявка создана");

    const newId = res.data?._id;
    if (newId) {
      navigate(`/applications/${newId}`);
    }
  } catch (err) {
    console.error(err.response?.data || err);
    alert("Ошибка создания: " + (err.response?.data?.message || err.message));
  }
};

// для заявки
const generateApplicationPdf = async () => {
  try {
    const doc = new jsPDF("p", "mm", "a4");

    await loadRoboto(doc);
    doc.setFont("Roboto", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 15;
    const right = 15;
    const contentWidth = pageWidth - left - right;

    let y = 15;

    const applicationNumber = id ? String(id).slice(-6) : "-";
    const applicationDate = form.createdAt || new Date().toISOString().split("T")[0];

    // ===== Заголовок =====
    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.text(`ЗАЯВКА № ${applicationNumber}`, pageWidth / 2, y, {
      align: "center",
    });

    y += 7;

    doc.setFont("Roboto", "normal");
    doc.setFontSize(11);
    doc.text(formatDateRu(applicationDate), pageWidth / 2, y, {
      align: "center",
    });

    y += 10;

    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.text(
      "На проведение работ по оценке соответствия транспортного средства",
      left,
      y
    );
    y += 6;
    doc.text(
      "требованиям ТР ТС 018/2011 в форме СБКТС",
      left,
      y
    );

    y += 10;

    // ===== Верхний блок с данными =====
    const topRows = [
      ["Модель автомобиля", form.model || "-"],
      ["Идентификационный номер (VIN)", form.vin || "-"],
      ["Название изготовителя", form.MANUFACTURER || "-"],
      ["Ф.И.О. заявителя", form.fio || "-"],
      ["Адрес заявителя", form.address || "-"],
      ["ИИН", form.iin || "-"],
    ];

    autoTable(doc, {
      startY: y,
      theme: "grid",
      body: topRows,
      styles: {
        font: "Roboto",
        fontSize: 10,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: {
        0: { cellWidth: 68, fontStyle: "bold" },
        1: { cellWidth: contentWidth - 68 },
      },
      margin: { left, right },
    });

    y = doc.lastAutoTable.finalY + 8;

    // ===== Заголовок характеристик =====
    doc.setFont("Roboto", "bold");
    doc.setFontSize(13);
    doc.text(
      "ОБЩИЕ ХАРАКТЕРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА",
      pageWidth / 2,
      y,
      { align: "center" }
    );

    y += 6;

    // ===== Убираем из таблицы верхние поля =====
    const filteredCharacteristics = characteristics.filter(
      (item) => !["fio", "iin", "address"].includes(item.key)
    );

    const tableData = filteredCharacteristics.map((item) => [
      item.label || "",
      String(form[item.key] || item.value || "-"),
    ]);

    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Параметр", "Значение"]],
      body: tableData,
      showHead: "firstPage",
      rowPageBreak: "avoid",
      styles: {
        font: "Roboto",
        fontSize: 10,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        font: "Roboto",
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 100 },
      },
      margin: { top: 20, left, right, bottom: 15 },
    });

    doc.save(`zayavka_${form.vin || "no_vin"}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Ошибка генерации заявки");
  }
};
// для макета
const generatePDF = async () => {
  try {
    const doc = new jsPDF("p", "mm", "a4");

    await loadRoboto(doc);
    doc.setFont("Roboto", "normal");

    doc.setFontSize(16);
    doc.text("ОБЩИЕ ХАРАКТЕРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА", 105, 15, {
      align: "center",
    });

    const tableData = characteristics.map((item) => [
      item.label || "",
      String(form[item.key] || "-"),
    ]);

    autoTable(doc, {
      startY: 25,
      theme: "grid",
      head: [["Параметр", "Значение"]],
      body: tableData,

      showHead: "firstPage",     // шапка только на первой странице
      rowPageBreak: "avoid",     // не рвать одну строку на две страницы

      styles: {
        font: "Roboto",
        fontSize: 10,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        overflow: "linebreak",
        valign: "top",
      },

      headStyles: {
        font: "Roboto",
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
      },

      bodyStyles: {
        font: "Roboto",
        textColor: [0, 0, 0],
        valign: "top",
      },

      columnStyles: {
        0: { cellWidth: 80 },   // параметр
        1: { cellWidth: 100 },  // значение
      },

      margin: { top: 20, left: 15, right: 15, bottom: 15 },
    });

    doc.save(`${form.fio || "application"}_${form.vin || "no_vin"}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Ошибка PDF — смотри console");
  }
};
const navigate = useNavigate();

  return (
    <div className="app-form">
      <div className="left">
        <h2>Исходные данные</h2>
        <input name="fio" placeholder="ФИО" value={form.fio} onChange={handleChange} />
        <input name="iin" placeholder="ИИН" value={form.iin} onChange={handleChange} />
        <input name="address" placeholder="Адрес" value={form.address} onChange={handleChange} />
        <div style={{ display: "flex", alignItems: "center" }}>
          <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleChange} />
          <button className="whatsapp-btn" onClick={sendToWhatsapp}>Отправить WhatsApp</button>
        </div>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input name="vin" placeholder="VIN" value={form.vin} onChange={handleChange} />

        <select name="status1" value={form.status1 || ""} onChange={handleChange}>
          <option value="">Статус №1</option>
          <option value="На одобрении">На одобрении</option>
          <option value="Одобрено">Одобрено</option>
          <option value="Отклонено">Отклонено</option>
        </select>

        <select name="status2" value={form.status2 || ""} onChange={handleChange}>
          <option value="">Статус №2</option>
          <option value="В работе">В работе</option>
          <option value="Готово">Готово</option>
        </select>

        <input name="broker" placeholder="Брокер" value={form.broker} onChange={handleChange} />
        <input name="createdAt" type="date" value={form.createdAt} onChange={handleChange} />

        <select name="type" value={form.type} onChange={handleChange}>
          <option value="">Выберите тип автомобиля</option>
          {[...new Set(cars.map(c=>c.type))].map((t,i)=><option key={i} value={t}>{t}</option>)}
        </select>

        <select name="brand" value={form.brand} onChange={handleChange}>
          <option value="">Выберите марку</option>
          {[...new Set(cars.filter(c=>c.type===form.type).map(c=>c.brand))].map((b,i)=><option key={i} value={b}>{b}</option>)}
        </select>

        <select name="model" value={form.model} onChange={handleChange}>
          <option value="">Выберите модель</option>
          {[...new Set(cars.filter(c=>c.type===form.type && c.brand===form.brand).map(c=>c.model))].map((m,i)=><option key={i} value={m}>{m}</option>)}
        </select>

        <select name="year" value={form.year} onChange={handleChange}>
          <option value="">Выберите год</option>
          {[...new Set(cars.filter(c=>c.type===form.type && c.brand===form.brand && c.model===form.model).map(c=>c.year))].map((y,i)=><option key={i} value={y}>{y}</option>)}
        </select>

        <select name="volume" value={form.volume} onChange={handleChange}>
          <option value="">Выберите объём</option>
          {[...new Set(cars.filter(c=>c.type===form.type && c.brand===form.brand && c.model===form.model && c.year===Number(form.year)).map(c=>c.volume))].map((v,i)=><option key={i} value={v}>{v}</option>)}
        </select>

        <h3>Документы</h3>
        {["удостоверение","о владении ТС","тех описание","АКТ","Прочее","Прочее","Прочее","Прочее"].map((label,i)=>(
          <div key={i}>
            <label>{label}:</label>
            <input type="file" onChange={e=>handleFileChange(e,label)} />
          </div>
        ))}

        {filesUploaded.map(file => (
          <div key={file.savedName}>
            {file.originalName} {/* показываем оригинальное имя */}
          </div>
        ))}

        {/* <button onClick={saveApplication} className="save-btn">Создать заявку</button> */}
      </div>

      <div className="right">
        <h2>ОБЩИЕ ХАРАКТИРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА</h2>
        <div className="characteristics-table full-width-table">
  {characteristics.map((item, index) => (
    <div className="table-row" key={index}>
      <div className="table-cell label">{item.label}</div>
      <div className="table-cell value">
        <textarea
          value={item.value || ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, [item.key]: e.target.value }))
          }
          rows={2}
        />
      </div>
    </div>
  ))}
  
</div>
<button className="back-btn" onClick={() => navigate(-1)}>
  Назад
</button>

        <div className="pdf-buttons">
          <button className="pdf-btn" onClick={createNewApplication}>
    Создать заявку
  </button>
      
          <button className="pdf-btn" onClick={generatePDF}>
  Сформировать МАКЕТ
</button>

          <button
  className="pdf-btn"
  onClick={() => setShowProtocolModal(true)}
>
  Сформировать ПРОТОКОЛ
</button>

{showProtocolModal && (
  <div className="modal-overlay">
    <div className="modal">

      <h3>Создание протокола</h3>

<div className="form-group">
  <label>Категория</label>
  <select
    name="category"
    value={form.category}
    onChange={handleChange}
  >
    <option value="">Выберите категорию</option>
    <option value="M1">M1</option>
    <option value="N3">N3</option>
    <option value="O1">O1</option>
    <option value="O2">O2</option>
    <option value="O3">O3</option>
    <option value="O4">O4</option>
  </select>
</div>

{isMCategory(form.category) && !isN3Category(form.category) && (
  <div className="form-group">
    <label>Тип топлива</label>
    <select
      name="fuelType"
      value={form.fuelType}
      onChange={handleChange}
    >
      <option value="">Выберите топливо</option>
      <option value="Бензин">Бензин</option>
      <option value="Дизель">Дизель</option>
      <option value="Электро">Электро</option>
    </select>
  </div>
)}

{isN3Category(form.category) && (
  <>
    <div className="form-group">
      <label>Тип топлива</label>
      <select
        name="fuelType"
        value="Дизель"
        onChange={handleChange}
        disabled
      >
        <option value="Дизель">Дизель</option>
      </select>
    </div>

    <div className="form-group">
      <label>Тип N3</label>
      <select
        name="n3Type"
        value={form.n3Type}
        onChange={handleChange}
      >
        <option value="">Выберите тип</option>
        <option value="sedelnyi">Седельный</option>
        <option value="gruzovoi">Грузовой</option>
      </select>
    </div>
  </>
)}

{!isOCategory(form.category) && (
  <div className="form-group">
    <label>Экологический класс</label>
    <input
      type="text"
      name="EcologicalClass"
      value={form.EcologicalClass}
      onChange={handleChange}
    />
  </div>
)}

<label>Номер протокола</label>
<input
  value={protocolNumber}
  onChange={e => setProtocolNumber(e.target.value)}
/>

<label>Дата протокола</label>
<input
  type="date"
  value={protocolDate}
  onChange={e => setProtocolDate(e.target.value)}
/>

{isBenzin && (
  <>
    <label>CO (min)</label>
    <input value={coMin} onChange={e => setCoMin(e.target.value)} />

    <label>CO (max)</label>
    <input value={coMax} onChange={e => setCoMax(e.target.value)} />

    <label>Шум</label>
    <input value={noiseValue} onChange={e => setNoiseValue(e.target.value)} />
  </>
)}

{isDiesel && (
  <>
    <label>Дым</label>
    <input value={smokeValue} onChange={e => setSmokeValue(e.target.value)} />

    <label>Шум</label>
    <input value={noiseValue} onChange={e => setNoiseValue(e.target.value)} />
  </>
)}

<label>Температура (°C)</label>
<input
  value={temperature}
  onChange={e => setTemperature(e.target.value)}
/>

<label>Влажность (%)</label>
<input
  value={humidity}
  onChange={e => setHumidity(e.target.value)}
/>

<label>Давление (мм рт. ст.)</label>
<input
  value={pressure}
  onChange={e => setPressure(e.target.value)}
/>

<button className="btn btn-gray"
  type="button"
  onClick={async () => {
    try {
      const res = await axios.get(`${API_URL}/api/weather`, {
        params: { city: "Almaty", date: protocolDate }
      });

      setTemperature(res.data.temp || "");
      setHumidity(res.data.humidity || "");
      setPressure(res.data.pressure || "");
    } catch (e) {
      alert("Не удалось получить погоду");
    }
  }}
>
  Подтянуть из интернета
</button>

<div style={{ marginTop: 20 }}>
  <button className="btn btn-blue" onClick={handleCreateProtocol}>
    Создать
  </button>
  

        <button className="btn btn-red" onClick={() => setShowProtocolModal(false)}>
          Отмена
        </button>
      </div>

    </div>
  </div>
)}


          <button
  className="pdf-btn"
  onClick={() => setShowZayavkaModal(true)}
>
  Сформировать заявку
</button>
{showZayavkaModal && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Создание заявки</h3>

      <label>Номер заявки</label>
      <input
        value={zayavkaNumber}
        onChange={(e) => setZayavkaNumber(e.target.value)}
      />

      <label>Дата заявки</label>
      <input
        type="date"
        value={zayavkaDate}
        onChange={(e) => setZayavkaDate(e.target.value)}
      />

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-blue" onClick={handleCreateZayavka}>
          Создать
        </button>

        <button
          className="btn btn-red"
          onClick={() => setShowZayavkaModal(false)}
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
)}
          <button
  className="pdf-btn"
  onClick={() => setShowDecisionModal(true)}
>
  Сформировать решение
</button>
{showDecisionModal && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Создание решения</h3>

      <label>Номер решения</label>
      <input
        value={decisionNumber}
        onChange={(e) => setDecisionNumber(e.target.value)}
      />

      <label>Дата решения</label>
      <input
        type="date"
        value={decisionDate}
        onChange={(e) => setDecisionDate(e.target.value)}
      />

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-blue" onClick={handleCreateDecision}>
          Создать
        </button>

        <button
          className="btn btn-red"
          onClick={() => setShowDecisionModal(false)}
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
)}
<button
  className="pdf-btn"
  onClick={() => setShowDogovorModal(true)}
>
  Сформировать договор
</button>
{showDogovorModal && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Создание договора</h3>

      <label>Номер договора</label>
      <input
        value={dogovorNumber}
        onChange={(e) => setDogovorNumber(e.target.value)}
      />

      <label>Дата договора</label>
      <input
        type="date"
        value={dogovorDate}
        onChange={(e) => setDogovorDate(e.target.value)}
      />

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-blue" onClick={handleCreateDogovor}>
          Создать
        </button>

        <button
          className="btn btn-red"
          onClick={() => setShowDogovorModal(false)}
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
)}
          <button className="pdf-btn">Сформировать тех запись</button>
          {id && (
    <button className="pdf-btn" onClick={saveApplication}>
      Сохранить изменения
    </button>
  )}
        </div>

        
      </div>
    </div>
  );
}
