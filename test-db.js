// test-db.js
const sequelize = require('./db');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    process.exit();
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();
