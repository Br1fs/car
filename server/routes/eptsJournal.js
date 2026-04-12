import express from "express";
import EptsJournal from "../models/EptsJournal.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await EptsJournal.find().sort({ createdAt: -1 });
    res.json(rows);
  } catch (error) {
    console.error("GET /api/epts-journal error:", error);
    res.status(500).json({
      message: "Ошибка при получении журнала",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      date = "",
      sbktsNumber = "",
      category = "",
      brand = "",
      vin = "",
      sbktsStatus = "",
      eptsStatus = "",
    } = req.body || {};

    if (!sbktsNumber.trim()) {
      return res.status(400).json({ message: "Номер СБКТС обязателен" });
    }

    const created = await EptsJournal.create({
      date,
      sbktsNumber,
      category,
      brand,
      vin,
      sbktsStatus,
      eptsStatus,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("POST /api/epts-journal error:", error);
    res.status(500).json({
      message: "Ошибка при создании записи",
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await EptsJournal.findByIdAndUpdate(
      req.params.id,
      {
        date: req.body.date ?? "",
        sbktsNumber: req.body.sbktsNumber ?? "",
        category: req.body.category ?? "",
        brand: req.body.brand ?? "",
        vin: req.body.vin ?? "",
        sbktsStatus: req.body.sbktsStatus ?? "",
        eptsStatus: req.body.eptsStatus ?? "",
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/epts-journal/:id error:", error);
    res.status(500).json({
      message: "Ошибка при обновлении записи",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await EptsJournal.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json({ message: "Запись удалена" });
  } catch (error) {
    console.error("DELETE /api/epts-journal/:id error:", error);
    res.status(500).json({
      message: "Ошибка при удалении записи",
      error: error.message,
    });
  }
});

export default router;