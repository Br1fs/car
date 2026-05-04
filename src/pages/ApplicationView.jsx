import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/ApplicationView.css";
import { API_URL } from "../config";

export default function ApplicationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
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
          sourcePage: "Просмотр заявки",
          status1: safeApp.status1 || "На одобрении",
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
      await axios.delete(`${API_URL}/api/applications/${id}`, {
        data: {
          actorName: user?.login || user?.name || "unknown",
          sourcePage: "Просмотр заявки",
        },
      });
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

    if (s.includes("прозвон")) return "status-red";
    if (s.includes("ждет фото")) return "status-yellow";
    if (s.includes("одобр")) return "status-white";
    if (s.includes("на одобрении")) return "status-white";
    if (s.includes("выполня")) return "status-yellow";
    if (s.includes("выпущ")) return "status-green";
    if (s.includes("стоп")) return "status-red";

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
          <div className="appview-photo-grid">
            {photoEntries.map(({ key, file }, idx) => {
              const storedName = getStoredFileName(file);
              const originalName = getOriginalFileName(file);

              return (
                <div key={`photo-${key}-${idx}`} className="appview-photo-item">
                  <a
                    href={`${API_URL}/uploads/${storedName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`${API_URL}/uploads/${storedName}`}
                      alt={originalName}
                      className="appview-photo-preview"
                    />
                  </a>

                  <div className="appview-photo-name">
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
          <b>Статус:</b>{" "}
          <select
            value={app.status1 || ""}
            className={`appview-status-select ${getStatusClass(app.status1)}`}
            onChange={(e) => handleChange("status1", e.target.value)}
          >
            <option value="">—</option>
            <option>На одобрении</option>
            <option>Одобрено</option>
            <option>Выполняется</option>
            <option>Ждем прозвона</option>
            <option>Прозвон есть</option>
            <option>Ждем фото</option>
            <option>Фото есть</option>
            <option>Выпущено</option>
            <option>Стоп</option>
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