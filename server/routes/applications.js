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

    const newApp = {
      ...formData,
      files: mergedFiles,
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

    const result = await db.collection("applications").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...formData,
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

export default router;