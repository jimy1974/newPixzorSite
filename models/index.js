// models/index.js
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const sequelize = require('../db'); // Adjust path as needed

const db = {};

// Dynamically import all models
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize);
    db[model.name] = model;
  });

// Establish associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Optional: Log associations for debugging
Object.keys(db).forEach(modelName => {
  const model = db[modelName];
  console.log(`Model ${modelName} associations:`);
  if (model.associations && Object.keys(model.associations).length > 0) {
    Object.keys(model.associations).forEach(assoc => {
      console.log(`  - ${assoc}:`, model.associations[assoc].associationType, `with ${model.associations[assoc].target.name}`);
    });
  } else {
    console.log('  - No associations');
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
