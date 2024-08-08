// basic imports
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const cache = require("memory-cache");

const getDashboardStates = async (req, res) => {
  try {
    // caching
    const cachedStates = cache.get("DashboardStates");
    // return the cached states and ignore getting data from database
    if (cachedStates) {
      return res.status(200).json(cachedStates);
    }
    // Retrieve order count
    const ordersCount = await Order.countDocuments();

    // Retrieve products count
    const productsCount = await Product.countDocuments();

    // Retrieve sales data
    const totalSales = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          totalAmount: 1, // Include totalAmount field
        },
      },
    ]);
    // getting the value without extra nesting
    const total = totalSales[0].totalAmount;
    // Retrieve user data -  1(admin)
    const users = (await User.countDocuments()) - 1;

    cache.put(
      "DashboardStates",
      { ordersCount, totalSales: total, users, productsCount },
      10 * 60 * 1000
    ); // Cache for 24 hour (Updates daily)
    res
      .status(200)
      .json({ ordersCount, totalSales: total, users, productsCount });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getMonthlyIncome = async (req, res) => {
  const date = new Date();
  const lastMonth = new Date(date.setMonth(date.getMonth - 1));
  const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

  try {
    const income = await Order.aggregate([
      { $match: { createdAt: { $gte: previousMonth } } }, // condition : greater than previousMonth
      { $project: { month: { $month: "$createdAt" }, sales: "$amount" } }, // creating month var that have month value in createdAt field, and sales var and give it the amount
      { $group: { _id: "$month", total: { $sum: "$sales" } } }, // assign
    ]);
    res.status(200).json(income);
  } catch (err) {
    res.status(500).json(err);
  }
};

async function getDailySales(startDate, endDate) {
  const salesData = await Order.aggregate([
    {
      $match: { createdAt: { $gte: startDate, $lte: endDate } },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$amount" },
      },
    },
  ]);
  return salesData;
}

const getLastMonthSales = async (req, res) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const startOfMonth = new Date(currentYear, currentMonth - 2, 1); // Start of last month
  const endOfMonth = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59); // End of last month

  try {
    const salesData = await getDailySales(startOfMonth, endOfMonth);
    res.status(200).json(salesData);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getLastWeekSales = async (req, res) => {
  const currentDate = new Date();
  const endDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - 1
  );
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6); // Calculate start date for last week (7 days ago)

  try {
    const salesData = await getDailySales(startDate, endDate);
    res.status(200).json(salesData);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getUserStates = async (req, res) => {
  const date = new Date();
  const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

  try {
    const data = await User.aggregate([
      { $match: { createdAt: { $gte: lastYear } } }, // condition : greater than lastYear
      { $project: { month: { $month: "$createdAt" } } }, // creating month var that have month value in createdAt field
      { $group: { _id: "$month", total: { $sum: 1 } } }, // assign
    ]);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const calculatePercentageIncrease = (currentMonthSales, previousMonthSales) => {
  if (previousMonthSales === 0) {
    return currentMonthSales > 0 ? "Infinity" : "0"; // Handle edge case
  }
  const percentageIncrease =
    ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100;
  return `${percentageIncrease.toFixed(1)}`;
};

const getSalesComparison = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // Current month (0-based)

    // Set the start and end dates for the previous month
    const startOfPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfPreviousMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    // Set the start and end dates for the current month
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Fetch sales data
    const previousMonthSales = await getDailySales(startOfPreviousMonth, endOfPreviousMonth);
    const currentMonthSales = await getDailySales(startOfCurrentMonth, endOfCurrentMonth);

    // Calculate total sales for each month
    const previousMonthTotalSales = previousMonthSales.reduce((total, sale) => total + sale.totalSales, 0);
    const currentMonthTotalSales = currentMonthSales.reduce((total, sale) => total + sale.totalSales, 0);

    // Calculate percentage increase
    const percentageIncrease = calculatePercentageIncrease(currentMonthTotalSales, previousMonthTotalSales);

    // Format message
    let message;
    if (percentageIncrease === "Infinity") {
      message = "Sales increased dramatically compared to the previous month.";
    } else if (percentageIncrease === "0") {
      message = "Sales remained the same compared to the previous month.";
    } else if (parseFloat(percentageIncrease) > 0) {
      message = `You have achieved a ${percentageIncrease}% increase in sales this month.`;
    } else {
      message = `You have experienced a ${percentageIncrease}% decrease in sales this month.`;
    }

    // Send response
    res.status(200).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


const getSalesDataForProduct = async (req, res) => {
  const productId = req.params.productId;

  try {
    // Fetch data from the database
    const orders = await Order.find({ "products.productId": productId });
    const ProductFromDb = await Product.findById(productId);
    
    if (!ProductFromDb) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Initialize variables
    let totalRevenueAll = 0;
    let totalQuantitySoldAll = 0;
    let totalRevenueMonth = 0;
    let totalQuantitySoldMonth = 0;
    let totalRevenueWeek = 0;
    let totalQuantitySoldWeek = 0;

    // Get today's date and calculate the start of the month and week
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); // Sunday
    const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)); // Saturday

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);

      order.products.forEach((product) => {
        if (product.productId.toString() === productId) {
          totalRevenueAll += ProductFromDb.price * product.quantity;
          totalQuantitySoldAll += product.quantity;

          if (orderDate >= firstDayOfMonth) {
            totalRevenueMonth += ProductFromDb.price * product.quantity;
            totalQuantitySoldMonth += product.quantity;
          }

          if (orderDate >= firstDayOfWeek && orderDate <= lastDayOfWeek) {
            totalRevenueWeek += ProductFromDb.price * product.quantity;
            totalQuantitySoldWeek += product.quantity;
          }
        }
      });
    });

    const salesData = {
      totalRevenueAll,
      totalQuantitySoldAll,
      totalRevenueMonth,
      totalQuantitySoldMonth,
      totalRevenueWeek,
      totalQuantitySoldWeek,
    };

    res.status(200).json(salesData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


const getMonthlySalesDataForProduct = async (req, res) => {
  const productId = req.params.productId;
  
  try {
    const orders = await Order.find({ "products.productId": productId });
    
    // Initialize monthly sales data object
    const monthlySalesData = {};

    // Initialize sales data for each month
    for (let i = 1; i <= 12; i++) {
      monthlySalesData[i] = 0;
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth() + 1; // Months are 0-indexed in JS Date

      order.products.forEach((product) => {
        if (product.productId.toString() === productId) {
          monthlySalesData[month] += product.quantity;
        }
      });
    });

    res.status(200).json(monthlySalesData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


module.exports = {
  getDashboardStates,
  getMonthlyIncome,
  getDailySales,
  getLastMonthSales,
  getLastWeekSales,
  getUserStates,
  getSalesComparison,
  getSalesDataForProduct,
  getMonthlySalesDataForProduct,
};
