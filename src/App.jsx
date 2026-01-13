import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Navbar from "./components/Navbar"
import Applications from "./pages/Applications"
import CreateApplication from "./pages/CreateApplication"
import ApplicationDetails from "./pages/ApplicationDetails"
import ExcelTable from "./components/ExcelTable";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Путь для таблицы */}
        <Route path="/table" element={<ExcelTable />} />

        {/* Редирект с корня на таблицу */}
        <Route path="/" element={<Navigate to="/table" />} />

        {/* Остальные страницы */}
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/new" element={<CreateApplication />} />
        <Route path="/applications/:id" element={<ApplicationDetails />} />
      </Routes>
    </BrowserRouter>
  )
}
