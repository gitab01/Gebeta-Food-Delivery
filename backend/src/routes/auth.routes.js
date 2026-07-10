const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);

module.exports = router;
