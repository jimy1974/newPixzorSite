const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Style = sequelize.define('Style', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'styles',
    timestamps: false,
  });

  return Style;
};
