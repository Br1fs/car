import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/ApplicationView.css";
import { API_URL } from "../config";

export default function ApplicationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => alert("Заявка не найдена"));
  }, [id]);

  const handleChange = (field, value) => {
    setApp((prev) => ({ ...prev, [field]: value }));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      const formDataToSend = new FormData();

      const { _id, createdAt, updatedAt, files, ...safeApp } = app;

      formDataToSend.append(
        "form",
        JSON.stringify({
          ...safeApp,
          status1: safeApp.status1 || "На одобрении",
          status2: safeApp.status2 || "",
        })
      );

      await axios.put(`${API_URL}/api/applications/${id}`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Изменения сохранены");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const deleteApplication = async () => {
    if (!window.confirm("Удалить заявку?")) return;
    try {
      await axios.delete(`${API_URL}/api/applications/${id}`);
      alert("Заявка удалена");
      navigate("/applications");
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении");
    }
  };

  const getStatusClass = (status) => {
    if (!status) return "status-default";

    const s = String(status).toLowerCase();

    if (s.includes("прозвона нет")) return "status-red";
    if (s.includes("прозвонен")) return "status-green";

    if (s.includes("одобр")) return "status-orange";
    if (s.includes("нов")) return "status-red";
    if (s.includes("работ")) return "status-yellow";
    if (s.includes("готов")) return "status-green";

    return "status-default";
  };

  const getStoredFileName = (file) => {
    if (typeof file === "object" && file !== null) {
      return file.filename || "";
    }
    return file || "";
  };

  const getOriginalFileName = (file) => {
    if (typeof file === "object" && file !== null) {
      return file.originalname || file.filename || "Файл";
    }

    if (typeof file !== "string") return "Файл";

    try {
      return decodeURIComponent(file);
    } catch {
      return file;
    }
  };

  const isImageFile = (file) => {
    const name = getOriginalFileName(file).toLowerCase();
    return /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(name);
  };

  const photoEntries = [];
  const documentEntries = [];

  if (app?.files) {
    Object.entries(app.files).forEach(([key, files]) => {
      (files || []).forEach((file) => {
        const lowerKey = String(key).toLowerCase();

        const isPhotoKey =
          lowerKey.includes("photo") ||
          lowerKey.includes("image") ||
          lowerKey.includes("img") ||
          lowerKey.includes("foto") ||
          lowerKey.includes("фото");

        if (isPhotoKey || isImageFile(file)) {
          photoEntries.push({ key, file });
        } else {
          documentEntries.push({ key, file });
        }
      });
    });
  }

  if (!app) return <div className="loading">Загрузка заявки...</div>;

  return (
    <div className="appview-page">
      {saving && <div className="appview-saving-banner">Сохраняем изменения...</div>}

      <div className="appview-header">
        <h2>Заявка № {app._id}</h2>
        <div className="appview-header-buttons">
          <button
            className="appview-btn appview-btn-edit"
            onClick={() => navigate(`/create-application/${id}`)}
          >
            Редактировать
          </button>

          <button
            className="appview-btn appview-btn-delete"
            onClick={deleteApplication}
          >
            Удалить
          </button>
        </div>
      </div>

      <div className="appview-card appview-info-card">
        <p><b>Дата создания:</b> {app.createdAt?.split("T")[0] || "-"}</p>
        <p><b>Номер заявки:</b> {app._id}</p>
        <p>
          <b>Статус №1:</b>{" "}
          <span className={`appview-status ${getStatusClass(app.status1)}`}>
            {app.status1 || "На одобрении"}
          </span>
        </p>

        <p><b>Компания:</b> {app.company || "-"}</p>
        <p><b>Брокер:</b> {app.broker || "-"}</p>
        <p><b>ФИО:</b> {app.fio || "-"}</p>
        <p><b>ИИН:</b> {app.iin || "-"}</p>

        <p>
          <b>Телефон:</b>{" "}
          <input
            type="text"
            value={app.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
        </p>
      </div>

      <div className="appview-divider" />

      <div className="appview-card appview-car-card">
        <h3>Данные машины</h3>

        <div className="appview-car-grid">
          <div><b>Тип:</b> {app.typ || "-"}</div>
          <div><b>Марка:</b> {app.brand || "-"}</div>
          <div><b>Модель:</b> {app.model || "-"}</div>
          <div><b>Год:</b> {app.year || "-"}</div>
          <div><b>Объем:</b> {app.volume || "-"}</div>
        </div>

        <p>
          <b>VIN:</b> {app.vin || "-"}{" "}
          <button
            className="appview-btn appview-btn-secondary"
            onClick={() => alert(`СОС для VIN: ${app.vin}`)}
          >
            УВЭОС (СОС)
          </button>
        </p>
      </div>

      <div className="appview-divider" />

      <div className="appview-card appview-docs-card">
        <h3>Документы</h3>

        {documentEntries.length > 0 ? (
          <ul>
            {documentEntries.map(({ key, file }, idx) => {
              const storedName = getStoredFileName(file);
              const originalName = getOriginalFileName(file);

              return (
                <li key={`${key}-${idx}`}>
                  <a
                    href={`${API_URL}/uploads/${storedName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {key} - {originalName}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Документы отсутствуют</p>
        )}
      </div>

      <div className="appview-divider" />

      <div className="appview-card appview-docs-card">
        <h3>Фотографии</h3>

        {photoEntries.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "14px",
              marginTop: "10px",
            }}
          >
            {photoEntries.map(({ key, file }, idx) => {
              const storedName = getStoredFileName(file);
              const originalName = getOriginalFileName(file);

              return (
                <div
                  key={`photo-${key}-${idx}`}
                  style={{
                    border: "1px solid #d9dee5",
                    borderRadius: "10px",
                    padding: "8px",
                    background: "#fff",
                  }}
                >
                  <a
                    href={`${API_URL}/uploads/${storedName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`${API_URL}/uploads/${storedName}`}
                      alt={originalName}
                      style={{
                        width: "100%",
                        height: "160px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        display: "block",
                      }}
                    />
                  </a>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      wordBreak: "break-word",
                    }}
                  >
                    {key} - {originalName}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>Фотографии отсутствуют</p>
        )}
      </div>

      <div className="appview-divider" />

      <div className="appview-card appview-actions-card">
        <p>
          <b>Whatsapp заявителя:</b>{" "}
          <input
            type="text"
            value={app.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
          />{" "}
          <button
            className="appview-btn appview-btn-success"
            onClick={() => alert(`Сообщение Whatsapp отправлено на номер: ${app.phone}`)}
          >
            Отправить
          </button>
        </p>

        <p>
          <b>Дата создания:</b>{" "}
          <input
            type="date"
            value={app.createdAt?.split("T")[0] || ""}
            onChange={(e) => handleChange("createdAt", e.target.value)}
          />
        </p>

        <p>
          <b>Статус №1:</b>{" "}
          <select
            value={app.status1 || ""}
            className={`appview-status-select ${getStatusClass(app.status1)}`}
            onChange={(e) => handleChange("status1", e.target.value)}
          >
            <option value="">—</option>
            <option>На одобрении</option>
            <option>Новая</option>
            <option>В работе</option>
            <option>Готова</option>
          </select>
        </p>

        <p>
          <b>Статус №2:</b>{" "}
          <select
            value={app.status2 || ""}
            className={`appview-status-select ${getStatusClass(app.status2)}`}
            onChange={(e) => handleChange("status2", e.target.value)}
          >
            <option value="">—</option>
            <option>Прозвона нет</option>
            <option>Прозвонен</option>
          </select>
        </p>
      </div>

      <div className="appview-bottom-bar">
        <button
          className="appview-btn appview-btn-back"
          onClick={() => navigate(-1)}
        >
          Назад
        </button>

        <button
          className="appview-btn appview-btn-save"
          onClick={saveChanges}
          disabled={saving}
        >
          {saving ? "Сохраняем..." : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}