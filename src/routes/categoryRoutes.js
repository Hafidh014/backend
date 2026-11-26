const express = require("express");

const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getCategories);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/:id", authenticateToken, getCategoryById);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/", authenticateToken, createCategory);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.put("/:id", authenticateToken, updateCategory);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.delete("/:id", authenticateToken, deleteCategory);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;