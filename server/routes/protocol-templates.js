import express from "express";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// ✅ MATCH — выше /:id
router.get("/match", async (req, res) => {
  try {
    const { category, fuelType = "", pdfTemplate } = req.query;
    const db = getDB();

    const query = { category };

    if (pdfTemplate) {
      query.pdfTemplate = pdfTemplate;
    } else {
      query.fuelType = fuelType;
    }

    const template = await db.collection("protocolTemplates").findOne(query);

    if (!template) {
      return res.status(404).json({
        message: "Шаблон не найден"
      });
    }

    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const templates = await db.collection("protocolTemplates")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET BY ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Неверный ID" });
    }

    const db = getDB();

    const template = await db.collection("protocolTemplates")
      .findOne({ _id: new ObjectId(id) });

    if (!template) {
      return res.status(404).json({ error: "Шаблон не найден" });
    }

    res.json(template);
  } catch (err) {
    console.error("GET TEMPLATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ CREATE
router.post("/", async (req, res) => {
  try {
    const { category, fuelType = "", pdfTemplate } = req.body;

    if (!category) {
      return res.status(400).json({
        error: "category обязательна"
      });
    }

    if (!pdfTemplate) {
      return res.status(400).json({
        error: "pdfTemplate обязателен"
      });
    }

    const db = getDB();

    const exists = await db.collection("protocolTemplates")
      .findOne({ category, fuelType, pdfTemplate });

    if (exists) {
      return res.status(409).json({
        message: "Такой шаблон уже существует"
      });
    }

    const result = await db.collection("protocolTemplates")
      .insertOne({
        ...req.body,
        fuelType,
        pdfTemplate,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    res.json({ _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Неверный ID" });
    }

    const db = getDB();

    const { _id, ...updateData } = req.body;

    const result = await db.collection("protocolTemplates").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          fuelType: updateData.fuelType || "",
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Шаблон не найден" });
    }

    res.json({ message: "Шаблон обновлен" });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();

    await db.collection("protocolTemplates")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ message: "Удалено" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;