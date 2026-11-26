const { pool } = require("../config/database");

// Memvalidasi data supplier, terutama nama dan nomor telepon.
function validateSupplierData(data) {
    const {
        nama_supplier,
        alamat,
        no_telepon
    } = data;

    if (!nama_supplier || nama_supplier.trim() === "") {
        return "Nama supplier wajib diisi";
    }

    if (
        no_telepon !== undefined &&
        no_telepon !== null &&
        no_telepon !== "" &&
        !/^[0-9+\-\s()]+$/.test(String(no_telepon))
    ) {
        return "Format nomor telepon tidak valid";
    }

    return null;
}

// Mengambil daftar supplier dan mendukung pencarian data supplier.
async function getSuppliers(req, res) {
    try {
        const { search } = req.query;

        let query = `
            SELECT
                id,
                nama_supplier,
                alamat,
                no_telepon,
                created_at,
                updated_at
            FROM suppliers
        `;

        const values = [];

        if (search && search.trim() !== "") {
            query += `
                WHERE nama_supplier LIKE ?
                OR no_telepon LIKE ?
            `;

            const keyword = `%${search.trim()}%`;
            values.push(keyword, keyword);
        }

        query += " ORDER BY id DESC";

        const [suppliers] = await pool.execute(query, values);

        res.json({
            success: true,
            data: suppliers
        });
    } catch (error) {
        console.error("Get suppliers error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data supplier"
        });
    }
}

// Mengambil satu data supplier berdasarkan ID.
async function getSupplierById(req, res) {
    try {
        const { id } = req.params;

        const [suppliers] = await pool.execute(
            `
            SELECT
                id,
                nama_supplier,
                alamat,
                no_telepon,
                created_at,
                updated_at
            FROM suppliers
            WHERE id = ?
            `,
            [id]
        );

        if (suppliers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: suppliers[0]
        });
    } catch (error) {
        console.error("Get supplier by ID error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil supplier"
        });
    }
}

// Menambahkan data supplier baru setelah validasi.
async function createSupplier(req, res) {
    try {
        const validationError = validateSupplierData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const {
            nama_supplier,
            alamat,
            no_telepon
        } = req.body;

        const [result] = await pool.execute(
            `
            INSERT INTO suppliers
                (nama_supplier, alamat, no_telepon)
            VALUES (?, ?, ?)
            `,
            [
                nama_supplier.trim(),
                alamat || null,
                no_telepon || null
            ]
        );

        const [newSupplier] = await pool.execute(
            `
            SELECT
                id,
                nama_supplier,
                alamat,
                no_telepon,
                created_at,
                updated_at
            FROM suppliers
            WHERE id = ?
            `,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Supplier berhasil ditambahkan",
            data: newSupplier[0]
        });
    } catch (error) {
        console.error("Create supplier error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan supplier"
        });
    }
}

// Mengubah data supplier berdasarkan ID.
async function updateSupplier(req, res) {
    try {
        const { id } = req.params;
        const validationError = validateSupplierData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const {
            nama_supplier,
            alamat,
            no_telepon
        } = req.body;

        const [supplier] = await pool.execute(
            "SELECT id FROM suppliers WHERE id = ?",
            [id]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier tidak ditemukan"
            });
        }

        await pool.execute(
            `
            UPDATE suppliers
            SET
                nama_supplier = ?,
                alamat = ?,
                no_telepon = ?
            WHERE id = ?
            `,
            [
                nama_supplier.trim(),
                alamat || null,
                no_telepon || null,
                id
            ]
        );

        const [updatedSupplier] = await pool.execute(
            `
            SELECT
                id,
                nama_supplier,
                alamat,
                no_telepon,
                created_at,
                updated_at
            FROM suppliers
            WHERE id = ?
            `,
            [id]
        );

        res.json({
            success: true,
            message: "Supplier berhasil diubah",
            data: updatedSupplier[0]
        });
    } catch (error) {
        console.error("Update supplier error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengubah supplier"
        });
    }
}

// Menghapus supplier jika belum digunakan dalam pembelian.
async function deleteSupplier(req, res) {
    try {
        const { id } = req.params;

        const [supplier] = await pool.execute(
            "SELECT id FROM suppliers WHERE id = ?",
            [id]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier tidak ditemukan"
            });
        }

        const [purchases] = await pool.execute(
            "SELECT id FROM purchases WHERE supplier_id = ? LIMIT 1",
            [id]
        );

        if (purchases.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Supplier tidak dapat dihapus karena sudah digunakan dalam pembelian"
            });
        }

        await pool.execute(
            "DELETE FROM suppliers WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Supplier berhasil dihapus"
        });
    } catch (error) {
        console.error("Delete supplier error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus supplier"
        });
    }
}

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
};