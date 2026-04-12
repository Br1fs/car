import express from "express";
import TableJournal from "../models/TableJournal.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await TableJournal.find().sort({ createdAt: -1 });
    res.json(rows);
  } catch (error) {
    console.error("GET /api/table-journal error:", error);
    res.status(500).json({
      message: "Ошибка при получении таблицы",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await TableJournal.create({
      applicationId: req.body.applicationId ?? "",
      numeration: req.body.numeration ?? 0,
      number: req.body.number ?? "",
      fio: req.body.fio ?? "",
      type: req.body.type ?? "",
      brand: req.body.brand ?? "",
      model: req.body.model ?? "",
      color: req.body.color ?? "",
      vinCode: req.body.vinCode ?? "",
      broker: req.body.broker ?? "",
      applicationStatus: req.body.applicationStatus ?? "",
      submitDate: req.body.submitDate ?? "",
      applicationNumber: req.body.applicationNumber ?? "",
      specialist: req.body.specialist ?? "",
      sbktsNumber: req.body.sbktsNumber ?? "",
      comment: req.body.comment ?? "",
      sbktsEptsStatus: req.body.sbktsEptsStatus ?? "",
      eptsStatus: req.body.eptsStatus ?? "",
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("POST /api/table-journal error:", error);
    res.status(500).json({
      message: "Ошибка при создании записи",
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await TableJournal.findByIdAndUpdate(
      req.params.id,
      {
        applicationId: req.body.applicationId ?? "",
        numeration: req.body.numeration ?? 0,
        number: req.body.number ?? "",
        fio: req.body.fio ?? "",
        type: req.body.type ?? "",
        brand: req.body.brand ?? "",
        model: req.body.model ?? "",
        color: req.body.color ?? "",
        vinCode: req.body.vinCode ?? "",
        broker: req.body.broker ?? "",
        applicationStatus: req.body.applicationStatus ?? "",
        submitDate: req.body.submitDate ?? "",
        applicationNumber: req.body.applicationNumber ?? "",
        specialist: req.body.specialist ?? "",
        sbktsNumber: req.body.sbktsNumber ?? "",
        comment: req.body.comment ?? "",
        sbktsEptsStatus: req.body.sbktsEptsStatus ?? "",
        eptsStatus: req.body.eptsStatus ?? "",
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/table-journal/:id error:", error);
    res.status(500).json({
      message: "Ошибка при обновлении записи",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await TableJournal.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json({ message: "Запись удалена" });
  } catch (error) {
    console.error("DELETE /api/table-journal/:id error:", error);
    res.status(500).json({
      message: "Ошибка при удалении записи",
      error: error.message,
    });
  }
});

export default router;