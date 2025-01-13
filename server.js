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

const db = require('./models'); // Centralized model loader
const { User, PersonalImage, Comment, PublicImage, Image, Like } = db;
const sequelize = require('./db'); // Import sequelize
const { Op } = sequelize; // Extract Op from sequelize

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure storage location and filename options
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require("cors");
const { OpenAI } = require("openai");
const app = express();
const PORT = 3000;

// Set the base URL and redirect URI from .env variables
const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/auth/google/callback`;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Content Safety API 
const { ContentSafety, MediaType, Category, Action } = require('./content-safety.js');
const endpoint = 'https://mycontentsafety2.cognitiveservices.azure.com';
const subscriptionKey = process.env.CONTENT_SAFETY_KEY;
const apiVersion = '2024-09-01';
const contentSafety = new ContentSafety(endpoint, subscriptionKey, apiVersion);


// Set up the view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public')); 
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up paths for personal and public images
const personalImagesPath = path.resolve(__dirname, '../SiteData/personal-images');
const publicImagesPath = path.resolve(__dirname, '../SiteData/public-images');

// Serve static files for personal and public images
app.use('/personal-images', express.static(personalImagesPath));
app.use('/public-images', express.static(publicImagesPath));
//app.use('/personal-images', express.static(path.join(__dirname, 'public/personal-images')));

// Ensure the directories exist
if (!fs.existsSync(personalImagesPath)) {
  fs.mkdirSync(personalImagesPath, { recursive: true });
}

if (!fs.existsSync(publicImagesPath)) {
  fs.mkdirSync(publicImagesPath, { recursive: true });
}


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Replace with your OpenAI API key
});


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
          console.log(`New token balance: ${user.tokens}`); // Log the updated token balance    
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

app.post('/test-update-tokens', async (req, res) => {
  const { userId, tokens } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.tokens += parseInt(tokens, 10);
      await user.save();
      console.log(`Successfully added ${tokens} tokens to user ${user.username}`);
      console.log(`New token balance: ${user.tokens}`);
      res.status(200).json({ success: true, message: 'Tokens updated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User not found.' });
    }
  } catch (err) {
    console.error(`Error updating user tokens: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to update tokens.' });
  }
});


// Middleware
app.use(cors());

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
const LocalStrategy = require('passport-local').Strategy;


const nudityKeywords = [
  'nude', 'naked', 'nudism', 'nudist', 'naturist', 'bare', 'explicit', 'porn', 'xxx', 'erotic', 'sexual', 'sex', 'breasts', 'genitals', 'buttocks', 'topless', 'without bra', 'undressed', 'undressing', 'fetish',  'lewd',
];

const underageKeywords = [
  'child', 'kid', 'teen', 'underage', 'minor', 'young', 'baby', 'toddler', 'preteen', 
  'schoolgirl', 'schoolboy', 'adolescent', 'juvenile', 'infant',  'teenager', 
  'high school', 'playground', 'youth', 'boy', 'girl', 'kindergarten'
];

const photorealisticKeywords = [
  'photo', 'photorealistic', 'realistic', 'photography', 'photo-real', 
  'photo-realistic', 'hyper-realistic', 'render', 'cgi', 'lifelike', 'ultra-realistic'
];

async function checkAndFlagPrompt(req, prompt, style) {
  // Normalize the prompt and style for case-insensitive matching
  const normalizedPrompt = prompt.toLowerCase();
  const normalizedStyle = style ? style.toLowerCase() : '';

  // Check for nudity and underage content
  const containsNudity = nudityKeywords.some(keyword => normalizedPrompt.includes(keyword));
  const containsUnderage = underageKeywords.some(keyword => normalizedPrompt.includes(keyword));

  // Check for photorealistic style
  const isPhotorealistic = photorealisticKeywords.some(keyword => normalizedStyle.includes(keyword));

  // Flag if the prompt contains both nudity and underage content
  if (containsNudity && containsUnderage) {
    req.user.flagCount = (req.user.flagCount || 0) + 1;
    await req.user.save();

    return { flagged: true, error: 'This prompt contains inappropriate content.' };
  }

  if (containsNudity && isPhotorealistic) {    
    return { flagged: true, error: 'This prompt contains inappropriate content.' };
  }

  // Optional: Flag any nudity-related content, even without photorealism
  if (containsNudity) {
    req.user.flagCount = (req.user.flagCount || 0) + 1;
    await req.user.save();

    return { flagged: true, error: 'This prompt contains inappropriate content.' };
  }

  return { flagged: false };
}


// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'email', 'photo', 'tokens', 'isAdmin'], // Include isAdmin
    });
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

  // Check if the request is an API call
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Please log in to perform this action.' });
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


app.post('/enhance-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).send({ error: "Prompt is required!" });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `Create a detailed image prompt based on: ${prompt}` }],
            max_tokens: 150,
        });

        res.json({ result: response.choices[0].message.content.trim() });
    } catch (error) {
        console.error("Error with OpenAI API:", error.message);
        res.status(500).send({ error: "Error generating prompt." });
    }
});


