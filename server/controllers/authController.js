import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";

export const register = async (req, res) => {
  try {
    console.log("REGISTER BODY:", req.body);

    const { name, surname, login, email, position = "", password, confirmPassword } = req.body;

    if (!name || !surname || !login || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Заполните все поля регистрации" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Пароли не совпадают" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = login.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await usersCollection.findOne({ login: normalizedLogin });

    if (existingUser) {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }

    const existingEmail = await usersCollection.findOne({ email: normalizedEmail });

    if (existingEmail) {
      return res.status(400).json({ message: "Пользователь с таким email уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      name: name.trim(),
      surname: surname.trim(),
      login: normalizedLogin,
      email: normalizedEmail,
      position: String(position || "").trim(),
      password: hashedPassword,
      role: "user",
      status: "pending",
      avatar: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      message: "Учетка создана, ждите одобрения",
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
        name: user.name || "",
        surname: user.surname || "",
        login: user.login,
        email: user.email || "",
        position: user.position || "",
        avatar: user.avatar || "",
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

export const updateProfile = async (req, res) => {
  try {
    const { name, surname, login, email, position = "" } = req.body;
    const userId = req.user.id;

    if (!name || !surname || !login || !email) {
      return res.status(400).json({ message: "Имя, фамилия, логин и email обязательны" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = login.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const currentUserObjectId = new ObjectId(userId);

    const duplicateLogin = await usersCollection.findOne({
      login: normalizedLogin,
      _id: { $ne: currentUserObjectId },
    });

    if (duplicateLogin) {
      return res.status(400).json({ message: "Этот логин уже занят" });
    }

    const duplicateEmail = await usersCollection.findOne({
      email: normalizedEmail,
      _id: { $ne: currentUserObjectId },
    });

    if (duplicateEmail) {
      return res.status(400).json({ message: "Этот email уже занят" });
    }

    await usersCollection.updateOne(
      { _id: currentUserObjectId },
      {
        $set: {
          name: name.trim(),
          surname: surname.trim(),
          login: normalizedLogin,
          email: normalizedEmail,
          position: String(position || "").trim(),
          updatedAt: new Date(),
        },
      }
    );

    const updatedUser = await usersCollection.findOne(
      { _id: currentUserObjectId },
      { projection: { password: 0 } }
    );

    return res.json({
      message: "Профиль обновлен",
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name || "",
        surname: updatedUser.surname || "",
        login: updatedUser.login,
        email: updatedUser.email || "",
        position: updatedUser.position || "",
        avatar: updatedUser.avatar || "",
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    return res.status(500).json({ message: "Ошибка обновления профиля" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "Заполните все поля пароля" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Новые пароли не совпадают" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Минимальная длина пароля 6 символов" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Текущий пароль неверный" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    return res.json({ message: "Пароль успешно изменен" });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    return res.status(500).json({ message: "Ошибка смены пароля" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не передан" });
    }

    const userId = req.user.id;
    const db = getDB();
    const usersCollection = db.collection("users");
    const avatarPath = `avatars/${req.file.filename}`;

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { avatar: avatarPath, updatedAt: new Date() } }
    );

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    return res.json({
      message: "Фото профиля обновлено",
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name || "",
        surname: updatedUser.surname || "",
        login: updatedUser.login,
        email: updatedUser.email || "",
        position: updatedUser.position || "",
        avatar: updatedUser.avatar || "",
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error("UPLOAD AVATAR ERROR:", error);
    return res.status(500).json({ message: "Ошибка загрузки фото профиля" });
  }
};