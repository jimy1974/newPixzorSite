// models/Comment.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Comment = sequelize.define('Comment', {
    imageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'personalimages', // Correct table name
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users', // Correct table name
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    tableName: 'comments',
    timestamps: true,
  });

  // Define associations
  Comment.associate = (models) => {
    Comment.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Comment.belongsTo(models.PersonalImage, { foreignKey: 'imageId', as: 'personalImage' });
  };

  return Comment;
};
