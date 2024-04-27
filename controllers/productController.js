// basic imports
const Product = require("../models/Product");
const LFUCache = require("../cache/cache");
const productCache = new LFUCache(100);
const cache = require("memory-cache");

// Helper function to invalidate cache for a specific product ID
const invalidateCache = (productId) => {
  productCache.remove(productId);
};

const createProduct = async (req, res) => {
  // vaildation
  const product = await Product.findOne({ title: req.body.title });
  // images url path
  const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.body.imgName
  }`; // Construct the complete URL
  const newProduct = new Product({
    title: req.body.title,
    desc: req.body.desc,
    img: imgUrl,
    categories: req.body.categories,
    size: req.body.size,
    color: req.body.color,
    price: req.body.price,
  });
  try {
    if (product)
      return res
        .status(403)
        .json({ message: "this product is already submitted" });
    const savedProduct = await newProduct.save();
    // invalidate cache
    cache.clear();

    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(500).json(err);
  }
};

const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true } // Return the modified document rather than the original one
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    // invalidate cache
    invalidateCache(req.params.id);
    cache.clear();

    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteProduct = async (req, res) => {
  try {
    // vaildation
    const product = await Product.findOne({ _id: req.params.id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    await Product.findByIdAndDelete(req.params.id);
    // invalidate cache
    invalidateCache(req.params.id);
    cache.clear();

    res.status(200).json({ message: "Product has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProduct = async (req, res) => {
  try {
    // caching
    const productId = req.params.id;
    const cachedProduct = productCache.get(productId);
    // return the cached product and ignore getting data from database
    if (cachedProduct) {
      return res.status(200).json(cachedProduct);
    }

    const oneProduct = await Product.findById(productId);
    if (oneProduct) {
      productCache.put(productId, oneProduct);
      res.status(200).json(oneProduct);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProducts = async (req, res) => {
  try {
    const qNew = req.query.new; // get new Product (last 5 Product added)
    const qCategory = req.query.category; // get all products in that category
    // caching
    const cacheKey = JSON.stringify(
      "products" + req.query.new + req.query.category
    );
    const cachedProducts = cache.get(cacheKey);
    // return the cached products and ignore getting data from database
    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }

    let Products;
    if (qNew && qCategory) {
      Products = await Product.find({
        categories: {
          $in: [qCategory],
        },
      })
        .sort({ createdAt: -1 })
        .limit(5);
    } else if (qNew) {
      Products = await Product.find().sort({ createdAt: -1 }).limit(5);
    } else if (qCategory) {
      Products = await Product.find({
        categories: {
          $in: [qCategory],
        },
      });
    } else {
      Products = await Product.find();
    }
    cache.put(cacheKey, Products);
    res.status(200).json(Products);
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
};
