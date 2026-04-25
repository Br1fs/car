// server/routes/protocols.js
import express from "express";
import {
  bulkDeleteProtocolsByIds,
  createProtocol,
  deleteProtocolById,
  getProtocolById,
  isValidObjectId,
  listProtocols,
  toValidObjectIds,
} from "../services/protocolsService.js";
import {
  generateProtocolPdfBuffer,
  generateTemplatePdfBuffer,
} from "../services/protocolsPdfService.js";

const router = express.Router();

router.get("/:id/pdf-template", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send("Неверный ID");
    }

    const protocol = await getProtocolById(id);

    if (!protocol) {
      return res.status(404).send("Протокол не найден");
    }

    const pdfBytes = await generateTemplatePdfBuffer(protocol);

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("PDF TEMPLATE ERROR:", err);
    res.status(500).send(err.message);
  }
});

// ================= GET все протоколы =================
router.get("/", async (req, res) => {
  try {
    const protocols = await listProtocols();
    res.json(protocols);
  } catch (err) {
    console.error("Ошибка загрузки протоколов:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ================= POST создать протокол =================
router.post("/create", async (req, res) => {
  try {
    const data = req.body;

    if (!data) return res.status(400).json({ message: "no data" });
    const insertedId = await createProtocol(data);
    res.json({ message: "ok", _id: insertedId });
  } catch (err) {
    console.error("CREATE PROTOCOL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET PDF протокола =================
router.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) return res.status(400).send("Неверный ID");

    const protocol = await getProtocolById(id);
    if (!protocol) return res.status(404).send("Протокол не найден");

    const pdfBuffer = await generateProtocolPdfBuffer(protocol);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=protocol_${protocol._id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF ERROR:", err);
    res.status(500).send("Ошибка генерации PDF");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) return res.status(400).json({ message: "Неверный ID" });

    const protocol = await getProtocolById(id);
    if (!protocol) return res.status(404).json({ message: "Протокол не найден" });

    res.json(protocol);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Неверный ID" });
    }

    await deleteProtocolById(id);

    res.json({ message: "Удалено" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Не переданы ID" });
    }

    const validIds = toValidObjectIds(ids);

    if (!validIds.length) {
      return res.status(400).json({ message: "Нет корректных ID" });
    }

    const result = await bulkDeleteProtocolsByIds(validIds);

    res.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE PROTOCOLS ERROR:", err);
    res.status(500).json({ message: "Ошибка массового удаления" });
  }
});

export default router;