import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Settings.css";
import { API_URL } from "../config";
import { clearActivityTimestamp } from "../utils/idleSession";

export default function Settings() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "admin/user";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [adminMessageError, setAdminMessageError] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    surname: "",
    login: "",
    email: "",
    position: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);

  const syncUserToLocalStorage = (nextUser) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  const handleUnauthorized = (error) => {
    if (error?.response?.status !== 401) return false;
    clearActivityTimestamp();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAdminMessageError(true);
    setMessage("Сессия истекла. Войдите снова.");
    navigate("/login", { replace: true });
    return true;
  };

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || "",
        surname: user.surname || "",
        login: user.login || "",
        email: user.email || "",
        position: user.position || "",
      });
    }
  }, [user?.id]);

  const handleProfileChange = (e) => {
    setProfileForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePasswordChange = (e) => {
    setPasswordForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(res.data);
      setAdminMessageError(false);
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setAdminMessageError(true);
      setMessage(error?.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isManager) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin, isManager]);

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
      if (handleUnauthorized(error)) return;
      setAdminMessageError(true);
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
      if (handleUnauthorized(error)) return;
      setAdminMessageError(true);
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
      if (handleUnauthorized(error)) return;
      setAdminMessageError(true);
      setMessage(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  const updateAdminUser = async (id, payload) => {
    try {
      await axios.patch(`${API_URL}/api/admin/users/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setAdminMessageError(false);
      setMessage("Изменения пользователя сохранены");
      fetchUsers();
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setAdminMessageError(true);
      setMessage(error?.response?.data?.message || "Ошибка обновления пользователя");
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError(false);

    try {
      const res = await axios.patch(`${API_URL}/api/auth/profile`, profileForm, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      syncUserToLocalStorage(res.data.user);
      setProfileMessage(res.data.message || "Профиль обновлен");
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setProfileError(true);
      setProfileMessage(error?.response?.data?.message || "Ошибка сохранения профиля");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError(false);

    try {
      const res = await axios.patch(`${API_URL}/api/auth/change-password`, passwordForm, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setPasswordMessage(res.data.message || "Пароль успешно изменен");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setPasswordError(true);
      setPasswordMessage(error?.response?.data?.message || "Ошибка смены пароля");
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) {
      setProfileError(true);
      setProfileMessage("Выберите фото профиля");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);
      const res = await axios.patch(`${API_URL}/api/auth/avatar`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      syncUserToLocalStorage(res.data.user);
      setAvatarFile(null);
      setProfileError(false);
      setProfileMessage(res.data.message || "Фото профиля обновлено");
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setProfileError(true);
      setProfileMessage(error?.response?.data?.message || "Ошибка загрузки фото профиля");
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

  if (!isAdmin && !isManager) {
    return (
      <div className="settings-page">
        <div className="settings-card settings-user-card settings-grid">
          <h1 className="settings-title">Настройки</h1>
          <div className="settings-layout">
            <form className="settings-form-card" onSubmit={saveProfile}>
              <h2 className="settings-subtitle">Профиль</h2>
              <input className="settings-input" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Имя" required />
              <input className="settings-input" name="surname" value={profileForm.surname} onChange={handleProfileChange} placeholder="Фамилия" required />
              <input className="settings-input" name="login" value={profileForm.login} onChange={handleProfileChange} placeholder="Логин" required />
              <input className="settings-input" name="email" type="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email" required />
              <input className="settings-input" name="position" value={profileForm.position} onChange={handleProfileChange} placeholder="Должность" />
              <input className="settings-input" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
              <button type="button" className="settings-btn secondary" onClick={uploadAvatar}>Загрузить фото</button>
              <button type="submit" className="settings-btn primary">Сохранить профиль</button>
              {profileMessage && <p className={`settings-inline-message ${profileError ? "error" : "success"}`}>{profileMessage}</p>}
            </form>

            <form className="settings-form-card" onSubmit={savePassword}>
              <h2 className="settings-subtitle">Изменить пароль</h2>
              <input className="settings-input" name="currentPassword" type="password" value={passwordForm.currentPassword} onChange={handlePasswordChange} placeholder="Текущий пароль" required />
              <input className="settings-input" name="newPassword" type="password" value={passwordForm.newPassword} onChange={handlePasswordChange} placeholder="Новый пароль" required />
              <input className="settings-input" name="confirmNewPassword" type="password" value={passwordForm.confirmNewPassword} onChange={handlePasswordChange} placeholder="Повторить новый пароль" required />
              <button type="submit" className="settings-btn primary">Сменить пароль</button>
              {passwordMessage && <p className={`settings-inline-message ${passwordError ? "error" : "success"}`}>{passwordMessage}</p>}
            </form>
          </div>
          <div className="settings-user-info">
            <div><strong>Роль:</strong> {user.role}</div>
            <div><strong>Статус:</strong> {user.status}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-card settings-grid">
        <h1 className="settings-title">Настройки</h1>
        <div className="settings-layout">
          <form className="settings-form-card" onSubmit={saveProfile}>
            <h2 className="settings-subtitle">Профиль администратора</h2>
            <input className="settings-input" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Имя" required />
            <input className="settings-input" name="surname" value={profileForm.surname} onChange={handleProfileChange} placeholder="Фамилия" required />
            <input className="settings-input" name="login" value={profileForm.login} onChange={handleProfileChange} placeholder="Логин" required />
            <input className="settings-input" name="email" type="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email" required />
            <input className="settings-input" name="position" value={profileForm.position} onChange={handleProfileChange} placeholder="Должность" />
            <input className="settings-input" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            <button type="button" className="settings-btn secondary" onClick={uploadAvatar}>Загрузить фото</button>
            <button type="submit" className="settings-btn primary">Сохранить профиль</button>
            {profileMessage && <p className={`settings-inline-message ${profileError ? "error" : "success"}`}>{profileMessage}</p>}
          </form>

          <form className="settings-form-card" onSubmit={savePassword}>
            <h2 className="settings-subtitle">Изменить пароль</h2>
            <input className="settings-input" name="currentPassword" type="password" value={passwordForm.currentPassword} onChange={handlePasswordChange} placeholder="Текущий пароль" required />
            <input className="settings-input" name="newPassword" type="password" value={passwordForm.newPassword} onChange={handlePasswordChange} placeholder="Новый пароль" required />
            <input className="settings-input" name="confirmNewPassword" type="password" value={passwordForm.confirmNewPassword} onChange={handlePasswordChange} placeholder="Повторить новый пароль" required />
            <button type="submit" className="settings-btn primary">Сменить пароль</button>
            {passwordMessage && <p className={`settings-inline-message ${passwordError ? "error" : "success"}`}>{passwordMessage}</p>}
          </form>
        </div>

        <h2 className="settings-subtitle">Список учеток</h2>
        {message && <p className={`settings-top-message ${adminMessageError ? "error" : "success"}`}>{message}</p>}

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Должность</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item._id}>
                  <td>{item.name || "-"}</td>
                  <td>{item.surname || "-"}</td>
                  <td>{item.login}</td>
                  <td>{item.email || "-"}</td>
                  <td>
                    {isAdmin ? (
                      <input
                        className="settings-cell-input"
                        defaultValue={item.position || ""}
                        onBlur={(e) => updateAdminUser(item._id, { position: e.target.value })}
                        placeholder="Должность"
                      />
                    ) : (
                      item.position || "-"
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <select
                        className="settings-cell-select"
                        value={item.role}
                        onChange={(e) => updateAdminUser(item._id, { role: e.target.value })}
                      >
                        <option value="user">user</option>
                        <option value="admin/user">admin/user</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      item.role || "-"
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <select
                        className="settings-cell-select"
                        value={item.status}
                        onChange={(e) => updateAdminUser(item._id, { status: e.target.value })}
                      >
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                      </select>
                    ) : (
                      item.status || "-"
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
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
                    ) : (
                      <span>-</span>
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