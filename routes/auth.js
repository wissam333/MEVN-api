//basic imports
const router = require("express").Router();
const { register, login } = require("../controllers/authController");

// register
router.post("/register", register);

// login
router.post("/login", login);

module.exports = router;
