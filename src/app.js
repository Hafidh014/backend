const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const saleRoutes = require("./routes/saleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const historyRoutes = require("./routes/historyRoutes");
const path = require("path");


const {
    authenticateToken
} = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend TokoSync berjalan"
    });
});


app.get(
    "/api/protected",
    authenticateToken,
    (req, res) => {
        res.json({
            success: true,
            message: "Anda berhasil mengakses endpoint yang dilindungi",
            user: req.user
        });
    }
);



app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/categories", categoryRoutes);


app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "Ukuran foto maksimal 2 MB" });
    }
    return res.status(400).json({
        success: false,
        message: error.message || "Terjadi kesalahan pada server"
    });
});

module.exports = app;