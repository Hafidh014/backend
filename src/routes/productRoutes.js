const express = require("express");

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductPhoto
} = require("../controllers/productController");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const {
    uploadProductImage
} = require("../middleware/uploadMiddleware");

// Membuat router untuk mengelompokkan endpoint pada file ini.
const router = express.Router();

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.get("/", authenticateToken, getProducts);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.get("/:id", authenticateToken, getProductById);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.post("/", authenticateToken, createProduct);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.put("/:id", authenticateToken, updateProduct);
// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.
router.delete("/:id", authenticateToken, deleteProduct);

// Mendefinisikan endpoint API sesuai metode HTTP dan fungsi controller.

router.post(
    "/:id/photo",
    authenticateToken,
    uploadProductImage.single("foto"),
    uploadProductPhoto
);

// Mengekspor router agar dapat digunakan oleh aplikasi utama.
module.exports = router;