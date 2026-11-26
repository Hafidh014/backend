const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getDashboard);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;