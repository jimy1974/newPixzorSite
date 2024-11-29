const { PersonalImage } = require('./models');

(async () => {
  try {
    const images = await PersonalImage.findAll();
    console.log('Personal images:', images);
  } catch (error) {
    console.error('Error fetching personal images:', error);
  }
})();
