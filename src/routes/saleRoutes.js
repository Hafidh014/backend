const express = require("express");

const {
    getSales,
    getSaleById,
    createSale,
    updateSale,
    deleteSale
} = require("../controllers/saleController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getSales);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/:id", authenticateToken, getSaleById);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/", authenticateToken, createSale);
router.put("/:id", authenticateToken, updateSale);
router.delete("/:id", authenticateToken, deleteSale);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;