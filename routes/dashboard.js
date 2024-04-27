//basic imports
const router = require("express").Router();
const {
  getUserStates,
  getMonthlyIncome,
  getLastMonthSales,
  getLastWeekSales,
  getDashboardStates,
  getSalesComparison,
} = require("../controllers/dashboardController");
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");

//get orders count
router.get("/dashboardStates", verifyTokenAndAdmin, getDashboardStates);

// get user states
router.get("/states", verifyTokenAndAdmin, getUserStates);

// get monthly income
router.get("/income", verifyTokenAndAdmin, getMonthlyIncome);

router.get("/getLastMonthSales", verifyTokenAndAdmin, getLastMonthSales);

router.get("/getLastWeekSales", verifyTokenAndAdmin, getLastWeekSales);

router.get("/getSalesComparison", verifyTokenAndAdmin, getSalesComparison);


module.exports = router;
