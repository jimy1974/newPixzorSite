// sync.js
const sequelize = require('./db');
const User = require('./models/User');
const Image = require('./models/Image');

(async () => {
  try {
    await sequelize.sync({ alter: true }); // Use { force: true } for development to reset tables
    console.log('All models were synchronized successfully.');
    process.exit();
  } catch (error) {
    console.error('Error syncing models:', error);
  }
})();
