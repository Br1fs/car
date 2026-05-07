import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const decodeMojibake = (value) => {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    return decodeURIComponent(escape(raw));
  } catch {
    return raw;
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
  const [dragOverColumnId, setDragOverColumnId] = useState("");
  const [draggingCardId, setDraggingCardId] = useState("");
  const [openedCardId, setOpenedCardId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [inlineEditCardId, setInlineEditCardId] = useState("");
  const [inlineEditTitle, setInlineEditTitle] = useState("");
  const [pendingAttachmentDelete, setPendingAttachmentDelete] = useState(null);
  const deleteTimeoutRef = useRef(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [attachmentMenuFor, setAttachmentMenuFor] = useState("");
  const [editingColumnId, setEditingColumnId] = useState("");
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [editingColumnOriginal, setEditingColumnOriginal] = useState("");
  const [columnMenuFor, setColumnMenuFor] = useState("");

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

  const openedCard = useMemo(
    () => cards.find((c) => String(c._id) === String(openedCardId)) || null,
    [cards, openedCardId]
  );

  useEffect(() => {
    if (openedCard) {
      setEditingTitle(openedCard.title || "");
    }
  }, [openedCard]);

  useEffect(() => {
    if (!openedCard) {
      setPreviewAttachment(null);
      setAttachmentMenuFor("");
    }
  }, [openedCard]);

  useEffect(() => {
    if (!columnMenuFor) return undefined;
    const onDocMouseDown = (e) => {
      const root = e.target.closest?.(".mail-board-column-menu-root");
      if (!root) setColumnMenuFor("");
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [columnMenuFor]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    };
  }, []);

  const fileUrl = (filename) => `${API_URL}/uploads/mail-board/${filename}`;
  const displayAttachmentName = (a) => decodeMojibake(a?.originalname || a?.filename || "file");

  const isImageAttachment = (att) => {
    const mime = String(att?.mimetype || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(String(att?.filename || ""));
  };

  const getFirstImage = (card) => (card?.attachments || []).find((a) => isImageAttachment(a)) || null;
  const getCoverImage = (card) => {
    const selected = (card?.attachments || []).find(
      (a) => String(a?.filename) === String(card?.coverAttachment || "") && isImageAttachment(a)
    );
    return selected || getFirstImage(card);
  };

  const isPdfAttachment = (att) => {
    const mime = String(att?.mimetype || "").toLowerCase();
    if (mime.includes("pdf")) return true;
    return /\.pdf$/i.test(String(att?.filename || ""));
  };

  const extractVin = (card) => {
    const source = `${card?.title || ""} ${card?.bodyText || ""}`;
    const match = source.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    return match ? match[0] : "";
  };

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

  const patchCard = async (cardId, patch) => {
    const res = await axios.patch(`${API_URL}/api/mail-board/cards/${cardId}`, patch);
    setCards((prev) => prev.map((c) => (String(c._id) === String(cardId) ? res.data : c)));
    return res.data;
  };

  const saveTitle = async (cardId) => {
    const title = editingTitle.trim();
    if (!title) {
      alert("Заголовок не может быть пустым");
      return;
    }
    try {
      setSavingTitle(true);
      await patchCard(cardId, { title });
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить заголовок");
    } finally {
      setSavingTitle(false);
    }
  };

  const beginInlineEdit = (card) => {
    setInlineEditCardId(String(card._id));
    setInlineEditTitle(card.title || "");
  };

  const saveInlineTitle = async (cardId) => {
    const title = inlineEditTitle.trim();
    if (!title) {
      alert("Заголовок не может быть пустым");
      return;
    }
    try {
      await patchCard(cardId, { title });
      if (String(openedCardId) === String(cardId)) {
        setEditingTitle(title);
      }
      setInlineEditCardId("");
      setInlineEditTitle("");
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить заголовок");
    }
  };

  const onDragStart = (e, cardId) => {
    setDragCardId(cardId);
    setDraggingCardId(cardId);
    e.dataTransfer.setData("text/card-id", cardId);
    e.dataTransfer.effectAllowed = "move";
    const dragGhost = document.createElement("div");
    dragGhost.textContent = "Перемещение карточки";
    dragGhost.className = "mail-board-drag-ghost";
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 16, 16);
    requestAnimationFrame(() => {
      if (document.body.contains(dragGhost)) document.body.removeChild(dragGhost);
    });
  };

  const onDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) setDragOverColumnId(columnId);
  };

  const onDropColumn = async (e, columnId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/card-id") || dragCardId;
    setDragCardId(null);
    setDraggingCardId("");
    setDragOverColumnId("");
    if (!id) return;
    await moveCard(id, columnId);
  };

  const onDragEnd = () => {
    setDragCardId(null);
    setDraggingCardId("");
    setDragOverColumnId("");
  };

  const addManualCard = async () => {
    const title = newTitle.trim();
    if (!title) {
      alert("Укажите заголовок");
      return;
    }
    const firstCol = columns[0]?.id || "new";
    try {
      await axios.post(`${API_URL}/api/mail-board/cards`, {
        columnId: firstCol,
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

  const updateAttachment = async (cardId, filename, patch) => {
    const encoded = encodeURIComponent(filename);
    const res = await axios.patch(`${API_URL}/api/mail-board/cards/${cardId}/attachments/${encoded}`, patch);
    setCards((prev) => prev.map((c) => (String(c._id) === String(cardId) ? res.data : c)));
    return res.data;
  };

  const renameAttachment = async (cardId, attachment) => {
    const nextName = window.prompt("Новое имя файла:", displayAttachmentName(attachment));
    if (!nextName) return;
    try {
      await updateAttachment(cardId, attachment.filename, { originalname: nextName.trim() });
      setAttachmentMenuFor("");
    } catch (e) {
      console.error(e);
      alert("Не удалось изменить имя файла");
    }
  };

  const commentAttachment = async (cardId, attachment) => {
    const text = window.prompt("Комментарий к вложению:", `По вложению "${displayAttachmentName(attachment)}": `);
    if (!text || !text.trim()) return;
    await addComment(cardId, text);
    setAttachmentMenuFor("");
  };

  const setAttachmentCover = async (cardId, attachment) => {
    try {
      if (!isImageAttachment(attachment)) {
        alert("Обложкой можно сделать только изображение");
        return;
      }
      await updateAttachment(cardId, attachment.filename, { setCover: true });
      setAttachmentMenuFor("");
    } catch (e) {
      console.error(e);
      alert("Не удалось установить обложку");
    }
  };

  const downloadAttachment = (attachment) => {
    const link = document.createElement("a");
    link.href = fileUrl(attachment.filename);
    link.download = displayAttachmentName(attachment);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAttachmentMenuFor("");
  };

  const confirmDeleteAttachment = async ({ cardId, attachment }) => {
    try {
      const { filename, originalname } = attachment;
      const encoded = encodeURIComponent(filename);
      const res = await axios.delete(`${API_URL}/api/mail-board/cards/${cardId}/attachments/${encoded}`);
      setCards((prev) => prev.map((c) => (String(c._id) === String(cardId) ? res.data : c)));
    } catch (e) {
      console.error(e);
      alert(`Не удалось удалить вложение: ${displayAttachmentName({ originalname, filename })}`);
      load();
    }
  };

  const removeAttachment = (cardId, attachment) => {
    const filename = attachment?.filename;
    if (!filename) return;
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    setCards((prev) =>
      prev.map((c) =>
        String(c._id) === String(cardId)
          ? { ...c, attachments: (c.attachments || []).filter((a) => String(a.filename) !== String(filename)) }
          : c
      )
    );
    setPendingAttachmentDelete({ cardId, attachment });
    deleteTimeoutRef.current = setTimeout(async () => {
      const payload = { cardId, attachment };
      setPendingAttachmentDelete((current) => {
        if (
          current &&
          String(current.cardId) === String(payload.cardId) &&
          String(current.attachment?.filename) === String(payload.attachment?.filename)
        ) {
          return null;
        }
        return current;
      });
      deleteTimeoutRef.current = null;
      await confirmDeleteAttachment(payload);
    }, 5000);
  };

  const undoAttachmentDelete = () => {
    if (!pendingAttachmentDelete) return;
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    const { cardId, attachment } = pendingAttachmentDelete;
    setCards((prev) =>
      prev.map((c) =>
        String(c._id) === String(cardId)
          ? {
              ...c,
              attachments: [...(c.attachments || []), attachment],
            }
          : c
      )
    );
    setPendingAttachmentDelete(null);
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

  const openColumnEdit = (col) => {
    setColumnMenuFor("");
    setEditingColumnId(col.id);
    setEditingColumnTitle(col.title || "");
    setEditingColumnOriginal(col.title || "");
  };

  const cancelColumnEdit = () => {
    setEditingColumnId("");
    setEditingColumnTitle("");
    setEditingColumnOriginal("");
  };

  const commitColumnTitle = async () => {
    if (!editingColumnId) return;
    const title = editingColumnTitle.trim();
    if (!title) {
      alert("Название колонки не может быть пустым");
      setEditingColumnTitle(editingColumnOriginal);
      return;
    }
    if (title === String(editingColumnOriginal).trim()) {
      cancelColumnEdit();
      return;
    }
    try {
      const res = await axios.patch(
        `${API_URL}/api/mail-board/columns/${encodeURIComponent(editingColumnId)}`,
        { title }
      );
      setColumns(res.data.columns || []);
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить название колонки");
      load();
    } finally {
      setColumnMenuFor("");
      cancelColumnEdit();
    }
  };

  const addColumn = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/mail-board/columns`, { title: "Новая колонка" });
      setColumns(res.data.columns || []);
    } catch (e) {
      console.error(e);
      alert("Не удалось добавить колонку");
    }
  };

  const deleteColumn = async (columnId) => {
    if (columns.length <= 1) {
      alert("Нельзя удалить последнюю колонку");
      return;
    }
    if (!window.confirm("Удалить эту колонку? Карточки из неё перенесутся в первую колонку.")) return;
    setColumnMenuFor("");
    try {
      const res = await axios.delete(`${API_URL}/api/mail-board/columns/${encodeURIComponent(columnId)}`);
      setColumns(res.data.columns || []);
      setCards(res.data.cards || []);
      if (editingColumnId === columnId) cancelColumnEdit();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Не удалось удалить колонку";
      alert(msg);
      load();
    }
  };

  if (loading) {
    return <div className="mail-board-page mail-board-loading">Загрузка доски…</div>;
  }

  return (
    <div className="mail-board-page">
      <div className="mail-board-head">
        <div>
          <h2>Карточки</h2>
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

      <div className="mail-board-board-row">
        <div
          className="mail-board-columns"
          style={{
            gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(200px, 1fr))`,
          }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              className={`mail-board-column ${dragOverColumnId === col.id ? "mail-board-column-drop-target" : ""}`}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={(e) => onDropColumn(e, col.id)}
              onDragLeave={() => {
                if (dragOverColumnId === col.id) setDragOverColumnId("");
              }}
            >
              <div className="mail-board-column-title-wrap">
                <div className="mail-board-column-title-row">
                  {editingColumnId === col.id ? (
                    <input
                      className="mail-board-column-title-input"
                      type="text"
                      value={editingColumnTitle}
                      autoFocus
                      onChange={(e) => setEditingColumnTitle(e.target.value)}
                      onBlur={() => void commitColumnTitle()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void commitColumnTitle();
                        }
                        if (e.key === "Escape") cancelColumnEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="mail-board-column-title-btn"
                        title="Нажмите, чтобы изменить название"
                        onClick={() => openColumnEdit(col)}
                      >
                        {col.title}
                      </button>
                      <div
                        className="mail-board-column-menu-root"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="mail-board-column-kebab"
                          aria-label="Меню колонки"
                          title="Действия"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColumnMenuFor((prev) => (prev === col.id ? "" : col.id));
                          }}
                        >
                          ⋯
                        </button>
                        {columnMenuFor === col.id && (
                          <div className="mail-board-column-menu">
                            {columns.length > 1 ? (
                              <button
                                type="button"
                                className="mail-board-column-menu-danger"
                                onClick={() => void deleteColumn(col.id)}
                              >
                                Удалить колонку
                              </button>
                            ) : (
                              <div className="mail-board-column-menu-hint">Нельзя удалить последнюю колонку</div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mail-board-column-inner">
              {(cardsByColumn[col.id] || []).map((card) => (
                <article
                  key={String(card._id)}
                  className={`mail-board-card ${draggingCardId === String(card._id) ? "mail-board-card-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, String(card._id))}
                  onDragEnd={onDragEnd}
                  onClick={() => setOpenedCardId(String(card._id))}
                >
                  <div className="mail-board-card-head">
                    {inlineEditCardId === String(card._id) ? (
                      <input
                        className="mail-board-inline-title-input"
                        type="text"
                        value={inlineEditTitle}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setInlineEditTitle(e.target.value)}
                        onBlur={() => saveInlineTitle(String(card._id))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineTitle(String(card._id));
                          if (e.key === "Escape") {
                            setInlineEditCardId("");
                            setInlineEditTitle("");
                          }
                        }}
                      />
                    ) : (
                      <h3
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          beginInlineEdit(card);
                        }}
                        title="Двойной клик для изменения"
                      >
                        {card.title}
                      </h3>
                    )}
                    <select
                      aria-label="Колонка"
                      value={card.columnId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => moveCard(String(card._id), e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {extractVin(card) && <div className="mail-board-vin">VIN: {extractVin(card)}</div>}
                  {getCoverImage(card) && (
                    <img
                      className="mail-board-preview-image"
                      src={fileUrl(getCoverImage(card).filename)}
                      alt={card.title || "attachment"}
                    />
                  )}

                  <div className="mail-board-card-actions">
                    <button
                      type="button"
                      className="mail-board-btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCard(String(card._id));
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
        </div>
        <button
          type="button"
          className="mail-board-add-column"
          onClick={addColumn}
          title="Добавить колонку"
        >
          + Добавить
        </button>
      </div>
      {openedCard && (
        <div className="mail-board-modal-backdrop" onClick={() => setOpenedCardId(null)}>
          <div className="mail-board-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mail-board-modal-head">
              <h3>Карточка</h3>
              <button type="button" className="mail-board-refresh" onClick={() => setOpenedCardId(null)}>
                Закрыть
              </button>
            </div>

            <div className="mail-board-modal-layout">
              <div className="mail-board-modal-main">
                <div className="mail-board-modal-section">
                  <label className="mail-board-field-label">Заголовок</label>
                  <div className="mail-board-edit-title-row">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      placeholder="Заголовок"
                    />
                    <button
                      type="button"
                      className="mail-board-btn-primary"
                      disabled={savingTitle}
                      onClick={() => saveTitle(String(openedCard._id))}
                    >
                      {savingTitle ? "Сохранение..." : "Сохранить"}
                    </button>
                  </div>
                </div>

                {openedCard.fromEmail && <div className="mail-board-meta">От: {openedCard.fromEmail}</div>}
                {extractVin(openedCard) && <div className="mail-board-vin">VIN: {extractVin(openedCard)}</div>}
                {openedCard.bodyText && <p className="mail-board-body">{openedCard.bodyText}</p>}

                <div className="mail-board-attachments-top">
                  <div className="mail-board-attachments-title">Вложения</div>
                  <label className="mail-board-upload">
                    Добавить
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadFile(String(openedCard._id), f);
                      }}
                    />
                  </label>
                </div>

                <div className="mail-board-files">
                  {(openedCard.attachments || []).map((a) => (
                    <div key={a.filename} className="mail-board-file-row">
                      <button
                        type="button"
                        className="mail-board-file-open-inline"
                        onClick={() => {
                          setPreviewAttachment(a);
                          setAttachmentMenuFor("");
                        }}
                      >
                        {isImageAttachment(a) ? (
                          <img className="mail-board-file-thumb" src={fileUrl(a.filename)} alt={displayAttachmentName(a)} />
                        ) : (
                          <span className="mail-board-file-thumb mail-board-file-thumb-fallback">
                            {isPdfAttachment(a) ? "PDF" : "FILE"}
                          </span>
                        )}
                        <span className="mail-board-file-name">
                          {displayAttachmentName(a)}
                          {String(openedCard.coverAttachment || "") === String(a.filename) ? " (обложка)" : ""}
                        </span>
                      </button>
                      <div className="mail-board-file-actions">
                        <a
                          className="mail-board-file-open-page"
                          href={fileUrl(a.filename)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть
                        </a>
                        <button
                          type="button"
                          className="mail-board-file-menu-btn"
                          onClick={() =>
                            setAttachmentMenuFor((prev) =>
                              prev === String(a.filename) ? "" : String(a.filename)
                            )
                          }
                        >
                          ...
                        </button>
                        {attachmentMenuFor === String(a.filename) && (
                          <div className="mail-board-file-menu">
                            <button type="button" onClick={() => renameAttachment(String(openedCard._id), a)}>
                              Изменить (название)
                            </button>
                            <button type="button" onClick={() => commentAttachment(String(openedCard._id), a)}>
                              Комментировать
                            </button>
                            <button type="button" onClick={() => downloadAttachment(a)}>
                              Скачать
                            </button>
                            <button type="button" onClick={() => setAttachmentCover(String(openedCard._id), a)}>
                              Сделать обложкой
                            </button>
                            <button
                              type="button"
                              className="mail-board-file-menu-danger"
                              onClick={() => {
                                setAttachmentMenuFor("");
                                removeAttachment(String(openedCard._id), a);
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {previewAttachment && (
                  <div className="mail-board-inline-preview">
                    <div className="mail-board-inline-preview-head">
                      <strong>{displayAttachmentName(previewAttachment)}</strong>
                      <div className="mail-board-inline-preview-actions">
                        <a href={fileUrl(previewAttachment.filename)} target="_blank" rel="noopener noreferrer">
                          Открыть в отдельной странице
                        </a>
                        <button type="button" onClick={() => setPreviewAttachment(null)}>
                          Закрыть
                        </button>
                      </div>
                    </div>
                    {isImageAttachment(previewAttachment) ? (
                      <img
                        src={fileUrl(previewAttachment.filename)}
                        alt={displayAttachmentName(previewAttachment)}
                        className="mail-board-inline-preview-media"
                      />
                    ) : isPdfAttachment(previewAttachment) ? (
                      <iframe
                        src={fileUrl(previewAttachment.filename)}
                        title={displayAttachmentName(previewAttachment)}
                        className="mail-board-inline-preview-media mail-board-inline-preview-pdf"
                      />
                    ) : (
                      <div className="mail-board-inline-preview-fallback">
                        Предпросмотр недоступен для этого типа файла.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <aside className="mail-board-modal-side">
                <div className="mail-board-side-title">Комментарии</div>
                <div className="mail-board-comments">
                  {(openedCard.comments || []).map((cm) => (
                    <div key={String(cm._id)} className="mail-board-comment">
                      <span className="mail-board-comment-author">{cm.authorName}</span>
                      <span className="mail-board-comment-date">
                        {cm.createdAt ? new Date(cm.createdAt).toLocaleString("ru-RU") : ""}
                      </span>
                      <div>{cm.text}</div>
                    </div>
                  ))}
                </div>
                <CommentForm onSubmit={(text) => addComment(String(openedCard._id), text)} />
              </aside>
            </div>
          </div>
        </div>
      )}
      {pendingAttachmentDelete && (
        <div className="mail-board-toast">
          <span>
            Вложение удалится через 5 сек:{" "}
            {displayAttachmentName({
              originalname: pendingAttachmentDelete.attachment?.originalname,
              filename: pendingAttachmentDelete.attachment?.filename,
            })}
          </span>
          <button type="button" onClick={undoAttachmentDelete}>
            Отменить
          </button>
        </div>
      )}
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
