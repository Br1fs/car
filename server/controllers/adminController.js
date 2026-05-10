import { ObjectId } from "mongodb";
import { getDB } from "../db.js";

export const getAllUsers = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(users);
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    res.status(500).json({ message: "Ошибка получения пользователей" });
  }
};

export const approveUser = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "approved", updatedAt: new Date() } },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!result.value) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(result.value);
  } catch (error) {
    console.error("APPROVE USER ERROR:", error);
    res.status(500).json({ message: "Ошибка одобрения" });
  }
};

export const rejectUser = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "rejected", updatedAt: new Date() } },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!result.value) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(result.value);
  } catch (error) {
    console.error("REJECT USER ERROR:", error);
    res.status(500).json({ message: "Ошибка отклонения" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "Нельзя удалить самого себя" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ message: "Пользователь удален" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({ message: "Ошибка удаления" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { role, status, position = "" } = req.body;
    const userId = req.params.id;

    const allowedRoles = ["admin", "admin/user", "user"];
    const allowedStatuses = ["approved", "pending", "rejected"];

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Некорректная роль" });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Некорректный статус" });
    }

    const payload = {
      updatedAt: new Date(),
      position: String(position || "").trim(),
    };

    if (role) payload.role = role;
    if (status) payload.status = status;

    const db = getDB();
    const usersCollection = db.collection("users");

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: payload },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!result.value) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    return res.json(result.value);
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    return res.status(500).json({ message: "Ошибка обновления пользователя" });
  }
};

export const getActivityLogs = async (req, res) => {
  try {
    const db = getDB();
    const {
      actorName = "",
      action = "",
      dateFrom = "",
      dateTo = "",
      limit = "300",
    } = req.query || {};

    const query = {};
    if (actorName) {
      query.actorName = { $regex: String(actorName), $options: "i" };
    }
    if (action) {
      query.action = String(action);
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const safeLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 300));
    const logs = await db
      .collection("activityLogs")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .toArray();

    const appIdsToResolve = logs
      .filter((item) => item.targetType === "application" && item.targetId && !item.targetLabel)
      .map((item) => item.targetId)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    let appLabelById = new Map();
    if (appIdsToResolve.length) {
      const apps = await db
        .collection("applications")
        .find(
          { _id: { $in: appIdsToResolve } },
          { projection: { fio: 1, vin: 1 } }
        )
        .toArray();
      appLabelById = new Map(
        apps.map((app) => [
          String(app._id),
          `${String(app.fio || "").trim()}${app.fio && app.vin ? " | " : ""}${String(app.vin || "").trim()}`.trim(),
        ])
      );
    }

    const enrichedLogs = logs.map((item) => {
      if (item.targetLabel) return item;
      if (item.targetType !== "application" || !item.targetId) return item;
      const resolved = appLabelById.get(String(item.targetId));
      if (!resolved) return item;
      return { ...item, targetLabel: resolved };
    });

    return res.json(enrichedLogs);
  } catch (error) {
    console.error("GET ACTIVITY LOGS ERROR:", error);
    return res.status(500).json({ message: "Ошибка получения журнала действий" });
  }
};

export const clearActivityLogs = async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("activityLogs").deleteMany({});
    return res.json({
      ok: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error("CLEAR ACTIVITY LOGS ERROR:", error);
    return res.status(500).json({ message: "Ошибка очистки журнала действий" });
  }
};