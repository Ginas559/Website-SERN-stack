const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/wishlistController");
const validate = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", controller.getWishlist);

router.post(
    "/items",
    [
        body("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail(),
    ],
    validate,
    controller.addItem
);

router.post(
    "/",
    [
        body("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail(),
    ],
    validate,
    controller.addItem
);

router.delete(
    "/items/:bookId",
    [
        param("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách không hợp lệ.")
            .bail(),
    ],
    validate,
    controller.removeItem
);

router.delete(
    "/:bookId",
    [
        param("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách không hợp lệ.")
            .bail(),
    ],
    validate,
    controller.removeItem
);

router.delete("/", controller.clearWishlist);

module.exports = router;

