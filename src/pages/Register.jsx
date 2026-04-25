import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import { API_URL } from "../config";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    surname: "",
    login: "",
    email: "",
    position: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (form.password !== form.confirmPassword) {
      setIsError(true);
      setMessage("Пароли не совпадают");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, form);
      setMessage(res.data.message || "Учетка создана");
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      setIsError(true);
      setMessage(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Ошибка регистрации"
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-subtitle">Создайте учетку и дождитесь одобрения администратора</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            name="name"
            placeholder="Имя"
            value={form.name}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <input
            name="surname"
            placeholder="Фамилия"
            value={form.surname}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <input
            name="login"
            placeholder="Логин"
            value={form.login}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <input
            name="position"
            placeholder="Должность"
            value={form.position}
            onChange={handleChange}
            className="auth-input"
          />

          <input
            name="password"
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Повторить пароль"
            value={form.confirmPassword}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <button type="submit" className="auth-button">
            Создать учетку
          </button>
        </form>

        {message && <p className={`auth-message ${isError ? "error" : "success"}`}>{message}</p>}

        <p className="auth-link-text">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}