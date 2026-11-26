const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiry(token) {
    const decoded = jwt.decode(token);
    return decoded && decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function createTokens(user) {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error("JWT_SECRET dan JWT_REFRESH_SECRET wajib dikonfigurasi");
    }

    const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
    );

    return { accessToken, refreshToken };
}

async function saveRefreshToken(userId, refreshToken) {
    await pool.execute(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)`,
        [userId, hashToken(refreshToken), getRefreshExpiry(refreshToken)]
    );
}

async function register(req, res) {
    try {
        const { nama, email, password } = req.body || {};
        const normalizedNama = typeof nama === "string" ? nama.trim() : "";
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedNama || !normalizedEmail || typeof password !== "string" || !password) {
            return res.status(400).json({ success: false, message: "Nama, email, dan password wajib diisi" });
        }
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: "Format email tidak valid" });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
        }

        const [existingUsers] = await pool.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1", [normalizedEmail]
        );
        if (existingUsers.length) {
            return res.status(409).json({ success: false, message: "Email sudah terdaftar" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            "INSERT INTO users (nama, email, password) VALUES (?, ?, ?)",
            [normalizedNama, normalizedEmail, hashedPassword]
        );

        return res.status(201).json({
            success: true,
            message: "Registrasi berhasil",
            data: { id: result.insertId, nama: normalizedNama, email: normalizedEmail }
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body || {};
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        if (!normalizedEmail || typeof password !== "string" || !password) {
            return res.status(400).json({ success: false, message: "Email dan password wajib diisi" });
        }
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: "Format email tidak valid" });
        }

        const [users] = await pool.execute(
            "SELECT id, nama, email, password FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
            return res.status(401).json({ success: false, message: "Email atau password salah" });
        }

        const user = users[0];
        const { accessToken, refreshToken } = createTokens(user);
        await saveRefreshToken(user.id, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Login berhasil",
            data: {
                accessToken,
                refreshToken,
                user: { id: user.id, nama: user.nama, email: user.email }
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
    }
}

async function logout(req, res) {
    try {
        const { refreshToken } = req.body || {};

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token wajib diisi"
            });
        }

        await pool.execute(
            `UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL`,
            [req.user.id, hashToken(refreshToken)]
        );

        return res.json({
            success: true,
            message: "Logout berhasil"
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal melakukan logout"
        });
    }
}

/* removed password change endpoint */
/* async function changePassword(req, res) {
    try {
        const { password_lama, password_baru } = req.body || {};
        if (typeof password_lama !== "string" || typeof password_baru !== "string" || !password_lama || !password_baru) {
            return res.status(400).json({ success: false, message: "Password lama dan password baru wajib diisi" });
        }
        if (password_baru.length < 6) {
            return res.status(400).json({ success: false, message: "Password baru minimal 6 karakter" });
        }
        const [users] = await pool.execute("SELECT password FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        if (!users.length || !(await bcrypt.compare(password_lama, users[0].password))) {
            return res.status(401).json({ success: false, message: "Password lama salah" });
        }
        const hashedPassword = await bcrypt.hash(password_baru, 10);
        await pool.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);
        return res.json({ success: true, message: "Password berhasil diubah" });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ success: false, message: "Gagal mengubah password" });
    }
} */

async function getProfile(req, res) {
    try {
        const [users] = await pool.execute(
            "SELECT id, nama, email FROM users WHERE id = ? LIMIT 1",
            [req.user.id]
        );

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "Pengguna tidak ditemukan"
            });
        }

        return res.json({ success: true, data: users[0] });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil profil"
        });
    }
}

async function refresh(req, res) {
    try {
        const { refreshToken } = req.body || {};
        if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token wajib diisi" });

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const [rows] = await pool.execute(
            `SELECT id FROM refresh_tokens
             WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
             LIMIT 1`,
            [decoded.id, hashToken(refreshToken)]
        );
        if (!rows.length) return res.status(401).json({ success: false, message: "Refresh token tidak valid" });

        await pool.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?", [rows[0].id]);
        const [users] = await pool.execute("SELECT id, nama, email FROM users WHERE id = ? LIMIT 1", [decoded.id]);
        if (!users.length) return res.status(401).json({ success: false, message: "Pengguna tidak ditemukan" });

        const tokens = createTokens(users[0]);
        await saveRefreshToken(users[0].id, tokens.refreshToken);
        return res.json({ success: true, message: "Token berhasil diperbarui", data: tokens });
    } catch (error) {
        return res.status(401).json({ success: false, message: "Refresh token tidak valid atau sudah kedaluwarsa" });
    }
}

module.exports = { register, login, refresh, logout, getProfile };
