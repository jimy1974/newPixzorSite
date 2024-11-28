// server.js

// Load environment variables
require('dotenv').config();
const axios = require('axios'); // Install via npm
const express = require('express');
const path = require('path');
const fetch = require('cross-fetch');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const bcrypt = require('bcrypt');
const sharp = require('sharp');

// Import the entire db object
const db = require('./models'); // Centralized model loader
const { User, PersonalImage, Comment, PublicImage, Image } = db;

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure storage location and filename options
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

// Set the base URL and redirect URI from .env variables
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/auth/google/callback`;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;




// Set up the view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public')); 
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



app.use((req, res, next) => {
  // Only log `req.body` for requests that might have a body
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (req.originalUrl === '/webhook') {
      console.log('Webhook raw body:', req.body ? req.body.toString() : 'undefined');
    } else {
      console.log('Parsed body:', req.body ? req.body : 'No body sent');
    }
  }else{
    console.log('Caught: '+req.originalUrl );  
  }
  next();
});


// Webhook route must be placed before body-parser middleware
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('Webhook route hit');

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    // Use the raw body for Stripe's signature verification
    const rawBody = req.body.toString(); 
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    console.log('Verified event:', event);

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      try {
        const fullSession = await stripe.checkout.sessions.retrieve(session.id);
        console.log('Full session retrieved:', fullSession);

        const userId = fullSession.metadata.userId; // Metadata from the session
        const tokens = parseInt(fullSession.metadata.tokens, 10);

        if (!userId || isNaN(tokens)) {
          throw new Error('Invalid metadata in session');
        }

        // Update user's token balance
        const user = await User.findByPk(userId);
        if (user) {
          user.tokens += tokens;
          await user.save();
          console.log(`Successfully added ${tokens} tokens to user ${user.username}`);
        } else {
          console.error(`User with ID ${userId} not found.`);
        }
      } catch (err) {
        console.error(`Error processing checkout.session.completed: ${err.message}`);
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error verifying webhook:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});




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
app.use(passport.initialize());
app.use(passport.session());
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/personal-images', express.static(path.join(__dirname, 'public/personal-images')));
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

/*

  message: 'Invalid payment_method_types[1]: must be one of card, acss_debit, affirm, afterpay_clearpay, alipay, au_becs_debit, bacs_debit, bancontact, blik, boleto, cashapp, customer_balance, eps, fpx, giropay, grabpay, ideal, klarna, konbini, link, multibanco, oxxo, p24, paynow, paypal, pix, promptpay, sepa_debit, sofort, swish, us_bank_account, wechat_pay, revolut_pay, mobilepay, zip, amazon_pay, alma, twint, kr_card, naver_pay, kakao_pay, payco, or samsung_pay',
*/


app.post('/create-checkout-session', async (req, res) => {
  console.log('Request body:', req.body); // Log incoming data
  const { tokens, price } = req.body;

  if (!tokens || !price) {
    console.error('Invalid request body:', req.body);
    return res.status(400).json({ error: 'Missing tokens or price' });
  }
    
  try {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'link', 'paypal' ], //, 'link', 'paypal'
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${tokens} Tokens for Pixzor`,
                },
                unit_amount: price * 100, // Convert dollars to cents
            },
            quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.APP_BASE_URL}/success`,
        cancel_url: `${process.env.APP_BASE_URL}/cancel`,
        metadata: {
            userId: req.user.id,
            tokens: tokens,
        },
    });


    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});










/*
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Extract metadata to identify the user and tokens
        const userId = session.metadata.userId;
        const tokens = parseInt(session.metadata.tokens, 10);

        // Update user's tokens in the database
        try {
            const user = await User.findByPk(userId);
            if (user) {
                user.tokens += tokens;
                await user.save();
                console.log(`Successfully added ${tokens} tokens to user ${user.username}.`);
            } else {
                console.error(`User with ID ${userId} not found.`);
            }
        } catch (error) {
            console.error(`Error updating tokens: ${error.message}`);
        }
    }

    // Acknowledge receipt of the event
    res.json({ received: true });
});*/




app.get('/success', (req, res) => {
    res.redirect('/?status=success');
});


app.get('/cancel', (req, res) => {
  res.redirect('/?status=cancel');
});


const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: googleRedirectUri
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // First, check if the user exists by googleId
    let user = await User.findOne({ where: { googleId: profile.id } });

    if (!user) {
      // Then, check if the email is already used
      const existingEmailUser = await User.findOne({ where: { email: profile.emails[0].value } });

      if (existingEmailUser) {
        console.log(`A user with the email ${profile.emails[0].value} already exists.`);
        // Optionally, you can link the existing account to this Google ID
        existingEmailUser.googleId = profile.id;
        await existingEmailUser.save();
        user = existingEmailUser;
      } else {
        // Create a new user if no conflicts are found
        user = await User.create({
          googleId: profile.id,
          tokens: 200,
          username: profile.displayName || `User${Date.now()}`,
          email: profile.emails[0].value,
          photo: profile.photos[0] ? profile.photos[0].value : null,
        });
      }
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
      photo: req.user.photo || '/images/avatar.png', // Updated path
      tokens: req.user.tokens,    
    });
  } else {
    res.json({ loggedIn: false });
  }
});




app.get('/public-images', async (req, res) => {
  try {
    const images = await PublicImage.findAll();
    res.json(images);
  } catch (error) {
    console.error('Error fetching public images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});




app.get('/test', (req, res) => {
  res.render('test'); // This is your main application page
});

app.get('/', (req, res) => {
  res.render('index', { showProfile: false, profileUserId : 0 });
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

    // Generate a thumbnail
    const thumbnailName = `thumb_${imageName}`;
    const thumbnailPath = path.join(userFolderPath, thumbnailName);

    await sharp(imagePath)
      .resize(408) // Maintain aspect ratio with width 408px
      .toFile(thumbnailPath);

    // Save image metadata to the PersonalImages database
    const newPersonalImage = await PersonalImage.create({
      userId: req.user.id,
      imageUrl: `/personal-images/${req.user.id}/${imageName}`,
      thumbnailUrl: `/personal-images/${req.user.id}/${thumbnailName}`,
      prompt,
      isPublic: isPublic || false
    });

    // If the image is marked as public, also add it to the PublicImages database
    if (isPublic) {
      await PublicImage.create({
        imageUrl: `/personal-images/${req.user.id}/${imageName}`, // Correct path
        thumbnailUrl: `/personal-images/${req.user.id}/${thumbnailName}`,
        title: prompt, // Use full prompt or a suitable title
        description: prompt,
        prompt: prompt, // Ensure the prompt field is included
        userId: req.user.id, // Associate with the user
      });
    }



    res.json({ imageUrl: `/personal-images/${req.user.id}/${imageName}`, thumbnailUrl: `/personal-images/${req.user.id}/${thumbnailName}`, tokensUsed: 1 });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

            

app.get('/images/:id/comments', async (req, res) => {
  const { id } = req.params;

  try {
    const comments = await Comment.findAll({
      where: { imageId: id },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'photo'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(comments.map(comment => ({
      id: comment.id, // Include comment ID if needed
      content: comment.content,
      username: comment.user.username,
      avatar: comment.user.photo || '/default-avatar.png',
      createdAt: comment.createdAt,
      userProfileUrl: `/users/${comment.user.id}`, // Link to user's profile
    })));
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments.' });
  }
});




// server.js

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'photo', 'email'], // Include attributes as needed
      include: [
        { model: PersonalImage, as: 'personalImages' },
        { model: Comment, as: 'comments' },
        { model: Image, as: 'images' },
        { model: PublicImage, as: 'publicImages' }
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      id: user.id,
      username: user.username,
      photo: user.photo,
      email: user.email,
      personalImages: user.personalImages,
      comments: user.comments,
      images: user.images,
      publicImages: user.publicImages,
      // Include additional details as needed
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});





app.post('/images/:id/comments', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    // First, check if the image exists in `personalimages`
    const personalImage = await PersonalImage.findByPk(id);

    if (!personalImage) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    const comment = await Comment.create({
      imageId: id, // Always use the personal image ID
      userId: req.user.id,
      content,
    });

    res.json(comment);
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});







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



app.get('/api/public-posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const publicImages = await PublicImage.findAll({
      offset,
      limit,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'imageUrl', 'thumbnailUrl', 'title', 'description', 'prompt', 'createdAt'], // Include prompt
    });

    const totalImages = await PublicImage.count();
    const hasMore = offset + limit < totalImages;

    res.json({ images: publicImages, hasMore });
  } catch (error) {
    console.error('Error loading public posts:', error);
    res.status(500).json({ error: 'Failed to load public posts' });
  }
});


app.get('/api/image-details/:id', async (req, res) => {
  try {
    const imageId = req.params.id;

    // Attempt to find the image in PublicImage
    let image = await PublicImage.findByPk(imageId, {
      include: [{ model: User, as: 'user', attributes: ['username'] }],
    });

    if (image) {
      return res.json({
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        prompt: image.prompt,
        username: image.user?.username || 'Unknown User', // Changed 'User' to 'user'
        userId: image.userId,
        isPublic: true,
      });
    }

    // If not found in PublicImage, try PersonalImage
    image = await PersonalImage.findByPk(imageId, {
      include: [{ model: User, as: 'user', attributes: ['username'] }],
    });

    if (image) {
      return res.json({
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        prompt: image.prompt,
        username: image.user?.username || 'Unknown User', // Changed 'User' to 'user'
        userId: image.userId,
        isPublic: image.isPublic,
      });
    }

    // If not found in both tables
    res.status(404).json({ error: 'Image not found' });
  } catch (error) {
    console.error('Error fetching image details:', error);
    res.status(500).json({ error: 'Failed to fetch image details' });
  }
});



app.put('/update-image-visibility/:id', ensureAuthenticated, async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await PersonalImage.findByPk(imageId);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    image.isPublic = !image.isPublic;
    await image.save();

    if (image.isPublic) {
      // Create or update the public image entry
      let publicImage = await PublicImage.findOne({ where: { personalImageId: imageId } });
      if (!publicImage) {
        publicImage = await PublicImage.create({
          personalImageId: imageId,
          imageUrl: image.imageUrl,
          thumbnailUrl: image.thumbnailUrl,
          title: image.title || 'Untitled',
          description: image.description || '',
          prompt: image.prompt,
          userId: image.userId,
        });
      } else {
        // Update existing public image data if needed
        publicImage.imageUrl = image.imageUrl;
        publicImage.thumbnailUrl = image.thumbnailUrl;
        publicImage.title = image.title || 'Untitled';
        publicImage.description = image.description || '';
        publicImage.prompt = image.prompt;
        await publicImage.save();
      }
    } else {
      // Remove the public image entry
      await PublicImage.destroy({ where: { personalImageId: imageId } });
    }

    res.json({ message: 'Image visibility updated successfully', isPublic: image.isPublic });
  } catch (error) {
    console.error('Error updating image visibility:', error);
    res.status(500).json({ error: 'Failed to update image visibility' });
  }
});



app.get('/api/personal-image-details/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await PersonalImage.findByPk(imageId, {
      include: [{ model: User, attributes: ['username'] }],
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      prompt: image.prompt,
      username: image.User?.username || 'Unknown User',
      userId: image.userId,
    });
  } catch (error) {
    console.error('Error fetching personal image details:', error);
    res.status(500).json({ error: 'Failed to fetch personal image details' });
  }
});

app.get('/api/public-image-details/:id', async (req, res) => {
  try {
    const imageId = req.params.id;

    const image = await PublicImage.findByPk(imageId, {
      include: [
        { model: User, as: 'user', attributes: ['username', 'photo'] },
        { model: PersonalImage, as: 'personalImage' }
      ],
    });

    if (!image) {
      return res.status(404).json({ error: 'Public image not found.' });
    }

    res.json({
      imageUrl: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl,
      prompt: image.prompt,
      username: image.user ? image.user.username : 'Unknown User',
      userId: image.userId,
      isPublic: image.isPublic,
      personalImageId: image.personalImageId, // Include personalImageId
    });
  } catch (error) {
    console.error('Error fetching image details:', error);
    res.status(500).json({ error: 'Failed to fetch image details' });
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


// API route to fetch user profile details
// Example usage:
app.get('/api/user-profile/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user details from the database
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'photo'], // Adjust attributes as needed
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch public images associated with the user
    const publicImages = await PublicImage.findAll({
      where: { userId },
      attributes: ['id', 'thumbnailUrl', 'imageUrl', 'prompt'], // Adjust attributes as needed
      order: [['createdAt', 'DESC']],
    });

    res.json({ user, publicImages });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});




app.get('/user-profile/:id', (req, res) => {
  const userId = req.params.id;
  res.render('index', { showProfile: true, profileUserId: userId });
});



// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.render('index'); // Renders 'views/index.ejs'
});


(async () => {
  try {
    await db.sequelize.sync({ alter: false }); // Set to false to prevent altering tables
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }

  // Start the server after synchronization
  app.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
  });
})();


