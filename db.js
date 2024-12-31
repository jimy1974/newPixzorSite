require('dotenv').config(); // Import dotenv to load .env variables
const { Sequelize, Op } = require('sequelize'); // Import Op and Sequelize

// Use environment variables for database connection
const sequelize = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD, {
  host: process.env.DATABASE_HOST || 'localhost',
  dialect: 'mysql',
  logging: console.log, // Enable logging for debugging
});

// Attach Op to the sequelize instance
sequelize.Op = Op;

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error.message);
    console.error('Full error:', error);
  });

// Export sequelize (with Op attached)
module.exports = sequelize;
