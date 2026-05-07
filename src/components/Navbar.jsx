import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { API_URL } from "../config";
import { clearActivityTimestamp } from "../utils/idleSession";

export default function Navbar() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    clearActivityTimestamp();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const sections = [
    {
      title: "Работа",
      items: [
        { to: "/table", label: "Журнал", icon: "📘" },
        { to: "/applications", label: "Список заявок", icon: "📋" },
        { to: "/applications/new", label: "Создать заявку", icon: "➕" },
      ],
    },
    {
      title: "Документы",
      items: [
        { to: "/zayavki", label: "Сформированные заявки", icon: "🗂" },
        { to: "/protocols", label: "Протокол", icon: "📄" },
        { to: "/decision", label: "Решение", icon: "✅" },
        { to: "/dogovor", label: "Договор", icon: "🖋" },
        { to: "/declaration", label: "Кнопка", icon: "📎" },
        { to: "/work-notes", label: "Рабочая запись", icon: "🗒" },
        { to: "/mail-board", label: "Карточки", icon: "📮" },
      ],
    },
    {
      title: "Система",
      items: [
        { to: "/cars-management", label: "База машин", icon: "🚗" },
        { to: "/settings", label: "Настройки", icon: "⚙️" },
        ...(user?.role === "admin"
          ? [{ to: "/activity-logs", label: "Контроль действий", icon: "🕒" }]
          : []),
      ],
    },
  ];

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-sidebar-state",
      collapsed ? "collapsed" : "expanded"
    );
  }, [collapsed]);

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      }
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  return (
    <>
      <button className="mobile-menu-button" onClick={() => setMobileOpen((p) => !p)} type="button">
        ☰
      </button>

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">{collapsed ? "AP" : "Applications Portal"}</div>
          <button className="collapse-btn" type="button" onClick={() => setCollapsed((p) => !p)}>
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {!token || !user ? (
          <div className="auth-links">
            <NavLink to="/login" className="sidebar-link" onClick={closeMobile}>Войти</NavLink>
            <NavLink to="/register" className="sidebar-link" onClick={closeMobile}>Регистрация</NavLink>
          </div>
        ) : (
          <div className="sidebar-content">
            {sections.map((section) => (
              <div key={section.title} className="sidebar-section">
                {!collapsed && <div className="section-title">{section.title}</div>}
                <div className="section-links">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                      onClick={closeMobile}
                      title={collapsed ? item.label : ""}
                    >
                      <span className="sidebar-icon">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setDarkMode((v) => !v)}
            title={darkMode ? "Светлая тема" : "Тёмная тема"}
            aria-pressed={darkMode}
          >
            <span className="sidebar-icon" aria-hidden>
              {darkMode ? "☀️" : "🌙"}
            </span>
            {!collapsed && <span>{darkMode ? "Светлая тема" : "Тёмная тема"}</span>}
          </button>
          {token && user ? (
            <>
              <div className="sidebar-user">
                {user?.avatar ? (
                  <img
                    src={`${API_URL}/uploads/${user.avatar}`}
                    alt="avatar"
                    className="sidebar-user-avatar"
                  />
                ) : (
                  <span className="sidebar-user-icon">👤</span>
                )}
                {!collapsed && (
                  <div className="sidebar-user-meta">
                    <div className="sidebar-user-name">{user?.name || user?.login || "Пользователь"}</div>
                    <div className="sidebar-user-role">{user?.role || "user"}</div>
                  </div>
                )}
              </div>
              <button onClick={handleLogout} className="exit-link">
                <span className="sidebar-icon">🚪</span>
                {!collapsed && <span>Выход</span>}
              </button>
            </>
          ) : null}
        </div>
      </aside>

      {mobileOpen ? <div className="sidebar-overlay" onClick={closeMobile} /> : null}
    </>
  );
}