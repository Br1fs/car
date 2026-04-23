import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/Settings.css";
import { API_URL } from "../config";
import { buildAuthHeaders } from "../utils/authHeaders";

const roleOptions = ["user", "admin"];
const statusOptions = ["pending", "approved", "rejected"];

export default function Settings() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({});
  const currentUserId = useMemo(
    () => currentUser?.id || currentUser?._id || "",
    [currentUser]
  );

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users`, {
        headers: buildAuthHeaders(),
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "admin") {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, []);

  const startEdit = (item) => {
    setEditingId(item._id);
    setDraft({
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      login: item.login || "",
      email: item.email || "",
      position: item.position || "",
      role: item.role || "user",
      status: item.status || "pending",
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setDraft({});
  };

  const saveUser = async (id) => {
    try {
      const payload = {
        firstName: draft.firstName,
        lastName: draft.lastName,
        login: draft.login,
        email: draft.email,
        position: draft.position,
        role: draft.role,
        status: draft.status,
      };

      if (draft.password?.trim()) {
        payload.password = draft.password.trim();
      }

      await axios.patch(`${API_URL}/api/admin/users/${id}`, payload, {
        headers: buildAuthHeaders(),
      });

      if (currentUserId === id) {
        const nextLocal = {
          ...currentUser,
          firstName: payload.firstName,
          lastName: payload.lastName,
          login: payload.login,
          email: payload.email,
          position: payload.position,
          role: payload.role,
          status: payload.status,
        };
        localStorage.setItem("user", JSON.stringify(nextLocal));
      }

      setMessage("Пользователь обновлен");
      cancelEdit();
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка обновления пользователя");
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/admin/users/${id}`, {
        headers: buildAuthHeaders(),
      });
      setMessage("Пользователь удален");
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-card">
          <div className="settings-message">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="settings-page">
        <div className="settings-card settings-closed">
          <h1 className="settings-title">Настройки</h1>
          <div className="settings-message">Доступ закрыт</div>
        </div>
      </div>
    );
  }

  if (currentUser.role !== "admin") {
    return (
      <div className="settings-page">
        <div className="settings-card settings-user-card">
          <h1 className="settings-title">Настройки</h1>
          <div className="settings-user-info">
            <div>
              <strong>Имя:</strong> {currentUser.firstName || "-"}
            </div>
            <div>
              <strong>Фамилия:</strong> {currentUser.lastName || "-"}
            </div>
            <div>
              <strong>Логин:</strong> {currentUser.login}
            </div>
            <div>
              <strong>Email:</strong> {currentUser.email || "-"}
            </div>
            <div>
              <strong>Должность:</strong> {currentUser.position || "-"}
            </div>
            <div>
              <strong>Роль:</strong> {currentUser.role}
            </div>
            <div>
              <strong>Статус:</strong> {currentUser.status}
            </div>
          </div>
          <div className="settings-message">Редактирование доступно только администратору</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h1 className="settings-title">Настройки</h1>
        <h2 className="settings-subtitle">Пользователи и права доступа</h2>

        {message && <p className="settings-top-message">{message}</p>}

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Имя / Фамилия</th>
                <th>Логин / Email</th>
                <th>Должность</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Пароль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => {
                const isEditing = editingId === item._id;
                const isSelf = currentUserId === item._id;

                return (
                  <tr key={item._id}>
                    <td>
                      {isEditing ? (
                        <div className="settings-inline-grid">
                          <input
                            className="settings-inline-input"
                            value={draft.firstName || ""}
                            placeholder="Имя"
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, firstName: e.target.value }))
                            }
                          />
                          <input
                            className="settings-inline-input"
                            value={draft.lastName || ""}
                            placeholder="Фамилия"
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, lastName: e.target.value }))
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          {`${item.firstName || "-"} ${item.lastName || "-"}`.trim()}
                        </div>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <div className="settings-inline-grid">
                          <input
                            className="settings-inline-input"
                            value={draft.login || ""}
                            placeholder="Логин"
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, login: e.target.value }))
                            }
                          />
                          <input
                            className="settings-inline-input"
                            value={draft.email || ""}
                            placeholder="Email"
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, email: e.target.value }))
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          <div>{item.login || "-"}</div>
                          <div className="settings-muted">{item.email || "-"}</div>
                        </div>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          className="settings-inline-input"
                          value={draft.position || ""}
                          placeholder="Должность"
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, position: e.target.value }))
                          }
                        />
                      ) : (
                        item.position || "-"
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select
                          className="settings-inline-input"
                          value={draft.role || "user"}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, role: e.target.value }))
                          }
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.role
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select
                          className="settings-inline-input"
                          value={draft.status || "pending"}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, status: e.target.value }))
                          }
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.status
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          className="settings-inline-input"
                          type="password"
                          value={draft.password || ""}
                          placeholder="Новый пароль (опц.)"
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, password: e.target.value }))
                          }
                        />
                      ) : (
                        <span className="settings-muted">••••••</span>
                      )}
                    </td>

                    <td>
                      <div className="settings-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="settings-btn approve"
                              onClick={() => saveUser(item._id)}
                            >
                              Сохранить
                            </button>
                            <button className="settings-btn reject" onClick={cancelEdit}>
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="settings-btn approve"
                              onClick={() => startEdit(item)}
                            >
                              Изменить
                            </button>
                            {!isSelf && (
                              <button
                                className="settings-btn delete"
                                onClick={() => deleteUser(item._id)}
                              >
                                Удалить
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}