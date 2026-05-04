import express from "express";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import TableJournal from "../models/TableJournal.js";
import { getDB } from "../db.js";

const router = express.Router();

function buildApplicationPayloadFromJournal(row = {}) {
  const now = new Date();
  return {
    fio: row.fio ?? "",
    vin: row.vinCode ?? "",
    typ: row.type ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    color: row.color ?? "",
    broker: row.broker ?? "",
    specialist: row.specialist ?? "",
    status1: row.applicationStatus || "На одобрении",
    protocolNumber: row.number ?? "",
    applicationNumber: row.applicationNumber ?? "",
    sbktsNumber: row.sbktsNumber ?? "",
    comment: row.comment ?? "",
    source: "journal_manual",
    updatedAt: now,
  };
}

async function upsertApplicationFromJournal(journalRow = {}) {
  const db = getDB();
  const payload = buildApplicationPayloadFromJournal(journalRow);
  const maybeApplicationId = String(journalRow.applicationId || "").trim();

  if (ObjectId.isValid(maybeApplicationId)) {
    const appId = new ObjectId(maybeApplicationId);
    const existing = await db.collection("applications").findOne({ _id: appId }, { projection: { _id: 1 } });
    if (existing) {
      await db.collection("applications").updateOne({ _id: appId }, { $set: payload });
      return maybeApplicationId;
    }
  }

  const insertResult = await db.collection("applications").insertOne({
    ...payload,
    createdAt: new Date(),
    files: {},
    activityLogs: [
      {
        action: "create_from_journal",
        by: "system",
        at: new Date().toISOString(),
      },
    ],
  });

  return insertResult.insertedId.toString();
}

function buildJournalPayload(row = {}) {
  return {
    applicationId: row.applicationId ?? "",
    numeration: row.numeration ?? 0,
    number: row.number ?? "",
    fio: row.fio ?? "",
    type: row.type ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    color: row.color ?? "",
    vinCode: row.vinCode ?? "",
    broker: row.broker ?? "",
    applicationStatus: row.applicationStatus ?? "",
    submitDate: row.submitDate ?? "",
    applicationNumber: row.applicationNumber ?? "",
    specialist: row.specialist ?? "",
    sbktsNumber: row.sbktsNumber ?? "",
    comment: row.comment ?? "",
    sbktsEptsStatus: row.sbktsEptsStatus ?? "",
    eptsStatus: row.eptsStatus ?? "",
  };
}

function getRowKey(row = {}) {
  const rawId = row._id != null ? String(row._id) : "";
  if (mongoose.Types.ObjectId.isValid(rawId)) return `id:${rawId}`;
  if (row.applicationId) return `applicationId:${String(row.applicationId)}`;
  if (row.number) return `number:${String(row.number)}`;
  return null;
}

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
    const rowPayload = buildJournalPayload(req.body);
    const applicationId = await upsertApplicationFromJournal(rowPayload);
    const created = await TableJournal.create({
      ...rowPayload,
      applicationId,
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
    const existingRow = await TableJournal.findById(req.params.id);
    if (!existingRow) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    const rowPayload = buildJournalPayload({
      ...req.body,
      applicationId: req.body?.applicationId || existingRow.applicationId || "",
    });
    const applicationId = await upsertApplicationFromJournal(rowPayload);
    const updated = await TableJournal.findByIdAndUpdate(
      req.params.id,
      {
        ...rowPayload,
        applicationId,
      },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/table-journal/:id error:", error);
    res.status(500).json({
      message: "Ошибка при обновлении записи",
      error: error.message,
    });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ message: "Ожидается массив строк" });
    }
    if (!rows.length) {
      return res.json({
        ok: true,
        received: 0,
        processed: 0,
        inserted: 0,
        modified: 0,
        matched: 0,
        upserted: 0,
      });
    }

    const dedupedByKey = new Map();
    let fallbackCounter = 0;

    for (const row of rows) {
      const baseKey = getRowKey(row);
      const key = baseKey || `fallback:${fallbackCounter++}`;
      dedupedByKey.set(key, row);
    }

    const operations = [];

    for (const [key, row] of dedupedByKey.entries()) {
      const payload = buildJournalPayload(row);
      let filter = null;
      let upsert = true;

      if (key.startsWith("id:")) {
        filter = { _id: new mongoose.Types.ObjectId(key.slice(3)) };
      } else if (key.startsWith("applicationId:")) {
        filter = { applicationId: payload.applicationId };
      } else if (key.startsWith("number:")) {
        filter = { number: payload.number };
      } else {
        upsert = false;
      }

      if (filter) {
        operations.push({
          updateOne: {
            filter,
            update: { $set: payload },
            upsert,
          },
        });
      } else {
        operations.push({
          insertOne: {
            document: payload,
          },
        });
      }
    }

    if (!operations.length) {
      return res.json({
        ok: true,
        received: rows.length,
        processed: 0,
        inserted: 0,
        modified: 0,
        matched: 0,
        upserted: 0,
      });
    }

    const result = await TableJournal.bulkWrite(operations, {
      ordered: false,
    });

    res.json({
      ok: true,
      received: rows.length,
      processed: operations.length,
      inserted: result.insertedCount ?? 0,
      modified: result.modifiedCount ?? 0,
      matched: result.matchedCount ?? 0,
      upserted: result.upsertedCount ?? 0,
    });
  } catch (error) {
    console.error("POST /api/table-journal/bulk error:", error);
    res.status(500).json({
      message: "Ошибка при пакетном обновлении журнала",
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