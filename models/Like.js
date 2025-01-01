// models/Like.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Like = sequelize.define(
    'Like',
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users', // Refers to the 'users' table
          key: 'id',
        },
      },
      publicImageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'publicimages', // Refers to the 'publicimages' table
          key: 'id',
        },
      },
      personalImageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'personalimages', // Refers to the 'personalimages' table
          key: 'id',
        },
      },
    },
    {
      tableName: 'likes', // Use lowercase table name
      timestamps: true, // Enable createdAt and updatedAt
    }
  );

  // Define associations
  Like.associate = (models) => {
    Like.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Like.belongsTo(models.PublicImage, { foreignKey: 'publicImageId', as: 'publicImage', constraints: false });
    Like.belongsTo(models.PersonalImage, { foreignKey: 'personalImageId', as: 'personalImage', constraints: false });
  };

  return Like;
};
