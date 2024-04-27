//basics
const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
} = require("../Middleware/verifyToken");

const {
  createOrder,
  updateOrder,
  deleteOrder,
  getUserAndGuestOrders,
  getAllOrders,
} = require("../controllers/orderController");

// create Order
// router.post("/", verifyToken, createOrder);
// in this approche the userId is optional but we can track the order by (name) and (email)
router.post("/", createOrder); // any guest can create order if he enterd all requierd info

// update Order
router.put("/:id", verifyTokenAndAdmin, updateOrder); // ofc only admin can edit orders after making it

// delete Order
router.delete("/:id", verifyTokenAndAdmin, deleteOrder);

// get user Orders by userId or guest orders by name
router.get("/find", verifyTokenAndAuth, getUserAndGuestOrders);

// get all Orders
router.get("/", verifyTokenAndAdmin, getAllOrders);

module.exports = router;
