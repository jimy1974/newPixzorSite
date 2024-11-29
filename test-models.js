const models = require('./models');

(async () => {
  try {
    console.log('Models loaded:');
    console.log(Object.keys(models)); // Should list all loaded models

    // Test database connection
    await models.sequelize.authenticate();
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Error loading models or connecting to the database:', error);
  }
})();
