import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "../db.js";

export const register = async (req, res) => {
  try {
    console.log("REGISTER BODY:", req.body);

    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: "Заполните логин и пароль" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = login.trim().toLowerCase();

    const existingUser = await usersCollection.findOne({ login: normalizedLogin });

    if (existingUser) {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      login: normalizedLogin,
      password: hashedPassword,
      role: "user",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      message: "Учетка создана и отправлена на одобрение",
      userId: result.insertedId,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: "Ошибка регистрации",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);
    console.log("JWT_SECRET EXISTS:", !!process.env.JWT_SECRET);

    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: "Введите логин и пароль" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = login.trim().toLowerCase();

    const user = await usersCollection.findOne({ login: normalizedLogin });

    if (!user) {
      return res.status(400).json({ message: "Пользователь не найден" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Неверный пароль" });
    }

    if (user.role !== "admin" && user.status !== "approved") {
      return res.status(403).json({
        message: "Ваша учетка еще не одобрена",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "На сервере не задан JWT_SECRET",
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        status: user.status,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        login: user.login,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      message: "Ошибка входа",
      error: error.message,
    });
  }
};