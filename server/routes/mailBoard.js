import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";

const router = express.Router();

const COLLECTION = "mailBoardCards";
const COLUMN_CONFIG_COLLECTION = "mailBoardColumnConfig";
const COLUMN_DOC_ID = "singleton";

/** На Render/других PaaS диск эфемерный — задайте MAIL_BOARD_UPLOAD_DIR на Persistent Disk. */
const uploadDir = process.env.MAIL_BOARD_UPLOAD_DIR
  ? path.resolve(process.env.MAIL_BOARD_UPLOAD_DIR)
  : path.join(process.cwd(), "uploads", "mail-board");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.info("[mail-board] uploadDir:", uploadDir);

const decodeUtf8Name = (name) => {
  const raw = String(name || "");
  try {
    return Buffer.from(raw, "latin1").toString("utf8");
  } catch {
    return raw;
  }
};

/** Имя на диске только ASCII — без проблем с URL и кодировкой ОС. */
const makeDiskFilename = (originalname) => {
  const raw = String(originalname || "file");
  let ext = path.extname(raw).toLowerCase().replace(/[^a-z0-9.]/g, "") || "";
  if (ext.length > 12) ext = ext.slice(0, 12);
  if (ext.length < 2 || ext === ".") ext = "";
  if (ext && !/^\.[a-z0-9]{1,10}$/.test(ext)) ext = "";
  return `${Date.now()}-${crypto.randomUUID()}${ext}`;
};

/**
 * Человекочитаемое имя для БД: не трогаем нормальный кириллический UTF-8;
 * для типичного mojibake (UTF-8 прочитанный как latin1) пробуем decodeUtf8Name.
 */
const normalizeDisplayName = (raw) => {
  const s = String(raw || "").replace(/\0/g, "").trim() || "file";
  if (/[\u0400-\u04FF]/.test(s)) return s.slice(0, 500);
  const fixed = decodeUtf8Name(s);
  if (fixed !== s && /[\u0400-\u04FF]/.test(fixed)) return fixed.slice(0, 500);
  return s.slice(0, 500);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    cb(null, makeDiskFilename(file.originalname || "file"));
  },
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

/** Раздача вложений (корректный decode URI; путь не выходит из uploadDir). */
router.get("/files/:filename", (req, res) => {
  let filename = "";
  try {
    filename = decodeURIComponent(String(req.params.filename || ""));
  } catch {
    return res.status(400).send("Bad filename encoding");
  }
  if (!filename || filename.includes("..") || /[/\\]/.test(filename)) {
    return res.status(400).send("Bad filename");
  }
  const base = path.basename(filename);
  if (base !== filename) return res.status(400).send("Bad filename");
  const fp = path.resolve(uploadDir, base);
  const root = path.resolve(uploadDir);
  if (!fp.startsWith(root + path.sep) && fp !== root) {
    return res.status(403).end();
  }
  if (!fs.existsSync(fp)) return res.status(404).send("Not found");
  res.sendFile(fp, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

if (process.env.RENDER) {
  console.warn(
    "[mail-board] Render: диск по умолчанию эфемерный — файлы в uploads/ пропадают после деплоя/перезапуска. Подключите Persistent Disk или S3."
  );
}

const defaultColumns = () => [
  { id: "new", title: "Новая заявка (почта)" },
  { id: "progress", title: "В работе" },
  { id: "waiting", title: "Ожидаем ответ" },
  { id: "done", title: "Готово" },
];

async function getColumnsFromDb(db) {
  const doc = await db.collection(COLUMN_CONFIG_COLLECTION).findOne({ _id: COLUMN_DOC_ID });
  if (!doc?.columns?.length) {
    const columns = defaultColumns().map((c, i) => ({ ...c, sortOrder: i }));
    await db.collection(COLUMN_CONFIG_COLLECTION).insertOne({
      _id: COLUMN_DOC_ID,
      columns,
      updatedAt: new Date(),
    });
    return columns;
  }
  return [...doc.columns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function setColumnsInDb(db, columns) {
  await db.collection(COLUMN_CONFIG_COLLECTION).updateOne(
    { _id: COLUMN_DOC_ID },
    { $set: { columns, updatedAt: new Date() } },
    { upsert: true }
  );
}

function columnIdSet(columns) {
  return new Set(columns.map((c) => String(c.id)));
}

function unwrapUpdatedDoc(result) {
  if (!result) return null;
  if (result.value) return result.value;
  if (result._id) return result;
  return null;
}

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

  const columns = await getColumnsFromDb(db);
  const firstColId = columns[0]?.id || "new";

  const doc = {
    columnId: firstColId,
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
    const columns = await getColumnsFromDb(db);
    const cards = await db
      .collection(COLLECTION)
      .find({})
      .sort({ columnId: 1, sortOrder: -1, createdAt: -1 })
      .toArray();
    res.json({ columns, cards });
  } catch (err) {
    console.error("MAIL_BOARD GET:", err);
    res.status(500).json({ message: "Ошибка загрузки доски" });
  }
});

/** Добавить колонку */
router.post("/columns", express.json(), async (req, res) => {
  try {
    const db = getDB();
    const columns = await getColumnsFromDb(db);
    const title = String(req.body?.title || "").trim() || "Новая колонка";
    const id = `col_${Date.now()}`;
    const next = columns.map((c, i) => ({ id: c.id, title: c.title, sortOrder: c.sortOrder ?? i }));
    next.push({ id, title: title.slice(0, 120), sortOrder: next.length });
    await setColumnsInDb(db, next);
    res.json({ columns: next });
  } catch (err) {
    console.error("MAIL_BOARD POST column:", err);
    res.status(500).json({ message: "Ошибка добавления колонки" });
  }
});

/** Изменить порядок колонок */
router.put("/columns/reorder", express.json(), async (req, res) => {
  try {
    const raw = req.body?.columnIds;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ message: "Укажите columnIds — массив id колонок" });
    }
    const db = getDB();
    const columns = await getColumnsFromDb(db);
    const byId = new Map(columns.map((c) => [String(c.id), c]));
    const next = [];
    for (const id of raw) {
      const col = byId.get(String(id));
      if (col) {
        next.push({ ...col, sortOrder: next.length });
        byId.delete(String(col.id));
      }
    }
    for (const col of columns) {
      if (byId.has(String(col.id))) {
        next.push({ ...col, sortOrder: next.length });
        byId.delete(String(col.id));
      }
    }
    await setColumnsInDb(db, next);
    res.json({ columns: next });
  } catch (err) {
    console.error("MAIL_BOARD PUT columns/reorder:", err);
    res.status(500).json({ message: "Ошибка изменения порядка колонок" });
  }
});

