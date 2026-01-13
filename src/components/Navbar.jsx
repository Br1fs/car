import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/table">Таблица</Link>  {/* новая ссылка */}
      <Link to="/applications">Заявки</Link>
      <Link to="/applications/new">Создать заявку</Link>
      <Link to="/protocol">Протокол</Link>
      <Link to="/decision">Решение</Link>
      <Link to="/contract">Договор</Link>
      <Link to="/work-notes">Рабочая запись</Link>
      <Link to="/Declaration">Дикларация</Link>
      <Link to="/EPTS">ЭПТС</Link>
      <Link to="/settings">Настройки</Link>
      <Link to="/exit">Выход</Link>
      
    </nav>
  );
}
