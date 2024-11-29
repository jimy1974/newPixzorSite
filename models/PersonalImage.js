// models/PersonalImage.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PersonalImage = sequelize.define('PersonalImage', {
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
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Changed from false to match DB (DEFAULT NULL)
      references: {
        model: 'users', // Correct table name
        key: 'id',
      },
    },
  }, {
    tableName: 'PersonalImages', // Ensure this matches your actual table name
    timestamps: true,
  });

  // Define associations
  PersonalImage.associate = (models) => {
    PersonalImage.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    PersonalImage.hasMany(models.Comment, { foreignKey: 'imageId', as: 'comments' });
    PersonalImage.hasMany(models.PublicImage, { foreignKey: 'personalImageId', as: 'publicImages' });
  };

  return PersonalImage;
};