/** Переименовать колонку */
router.patch("/columns/:columnId", express.json(), async (req, res) => {
  try {
    const columnId = decodeURIComponent(String(req.params.columnId || ""));
    const title = String(req.body?.title ?? "").trim();
    if (!columnId) return res.status(400).json({ message: "Не указана колонка" });
    if (!title) return res.status(400).json({ message: "Пустое название" });
    const db = getDB();
    const columns = await getColumnsFromDb(db);
    const idx = columns.findIndex((c) => String(c.id) === columnId);
    if (idx < 0) return res.status(404).json({ message: "Колонка не найдена" });
    const next = columns.map((c) =>
      String(c.id) === columnId ? { ...c, title: title.slice(0, 120), sortOrder: c.sortOrder ?? 0 } : c
    );
    await setColumnsInDb(db, next);
    res.json({ columns: next });
  } catch (err) {
    console.error("MAIL_BOARD PATCH column:", err);
    res.status(500).json({ message: "Ошибка переименования колонки" });
  }
});

/** Удалить колонку (карточки переносятся в первую оставшуюся) */
router.delete("/columns/:columnId", async (req, res) => {
  try {
    const columnId = decodeURIComponent(String(req.params.columnId || ""));
    if (!columnId) return res.status(400).json({ message: "Не указана колонка" });
    const db = getDB();
    const columns = await getColumnsFromDb(db);
    if (columns.length <= 1) {
      return res.status(400).json({ message: "Нельзя удалить последнюю колонку" });
    }
    const idx = columns.findIndex((c) => String(c.id) === columnId);
    if (idx < 0) return res.status(404).json({ message: "Колонка не найдена" });
    const next = columns.filter((c) => String(c.id) !== columnId).map((c, i) => ({ ...c, sortOrder: i }));
    const fallbackId = next[0]?.id;
    if (!fallbackId) return res.status(500).json({ message: "Нет колонки для переноса карточек" });
    await db.collection(COLLECTION).updateMany(
      { columnId: columnId },
      { $set: { columnId: fallbackId, updatedAt: new Date() } }
    );
    await setColumnsInDb(db, next);
    const cards = await db
      .collection(COLLECTION)
      .find({})
      .sort({ columnId: 1, sortOrder: -1, createdAt: -1 })
      .toArray();
    res.json({ columns: next, cards });
  } catch (err) {
    console.error("MAIL_BOARD DELETE column:", err);
    res.status(500).json({ message: "Ошибка удаления колонки" });
  }
});

