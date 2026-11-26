const { pool } = require("../config/database");

// Mengambil daftar transaksi penjualan.
async function getSales(req, res) {
    try {
        const { search, start, end, start_date, end_date } = req.query;
        const values = [];
        const filters = [];
        const startDate = start || start_date;
        const endDate = end || end_date;

        if (search && search.trim()) {
            filters.push("(s.no_transaksi LIKE ? OR CAST(s.id AS CHAR) LIKE ? OR DATE_FORMAT(s.tanggal, '%Y-%m-%d') LIKE ?)");
            const keyword = `%${search.trim()}%`;
            values.push(keyword, keyword, keyword);
        }
        if (startDate) { filters.push("DATE(s.tanggal) >= ?"); values.push(startDate); }
        if (endDate) { filters.push("DATE(s.tanggal) <= ?"); values.push(endDate); }

        const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
        const [sales] = await pool.execute(`
            SELECT s.id, s.no_transaksi, s.tanggal, s.total, s.metode_pembayaran, s.created_at
            FROM sales AS s
            ${where}
            ORDER BY s.id DESC
        `, values);

        res.json({
            success: true,
            data: sales
        });
    } catch (error) {
        console.error("Get sales error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data penjualan"
        });
    }
}

// Mengambil detail transaksi penjualan berdasarkan ID.
async function getSaleById(req, res) {
    try {
        const { id } = req.params;

        const [sales] = await pool.execute(`
            SELECT
                s.id,
                s.no_transaksi,
                s.tanggal,
                s.total,
                s.metode_pembayaran,
                s.created_at
            FROM sales AS s
            WHERE s.id = ?
        `, [id]);

        if (sales.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Transaksi penjualan tidak ditemukan"
            });
        }

        const [details] = await pool.execute(`
            SELECT
                sd.id,
                sd.product_id,
                p.nama_produk,
                sd.jumlah,
                sd.harga_jual,
                sd.subtotal
            FROM sale_details AS sd
            INNER JOIN products AS p
                ON sd.product_id = p.id
            WHERE sd.sale_id = ?
            ORDER BY sd.id ASC
        `, [id]);

        res.json({
            success: true,
            data: {
                ...sales[0],
                details
            }
        });
    } catch (error) {
        console.error("Get sale by ID error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail penjualan"
        });
    }
}

// Membuat transaksi penjualan dan mengurangi stok produk secara transaksional.
async function createSale(req, res) {
    let connection;

    try {
        const {
            metode_pembayaran,
            tanggal,
            items
        } = req.body || {};
        const transactionDate = tanggal || new Date().toISOString().slice(0, 19).replace("T", " ");

        const paymentMethods = [
            "tunai",
            "transfer",
            "qris"
        ];

        if (!paymentMethods.includes(metode_pembayaran)) {
            return res.status(400).json({
                success: false,
                message: "Metode pembayaran tidak valid"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Minimal harus ada satu produk"
            });
        }

        const productIds = items.map((item) => Number(item.product_id));
        if (productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
            return res.status(400).json({ success: false, message: "ID produk tidak valid" });
        }
        if (new Set(productIds).size !== productIds.length) {
            return res.status(400).json({ success: false, message: "Produk yang sama tidak boleh muncul lebih dari satu kali" });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let total = 0;
        const saleItems = [];

        for (const item of items) {
            const {
                product_id,
                jumlah
            } = item;

            const quantity = Number(jumlah);

            if (
                !product_id ||
                !Number.isSafeInteger(quantity) ||
                quantity <= 0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Data produk atau jumlah tidak valid"
                });
            }

            const [products] = await connection.execute(
                `
                SELECT
                    id,
                    nama_produk,
                    harga_jual,
                    harga_beli,
                    stok
                FROM products
                WHERE id = ?
                FOR UPDATE
                `,
                [product_id]
            );

            if (products.length === 0) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Produk dengan ID ${product_id} tidak ditemukan`
                });
            }

            const product = products[0];

            if (product.stok < quantity) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Stok ${product.nama_produk} tidak mencukupi`
                });
            }

            const hargaJual = Number(product.harga_jual);
            const subtotal = quantity * hargaJual;

            total += subtotal;

            saleItems.push({
                product_id: product.id,
                nama_produk: product.nama_produk,
                jumlah: quantity,
                harga_jual: hargaJual,
                harga_beli: Number(product.harga_beli),
                subtotal
            });
        }

        const noTransaksi = `SAL-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
        const [saleResult] = await connection.execute(
            `
            INSERT INTO sales
                (no_transaksi, tanggal, total, metode_pembayaran)
            VALUES (?, ?, ?, ?)
            `,
            [noTransaksi, transactionDate, total, metode_pembayaran]
        );

        const saleId = saleResult.insertId;

        for (const item of saleItems) {
            await connection.execute(
                `
                INSERT INTO sale_details
                    (sale_id, product_id, jumlah, harga_jual, harga_beli)
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    saleId,
                    item.product_id,
                    item.jumlah,
                    item.harga_jual,
                    item.harga_beli
                ]
            );

            const [stockResult] = await connection.execute(
                `
                UPDATE products
                SET stok = stok - ?
                WHERE id = ?
                  AND stok >= ?
                `,
                [
                    item.jumlah,
                    item.product_id,
                    item.jumlah
                ]
            );

            if (stockResult.affectedRows !== 1) {
                throw new Error("Stok produk berubah saat transaksi diproses");
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Penjualan berhasil disimpan",
            data: {
                id: saleId,
                no_transaksi: noTransaksi,
                total,
                metode_pembayaran,
                items: saleItems
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Create sale error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan penjualan"
        });
    } finally {
        if (connection) connection.release();
    }
}

