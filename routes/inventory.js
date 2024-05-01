//basics
const router = require("express").Router();
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");

const {
  addInventory,
  updateInventory,
  deleteInventory,
  getAllInventories,
  getInventory,
} = require("../controllers/inventoryController");

// add to inventory
router.post("/addToInventory", verifyTokenAndAdmin, addInventory);

// update inventory
router.put("/updateInventory/:productId", verifyTokenAndAdmin, updateInventory);

// delete inventory
router.delete("/deleteInventory/:productId", verifyTokenAndAdmin, deleteInventory);

// get all inventories
router.get("/getAllInventories", verifyTokenAndAdmin, getAllInventories);

// get one inventory
router.get("/getInventory/:productId", verifyTokenAndAdmin, getInventory);

module.exports = router;
