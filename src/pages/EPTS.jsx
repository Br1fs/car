import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const categoryOptions = [
  "L",
  "M1",
  "M1G",
  "M2",
  "M3",
  "N1",
  "N1G",
  "N2",
  "N2G",
  "N3",
  "N3G",
  "01",
  "02",
  "03",
  "04",
];

const monthOptions = [
  { value: "all", label: "Все" },
  { value: "01", label: "Январь" },
  { value: "02", label: "Февраль" },
  { value: "03", label: "Март" },
  { value: "04", label: "Апрель" },
  { value: "05", label: "Май" },
  { value: "06", label: "Июнь" },
  { value: "07", label: "Июль" },
  { value: "08", label: "Август" },
  { value: "09", label: "Сентябрь" },
  { value: "10", label: "Октябрь" },
  { value: "11", label: "Ноябрь" },
  { value: "12", label: "Декабрь" },
];

export default function EPTS() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("all");

  const [newRow, setNewRow] = useState({
    date: "",
    sbktsNumber: "",
    category: "M1",
    brand: "",
    vin: "",
    sbktsStatus: "",
    eptsStatus: "",
  });

  useEffect(() => {
    fetchRows();
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/epts-journal`);
      setRows(res.data || []);
    } catch (error) {
      console.error("Ошибка загрузки журнала:", error);
      alert("Не удалось загрузить журнал");
    } finally {
      setLoading(false);
    }
  };

 const filteredRows = useMemo(() => {
  let result = [...rows];

  if (selectedMonth !== "all") {
    result = result.filter((row) => {
      if (!row.date) return false;
      const parts = row.date.split("-");
      if (parts.length < 2) return false;
      const month = parts[1];
      return month === selectedMonth;
    });
  }

  const q = search.toLowerCase().trim();

  if (!q) return result;

  return result.filter((row) =>
    [
      row.date,
      row.sbktsNumber,
      row.category,
      row.brand,
      row.vin,
      row.sbktsStatus,
      row.eptsStatus,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}, [rows, search, selectedMonth]);

  const handleNewRowChange = (field, value) => {
    setNewRow((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTableChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row._id === id ? { ...row, [field]: value } : row))
    );
  };

  const addRow = async () => {
    if (
      !newRow.date.trim() ||
      !newRow.sbktsNumber.trim() ||
      !newRow.category.trim() ||
      !newRow.brand.trim() ||
      !newRow.vin.trim() ||
      !newRow.sbktsStatus.trim() ||
      !newRow.eptsStatus.trim()
    ) {
      alert("Заполни все поля");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/epts-journal`, newRow);
      setRows((prev) => [res.data, ...prev]);

      setNewRow({
        date: "",
        sbktsNumber: "",
        category: "M1",
        brand: "",
        vin: "",
        sbktsStatus: "",
        eptsStatus: "",
      });
    } catch (error) {
      console.error("Ошибка добавления:", error);
      alert(error.response?.data?.message || "Не удалось добавить запись");
    }
  };

  const saveRow = async (row) => {
    try {
      setSavingId(row._id);
      const res = await axios.put(`${API_URL}/api/epts-journal/${row._id}`, {
        date: row.date,
        sbktsNumber: row.sbktsNumber,
        category: row.category,
        brand: row.brand,
        vin: row.vin,
        sbktsStatus: row.sbktsStatus,
        eptsStatus: row.eptsStatus,
      });

      setRows((prev) =>
        prev.map((item) => (item._id === row._id ? res.data : item))
      );
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      alert(error.response?.data?.message || "Не удалось сохранить изменения");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/epts-journal/${id}`);
      setRows((prev) => prev.filter((row) => row._id !== id));
    } catch (error) {
      console.error("Ошибка удаления:", error);
      alert(error.response?.data?.message || "Не удалось удалить запись");
    }
  };

  const exportToExcel = () => {
    const dataForExcel = rows.map((row, index) => ({
      "№": index + 1,
      "Дата": row.date,
      "Номер СБКТС": row.sbktsNumber,
      "Категория": row.category,
      "Марка": row.brand,
      "VIN": row.vin,
      "Статус СБКТС в реестре": row.sbktsStatus,
      "Статус ЭПТС": row.eptsStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Журнал");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(fileData, "journal_sbkts.xlsx");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: "#f4f6f8",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "1550px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: "16px",
              fontSize: "28px",
              fontWeight: "bold",
            }}
          >
            ЕПТС
          </h1>

          <a
            href="https://pts.gov.kz/login"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#1976d2",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "600",
            }}
          >
            Перейти в ЕПТС
          </a>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Добавить запись</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <input
              type="date"
              value={newRow.date}
              onChange={(e) => handleNewRowChange("date", e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Номер СБКТС"
              value={newRow.sbktsNumber}
              onChange={(e) =>
                handleNewRowChange("sbktsNumber", e.target.value)
              }
              style={inputStyle}
            />

            <select
              value={newRow.category}
              onChange={(e) => handleNewRowChange("category", e.target.value)}
              style={inputStyle}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Марка"
              value={newRow.brand}
              onChange={(e) => handleNewRowChange("brand", e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="VIN"
              value={newRow.vin}
              onChange={(e) => handleNewRowChange("vin", e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Статус СБКТС в реестре"
              value={newRow.sbktsStatus}
              onChange={(e) =>
                handleNewRowChange("sbktsStatus", e.target.value)
              }
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Статус ЭПТС"
              value={newRow.eptsStatus}
              onChange={(e) => handleNewRowChange("eptsStatus", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button onClick={addRow} style={buttonStyle}>
              Добавить
            </button>

            <button
              onClick={exportToExcel}
              style={{
                ...buttonStyle,
                background: "#2e7d32",
              }}
            >
              Скачать Excel
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "20px" }}>Журнал</h2>

            <input
              type="text"
              placeholder="Поиск по журналу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                width: "280px",
                maxWidth: "100%",
              }}
            />
          </div>
<div
  style={{
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "16px",
  }}
>
  {monthOptions.map((month) => (
    <button
      key={month.value}
      onClick={() => setSelectedMonth(month.value)}
      style={{
        padding: "8px 12px",
        border: "1px solid #c5ccd3",
        borderRadius: "8px",
        background: selectedMonth === month.value ? "#1976d2" : "#fff",
        color: selectedMonth === month.value ? "#fff" : "#333",
        cursor: "pointer",
        fontWeight: "600",
      }}
    >
      {month.label}
    </button>
  ))}
</div>
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              Загрузка...
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #c9d1d9",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1500px",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ background: "#e9edf2" }}>
                    <th style={thStyle}>№</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Номер СБКТС</th>
                    <th style={thStyle}>Категория</th>
                    <th style={thStyle}>Марка</th>
                    <th style={thStyle}>VIN</th>
                    <th style={thStyle}>Статус СБКТС в реестре</th>
                    <th style={thStyle}>Статус ЭПТС</th>
                    <th style={thStyle}>Сохранить</th>
                    <th style={thStyle}>Удалить</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, index) => (
                      <tr key={row._id}>
                        <td style={tdStyle}>{index + 1}</td>

                        <td style={tdStyle}>
                          <input
                            type="date"
                            value={row.date || ""}
                            onChange={(e) =>
                              handleTableChange(row._id, "date", e.target.value)
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={row.sbktsNumber || ""}
                            onChange={(e) =>
                              handleTableChange(
                                row._id,
                                "sbktsNumber",
                                e.target.value
                              )
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <select
                            value={row.category || ""}
                            onChange={(e) =>
                              handleTableChange(
                                row._id,
                                "category",
                                e.target.value
                              )
                            }
                            style={tableInputStyle}
                          >
                            {categoryOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={row.brand || ""}
                            onChange={(e) =>
                              handleTableChange(row._id, "brand", e.target.value)
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={row.vin || ""}
                            onChange={(e) =>
                              handleTableChange(row._id, "vin", e.target.value)
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={row.sbktsStatus || ""}
                            onChange={(e) =>
                              handleTableChange(
                                row._id,
                                "sbktsStatus",
                                e.target.value
                              )
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="text"
                            value={row.eptsStatus || ""}
                            onChange={(e) =>
                              handleTableChange(
                                row._id,
                                "eptsStatus",
                                e.target.value
                              )
                            }
                            style={tableInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <button
                            onClick={() => saveRow(row)}
                            disabled={savingId === row._id}
                            style={{
                              ...saveButtonStyle,
                              opacity: savingId === row._id ? 0.6 : 1,
                            }}
                          >
                            {savingId === row._id ? "..." : "Сохранить"}
                          </button>
                        </td>

                        <td style={tdStyle}>
                          <button
                            onClick={() => deleteRow(row._id)}
                            style={deleteButtonStyle}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        style={{
                          border: "1px solid #d6dbe1",
                          padding: "14px",
                          textAlign: "center",
                          background: "#fff",
                        }}
                      >
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid #c5ccd3",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const tableInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cfd6dd",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  background: "#fff",
};

const buttonStyle = {
  padding: "10px 16px",
  border: "none",
  borderRadius: "8px",
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const saveButtonStyle = {
  padding: "8px 12px",
  border: "none",
  borderRadius: "6px",
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const deleteButtonStyle = {
  padding: "8px 12px",
  border: "none",
  borderRadius: "6px",
  background: "#d32f2f",
  color: "#fff",
  cursor: "pointer",
};

const thStyle = {
  border: "1px solid #bfc5cc",
  padding: "10px",
  textAlign: "left",
  fontWeight: "700",
  whiteSpace: "nowrap",
};

const tdStyle = {
  border: "1px solid #d6dbe1",
  padding: "8px",
  textAlign: "left",
  background: "#fff",
  verticalAlign: "middle",
};