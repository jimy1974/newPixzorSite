document.getElementById('generate-button').addEventListener('click', async () => {
  // Collect the input values
  const prompt = document.getElementById('prompt-input').value;
  const aspectRatio = document.getElementById('aspect-ratio')?.value || '16:9';
  const guidanceScale = parseFloat(document.getElementById('guidance-scale')?.value) || 3.5;
  const numInferenceSteps = parseInt(document.getElementById('inference-steps')?.value) || 4;

  try {
    // Send a POST request to the server
    const response = await fetch('/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        aspectRatio,
        guidanceScale,
        numInferenceSteps
      })
    });

    if (response.ok) {
      // Receive the image as a Blob
      const blob = await response.blob();

      // Create a local URL for the image blob
      const imageUrl = URL.createObjectURL(blob);

      // Display the image
      const generatedImageDiv = document.getElementById('generated-image');
      generatedImageDiv.innerHTML = ''; // Clear previous content
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = 'Generated Image';
      img.classList.add('w-full', 'h-full', 'object-contain');
      generatedImageDiv.appendChild(img);
    } else {
      console.error('Server response was not OK.');
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('Error generating image:', error);
  }
});
