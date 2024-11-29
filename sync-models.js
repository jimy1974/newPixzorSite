const sequelize = require('./db');
const PublicImage = require('./models/PublicImage');

(async () => {
  try {
    await sequelize.sync({ alter: true }); // Use `force: true` to drop and recreate tables
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }
})();
