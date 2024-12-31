// models/Like.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Like = sequelize.define('Like', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users', // Refers to the User model
        key: 'id',
      },
    },
    imageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'PublicImages', // Refers to PublicImage or PersonalImage
        key: 'id',
      },
    },
  }, {
    tableName: 'likes',
    timestamps: true, // Enable createdAt and updatedAt
  });

  // Define associations
  Like.associate = (models) => {
    Like.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Like.belongsTo(models.PublicImage, { foreignKey: 'imageId', as: 'publicImage', constraints: false });
    Like.belongsTo(models.PersonalImage, { foreignKey: 'imageId', as: 'personalImage', constraints: false });
  };

  return Like;
};
