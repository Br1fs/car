import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "../styles/Settings.css";
import { API_URL } from "../config";

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const [users, setUsers] = useState([]);
  const [editForms, setEditForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const mapUserToForm = (item) => ({
    firstName: item.firstName || "",
    lastName: item.lastName || "",
    login: item.login || "",
    email: item.email || "",
    position: item.position || "",
    role: item.role || "user",
    status: item.status || "pending approval",
    password: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(res.data);
      const forms = {};
      res.data.forEach((item) => {
        forms[item._id] = mapUserToForm(item);
      });
      setEditForms(forms);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [fetchUsers, user?.role]);

  const approveUser = async (id) => {
    try {
      await axios.patch(
        `${API_URL}/api/admin/users/${id}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка одобрения");
    }
  };

  const rejectUser = async (id) => {
    try {
      await axios.patch(
        `${API_URL}/api/admin/users/${id}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка отклонения");
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/admin/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const saveUser = async (id) => {
    const form = editForms[id];
    if (!form) {
      return;
    }

    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      login: form.login,
      email: form.email,
      position: form.position,
      role: form.role,
      status: form.status,
    };

    if (form.password?.trim()) {
      payload.password = form.password;
    }

    try {
      await axios.patch(`${API_URL}/api/admin/users/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessage("Пользователь обновлен");
      fetchUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка обновления");
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

  if (!user) {
    return (
      <div className="settings-page">
        <div className="settings-card settings-closed">
          <h1 className="settings-title">Настройки</h1>
          <div className="settings-message">Доступ закрыт</div>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="settings-page">
        <div className="settings-card settings-user-card">
          <h1 className="settings-title">Настройки</h1>
          <div className="settings-user-info">
            <div><strong>Логин:</strong> {user.login}</div>
            <div><strong>Роль:</strong> {user.role}</div>
            <div><strong>Статус:</strong> {user.status}</div>
          </div>
          <div className="settings-message">Доступ закрыт</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h1 className="settings-title">Настройки</h1>
        <h2 className="settings-subtitle">Список учеток</h2>

        {message && <p className="settings-top-message">{message}</p>}

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Должность</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Пароль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => {
                const form = editForms[item._id] || mapUserToForm(item);
                return (
                  <tr key={item._id}>
                    <td>
                      <input
                        className="settings-input"
                        value={form.firstName}
                        onChange={(e) => handleEditChange(item._id, "firstName", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="settings-input"
                        value={form.lastName}
                        onChange={(e) => handleEditChange(item._id, "lastName", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="settings-input"
                        value={form.login}
                        onChange={(e) => handleEditChange(item._id, "login", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="settings-input"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleEditChange(item._id, "email", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="settings-input"
                        value={form.position}
                        onChange={(e) => handleEditChange(item._id, "position", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="settings-input"
                        value={form.role}
                        onChange={(e) => handleEditChange(item._id, "role", e.target.value)}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="settings-input"
                        value={form.status}
                        onChange={(e) => handleEditChange(item._id, "status", e.target.value)}
                      >
                        <option value="pending approval">pending approval</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="settings-input"
                        type="password"
                        placeholder="Новый пароль"
                        value={form.password}
                        onChange={(e) => handleEditChange(item._id, "password", e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="settings-actions">
                        <button
                          type="button"
                          className="settings-btn save"
                          onClick={() => saveUser(item._id)}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="settings-btn approve"
                          onClick={() => approveUser(item._id)}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="settings-btn reject"
                          onClick={() => rejectUser(item._id)}
                        >
                          Отклонить
                        </button>
                        <button
                          type="button"
                          className="settings-btn delete"
                          onClick={() => deleteUser(item._id)}
                        >
                          Удалить
                        </button>
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