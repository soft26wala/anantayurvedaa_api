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
        [item.productId]
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

    const tax = total * 0.18;
    const shipping = total >= 400 ? 0 : 40;
    const finalAmount = total + tax + shipping;

    // ✅ ORDER CREATE (paid_at NULL because COD)
    const orderResult = await db.query(
      `INSERT INTO orders 
      (buyer_id, total_price, tax_price, shipping_price)
      VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [user_id, finalAmount, tax, shipping]
    );

    const orderId = orderResult.rows[0].id;

    // ✅ order items insert
    for (let item of items) {
      const product = await db.query(
        "SELECT name, price, images->0->>'url' AS image FROM products WHERE id = $1",
        [item.productId]
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
        ]
      );
    }

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
        formData.phone || ""
      ]
    );

    // ✅ PAYMENT TABLE (COD)
    await db.query(
      `INSERT INTO payments 
      (order_id, payment_type, payment_status)
      VALUES ($1, 'COD', 'Pending')`,
      [orderId]
    );

    return res.status(200).json({
      success: true,
      message: "COD order placed",
      orderId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "COD order failed" });
  }
};