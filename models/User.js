// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null for OAuth users
  },
  tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 200,
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null in case the photo isn't available
  },
});

module.exports = User;
