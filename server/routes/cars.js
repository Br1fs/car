import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";

const router = express.Router();

const genCoverDir = path.join(process.cwd(), "uploads", "car-generations");
if (!fs.existsSync(genCoverDir)) fs.mkdirSync(genCoverDir, { recursive: true });

const genCoverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, genCoverDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".jpg";
    const safeExt = ext.length <= 8 ? ext : ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  },
});

const genCoverUpload = multer({
  storage: genCoverStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(String(file.mimetype || ""));
    if (ok) cb(null, true);
    else cb(new Error("Только изображения JPEG, PNG, GIF, WebP"));
  },
});

function unlinkGenerationFile(stored) {
  const rel = String(stored || "").trim();
  if (!rel || rel.includes("..")) return;
  const base = rel.replace(/^\//, "").replace(/^uploads\//, "");
  if (!base.startsWith("car-generations/")) return;
  const fp = path.join(process.cwd(), "uploads", base);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    console.warn("CAR_GEN_COVER_UNLINK:", e?.message || e);
  }
}

/** Обложка поколения: файл с ПК → `car-generations/<имя>` в uploads */
router.post("/upload-generation-cover", (req, res) => {
  genCoverUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.message || "Ошибка загрузки";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "Нет файла" });
    const relative = `car-generations/${req.file.filename}`;
    return res.json({ path: relative, url: `/uploads/${relative}` });
  });
});

// ================= GET все машины =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const cars = await db.collection("cars").find({}).toArray();
    res.json(cars);
  } catch (err) {
    console.error("GET ALL CARS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET машина по ID =================

router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const car = await db.collection("cars").findOne({ _id: new ObjectId(id) });
    if (!car) return res.status(404).json({ message: "Машина не найдена" });

    res.json(car);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= POST добавить машину =================
router.post("/add", async (req, res) => {
  try {
    const db = getDB();
    const newCar = { ...req.body };

    delete newCar._id;

    const cleanInt = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const cleaned = String(v).trim().replace(/[^\d]/g, "");
      return cleaned ? parseInt(cleaned, 10) : null;
    };

    const cleanFloat = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const cleaned = String(v)
        .trim()
        .replace(",", ".")
        .replace(/[^\d.]/g, "");
      return cleaned ? parseFloat(cleaned) : null;
    };

    newCar.year = cleanInt(newCar.year);
    newCar.volume = cleanFloat(newCar.volume);

    const result = await db.collection("cars").insertOne({
      ...newCar,
      createdAt: new Date(),
    });

    res.json({
      message: "Машина добавлена",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("ADD CAR ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= PUT редактировать машину =================
// cars.js
router.put("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });

    const updateData = { ...req.body }; // берем весь объект из body

    // Убираем _id, если есть
    delete updateData._id;

    const result = await db.collection("cars").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) return res.status(404).json({ message: "Машина не найдена" });

    res.json({ message: "Обновлено" });
  } catch (err) {
    console.error("PUT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});



// ================= DELETE удалить машину =================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const db = getDB();
    const existing = await db.collection("cars").findOne({ _id: new ObjectId(id) });
    if (existing?.generationImage) unlinkGenerationFile(existing.generationImage);
    if (existing?.coverImage) unlinkGenerationFile(existing.coverImage);

    const result = await db.collection("cars").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Машина не найдена" });
    }

    res.json({ message: "Машина удалена" });
  } catch (err) {
    console.error("DELETE CAR ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});
router.post("/bulk-delete", async (req, res) => {
  try {
    const db = getDB();
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Не переданы ID" });
    }

    const validIds = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (!validIds.length) {
      return res.status(400).json({ message: "Нет корректных ID" });
    }

    const result = await db.collection("cars").deleteMany({
      _id: { $in: validIds },
    });

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE CARS ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});
export default router;
