const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const PublicImage = sequelize.define('PublicImage', {
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = PublicImage;
