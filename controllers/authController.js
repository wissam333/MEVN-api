//basic imports
const User = require("../models/User");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {
    // vaildations
    const userEmail = await User.findOne({ email: req.body.email });
    const username = await User.findOne({ username: req.body.username });
    console.log(userEmail);
    if (username)
      return res.status(401).json({ message: "this username is already used" });
    if (userEmail)
      return res.status(401).json({ message: "this email is already used" });

    // create new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: CryptoJS.AES.encrypt(
        req.body.password,
        process.env.PASS_SEC
      ).toString(),
    });

    // save user in database
    const savedUser = await newUser.save();

    // Generate an access token for the new user
    const accessToken = jwt.sign(
      { id: savedUser._id, isAdmin: savedUser.isAdmin },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    // Remove the password field from the user object
    const { password, ...userWithoutPassword } = savedUser.toObject();
    // Return the user object along with the access token
    res.status(201).json({ ...userWithoutPassword, accessToken });
  } catch (err) {
    res.status(500).json(err);
  }
};

const login = async (req, res) => {
  try {
    // vaildations
    const user = await User.findOne({ username: req.body.username });
    if (!user) return res.status(401).json({ message: "username not found" });

    // password
    const hashedPassword = CryptoJS.AES.decrypt(
      user.password,
      process.env.PASS_SEC
    );
    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);
    if (originalPassword !== req.body.password)
      return res.status(401).json({ message: "wrong password" });

    const accessToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SEC,
      { expiresIn: "2d" }
    );

    const { password, ...others } = user._doc; // because mongo stores the document inside _doc

    res.status(200).json({ ...others, accessToken });
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = { register, login };
