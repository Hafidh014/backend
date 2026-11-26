const { pool } = require("../config/database");

// Mengambil ringkasan statistik utama untuk dashboard.
async function getDashboard(req, res) {
    try {
        const [[productSummary]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_produk,
                COALESCE(SUM(stok), 0) AS total_stok
            FROM products
        `);

        const [[categorySummary]] = await pool.execute(`
            SELECT COUNT(*) AS total_kategori
            FROM categories
        `);

        const [[purchaseSummary]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_pembelian,
                COALESCE(SUM(total), 0) AS nilai_pembelian
            FROM purchases
        `);

        const [[saleSummary]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_penjualan,
                COALESCE(SUM(total), 0) AS pendapatan_penjualan
            FROM sales
        `);

        res.json({
            success: true,
            data: {
                total_produk: Number(productSummary.total_produk),
                total_stok: Number(productSummary.total_stok),
                total_kategori: Number(categorySummary.total_kategori),
                total_pembelian: Number(purchaseSummary.total_pembelian),
                nilai_pembelian: Number(purchaseSummary.nilai_pembelian),
                total_penjualan: Number(saleSummary.total_penjualan),
                pendapatan_penjualan: Number(
                    saleSummary.pendapatan_penjualan
                )
            }
        });
    } catch (error) {
        console.error("Get dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data dashboard"
        });
    }
}

module.exports = {
    getDashboard
};