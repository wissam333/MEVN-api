// basic imports
const Order = require("../models/Order");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");

// when payment is done (automatic) we should fulfill the order or when the 3rd party send the request for us
const fulfillOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    // validate
    if (!order) {
      return res.status(404).json("order not found");
    }
    // iterate through each product in the order
    for (const element of order.products) {
      const inventory = await Inventory.findOne({
        productId: element.productId,
      });
      // update stockQuantity and reservedQuantity
      inventory.stockQuantity -= element.quantity;
      inventory.reservedQuantity -= element.quantity;
      await inventory.save();
    }
    // order fulfilled
    order.status = "fulfilled";
    await order.save();
  } catch (err) {
    console.error("Error fulfilling order:", err);
  }
};

const createOrder = async (req, res) => {
  const body = req.body;
  try {
    let price = 0;
    // iterate through each product using for...of loop because we are using await
    for (const element of body.products) {
      // await the result of fetching product details
      const product = await Product.findById(element.productId);
      // add the price of the current product to the total price
      price += product.price * element.quantity;
      // update the inventory: reserve the quantity
      const inventory = await Inventory.findOne({
        productId: element.productId,
      });
      console.log("inventory :" + inventory)
      if (
        inventory &&
        inventory.stockQuantity - inventory.reservedQuantity >= element.quantity
      ) {
        inventory.reservedQuantity += element.quantity;
        await inventory.save();
      } else {
        return res.status(403).json({
          message: `Insufficient stock for product '${element.productId}'`,
        });
      }
    }
    const newOrder = new Order({ ...body, amount: price });
    const savedOrder = await newOrder.save();
    // fulfill order (the stock will decrease and reserved will increase then decrease) if not fulfill only reserved will increase
    fulfillOrder(savedOrder._id);
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
