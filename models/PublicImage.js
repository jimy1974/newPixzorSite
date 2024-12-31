const { DataTypes } = require('sequelize');

// Helper function to update "all-styles" count
async function updateAllStylesCount(sequelize, transaction) {
  const [results] = await sequelize.query(`SELECT COUNT(*) AS total FROM PublicImages`, {
    transaction,
  });
  const total = results[0]?.total || 0;

  await sequelize.query(
    `UPDATE styles SET count = :total WHERE name = 'all-styles'`,
    { replacements: { total }, transaction }
  );
}

module.exports = (sequelize) => {
  const PublicImage = sequelize.define(
    'PublicImage',
    {
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
      style: {
        type: DataTypes.STRING, // Must match the `name` field in the `styles` table
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('ai-generated', 'user-uploaded', 'stylized-photo'), // Matches ENUM
        allowNull: false,
        defaultValue: 'ai-generated',
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      personalImageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'personalimages',
          key: 'id',
        },
      },
      likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      tableName: 'PublicImages',
      timestamps: true,
    }
  );

  // Associations
  PublicImage.associate = (models) => {
    PublicImage.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    PublicImage.belongsTo(models.PersonalImage, { foreignKey: 'personalImageId', as: 'personalImage' });
  };

  // Hooks for style count management
  PublicImage.addHook('afterCreate', async (publicImage, options) => {
    // Increment the count for the style in the `styles` table
    const style = publicImage.style;
    if (style) {
      await sequelize.query(
        `UPDATE styles SET count = count + 1 WHERE name = :style`,
        { replacements: { style }, transaction: options.transaction }
      );
    }

    // Update "all-styles" count
    await updateAllStylesCount(sequelize, options.transaction);
  });

  PublicImage.addHook('afterDestroy', async (publicImage, options) => {
    // Decrement the count for the style in the `styles` table
    const style = publicImage.style;
    if (style) {
      await sequelize.query(
        `UPDATE styles SET count = count - 1 WHERE name = :style`,
        { replacements: { style }, transaction: options.transaction }
      );
    }

    // Update "all-styles" count
    await updateAllStylesCount(sequelize, options.transaction);
  });

  PublicImage.addHook('beforeUpdate', async (publicImage, options) => {
    // Handle style changes: decrement old style count, increment new style count
    if (publicImage.changed('style')) {
      const previousStyle = publicImage._previousDataValues.style;
      const newStyle = publicImage.style;

      if (previousStyle) {
        await sequelize.query(
          `UPDATE styles SET count = count - 1 WHERE name = :style`,
          { replacements: { style: previousStyle }, transaction: options.transaction }
        );
      }

      if (newStyle) {
        await sequelize.query(
          `UPDATE styles SET count = count + 1 WHERE name = :style`,
          { replacements: { style: newStyle }, transaction: options.transaction }
        );
      }
    }

    // Update "all-styles" count
    await updateAllStylesCount(sequelize, options.transaction);
  });

  return PublicImage;
};
