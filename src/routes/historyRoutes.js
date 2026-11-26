const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getHistory } = require("../controllers/historyController");

const router = express.Router();
router.get("/", authenticateToken, getHistory);

module.exports = router;
