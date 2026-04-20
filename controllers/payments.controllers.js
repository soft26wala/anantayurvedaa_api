import db from "../database/db.js";
import crypto from "crypto";
import { createRazorpayInstance } from "../config/razorpay.config.js";

export const createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Items required" });
    }

    let total = 0;

    // 🔥 DB se price fetch (secure)
    for (let item of items) {
      const product = await db.query(
        "SELECT id, price, stock FROM products WHERE id = $1",
        [item.productId],
      );

      if (!product.rows.length) {
        return res.status(404).json({ error: "Product not found" });
      }

      const { price, stock } = product.rows[0];

      // ❗ stock check
      if (item.qty > stock) {
        return res.status(400).json({
          error: "Stock not available",
        });
      }

      total += price * item.qty;
    }

    // 🔥 backend calculation only
    const SELLER_STATE = "PUNJAB";
    const customerState = (formData.state || "").toUpperCase();

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (customerState === SELLER_STATE) {
      // Intra-state
      cgst = total * 0.025;
      sgst = total * 0.025;
    } else {
      // Inter-state
      igst = total * 0.05;
    }

    const tax = cgst + sgst + igst;
    const shipping = total >= 400 ? 0 : 40;
    const finalAmount = Math.round(total + tax + shipping);

    const razorpay = createRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `rcp_${Date.now()}`,
    });

    return res.status(200).json({
      success: true,
      order,
      breakdown: {
        total,
        tax,
        shipping,
        finalAmount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items = [],
      user_id,
      formData = {},
    } = req.body;

    // 🔐 signature verify
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);

    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);

    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // 🔥 again calculate (double security)
    let total = 0;

    for (let item of items) {
      const product = await db.query(
        "SELECT price FROM products WHERE id = $1",
        [item.productId],
      );

      const price = product.rows[0].price;
      total += price * item.qty;
    }

    // const tax = total * 0.18;
    // const shipping = total >= 400 ? 0 : 40;
    // const finalAmount = total + tax + shipping;

    const SELLER_STATE = "PUNJAB";
    const customerState = (formData.state || "").toUpperCase();

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (customerState === SELLER_STATE) {
      // Intra-state
      cgst = total * 0.025;
      sgst = total * 0.025;
    } else {
      // Inter-state
      igst = total * 0.05;
    }

    const tax = cgst + sgst + igst;

    // ✅ SAVE ORDER
    const orderResult = await db.query(
      `INSERT INTO orders 
  (buyer_id, total_price, tax_price, shipping_price, cgst, sgst, igst, paid_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [user_id, finalAmount, tax, shipping, cgst, sgst, igst],
    );

    const orderId = orderResult.rows[0].id;

    for (let item of items) {
      const product = await db.query(
        "SELECT name, price, images->0->>'url' AS image FROM products WHERE id = $1",
        [item.productId],
      );

      if (!product.rows.length) {
        throw new Error("Product not found in verifyPayment");
      }

      const productData = product.rows[0];

      await db.query(
        `INSERT INTO order_items 
    (order_id, product_id, quantity, price, image, title)
    VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.productId,
          item.qty,
          productData.price,
          productData.image || null,
          productData.name || "Product",
        ],
      );
    }

    await db.query(
      `INSERT INTO shipping_info 
  (order_id, full_name, state, city, country, address, pincode, phone) 
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,

      [
        orderId,
        formData.fullName || "",
        formData.state || "",
        formData.city || "",
        formData.country || "",
        formData.address || "",
        formData.zipCode || "",
        formData.phone || "",
      ],
    );

    await db.query(
      `INSERT INTO payments (order_id, payment_type, payment_status, payment_intent_id)
   VALUES ($1, 'Online', 'Paid', $2)`,
      [orderId, razorpay_payment_id],
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified & order saved",
    });
  } catch (error) {
    console.error("verifyPayment failed at step:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

export const createCODOrder = async (req, res) => {
  try {
    const { items = [], user_id, formData = {} } = req.body;

    if (!items.length) {
      return res.status(400).json({ error: "Items required" });
    }

    let total = 0;

    // 🔥 same logic as online (secure)
    for (let item of items) {
      const product = await db.query(
        "SELECT id, price, stock FROM products WHERE id = $1",
        [item.productId],
      );

      if (!product.rows.length) {
        return res.status(404).json({ error: "Product not found" });
      }

      const { price, stock } = product.rows[0];

      if (item.qty > stock) {
        return res.status(400).json({ error: "Stock not available" });
      }

      total += price * item.qty;
    }

    // const tax = total * 0.18;
    // const finalAmount = total + tax + shipping;

    const SELLER_STATE = "PUNJAB";
    const customerState = (formData.state || "").toUpperCase();

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (customerState === SELLER_STATE) {
      // Intra-state
      cgst = total * 0.025;
      sgst = total * 0.025;
    } else {
      // Inter-state
      igst = total * 0.05;
    }

    const tax = cgst + sgst + igst;
    const shipping = total >= 400 ? 0 : 40;
    const finalAmount = total + tax + shipping;
    // ✅ ORDER CREATE (paid_at NULL because COD)
    const orderResult = await db.query(
      `INSERT INTO orders 
  (buyer_id, total_price, tax_price, shipping_price, cgst, sgst, igst, paid_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [user_id, finalAmount, tax, shipping, cgst, sgst, igst],
    );

    const orderId = orderResult.rows[0].id;

    // ✅ order items insert
    for (let item of items) {
      const product = await db.query(
        "SELECT name, price, images->0->>'url' AS image FROM products WHERE id = $1",
        [item.productId],
      );

      const p = product.rows[0];

      await db.query(
        `INSERT INTO order_items 
        (order_id, product_id, quantity, price, image, title)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.productId,
          item.qty,
          p.price,
          p.image || null,
          p.name || "Product",
        ],
      );
    }

    // const shipping = total >= 400 ? 0 : 40;
    // const finalAmount = total + tax + shipping;

    // ✅ shipping info
    await db.query(
      `INSERT INTO shipping_info 
      (order_id, full_name, state, city, country, address, pincode, phone) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        orderId,
        formData.fullName || "",
        formData.state || "",
        formData.city || "",
        formData.country || "",
        formData.address || "",
        formData.zipCode || "",
        formData.phone || "",
      ],
    );

    // ✅ PAYMENT TABLE (COD)
    await db.query(
      `INSERT INTO payments 
      (order_id, payment_type, payment_status)
      VALUES ($1, 'COD', 'Pending')`,
      [orderId],
    );

    return res.status(200).json({
      success: true,
      message: "COD order placed",
      orderId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "COD order failed" });
  }
};
