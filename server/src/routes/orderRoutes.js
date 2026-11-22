const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/orderController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/vnpay/return", controller.handleVNPayReturn);
router.get("/vnpay/ipn", controller.handleVNPayIPN);

router.use(protect);

router.get(
    "/",
    [
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Số trang phải là số nguyên lớn hơn hoặc bằng 1.")
            .bail(),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Số bản ghi mỗi trang phải từ 1 đến 100.")
            .bail(),
        query("status")
            .optional()
            .isInt({ min: 0, max: 4 })
            .withMessage("Trạng thái đơn hàng không hợp lệ.")
            .bail()
    ],
    validate,
    controller.getUserOrders
);

router.post(
    "/",
    [
        body("receiverName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Họ tên người nhận không được vượt quá 100 ký tự.")
            .bail(),
        body("fullName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Họ tên người nhận không được vượt quá 100 ký tự.")
            .bail(),
        body("phone")
            .optional()
            .trim()
            .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
            .withMessage("Số điện thoại không hợp lệ.")
            .bail(),
        body("phoneNumber")
            .optional()
            .trim()
            .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
            .withMessage("Số điện thoại không hợp lệ.")
            .bail(),
        body("address")
            .notEmpty()
            .withMessage("Địa chỉ nhận hàng không được để trống.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Địa chỉ không được vượt quá 255 ký tự.")
            .bail(),
        body("paymentMethod")
            .optional()
            .isIn(["COD", "VNPAY", "BANK"])
            .withMessage("Phương thức thanh toán không hợp lệ.")
            .bail(),
        body("selectedBookIds")
            .optional()
            .isArray()
            .withMessage("selectedBookIds phải là một danh sách mảng.")
            .bail(),
    ],
    validate,
    controller.createOrder
);

router.get(
    "/admin",
    restrictTo("Admin"),
    [
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Số trang phải là số nguyên lớn hơn hoặc bằng 1.")
            .bail(),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Số bản ghi mỗi trang phải từ 1 đến 100.")
            .bail(),
        query("search")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Từ khóa tìm kiếm không được vượt quá 100 ký tự.")
            .bail(),
        query("status")
            .optional()
            .isInt({ min: 0, max: 4 })
            .withMessage("Trạng thái đơn hàng không hợp lệ.")
            .bail(),
        query("paymentMethod")
            .optional()
            .isIn(["COD", "VNPAY", "BANK"])
            .withMessage("Phương thức thanh toán không hợp lệ.")
            .bail(),
        query("sortBy")
            .optional()
            .isIn(["createdAt", "total", "total_quantity", "status"])
            .withMessage("Trường sắp xếp không hợp lệ.")
            .bail(),
        query("sortOrder")
            .optional()
            .isIn(["ASC", "DESC", "asc", "desc"])
            .withMessage("Chiều sắp xếp không hợp lệ.")
            .bail(),
        query("fromDate")
            .optional()
            .isISO8601()
            .withMessage("Ngày bắt đầu không đúng định dạng.")
            .bail(),
        query("toDate")
            .optional()
            .isISO8601()
            .withMessage("Ngày kết thúc không đúng định dạng.")
            .bail()
    ],
    validate,
    controller.getAllOrdersForAdmin
);

router.get(
    "/:id",
    [
        param("id")
            .isUUID()
            .withMessage("Mã đơn hàng không hợp lệ (phải là UUID).")
            .bail()
    ],
    validate,
    controller.getOrderDetails
);

router.post(
    "/:id/reorder",
    [
        param("id")
            .isUUID()
            .withMessage("Mã đơn hàng không hợp lệ (phải là UUID).")
            .bail()
    ],
    validate,
    controller.reorder
);

router.post(
    "/:id/payment-url",
    [
        param("id")
            .isUUID()
            .withMessage("Mã đơn hàng không hợp lệ (phải là UUID).")
            .bail(),
        body("returnUrl")
            .optional()
            .isURL({ require_tld: false })
            .withMessage("returnUrl không hợp lệ.")
            .bail()
    ],
    validate,
    controller.createPaymentUrl
);

router.patch(
    "/:id/cancel",
    [
        param("id")
            .isUUID()
            .withMessage("Mã đơn hàng không hợp lệ (phải là UUID).")
            .bail(),
        body("reason")
            .optional()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Lý do hủy đơn không được vượt quá 255 ký tự.")
            .bail()
    ],
    validate,
    controller.cancelOrder
);

router.patch(
    "/:id/status",
    restrictTo("Admin"),
    [
        param("id")
            .isUUID()
            .withMessage("Mã đơn hàng không hợp lệ (phải là UUID).")
            .bail(),
        body("status")
            .notEmpty()
            .withMessage("Trạng thái đơn hàng không được để trống.")
            .bail()
            .isInt({ min: 0, max: 4 })
            .withMessage("Trạng thái đơn hàng phải là số nguyên từ 0 đến 4.")
            .bail(),
        body("currentStatus")
            .optional()
            .isInt({ min: 0, max: 4 })
            .withMessage("Trạng thái hiện tại phải là số nguyên từ 0 đến 4.")
            .bail(),
        body("note")
            .optional()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Ghi chú không được vượt quá 255 ký tự.")
            .bail()
    ],
    validate,
    controller.updateStatus
);

module.exports = router;

