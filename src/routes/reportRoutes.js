const express = require("express");

const {
    getSalesReport,
    getPurchasesReport,
    getProfitReport
} = require("../controllers/reportController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/sales", authenticateToken, getSalesReport);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/purchases", authenticateToken, getPurchasesReport);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/profit", authenticateToken, getProfitReport);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;