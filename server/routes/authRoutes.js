import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { register, login, updateProfile, changePassword, uploadAvatar } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const avatarUploadDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) fs.mkdirSync(avatarUploadDir, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarUploadDir,
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "avatar").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
});

router.post("/register", register);
router.post("/login", login);
router.patch("/profile", authMiddleware, updateProfile);
router.patch("/change-password", authMiddleware, changePassword);
router.patch("/avatar", authMiddleware, avatarUpload.single("avatar"), uploadAvatar);

export default router;