app.post('/create-checkout-session', async (req, res) => {
  console.log('Request body:', req.body);

  const { tokens, price } = req.body;

  if (!tokens) {
    console.error('Missing tokens in request body:', req.body);
    return res.status(400).json({ error: 'Tokens are required' });
  }

  // Predefined valid bundles
  const validBundles = {
    "500": "5.00",
    "1200": "10.00",
    "3000": "20.00",
    "5000": "30.00",
    "20000": "100.00",
  };

  // Validate tokens and derive price from server-side data
  const expectedPrice = validBundles[tokens];
  if (!expectedPrice) {
    console.error('Invalid token amount:', tokens);
    return res.status(400).json({ error: 'Invalid number of tokens selected' });
  }
  if (expectedPrice !== price) {
    console.error('Price mismatch:', { expectedPrice, price });
    return res.status(400).json({ error: 'Price does not match the selected token bundle' });
  }

  if (!req.user || !req.user.id) {
    console.error('Unauthorized user');
    return res.status(403).json({ error: 'User not authenticated' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link', 'paypal'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tokens} Tokens for Pixzor`,
            },
            unit_amount: parseFloat(expectedPrice) * 100, // Convert dollars to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_BASE_URL}/success`,
      cancel_url: `${process.env.APP_BASE_URL}/cancel`,
      metadata: {
        userId: req.user.id,
        tokens: tokens,
      },
    });

    console.log('Stripe session created:', session.id);
    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});



app.get('/success', (req, res) => {
    res.redirect('/?status=success');
});


app.get('/cancel', (req, res) => {
  res.redirect('/?status=cancel');
});


const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: googleRedirectUri
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ where: { googleId: profile.id } });

    if (!user) {
      const existingEmailUser = await User.findOne({ where: { email: profile.emails[0].value } });

      if (existingEmailUser) {
        console.log(`A user with the email ${profile.emails[0].value} already exists.`);
        existingEmailUser.googleId = profile.id;
        await existingEmailUser.save();
        user = existingEmailUser;
      } else {
        user = await User.create({
          googleId: profile.id,
          tokens: 50,
          username: profile.displayName || `User${Date.now()}`,
          email: profile.emails[0].value,
          photo: profile.photos[0] ? profile.photos[0].value : null,
          isAdmin: false, // Default to false for new users
        });
      }
    }

    // Ensure the isAdmin field is included in the user object
    user = await User.findByPk(user.id, {
      attributes: ['id', 'username', 'email', 'photo', 'tokens', 'isAdmin'], // Include isAdmin
    });

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


app.get("/check-auth", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({ isAuthenticated: true });
  }
  res.json({ isAuthenticated: false });
});



// Route to send user data to the client
app.get('/user-data', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      loggedIn: true,
      username: req.user.username,
      email: req.user.email,
      photo: req.user.photo || '/images/avatar.png',
      tokens: req.user.tokens,
      isRegistered: true, // Authenticated users are considered registered
    });
  } else {
    res.json({ loggedIn: false, isRegistered: false }); // Unauthenticated users are not registered
  }
});



