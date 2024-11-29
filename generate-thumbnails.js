const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Import the centralized model loader
const db = require('./models'); 
const { PublicImage, PersonalImage } = db; // Destructure required models

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
    const publicImages = await PublicImage.findAll(); // Fetch all public images

    for (const image of publicImages) {
      const originalImagePath = path.join(__dirname, 'public', image.imageUrl);
      const thumbnailPath = path.join(__dirname, 'public', 'thumbnails', path.basename(image.imageUrl));

      // Check if the original image exists before processing
      if (fs.existsSync(originalImagePath)) {
        await processImage(originalImagePath, thumbnailPath);

        // Update the database with the thumbnail URL
        image.thumbnailUrl = `/thumbnails/${path.basename(image.imageUrl)}`;
        await image.save();

        console.log(`Thumbnail created for public image: ${image.imageUrl}`);
      } else {
        console.error(`Original image not found: ${originalImagePath}`);
      }
    }

    console.log('Generating thumbnails for personal images...');
    const personalImages = await PersonalImage.findAll(); // Fetch all personal images

    for (const image of personalImages) {
      const userFolder = path.join(__dirname, 'public', 'personal-images', image.userId.toString());
      const originalImagePath = path.join(userFolder, path.basename(image.imageUrl));
      const thumbnailPath = path.join(userFolder, 'thumbnails', path.basename(image.imageUrl));

      // Ensure user folder exists before processing
      if (fs.existsSync(originalImagePath)) {
        await processImage(originalImagePath, thumbnailPath);

        // Update the database with the thumbnail URL
        image.thumbnailUrl = `/personal-images/${image.userId}/thumbnails/${path.basename(image.imageUrl)}`;
        await image.save();

        console.log(`Thumbnail created for personal image: ${image.imageUrl}`);
      } else {
        console.error(`Original image not found: ${originalImagePath}`);
      }
    }

    console.log('All thumbnails have been generated and database updated.');
  } catch (error) {
    console.error('Error generating thumbnails:', error);
  }
})();

