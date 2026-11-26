const { pool } = require("../config/database");

// Mengambil daftar transaksi pembelian.
async function getPurchases(req, res) {
    try {
        const { search, start, end, start_date, end_date } = req.query;
        const values = [];
        const filters = [];
        const startDate = start || start_date;
        const endDate = end || end_date;

        if (search && search.trim()) {
            filters.push("(pu.no_transaksi LIKE ? OR CAST(pu.id AS CHAR) LIKE ? OR s.nama_supplier LIKE ? OR p.nama_produk LIKE ? OR DATE_FORMAT(pu.tanggal, '%Y-%m-%d') LIKE ?)");
            const keyword = `%${search.trim()}%`;
            values.push(keyword, keyword, keyword, keyword, keyword);
        }
        if (startDate) { filters.push("DATE(pu.tanggal) >= ?"); values.push(startDate); }
        if (endDate) { filters.push("DATE(pu.tanggal) <= ?"); values.push(endDate); }

        const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
        const [purchases] = await pool.execute(`
            SELECT DISTINCT pu.id, pu.no_transaksi, pu.supplier_id, s.nama_supplier, pu.tanggal, pu.total, pu.created_at
            FROM purchases AS pu
            INNER JOIN suppliers AS s ON pu.supplier_id = s.id
            LEFT JOIN purchase_details AS pd ON pd.purchase_id = pu.id
            LEFT JOIN products AS p ON p.id = pd.product_id
            ${where}
            ORDER BY pu.id DESC
        `, values);

        res.json({
            success: true,
            data: purchases
        });
    } catch (error) {
        console.error("Get purchases error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pembelian"
        });
    }
}

// Mengambil detail transaksi pembelian berdasarkan ID.
async function getPurchaseById(req, res) {
    try {
        const { id } = req.params;

        const [purchases] = await pool.execute(`
            SELECT
                pu.id,
                pu.no_transaksi,
                pu.supplier_id,
                s.nama_supplier,
                pu.tanggal,
                pu.total,
                pu.created_at
            FROM purchases AS pu
            INNER JOIN suppliers AS s
                ON pu.supplier_id = s.id
            WHERE pu.id = ?
        `, [id]);

        if (purchases.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Transaksi pembelian tidak ditemukan"
            });
        }

        const [details] = await pool.execute(`
            SELECT
                pd.id,
                pd.product_id,
                p.nama_produk,
                pd.jumlah,
                pd.harga_beli,
                pd.subtotal
            FROM purchase_details AS pd
            INNER JOIN products AS p
                ON pd.product_id = p.id
            WHERE pd.purchase_id = ?
            ORDER BY pd.id ASC
        `, [id]);

        res.json({
            success: true,
            data: {
                ...purchases[0],
                details
            }
        });
    } catch (error) {
        console.error("Get purchase by ID error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil detail pembelian"
        });
    }
}

// Membuat transaksi pembelian dan menambah stok produk secara transaksional.
async function createPurchase(req, res) {
    let connection;

    try {
        const { supplier_id, tanggal, items } = req.body || {};
        const transactionDate = tanggal || new Date().toISOString().slice(0, 19).replace("T", " ");

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "Supplier wajib dipilih"
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
            return res.status(400).json({
                success: false,
                message: "ID produk tidak valid"
            });
        }
        if (new Set(productIds).size !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: "Produk yang sama tidak boleh muncul lebih dari satu kali"
            });
        }

        connection = await pool.getConnection();

        const [suppliers] = await connection.execute(
            "SELECT id FROM suppliers WHERE id = ?",
            [supplier_id]
        );

        if (suppliers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Supplier tidak ditemukan"
            });
        }

        await connection.beginTransaction();

        let total = 0;
        const purchaseItems = [];

        for (const item of items) {
            const {
                product_id,
                jumlah,
                harga_beli
            } = item;

            const quantity = Number(jumlah);
            const buyPrice = Number(harga_beli);

            if (
                !product_id ||
                !Number.isSafeInteger(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(buyPrice) ||
                buyPrice < 0
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Data produk, jumlah, dan harga beli tidak valid"
                });
            }

            const [products] = await connection.execute(
                `
                SELECT id, nama_produk
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

            const subtotal = quantity * buyPrice;

            total += subtotal;

            purchaseItems.push({
                product_id,
                jumlah: quantity,
                harga_beli: buyPrice,
                subtotal
            });
        }

        const noTransaksi = `PUR-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
        const [purchaseResult] = await connection.execute(
            `
            INSERT INTO purchases
                (no_transaksi, supplier_id, tanggal, total)
            VALUES (?, ?, ?, ?)
            `,
            [noTransaksi, supplier_id, transactionDate, total]
        );

        const purchaseId = purchaseResult.insertId;

        for (const item of purchaseItems) {
            await connection.execute(
                `
                INSERT INTO purchase_details
                    (purchase_id, product_id, jumlah, harga_beli)
                VALUES (?, ?, ?, ?)
                `,
                [
                    purchaseId,
                    item.product_id,
                    item.jumlah,
                    item.harga_beli
                ]
            );

            await connection.execute(
                `
                UPDATE products
                SET
                    stok = stok + ?,
                    harga_beli = ?
                WHERE id = ?
                `,
                [
                    item.jumlah,
                    item.harga_beli,
                    item.product_id
                ]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Pembelian berhasil disimpan",
            data: {
                id: purchaseId,
                no_transaksi: noTransaksi,
                supplier_id,
                total,
                items: purchaseItems
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Create purchase error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan pembelian"
        });
    } finally {
        if (connection) connection.release();
    }
}

