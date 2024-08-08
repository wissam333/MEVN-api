// basic imports
const User = require("../models/User");

const updateUser = async (req, res) => {
  if (req.body.password) {
    req.body.password = CryptoJS.AES.encrypt(
      req.body.password,
      process.env.PASS_SEC
    ).toString();
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true } // Return the modified document rather than the original one
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteUser = async (req, res) => {
  try {
    // vaildation
    const user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ message: "user not found" });

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "user has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getUser = async (req, res) => {
  try {
    // vaildation
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "user not found" });

    const { password, ...others } = user._doc; // because mongo stores the document inside _doc
    res.status(200).json({ ...others });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getUsers = async (req, res) => {
  try {
    const queryNew = req.query.new; // check if the 'new' query parameter is present
    const page = parseInt(req.query.page) || 1; // default to page 1 if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // default to 10 items per page if not provided
    const skip = (page - 1) * pageSize; // calculate number of items to skip

    let users;

    if (queryNew) {
      // If 'new' is specified, get the latest user (sorted by _id)
      users = await User.find().sort({ _id: -1 }).limit(1);
    } else {
      // Otherwise, apply pagination and get users
      users = await User.find().skip(skip).limit(pageSize);
    }

    // Optionally, you could also return the total count of users and total pages if desired
    const usersCount = await User.countDocuments(); // Count total users
    const totalPages = Math.ceil(usersCount / pageSize); // Calculate total pages

    res.status(200).json({
      users,
      totalPages,
      usersCount,
    });
  } catch (err) {
    res.status(500).json(err);
  }
};


module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
};
