// models/Image.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./User');

const Image = sequelize.define('Image', {
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prompt: {
    type: DataTypes.TEXT,
  },
});

// Define associations
User.hasMany(Image, { foreignKey: 'userId' });
Image.belongsTo(User, { foreignKey: 'userId' });

module.exports = Image;
