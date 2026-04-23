import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import { API_URL } from "../config";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    login: "",
    email: "",
    position: "",
    password: "",
    repeatPassword: "",
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

    if (form.password !== form.repeatPassword) {
      setMessage("Пароли не совпадают");
      setIsError(true);
      return;
    }

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        login: form.login,
        email: form.email,
        position: form.position,
        password: form.password,
      };
      const res = await axios.post(`${API_URL}/api/auth/register`, payload);
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

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            name="firstName"
            placeholder="Имя"
            value={form.firstName}
            onChange={handleChange}
            className="auth-input"
          />

          <input
            name="lastName"
            placeholder="Фамилия"
            value={form.lastName}
            onChange={handleChange}
            className="auth-input"
          />

          <input
            name="login"
            placeholder="Логин"
            value={form.login}
            onChange={handleChange}
            className="auth-input"
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="auth-input"
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
          />

          <input
            name="repeatPassword"
            type="password"
            placeholder="Повторите пароль"
            value={form.repeatPassword}
            onChange={handleChange}
            className="auth-input"
          />

          <button type="submit" className="auth-button">
            Создать учетку
          </button>
        </form>

        {message && (
          <p className={`auth-message ${isError ? "error" : "success"}`}>
            {message}
          </p>
        )}

        <p className="auth-link-text">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}