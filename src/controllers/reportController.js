const { pool } = require("../config/database");

// Membuat filter tanggal dan parameter query berdasarkan periode laporan.
function getDateFilter(query) {
    const { start_date, end_date } = query;

    let condition = "";
    const values = [];

    if (start_date && end_date) {
        condition = " WHERE DATE(tanggal) BETWEEN ? AND ?";
        values.push(start_date, end_date);
    } else if (start_date) {
        condition = " WHERE DATE(tanggal) >= ?";
        values.push(start_date);
    } else if (end_date) {
        condition = " WHERE DATE(tanggal) <= ?";
        values.push(end_date);
    }

    return {
        condition,
        values
    };
}

// Mengambil laporan transaksi dan total penjualan berdasarkan periode.
async function getSalesReport(req, res) {
    try {
        const { condition, values } = getDateFilter(req.query);

        const [sales] = await pool.execute(
            `
            SELECT
                id,
                tanggal,
                total,
                metode_pembayaran
            FROM sales
            ${condition}
            ORDER BY tanggal DESC
            `,
            values
        );

        const [[summary]] = await pool.execute(
            `
            SELECT
                COUNT(*) AS jumlah_transaksi,
                COALESCE(SUM(total), 0) AS total_penjualan
            FROM sales
            ${condition}
            `,
            values
        );

        res.json({
            success: true,
            data: {
                summary: {
                    jumlah_transaksi: Number(summary.jumlah_transaksi),
                    total_penjualan: Number(summary.total_penjualan)
                },
                transactions: sales
            }
        });
    } catch (error) {
        console.error("Sales report error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan penjualan"
        });
    }
}

// Mengambil laporan transaksi dan total pembelian berdasarkan periode.
async function getPurchasesReport(req, res) {
    try {
        const { condition, values } = getDateFilter(req.query);

        const [purchases] = await pool.execute(
            `
            SELECT
                pu.id,
                pu.tanggal,
                pu.total,
                s.nama_supplier
            FROM purchases AS pu
            INNER JOIN suppliers AS s
                ON pu.supplier_id = s.id
            ${condition.replaceAll("tanggal", "pu.tanggal")}
            ORDER BY pu.tanggal DESC
            `,
            values
        );

        const [[summary]] = await pool.execute(
            `
            SELECT
                COUNT(*) AS jumlah_transaksi,
                COALESCE(SUM(total), 0) AS total_pembelian
            FROM purchases
            ${condition}
            `,
            values
        );

        res.json({
            success: true,
            data: {
                summary: {
                    jumlah_transaksi: Number(summary.jumlah_transaksi),
                    total_pembelian: Number(summary.total_pembelian)
                },
                transactions: purchases
            }
        });
    } catch (error) {
        console.error("Purchases report error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan pembelian"
        });
    }
}

// Menghitung pendapatan, modal, dan keuntungan berdasarkan periode.
async function getProfitReport(req, res) {
    try {
        const {
            start_date,
            end_date
        } = req.query;

        let condition = "";
        const values = [];

        if (start_date && end_date) {
            condition = " WHERE DATE(s.tanggal) BETWEEN ? AND ?";
            values.push(start_date, end_date);
        } else if (start_date) {
            condition = " WHERE DATE(s.tanggal) >= ?";
            values.push(start_date);
        } else if (end_date) {
            condition = " WHERE DATE(s.tanggal) <= ?";
            values.push(end_date);
        }

        const [[profit]] = await pool.execute(
            `
            SELECT
                COALESCE(SUM(sd.subtotal), 0) AS pendapatan,
                COALESCE(
                    SUM(sd.jumlah * sd.harga_beli),
                    0
                ) AS modal,
                COALESCE(
                    SUM(
                        sd.subtotal - (sd.jumlah * sd.harga_beli)
                    ),
                    0
                ) AS keuntungan
            FROM sales AS s
            INNER JOIN sale_details AS sd
                ON s.id = sd.sale_id
            INNER JOIN products AS p
                ON sd.product_id = p.id
            ${condition}
            `,
            values
        );

        res.json({
            success: true,
            data: {
                pendapatan: Number(profit.pendapatan),
                modal: Number(profit.modal),
                keuntungan: Number(profit.keuntungan)
            }
        });
    } catch (error) {
        console.error("Profit report error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghitung laporan keuntungan"
        });
    }
}

module.exports = {
    getSalesReport,
    getPurchasesReport,
    getProfitReport
};