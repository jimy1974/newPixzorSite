// script.js

document.addEventListener('DOMContentLoaded', () => {
  // Modal Elements
  const modals = {
    'options-modal': document.getElementById('options-modal'),
    'setup-character-modal': document.getElementById('setup-character-modal'),
    'buy-tokens-modal': document.getElementById('buy-tokens-modal'),
  };

  // Function to open a modal
  function openModal(modalId) {
    if (modals[modalId]) {
      modals[modalId].classList.remove('hidden');
      document.body.classList.add('overflow-hidden'); // Prevent background scrolling
    }
  }

  // Function to close a modal
  function closeModal(modalId) {
    if (modals[modalId]) {
      modals[modalId].classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  // Event Listeners for Opening Modals
  document.getElementById('options-button').addEventListener('click', () => openModal('options-modal'));
  document.getElementById('setup-character-button').addEventListener('click', () => openModal('setup-character-modal'));
  document.getElementById('tokens-button').addEventListener('click', () => openModal('buy-tokens-modal'));

  // Event Listeners for Closing Modals
  document.querySelectorAll('[id^="close-"]').forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.id.replace('close-', '');
      closeModal(modalId);
    });
  });

  // Close any open modals when clicking inside the prompt box
  document.getElementById('prompt-input').addEventListener('focus', () => {
    for (let modal in modals) {
      if (!modals[modal].classList.contains('hidden')) {
        closeModal(modal);
      }
    }
  });

  // Handle Options Form Submission
  document.getElementById('options-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const style = document.getElementById('style-select-modal').value;
    const aspectRatio = document.getElementById('aspect-ratio-modal').value;
    const guidanceScale = document.getElementById('guidance-scale-modal').value;
    const inferenceSteps = document.getElementById('inference-steps-modal').value;

    // Save options to LocalStorage
    const options = {
      style,
      aspectRatio,
      guidanceScale,
      inferenceSteps,
    };

    localStorage.setItem('options', JSON.stringify(options));

    // Close the Options Modal
    closeModal('options-modal');
  });

  // Handle Setup Character Form Submission
  document.getElementById('setup-character-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('character-name').value.trim();
    const description = document.getElementById('character-description').value.trim();
    const faceUpload = document.getElementById('face-upload-character').files[0];

    if (name && description) {
      // Save to LocalStorage
      let characters = JSON.parse(localStorage.getItem('characters')) || [];
      characters.push({ name, description, faceUpload: faceUpload ? faceUpload.name : null });
      localStorage.setItem('characters', JSON.stringify(characters));

      // Update Character Dropdown
      populateCharacterDropdown();

      // Clear the form
      document.getElementById('setup-character-form').reset();

      // Close Modal
      closeModal('setup-character-modal');
    } else {
      alert('Please fill in all fields.');
    }
  });

  // Populate Character Dropdown
  function populateCharacterDropdown() {
    const characterSelect = document.getElementById('character-select');
    characterSelect.innerHTML = '<option value="" disabled selected>Select Character</option>'; // Reset options

    const characters = JSON.parse(localStorage.getItem('characters')) || [];
    characters.forEach((char, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = char.name;
      characterSelect.appendChild(option);
    });
  }

  // Initialize Character Dropdown on Page Load
  populateCharacterDropdown();

  // Handle Enhance Prompt Button Click
  document.getElementById('enhance-prompt-button').addEventListener('click', async () => {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
      alert('Please enter a prompt to enhance.');
      return;
    }

    try {
      // Show loading state
      const enhanceButton = document.getElementById('enhance-prompt-button');
      enhanceButton.textContent = 'Enhancing...';
      enhanceButton.disabled = true;

      // Send prompt to backend for enhancement
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      if (data.enhancedPrompt) {
        document.getElementById('prompt-input').value = data.enhancedPrompt;
      } else {
        alert('Failed to enhance the prompt.');
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      alert('An error occurred while enhancing the prompt.');
    } finally {
      // Reset button state
      const enhanceButton = document.getElementById('enhance-prompt-button');
      enhanceButton.textContent = 'Enhance Prompt';
      enhanceButton.disabled = false;
    }
  });

  // Handle Generate Image Button Click
  document.getElementById('generate-button').addEventListener('click', async () => {
    const prompt = document.getElementById('prompt-input').value.trim();
    const characterIndex = document.getElementById('character-select').value;
    const options = JSON.parse(localStorage.getItem('options')) || {};
    const dimensions = JSON.parse(localStorage.getItem('imageDimensions')) || { width: 800, height: 600 };
    const style = options.style || '';

    // Check Token Availability
    let currentTokens = parseInt(document.getElementById('token-count').textContent.replace('Tokens: ', '')) || 0;
    if (currentTokens <= 0) {
      alert('You have no tokens left. Please buy more tokens to generate images.');
      return;
    }

    if (!prompt) {
      alert('Please enter a prompt.');
      return;
    }

    let finalPrompt = prompt;

    // Append character description if a character is selected
    if (characterIndex !== "") {
      const characters = JSON.parse(localStorage.getItem('characters')) || [];
      const selectedCharacter = characters[characterIndex];
      if (selectedCharacter) {
        finalPrompt = `${selectedCharacter.description}. ${prompt}`;
      }
    }

    // Append style if selected
    if (style) {
      finalPrompt = `${finalPrompt} Style: ${style}.`;
    }

    try {
      // Show loading state
      const generateButton = document.getElementById('generate-button');
      generateButton.textContent = 'Generating...';
      generateButton.disabled = true;

      // Send data to backend for image generation
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          width: dimensions.width,
          height: dimensions.height,
          guidanceScale: options.guidanceScale || 3.5,
          inferenceSteps: options.inferenceSteps || 4
        })
      });

      const data = await response.json();
      if (response.ok && data.imageUrl) {
        const generatedImages = document.getElementById('generated-images');
        generatedImages.innerHTML = ''; // Clear previous images

        const imgElement = document.createElement('img');
        imgElement.src = data.imageUrl;
        imgElement.alt = 'Generated Image';
        imgElement.classList.add('w-full', 'h-auto', 'object-cover', 'rounded-lg');

        // Optional: Add sociable features like dialogs on each image
        imgElement.addEventListener('click', () => {
          // Implement dialog features here
          alert('Image clicked! Implement sociable features as needed.');
        });

        generatedImages.appendChild(imgElement);
        document.getElementById('error-message').textContent = '';

        // Update Tokens Count in Navbar
        updateTokenCount(data.tokensUsed); // Subtract tokens used
      } else {
        document.getElementById('error-message').textContent = data.error || 'Failed to generate image.';
      }
    } catch (error) {
      console.error('Error generating image:', error);
      document.getElementById('error-message').textContent = 'An error occurred while generating the image.';
    } finally {
      // Reset button state
      const generateButton = document.getElementById('generate-button');
      generateButton.textContent = 'Generate Image';
      generateButton.disabled = false;
    }
  });

  // Function to update the token count in the navbar
  function updateTokenCount(tokensUsed) {
    const tokenCountElement = document.getElementById('token-count');
    if (tokenCountElement) {
      let currentTokens = parseInt(tokenCountElement.textContent.replace('Tokens: ', '')) || 0;
      currentTokens -= tokensUsed;
      if (currentTokens < 0) currentTokens = 0; // Prevent negative tokens
      tokenCountElement.textContent = `Tokens: ${currentTokens}`;
      // Optionally, update the backend as well
    }
  }

  // Handle Public/Private Toggle
  document.getElementById('public-toggle').addEventListener('click', () => {
    // Toggle button styles
    document.getElementById('public-toggle').classList.add('selected-toggle');
    document.getElementById('private-toggle').classList.remove('selected-toggle');

    // Load public posts
    loadPublicPosts();
  });

  document.getElementById('private-toggle').addEventListener('click', () => {
    // Toggle button styles
    document.getElementById('private-toggle').classList.add('selected-toggle');
    document.getElementById('public-toggle').classList.remove('selected-toggle');

    // Load private posts
    loadPrivatePosts();
  });

  // Function to load public posts
  async function loadPublicPosts() {
    try {
      const response = await fetch('/api/public-posts');
      const data = await response.json();

      if (response.ok) {
        const generatedImages = document.getElementById('generated-images');
        generatedImages.innerHTML = ''; // Clear previous images

        if (data.images && data.images.length > 0) {
          data.images.forEach(imgUrl => {
            const imgElement = document.createElement('img');
            imgElement.src = imgUrl;
            imgElement.alt = 'Public Image';
            imgElement.classList.add('w-full', 'h-auto', 'object-cover', 'rounded-lg', 'cursor-pointer');

            // Optional: Add sociable features like dialogs on each image
            imgElement.addEventListener('click', () => {
              // Implement dialog features here
              alert('Image clicked! Implement sociable features as needed.');
            });

            generatedImages.appendChild(imgElement);
          });
        } else {
          generatedImages.innerHTML = '<p class="text-gray-400">No public images available.</p>';
        }
      } else {
        alert(data.error || 'Failed to load public posts.');
      }
    } catch (error) {
      console.error('Error loading public posts:', error);
      alert('An error occurred while loading public posts.');
    }
  }

  // Function to load private posts
  async function loadPrivatePosts() {
    try {
      const response = await fetch('/api/private-posts');
      const data = await response.json();

      if (response.ok) {
        const generatedImages = document.getElementById('generated-images');
        generatedImages.innerHTML = ''; // Clear previous images

        if (data.images && data.images.length > 0) {
          data.images.forEach(imgUrl => {
            const imgElement = document.createElement('img');
            imgElement.src = imgUrl;
            imgElement.alt = 'Private Image';
            imgElement.classList.add('w-full', 'h-auto', 'object-cover', 'rounded-lg', 'cursor-pointer');

            // Optional: Add sociable features like dialogs on each image
            imgElement.addEventListener('click', () => {
              // Implement dialog features here
              alert('Image clicked! Implement sociable features as needed.');
            });

            generatedImages.appendChild(imgElement);
          });
        } else {
          generatedImages.innerHTML = '<p class="text-gray-400">No private images available.</p>';
        }
      } else {
        alert(data.error || 'Failed to load private posts.');
      }
    } catch (error) {
      console.error('Error loading private posts:', error);
      alert('An error occurred while loading private posts.');
    }
  }

