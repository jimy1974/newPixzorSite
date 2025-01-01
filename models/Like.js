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
      personalImageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'personalimages', // Use lowercase if your actual table name is lowercase
          key: 'id',
        },
      },
    },
    {
      tableName: 'likes',    // Must match the actual table name
      timestamps: true,      // Use createdAt/updatedAt
      // If you want your createdAt/updatedAt to auto-default, 
      // make sure your table supports DEFAULT CURRENT_TIMESTAMP
    }
  );

  // Define associations
  Like.associate = (models) => {
    // If you’re using 'User' model in "models/User.js":
    Like.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    
    // Use 'PersonalImage' model if that is how your model is named in sequelize
    // For example, if your personal image model is "PersonalImage" in "models/PersonalImage.js":
    Like.belongsTo(models.PersonalImage, { 
      foreignKey: 'personalImageId', 
      as: 'personalImage',
      constraints: true,        // optional
      onDelete: 'CASCADE',      // optional, matches your DB FK
      onUpdate: 'CASCADE',      // optional, matches your DB FK
    });
  };

  return Like;
};