/** Ручная карточка */
router.post("/cards", express.json(), async (req, res) => {
  try {
    const db = getDB();
    const columns = await getColumnsFromDb(db);
    const allowed = columnIdSet(columns);
    const title = String(req.body?.title || "").trim() || "Без названия";
    const bodyText = String(req.body?.bodyText || "").trim();
    const requested = String(req.body?.columnId || columns[0]?.id || "new");
    const col = allowed.has(requested) ? requested : columns[0]?.id || "new";

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
    const columns = await getColumnsFromDb(db);
    const allowed = columnIdSet(columns);
    const patch = { updatedAt: new Date() };
    if (req.body?.columnId !== undefined) {
      const c = String(req.body.columnId);
      if (!allowed.has(c)) return res.status(400).json({ message: "Неверная колонка" });
      patch.columnId = c;
    }
    if (req.body?.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
      patch.sortOrder = Number(req.body.sortOrder);
    }
    if (req.body?.title !== undefined) {
      patch.title = String(req.body.title || "").trim().slice(0, 500) || "Без названия";
    }
    if (req.body?.bodyText !== undefined) {
      patch.bodyText = String(req.body.bodyText || "").trim().slice(0, 20000);
    }
    if (req.body?.coverAttachment !== undefined) {
      const cover = String(req.body.coverAttachment || "").trim();
      patch.coverAttachment = cover || "";
    }
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: patch },
      { returnDocument: "after" }
    );
    const updated = unwrapUpdatedDoc(r);
    if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(updated);
  } catch (err) {
    console.error("MAIL_BOARD PATCH:", err);
    res.status(500).json({ message: "Ошибка обновления" });
  }
});

router.patch("/cards/:id/attachments/:filename", express.json(), async (req, res) => {
  try {
    const { id, filename } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    const decodedFilename = decodeURIComponent(String(filename || ""));
    if (!decodedFilename) return res.status(400).json({ message: "Не указано вложение" });

    const db = getDB();
    const card = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    if (!card) return res.status(404).json({ message: "Карточка не найдена" });
    const idx = (card.attachments || []).findIndex((a) => String(a?.filename) === decodedFilename);
    if (idx < 0) return res.status(404).json({ message: "Вложение не найдено" });

    const setPatch = { updatedAt: new Date() };
    if (req.body?.originalname !== undefined) {
      const originalname = String(req.body.originalname || "").trim().slice(0, 500);
      if (!originalname) return res.status(400).json({ message: "Имя файла пустое" });
      setPatch[`attachments.${idx}.originalname`] = originalname;
    }
    if (req.body?.setCover === true) {
      setPatch.coverAttachment = decodedFilename;
    }

    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: setPatch },
      { returnDocument: "after" }
    );
    const updated = unwrapUpdatedDoc(r);
    if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(updated);
  } catch (err) {
    console.error("MAIL_BOARD ATTACH PATCH:", err);
    res.status(500).json({ message: "Ошибка обновления вложения" });
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
    const updated = unwrapUpdatedDoc(r);
    if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(updated);
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
      originalname: normalizeDisplayName(req.file.originalname || req.file.filename),
      mimetype: req.file.mimetype || "",
      size: req.file.size || 0,
    };
    const db = getDB();
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $push: { attachments: att }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    const updated = unwrapUpdatedDoc(r);
    if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
    res.json(updated);
  } catch (err) {
    console.error("MAIL_BOARD ATTACH:", err);
    res.status(500).json({ message: "Ошибка загрузки файла" });
  }
});

router.delete("/cards/:id/attachments/:filename", async (req, res) => {
  try {
    const { id, filename } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Неверный ID" });
    const decodedFilename = decodeURIComponent(String(filename || ""));
    if (!decodedFilename) return res.status(400).json({ message: "Не указано вложение" });

    const db = getDB();
    const card = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    if (!card) return res.status(404).json({ message: "Карточка не найдена" });

    const attachment = (card.attachments || []).find((a) => String(a?.filename) === decodedFilename);
    if (!attachment) return res.status(404).json({ message: "Вложение не найдено" });

    const fp = path.join(uploadDir, decodedFilename);
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.warn("MAIL_BOARD ATTACH DELETE FILE WARN:", e?.message || e);
    }

    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $pull: { attachments: { filename: decodedFilename } },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" }
    );
    const updated = unwrapUpdatedDoc(r);
    if (!updated) return res.status(404).json({ message: "Карточка не найдена" });
    if (String(updated.coverAttachment || "") === decodedFilename) {
      const rr = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { coverAttachment: "", updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      const updated2 = unwrapUpdatedDoc(rr);
      return res.json(updated2 || updated);
    }
    res.json(updated);
  } catch (err) {
    console.error("MAIL_BOARD ATTACH DELETE:", err);
    res.status(500).json({ message: "Ошибка удаления вложения" });
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
