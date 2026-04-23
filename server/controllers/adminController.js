import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
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

const normalizeString = (value) => (value === undefined || value === null ? "" : String(value).trim());

export const updateUser = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");
    const userId = new ObjectId(req.params.id);

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

    const updates = {};

    if (firstName !== undefined) {
      const normalizedFirstName = normalizeString(firstName);
      if (!normalizedFirstName) {
        return res.status(400).json({ message: "First name is required" });
      }
      updates.firstName = normalizedFirstName;
    }

    if (lastName !== undefined) {
      const normalizedLastName = normalizeString(lastName);
      if (!normalizedLastName) {
        return res.status(400).json({ message: "Last name is required" });
      }
      updates.lastName = normalizedLastName;
    }

    if (login !== undefined) {
      const normalizedLogin = normalizeString(login).toLowerCase();
      if (!normalizedLogin) {
        return res.status(400).json({ message: "Login is required" });
      }

      const existingLoginUser = await usersCollection.findOne({
        login: normalizedLogin,
        _id: { $ne: userId },
      });
      if (existingLoginUser) {
        return res.status(400).json({ message: "User with this login already exists" });
      }
      updates.login = normalizedLogin;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeString(email).toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
      }
      const existingEmailUser = await usersCollection.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      });
      if (existingEmailUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      updates.email = normalizedEmail;
    }

    if (position !== undefined) {
      updates.position = normalizeString(position);
    }

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      updates.role = role;
    }

    if (status !== undefined) {
      if (!["pending", "pending approval", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      updates.status = status;
    }

    if (password !== undefined && normalizeString(password)) {
      updates.password = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No changes provided" });
    }

    updates.updatedAt = new Date();

    const updateResult = await usersCollection.updateOne(
      { _id: userId },
      { $set: updates }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: userId },
      { projection: { password: 0 } }
    );

    return res.json(updatedUser);
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    return res.status(500).json({ message: "User update error" });
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
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({ message: "Delete error" });
  }
};