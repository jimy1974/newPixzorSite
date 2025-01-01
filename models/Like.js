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
      imageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'images', // This assumes you're using a single `images` table for both public and personal images
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
    Like.belongsTo(models.Image, { foreignKey: 'imageId', as: 'image' }); // Assuming all images are stored in a single `Image` model
  };

  return Like;
};
