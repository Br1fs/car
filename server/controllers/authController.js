import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "../db.js";

const normalizeString = (value = "") => String(value).trim();

export const register = async (req, res) => {
  try {
    const { firstName, lastName, login, email, position, password } = req.body;

    const normalizedFirstName = normalizeString(firstName);
    const normalizedLastName = normalizeString(lastName);
    const normalizedLogin = normalizeString(login).toLowerCase();
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedPosition = normalizeString(position);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedLogin ||
      !normalizedEmail ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Заполните имя, фамилию, логин, email и пароль",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Введите корректный email" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const existingUser = await usersCollection.findOne({
      $or: [{ login: normalizedLogin }, { email: normalizedEmail }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Пользователь с таким логином или email уже существует",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      login: normalizedLogin,
      email: normalizedEmail,
      position: normalizedPosition,
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
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: "Введите логин и пароль" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = normalizeString(login).toLowerCase();

    const user = await usersCollection.findOne({
      $or: [{ login: normalizedLogin }, { email: normalizedLogin }],
    });

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
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        login: user.login,
        email: user.email || "",
        position: user.position || "",
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