app.get('/public-images', async (req, res) => {
  try {
    const images = await PublicImage.findAll();
    images.forEach((image) => {
      image.imageUrl = `/public-images${image.imageUrl}`;
      image.thumbnailUrl = `/public-images${image.thumbnailUrl}`;
    });
    res.json(images);
  } catch (error) {
    console.error('Error fetching public images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});





app.get('/test', (req, res) => {
  res.render('test'); // This is your main application page
});

app.get('/', async (req, res) => {
  const { image, source } = req.query;

  let imageUrl = '';
  let title = 'Welcome to Pixzor!';
  let description = 'Create stunning AI-generated images and videos!';
  const url = req.protocol + '://' + req.get('host') + req.originalUrl;

  try {
    // Fetch image details if an image and source are specified
    if (image && source) {
      let imageDetails;
      if (source === 'public') {
        imageDetails = await PublicImage.findByPk(image);
      } else {
        imageDetails = await PersonalImage.findByPk(image);
      }

      if (imageDetails) {
        imageUrl = `${req.protocol}://${req.get('host')}${imageDetails.imageUrl}`;
        title = `Check out this amazing AI-generated image!`;
        description = imageDetails.prompt || 'Discover creative AI-generated art with Pixzor!';
      }
    }

    // Fetch styles and their counts from the database
    const stylesWithCounts = await sequelize.query(
      `
      SELECT 
        name AS value, 
        label, 
        count 
      FROM styles 
      ORDER BY name ASC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Validate and format the styles array
    const updatedStylesWithCounts = stylesWithCounts.map((style) => ({
      ...style,
      label: style.label || style.value.charAt(0).toUpperCase() + style.value.slice(1).replace(/-/g, ' '), // Default to formatted `value` if `label` is missing
      count: style.count || 0, // Default to 0 if `count` is missing
    }));

    

    // Render the page with the fetched data
    res.render('index', {
      isLoggedIn: !!req.user, // True if user is logged in
      user: req.user || null, // Send user info if available
      isRegistered: req.user ? true : false, // Pass isRegistered flag
      showProfile: false,
      profileUserId: 0,
      title,
      description,
      imageUrl,
      url,
      stylesWithCounts: updatedStylesWithCounts, // Pass styles with counts and formatted labels
    });
  } catch (error) {
    console.error('Error fetching image details or styles:', error.stack);
    res.status(500).send('Internal Server Error');
  }
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


function calculateTokenCost(width, height, model) {
  const pixelCount = width * height;

  // Define token cost per 1 million pixels for each model
  const tokenCostPerMillionPixels = {
    'flux-schnell': 1, // 1 Token per 1M pixels
    'flux-dev': 1, // 1 Token per 1M pixels
    'essential-v2': 20, // 20 Tokens per 1M pixels
    // Stable Diffusion and other models: 0.1 Tokens per 1M pixels
  };

  // Get the token cost per 1M pixels for the selected model (default to 0.1 if not found)
  const tokenRate = tokenCostPerMillionPixels[model] || 0.1;

  // Calculate token cost: (pixelCount / 1,000,000) * tokenRate
  const tokenCost = (pixelCount / 1000000) * tokenRate;

  return tokenCost;
}


let consecutiveFailures = 0; // Track the number of consecutive failures for getimg.ai
let useBackupAPI = false; // Flag to indicate if we should use the backup API
const SWITCH_BACK_TIMEOUT = 5 * 60 * 60 * 1000; // 5-hour timeout for switching back

app.post('/generate-image', ensureAuthenticated, async (req, res) => {
  try {
    if (req.user.tokens <= 0) {
      return res.status(400).json({ error: 'You do not have enough tokens to generate an image.' });
    }

    var { prompt, width, height, guidanceScale, inferenceSteps, isPublic, style, model } = req.body;

    // Append the style to the prompt if it's not already included
    if (style && !prompt.toLowerCase().includes(style.toLowerCase())) {
      prompt = `${prompt}, style: ${style}`;
    }
      
    // Check and flag the prompt
    const flagResult = await checkAndFlagPrompt(req, prompt, style);
    if (flagResult.flagged) {
      return res.status(400).json({ error: flagResult.error });
    }
      
      
    // Convert width and height to integers
    const parsedWidth = parseInt(width, 10);
    const parsedHeight = parseInt(height, 10);

    // Validate width and height
    if (isNaN(parsedWidth) || isNaN(parsedHeight)) {
      return res.status(400).json({ error: 'Width and height must be valid numbers.' });
    }

    // Calculate token cost based on image size and model
    const tokenCost = calculateTokenCost(parsedWidth, parsedHeight, model);

    // Check if the user has enough tokens
    if (req.user.tokens < tokenCost) {
      return res.status(400).json({ error: 'You do not have enough tokens to generate an image.' });
    }

    // Deduct tokens based on image size and model
    req.user.tokens -= tokenCost;
    await req.user.save();

    // Debugging input parameters
    console.log('Generate Image API Called');
    console.log('Input Parameters:');
    console.log(`Prompt: ${prompt}`);
    console.log(`Width: ${parsedWidth}`);
    console.log(`Height: ${parsedHeight}`);
    console.log(`Guidance Scale: ${guidanceScale}`);
    console.log(`Inference Steps: ${inferenceSteps}`);
    console.log(`Style: ${style}`);
    console.log(`Model: ${model}`);
    console.log(`Public: ${isPublic}`);

    let response;
    let imageData;

    // Determine the correct endpoint and body parameters based on the model
    let endpoint = '';
    let requestBody = {};

    if (model.startsWith('flux')) {
      // Use Flux endpoint
      endpoint = 'https://api.getimg.ai/v1/flux-schnell/text-to-image';
      requestBody = {
        model: model, // "flux-dev" or "flux-schnell"
        prompt,
        width: parsedWidth, // Use parsed integer value
        height: parsedHeight, // Use parsed integer value
        guidance: guidanceScale || 3.5,
        steps: 4, // Flux models generally use lower steps
        output_format: 'jpeg',
        response_format: 'url',
      };
    } else {
      // Use Stable Diffusion XL endpoint
      endpoint = 'https://api.getimg.ai/v1/stable-diffusion-xl/text-to-image';
      requestBody = {
        model: model || 'stable-diffusion-xl-v1-0', // Default to SD XL if no model is specified
        prompt,
        width: parsedWidth, // Use parsed integer value
        height: parsedHeight, // Use parsed integer value
        guidance: guidanceScale || 7.5, // Higher guidance scale for SD XL
        steps: inferenceSteps || 25, // Default to 25 steps for SD XL models
        output_format: 'jpeg',
        response_format: 'url',
      };
    }

    // Log the selected endpoint and request body
    console.log('Selected Endpoint:', endpoint);
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    // Make the API call
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GETIMG_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        console.error('getimg.ai API Error:', errorResponse);
        throw new Error('getimg.ai API failed');
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (data.url) {
        const imageResponse = await fetch(data.url);
        if (!imageResponse.ok) {
          throw new Error('Failed to download the image from getimg.ai');
        }
        imageData = await imageResponse.buffer();
      } else {
        throw new Error('getimg.ai API did not return a valid image URL');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      return res.status(500).json({ error: 'Failed to generate image.' });
    }

    // Save the image to the user's folder
    const userFolderPath = path.join(personalImagesPath, req.user.id.toString());
    const thumbnailsFolderPath = path.join(userFolderPath, 'thumbnails');
    if (!fs.existsSync(thumbnailsFolderPath)) {
      fs.mkdirSync(thumbnailsFolderPath, { recursive: true });
    }

    const fileName = `image_${Date.now()}.jpg`;
    const imagePath = path.join(userFolderPath, fileName);
    const thumbnailPath = path.join(thumbnailsFolderPath, `thumb_${fileName}`);

    // Save the image
    fs.writeFileSync(imagePath, imageData);

    // Generate a thumbnail
    await sharp(imagePath).resize(408).toFile(thumbnailPath);

    const savedImageUrl = `/personal-images/${req.user.id}/${fileName}`;
    const savedThumbnailUrl = `/personal-images/${req.user.id}/thumbnails/thumb_${fileName}`;

    // Save to PersonalImages table
    const newPersonalImage = await PersonalImage.create({
      userId: req.user.id,
      imageUrl: savedImageUrl,
      thumbnailUrl: savedThumbnailUrl,
      prompt,
      style, // Add style to the database
      type: 'ai-generated', // Default to AI-generated
      isPublic: isPublic || false,
    });

    // If public, save to PublicImages table
    if (isPublic) {
      await PublicImage.create({
        userId: req.user.id,
        personalImageId: newPersonalImage.id,
        imageUrl: savedImageUrl,
        thumbnailUrl: savedThumbnailUrl,
        prompt,
        style, // Add style
        type: 'ai-generated',
        likes: 0,
      });
    }

    console.log('Image saved successfully:', savedImageUrl);

    res.json({ imageUrl: savedImageUrl, thumbnailUrl: savedThumbnailUrl, tokensUsed: 1 });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image.' });
  }
});



app.post('/edit-image', ensureAuthenticated, async (req, res) => {
  console.log('Edit Image API called');
  console.log('Request body:', req.body);

  const {
    imagePath,
    prompt,
    strength,
    steps,
    guidance,
    style,
    model,
    keepStyle,
    keepFace,
    keepPose,
    isPublic,
  } = req.body;

  if (!imagePath) {
    console.error('No image path provided');
    return res.status(400).json({ error: 'Image path is required for editing' });
  }
    
    // Modify the prompt to include the style if provided
    const updatedPrompt = style ? `${prompt}, image style: ${style}` : prompt;
    console.log('Updated Prompt:', updatedPrompt);
      
    // Check and flag the prompt
    const flagResult = await checkAndFlagPrompt(req, updatedPrompt, style);
    if (flagResult.flagged) {
      return res.status(400).json({ error: flagResult.error });
    }    

  console.log('Editing image at path:', imagePath);
  console.log('Selected style:', style);
  console.log('Selected model:', model);
  console.log('Keep Style:', keepStyle);
  console.log('Keep Face:', keepFace);
  console.log('Keep Pose:', keepPose);
    
  try {
    

    // Resolve the full file path
    let resolvedImagePath;
    if (imagePath.startsWith('/personal-images/')) {
      resolvedImagePath = path.join(
        personalImagesPath,
        imagePath.replace('/personal-images/', '')
      );
    } else if (imagePath.startsWith('/public-images/')) {
      resolvedImagePath = path.join(
        publicImagesPath,
        imagePath.replace('/public-images/', '')
      );
    } else {
      console.error('Invalid image path provided');
      return res.status(400).json({ error: 'Invalid image path' });
    }

    console.log('Resolved full image path:', resolvedImagePath);

    // Check if the file exists
    if (!fs.existsSync(resolvedImagePath)) {
      console.error('Image file not found at path:', resolvedImagePath);
      return res.status(404).json({ error: 'Image file not found' });
    }

    // Load and convert the image to Base64
    const base64Image = fs.readFileSync(resolvedImagePath, { encoding: 'base64' });

    // Collect all desired adapters
    const adapters = [];
    if (keepFace) adapters.push('face');
    if (keepPose) adapters.push('content');
    if (keepStyle) adapters.push('style');

    // Decide which endpoint to use
    const endpoint = adapters.length
      ? 'https://api.getimg.ai/v1/stable-diffusion-xl/ip-adapter' // IP Adapter API
      : 'https://api.getimg.ai/v1/stable-diffusion-xl/image-to-image'; // Standard Image-to-Image

    console.log('Selected API Endpoint:', endpoint);
    console.log('Selected Control Net Adapters:', adapters);

    // Create a base payload object (without "adapter")
    const basePayload = {
      model: model || 'stable-diffusion-xl-v1-0', // Use model from request or default
      prompt: updatedPrompt,
      negative_prompt: 'disfigured, blurry',
      image: base64Image,
      strength: strength || 0.3,
      steps: steps || 50,
      guidance: guidance || 10,
      output_format: 'jpeg',
      response_format: 'url',
      scheduler: 'euler',
    };

    // Convert the basePayload to a JSON string, then inject repeated "adapter" lines if needed
    let finalPayloadString = JSON.stringify(basePayload, null, 2);

    if (adapters.length > 0) {
      // Remove the very last "}" from the JSON string
      finalPayloadString = finalPayloadString.replace(/\}\s*$/, '');

      // Insert a comma if the JSON isn't empty (it won't be)
      finalPayloadString += ',\n';

      // For each adapter, add a separate line:  "adapter": "face"
      const adapterLines = adapters
        .map((adapterValue) => `  "adapter": "${adapterValue}"`)
        .join(',\n');

      // Now add those lines and close off the JSON object
      finalPayloadString += adapterLines + '\n}';
    }

    console.log('API Request Payload (string):', finalPayloadString);

    // Make the request to getimg.ai
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.GETIMG_API_KEY}`,
      },
      body: finalPayloadString, // Send the custom-built JSON string
    };

    const response = await fetch(endpoint, options);
    const data = await response.json();

    console.log('Response from getimg.ai:', JSON.stringify(data, null, 2));

    if (!response.ok || !data.url) {
      console.error('Error editing image:', data);
      throw new Error(data.error || 'Failed to edit image');
    }

    // Download the resulting image from the returned URL
    const editedImageResponse = await fetch(data.url);
    if (!editedImageResponse.ok) {
      throw new Error('Failed to download the edited image from getimg.ai');
    }
    const editedImageData = await editedImageResponse.buffer();

    // Save the edited image to the user's personal folder
    const userFolderPath = path.join(personalImagesPath, req.user.id.toString());
    const thumbnailsFolderPath = path.join(userFolderPath, 'thumbnails');

    if (!fs.existsSync(thumbnailsFolderPath)) {
      fs.mkdirSync(thumbnailsFolderPath, { recursive: true });
    }

    const fileName = `edited_image_${Date.now()}.jpg`;
    const savedImagePath = path.join(userFolderPath, fileName);
    const thumbnailPath = path.join(thumbnailsFolderPath, `thumb_${fileName}`);

    // Save the edited image
    fs.writeFileSync(savedImagePath, editedImageData);

    // Generate a thumbnail
    await sharp(savedImagePath).resize(408).toFile(thumbnailPath);

    const savedImageUrl = `/personal-images/${req.user.id}/${fileName}`;
    const savedThumbnailUrl = `/personal-images/${req.user.id}/thumbnails/thumb_${fileName}`;

    // Save to PersonalImages table
    const newPersonalImage = await PersonalImage.create({
      userId: req.user.id,
      imageUrl: savedImageUrl,
      thumbnailUrl: savedThumbnailUrl,
      prompt,
      style,
      type: 'stylized-photo',
      isPublic: isPublic || false,
    });

    // If public, also save to PublicImages table
    if (isPublic) {
      await PublicImage.create({
        userId: req.user.id,
        personalImageId: newPersonalImage.id,
        imageUrl: savedImageUrl,
        thumbnailUrl: savedThumbnailUrl,
        prompt,
        style,
        type: 'stylized-photo',
        likes: 0,
      });
    }

    // Respond to the client
    res.json({ imageUrl: savedImageUrl, thumbnailUrl: savedThumbnailUrl, tokensUsed: 1 });
  } catch (error) {
    console.error('Error in /edit-image:', error);
    res.status(500).json({ error: error.message || 'Failed to edit image' });
  }
});



/*
app.post('/generate-image', ensureAuthenticated, async (req, res) => {
  try {
    if (req.user.tokens <= 0) {
      return res.status(400).json({ error: 'You do not have enough tokens to generate an image.' });
    }

    const { prompt, width, height, guidanceScale, inferenceSteps, isPublic } = req.body;

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
      throw new Error('Failed to fetch the image from the external API');
    }

    const buffer = await response.arrayBuffer();
    const imageData = Buffer.from(buffer);

    req.user.tokens -= 1;
    await req.user.save();

    const userFolderPath = path.join(personalImagesPath, req.user.id.toString());
    const thumbnailsFolderPath = path.join(userFolderPath, 'thumbnails');

    if (!fs.existsSync(thumbnailsFolderPath)) {
      fs.mkdirSync(thumbnailsFolderPath, { recursive: true });
    }

    const fileName = `image_${Date.now()}.jpg`;
    const imagePath = path.join(userFolderPath, fileName);
    const thumbnailPath = path.join(thumbnailsFolderPath, `thumb_${fileName}`);

    fs.writeFileSync(imagePath, imageData);

    await sharp(imagePath).resize(408).toFile(thumbnailPath);

    const imageUrl = `/personal-images/${req.user.id}/${fileName}`;
    const thumbnailUrl = `/personal-images/${req.user.id}/thumbnails/thumb_${fileName}`;

    const newPersonalImage = await PersonalImage.create({
      userId: req.user.id,
      imageUrl,
      thumbnailUrl,
      prompt,
      isPublic: isPublic || false,
    });

if (isPublic) {
  const validTypes = ['ai-generated', 'user-uploaded', 'stylized-photo'];
  const imageType = personalImage.type ? personalImage.type.toLowerCase() : 'ai-generated'; // Default to 'ai-generated'
  const finalType = validTypes.includes(imageType) ? imageType : 'ai-generated'; // Fallback to a valid type if necessary

  console.log('PublicImage type being inserted:', finalType);

  await PublicImage.create({
    imageUrl: personalImage.imageUrl,
    thumbnailUrl: personalImage.thumbnailUrl,
    title: personalImage.title || personalImage.prompt,
    description: personalImage.description || '',
    prompt: personalImage.prompt,
    userId: personalImage.userId,
    personalImageId: personalImage.id,
    likes: 0,
    type: finalType, // Ensure consistent ENUM value
  });
}



    res.json({ imageUrl, thumbnailUrl, tokensUsed: 1 });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});
*/


app.post('/api/like/:publicImageId', ensureAuthenticated, async (req, res) => {
  try {
    const { publicImageId } = req.params;
    const { liked } = req.body;

    console.log(`[DEBUG] Toggling like for Public Image ID: ${publicImageId}, liked: ${liked}, userId: ${req.user.id}`);

    if (typeof liked !== 'boolean') {
      return res.status(400).json({ error: '"liked" must be a boolean.' });
    }

    // 1. Look up the PublicImage
    const image = await PublicImage.findByPk(publicImageId);
    if (!image) {
      console.error(`[ERROR] Public image ID ${publicImageId} not found.`);
      return res.status(404).json({ error: 'Public image not found.' });
    }

    // 2. Extract the personalImageId from the public image
    const personalImageId = image.personalImageId;
    if (!personalImageId) {
      return res.status(400).json({ error: 'This public image is not linked to a personal image.' });
    }

    // 3. Check if user already liked this personal image
    const alreadyLiked = await db.Like.findOne({
      where: { userId: req.user.id, personalImageId },
    });

    // 4. Adjust the 'likes' count on the PublicImage
    if (liked) {
      if (!alreadyLiked) {
        // Like the image
        image.likes = (image.likes || 0) + 1;
        await db.Like.create({ userId: req.user.id, personalImageId });
      }
    } else {
      if (alreadyLiked) {
        // Unlike the image
        image.likes = Math.max((image.likes || 0) - 1, 0);
        await alreadyLiked.destroy();
      }
    }

    await image.save(); // Save updated likes count on the public image

    console.log(`[DEBUG] likes updated successfully for Public Image ID ${publicImageId}, new likes: ${image.likes}`);
    res.json({ likes: image.likes, liked });
  } catch (error) {
    console.error('[ERROR] Failed to toggle like:', error);
    res.status(500).json({ error: 'Failed to toggle like.' });
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







app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user });
});


app.get('/personal-images', ensureAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const images = await PersonalImage.findAll({
      where: { userId: req.user.id },
      attributes: [
        'id',
        'imageUrl',
        'thumbnailUrl',
        'title',
        'description',
        'prompt',
        'likes',
        'isPublic', // Add this line to include the isPublic attribute
        [
          sequelize.literal(`EXISTS (SELECT 1 FROM likes WHERE likes.personalImageId = PersonalImage.id AND likes.userId = ${req.user.id})`),
          'likedByUser',
        ],
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']], // Order by newest first
    });

    const totalImages = await PersonalImage.count({ where: { userId: req.user.id } });
    const hasMore = offset + limit < totalImages;

    res.json({ images, hasMore });
  } catch (error) {
    console.error('Error fetching personal images:', error);
    res.status(500).json({ error: 'Failed to fetch personal images' });
  }
});


app.get('/api/public-posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { type, style, sort } = req.query;

    console.log(`Loading public posts of type: ${type}, style: ${style}, sort: ${sort}`);

    const where = {};
    if (type && type !== 'undefined') {
      if (type === 'ai-generated') {
        // Include both 'ai-generated' and 'stylized-photo' under one filter
        where.type = { [Op.in]: ['ai-generated', 'stylized-photo'] };
      } else {
        where.type = type;
      }
    }

    if (style && style !== 'all-styles' && style !== 'undefined') {
      where.style = style;
    }

    const order = [];
    if (sort === 'most-liked') {
      order.push(['likes', 'DESC']);
    } else if (sort === 'newest') {
      order.push(['createdAt', 'DESC']);
    }

    const publicImages = await PublicImage.findAll({
      where,
      offset,
      limit,
      order,
      attributes: [
        'id',
        'imageUrl',
        'thumbnailUrl',
        'title',
        'description',
        'prompt',
        'likes',
        [
          sequelize.literal(`EXISTS (SELECT 1 FROM likes WHERE likes.personalImageId = PublicImage.personalImageId AND likes.userId = ${req.user ? req.user.id : 0})`),
          'likedByUser',
        ],
      ],
    });

    //console.log('Public Images:', JSON.stringify(publicImages, null, 2)); // Debugging

    const totalImages = await PublicImage.count({ where });
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

    console.log(`[DEBUG] Fetching details for Image ID: ${imageId}`);

    // Attempt to find the image in PublicImage
    let image = await PublicImage.findByPk(imageId, {
      attributes: [
        'id',
        'imageUrl',
        'thumbnailUrl',
        'title',
        'description',
        'prompt',
        'userId',
        'personalImageId',
        'createdAt',
        'updatedAt',
        'likes' // Explicitly include the likes field
      ],
      include: [{ model: User, as: 'user', attributes: ['username'] }],
    });

    if (image) {
      console.log(`[DEBUG] Found image in PublicImage:`, image.toJSON());
      return res.json({
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        likes: image.likes || 0, // Include likes count  
        prompt: image.prompt,
        username: image.user?.username || 'Unknown User',
        userId: image.userId,
        isPublic: true,
      });
    } else {
      console.log(`[DEBUG] Image ID ${imageId} not found in PublicImage, checking PersonalImage.`);
      image = await PersonalImage.findByPk(imageId, {
        attributes: [
          'id',
          'imageUrl',
          'thumbnailUrl',
          'title',
          'description',
          'prompt',
          'userId',
          'createdAt',
          'updatedAt',
          'likes' // Include likes for PersonalImage too
        ],
        include: [{ model: User, as: 'user', attributes: ['username'] }],
      });

      if (image) {
        console.log(`[DEBUG] Found image in PersonalImage:`, image.toJSON());
        return res.json({
          imageUrl: image.imageUrl,
          thumbnailUrl: image.thumbnailUrl,
          prompt: image.prompt,
          likes: image.likes || 0, // Include likes count
          username: image.user?.username || 'Unknown User',
          userId: image.userId,
          isPublic: image.isPublic,
        });
      }
    }

    console.error(`[ERROR] Image ID ${imageId} not found in both PublicImage and PersonalImage tables.`);
    res.status(404).json({ error: 'Image not found' });
  } catch (error) {
    console.error(`[ERROR] Failed to fetch details for Image ID: ${imageId}`, error);
    res.status(500).json({ error: 'Failed to fetch image details.' });
  }
});