async function updatePurchase(req, res) {
    let connection;
    try {
        const purchaseId = Number(req.params.id);
        const { supplier_id, tanggal, items } = req.body || {};
        const transactionDate = tanggal || null;
        if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0 || !supplier_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Supplier dan minimal satu produk wajib diisi" });
        }

        const productIds = items.map((item) => Number(item.product_id));
        if (new Set(productIds).size !== productIds.length) {
            return res.status(400).json({ success: false, message: "Produk yang sama tidak boleh muncul lebih dari satu kali" });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [oldPurchases] = await connection.execute("SELECT id FROM purchases WHERE id = ? FOR UPDATE", [purchaseId]);
        if (!oldPurchases.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Transaksi pembelian tidak ditemukan" });
        }

        const [supplier] = await connection.execute("SELECT id FROM suppliers WHERE id = ?", [supplier_id]);
        if (!supplier.length) throw new Error("Supplier tidak ditemukan");

        const [oldItems] = await connection.execute(
            "SELECT product_id, jumlah FROM purchase_details WHERE purchase_id = ?",
            [purchaseId]
        );
        for (const item of oldItems) {
            const [stock] = await connection.execute("SELECT stok FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
            if (!stock.length || stock[0].stok < item.jumlah) throw new Error("Stok tidak mencukupi untuk membatalkan pembelian lama");
            await connection.execute("UPDATE products SET stok = stok - ? WHERE id = ?", [item.jumlah, item.product_id]);
        }

        let total = 0;
        const newItems = [];
        for (const item of items) {
            const quantity = Number(item.jumlah);
            const buyPrice = Number(item.harga_beli);
            if (!Number.isSafeInteger(Number(item.product_id)) || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(buyPrice) || buyPrice < 0) {
                throw new Error("Data produk, jumlah, dan harga beli tidak valid");
            }
            const [product] = await connection.execute("SELECT id FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
            if (!product.length) throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
            const subtotal = quantity * buyPrice;
            total += subtotal;
            newItems.push({ product_id: Number(item.product_id), jumlah: quantity, harga_beli: buyPrice });
        }

        await connection.execute("DELETE FROM purchase_details WHERE purchase_id = ?", [purchaseId]);
        const updatePurchaseQuery = transactionDate
            ? "UPDATE purchases SET supplier_id = ?, tanggal = ?, total = ? WHERE id = ?"
            : "UPDATE purchases SET supplier_id = ?, total = ? WHERE id = ?";
        const updatePurchaseValues = transactionDate
            ? [supplier_id, transactionDate, total, purchaseId]
            : [supplier_id, total, purchaseId];
        await connection.execute(updatePurchaseQuery, updatePurchaseValues);
        for (const item of newItems) {
            await connection.execute("INSERT INTO purchase_details (purchase_id, product_id, jumlah, harga_beli) VALUES (?, ?, ?, ?)", [purchaseId, item.product_id, item.jumlah, item.harga_beli]);
            await connection.execute("UPDATE products SET stok = stok + ?, harga_beli = ? WHERE id = ?", [item.jumlah, item.harga_beli, item.product_id]);
        }
        await connection.commit();
        const [updatedPurchase] = await connection.execute("SELECT no_transaksi FROM purchases WHERE id = ?", [purchaseId]);
        return res.json({ success: true, message: "Pembelian berhasil diubah", data: { id: purchaseId, no_transaksi: updatedPurchase[0].no_transaksi, supplier_id, total, items: newItems } });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Update purchase error:", error);
        return res.status(error.message.includes("Stok") ? 409 : error.message.includes("tidak ditemukan") ? 404 : 400).json({ success: false, message: error.message || "Gagal mengubah pembelian" });
    } finally {
        if (connection) connection.release();
    }
}

async function deletePurchase(req, res) {
    let connection;
    try {
        const purchaseId = Number(req.params.id);
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [purchase] = await connection.execute("SELECT id FROM purchases WHERE id = ? FOR UPDATE", [purchaseId]);
        if (!purchase.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Transaksi pembelian tidak ditemukan" });
        }
        const [items] = await connection.execute("SELECT product_id, jumlah FROM purchase_details WHERE purchase_id = ?", [purchaseId]);
        for (const item of items) {
            const [product] = await connection.execute("SELECT stok FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
            if (!product.length || product[0].stok < item.jumlah) throw new Error("Stok tidak mencukupi untuk menghapus pembelian");
            await connection.execute("UPDATE products SET stok = stok - ? WHERE id = ?", [item.jumlah, item.product_id]);
        }
        await connection.execute("DELETE FROM purchases WHERE id = ?", [purchaseId]);
        await connection.commit();
        return res.json({ success: true, message: "Pembelian berhasil dihapus" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Delete purchase error:", error);
        return res.status(error.message.includes("Stok") ? 409 : 400).json({ success: false, message: error.message || "Gagal menghapus pembelian" });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase
};