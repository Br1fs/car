import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";
import { API_URL } from "../config";
import { touchActivity } from "../utils/idleSession";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    login: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("authNotice") === "idle") {
        setMessage("Сессия завершена: нет активности более 30 минут. Войдите снова.");
        sessionStorage.removeItem("authNotice");
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      const res = await axios.post(`${API_URL}/api/auth/login`, form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      touchActivity();

      navigate("/table");
    } catch (error) {
      console.error(error);

      setMessage("Неверный логин или пароль");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">Войдите в систему по логину и паролю</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            name="login"
            placeholder="Логин"
            value={form.login}
            onChange={handleChange}
            className="auth-input"
            required
          />

          <div className="password-wrapper">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Пароль"
              value={form.password}
              onChange={handleChange}
              className="auth-input"
              required
            />

            <button
              type="button"
              className="show-password-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          <button type="submit" className="auth-button">
            Войти
          </button>
        </form>

        {message && <p className="auth-message error">{message}</p>}

        <p className="auth-link-text">
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
      </div>
    </div>
  );
}