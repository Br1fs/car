export async function writeAuditLog(db, payload = {}) {
  try {
    const now = new Date();
    const record = {
      action: String(payload.action || "").trim() || "unknown_action",
      actorName: String(payload.actorName || "system"),
      actorId: String(payload.actorId || ""),
      targetType: String(payload.targetType || ""),
      targetId: String(payload.targetId || ""),
      targetLabel: String(payload.targetLabel || ""),
      startedAt: payload.startedAt ? new Date(payload.startedAt) : now,
      finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : now,
      durationMinutes: Number.isFinite(Number(payload.durationMinutes))
        ? Math.max(0, Number(payload.durationMinutes))
        : null,
      details: payload.details && typeof payload.details === "object" ? payload.details : {},
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("activityLogs").insertOne(record);
  } catch (error) {
    console.error("WRITE AUDIT LOG ERROR:", error);
  }
}
