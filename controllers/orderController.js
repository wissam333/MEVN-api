// basic imports
const Order = require("../models/Order");
const Product = require("../models/Product");

const createOrder = async (req, res) => {
  const body = req.body;
  try {
    let price = 0;
    // Iterate through each product using for...of loop because we are using await
    for (const element of body.products) {
      // Await the result of fetching product details
      const product = await Product.findById(element.productId);
      // Add the price of the current product to the total price
      price += product.price * element.quantity;
    }
    const newOrder = new Order({ ...body, amount: price });
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    // Handle errors
    res.status(500).json(err);
  }
};

const updateOrder = async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true } // Return the modified document rather than the original one
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json(updatedOrder);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteOrder = async (req, res) => {
  try {
    // vaildation
    const order = await Order.findOne({ _id: req.params.id });
    if (!order) return res.status(404).json({ message: "order not found" });

    await Order.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Order has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getUserAndGuestOrders = async (req, res) => {
  try {
    if (req.body.userId) {
      const userOrders = await Order.findOne({ userId: req.body.userId });
      res.status(200).json(userOrders);
    } else if (req.body.name) {
      const guestOrders = await Order.findOne({ name: req.body.name });
      res.status(200).json(guestOrders);
    } else {
      res
        .status(400)
        .json({ message: "please enter name or userId in the body" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getAllOrders = async (req, res) => {
  try {
    const Orders = await Order.find();
    res.status(200).json(Orders);
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createOrder,
  updateOrder,
  deleteOrder,
  getUserAndGuestOrders,
  getAllOrders,
};
