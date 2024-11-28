const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const PublicImage = require('./models/PublicImage'); // Adjust the path as needed
const PersonalImage = require('./models/PersonalImage'); // Adjust the path as needed

async function processImage(originalImagePath, thumbnailPath) {
  // Ensure the thumbnails directory exists
  const thumbnailsDir = path.dirname(thumbnailPath);
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  // Generate the thumbnail using sharp
  await sharp(originalImagePath)
    .resize({ width: 408 }) // Resize to 408px wide, maintaining aspect ratio
    .toFile(thumbnailPath);
}

(async () => {
  try {
    console.log('Generating thumbnails for public images...');
    const publicImages = await PublicImage.findAll();

    for (const image of publicImages) {
      const originalImagePath = path.join(__dirname, 'public', image.imageUrl);
      const thumbnailPath = path.join(__dirname, 'public', 'thumbnails', path.basename(image.imageUrl));

      await processImage(originalImagePath, thumbnailPath);

      // Update the database with the thumbnail URL
      image.thumbnailUrl = `/thumbnails/${path.basename(image.imageUrl)}`;
      await image.save();

      console.log(`Thumbnail created for public image: ${image.imageUrl}`);
    }

    console.log('Generating thumbnails for personal images...');
    const personalImages = await PersonalImage.findAll();

    for (const image of personalImages) {
      const userFolder = path.join(__dirname, 'public', 'personal-images', image.userId.toString());
      const originalImagePath = path.join(userFolder, path.basename(image.imageUrl));
      const thumbnailPath = path.join(userFolder, 'thumbnails', path.basename(image.imageUrl));

      await processImage(originalImagePath, thumbnailPath);

      // Update the database with the thumbnail URL
      image.thumbnailUrl = `/personal-images/${image.userId}/thumbnails/${path.basename(image.imageUrl)}`;
      await image.save();

      console.log(`Thumbnail created for personal image: ${image.imageUrl}`);
    }

    console.log('All thumbnails have been generated and database updated.');
  } catch (error) {
    console.error('Error generating thumbnails:', error);
  }
})();
