import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";

const router = express.Router();

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
