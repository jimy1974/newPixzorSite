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
    style: {
      type: DataTypes.STRING, // Matches the style column in the database
      allowNull: true, // Since it defaults to NULL
    },
    type: {
      type: DataTypes.ENUM('ai-generated', 'user-uploaded', 'stylized-photo'), // Matches the ENUM
      defaultValue: 'ai-generated',
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Set to NULLABLE as per your DB schema
      references: {
        model: 'users',
        key: 'id',
      },
    },
  }, {
    tableName: 'PersonalImages',
    timestamps: true,
  });

  PersonalImage.associate = (models) => {
    PersonalImage.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    PersonalImage.hasMany(models.Comment, { foreignKey: 'imageId', as: 'comments' });
    PersonalImage.hasMany(models.PublicImage, { foreignKey: 'personalImageId', as: 'publicImages' });
  };

  return PersonalImage;
};
