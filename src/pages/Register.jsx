import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import { API_URL } from "../config";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    login: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, form);
      setMessage(res.data.message || "Учетка создана");
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
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
            name="login"
            placeholder="Логин"
            value={form.login}
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

          <button type="submit" className="auth-button">
            Создать учетку
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-link-text">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}