document.addEventListener('DOMContentLoaded', () => {
  handleAuthButtons();
});

// Function to manage authentication buttons based on user status
function handleAuthButtons() {
  const authButtonsContainer = document.getElementById('auth-buttons');
  const tokenCountElement = document.getElementById('token-count');
  const user = JSON.parse(localStorage.getItem('user')) || null;

  if (user) {
    // User is logged in
    authButtonsContainer.innerHTML = `
      <a href="#" id="logout-button" class="text-blue-400 hover:text-blue-600 flex items-center">
        <img src="https://img.icons8.com/ios-filled/24/ffffff/google-logo.png" alt="Logout" class="mr-1" />
        Logout
      </a>
    `;

    document.getElementById('logout-button').addEventListener('click', (e) => {
      e.preventDefault();
      // Simulate logout
      localStorage.removeItem('user');
      handleAuthButtons(); // Refresh the buttons
      // Reset token count
      tokenCountElement.textContent = 'Tokens: 0';
    });

    // Display the user's token count
    tokenCountElement.textContent = `Tokens: ${user.tokens || 0}`;

    // Add event listener to the tokens button for opening a purchase modal
    document.getElementById('tokens-button').addEventListener('click', () => {
      openModal('buy-tokens-modal');
    });

  } else {
    // User is not logged in
    authButtonsContainer.innerHTML = `
      <button id="google-auth-button" class="flex items-center bg-gray-700 hover:bg-green-600 px-4 py-2 rounded-lg">
        <img src="https://img.icons8.com/ios-filled/24/ffffff/google-logo.png" alt="Google" class="mr-2" />
        <span>Login / Register</span>
      </button>
    `;

    document.getElementById('google-auth-button').addEventListener('click', () => {
      // Redirect to Google OAuth endpoint
      window.location.href = '/auth/google';
    });

    // Disable the tokens button since the user isn't logged in
    tokenCountElement.textContent = 'Tokens: 0';
    document.getElementById('tokens-button').removeEventListener('click', () => {});
  }
}




 

  // Handle Buy Tokens Selection
  document.querySelectorAll('.select-token-button').forEach(button => {
    button.addEventListener('click', async () => {
      const tokens = parseInt(button.getAttribute('data-tokens'));
      const price = parseFloat(button.getAttribute('data-price'));

      try {
        if (tokens === 0) {
          alert('The Free package offers 0 tokens.');
          return;
        }

        // Simulate token purchase
        // In a real application, you'd handle payment processing here
        alert(`Successfully purchased ${tokens} tokens for $${price}!`);

        // Update token count in navbar
        updateTokenCountAfterPurchase(tokens);

        // Close the Buy Tokens Modal
        closeModal('buy-tokens-modal');
      } catch (error) {
        console.error('Error purchasing tokens:', error);
        alert('An error occurred while purchasing tokens.');
      }
    });
  });

  // Function to update token count after purchase
  function updateTokenCountAfterPurchase(tokensPurchased) {
    const tokenCountElement = document.getElementById('token-count');
    if (tokenCountElement) {
      let currentTokens = parseInt(tokenCountElement.textContent.replace('Tokens: ', '')) || 0;
      currentTokens += tokensPurchased;
      tokenCountElement.textContent = `Tokens: ${currentTokens}`;
      // Optionally, update the backend as well
    }
  }

  // Accessibility: Close modal when clicking outside the modal content
  Object.keys(modals).forEach(modalId => {
    const modal = modals[modalId];
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modalId);
      }
    });
  });

  // Load public posts by default on page load
  loadPublicPosts();
});


// Close modal when clicking the close button
document.getElementById('close-buy-tokens-modal').addEventListener('click', () => {
  const modal = document.getElementById('buy-tokens-modal');
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden'); // Re-enable background scrolling
});
