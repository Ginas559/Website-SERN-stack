const jwt = require("jsonwebtoken");
const { accessTokenSecret, refreshTokenSecret, accessTokenExpiresIn, refreshTokenExpiresIn } = require("../config/config");

function generateAccessToken(user) {
    return jwt.sign({ id: user.id, email: user.email, isAdmin: Boolean(user.isAdmin) }, accessTokenSecret, { expiresIn: accessTokenExpiresIn });
}

function generateRefreshToken(user, tokenId) {
    return jwt.sign({ id: user.id, tokenId }, refreshTokenSecret, { expiresIn: refreshTokenExpiresIn });
}

function verifyAccessToken(token) {
    return jwt.verify(token, accessTokenSecret);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, refreshTokenSecret);
}

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
