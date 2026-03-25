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
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: uploadFolder,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ================= POST /save =================
router.post("/save", upload.any(), async (req, res) => {
  try {
    const db = getDB();
    const formData = JSON.parse(req.body.form);
    const filesData = {};

    for (const file of req.files) {
  if (!filesData[file.fieldname]) filesData[file.fieldname] = [];
  filesData[file.fieldname].push({
    savedName: file.filename,       // имя на сервере
    originalName: file.originalname // имя, которое было у пользователя
  });
}


    const newApp = {
      ...formData,
      files: filesData,
      createdAt: new Date(),
    };

    // Убираем лишний _id, если пришел с фронта
    delete newApp._id;

    const result = await db.collection("applications").insertOne(newApp);

    // Возвращаем вставленный _id фронту
    res.json({ message: "Сохранено", _id: result.insertedId.toString() });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ message: "Номер телефона и сообщение обязательны" });
    }

    // Пример с WhatsApp Cloud API
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // токен из Meta
    const PHONE_ID = process.env.WHATSAPP_PHONE_ID; // id вашего номера

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message }
      },
      {
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
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

    const apps = await db.collection("applications")
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

    const formData = JSON.parse(req.body.form);
    const filesData = {};

    for (const file of req.files) {
      if (!filesData[file.fieldname]) filesData[file.fieldname] = [];
      filesData[file.fieldname].push(file.filename);
    }

    if (Object.keys(filesData).length > 0) {
      formData.files = { ...(formData.files || {}), ...filesData };
    }

    const result = await db.collection("applications").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...formData, updatedAt: new Date() } }
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
