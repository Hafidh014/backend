const { pool } = require("../config/database");

async function getHistory(req, res) {
    try {
        const { start_date, end_date, type = "all" } = req.query;
        const values = [];
        const filters = [];

        if (start_date) {
            filters.push("DATE(tanggal) >= ?");
            values.push(start_date);
        }
        if (end_date) {
            filters.push("DATE(tanggal) <= ?");
            values.push(end_date);
        }

        const dateFilter = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
        const parts = [];

        if (type === "all" || type === "purchase") {
            parts.push(`
                SELECT pu.id, 'purchase' AS type, pu.tanggal, pu.total,
                       s.nama_supplier AS description, NULL AS payment_method
                FROM purchases pu
                INNER JOIN suppliers s ON s.id = pu.supplier_id
                ${dateFilter}
            `);
        }

        if (type === "all" || type === "sale") {
            parts.push(`
                SELECT sa.id, 'sale' AS type, sa.tanggal, sa.total,
                       'Penjualan' AS description, sa.metode_pembayaran AS payment_method
                FROM sales sa
                ${dateFilter}
            `);
        }

        if (!parts.length) {
            return res.status(400).json({ success: false, message: "Tipe riwayat tidak valid" });
        }

        const query = `SELECT * FROM (${parts.join(" UNION ALL ")}) history ORDER BY tanggal DESC`;
        const queryValues = parts.length === 2
            ? [...values, ...values]
            : values;
        const [history] = await pool.query(query, queryValues);
        return res.json({ success: true, data: history });
    } catch (error) {
        console.error("Get history error:", error);
        return res.status(500).json({ success: false, message: "Gagal mengambil riwayat transaksi" });
    }
}

module.exports = { getHistory };
