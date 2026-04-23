import { useState } from "react";

const categories = [
  "Сервис",
  "Диагностика",
  "Кузовные работы",
  "Документация",
  "Прочее",
];

export default function WorkNotes() {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);
  const [newRecordName, setNewRecordName] = useState("");

  const handleTemplateUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTemplates((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        category: selectedCategory,
        fileName: file.name,
      },
      ...prev,
    ]);
    event.target.value = "";
  };

  const createRecord = () => {
    const name = newRecordName.trim();
    if (!name) return;

    setRecords((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        name,
        category: selectedCategory,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNewRecordName("");
  };

  return (
    <div style={{ padding: "18px", maxWidth: "1200px" }}>
      <h2 style={{ marginTop: 0 }}>Рабочая запись</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Категории и шаблоны</h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={inputStyle}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label style={{ display: "block", marginTop: "10px" }}>
            <span style={{ fontSize: "13px", color: "#475569" }}>
              Добавить шаблон (word/pdf/excel)
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleTemplateUpload}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Создать рабочую запись</h3>
          <input
            value={newRecordName}
            onChange={(e) => setNewRecordName(e.target.value)}
            placeholder="Название записи"
            style={inputStyle}
          />
          <button onClick={createRecord} style={buttonStyle}>
            Создать
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Шаблоны</h3>
        {templates.length ? (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {templates.map((tpl) => (
              <li key={tpl.id}>
                [{tpl.category}] {tpl.fileName}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>Пока нет шаблонов.</p>
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: "14px" }}>
        <h3 style={{ marginTop: 0 }}>Список созданных записей</h3>
        {records.length ? (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {records.map((record) => (
              <li key={record.id}>
                {record.name} — {record.category} —{" "}
                {new Date(record.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>Пока нет записей.</p>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #dbe3ef",
  borderRadius: "12px",
  padding: "14px",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  marginTop: "8px",
  boxSizing: "border-box",
};

const buttonStyle = {
  marginTop: "10px",
  padding: "10px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};