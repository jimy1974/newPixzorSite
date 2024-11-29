const { PublicImage, User } = require('./models');

(async () => {
  try {
    const publicImages = await PublicImage.findAll({
      include: [{ model: User, as: 'user' }], // Use the correct alias
    });
    console.log(publicImages);
  } catch (error) {
    console.error('Error fetching public images:', error);
  }
})();
