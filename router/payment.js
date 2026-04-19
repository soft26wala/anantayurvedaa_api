import express from "express";
import { createOrder , verifyPayment } from "../controllers/payments.controllers.js";
import dotenv from "dotenv";
import { createCODOrder } from "../controllers/cod.js"
dotenv.config();

const router = express.Router();



router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/create-cod", createCODOrder);

export default router;