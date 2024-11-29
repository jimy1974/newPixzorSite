const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const sequelize = require('../db'); // Ensure this path is correct

// Initialize the models object
const models = {};

// Dynamically import all models
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes); // Pass Sequelize DataTypes
    models[model.name] = model;
  });

// Establish associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models); // Pass the models object to associate
  }
});

// Log associations for debugging (optional)
Object.keys(models).forEach((modelName) => {
  const model = models[modelName];
  console.log(`Model ${modelName} associations:`);
  if (model.associations && Object.keys(model.associations).length > 0) {
    Object.keys(model.associations).forEach((assoc) => {
      console.log(
        `  - ${assoc}:`,
        model.associations[assoc].associationType,
        `with ${model.associations[assoc].target.name}`
      );
    });
  } else {
    console.log('  - No associations');
  }
});

// Add Sequelize and sequelize to the models object
models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
