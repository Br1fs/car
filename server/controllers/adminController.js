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

    if (user.role === "admin") {
      return res.status(403).json({ message: "Админа удалять нельзя" });
    }

    await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ message: "Пользователь удален" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({ message: "Ошибка удаления" });
  }
};