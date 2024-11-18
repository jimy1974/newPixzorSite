require('dotenv').config(); // Import dotenv to load .env variables
const { Sequelize } = require('sequelize');

// Use environment variables for database connection
const sequelize = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD, {
  host: process.env.DATABASE_HOST || 'localhost',
  dialect: 'mysql',
  logging: console.log, // Enable logging for debugging
});

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error.message);
    console.error('Full error:', error);
  });

module.exports = sequelize;
