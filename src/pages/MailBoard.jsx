import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";
import "../styles/MailBoard.css";

const user = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export default function MailBoard() {
  const [columns, setColumns] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [dragCardId, setDragCardId] = useState(null);

  const load = useCallback(async () => {
    try {
      setErr("");
      const res = await axios.get(`${API_URL}/api/mail-board`);
      setColumns(res.data.columns || []);
      setCards(res.data.cards || []);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить доску");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  const cardsByColumn = useMemo(() => {
    const m = {};
    for (const col of columns) m[col.id] = [];
    for (const c of cards) {
      const colId = c.columnId || "new";
      if (!m[colId]) m[colId] = [];
      m[colId].push(c);
    }
    return m;
  }, [cards, columns]);

  const moveCard = async (cardId, columnId) => {
    try {
      const res = await axios.patch(`${API_URL}/api/mail-board/cards/${cardId}`, {
        columnId,
        sortOrder: Date.now(),
      });
      setCards((prev) => prev.map((c) => (String(c._id) === cardId ? res.data : c)));
    } catch (e) {
      console.error(e);
      alert("Не удалось переместить карточку");
      load();
    }
  };

  const onDragStart = (e, cardId) => {
    setDragCardId(cardId);
    e.dataTransfer.setData("text/card-id", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropColumn = async (e, columnId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/card-id") || dragCardId;
    setDragCardId(null);
    if (!id) return;
    await moveCard(id, columnId);
  };

  const addManualCard = async () => {
    const title = newTitle.trim();
    if (!title) {
      alert("Укажите заголовок");
      return;
    }
    try {
      await axios.post(`${API_URL}/api/mail-board/cards`, {
        columnId: "new",
        title,
        bodyText: newBody.trim(),
      });
      setNewTitle("");
      setNewBody("");
      load();
    } catch (e) {
      console.error(e);
      alert("Ошибка создания карточки");
    }
  };

  const addComment = async (cardId, text) => {
    if (!text.trim()) return;
    try {
      const u = user();
      const res = await axios.post(`${API_URL}/api/mail-board/cards/${cardId}/comments`, {
        text: text.trim(),
        authorName: u?.login || u?.name || "user",
      });
      setCards((prev) => prev.map((c) => (String(c._id) === cardId ? res.data : c)));
    } catch (e) {
      console.error(e);
      alert("Не удалось добавить комментарий");
    }
  };

  const uploadFile = async (cardId, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await axios.post(`${API_URL}/api/mail-board/cards/${cardId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCards((prev) => prev.map((c) => (String(c._id) === cardId ? res.data : c)));
    } catch (e) {
      console.error(e);
      alert("Ошибка загрузки файла");
    }
  };

  const removeCard = async (cardId) => {
    if (!window.confirm("Удалить карточку?")) return;
    try {
      await axios.delete(`${API_URL}/api/mail-board/cards/${cardId}`);
      setCards((prev) => prev.filter((c) => String(c._id) !== cardId));
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  if (loading) {
    return <div className="mail-board-page mail-board-loading">Загрузка доски…</div>;
  }

  return (
    <div className="mail-board-page">
      <div className="mail-board-head">
        <div>
          <h2>Почта — канбан</h2>
          <p className="mail-board-sub">
            Письма с вебхука попадают в первую колонку. Карточки можно перетаскивать между колонками,
            добавлять файлы и комментарии.
          </p>
        </div>
        <button type="button" className="mail-board-refresh" onClick={() => load()}>
          Обновить
        </button>
      </div>

      {err && <div className="mail-board-error">{err}</div>}

      <div className="mail-board-hint">
        <b>Входящая почта:</b> задайте в <code>.env</code> сервера переменную{" "}
        <code>MAIL_INBOUND_SECRET</code>, затем настройте POST на{" "}
        <code>
          {API_URL}/api/mail-board/inbound?secret=ВАШ_СЕКРЕТ
        </code>{" "}
        (JSON: <code>from</code>, <code>subject</code>, <code>text</code>, опционально{" "}
        <code>messageId</code>) или Mailgun на{" "}
        <code>{API_URL}/api/mail-board/inbound/mailgun?secret=…</code>.
      </div>

      <div className="mail-board-create">
        <input
          type="text"
          placeholder="Новая карточка — заголовок"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <textarea
          placeholder="Описание (необязательно)"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={2}
        />
        <button type="button" className="mail-board-btn-primary" onClick={addManualCard}>
          Добавить карточку
        </button>
      </div>

      <div className="mail-board-columns">
        {columns.map((col) => (
          <div
            key={col.id}
            className="mail-board-column"
            onDragOver={onDragOver}
            onDrop={(e) => onDropColumn(e, col.id)}
          >
            <div className="mail-board-column-title">{col.title}</div>
            <div className="mail-board-column-inner">
              {(cardsByColumn[col.id] || []).map((card) => (
                <article
                  key={String(card._id)}
                  className="mail-board-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, String(card._id))}
                >
                  <div className="mail-board-card-head">
                    <h3>{card.title}</h3>
                    <select
                      aria-label="Колонка"
                      value={card.columnId}
                      onChange={(e) => moveCard(String(card._id), e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {card.fromEmail && (
                    <div className="mail-board-meta">От: {card.fromEmail}</div>
                  )}
                  {card.bodyText && <p className="mail-board-body">{card.bodyText}</p>}

                  <div className="mail-board-files">
                    {(card.attachments || []).map((a) => (
                      <a
                        key={a.filename}
                        href={`${API_URL}/uploads/mail-board/${a.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.originalname || a.filename}
                      </a>
                    ))}
                  </div>

                  <label className="mail-board-upload">
                    Файл / фото
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadFile(String(card._id), f);
                      }}
                    />
                  </label>

                  <div className="mail-board-comments">
                    {(card.comments || []).map((cm) => (
                      <div key={String(cm._id)} className="mail-board-comment">
                        <span className="mail-board-comment-author">{cm.authorName}</span>
                        <span className="mail-board-comment-date">
                          {cm.createdAt ? new Date(cm.createdAt).toLocaleString("ru-RU") : ""}
                        </span>
                        <div>{cm.text}</div>
                      </div>
                    ))}
                  </div>

                  <CommentForm onSubmit={(text) => addComment(String(card._id), text)} />

                  <div className="mail-board-card-actions">
                    <button type="button" className="mail-board-btn-danger" onClick={() => removeCard(String(card._id))}>
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentForm({ onSubmit }) {
  const [text, setText] = useState("");
  return (
    <form
      className="mail-board-comment-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
        setText("");
      }}
    >
      <input
        type="text"
        placeholder="Комментарий…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit">Ок</button>
    </form>
  );
}
