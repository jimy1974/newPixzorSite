// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const fetch = require('cross-fetch');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Image = require('./models/Image');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure storage location and filename options
const fs = require('fs');
const app = express();
const PORT = 3000;

// Set the base URL and redirect URI from .env variables
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/auth/google/callback`;

// Set up the view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public')); 
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to parse JSON data
app.use(express.json());

// Middleware to parse URL-encoded data (form submissions)
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: `${process.env.SESSION_SECRET}`, // Use an environment variable in production
  resave: false,
  saveUninitialized: false,
}));

app.use(flash());

// Make user object available in all templates
app.use((req, res, next) => {
  res.locals.messages = req.flash();    
  res.locals.user = req.user;
  next();
});


app.use(passport.initialize());
app.use(passport.session());

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));


const LocalStrategy = require('passport-local').Strategy;



// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Configure Local Strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password',
  },
  async (username, password, done) => {
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) return done(null, false, { message: 'Incorrect username.' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return done(null, false, { message: 'Incorrect password.' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(401).json({ error: 'Please log in to generate an image.' });
  } else {
    res.redirect('/login');
  }
}



const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: googleRedirectUri        
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ where: { googleId: profile.id } });
    if (!user) {
      
        user = await User.create({
          googleId: profile.id,
          tokens: 200,
          username: profile.displayName || 'Default Username',
          email: profile.emails[0].value,
          photo: profile.photos[0] ? profile.photos[0].value : null,          
        });


        
    }
    return done(null, user);
  } catch (err) {
    console.error('Error in Google strategy:', err);
    return done(err, null);
  }
}));





app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Redirect to the home page after successful login
    res.redirect('/');
  }
);



app.get('/demo/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/demo/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Redirect to the home page after successful login
    res.redirect('/');
  }
);





// Route to send user data to the client
app.get('/user-data', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      loggedIn: true,
      username: req.user.username,
      email: req.user.email,
      photo: req.user.photo || 'default-photo-url.png', // Include photo URL if available
      tokens: req.user.tokens,    
    });
  } else {
    res.json({ loggedIn: false });
  }
});


const PublicImage = require('./models/PublicImage');

app.get('/public-images', async (req, res) => {
  try {
    const images = await PublicImage.findAll();
    res.json(images);
  } catch (error) {
    console.error('Error fetching public images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});




app.get('/demo', (req, res) => {
  res.render('index'); // This is your main application page
});

app.get('/', (req, res) => {
  res.render('splash'); // Render a splash or landing page
});


app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register' );
});




app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check if the username or email already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    await User.create({
      username,
      email,
      password: hashedPassword,
    });

    res.json({ message: 'Registration successful! Please log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});




app.post('/login', (req, res, next) => {
  console.log('Login request body:', req.body); // Log the request body

  passport.authenticate('local', (err, user, info) => {
    console.log('Passport authentication result:', { err, user, info }); // Log authentication results

    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'An error occurred during login.' });
    }
    if (!user) {
      console.error('Authentication failed:', info.message);
      return res.status(400).json({ error: info.message || 'Authentication failed.' });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'An error occurred during login.' });
      }
      res.json({ message: 'Login successful!' });
    });
  })(req, res, next);
});


app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});



const PersonalImage = require('./models/PersonalImage'); // Adjust based on your file structure



app.post('/generate-image', ensureAuthenticated, async (req, res) => {
  try {
    if (req.user.tokens <= 0) {
      return res.status(400).json({ error: 'You do not have enough tokens to generate an image.' });
    }

    const { prompt, width, height, guidanceScale, inferenceSteps, isPublic } = req.body;

    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt is too long. Please shorten it and try again.' });
    }

    const response = await fetch('https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/jpeg',
        'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        guidance_scale: guidanceScale,
        num_inference_steps: inferenceSteps
      })
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch the image from the external API';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = `External API Error: ${errorData.error}`;
        }
      } catch (parseError) {}
      throw new Error(errorMessage);
    }

    const buffer = await response.arrayBuffer();
    const imageData = Buffer.from(buffer);

    req.user.tokens -= 1;
    await req.user.save();

    const userFolderPath = path.join(__dirname, 'public', 'personal-images', req.user.id.toString());
    if (!fs.existsSync(userFolderPath)) {
      fs.mkdirSync(userFolderPath, { recursive: true });
    }

    const imageName = `image_${Date.now()}.jpg`;
    const imagePath = path.join(userFolderPath, imageName);

    fs.writeFileSync(imagePath, imageData);

    // Save image metadata to the PersonalImages database
    const newPersonalImage = await PersonalImage.create({
      userId: req.user.id,
      imageUrl: `/personal-images/${req.user.id}/${imageName}`,
      prompt,
      isPublic: isPublic || false // Use the value from the request or default to false
    });

    // If the image is marked as public, also add it to the PublicImages database
    if (isPublic) {
      await PublicImage.create({
        imageUrl: `/personal-images/${req.user.id}/${imageName}`,
        title: prompt.substring(0, 50), // Optional: Use a substring of the prompt as the title
        description: prompt, // Optional: Use the full prompt as the description
      });
    }

    res.json({ imageUrl: `/personal-images/${req.user.id}/${imageName}`, tokensUsed: 1 });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});






// Route to delete a private image
// Route to delete a private image
app.delete('/delete-private-image/:id', async (req, res) => {
  try {
    const imageId = req.params.id;

    // Find the image by its ID in the PersonalImages table
    const image = await PersonalImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get the full path of the image file
    const imagePath = path.join(__dirname, 'public', image.imageUrl);

    // Delete the image record from the database
    await image.destroy();

    // Delete the image file from the filesystem
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.json({ message: 'Private image deleted successfully' });
  } catch (error) {
    console.error('Error deleting private image:', error);
    res.status(500).json({ error: 'Failed to delete private image' });
  }
});







app.post('/upload-image', ensureAuthenticated, async (req, res) => {
  // Code to handle image uploads and store file paths in the database
});

app.get('/personal-images', ensureAuthenticated, async (req, res) => {
  try {
    // Fetch images from the database where userId matches the logged-in user
    const images = await PersonalImage.findAll({ where: { userId: req.user.id } });
    res.json(images);
  } catch (error) {
    console.error('Error fetching personal images:', error);
    res.status(500).json({ error: 'Failed to fetch personal images' });
  }
});


app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user });
});


// Adjust any routes or URL references to use `appBaseUrl` if needed
app.listen(PORT, () => {
  console.log(`Server is running on ${appBaseUrl}:${PORT}`);
});

app.get('/api/public-posts', async (req, res) => {
  try {
    // Get page and limit from query parameters (default to page 1 and limit 10 if not provided)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch public images with pagination
    const publicImages = await PublicImage.findAll({
      offset: offset,
      limit: limit,
      order: [['createdAt', 'DESC']] // Optional: Order by creation date or another relevant field
    });

    // Check if there are more images for the next page
    const totalImages = await PublicImage.count();
    const hasMore = offset + limit < totalImages;

    res.json({
      images: publicImages,
      hasMore: hasMore
    });
  } catch (error) {
    console.error('Error loading public posts:', error);
    res.status(500).json({ error: 'Failed to load public posts' });
  }
});

app.put('/update-image-visibility/:id', ensureAuthenticated, async (req, res) => {
  try {
    const imageId = req.params.id;
    console.log('Received request to update visibility for image ID:', imageId);

    const image = await PersonalImage.findByPk(imageId);

    if (!image) {
      console.warn('Image not found in PersonalImage table:', imageId);
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if the logged-in user owns the image
    if (image.userId !== req.user.id) {
      console.warn('Unauthorized access attempt by user ID:', req.user.id);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Toggle the isPublic field
    image.isPublic = !image.isPublic;
    await image.save();
    console.log('Image visibility toggled. New visibility:', image.isPublic);

    // If the image is made public, add it to the PublicImage table
    if (image.isPublic) {
      console.log('Image set to public. Checking if it exists in PublicImage table:', image.imageUrl);

      const existingPublicImage = await PublicImage.findOne({ where: { imageUrl: image.imageUrl } });

      if (!existingPublicImage) {
        console.log('Image not found in PublicImage table. Adding new entry.');

        try {
          await PublicImage.create({
            imageUrl: image.imageUrl,
            title: image.title || 'Untitled',
            description: image.description || '',
          });
          console.log('Image successfully added to PublicImage table.');
        } catch (createError) {
          console.error('Error creating entry in PublicImage table:', createError);
        }
      } else {
        console.log('Image already exists in PublicImage table. Skipping creation.');
      }
    } else {
      // If the image is made private, remove it from the PublicImage table
      console.log('Image set to private. Removing from PublicImage table if it exists.');

      const deletedCount = await PublicImage.destroy({ where: { imageUrl: image.imageUrl } });
      if (deletedCount > 0) {
        console.log('Image successfully removed from PublicImage table.');
      } else {
        console.log('Image not found in PublicImage table. No deletion performed.');
      }
    }

    res.json({ message: 'Image visibility updated successfully', isPublic: image.isPublic });
  } catch (error) {
    console.error('Error updating image visibility:', error);
    res.status(500).json({ error: 'Failed to update image visibility' });
  }
});





app.get('/api/private-posts', ensureAuthenticated, async (req, res) => {
  try {
    const privateImages = await PersonalImage.findAll({ where: { userId: req.user.id } });
    res.json(privateImages);
  } catch (error) {
    console.error('Error loading private posts:', error);
    res.status(500).json({ error: 'Failed to load private posts' }); // Ensure JSON response on error
  }
});


