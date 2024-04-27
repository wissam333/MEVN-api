// basic imports
const Cart = require("../models/Cart");

const createCart = async (req, res) => {
  const userId = req.user.id; // retrieve userId from authenticated user
  const newCart = new Cart({ ...req.body, userId: userId });
  try {
    const savedCart = await newCart.save();
    res.status(201).json(savedCart);
  } catch (err) {
    res.status(500).json(err);
  }
};

const updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // array of updates containing productId and quantity for each product
    // validate that the cart belongs to the authenticated user
    const cart = await Cart.findById(id);
    if (!cart) {
      return res.status(404).json({ message: "cart not found" });
    }
    // create an array of update operations for each product
    const updateOperations = updates.map(({ productId, quantity }) => {
      if (quantity === 0) {
        // if quantity is 0, make delete operation
        return {
          updateOne: {
            filter: { _id: id },
            update: { $pull: { products: { productId } } }, // remove the product from the products array
          },
        };
      } else {
        // otherwise, make update operation
        return {
          updateOne: {
            filter: { _id: id, "products.productId": productId }, // filter to match the cart and product
            update: { $set: { "products.$.quantity": quantity } }, // update the quantity for the specific product
          },
        };
      }
    });
    // execute the update operations in bulk (execute multiple update operations)
    const result = await Cart.bulkWrite(updateOperations);

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "cart or products not found" });
    }
    res.status(200).json({ message: "cart updated successfully" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteCart = async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    await Cart.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Cart has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getUserCart = async (req, res) => {
  try {
    const userCart = await Cart.findOne({ userId });
    if (!userCart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    res.status(200).json(userCart);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getAllCarts = async (req, res) => {
  try {
    const Carts = await Cart.find();
    res.status(200).json(Carts);
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createCart,
  updateCart,
  deleteCart,
  getUserCart,
  getAllCarts,
};
