import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Applications from "./pages/Applications";
import ApplicationView from "./pages/ApplicationView";
import CreateApplication from "./pages/CreateApplication";
import CarsManagement from "./pages/CarsManagement";
import AddCar from "./pages/AddCar";
import ExcelTable from "./components/ExcelTable";
import Protocols from "./pages/Protocols";
import ProtocolTemplates from "./pages/ProtocolTemplates";
import ProtocolTemplateForm from "./pages/ProtocolTemplateForm";
import ProtocolView from "./pages/ProtocolView";
import Decisions from "./pages/Decisions";
import Dogovors from "./pages/Dogovors";
import Zayavki from "./pages/Zayavki";
import WorkNotes from "./pages/WorkNotes";
import Declaration from "./pages/Declaration";
import EPTS from "./pages/EPTS";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div style={{ paddingTop: "2px", width: "100%" }}></div>

      <Routes>
        <Route path="/" element={<Navigate to="/table" />} />

        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings" element={<Settings />} />

        <Route
          path="/table"
          element={
            <ProtectedRoute>
              <ExcelTable />
            </ProtectedRoute>
          }
        />

        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <Applications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/new"
          element={
            <ProtectedRoute>
              <CreateApplication />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/:id"
          element={
            <ProtectedRoute>
              <ApplicationView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-application/:id"
          element={
            <ProtectedRoute>
              <CreateApplication />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cars-management"
          element={
            <ProtectedRoute>
              <CarsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cars/add"
          element={
            <ProtectedRoute>
              <AddCar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cars/:id"
          element={
            <ProtectedRoute>
              <AddCar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/protocols"
          element={
            <ProtectedRoute>
              <Protocols />
            </ProtectedRoute>
          }
        />
        <Route
          path="/protocols/:id"
          element={
            <ProtectedRoute>
              <ProtocolView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/protocol-templates"
          element={
            <ProtectedRoute>
              <ProtocolTemplates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/zayavki"
          element={
            <ProtectedRoute>
              <Zayavki />
            </ProtectedRoute>
          }
        />
        <Route
          path="/decision"
          element={
            <ProtectedRoute>
              <Decisions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dogovor"
          element={
            <ProtectedRoute>
              <Dogovors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/work-notes"
          element={
            <ProtectedRoute>
              <WorkNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/Declaration"
          element={
            <ProtectedRoute>
              <Declaration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/EPTS"
          element={
            <ProtectedRoute>
              <EPTS />
            </ProtectedRoute>
          }
        />

        <Route
          path="/protocol-templates/create"
          element={
            <ProtectedRoute>
              <ProtocolTemplateForm isNew={true} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/protocol-templates/:id/edit"
          element={
            <ProtectedRoute>
              <ProtocolTemplateForm isNew={false} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}