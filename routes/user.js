//basics
const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
} = require("../Middleware/verifyToken");
const {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
} = require("../controllers/userController");

// update user
router.put("/:id", verifyTokenAndAuth, updateUser);

// delete user
router.delete("/:id", verifyTokenAndAuth, deleteUser);

// get user
router.get("/find/:id", verifyTokenAndAdmin, getUser);

// get users
router.get("/", verifyTokenAndAdmin, getUsers);

module.exports = router;
