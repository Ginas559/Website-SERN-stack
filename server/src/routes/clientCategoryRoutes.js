const express = require("express");
const { param } = require("express-validator");
const controller = require("../controllers/categoryController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();
const MAX_INT32 = 2147483647;

router.get("/", controller.getPublicAll);

router.get(
    "/:id",
    [
        param("id")
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID thể loại không hợp lệ."),
    ],
    validate,
    controller.getPublicById
);

module.exports = router;

