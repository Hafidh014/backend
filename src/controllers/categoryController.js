const { pool } = require("../config/database");

// Mengambil seluruh data kategori dari database.
async function getCategories(req, res) {
    try {
        const { search } = req.query;
        let query = `SELECT id, nama_kategori, deskripsi, created_at, updated_at FROM categories`;
        const values = [];

        if (search && search.trim() !== "") {
            query += " WHERE nama_kategori LIKE ? OR deskripsi LIKE ?";
            const keyword = `%${search.trim()}%`;
            values.push(keyword, keyword);
        }

        query += " ORDER BY id DESC";
        const [categories] = await pool.execute(query, values);

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error("Get categories error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data kategori"
        });
    }
}

// Mengambil satu kategori berdasarkan ID.
async function getCategoryById(req, res) {
    try {
        const { id } = req.params;

        const [categories] = await pool.execute(
            `SELECT id, nama_kategori, deskripsi, created_at, updated_at
             FROM categories
             WHERE id = ?`,
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: categories[0]
        });
    } catch (error) {
        console.error("Get category by ID error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil kategori"
        });
    }
}

// Menambahkan kategori baru setelah memastikan namanya belum digunakan.
async function createCategory(req, res) {
    try {
        const { nama_kategori, deskripsi } = req.body;

        if (!nama_kategori || nama_kategori.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Nama kategori wajib diisi"
            });
        }

        const [existingCategories] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE LOWER(nama_kategori) = LOWER(?)`,
            [nama_kategori.trim()]
        );

        if (existingCategories.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Nama kategori sudah digunakan"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO categories (nama_kategori, deskripsi)
             VALUES (?, ?)`,
            [
                nama_kategori.trim(),
                deskripsi || null
            ]
        );

        const [newCategory] = await pool.execute(
            `SELECT id, nama_kategori, deskripsi, created_at, updated_at
             FROM categories
             WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Kategori berhasil ditambahkan",
            data: newCategory[0]
        });
    } catch (error) {
        console.error("Create category error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan kategori"
        });
    }
}

// Mengubah nama dan deskripsi kategori berdasarkan ID.
async function updateCategory(req, res) {
    try {
        const { id } = req.params;
        const { nama_kategori, deskripsi } = req.body;

        if (!nama_kategori || nama_kategori.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Nama kategori wajib diisi"
            });
        }

        const [category] = await pool.execute(
            "SELECT id FROM categories WHERE id = ?",
            [id]
        );

        if (category.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }

        const [duplicate] = await pool.execute(
            `SELECT id
             FROM categories
             WHERE LOWER(nama_kategori) = LOWER(?)
             AND id <> ?`,
            [nama_kategori.trim(), id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Nama kategori sudah digunakan"
            });
        }

        await pool.execute(
            `UPDATE categories
             SET nama_kategori = ?, deskripsi = ?
             WHERE id = ?`,
            [
                nama_kategori.trim(),
                deskripsi || null,
                id
            ]
        );

        const [updatedCategory] = await pool.execute(
            `SELECT id, nama_kategori, deskripsi, created_at, updated_at
             FROM categories
             WHERE id = ?`,
            [id]
        );

        res.json({
            success: true,
            message: "Kategori berhasil diubah",
            data: updatedCategory[0]
        });
    } catch (error) {
        console.error("Update category error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengubah kategori"
        });
    }
}

// Menghapus kategori jika belum digunakan oleh produk.
async function deleteCategory(req, res) {
    try {
        const { id } = req.params;

        const [category] = await pool.execute(
            "SELECT id FROM categories WHERE id = ?",
            [id]
        );

        if (category.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }

        const [products] = await pool.execute(
            "SELECT id FROM products WHERE category_id = ? LIMIT 1",
            [id]
        );

        if (products.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Kategori tidak dapat dihapus karena masih digunakan produk"
            });
        }

        await pool.execute(
            "DELETE FROM categories WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Kategori berhasil dihapus"
        });
    } catch (error) {
        console.error("Delete category error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus kategori"
        });
    }
}

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};