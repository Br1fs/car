import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import { getDB } from "../db.js";
import { ObjectId } from "mongodb";
import { writeAuditLog } from "../utils/auditLog.js";
import { buildWaMeUrl, normalizePhoneForWhatsApp } from "../utils/whatsappPhone.js";
import { buildTechregPayload } from "../utils/techregMapper.js";

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

const PROTOCOL_BASELINE = 565;

const parseProtocolNumber = (value) => {
  const digits = String(value ?? "")
    .replace(/[^\d]/g, "")
    .trim();
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatProtocolNumber = (value) => String(value).padStart(4, "0");

const getNextProtocolNumber = async (db) => {
  const rows = await db
    .collection("applications")
    .find({}, { projection: { protocolNumber: 1 } })
    .toArray();

  const maxNumber = rows.reduce((max, row) => {
    const current = parseProtocolNumber(row?.protocolNumber);
    return current > max ? current : max;
  }, PROTOCOL_BASELINE);

  return maxNumber + 1;
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

// ================= POST /save =================
router.post("/save", upload.any(), async (req, res) => {
  try {
    const db = getDB();
    const formData = JSON.parse(req.body.form || "{}");

    const uploadedFiles = normalizeUploadedFiles(req.files || []);
    const existingFiles = normalizeExistingFiles(formData.files || {});

    const mergedFiles = { ...existingFiles };

    Object.entries(uploadedFiles).forEach(([key, arr]) => {
      mergedFiles[key] = [...(mergedFiles[key] || []), ...arr];
    });

    const requestedProtocol = parseProtocolNumber(formData.protocolNumber);
    const protocolNumber = requestedProtocol || (await getNextProtocolNumber(db));

    const actorName = String(formData.actorName || formData.createdBy || "system");
    const createdAtIso = new Date().toISOString();
    const createDurationMinutes = Number(formData.creationDurationMinutes || 0);
    const createFinishedAt = new Date();
    const createStartedAt = Number.isFinite(createDurationMinutes) && createDurationMinutes > 0
      ? new Date(createFinishedAt.getTime() - createDurationMinutes * 60000)
      : createFinishedAt;

    const newApp = {
      ...formData,
      protocolNumber: formatProtocolNumber(protocolNumber),
      files: mergedFiles,
      createdAt: new Date(),
      createdBy: actorName,
      activityLogs: [
        {
          action: "create_application",
          by: actorName,
          at: createdAtIso,
        },
      ],
    };

    delete newApp._id;

    const result = await db.collection("applications").insertOne(newApp);

    await writeAuditLog(db, {
      action: "create_application",
      actorName,
      targetType: "application",
      targetId: result.insertedId.toString(),
      targetLabel: `${newApp.fio || ""} | ${newApp.vin || ""}`.trim(),
      startedAt: createStartedAt,
      finishedAt: createFinishedAt,
      durationMinutes: Number.isFinite(createDurationMinutes) ? createDurationMinutes : 0,
      details: {
        protocolNumber: newApp.protocolNumber || "",
        status1: newApp.status1 || "",
        specialist: newApp.specialist || "",
        fio: newApp.fio || "",
        vin: newApp.vin || "",
      },
    });

    res.json({
      message: "Сохранено",
      _id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/next-protocol-number", async (req, res) => {
  try {
    const db = getDB();
    const next = await getNextProtocolNumber(db);
    res.json({
      nextNumber: next,
      formatted: formatProtocolNumber(next),
    });
  } catch (err) {
    console.error("NEXT PROTOCOL NUMBER ERROR:", err);
    res.status(500).json({ message: "Ошибка получения следующего номера протокола" });
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

    const toDigits = normalizePhoneForWhatsApp(phone);
    const waUrl = buildWaMeUrl(phone, String(message));

    if (!toDigits || !waUrl) {
      return res.status(400).json({ message: "Не удалось разобрать номер телефона" });
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

    if (!WHATSAPP_TOKEN || !PHONE_ID) {
      return res.json({
        ok: true,
        via: "link",
        waUrl,
        message:
          "WhatsApp Cloud API не настроен (WHATSAPP_TOKEN и WHATSAPP_PHONE_ID в .env). Откройте ссылку WhatsApp в браузере или приложении.",
      });
    }

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: toDigits,
        type: "text",
        text: { body: String(message).slice(0, 4096) },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      ok: true,
      via: "cloud_api",
      message: "Сообщение отправлено через WhatsApp Business API",
      data: response.data,
      waUrl,
    });
  } catch (err) {
    console.error("WhatsApp send error:", err.response?.data || err);
    const fallbackUrl = buildWaMeUrl(req.body?.phone, String(req.body?.message || ""));
    res.status(500).json({
      message: "Ошибка при отправке через API. Можно отправить вручную по ссылке.",
      waUrl: fallbackUrl || undefined,
      details: err.response?.data || err.message,
    });
  }
});

// ================= GET все заявки =================
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const apps = await db
      .collection("applications")
      .find(
        {},
        {
          projection: {
            createdAt: 1,
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
            specialist: 1,
            source: 1,
            files: 1,
            protocolNumber: 1,
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

// ================= GET techreg payload =================
router.get("/:id/techreg-payload", async (req, res) => {
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

    const mapped = buildTechregPayload(application);
    return res.json({
      applicationId: id,
      generatedAt: new Date().toISOString(),
      ...mapped,
    });
  } catch (err) {
    console.error("GET TECHREG PAYLOAD ERROR:", err);
    return res.status(500).json({ message: "Ошибка формирования payload" });
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
    const now = new Date();
    const prevSpecialist = String(currentApp.specialist || "").trim();
    const nextSpecialist = String(formData.specialist || "").trim();
    const specialistChanged = nextSpecialist && nextSpecialist !== prevSpecialist;
    const previousSpecialistTimeline = Array.isArray(currentApp.specialistTimeline)
      ? currentApp.specialistTimeline
      : [];
    const nextSpecialistTimeline = specialistChanged
      ? [
          ...previousSpecialistTimeline,
          {
            from: prevSpecialist,
            to: nextSpecialist,
            changedAt: now.toISOString(),
            changedBy: String(formData.actorName || formData.updatedBy || "system"),
          },
        ]
      : previousSpecialistTimeline;

    const updateFilter = { _id: new ObjectId(id) };
    if (specialistChanged) {
      updateFilter.specialist = currentApp.specialist ?? "";
    }

    const updateSetPayload = {
      ...formData,
      updatedAt: now,
      ...(specialistChanged ? { specialistTimeline: nextSpecialistTimeline } : {}),
    };

    let result = await db.collection("applications").updateOne(
      updateFilter,
      {
        $set: updateSetPayload,
      }
    );

    if (result.matchedCount === 0) {
      const actual = await db.collection("applications").findOne(
        { _id: new ObjectId(id) },
        { projection: { specialist: 1 } }
      );

      // Идемпотентность для гонок: если нужный специалист уже установлен
      // параллельным запросом, считаем операцию успешной.
      if (
        specialistChanged &&
        actual &&
        String(actual.specialist || "").trim() === nextSpecialist
      ) {
        return res.json({ message: "Обновлено" });
      }

      // Fallback для кейса, когда в БД specialist был null/undefined/отсутствовал
      // и строгий CAS-фильтр не совпал, хотя параллельной правки не было.
      result = await db.collection("applications").updateOne(
        { _id: new ObjectId(id) },
        { $set: updateSetPayload }
      );
      if (result.matchedCount > 0) {
        // продолжаем обычный поток ниже (включая один audit log)
      } else {
        return res.status(409).json({ message: "Заявка была изменена параллельно, обновите страницу" });
      }
    }

    const knownMetaKeys = new Set(["actorName", "updatedBy", "sourcePage", "files", "activityLogs"]);
    const changedBusinessKeys = Object.keys(formData || {}).filter(
      (key) => !knownMetaKeys.has(key)
    );
    const specialistOnlyUpdate =
      changedBusinessKeys.length > 0 &&
      changedBusinessKeys.every((key) => key === "specialist");

    if (!specialistOnlyUpdate) {
      await writeAuditLog(db, {
        action: "update_application",
        actorName: String(formData.actorName || formData.updatedBy || "system"),
        targetType: "application",
        targetId: id,
        targetLabel: `${currentApp.fio || ""} | ${currentApp.vin || ""}`.trim(),
        details: {
          protocolNumber: formData.protocolNumber || currentApp.protocolNumber || "",
          page: String(formData.sourcePage || "Не указана"),
          specialist: formData.specialist || currentApp.specialist || "",
          fio: currentApp.fio || "",
          vin: currentApp.vin || "",
        },
      });
    }

    if (specialistChanged) {
      const actorForSpecialist = String(formData.actorName || formData.updatedBy || "system");
      const pageForSpecialist = String(formData.sourcePage || "Не указана");
      const previousSpecialistEvent = previousSpecialistTimeline[previousSpecialistTimeline.length - 1];
      const specialistStartedAt = previousSpecialistEvent?.changedAt
        ? new Date(previousSpecialistEvent.changedAt)
        : new Date(currentApp.createdAt || now);
      const specialistDuration = Math.max(
        0,
        Math.round((now.getTime() - specialistStartedAt.getTime()) / 60000)
      );

      await writeAuditLog(db, {
        action: "specialist_change",
        actorName: actorForSpecialist,
        targetType: "application",
        targetId: id,
        targetLabel: `${currentApp.fio || ""} | ${currentApp.vin || ""}`.trim(),
        startedAt: specialistStartedAt,
        finishedAt: now,
        durationMinutes: specialistDuration,
        details: {
          fromSpecialist: prevSpecialist,
          toSpecialist: nextSpecialist,
          page: pageForSpecialist,
          protocolNumber: formData.protocolNumber || currentApp.protocolNumber || "",
          specialist: nextSpecialist,
          fio: currentApp.fio || "",
          vin: currentApp.vin || "",
        },
      });
    }

    res.json({ message: "Обновлено" });
  } catch (err) {
    console.error("PUT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= PATCH status =================
router.patch("/:id/status", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { status1 = "", actorName = "system", sourcePage = "", specialist = "" } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    const collection = db.collection("applications");
    const current = await collection.findOne({ _id: new ObjectId(id) });
    if (!current) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const now = new Date();
    const nextStatus = String(status1 || "").trim();
    const prevStatus = String(current.status1 || "").trim();
    if (nextStatus === prevStatus) {
      return res.json({
        createdAt: current.createdAt,
        status1: current.status1,
        fio: current.fio,
        vin: current.vin,
        typ: current.typ,
        brand: current.brand,
        model: current.model,
        year: current.year,
        volume: current.volume,
        broker: current.broker,
        files: current.files,
        protocolNumber: current.protocolNumber,
        executionDurationMinutes: current.executionDurationMinutes || null,
        waitingPhotoDurationMinutes: current.waitingPhotoDurationMinutes || null,
        waitingCallDurationMinutes: current.waitingCallDurationMinutes || null,
      });
    }
    const existingTimeline = Array.isArray(current.statusTimeline) ? current.statusTimeline : [];
    const existingLogs = Array.isArray(current.activityLogs) ? current.activityLogs : [];

    const nextTimeline = [...existingTimeline];
    if (nextStatus && nextStatus !== prevStatus) {
      nextTimeline.push({
        from: prevStatus,
        to: nextStatus,
        changedAt: now.toISOString(),
        changedBy: String(actorName || "system"),
      });
    }

    const statusStartItem = [...nextTimeline]
      .reverse()
      .find((item) => String(item.to || "").toLowerCase().includes("выполня"));

    let executionDurationMinutes = current.executionDurationMinutes || null;
    let waitingPhotoDurationMinutes = current.waitingPhotoDurationMinutes || null;
    let waitingCallDurationMinutes = current.waitingCallDurationMinutes || null;
    if (nextStatus.toLowerCase().includes("выпущ")) {
      if (statusStartItem?.changedAt) {
        const startMs = new Date(statusStartItem.changedAt).getTime();
        if (!Number.isNaN(startMs)) {
          executionDurationMinutes = Math.max(0, Math.round((now.getTime() - startMs) / 60000));
        }
      }
    }
    if (nextStatus.toLowerCase().includes("фото есть")) {
      const photoStartItem = [...nextTimeline]
        .reverse()
        .find((item) => {
          const value = String(item.to || "").toLowerCase();
          return value.includes("ждем фото") || value.includes("ждет фото");
        });
      if (photoStartItem?.changedAt) {
        const startMs = new Date(photoStartItem.changedAt).getTime();
        if (!Number.isNaN(startMs)) {
          waitingPhotoDurationMinutes = Math.max(0, Math.round((now.getTime() - startMs) / 60000));
        }
      }
    }
    if (nextStatus.toLowerCase().includes("прозвон есть")) {
      const waitingCallItem = [...nextTimeline]
        .reverse()
        .find((item) => {
          const value = String(item.to || "").toLowerCase();
          return value.includes("ждет прозвона") || value.includes("ждем прозвона");
        });
      if (waitingCallItem?.changedAt) {
        const startMs = new Date(waitingCallItem.changedAt).getTime();
        if (!Number.isNaN(startMs)) {
          waitingCallDurationMinutes = Math.max(0, Math.round((now.getTime() - startMs) / 60000));
        }
      }
    }

    const nextLogs = [
      ...existingLogs,
      {
        action: "status_change",
        from: prevStatus,
        to: nextStatus,
        by: String(actorName || "system"),
        at: now.toISOString(),
      },
    ];

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id), status1: prevStatus },
      {
        $set: {
          status1: nextStatus,
          updatedAt: now,
          statusTimeline: nextTimeline,
          activityLogs: nextLogs,
          executionDurationMinutes,
          waitingPhotoDurationMinutes,
          waitingCallDurationMinutes,
        },
        $unset: { status2: "" },
      },
      {
        returnDocument: "after",
        projection: {
          createdAt: 1,
          status1: 1,
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
          executionDurationMinutes: 1,
          waitingPhotoDurationMinutes: 1,
          waitingCallDurationMinutes: 1,
        },
      }
    );
    const updatedDoc = result?.value || result || {};

    // Защита от дублей: если параллельный запрос уже сменил этот же статус,
    // не пишем повторный лог status_change.
    if (!updatedDoc || !updatedDoc._id) {
      const actual = await collection.findOne(
        { _id: new ObjectId(id) },
        {
          projection: {
            createdAt: 1,
            status1: 1,
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
            executionDurationMinutes: 1,
            waitingPhotoDurationMinutes: 1,
            waitingCallDurationMinutes: 1,
          },
        }
      );

      if (actual && String(actual.status1 || "").trim() === nextStatus) {
        return res.json(actual);
      }
      return res.status(409).json({ message: "Статус был изменен параллельным запросом" });
    }

    // Для всех переходов статуса считаем интервал от предыдущей смены статуса.
    const prevStatusEvent = existingTimeline[existingTimeline.length - 1];
    let startedAt = prevStatusEvent?.changedAt
      ? new Date(prevStatusEvent.changedAt)
      : new Date(current.createdAt || now);
    if (Number.isNaN(startedAt.getTime())) startedAt = now;
    const finishedDuration = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000));

    await writeAuditLog(db, {
      action: "status_change",
      actorName: String(actorName || "system"),
      targetType: "application",
      targetId: id,
      startedAt,
      finishedAt: now,
      durationMinutes: finishedDuration,
      details: {
        from: prevStatus,
        to: nextStatus,
        page: String(sourcePage || "Не указана"),
        protocolNumber: updatedDoc.protocolNumber || current.protocolNumber || "",
        specialist: String(specialist || "").trim(),
        fio: updatedDoc.fio || current.fio || "",
        vin: updatedDoc.vin || current.vin || "",
      },
      targetLabel: `${updatedDoc.fio || current.fio || ""} | ${updatedDoc.vin || current.vin || ""}`.trim(),
    });

    return res.json(updatedDoc);
  } catch (err) {
    console.error("PATCH STATUS ERROR:", err);
    return res.status(500).json({ message: "Ошибка обновления статуса" });
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

    const actorName = String(req.body?.actorName || req.query?.actorName || "system");
    const sourcePage = String(req.body?.sourcePage || req.query?.sourcePage || "Не указана");
    const application = await db.collection("applications").findOne({ _id: new ObjectId(id) });

    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const result = await db
      .collection("applications")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    await writeAuditLog(db, {
      action: "delete_application",
      actorName,
      targetType: "application",
      targetId: id,
      targetLabel: `${application.fio || ""} | ${application.vin || ""}`.trim(),
      details: {
        page: sourcePage,
        protocolNumber: application.protocolNumber || "",
        specialist: application.specialist || "",
        fio: application.fio || "",
        vin: application.vin || "",
      },
    });

    res.json({ message: "Заявка удалена" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

export default router;