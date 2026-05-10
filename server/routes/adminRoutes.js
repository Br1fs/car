import express from "express";
import {
  getAllUsers,
  approveUser,
  rejectUser,
  deleteUser,
  updateUser,
  getActivityLogs,
  clearActivityLogs,
} from "../controllers/adminController.js";
import { authMiddleware, adminMiddleware, adminOrManagerMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", authMiddleware, adminOrManagerMiddleware, getAllUsers);
router.patch("/users/:id/approve", authMiddleware, adminMiddleware, approveUser);
router.patch("/users/:id/reject", authMiddleware, adminMiddleware, rejectUser);
router.delete("/users/:id", authMiddleware, adminMiddleware, deleteUser);
router.patch("/users/:id", authMiddleware, adminMiddleware, updateUser);
router.get("/activity-logs", authMiddleware, adminMiddleware, getActivityLogs);
router.delete("/activity-logs", authMiddleware, adminMiddleware, clearActivityLogs);
router.post("/activity-logs/clear", authMiddleware, adminMiddleware, clearActivityLogs);

export default router;