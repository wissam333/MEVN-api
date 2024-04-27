//basics
const router = require("express").Router();
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
} = require("../controllers/productController");
const uploadImg = require("../Middleware/multerMiddleware");

// create product
router.post("/", uploadImg, verifyTokenAndAdmin, createProduct);

// update Product
router.put("/:id", verifyTokenAndAdmin, updateProduct);

// delete Product
router.delete("/:id", verifyTokenAndAdmin, deleteProduct);

// get Product
router.get("/find/:id", getProduct);

// get Products
router.get("/", getProducts);

module.exports = router;
