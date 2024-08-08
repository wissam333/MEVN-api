// basic imports
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
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
    const { id } = req.params;
    const { title, imgName } = req.body;

    // Check if the updated title is unique
    const existingProduct = await Product.findOne({ title });
    if (existingProduct && existingProduct._id.toString() !== id) {
      return res.status(400).json({ message: "Title must be unique" });
    }

    // Construct the image URL
    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`;

    // Update the product with the new data
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: { title, img: imgUrl, ...req.body } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Invalidate cache
    invalidateCache(id);
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
    // Fetch inventory quantity
    const inventory = await Inventory.findOne({ productId });
    const oneProduct = await Product.findById(productId);

    const getProductWithQuatity = {
      ...oneProduct.toObject(),
      quantity: inventory
        ? inventory.stockQuantity - inventory.reservedQuantity
        : 0,
    };
    // put in cache
    if (oneProduct) {
      productCache.put(productId, getProductWithQuatity);
      // response
      res.status(200).json(getProductWithQuatity);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProducts = async (req, res) => {
  try {
    const qCategory = req.query.category;
    const page = parseInt(req.query.page) || 1; // default to page 1 if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // default to 10 items per page if not provided
    const latest = req.query.latest; // check if latest is set

    const skip = (page - 1) * pageSize; // calculate number of items to skip

    const cacheKey = JSON.stringify(
      "products" + req.query.category + page + pageSize + latest
    );
    const cachedProducts = cache.get(cacheKey);

    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }

    let query = {};
    if (qCategory) {
      query = {
        categories: { $in: [qCategory] },
      };
    }

    let productsQuery = Product.find(query);

    if (latest) {
      productsQuery = productsQuery.sort({ createdAt: -1 }).limit(5);
    } else {
      productsQuery = productsQuery.skip(skip).limit(pageSize);
    }

    const Products = await productsQuery;

    const productsWithQuantity = await Promise.all(
      Products.map(async (product) => {
        const inventory = await Inventory.findOne({ productId: product._id });
        const quantity = inventory
          ? inventory.stockQuantity - inventory.reservedQuantity
          : 0;
        return {
          ...product.toObject(),
          quantity: quantity,
        };
      })
    );

    const productsCount = await Product.countDocuments(query); // Count total products matching the query
    const totalPages = latest ? 1 : Math.ceil(productsCount / pageSize); // If latest, only 1 page

    cache.put(cacheKey, {
      products: productsWithQuantity,
      totalPages,
      productsCount,
    });

    res
      .status(200)
      .json({ products: productsWithQuantity, totalPages, productsCount });
  } catch (err) {
    res.status(500).json(err);
  }
};


const getProductsTemp = async (req, res) => {
  try {
    const products = await Product.find({}, { _id: 1, title: 1 });
    const productNamesWithIds = products.map((product) => ({
      id: product._id,
      name: product.title,
    }));
    res.status(200).json(productNamesWithIds);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching product names and IDs", error: err });
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
  getProductsTemp,
};
