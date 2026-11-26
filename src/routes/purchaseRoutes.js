const express = require("express");

const {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase
} = require("../controllers/purchaseController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getPurchases);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/:id", authenticateToken, getPurchaseById);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/", authenticateToken, createPurchase);
router.put("/:id", authenticateToken, updatePurchase);
router.delete("/:id", authenticateToken, deletePurchase);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;