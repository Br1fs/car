import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "../db.js";

export const register = async (req, res) => {
  try {
    const { firstName, lastName, login, email, password, repeatPassword } = req.body;

    if (!firstName || !lastName || !login || !email || !password || !repeatPassword) {
      return res.status(400).json({ message: "Fill in all required fields" });
    }

    const trimmedFirstName = String(firstName).trim();
    const trimmedLastName = String(lastName).trim();
    const normalizedLogin = String(login).trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!trimmedFirstName || !trimmedLastName || !normalizedLogin || !normalizedEmail) {
      return res.status(400).json({ message: "Fill in all required fields" });
    }

    if (password !== repeatPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const existingUser = await usersCollection.findOne({
      $or: [{ login: normalizedLogin }, { email: normalizedEmail }],
    });

    if (existingUser) {
      if (existingUser.login === normalizedLogin) {
        return res.status(400).json({ message: "User with this login already exists" });
      }
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await usersCollection.insertOne({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      login: normalizedLogin,
      email: normalizedEmail,
      position: "",
      password: hashedPassword,
      role: "user",
      status: "pending approval",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({
      message: "Wait for admin approval",
      status: "pending approval",
      userId: result.insertedId,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: "Registration error",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: "Enter login and password" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    const normalizedLogin = String(login).trim().toLowerCase();

    const user = await usersCollection.findOne({ login: normalizedLogin });

    if (!user) {
      return res.status(400).json({ message: "Invalid login or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid login or password" });
    }

    if (user.role !== "admin" && user.status !== "approved") {
      return res.status(403).json({
        message: "Wait for admin approval",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured on server",
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
      message: "Login error",
      error: error.message,
    });
  }
};