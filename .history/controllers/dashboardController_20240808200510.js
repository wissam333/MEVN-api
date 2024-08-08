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

const updateDateFields = async () => {
  try {
    await Order.updateMany(
      { createdAt: { $type: "string" } }, // Match documents where createdAt is a string
      [
        {
          $set: {
            createdAt: {
              $dateFromString: { dateString: "$createdAt" },
            },
          },
        },
      ]
    );
    console.log("Updated all date fields successfully");
  } catch (err) {
    console.error("Error updating date fields:", err);
  }
};
updateDateFields();

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
    return "100"; // Handle edge case when previous month sales are zero
  }
  const percentageIncrease =
    ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100;
  return `${percentageIncrease.toFixed(1)}`;
};

const getSalesComparison = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const startOfPreviousMonth = new Date(currentYear, currentMonth - 2, 1); // Start of last month
    const endOfPreviousMonth = new Date(
      currentYear,
      currentMonth - 1,
      0,
      23,
      59,
      59
    ); // End of last month

    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1); // Start of this month
    const endOfCurrentMonth = new Date(
      currentYear,
      currentMonth,
      0,
      23,
      59,
      59
    ); // End of this month

    const previousMonthSales = await getDailySales(
      startOfPreviousMonth,
      endOfPreviousMonth
    );
    const currentMonthSales = await getDailySales(
      startOfCurrentMonth,
      endOfCurrentMonth
    );

    // Calculate percentage increase
    const percentageIncrease = calculatePercentageIncrease(
      currentMonthSales.length ? currentMonthSales[0].totalSales : 0,
      previousMonthSales.length ? previousMonthSales[0].totalSales : 0
    );
    // Format message
    let message;
    if (percentageIncrease > 0) {
      message = `You have achieved a ${percentageIncrease}% increase in sales this month.`;
    } else {
      message = `You have experienced a decrease of ${percentageIncrease}% in sales this month`;
    }

    // Send response
    res.status(200).json({ message });
  } catch (err) {
    res.status(500);
  }
};

const getSalesDataForProduct = async (req, res) => {
  const productId = req.params.productId;

  try {
    const query = {
      "products.productId": productId,
    };
    // fetch data from the database
    const orders = await Order.find(query);
    const ProductFromDb = await Product.findById(productId);
    // Calculate total revenue and total quantity sold for all, this month, and this week
    let totalRevenueAll = 0;
    let totalQuantitySoldAll = 0;
    let totalRevenueMonth = 0;
    let totalQuantitySoldMonth = 0;
    let totalRevenueWeek = 0;
    let totalQuantitySoldWeek = 0;

    // dates
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfWeek = today.getDate() - today.getDay(); // Sunday
    const lastDayOfWeek = firstDayOfWeek + 6;

    orders.forEach((order) => {
      order.products.forEach((product) => {
        if (product.productId.toString() === productId) {
          totalRevenueAll += ProductFromDb.price * product.quantity;
          totalQuantitySoldAll += product.quantity;

          if (order.createdAt >= firstDayOfMonth) {
            totalRevenueMonth += ProductFromDb.price * product.quantity;
            totalQuantitySoldMonth += product.quantity;
          }

          if (
            order.createdAt >= new Date(today.setDate(firstDayOfWeek)) &&
            order.createdAt <= new Date(today.setDate(lastDayOfWeek))
          ) {
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
    const query = {
      "products.productId": productId,
    };
    const orders = await Order.find(query);
    // object to store sales data for each month of the year
    const monthlySalesData = {};

    for (let i = 1; i <= 12; i++) {
      monthlySalesData[i] = 0;
    }

    orders.forEach((order) => {
      order.products.forEach((product) => {
        if (product.productId.toString() === productId) {
          const month = new Date(order.createdAt).getMonth() + 1;
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
