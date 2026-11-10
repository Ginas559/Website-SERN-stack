const reviewService = require("../services/reviewService");

async function createReview(req, res) {
    const { bookId } = req.params;
    const { rate, value } = req.body;
    const review = await reviewService.createReview({
        bookId,
        userId: req.user.id,
        rate,
        value
    });
    res.status(201).json(review);
}

async function getBookReviews(req, res) {
    const { bookId } = req.params;
    const { page, limit, type } = req.query;
    const result = await reviewService.getBookReviews(bookId, {
        page,
        limit,
        type,
        userId: req.user?.id || null
    });
    res.json(result);
}

async function updateReview(req, res) {
    const { id } = req.params;
    const { rate, value } = req.body;
    const updated = await reviewService.updateReview(id, req.user.id, { rate, value });
    res.json(updated);
}

async function deleteReview(req, res) {
    const { id } = req.params;
    const result = await reviewService.deleteReview(id, req.user.id);
    res.json(result);
}

async function adminGetReviews(req, res) {
    const result = await reviewService.adminGetReviews(req.query);
    res.json(result);
}

async function adminChangeStatus(req, res) {
    const { id } = req.params;
    const { isDelete } = req.body;
    const updated = await reviewService.adminChangeReviewStatus(id, isDelete);
    res.json(updated);
}


async function getMyReviewedBookIds(req, res) {
    const bookIds = await reviewService.getMyReviewedBookIds(req.user.id);
    res.json(bookIds);
}

module.exports = {
    getMyReviewedBookIds,
    createReview,
    getBookReviews,
    updateReview,
    deleteReview,
    adminGetReviews,
    adminChangeStatus
};
