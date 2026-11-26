const express = require("express");

const {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
} = require("../controllers/supplierController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getSuppliers);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/:id", authenticateToken, getSupplierById);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/", authenticateToken, createSupplier);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.put("/:id", authenticateToken, updateSupplier);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.delete("/:id", authenticateToken, deleteSupplier);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;