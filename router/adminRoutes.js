import express from "express";
import { getAllUsers, deleteUser, dashboardStats } from "../controllers/adminController.js";
import { createProduct } from "../controllers/productController.js";
import {
  authorizedRoles,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
  "/getallusers",
  isAuthenticated,
  authorizedRoles("Admin"),
  getAllUsers
); // DASHBOARD
router.delete(
  "/delete/:id",
  isAuthenticated,
  authorizedRoles("Admin"),
  deleteUser
);
router.get(
  "/fetch/dashboard-stats",
  isAuthenticated,
  authorizedRoles("Admin"),
  dashboardStats
);

router.post(
  "/create",
  isAuthenticated,
  authorizedRoles("Admin"),
  createProduct
);

export default router;
