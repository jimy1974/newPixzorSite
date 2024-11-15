// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const fetch = require('cross-fetch');

const app = express();
const PORT = 3000;

// Set up the view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public')); 
app.use(express.json());

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio, guidanceScale, numInferenceSteps } = req.body;

    const response = await fetch('https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/jpeg',
        'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: aspectRatio,
        guidance_scale: guidanceScale,
        num_inference_steps: numInferenceSteps
      })
    });

    const buffer = await response.arrayBuffer();
    const imageData = Buffer.from(buffer);

    res.set('Content-Type', 'image/jpeg');
    res.send(imageData);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
