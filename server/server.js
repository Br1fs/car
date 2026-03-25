import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

// Роуты
import applicationsRoutes from "./routes/applications.js";
import carsRoutes from "./routes/cars.js";
import protocolTemplatesRoutes from "./routes/protocol-templates.js";
import protocolsRoutes from "./routes/protocols.js";
import weatherRoutes from "./routes/weather.js";
import decisionsRouter from "./routes/decisions.js";
import dogovorsRouter from "./routes/dogovors.js";
import zayavkiRouter from "./routes/zayavki.js";

// НОВЫЕ роуты
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// ===== Middleware =====
app.use(cors({
  origin: "http://localhost:5173"
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Статика для файлов =====
app.use("/uploads", express.static("uploads"));

// ===== Подключение роутов =====
app.use("/api/applications", applicationsRoutes);
app.use("/api/cars", carsRoutes);
app.use("/api/protocol-templates", protocolTemplatesRoutes);
app.use("/api/protocols", protocolsRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/decisions", decisionsRouter);
app.use("/api/dogovors", dogovorsRouter);
app.use("/api/zayavki", zayavkiRouter);

// ===== НОВЫЕ роуты авторизации =====
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use(cors());

// ===== Запуск сервера =====
await connectDB();
app.listen(5000, () => {
  console.log("Server started on port 5000");
});