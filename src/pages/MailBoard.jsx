import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const extractVinFromCard = (card) => {
  const source = `${card?.title || ""} ${card?.bodyText || ""}`;
  const match = source.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return match ? match[0] : "";
};

const sortCardsInColumn = (list) =>
  [...list].sort((a, b) => {
    const sa = Number(a.sortOrder) || 0;
    const sb = Number(b.sortOrder) || 0;
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

const computeSortOrderForInsert = (sortedCards, insertIndex) => {
  const n = sortedCards.length;
  if (n === 0) return Date.now();
  if (insertIndex <= 0) {
    return (Number(sortedCards[0].sortOrder) || Date.now()) + 1000;
  }
  if (insertIndex >= n) {
    return (Number(sortedCards[n - 1].sortOrder) || Date.now()) - 1000;
  }
  const above = sortedCards[insertIndex - 1];
  const below = sortedCards[insertIndex];
  const gap = Number(above.sortOrder) - Number(below.sortOrder);
  if (gap > 1) {
    return (Number(above.sortOrder) + Number(below.sortOrder)) / 2;
  }
  return null;
};

export default function MailBoard() {
  const [columns, setColumns] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCardFiles, setNewCardFiles] = useState([]);
  const [creatingCard, setCreatingCard] = useState(false);
  const newCardFilesInputRef = useRef(null);
  const [dragCardId, setDragCardId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState("");
  const [draggingCardId, setDraggingCardId] = useState("");
  const [openedCardId, setOpenedCardId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState("");
  const [savingBody, setSavingBody] = useState(false);
  const [inlineEditCardId, setInlineEditCardId] = useState("");
  const [inlineEditTitle, setInlineEditTitle] = useState("");
  const [pendingAttachmentDelete, setPendingAttachmentDelete] = useState(null);
  const deleteTimeoutRef = useRef(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [attachmentMenuFor, setAttachmentMenuFor] = useState("");
  const [attachmentMenuPos, setAttachmentMenuPos] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState("");
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [editingColumnOriginal, setEditingColumnOriginal] = useState("");
  const [columnMenuFor, setColumnMenuFor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingColumnId, setDraggingColumnId] = useState("");
  const [dragOverColumnInsertIndex, setDragOverColumnInsertIndex] = useState(-1);
  const [cardDropIndicator, setCardDropIndicator] = useState(null);
  const [brokenCoverCardIds, setBrokenCoverCardIds] = useState(() => new Set());
  const cardDragMovedRef = useRef(false);

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

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => {
      const haystack = [
        card.title,
        card.bodyText,
        card.fromEmail,
        extractVinFromCard(card),
        ...(card.attachments || []).map((a) => decodeMojibake(a?.originalname || a?.filename || "")),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cards, searchQuery]);

  const cardsByColumn = useMemo(() => {
    const m = {};
    const defaultCol = columns[0]?.id || "new";
    for (const col of columns) m[col.id] = [];
    for (const c of filteredCards) {
      const colId = c.columnId || defaultCol;
      if (!m[colId]) m[colId] = [];
      m[colId].push(c);
    }
    for (const col of columns) {
      m[col.id] = sortCardsInColumn(m[col.id] || []);
    }
    return m;
  }, [filteredCards, columns]);

  const openedCard = useMemo(
    () => cards.find((c) => String(c._id) === String(openedCardId)) || null,
    [cards, openedCardId]
  );

  useEffect(() => {
    if (openedCard) {
      setEditingTitle(openedCard.title || "");
      setEditingBody(openedCard.bodyText || "");
    }
  }, [openedCard]);

  useEffect(() => {
    if (!openedCard) {
      setPreviewAttachment(null);
      setAttachmentMenuFor("");
      setAttachmentMenuPos(null);
    }
  }, [openedCard]);

  useEffect(() => {
    if (!attachmentMenuFor) return undefined;
    const onDocMouseDown = (e) => {
      const root = e.target.closest?.(".mail-board-file-menu-root");
      if (!root) {
        setAttachmentMenuFor("");
        setAttachmentMenuPos(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [attachmentMenuFor]);

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

  const fileUrl = (filename) =>
    `${API_URL}/api/mail-board/files/${encodeURIComponent(String(filename || ""))}`;
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

  const extractVin = extractVinFromCard;

  const persistColumnOrder = async (orderedColumns) => {
    try {
      const res = await axios.put(`${API_URL}/api/mail-board/columns/reorder`, {
        columnIds: orderedColumns.map((c) => c.id),
      });
      setColumns(res.data.columns || orderedColumns);
    } catch (e) {
      console.error(e);
      alert("Не удалось изменить порядок колонок");
      load();
    }
  };

  const rebalanceColumnCards = async (columnId, orderedCards) => {
    let sortOrder = orderedCards.length * 1000;
    const updates = [];
    for (const card of orderedCards) {
      updates.push(
        axios.patch(`${API_URL}/api/mail-board/cards/${card._id}`, {
          columnId,
          sortOrder,
        })
      );
      sortOrder -= 1000;
    }
    const results = await Promise.all(updates);
    const byId = new Map(results.map((r) => [String(r.data._id), r.data]));
    setCards((prev) => prev.map((c) => byId.get(String(c._id)) || c));
  };

  const reorderCardAt = async (cardId, targetColumnId, insertIndex) => {
    const moving = cards.find((c) => String(c._id) === String(cardId));
    if (!moving) return;

    const defaultCol = columns[0]?.id || "new";
    const columnCards = sortCardsInColumn(
      cards.filter(
        (c) =>
          String(c.columnId || defaultCol) === String(targetColumnId) &&
          String(c._id) !== String(cardId)
      )
    );

    const insertAt = Math.max(0, Math.min(insertIndex, columnCards.length));
    let sortOrder = computeSortOrderForInsert(columnCards, insertAt);

    if (sortOrder == null) {
      const ordered = [...columnCards];
      ordered.splice(insertAt, 0, moving);
      try {
        await rebalanceColumnCards(targetColumnId, ordered);
      } catch (e) {
        console.error(e);
        alert("Не удалось изменить порядок карточки");
        load();
      }
      return;
    }

    try {
      const res = await axios.patch(`${API_URL}/api/mail-board/cards/${cardId}`, {
        columnId: targetColumnId,
        sortOrder,
      });
      setCards((prev) => prev.map((c) => (String(c._id) === String(cardId) ? res.data : c)));
    } catch (e) {
      console.error(e);
      alert("Не удалось переместить карточку");
      load();
    }
  };

  const moveCard = async (cardId, columnId) => {
    const defaultCol = columns[0]?.id || "new";
    const columnCards = sortCardsInColumn(
      cards.filter(
        (c) =>
          String(c.columnId || defaultCol) === String(columnId) && String(c._id) !== String(cardId)
      )
    );
    await reorderCardAt(cardId, columnId, columnCards.length);
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

  const saveBody = async (cardId) => {
    try {
      setSavingBody(true);
      await patchCard(cardId, { bodyText: editingBody.trim() });
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить описание");
    } finally {
      setSavingBody(false);
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

  const clearDragState = () => {
    setDragCardId(null);
    setDraggingCardId("");
    setDragOverColumnId("");
    setDraggingColumnId("");
    setDragOverColumnInsertIndex(-1);
    setCardDropIndicator(null);
  };

  const onCardDragStart = (e, cardId) => {
    cardDragMovedRef.current = false;
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

  const onCardDrag = () => {
    cardDragMovedRef.current = true;
  };

  const onColumnDragStart = (e, columnId) => {
    e.stopPropagation();
    setDraggingColumnId(columnId);
    e.dataTransfer.setData("text/column-id", columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onColumnDragOver = (e, colIndex) => {
    if (!draggingColumnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnInsertIndex !== colIndex) setDragOverColumnInsertIndex(colIndex);
  };

  const onColumnDropReorder = async (e, colIndex) => {
    if (!draggingColumnId) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/column-id") || draggingColumnId;
    clearDragState();
    if (!id) return;
    const fromIdx = columns.findIndex((c) => c.id === id);
    if (fromIdx < 0) return;
    const next = [...columns];
    const [removed] = next.splice(fromIdx, 1);
    let insertAt = colIndex;
    if (fromIdx < colIndex) insertAt -= 1;
    next.splice(Math.max(0, insertAt), 0, removed);
    await persistColumnOrder(next);
  };

  const onDragOverColumn = (e, columnId) => {
    if (draggingColumnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) setDragOverColumnId(columnId);
    if (!cardDropIndicator || cardDropIndicator.columnId !== columnId) {
      const len = (cardsByColumn[columnId] || []).length;
      setCardDropIndicator({ columnId, index: len });
    }
  };

  const onCardDragOver = (e, columnId, cardIndex) => {
    if (draggingColumnId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const index = before ? cardIndex : cardIndex + 1;
    if (cardDropIndicator?.columnId !== columnId || cardDropIndicator?.index !== index) {
      setCardDropIndicator({ columnId, index });
    }
  };

  const onDropColumn = async (e, columnId) => {
    if (draggingColumnId) {
      await onColumnDropReorder(e, columns.findIndex((c) => c.id === columnId));
      return;
    }
    e.preventDefault();
    const id = e.dataTransfer.getData("text/card-id") || dragCardId;
    const insertIndex =
      cardDropIndicator?.columnId === columnId
        ? cardDropIndicator.index
        : (cardsByColumn[columnId] || []).length;
    clearDragState();
    if (!id) return;
    await reorderCardAt(id, columnId, insertIndex);
  };

  const onDragEnd = () => {
    clearDragState();
  };

  const addNewCardFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    setNewCardFiles((prev) => [...prev, ...picked]);
  };

  const removeNewCardFile = (index) => {
    setNewCardFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addManualCard = async () => {
    const title = newTitle.trim();
    if (!title) {
      alert("Укажите заголовок");
      return;
    }
    const firstCol = columns[0]?.id || "new";
    try {
      setCreatingCard(true);
      const res = await axios.post(`${API_URL}/api/mail-board/cards`, {
        columnId: firstCol,
        title,
        bodyText: newBody.trim(),
      });
      const cardId = String(res.data?._id || "");
      if (cardId && newCardFiles.length > 0) {
        for (const file of newCardFiles) {
          await uploadFile(cardId, file);
        }
      }
      setNewTitle("");
      setNewBody("");
      setNewCardFiles([]);
      if (newCardFilesInputRef.current) newCardFilesInputRef.current.value = "";
      await load();
    } catch (e) {
      console.error(e);
      alert("Ошибка создания карточки");
    } finally {
      setCreatingCard(false);
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

  const openAttachmentInNewTab = (attachment) => {
    const href = fileUrl(attachment?.filename);
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
    setAttachmentMenuFor("");
  };

  const downloadAttachmentFile = async (attachment) => {
    const href = fileUrl(attachment?.filename);
    const name = displayAttachmentName(attachment);
    if (!href) return;
    try {
      const res = await fetch(href, { mode: "cors", credentials: "omit", cache: "reload" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("downloadAttachmentFile", err);
      alert("Не удалось скачать файл");
    }
    setAttachmentMenuFor("");
  };

  const toggleAttachmentMenu = (filename, event) => {
    const btn = event?.currentTarget;
    if (attachmentMenuFor === filename) {
      setAttachmentMenuFor("");
      setAttachmentMenuPos(null);
      return;
    }
    const menuW = 200;
    const menuH = 220;
    let pos = { top: 80, left: 12, opensUp: false };
    if (btn?.getBoundingClientRect) {
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const opensUp = spaceBelow < menuH && spaceAbove > spaceBelow;
      let left = rect.right - menuW;
      left = Math.max(12, Math.min(left, window.innerWidth - menuW - 12));
      pos = {
        top: opensUp ? rect.top - 4 : rect.bottom + 4,
        left,
        opensUp,
      };
    }
    setAttachmentMenuPos(pos);
    setAttachmentMenuFor(filename);
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
            Письма с вебхука попадают в первую колонку. Перетаскивайте колонки за заголовок, карточки —
            выше или ниже в колонке и между колонками.
          </p>
        </div>
        <div className="mail-board-head-actions">
          <input
            type="search"
            className="mail-board-search"
            placeholder="Поиск: заголовок, VIN, текст, вложения…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="button" className="mail-board-refresh" onClick={() => load()}>
            Обновить
          </button>
        </div>
      </div>

      {searchQuery.trim() ? (
        <div className="mail-board-search-meta">
          Найдено карточек: {filteredCards.length}
          {filteredCards.length === 0 ? " — попробуйте другой запрос" : ""}
        </div>
      ) : null}

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
          rows={1}
        />
        <div
          className={`mail-board-create-attachments-wrap${
            newCardFiles.length > 0 ? " mail-board-create-attachments-wrap-open" : ""
          }`}
        >
          <div className="mail-board-create-attachments">
            <label className="mail-board-create-attach-label">
              Вложения
              <span className="mail-board-upload-pill mail-board-create-attach-btn">
                + Файлы / фото
                <input
                  ref={newCardFilesInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => addNewCardFiles(e.target.files)}
                />
              </span>
            </label>
            {newCardFiles.length > 0 ? (
              <span className="mail-board-create-attach-count">
                {newCardFiles.length}{" "}
                {newCardFiles.length === 1
                  ? "файл"
                  : newCardFiles.length < 5
                    ? "файла"
                    : "файлов"}
              </span>
            ) : (
              <span className="mail-board-create-attach-hint">PDF, изображения — можно несколько</span>
            )}
          </div>
          {newCardFiles.length > 0 ? (
            <div className="mail-board-create-file-popover" role="region" aria-label="Выбранные вложения">
              <ul className="mail-board-create-file-list">
                {newCardFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`}>
                    <span className="mail-board-create-file-name" title={file.name}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      className="mail-board-create-file-remove"
                      title="Убрать"
                      onClick={() => removeNewCardFile(index)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="mail-board-btn-primary mail-board-create-submit"
          disabled={creatingCard}
          onClick={addManualCard}
        >
          {creatingCard ? "Создаём…" : "Добавить карточку"}
        </button>
      </div>

      <div className="mail-board-board-row">
        <div
          className="mail-board-columns"
          style={{
            gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(200px, 1fr))`,
          }}
        >
          {columns.map((col, colIndex) => (
            <div
              key={col.id}
              className={`mail-board-column ${
                dragOverColumnId === col.id && !draggingColumnId ? "mail-board-column-drop-target" : ""
              } ${
                draggingColumnId && dragOverColumnInsertIndex === colIndex
                  ? "mail-board-column-reorder-target"
                  : ""
              } ${draggingColumnId === col.id ? "mail-board-column-dragging" : ""}`}
              onDragOver={(e) => {
                if (draggingColumnId) onColumnDragOver(e, colIndex);
                else onDragOverColumn(e, col.id);
              }}
              onDrop={(e) => onDropColumn(e, col.id)}
              onDragLeave={() => {
                if (dragOverColumnId === col.id) setDragOverColumnId("");
                if (dragOverColumnInsertIndex === colIndex) setDragOverColumnInsertIndex(-1);
              }}
            >
              <div
                className="mail-board-column-title-wrap"
                draggable={editingColumnId !== col.id}
                onDragStart={(e) => onColumnDragStart(e, col.id)}
                onDragEnd={onDragEnd}
                title="Перетащите, чтобы изменить порядок колонок"
              >
                <span className="mail-board-column-drag-handle" aria-hidden>
                  ⠿
                </span>
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
              {(cardsByColumn[col.id] || []).map((card, cardIndex) => (
                <Fragment key={String(card._id)}>
                  {cardDropIndicator?.columnId === col.id && cardDropIndicator.index === cardIndex ? (
                    <div className="mail-board-card-drop-line" aria-hidden />
                  ) : null}
                  <article
                    className={`mail-board-card ${draggingCardId === String(card._id) ? "mail-board-card-dragging" : ""}`}
                    draggable
                    onDragStart={(e) => onCardDragStart(e, String(card._id))}
                    onDrag={onCardDrag}
                    onDragOver={(e) => onCardDragOver(e, col.id, cardIndex)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggingColumnId) return;
                      const id = e.dataTransfer.getData("text/card-id") || dragCardId;
                      const insertIndex =
                        cardDropIndicator?.columnId === col.id
                          ? cardDropIndicator.index
                          : cardIndex;
                      clearDragState();
                      if (!id) return;
                      void reorderCardAt(id, col.id, insertIndex);
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => {
                      if (cardDragMovedRef.current) {
                        cardDragMovedRef.current = false;
                        return;
                      }
                      setOpenedCardId(String(card._id));
                    }}
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
                    <div
                      className="mail-board-card-column-select-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="mail-board-card-column-select-label">Колонка</span>
                      <select
                        className="mail-board-card-column-select"
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
                  </div>
                  {extractVin(card) && <div className="mail-board-vin">VIN: {extractVin(card)}</div>}
                  {getCoverImage(card) ? (
                    brokenCoverCardIds.has(String(card._id)) ? (
                      <div className="mail-board-preview-missing" title="Файл не найден на сервере">
                        Вложение недоступно (файл на сервере не найден)
                      </div>
                    ) : (
                      <img
                        className="mail-board-preview-image"
                        src={fileUrl(getCoverImage(card).filename)}
                        alt={card.title || "attachment"}
                        onError={() => {
                          setBrokenCoverCardIds((prev) => {
                            const next = new Set(prev);
                            next.add(String(card._id));
                            return next;
                          });
                        }}
                      />
                    )
                  ) : null}

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
                </Fragment>
              ))}
              {cardDropIndicator?.columnId === col.id &&
              cardDropIndicator.index === (cardsByColumn[col.id] || []).length ? (
                <div className="mail-board-card-drop-line" aria-hidden />
              ) : null}
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
              <button
                type="button"
                className="mail-board-modal-close"
                onClick={() => setOpenedCardId(null)}
              >
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

                <div className="mail-board-modal-section mail-board-description-section">
                  <div className="mail-board-section-head">
                    <span className="mail-board-section-title">Описание</span>
                  </div>
                  <textarea
                    className="mail-board-description-textarea"
                    rows={6}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    placeholder="Текст описания карточки…"
                  />
                  <div className="mail-board-description-actions">
                    <button
                      type="button"
                      className="mail-board-btn-primary"
                      disabled={savingBody}
                      onClick={() => saveBody(String(openedCard._id))}
                    >
                      {savingBody ? "Сохранение…" : "Сохранить описание"}
                    </button>
                  </div>
                </div>

                <div className="mail-board-modal-section mail-board-attachments-section">
                  <div className="mail-board-attachments-top">
                    <div className="mail-board-attachments-title">Вложения</div>
                    <label className="mail-board-upload mail-board-upload-pill">
                      + Добавить
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
                          onClick={() => openAttachmentInNewTab(a)}
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
                        <div className="mail-board-file-actions mail-board-file-menu-root">
                          <button
                            type="button"
                            className="mail-board-file-open-page"
                            onClick={() => openAttachmentInNewTab(a)}
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            className="mail-board-file-menu-btn"
                            onClick={(e) => toggleAttachmentMenu(String(a.filename), e)}
                          >
                            ⋯
                          </button>
                          {attachmentMenuFor === String(a.filename) && attachmentMenuPos && (
                            <div
                              className="mail-board-file-menu mail-board-file-menu-floating"
                              style={{
                                top: attachmentMenuPos.top,
                                left: attachmentMenuPos.left,
                                transform: attachmentMenuPos.opensUp ? "translateY(-100%)" : undefined,
                              }}
                            >
                              <button type="button" onClick={() => renameAttachment(String(openedCard._id), a)}>
                                Изменить (название)
                              </button>
                              <button type="button" onClick={() => commentAttachment(String(openedCard._id), a)}>
                                Комментировать
                              </button>
                              <button type="button" onClick={() => void downloadAttachmentFile(a)}>
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
                                  setAttachmentMenuPos(null);
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
