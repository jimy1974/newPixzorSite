const { PublicImage } = require('./models');

(async () => {
  try {
    const images = await PublicImage.findAll();
    console.log('Public images:', images);
  } catch (error) {
    console.error('Error fetching public images:', error);
  }
})();


