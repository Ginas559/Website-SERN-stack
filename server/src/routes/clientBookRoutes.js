const express = require("express");
const { param } = require("express-validator");
const controller = require("../controllers/bookController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();

router.get("/", controller.getAllClient);

router.get(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID sách không hợp lệ."),
    ],
    validate,
    controller.getDetailClient
);

module.exports = router;

