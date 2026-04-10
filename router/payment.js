import express from "express";
import { createOrder , verifyPayment } from "../controllers/payments.controllers.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();



router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);


export default router;