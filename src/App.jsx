import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import IdleSessionWatcher from "./components/IdleSessionWatcher";
import ProtectedRoute from "./components/ProtectedRoute";

const Applications = lazy(() => import("./pages/Applications"));
const ApplicationView = lazy(() => import("./pages/ApplicationView"));
const CreateApplication = lazy(() => import("./pages/CreateApplication"));
const CarsManagement = lazy(() => import("./pages/CarsManagement"));
const AddCar = lazy(() => import("./pages/AddCar"));
const ExcelTable = lazy(() => import("./components/ExcelTable"));
const Protocols = lazy(() => import("./pages/Protocols"));
const ProtocolTemplates = lazy(() => import("./pages/ProtocolTemplates"));
const ProtocolTemplateForm = lazy(() => import("./pages/ProtocolTemplateForm"));
const ProtocolView = lazy(() => import("./pages/ProtocolView"));
const Decisions = lazy(() => import("./pages/Decisions"));
const Dogovors = lazy(() => import("./pages/Dogovors"));
const Zayavki = lazy(() => import("./pages/Zayavki"));
const WorkNotes = lazy(() => import("./pages/WorkNotes"));
const Declaration = lazy(() => import("./pages/Declaration"));
const EPTS = lazy(() => import("./pages/EPTS"));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const MailBoard = lazy(() => import("./pages/MailBoard"));
const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const Settings = lazy(() => import("./pages/Settings"));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback-spinner" aria-hidden />
      Загрузка…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <IdleSessionWatcher />
      <Navbar />
      <main className="app-content">
        <Suspense fallback={<RouteFallback />}>
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
              path="/mail-board"
              element={
                <ProtectedRoute>
                  <MailBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/declaration"
              element={
                <ProtectedRoute>
                  <Declaration />
                </ProtectedRoute>
              }
            />
            <Route path="/Declaration" element={<Navigate to="/declaration" replace />} />
            <Route
              path="/EPTS"
              element={
                <ProtectedRoute>
                  <EPTS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity-logs"
              element={
                <ProtectedRoute adminOnly={true}>
                  <ActivityLogs />
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
        </Suspense>
      </main>
    </BrowserRouter>
  );
}
