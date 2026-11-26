const { pool } = require("../config/database");
const fs = require("fs");
const path = require("path");

function removeProductPhoto(photoUrl) {
    if (!photoUrl) return;
    const relativePath = photoUrl.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", relativePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// Memvalidasi kelengkapan dan format data produk sebelum diproses.
function validateProductData(data) {
    const {
        category_id,
        nama_produk,
        harga_beli,
        harga_jual,
        stok
    } = data;

    if (
        category_id === undefined ||
        category_id === null ||
        !nama_produk ||
        nama_produk.trim() === "" ||
        harga_beli === undefined ||
        harga_jual === undefined ||
        stok === undefined
    ) {
        return "Kategori, nama produk, harga, dan stok wajib diisi";
    }

    if (
        Number.isNaN(Number(category_id)) ||
        Number.isNaN(Number(harga_beli)) ||
        Number.isNaN(Number(harga_jual)) ||
        Number.isNaN(Number(stok))
    ) {
        return "Nilai kategori, harga, dan stok harus berupa angka";
    }

    if (
        Number(harga_beli) < 0 ||
        Number(harga_jual) < 0 ||
        Number(stok) < 0 ||
        !Number.isInteger(Number(stok))
    ) {
        return "Harga tidak boleh negatif dan stok harus bilangan bulat";
    }

    return null;
}

// Mengambil daftar produk dan mendukung pencarian berdasarkan nama produk.
async function getProducts(req, res) {
    try {
        const { search } = req.query;

        let query = `
            SELECT
                p.id,
                p.category_id,
                c.nama_kategori,
                p.nama_produk,
                p.harga_beli,
                p.harga_jual,
                p.stok,
                p.foto,
                p.created_at,
                p.updated_at
            FROM products AS p
            INNER JOIN categories AS c
                ON p.category_id = c.id
        `;

        const values = [];

        if (search && search.trim() !== "") {
            query += " WHERE p.nama_produk LIKE ?";
            values.push(`%${search.trim()}%`);
        }

        query += " ORDER BY p.id DESC";

        const [products] = await pool.execute(query, values);

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error("Get products error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data produk"
        });
    }
}

// Mengambil satu data produk berdasarkan ID.
async function getProductById(req, res) {
    try {
        const { id } = req.params;

        const [products] = await pool.execute(
            `
            SELECT
                p.id,
                p.category_id,
                c.nama_kategori,
                p.nama_produk,
                p.harga_beli,
                p.harga_jual,
                p.stok,
                p.foto,
                p.created_at,
                p.updated_at
            FROM products AS p
            INNER JOIN categories AS c
                ON p.category_id = c.id
            WHERE p.id = ?
            `,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: products[0]
        });
    } catch (error) {
        console.error("Get product by ID error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil produk"
        });
    }
}

// Menambahkan produk baru setelah validasi kategori dan data produk.
async function createProduct(req, res) {
    try {
        const validationError = validateProductData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const {
            category_id,
            nama_produk,
            harga_beli,
            harga_jual,
            stok
        } = req.body;

        const [categories] = await pool.execute(
            "SELECT id FROM categories WHERE id = ?",
            [category_id]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }

        const [result] = await pool.execute(
            `
            INSERT INTO products
                (category_id, nama_produk, harga_beli, harga_jual, stok)
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                category_id,
                nama_produk.trim(),
                harga_beli,
                harga_jual,
                stok
            ]
        );

        const [newProduct] = await pool.execute(
            `
            SELECT
                p.id,
                p.category_id,
                c.nama_kategori,
                p.nama_produk,
                p.harga_beli,
                p.harga_jual,
                p.stok,
                p.foto,
                p.created_at,
                p.updated_at
            FROM products AS p
            INNER JOIN categories AS c
                ON p.category_id = c.id
            WHERE p.id = ?
            `,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Produk berhasil ditambahkan",
            data: newProduct[0]
        });
    } catch (error) {
        console.error("Create product error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan produk"
        });
    }
}

// Mengubah data produk berdasarkan ID setelah validasi.
async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const validationError = validateProductData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const {
            category_id,
            nama_produk,
            harga_beli,
            harga_jual,
            stok
        } = req.body;

        const [products] = await pool.execute(
            "SELECT id FROM products WHERE id = ?",
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        const [categories] = await pool.execute(
            "SELECT id FROM categories WHERE id = ?",
            [category_id]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan"
            });
        }

        await pool.execute(
            `
            UPDATE products
            SET
                category_id = ?,
                nama_produk = ?,
                harga_beli = ?,
                harga_jual = ?,
                stok = ?
            WHERE id = ?
            `,
            [
                category_id,
                nama_produk.trim(),
                harga_beli,
                harga_jual,
                stok,
                id
            ]
        );

        const [updatedProduct] = await pool.execute(
            `
            SELECT
                p.id,
                p.category_id,
                c.nama_kategori,
                p.nama_produk,
                p.harga_beli,
                p.harga_jual,
                p.stok,
                p.foto,
                p.created_at,
                p.updated_at
            FROM products AS p
            INNER JOIN categories AS c
                ON p.category_id = c.id
            WHERE p.id = ?
            `,
            [id]
        );

        res.json({
            success: true,
            message: "Produk berhasil diubah",
            data: updatedProduct[0]
        });
    } catch (error) {
        console.error("Update product error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengubah produk"
        });
    }
}

// Menghapus produk jika belum digunakan dalam transaksi.
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;

        const [products] = await pool.execute(
            "SELECT id, foto FROM products WHERE id = ?",
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        const [purchaseDetails] = await pool.execute(
            "SELECT id FROM purchase_details WHERE product_id = ? LIMIT 1",
            [id]
        );

        const [saleDetails] = await pool.execute(
            "SELECT id FROM sale_details WHERE product_id = ? LIMIT 1",
            [id]
        );

        if (
            purchaseDetails.length > 0 ||
            saleDetails.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message: "Produk tidak dapat dihapus karena sudah digunakan dalam transaksi"
            });
        }

        await pool.execute(
            "DELETE FROM products WHERE id = ?",
            [id]
        );
        removeProductPhoto(products[0].foto);

        res.json({
            success: true,
            message: "Produk berhasil dihapus"
        });
    } catch (error) {
        console.error("Delete product error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus produk"
        });
    }
}


// Menyimpan URL foto produk yang telah diunggah ke database.
async function uploadProductPhoto(req, res) {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Foto produk wajib dipilih"
            });
        }

        const [products] = await pool.execute(
            "SELECT id, foto FROM products WHERE id = ?",
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        const photoUrl = `/uploads/products/${req.file.filename}`;
        const oldPhoto = products[0].foto;

        await pool.execute(
            "UPDATE products SET foto = ? WHERE id = ?",
            [photoUrl, id]
        );
        removeProductPhoto(oldPhoto);

        res.json({
            success: true,
            message: "Foto produk berhasil diunggah",
            data: {
                product_id: Number(id),
                foto: photoUrl
            }
        });
    } catch (error) {
        console.error("Upload product photo error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengunggah foto produk"
        });
    }
}

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductPhoto
};