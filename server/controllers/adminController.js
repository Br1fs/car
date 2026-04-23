import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import bcrypt from "bcryptjs";

const normalizeString = (value = "") => String(value).trim();
const normalizeLower = (value = "") => normalizeString(value).toLowerCase();

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

export const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Некорректный ID пользователя" });
    }

    const {
      firstName,
      lastName,
      login,
      email,
      position,
      role,
      status,
      password,
    } = req.body;

    const db = getDB();
    const usersCollection = db.collection("users");
    const targetObjectId = new ObjectId(userId);

    const user = await usersCollection.findOne({ _id: targetObjectId });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const update = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) update.firstName = normalizeString(firstName);
    if (lastName !== undefined) update.lastName = normalizeString(lastName);
    if (position !== undefined) update.position = normalizeString(position);

    if (role !== undefined) {
      const normalizedRole = normalizeString(role);
      if (!["user", "admin"].includes(normalizedRole)) {
        return res.status(400).json({ message: "Некорректная роль" });
      }
      update.role = normalizedRole;
    }

    if (status !== undefined) {
      const normalizedStatus = normalizeString(status);
      if (!["pending", "approved", "rejected"].includes(normalizedStatus)) {
        return res.status(400).json({ message: "Некорректный статус" });
      }
      update.status = normalizedStatus;
    }

    if (login !== undefined) {
      const normalizedLogin = normalizeLower(login);
      if (!normalizedLogin) {
        return res.status(400).json({ message: "Логин не может быть пустым" });
      }
      const duplicateLogin = await usersCollection.findOne({
        _id: { $ne: targetObjectId },
        login: normalizedLogin,
      });
      if (duplicateLogin) {
        return res.status(400).json({ message: "Логин уже используется" });
      }
      update.login = normalizedLogin;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeLower(email);
      if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: "Введите корректный email" });
      }
      const duplicateEmail = await usersCollection.findOne({
        _id: { $ne: targetObjectId },
        email: normalizedEmail,
      });
      if (duplicateEmail) {
        return res.status(400).json({ message: "Email уже используется" });
      }
      update.email = normalizedEmail;
    }

    if (password !== undefined) {
      const nextPassword = String(password || "");
      if (nextPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "Пароль должен быть не менее 6 символов" });
      }
      update.password = await bcrypt.hash(nextPassword, 10);
    }

    await usersCollection.updateOne({ _id: targetObjectId }, { $set: update });

    const updatedUser = await usersCollection.findOne(
      { _id: targetObjectId },
      { projection: { password: 0 } }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    res.status(500).json({ message: "Ошибка обновления пользователя" });
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