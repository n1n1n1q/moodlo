document.addEventListener('DOMContentLoaded', () => {
  const selectionElement = document.getElementById('current-selection');
  const resultsElement = document.getElementById('results');
  const manageBtn = document.getElementById('manage-btn');
  const closeBtn = document.getElementById('close-btn');

  // Track popup state
  let currentSelection = null;
  let isPaused = false;
  
  // Load initial position and data
  initializePopup();
  
  // Create a polling mechanism to check for selection changes
  const pollInterval = setInterval(checkForSelectionChanges, 500);
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(pollInterval);
  });
  
  // Handle the manage button click - open management page in a new tab
  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'manage.html' });
  });
  
  // Handle the close button click
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  // Make the popup draggable
  makePopupDraggable();
  
  /**
   * Initialize the popup with saved position and initial data
   */
  function initializePopup() {
    chrome.storage.local.get(['popupPosition', 'popupSize', 'currentSelection'], (data) => {
      // Apply saved position if available
      if (data.popupPosition) {
        document.body.style.position = 'fixed';
        document.body.style.left = data.popupPosition.left + 'px';
        document.body.style.top = data.popupPosition.top + 'px';
      }
      
      // Apply saved size if available
      if (data.popupSize) {
        document.body.style.width = data.popupSize.width + 'px';
        document.body.style.height = data.popupSize.height + 'px';
      }
      
      // Load initial selection
      if (data.currentSelection) {
        currentSelection = data.currentSelection;
        updatePopupContent(data.currentSelection);
      } else {
        selectionElement.textContent = "None";
        resultsElement.innerHTML = '<p class="no-results">Select text on a page to find similar questions.</p>';
      }
    });
  }
  
  /**
   * Check if there's a new selection in storage
   */
  function checkForSelectionChanges() {
    if (isPaused) return;
    
    chrome.storage.local.get(['currentSelection'], (data) => {
      if (data.currentSelection && data.currentSelection !== currentSelection) {
        console.log('Selection changed:', data.currentSelection.substring(0, 20) + '...');
        currentSelection = data.currentSelection;
        updatePopupContent(data.currentSelection);
      }
    });
  }
  
  /**
   * Update the popup content with new selection
   */
  function updatePopupContent(selection) {
    // Pause checking while we update
    isPaused = true;
    
    // Update selection display
    selectionElement.textContent = selection.length > 50 
      ? selection.substring(0, 50) + '...' 
      : selection;
    
    // Show loading state
    resultsElement.innerHTML = '<p class="loading">Loading results...</p>';
    
    // Get QA data and find matches
    getQAData()
      .then(qaData => {
        if (!qaData || qaData.length === 0) {
          resultsElement.innerHTML = '<p class="no-results">No QA data available. Click "Manage Q&A Data" to add some.</p>';
          return;
        }
        
        const similarQuestions = findSimilarQuestions(selection, qaData);
        displayResults(similarQuestions);
      })
      .catch(error => {
        console.error('Error updating popup content:', error);
        resultsElement.innerHTML = '<p class="error">Error loading results</p>';
      })
      .finally(() => {
        // Resume checking after update is complete
        isPaused = false;
      });
  }
  
  /**
   * Make the popup draggable by its header
   */
  function makePopupDraggable() {
    let isDragging = false;
    let initialX, initialY;
    let currentX, currentY;
    
    // Get the header element
    const header = document.querySelector('.header');
    if (!header) return;
    
    header.style.cursor = 'move';
    
    // Mouse events for dragging
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    function startDrag(e) {
      if (!e.target.closest('.header')) return;
      
      isDragging = true;
      initialX = e.clientX;
      initialY = e.clientY;
      currentX = parseInt(document.body.style.left) || 0;
      currentY = parseInt(document.body.style.top) || 0;
      
      e.preventDefault();
    }
    
    function drag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Calculate the new position
      const dx = e.clientX - initialX;
      const dy = e.clientY - initialY;
      
      // Update the position using the current style values
      const newX = currentX + dx;
      const newY = currentY + dy;
      
      // Apply the new position
      document.body.style.position = 'fixed';
      document.body.style.left = newX + 'px';
      document.body.style.top = newY + 'px';
    }
    
    function endDrag() {
      if (!isDragging) return;
      
      isDragging = false;
      
      // Save the new position
      const position = {
        left: parseInt(document.body.style.left) || 0,
        top: parseInt(document.body.style.top) || 0
      };
      
      chrome.storage.local.set({ 'popupPosition': position });
    }
  }
  
  /**
   * Get QA data from storage
   */
  function getQAData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['qaData'], function(data) {
        resolve(data.qaData || []);
      });
    });
  }
  
  /**
   * Find similar questions using text similarity
   */
  function findSimilarQuestions(selection, qaData) {
    // Convert selection to lowercase for case-insensitive matching
    const lowerSelection = selection.toLowerCase();
    
    return qaData
      .map(qa => {
        // Calculate a simple similarity score based on common words
        const score = calculateSimilarity(lowerSelection, qa.question.toLowerCase());
        return {
          ...qa,
          score
        };
      })
      .filter(qa => qa.score > 0.1) // Filter out very low similarity matches
      .sort((a, b) => b.score - a.score) // Sort by score, highest first
      .slice(0, 5); // Return top 5 matches
  }
  
  /**
   * Calculate text similarity between two strings
   */
  function calculateSimilarity(text1, text2) {
    const words1 = text1.split(/\W+/).filter(word => word.length > 2);
    const words2 = text2.split(/\W+/).filter(word => word.length > 2);
    
    // Count matching words
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    // Calculate similarity score
    if (words1.length === 0 || words2.length === 0) return 0;
    
    return matchCount / Math.sqrt(words1.length * words2.length);
  }
  
  /**
   * Display the results in the popup
   */
  function displayResults(results) {
    if (results.length === 0) {
      resultsElement.innerHTML = '<p class="no-results">No similar questions found.</p>';
      return;
    }
    
    let html = '';
    results.forEach(result => {
      const similarityPercentage = Math.round(result.score * 100);
      html += `
        <div class="result-item">
          <div class="question">${escapeHtml(result.question)}</div>
          <div class="answer">${formatAnswer(result.answer)}</div>
          <div class="similarity">Similarity: ${similarityPercentage}%</div>
        </div>
      `;
    });
    
    resultsElement.innerHTML = html;
    
    // Ensure popup is correctly sized and positioned after content is loaded
    ensurePopupVisibility();
  }
  
  /**
   * Format answer text to make first words bold
   */
  function formatAnswer(answerText) {
    const lines = answerText.split('\n');
    return lines.map(line => {
      if (line.trim() === '') return '';
      
      const words = line.split(' ');
      if (words.length <= 2) {
        return `<strong>${escapeHtml(line)}</strong>`;
      } else {
        const firstTwoWords = words.slice(0, 2).join(' ');
        const restOfText = words.slice(2).join(' ');
        return `<strong>${escapeHtml(firstTwoWords)}</strong> ${escapeHtml(restOfText)}`;
      }
    }).join('<br>');
  }
  
  /**
   * Helper function to escape HTML to prevent XSS
   */
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Function to ensure the popup stays within the viewport
   */
  function ensurePopupVisibility() {
    // Get the current window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Get the current document body dimensions (content size)
    const bodyWidth = document.body.scrollWidth;
    const bodyHeight = document.body.scrollHeight;
    
    // Only adjust the body's max height if it would exceed the window
    if (bodyHeight > windowHeight) {
      document.body.style.maxHeight = `${windowHeight}px`;
      document.body.style.overflowY = 'auto';
    }
    
    // Only adjust the body's max width if it would exceed the window
    if (bodyWidth > windowWidth) {
      document.body.style.maxWidth = `${windowWidth}px`;
      document.body.style.overflowX = 'auto';
    }
    
    // Make sure the results container is visible
    if (resultsElement) {
      resultsElement.style.maxHeight = `${windowHeight - 100}px`; // Leave some space for header
      resultsElement.style.overflowY = 'auto';  
    }
  }
  
  // Add event listener for window resizing
  let resizeTimeout;
  window.addEventListener('resize', () => {
    // Debounce the resize event
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Get the actual dimensions of the popup window's content area, not just the window
      const windowWidth = document.documentElement.clientWidth;
      const windowHeight = document.documentElement.clientHeight;
      
      // Save the current size when the window is resized
      const size = {
        width: windowWidth,
        height: windowHeight
      };
      
      chrome.storage.local.set({ 'popupSize': size });
      console.log('Popup size saved:', size);
      
      // Ensure the popup content fits properly
      ensurePopupVisibility();
    }, 300); // Wait for 300ms after resize stops
  });
  
  // Also save the size when the popup is about to be closed
  window.addEventListener('beforeunload', () => {
    clearInterval(pollInterval);
    
    // Save the current size
    const size = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    };
    
    chrome.storage.local.set({ 'popupSize': size });
    console.log('Popup size saved before closing:', size);
  });
  
  // Add a direct listener for storage changes as a backup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.currentSelection && !isPaused) {
      const newSelection = changes.currentSelection.newValue;
      if (newSelection && newSelection !== currentSelection) {
        currentSelection = newSelection;
        updatePopupContent(newSelection);
      }
    }
  });
});