app.put('/update-image-visibility/:id', ensureAuthenticated, async (req, res) => {
    
  console.log("update-image-visibility" );  
    
  try {
    const imageId = req.params.id;
    const image = await PersonalImage.findByPk(imageId);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
      
    

    // If the image is being made public, perform additional checks
    if (!image.isPublic) {
        
      console.log("If the image is being made public, perform additional checks");
        
      // Check for flagged keywords in the prompt
      const containsNudity = nudityKeywords.some(keyword => image.prompt.toLowerCase().includes(keyword));
      if (containsNudity) {
        return res.status(400).json({ error: 'This image cannot be made public due to inappropriate content.' });
      }

      // Perform content safety check using Azure Content Safety API
      const resolvedImagePath = path.join(personalImagesPath, req.user.id.toString(), path.basename(image.imageUrl));

      console.log("resolvedImagePath:"+resolvedImagePath);
        
    
      if (!fs.existsSync(resolvedImagePath)) {
          
        console.log("Image file not found" );  
        return res.status(404).json({ error: 'Image file not found' });
      }

      const imageBuffer = fs.readFileSync(resolvedImagePath);

          
      // Analyze the image using the Content Safety API
      const detectionResult = await contentSafety.detect(MediaType.Image, imageBuffer);

      // Make a decision based on the detection result
      const decisionResult = contentSafety.makeDecision(detectionResult, {
        [Category.Hate]: 6,
        [Category.SelfHarm]: 6,
        [Category.Sexual]: 6,
        [Category.Violence]: 6,
      });

      // If the image is flagged as inappropriate, reject it
      if (decisionResult.suggestedAction === Action.Reject) {
        return res.status(400).json({ error: 'This image cannot be made public due to inappropriate content.' });
      }
      
    }

    // Toggle the visibility
    image.isPublic = !image.isPublic;
    await image.save();

    // Handle public image creation or update
    if (image.isPublic) {
      let publicImage = await PublicImage.findOne({ where: { personalImageId: imageId } });
      if (!publicImage) {
        const validTypes = ['ai-generated', 'user-uploaded', 'stylized-photo'];
        const type = validTypes.includes(image.type) ? image.type : 'ai-generated';

        publicImage = await PublicImage.create({
          personalImageId: imageId,
          imageUrl: image.imageUrl,
          thumbnailUrl: image.thumbnailUrl,
          title: image.title || 'Untitled',
          description: image.description || '',
          prompt: image.prompt,
          userId: image.userId,
          type,
          style: image.style || null,
        });
      } else {
        publicImage.imageUrl = image.imageUrl;
        publicImage.thumbnailUrl = image.thumbnailUrl;
        publicImage.title = image.title || 'Untitled';
        publicImage.description = image.description || '';
        publicImage.prompt = image.prompt;
        publicImage.type = image.type || 'ai-generated';
        publicImage.style = image.style || null;
        await publicImage.save();
      }
    } else {
      // If the image is being made private, remove it from the public images table
      await PublicImage.destroy({ where: { personalImageId: imageId } });
    }

    res.json({ message: 'Image visibility updated successfully', isPublic: image.isPublic });
  } catch (error) {
    console.error('Error updating image visibility:', error.message); // Add detailed logging
    console.error(error.stack); // Log the full stack trace for debugging
    res.status(500).json({ error: 'Failed to update image visibility' });
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



app.get('/api/private-posts', ensureAuthenticated, async (req, res) => {
  try {
    const privateImages = await PersonalImage.findAll({ where: { userId: req.user.id } });
    res.json(privateImages);
  } catch (error) {
    console.error('Error loading private posts:', error);
    res.status(500).json({ error: 'Failed to load private posts' }); // Ensure JSON response on error
  }
});






app.get('/user-profile/:id', (req, res) => {
  const userId = req.params.id;
  res.render('index', { showProfile: true, profileUserId: userId });
});


// Catch-all route
// Catch-all route for serving the frontend (only for GET requests)
app.get('*', (req, res, next) => {
    
    
  if (req.originalUrl.startsWith('/webhook') ||  req.originalUrl.startsWith('/test-update-tokens') ) {
    return next(); // Pass through for webhook
  }

  if (req.originalUrl.startsWith('/admin')) {
    return next(); // Pass through to the admin route handler
  }

  if (req.originalUrl.startsWith('/api/')) {
    return next(); // Pass through for API routes
  }

  res.render('index'); // Serve the frontend for all other routes
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








app.post('/upload-image', ensureAuthenticated, upload.single('image'), async (req, res) => {
  console.log('[DEBUG] Received upload request:', req.body); // Log the parsed body
  console.log('[DEBUG] File uploaded:', req.file); // Log the uploaded file

  const description = req.body.description || ''; // Safeguard for missing description

  if (!description.trim()) {
    console.log('[DEBUG] No description!!');
    return res.status(400).json({ error: 'Description (prompt) is required.' });
  }

  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userFolderPath = path.join(personalImagesPath, userId.toString());
    const thumbnailsFolderPath = path.join(userFolderPath, 'thumbnails');

    if (!fs.existsSync(thumbnailsFolderPath)) {
      fs.mkdirSync(thumbnailsFolderPath, { recursive: true });
    }

    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = path.join(userFolderPath, fileName);
    fs.renameSync(file.path, filePath);

    const thumbnailName = `thumb_${fileName}`;
    const thumbnailPath = path.join(thumbnailsFolderPath, thumbnailName);

    await sharp(filePath).resize(308).toFile(thumbnailPath);

    const imageUrl = `/personal-images/${userId}/${fileName}`;
    const thumbnailUrl = `/personal-images/${userId}/thumbnails/${thumbnailName}`;

    console.log('[DEBUG] Saving with data:', {
      userId,
      imageUrl,
      thumbnailUrl,
      prompt: description,
    });

    const newImage = await PersonalImage.create({
        userId,
        imageUrl,
        thumbnailUrl,
        prompt: description,
        type: 'user-uploaded', // <--- set it explicitly for uploads
      });

    res.status(200).json({ message: 'Image uploaded successfully!', image: newImage });
  } catch (error) {
    console.error('[ERROR] Upload handler failed:', error);
    res.status(500).json({ error: 'Image upload failed.' });
  }
});




app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    const type = req.query.type || 'ai-generated';
    const style = req.query.style || 'all-styles';
    const sort = req.query.sort || 'newest';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const where = {};

    // Add search query to the filters
    if (query) {
      where[Op.or] = [
        { title: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { prompt: { [Op.like]: `%${query}%` } },
      ];
    }

    // Add style filter
    if (style !== 'all-styles') {
      where.style = style;
    }

    // Add type filter
    if (type !== 'all') {
      where.type = type;
    }

    const order = [];
    if (sort === 'most-liked') {
      order.push(['likes', 'DESC']);
    } else {
      order.push(['createdAt', 'DESC']);
    }

    const results = await PublicImage.findAll({
      where,
      offset,
      limit,
      order,
    });

    const totalResults = await PublicImage.count({ where });
    const hasMore = offset + limit < totalResults;

    res.json({ images: results, hasMore }); // Respond with JSON
  } catch (error) {
    console.error('Error during search:', error.stack);
    res.status(500).json({ error: 'Failed to perform search.' }); // Respond with JSON error
  }
});



// Middleware to check if the user is an admin
function ensureAdmin(req, res, next) {
  console.log('User object in ensureAdmin:', req.user); // Debug log
  console.log('req.user.dataValues.isAdmin:', req.user.dataValues.isAdmin); // Access isAdmin from dataValues

  if (req.isAuthenticated() && (req.user.dataValues.isAdmin === 1 || req.user.dataValues.isAdmin === true)) {
    console.log("Running next.."); // Debug log
    return next(); // User is authenticated and is an admin
  }
  res.status(403).json({ error: 'Unauthorized' }); // Deny access
}



app.get('/admin', ensureAdmin, async (req, res) => {
  try {
    // Extract query parameters
    const sortBy = req.query.sortBy || 'flagCount'; // Default sort by flagCount
    const order = req.query.order || 'DESC'; // Default order is DESC
    const page = parseInt(req.query.page) || 1; // Default page is 1
    const limit = 50; // Number of users per page
    const offset = (page - 1) * limit; // Calculate offset for pagination

    // Validate sortBy and order to prevent SQL injection
    const validSortColumns = ['tokens', 'createdAt', 'totalImages', 'publicImages', 'privateImages', 'flagCount'];
    const validOrder = ['ASC', 'DESC'];

    if (!validSortColumns.includes(sortBy) || !validOrder.includes(order.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid sort parameters' });
    }

    // Fetch users with sorting and pagination
    const users = await User.findAll({
      attributes: [
        'id',
        'username',
        'email',
        'tokens',
        'flagCount',
        'createdAt',
        [
          sequelize.literal('(SELECT COUNT(*) FROM personalimages WHERE personalimages.userId = User.id)'),
          'totalImages',
        ],
        [
          sequelize.literal('(SELECT COUNT(*) FROM personalimages WHERE personalimages.userId = User.id AND personalimages.isPublic = 1)'),
          'publicImages',
        ],
        [
          sequelize.literal('(SELECT COUNT(*) FROM personalimages WHERE personalimages.userId = User.id AND personalimages.isPublic = 0)'),
          'privateImages',
        ],
      ],
      include: [
        {
          model: PersonalImage,
          as: 'personalImages',
          attributes: ['id', 'thumbnailUrl'],
          limit: 3,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [[sortBy, order]], // Dynamic sorting
      limit: limit, // Limit the number of users per page
      offset: offset, // Pagination offset
    });

    // Fetch the total number of users for pagination
    const totalUsers = await User.count();
    const totalPages = Math.ceil(totalUsers / limit);

    // Fetch the API balance
    const apiBalance = await getApiBalance();

    res.render('admin', {
      users,
      apiBalance,
      sortBy,
      order,
      page,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching admin data:', error);
    res.status(500).json({ error: 'Failed to fetch admin data' });
  }
});




async function getApiBalance() {
  try {
    const response = await axios.get('https://api.getimg.ai/v1/account/balance', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer key-3YrgJB7Jb4KDgwPdUpWvyUGn41hbImYvjE0f2LJW8dbm18T9oJ36pXAtDsjILaGfo27foxvhsoW4oOEwZ2kbRCtKI8V6zSh3',
      },
    });

    console.log('API Response:', response.data); // Log the full response
    return response.data.amount || 0; // Use "amount" instead of "balance"
  } catch (error) {
    console.error('Error fetching API balance:', error.response ? error.response.data : error.message);
    throw error;
  }
}

app.get('/admin/api-balance', ensureAdmin, async (req, res) => {
  try {
    const url = 'https://api.getimg.ai/v1/account/balance';
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer key-3YrgJB7Jb4KDgwPdUpWvyUGn41hbImYvjE0f2LJW8dbm18T9oJ36pXAtDsjILaGfo27foxvhsoW4oOEwZ2kbRCtKI8V6zSh3',
      },
    };

    const response = await fetch(url, options);
    const data = await response.json();
    res.json(data); // Return the balance data as JSON
  } catch (error) {
    console.error('Error fetching API balance:', error);
    res.status(500).json({ error: 'Failed to fetch API balance' });
  }
});

app.get('/admin/user/:id/images', ensureAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch the user's details
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the user's images
    const images = await PersonalImage.findAll({
      where: { userId },
      attributes: ['id', 'thumbnailUrl', 'imageUrl', 'prompt', 'isPublic', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    res.render('user-images', {
      user,
      images,
    });
  } catch (error) {
    console.error('Error fetching user images:', error);
    res.status(500).json({ error: 'Failed to fetch user images' });
  }
});





/*

// Route to fetch token balance (proxy to crypto service)
app.get("/balance/:address", async (req, res) => {
  try {
    const response = await axios.get(`http://localhost:4000/balance/${req.params.address}`);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching balance from crypto service:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Route to withdraw tokens (proxy to crypto service)
app.post("/withdraw", async (req, res) => {
  try {
    const response = await axios.post("http://localhost:4000/withdraw", req.body);
    res.json(response.data);
  } catch (error) {
    console.error("Error withdrawing tokens via crypto service:", error);
    res.status(500).json({ error: "Failed to withdraw tokens" });
  }
});
*/



