import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Settings.css";

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(res.data);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, []);

  const approveUser = async (id) => {
    try {
      await axios.patch(
        `http://localhost:5000/api/admin/users/${id}/approve`,
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
        `http://localhost:5000/api/admin/users/${id}/reject`,
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
      await axios.delete(`http://localhost:5000/api/admin/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
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
                <th>Логин</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item._id}>
                  <td>{item.login}</td>
                  <td>{item.role}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.role !== "admin" && (
                      <div className="settings-actions">
                        <button
                          className="settings-btn approve"
                          onClick={() => approveUser(item._id)}
                        >
                          Одобрить
                        </button>
                        <button
                          className="settings-btn reject"
                          onClick={() => rejectUser(item._id)}
                        >
                          Отклонить
                        </button>
                        <button
                          className="settings-btn delete"
                          onClick={() => deleteUser(item._id)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}