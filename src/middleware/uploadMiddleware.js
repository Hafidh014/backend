const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(
    __dirname,
    "../uploads/products"
);

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, {
        recursive: true
    });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },

    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);
        const fileName = `product-${Date.now()}${extension}`;

        cb(null, fileName);
    }
});

const fileFilter = function (req, file, cb) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Format file harus JPG, PNG, atau WEBP"));
    }
};

const uploadProductImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});

module.exports = {
    uploadProductImage
};