import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-links">
        <Link to="/table">Журнал</Link>
        <Link to="/applications">Заявки</Link>
        <Link to="/applications/new">Создать заявку</Link>
        <Link to="/protocols">Протокол</Link>
        <Link to="/zayavki">Сформированные заявки</Link>
        <Link to="/decision">Решение</Link>
        <Link to="/dogovor">Договор</Link>
        <Link to="/work-notes">Рабочая запись</Link>
        <Link to="/Declaration">Декларация</Link>
        <Link to="/EPTS">ЭПТС</Link>
        <Link to="/settings">Настройки</Link>
        <Link to="/cars-management">База машин</Link>
      </div>

      {!token || !user ? (
        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/login" className="exit-link">Войти</Link>
          <Link to="/register" className="exit-link">Регистрация</Link>
        </div>
      ) : (
        <button onClick={handleLogout} className="exit-link">
          Выход
        </button>
      )}
    </nav>
  );
}