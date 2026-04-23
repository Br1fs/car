import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// ====== Настройка загрузки файлов ======
const uploadFolder = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });

const safeDecodeOriginalName = (name = "") => {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
};

const storage = multer.diskStorage({
  destination: uploadFolder,
  filename: (req, file, cb) => {
    const decodedOriginal = safeDecodeOriginalName(file.originalname || "file");
    const safeName = decodedOriginal.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

const PROTOCOL_COUNTER_ID = "applications-protocol-counter";

const unwrapFindOneAndUpdate = (result) => {
  if (!result) return null;
  if (result?.value) return result.value;
  return result;
};

const getCounterCurrent = async (db) => {
  const counter = await db.collection("counters").findOne({ _id: PROTOCOL_COUNTER_ID });
  const current = Number(counter?.current || 0);
  return Number.isFinite(current) ? current : 0;
};

const peekNextProtocolNumber = async (db) => {
  const current = await getCounterCurrent(db);
  return String(current + 1);
};

const incrementProtocolCounter = async (db) => {
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: PROTOCOL_COUNTER_ID },
    {
      $inc: { current: 1 },
      $setOnInsert: { createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );

  const doc = unwrapFindOneAndUpdate(result);
  return String(doc?.current || 1);
};

const ensureCounterAtLeast = async (db, protocolNumber) => {
  const asInt = Number(protocolNumber);
  if (!Number.isInteger(asInt) || asInt <= 0) return;

  await db.collection("counters").updateOne(
    { _id: PROTOCOL_COUNTER_ID },
    {
      $max: { current: asInt },
      $setOnInsert: { createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
};

const protocolNumberExists = async (db, protocolNumber) => {
  const exists = await db.collection("applications").findOne(
    { protocolNumber: String(protocolNumber) },
    { projection: { _id: 1 } }
  );

  return Boolean(exists);
};

const reserveUniqueProtocolNumber = async (db) => {
  let candidate = await incrementProtocolCounter(db);
  while (await protocolNumberExists(db, candidate)) {
    candidate = await incrementProtocolCounter(db);
  }
  return candidate;
};

const normalizeUploadedFiles = (uploadedFiles = []) => {
  const filesData = {};

  for (const file of uploadedFiles) {
    if (!filesData[file.fieldname]) filesData[file.fieldname] = [];

    filesData[file.fieldname].push({
      filename: file.filename,
      originalname: safeDecodeOriginalName(file.originalname || ""),
      mimetype: file.mimetype || "",
      size: file.size || 0,
    });
  }

  return filesData;
};

const normalizeExistingFiles = (files = {}) => {
  const normalized = {};

  Object.entries(files || {}).forEach(([key, arr]) => {
    normalized[key] = (arr || []).map((file) => {
      if (typeof file === "string") {
        return {
          filename: file,
          originalname: file,
          mimetype: "",
          size: 0,
        };
      }

      if (file && typeof file === "object") {
        return {
          filename: file.filename || file.savedName || "",
          originalname:
            file.originalname ||
            file.originalName ||
            file.filename ||
            file.savedName ||
            "Без имени",
          mimetype: file.mimetype || "",
          size: file.size || 0,
        };
      }

      return {
        filename: "",
        originalname: "Без имени",
        mimetype: "",
        size: 0,
      };
    }).filter((item) => item.filename);
  });

  return normalized;
};

const buildActor = (req) => {
  const actorHeader = req.headers["x-user"] || "";

  if (!actorHeader) return null;

  try {
    const parsed = JSON.parse(actorHeader);
    return {
      id: parsed.id || "",
      login: parsed.login || "",
      fullName: `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim(),
      role: parsed.role || "",
    };
  } catch {
    return null;
  }
};

const pushApplicationAuditEvent = (
  appDoc,
  { type, actor, from, to, meta = {} } = {}
) => {
  const auditLog = Array.isArray(appDoc.auditLog) ? [...appDoc.auditLog] : [];
  auditLog.push({
    type,
    at: new Date().toISOString(),
    actor: actor || null,
    from: from ?? null,
    to: to ?? null,
    meta,
  });
  return auditLog;
};

router.get("/next-protocol-number", async (req, res) => {
  try {
    const db = getDB();
    const nextProtocolNumber = await peekNextProtocolNumber(db);
    res.json({ nextProtocolNumber });
  } catch (err) {
    console.error("NEXT PROTOCOL NUMBER ERROR:", err);
    res.status(500).json({ message: "Не удалось получить номер протокола" });
  }
});

// ================= POST /save =================
router.post("/save", upload.any(), async (req, res) => {
  try {
    const db = getDB();
    const formData = JSON.parse(req.body.form || "{}");
    const actor = buildActor(req);

    const uploadedFiles = normalizeUploadedFiles(req.files || []);
    const existingFiles = normalizeExistingFiles(formData.files || {});

    const mergedFiles = { ...existingFiles };

    Object.entries(uploadedFiles).forEach(([key, arr]) => {
      mergedFiles[key] = [...(mergedFiles[key] || []), ...arr];
    });

    const requestedProtocolNumber = String(formData.protocolNumber || "").trim();

    let resolvedProtocolNumber = requestedProtocolNumber;
    if (!resolvedProtocolNumber) {
      resolvedProtocolNumber = await reserveUniqueProtocolNumber(db);
    } else if (await protocolNumberExists(db, resolvedProtocolNumber)) {
      resolvedProtocolNumber = await reserveUniqueProtocolNumber(db);
    } else {
      await ensureCounterAtLeast(db, resolvedProtocolNumber);
    }

    const newApp = {
      ...formData,
      protocolNumber: resolvedProtocolNumber,
      files: mergedFiles,
      status1: formData.status1 || "На одобрении",
      status2: formData.status2 || "",
      createdBy: actor || null,
      workflow: {
        createdAt: new Date().toISOString(),
        releasedAt: null,
      },
      auditLog: [
        {
          type: "application_created",
          at: new Date().toISOString(),
          actor: actor || null,
          from: null,
          to: formData.status1 || "На одобрении",
          meta: {
            protocolNumber: resolvedProtocolNumber,
          },
        },
      ],
      createdAt: new Date(),
    };

    delete newApp._id;

    const result = await db.collection("applications").insertOne(newApp);

    res.json({
      message: "Сохранено",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= POST /send-whatsapp =================
router.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res
        .status(400)
        .json({ message: "Номер телефона и сообщение обязательны" });
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ message: "Сообщение отправлено", data: response.data });
  } catch (err) {
    console.error("WhatsApp send error:", err.response?.data || err);
    res.status(500).json({ message: "Ошибка при отправке сообщения" });
  }
});

// ================= GET все заявки =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const { fromDate, toDate } = req.query;
    const filter = {};

    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00.000Z`);
        if (!Number.isNaN(from.getTime())) {
          filter.createdAt.$gte = from;
        }
      }

      if (toDate) {
        const to = new Date(`${toDate}T23:59:59.999Z`);
        if (!Number.isNaN(to.getTime())) {
          filter.createdAt.$lte = to;
        }
      }

      if (!Object.keys(filter.createdAt).length) {
        delete filter.createdAt;
      }
    }

    const apps = await db
      .collection("applications")
      .find(
        filter,
        {
          projection: {
            createdAt: 1,
            updatedAt: 1,
            status1: 1,
            status2: 1,
            fio: 1,
            vin: 1,
            typ: 1,
            brand: 1,
            model: 1,
            year: 1,
            volume: 1,
            broker: 1,
            files: 1,
            protocolNumber: 1,
            position: 1,
            fuelType: 1,
            workflow: 1,
            auditLog: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET по ID =================
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const application = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(id) });

    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    application.files = normalizeExistingFiles(application.files || {});

    res.json(application);
  } catch (err) {
    console.error("GET BY ID ERROR:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= PUT (редактирование) =================
router.put("/:id", upload.any(), async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const formData = JSON.parse(req.body.form || "{}");
    const actor = buildActor(req);

    const currentApp = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(id) });

    if (!currentApp) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const existingFiles = normalizeExistingFiles(
      formData.files || currentApp.files || {}
    );

    const uploadedFiles = normalizeUploadedFiles(req.files || []);

    const mergedFiles = { ...existingFiles };

    Object.entries(uploadedFiles).forEach(([key, arr]) => {
      mergedFiles[key] = [...(mergedFiles[key] || []), ...arr];
    });

    formData.files = mergedFiles;

    const previousStatus1 = currentApp.status1 || "";
    const nextStatus1 = formData.status1 ?? previousStatus1;

    const auditLog = pushApplicationAuditEvent(currentApp, {
      type: "application_updated",
      actor,
      from: previousStatus1,
      to: nextStatus1,
      meta: {
        updatedFields: Object.keys(formData || {}),
      },
    });

    if (previousStatus1 !== nextStatus1) {
      auditLog.push({
        type: "status1_changed",
        at: new Date().toISOString(),
        actor: actor || null,
        from: previousStatus1,
        to: nextStatus1,
        meta: {},
      });
    }

    const nextWorkflow = {
      ...(currentApp.workflow || {}),
      ...(formData.workflow || {}),
    };

    if (
      nextStatus1 &&
      String(nextStatus1).toLowerCase().includes("выпуск") &&
      String(nextStatus1).toLowerCase().includes("готов")
    ) {
      nextWorkflow.releasedAt = nextWorkflow.releasedAt || new Date().toISOString();
    }

    const result = await db.collection("applications").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...formData,
          auditLog,
          workflow: nextWorkflow,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    res.json({ message: "Обновлено" });
  } catch (err) {
    console.error("PUT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= DELETE =================
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const result = await db
      .collection("applications")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    res.json({ message: "Заявка удалена" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { status1, status2 } = req.body || {};
    const actor = buildActor(req);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const currentApp = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(id) });

    if (!currentApp) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const nextStatus1 =
      status1 !== undefined ? String(status1 || "") : currentApp.status1 || "";
    const nextStatus2 =
      status2 !== undefined ? String(status2 || "") : currentApp.status2 || "";

    const auditLog = pushApplicationAuditEvent(currentApp, {
      type: "status_updated_from_list",
      actor,
      from: `${currentApp.status1 || ""} / ${currentApp.status2 || ""}`,
      to: `${nextStatus1} / ${nextStatus2}`,
      meta: {},
    });

    const workflow = { ...(currentApp.workflow || {}) };

    if (
      nextStatus1 &&
      String(nextStatus1).toLowerCase().includes("выпуск") &&
      String(nextStatus1).toLowerCase().includes("готов")
    ) {
      workflow.releasedAt = workflow.releasedAt || new Date().toISOString();
    }

    await db.collection("applications").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status1: nextStatus1,
          status2: nextStatus2,
          workflow,
          auditLog,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(id) });

    res.json(updated);
  } catch (err) {
    console.error("PATCH STATUS ERROR:", err);
    res.status(500).json({ message: "Ошибка обновления статуса" });
  }
});

router.post("/:id/copy", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const source = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(id) });

    if (!source) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const actor = buildActor(req);
    const reservedProtocolNumber = await reserveUniqueProtocolNumber(db);
    const nowIso = new Date().toISOString();

    const copied = {
      ...source,
      _id: undefined,
      protocolNumber: reservedProtocolNumber,
      createdBy: actor || source.createdBy || null,
      workflow: {
        createdAt: nowIso,
        releasedAt: null,
      },
      auditLog: [
        {
          type: "application_copied",
          at: nowIso,
          actor: actor || null,
          from: source._id.toString(),
          to: reservedProtocolNumber,
          meta: {
            sourceProtocolNumber: source.protocolNumber || "",
          },
        },
      ],
      copiedFrom: source._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection("applications").insertOne(copied);

    res.status(201).json({
      _id: insertResult.insertedId.toString(),
      protocolNumber: reservedProtocolNumber,
    });
  } catch (err) {
    console.error("COPY APPLICATION ERROR:", err);
    res.status(500).json({ message: "Ошибка копирования заявки" });
  }
});

export default router;