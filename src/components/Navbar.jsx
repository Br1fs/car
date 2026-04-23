import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAuthed = Boolean(token && user);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const appLinks = useMemo(
    () => [
      { to: "/table", label: "Журнал", icon: "📘" },
      { to: "/applications", label: "Список заявок", icon: "📋" },
      { to: "/applications/new", label: "Создать заявку", icon: "➕" },
    ],
    []
  );

  const docsLinks = useMemo(
    () => [
      { to: "/protocols", label: "Протоколы", icon: "🧾" },
      { to: "/zayavki", label: "Сформированные заявки", icon: "🗂" },
      { to: "/decision", label: "Решения", icon: "✅" },
      { to: "/dogovor", label: "Договоры", icon: "📄" },
      { to: "/work-notes", label: "Рабочая запись", icon: "📝" },
      { to: "/Declaration", label: "Декларация", icon: "📑" },
      { to: "/EPTS", label: "ЭПТС", icon: "🚘" },
    ],
    []
  );

  const settingsLinks = useMemo(
    () => [
      { to: "/settings", label: "Настройки", icon: "⚙️" },
      { to: "/cars-management", label: "База машин", icon: "🚗" },
    ],
    []
  );

  const renderSection = (title, links) => (
    <div className="sidebar-section">
      {!collapsed && <div className="sidebar-section-title">{title}</div>}
      <div className="sidebar-links">
        {links.map((item) => {
          const active = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link ${active ? "active" : ""}`}
              title={collapsed ? item.label : ""}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-link-text">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? "Раскрыть меню" : "Свернуть меню"}
        >
          {collapsed ? "»" : "«"}
        </button>
        {!collapsed && <div className="sidebar-brand">Blue Portal</div>}
      </div>

      {isAuthed ? (
        <>
          <div className="sidebar-content">
            {renderSection("Заявки", appLinks)}
            {renderSection("Документы", docsLinks)}
            {renderSection("Настройки", settingsLinks)}
          </div>

          <div className="sidebar-bottom">
            {!collapsed && (
              <div className="sidebar-user">
                <div className="sidebar-user-avatar">👤</div>
                <div className="sidebar-user-meta">
                  <div className="sidebar-user-name">
                    {`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.login}
                  </div>
                  <div className="sidebar-user-role">
                    {user.position || user.role || "user"}
                  </div>
                </div>
              </div>
            )}
            <button onClick={handleLogout} className="exit-link">
              {collapsed ? "⏻" : "Выход"}
            </button>
          </div>
        </>
      ) : (
        <div className="sidebar-bottom">
          <Link to="/login" className="exit-link">
            {collapsed ? "→" : "Войти"}
          </Link>
          <Link to="/register" className="exit-link">
            {collapsed ? "+" : "Регистрация"}
          </Link>
        </div>
      )}
    </aside>
  );
}