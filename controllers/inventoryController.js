const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const cron = require("node-cron");
const { CourierClient } = require("@trycourier/courier");
const courier = new CourierClient({
  authorizationToken: "dk_prod_84YXSJPPNW4XYAPP3XC9YFRNJFMT",
});

// send low product notification using Courier api every hour using cron
const sendLowProductNotification = async (products) => {
  try {
    // Fetch product details for each product ID
    const productDetails = await Promise.all(
      products.map(async (product) => {
        const productInfo = await Product.findById(product.productId);
        return {
          name: productInfo.title,
          availableQuantity: product.stockQuantity - product.reservedQuantity,
        };
      })
    );

    // Construct the email body with information about low quantity products
    const emailBody = productDetails
      .map((product) => {
        return `Product Name: ${product.name}, Available Quantity: ${product.availableQuantity}.`;
      })
      .join("\n");

    // Send the email containing the low quantity products information
    const { requestId } = await courier.send({
      message: {
        to: {
          email: "wissam.n.najjom@gmail.com", // Update with recipient email address
        },
        content: {
          title: "Low Product Notification",
          body: emailBody,
        },
        routing: {
          method: "single",
          channels: ["email"],
        },
      },
    });
    console.log("Low product notification sent successfully");
  } catch (error) {
    console.error("Error sending low product notification:", error);
  }
};

// schedule job to run every hour
cron.schedule("0 * * * *", async () => {
  try {
    // Query inventory to find products with low available quantity
    const products = await Inventory.find({
      $where: function () {
        return (
          this.stockQuantity - this.reservedQuantity < this.reorderThreshold
        ); // Update with your threshold
      },
    });

    // Send low product notification if any low quantity products are found
    if (products.length > 0) {
      await sendLowProductNotification(products);
    } else {
      console.log("No low quantity products found.");
    }
  } catch (error) {
    console.error("Error in reminder job:", error);
  }
});

const addInventory = async (req, res) => {
  try {
    const productsToAdd = req.body.products;

    // Check if the request body contains products
    if (!productsToAdd || !Array.isArray(productsToAdd)) {
      return res
        .status(400)
        .json({ message: "Products must be provided in an array" });
    }

    // Iterate over each product and add it to the inventory
    for (const product of productsToAdd) {
      const existingProduct = await Inventory.findOne({
        productId: product.productId,
      });

      if (existingProduct) {
        // if the product already exists in inventory, update its stock quantity
        existingProduct.stockQuantity += parseInt(product.quantity);
        existingProduct.reorderThreshold = parseInt(product.reorderThreshold);
        await existingProduct.save();
      } else {
        // if the product does not exist ,create a new inventory
        await Inventory.create({
          productId: product.productId,
          stockQuantity: parseInt(product.quantity),
          reorderThreshold: parseInt(product.reorderThreshold),
        });
      }
    }

    res.status(200).json({ message: "Inventory updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.log(error);
  }
};

const updateInventory = async (req, res) => {
  try {
    const updatedInventory = await Inventory.findOneAndUpdate(
      { productId: req.params.productId },
      { $set: req.body },
      { new: true } // Return the modified document rather than the original one
    );
    // validation
    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    res.status(200).json(updatedInventory);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteInventory = async (req, res) => {
  try {
    const productId = req.params.productId;
    const inventory = await Inventory.findOne({ productId });
    // validation
    if (!inventory) {
      return res
        .status(404)
        .json({ message: `Inventory for product ${productId} not found` });
    }
    await inventory.deleteOne();
    res.status(200).json({ message: "Inventory deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllInventories = async (req, res) => {
  try {
    const inventories = await Inventory.find();
    res.status(200).json(inventories);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getInventory = async (req, res) => {
  try {
    const productId = req.params.productId;
    const inventory = await Inventory.findOne({
      productId: productId,
    });
    if (!inventory) {
      return res
        .status(404)
        .json({ message: "product not found in inventory" });
    }
    res.status(200).json(inventory);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  addInventory,
  updateInventory,
  deleteInventory,
  getAllInventories,
  getInventory,
};
