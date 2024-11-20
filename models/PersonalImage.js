const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./User');

const PersonalImage = sequelize.define('PersonalImage', {
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to private
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  timestamps: true,
});

User.hasMany(PersonalImage, { foreignKey: 'userId' });
PersonalImage.belongsTo(User, { foreignKey: 'userId' });

module.exports = PersonalImage;

