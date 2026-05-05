import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";

const router = express.Router();

const COLLECTION = "mailBoardCards";

const uploadDir = path.join(process.cwd(), "uploads", "mail-board");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "file").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const defaultColumns = () => [
  { id: "new", title: "Новая заявка (почта)" },
  { id: "progress", title: "В работе" },
  { id: "waiting", title: "Ожидаем ответ" },
  { id: "done", title: "Готово" },
];

function verifyInboundSecret(req) {
  const secret = process.env.MAIL_INBOUND_SECRET;
  if (!secret) {
    return { ok: false, status: 503, message: "MAIL_INBOUND_SECRET не задан в .env сервера" };
  }
  const provided =
    req.body?.secret ||
    req.headers["x-mail-inbound-secret"] ||
    req.query?.secret;
  if (provided !== secret) {
    return { ok: false, status: 401, message: "Неверный ключ входящей почты" };
  }
  return { ok: true };
}

async function createCardFromEmail(db, payload) {
  const {
    from = "",
    subject = "",
    text = "",
    html = "",
    messageId = "",
  } = payload;

  const bodyText = String(text || "").trim() || String(html || "").replace(/<[^>]+>/g, " ").trim();

  if (messageId) {
    const dup = await db.collection(COLLECTION).findOne({ externalMessageId: String(messageId) });
    if (dup) {
      return { duplicate: true, card: dup };
    }
  }

  const title =
    String(subject || "").trim() ||
    bodyText.slice(0, 120) ||
    "Письмо без темы";

  const doc = {
    columnId: "new",
    title,
    bodyText: bodyText.slice(0, 20000),
    fromEmail: String(from).slice(0, 500),
    source: "email",
    externalMessageId: messageId ? String(messageId) : "",
    attachments: [],
    comments: [],
    sortOrder: Date.now(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const r = await db.collection(COLLECTION).insertOne(doc);
  return { duplicate: false, card: { ...doc, _id: r.insertedId } };
}

/** GET колонки + карточки */
router.get("/", async (_req, res) => {
  try {
    const db = getDB();
    const cards = await db
      .collection(COLLECTION)
      .find({})
      .sort({ columnId: 1, sortOrder: -1, createdAt: -1 })
      .toArray();
    res.json({ columns: defaultColumns(), cards });
  } catch (err) {
    console.error("MAIL_BOARD GET:", err);
    res.status(500).json({ message: "Ошибка загрузки доски" });
  }
});

/** Ручная карточка */
router.post("/cards", express.json(), async (req, res) => {
  try {
    const db = getDB();
    const title = String(req.body?.title || "").trim() || "Без названия";
    const bodyText = String(req.body?.bodyText || "").trim();
    const columnId = String(req.body?.columnId || "new");
    const allowed = new Set(["new", "progress", "waiting", "done"]);
    const col = allowed.has(columnId) ? columnId : "new";

    const doc = {
      columnId: col,
      title,
      bodyText: bodyText.slice(0, 20000),
      fromEmail: "",
      source: "manual",
      externalMessageId: "",
      attachments: [],
      comments: [],
      sortOrder: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const r = await db.collection(COLLECTION).insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (err) {
    console.error("MAIL_BOARD POST card:", err);
    res.status(500).json({ message: "Ошибка создания карточки" });
  }
});

/** Перенос колонки / порядок */
router.patch("/cards/:id", express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    const db = getDB();
    const patch = { updatedAt: new Date() };
    const allowed = new Set(["new", "progress", "waiting", "done"]);
    if (req.body?.columnId !== undefined) {
      const c = String(req.body.columnId);
      if (!allowed.has(c)) return res.status(400).json({ message: "Неверная колонка" });
      patch.columnId = c;
    }
    if (req.body?.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
      patch.sortOrder = Number(req.body.sortOrder);
    }
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: patch },
      { returnDocument: "after" }
    );
    if (!r.value) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(r.value);
  } catch (err) {
    console.error("MAIL_BOARD PATCH:", err);
    res.status(500).json({ message: "Ошибка обновления" });
  }
});

/** Комментарий */
router.post("/cards/:id/comments", express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Пустой комментарий" });
    const authorName = String(req.body?.authorName || "user").slice(0, 200);
    const comment = {
      _id: new ObjectId(),
      text: text.slice(0, 8000),
      authorName,
      createdAt: new Date(),
    };
    const db = getDB();
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $push: { comments: comment }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!r.value) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(r.value);
  } catch (err) {
    console.error("MAIL_BOARD COMMENT:", err);
    res.status(500).json({ message: "Ошибка комментария" });
  }
});

/** Вложение к карточке */
router.post("/cards/:id/attachments", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    if (!req.file) return res.status(400).json({ message: "Нет файла" });

    const att = {
      filename: req.file.filename,
      originalname: req.file.originalname || req.file.filename,
      mimetype: req.file.mimetype || "",
      size: req.file.size || 0,
    };
    const db = getDB();
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $push: { attachments: att }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!r.value) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(r.value);
  } catch (err) {
    console.error("MAIL_BOARD ATTACH:", err);
    res.status(500).json({ message: "Ошибка загрузки файла" });
  }
});

router.delete("/cards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    const db = getDB();
    const card = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    if (!card) return res.status(404).json({ message: "Не найдено" });
    for (const a of card.attachments || []) {
      if (a?.filename) {
        const fp = path.join(uploadDir, a.filename);
        try {
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch {
          /* ignore */
        }
      }
    }
    await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
    res.json({ ok: true });
  } catch (err) {
    console.error("MAIL_BOARD DELETE:", err);
    res.status(500).json({ message: "Ошибка удаления" });
  }
});

/**
 * Входящее письмо → первая колонка.
 * JSON: { secret, from, subject, text, html?, messageId? }
 */
router.post("/inbound", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const v = verifyInboundSecret(req);
    if (!v.ok) return res.status(v.status).json({ message: v.message });

    const db = getDB();
    const result = await createCardFromEmail(db, {
      from: req.body?.from || req.body?.sender,
      subject: req.body?.subject,
      text: req.body?.text || req.body?.body || req.body?.["body-plain"],
      html: req.body?.html || req.body?.["body-html"],
      messageId: req.body?.messageId || req.body?.["Message-Id"] || req.body?.message_id,
    });
    res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      duplicate: result.duplicate,
      cardId: String(result.card._id),
    });
  } catch (err) {
    console.error("MAIL_BOARD INBOUND:", err);
    res.status(500).json({ message: "Ошибка приёма письма" });
  }
});

/**
 * Mailgun / форма: sender, subject, body-plain, …
 * Поле secret в query: ?secret=...
 */
router.post(
  "/inbound/mailgun",
  express.urlencoded({ extended: true, limit: "2mb" }),
  async (req, res) => {
    try {
      const v = verifyInboundSecret(req);
      if (!v.ok) return res.status(v.status).json({ message: v.message });

      const db = getDB();
      const result = await createCardFromEmail(db, {
        from: req.body?.sender || req.body?.from,
        subject: req.body?.subject,
        text: req.body?.["body-plain"] || req.body?.stripped_text || req.body?.body,
        html: req.body?.["body-html"] || req.body?.stripped_html,
        messageId: req.body?.["Message-Id"] || req.body?.message_id,
      });
      res.status(result.duplicate ? 200 : 201).send("OK");
    } catch (err) {
      console.error("MAIL_BOARD INBOUND MAILGUN:", err);
      res.status(500).send("ERR");
    }
  }
);

export default router;
