const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");

const {
    register,
    login,
    refresh,
    logout,
    getProfile
} = require("../controllers/authController");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.post("/register", register);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", authenticateToken, logout);
router.get("/me", authenticateToken, getProfile);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;