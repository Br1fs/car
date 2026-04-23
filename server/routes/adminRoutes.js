import express from "express";
import {
  getAllUsers,
  updateUser,
  approveUser,
  rejectUser,
  deleteUser,
} from "../controllers/adminController.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", authMiddleware, adminMiddleware, getAllUsers);
router.patch("/users/:id", authMiddleware, adminMiddleware, updateUser);
router.patch("/users/:id/approve", authMiddleware, adminMiddleware, approveUser);
router.patch("/users/:id/reject", authMiddleware, adminMiddleware, rejectUser);
router.delete("/users/:id", authMiddleware, adminMiddleware, deleteUser);

export default router;