// models/Image.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Image = sequelize.define('Image', {
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: { // Foreign key
      type: DataTypes.INTEGER,
      allowNull: true, // Changed to true to match DB (DEFAULT NULL)
      references: {
        model: 'users', // Correct table name
        key: 'id',
      },
    },
  }, {
    tableName: 'images', // Correct table name
    timestamps: true,
  });

  // Define associations
  Image.associate = (models) => {
    Image.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Image;
};