async function updateSale(req, res) {
    let connection;
    try {
        const saleId = Number(req.params.id);
        const { metode_pembayaran, tanggal, items } = req.body || {};
        const transactionDate = tanggal || null;
        const methods = ["tunai", "transfer", "qris"];
        if (!Number.isSafeInteger(saleId) || saleId <= 0 || !methods.includes(metode_pembayaran) || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Metode pembayaran dan minimal satu produk wajib diisi" });
        }
        const productIds = items.map((item) => Number(item.product_id));
        if (new Set(productIds).size !== productIds.length) {
            return res.status(400).json({ success: false, message: "Produk yang sama tidak boleh muncul lebih dari satu kali" });
        }
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [sales] = await connection.execute("SELECT id FROM sales WHERE id = ? FOR UPDATE", [saleId]);
        if (!sales.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Transaksi penjualan tidak ditemukan" });
        }
        const [oldItems] = await connection.execute("SELECT product_id, jumlah FROM sale_details WHERE sale_id = ?", [saleId]);
        for (const item of oldItems) {
            await connection.execute("UPDATE products SET stok = stok + ? WHERE id = ?", [item.jumlah, item.product_id]);
        }
        let total = 0;
        const newItems = [];
        for (const item of items) {
            const quantity = Number(item.jumlah);
            if (!Number.isSafeInteger(Number(item.product_id)) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Data produk atau jumlah tidak valid");
            const [products] = await connection.execute("SELECT id, nama_produk, harga_jual, stok FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
            if (!products.length) throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
            const product = products[0];
            if (product.stok < quantity) throw new Error(`Stok ${product.nama_produk} tidak mencukupi`);
            const hargaJual = Number(product.harga_jual);
            const subtotal = quantity * hargaJual;
            total += subtotal;
            newItems.push({ product_id: product.id, nama_produk: product.nama_produk, jumlah: quantity, harga_jual: hargaJual, subtotal });
        }
        await connection.execute("DELETE FROM sale_details WHERE sale_id = ?", [saleId]);
        const updateSaleQuery = transactionDate
            ? "UPDATE sales SET tanggal = ?, total = ?, metode_pembayaran = ? WHERE id = ?"
            : "UPDATE sales SET total = ?, metode_pembayaran = ? WHERE id = ?";
        const updateSaleValues = transactionDate
            ? [transactionDate, total, metode_pembayaran, saleId]
            : [total, metode_pembayaran, saleId];
        await connection.execute(updateSaleQuery, updateSaleValues);
        for (const item of newItems) {
            await connection.execute("INSERT INTO sale_details (sale_id, product_id, jumlah, harga_jual) VALUES (?, ?, ?, ?)", [saleId, item.product_id, item.jumlah, item.harga_jual]);
            await connection.execute("UPDATE products SET stok = stok - ? WHERE id = ? AND stok >= ?", [item.jumlah, item.product_id, item.jumlah]);
        }
        await connection.commit();
        const [updatedSale] = await connection.execute("SELECT no_transaksi FROM sales WHERE id = ?", [saleId]);
        return res.json({ success: true, message: "Penjualan berhasil diubah", data: { id: saleId, no_transaksi: updatedSale[0].no_transaksi, total, metode_pembayaran, items: newItems } });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Update sale error:", error);
        return res.status(error.message.includes("Stok") ? 409 : error.message.includes("tidak ditemukan") ? 404 : 400).json({ success: false, message: error.message || "Gagal mengubah penjualan" });
    } finally {
        if (connection) connection.release();
    }
}

async function deleteSale(req, res) {
    let connection;
    try {
        const saleId = Number(req.params.id);
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [sales] = await connection.execute("SELECT id FROM sales WHERE id = ? FOR UPDATE", [saleId]);
        if (!sales.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Transaksi penjualan tidak ditemukan" });
        }
        const [items] = await connection.execute("SELECT product_id, jumlah FROM sale_details WHERE sale_id = ?", [saleId]);
        for (const item of items) {
            await connection.execute("UPDATE products SET stok = stok + ? WHERE id = ?", [item.jumlah, item.product_id]);
        }
        await connection.execute("DELETE FROM sales WHERE id = ?", [saleId]);
        await connection.commit();
        return res.json({ success: true, message: "Penjualan berhasil dihapus" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Delete sale error:", error);
        return res.status(400).json({ success: false, message: error.message || "Gagal menghapus penjualan" });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getSales,
    getSaleById,
    createSale,
    updateSale,
    deleteSale
};