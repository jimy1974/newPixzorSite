// models/PublicImage.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PublicImage = sequelize.define('PublicImage', {
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Changed to true to match DB (DEFAULT NULL)
      references: {
        model: 'users', // Correct table name
        key: 'id',
      },
    },
    personalImageId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Changed to true to match DB (DEFAULT NULL)
      references: {
        model: 'personalimages', // Correct table name
        key: 'id',
      },
    },
  }, {
    tableName: 'publicimages', // Correct table name
    timestamps: true,
  });

  // Define associations
  PublicImage.associate = (models) => {
    PublicImage.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    PublicImage.belongsTo(models.PersonalImage, { foreignKey: 'personalImageId', as: 'personalImage' });
  };

  return PublicImage;
};
