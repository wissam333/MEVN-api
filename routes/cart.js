//basic imports
const router = require("express").Router();
const {
  verifyToken,
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
} = require("../Middleware/verifyToken");
const {
  createCart,
  updateCart,
  deleteCart,
  getUserCart,
  getAllCarts,
} = require("../controllers/cartController");

// create Cart
router.post("/", verifyToken, createCart);

// update Cart
router.put("/:id", verifyTokenAndAuth, updateCart);

// delete Cart
router.delete("/:id", verifyTokenAndAuth, deleteCart);

// get user Cart
router.get("/find/:userId", verifyTokenAndAuth, getUserCart);

// get all Carts
router.get("/", verifyTokenAndAdmin, getAllCarts);

module.exports = router;
