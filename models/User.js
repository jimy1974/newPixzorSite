// models/User.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
      type: DataTypes.DECIMAL(10, 2), // Change to DECIMAL(10,2)
      defaultValue: 50.00, // Match the database default
    },
    googleId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true,
    },       
  }, {
    tableName: 'users', // Ensure this matches your actual table name
    timestamps: true,
  });

  // Define associations
  User.associate = (models) => {
    User.hasMany(models.PersonalImage, { foreignKey: 'userId', as: 'personalImages' });
    User.hasMany(models.Comment, { foreignKey: 'userId', as: 'comments' });
    User.hasMany(models.Image, { foreignKey: 'userId', as: 'images' });
    User.hasMany(models.PublicImage, { foreignKey: 'userId', as: 'publicImages' });
  };
  return User;
};