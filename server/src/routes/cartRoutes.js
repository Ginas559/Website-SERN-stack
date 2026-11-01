const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/cartController");
const validate = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", controller.getCart);
router.get("/summary", controller.getSummary);
router.get("/validate", controller.validateCart);
router.post("/sync", controller.syncCart);

router.post(
    "/items",
    [
        body("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail(),
        body("quantity")
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage("Số lượng sách thêm vào giỏ phải từ 1 đến 1000.")
            .bail(),
    ],
    validate,
    controller.addItem
);

router.put(
    "/items/:bookId",
    [
        param("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách không hợp lệ.")
            .bail(),
        body("quantity")
            .isInt({ min: 1, max: 1000 })
            .withMessage("Số lượng sách phải từ 1 đến 1000.")
            .bail(),
    ],
    validate,
    controller.updateItem
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

router.delete("/", controller.clearCart);

module.exports = router;
