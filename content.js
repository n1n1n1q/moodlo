// Listen for text selections
document.addEventListener('mouseup', function(event) {
  const selection = window.getSelection().toString().trim();
  
  // Only process non-empty selections
  if (selection) {
    // Get settings before taking any action
    chrome.storage.sync.get(['settings'], function(data) {
      const settings = data.settings || {
        autoHighlightEnabled: true,
        popupEnabled: true,
        htmlPopupEnabled: false,
        inPagePopupOnly: false,
        autoClearSelection: true,
        keyboardShortcutsEnabled: true
      };
      
      // Save the current selection to storage
      chrome.storage.local.set({ 'currentSelection': selection });
      
      // Let the background script know there's a new selection and request popup
      // Only if popup is enabled AND not in in-page popup only mode
      if (settings.popupEnabled && !settings.inPagePopupOnly) {
        chrome.runtime.sendMessage({ 
          action: 'newSelection',
          selection: selection,
          showPopup: true
        });
      }
      
      // If we're on a Moodle quiz page and auto-highlight is enabled
      if (isMoodlePage() && settings.autoHighlightEnabled) {
        highlightCorrectAnswers(selection);
        
        // Show HTML-based popup if enabled or if in-page popup only is enabled
        if (settings.htmlPopupEnabled || settings.inPagePopupOnly) {
          showHtmlPopup(selection, event);
        }
        
        // Clear the selection to make it disappear if auto-clear is enabled
        if (settings.autoClearSelection) {
          window.getSelection().removeAllRanges();
        }
      }
    });
  }
});

// Listen for keyboard shortcuts
document.addEventListener('keydown', function(event) {
  // Check if keyboard shortcuts are enabled
  chrome.storage.sync.get(['settings'], function(data) {
    const settings = data.settings || {
      keyboardShortcutsEnabled: true
    };
    
    // Only process if shortcuts are enabled
    if (settings.keyboardShortcutsEnabled) {
      // Listen for Escape key to clear selections
      if (event.key === 'Escape') {
        clearAllSelections();
        removeHtmlPopup(); // Also remove any HTML popup
      }
      // Listen for Alt+C (or Option+C on Mac) to clear selections
      else if (event.altKey && event.key === 'c') {
        clearAllSelections();
        removeHtmlPopup(); // Also remove any HTML popup
      }
    }
  });
});

// Function to clear all selections
function clearAllSelections() {
  // Clear any text selection
  window.getSelection().removeAllRanges();
  
  // Remove any highlight styles if they exist
  const highlightedElements = document.querySelectorAll('.moodle-answer-highlight');
  highlightedElements.forEach(el => {
    el.classList.remove('moodle-answer-highlight');
  });
  
  // Uncheck any checkboxes that were checked by the extension
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    // Only uncheck if it was automatically checked (you might want to add a custom class
    // to track which ones were automatically checked vs. manually checked)
    if (checkbox.closest('.moodle-answer-highlight')) {
      checkbox.checked = false;
    }
  });
  
  // Let the user know the selections were cleared
  console.log('Selections cleared via keyboard shortcut');
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getSelection") {
    sendResponse({ selection: window.getSelection().toString().trim() });
  }
  
  // Handle the highlight answers request from context menu
  if (request.action === "highlightAnswers" && request.selection) {
    chrome.storage.sync.get(['settings'], function(data) {
      const settings = data.settings || {
        autoHighlightEnabled: true,
        autoClearSelection: true,
        htmlPopupEnabled: false,
        inPagePopupOnly: false
      };
      
      // Only highlight if the feature is enabled
      if (settings.autoHighlightEnabled && isMoodlePage()) {
        highlightCorrectAnswers(request.selection);
        
        // Show HTML-based popup if enabled or if in-page popup only is enabled
        if (settings.htmlPopupEnabled || settings.inPagePopupOnly) {
          showHtmlPopup(request.selection, null);
        }
        
        // Clear the selection if auto-clear is enabled
        if (settings.autoClearSelection) {
          window.getSelection().removeAllRanges();
        }
      }
    });
  }
});

// Function to create and show HTML-based popup
async function showHtmlPopup(selection, event) {
  try {
    console.log("Showing HTML popup for selection:", selection.substring(0, 30) + "...");
    
    // Get QA data from storage
    const qaData = await getQAData();
    if (!qaData || qaData.length === 0) {
      console.log("No QA data available for HTML popup");
      return;
    }

    // Find similar questions
    const similarQuestions = findSimilarQuestions(selection, qaData);
    if (similarQuestions.length === 0) {
      console.log("No similar questions found for HTML popup");
      return;
    }

    // Check if popup already exists
    let popup = document.getElementById('moodle-html-popup');
    let resultsContainer;
    
    // If popup doesn't exist, create it
    if (!popup) {
      // Create popup element
      popup = document.createElement('div');
      popup.id = 'moodle-html-popup';
      popup.style.cssText = `
        position: fixed; 
        z-index: 10000;
        background: white;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        padding: 15px;
        width: 400px;
        height: 300px;
        min-width: 250px;
        min-height: 150px;
        overflow: hidden;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #333;
        top: 100px;
        left: 100px;
        resize: both;
      `;

      // Create popup header
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        position: sticky;
        top: 0;
        background: white;
        z-index: 10001;
      `;
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = 'Matching Answers';
      title.style.margin = '0';
      title.style.fontSize = '16px';
      header.appendChild(title);
      
      // Add control buttons
      const controlsDiv = document.createElement('div');
      controlsDiv.style.display = 'flex';
      controlsDiv.style.gap = '8px';
      
      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.title = 'Close';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #777;
        padding: 0;
        line-height: 1;
      `;
      closeBtn.addEventListener('click', removeHtmlPopup);
      
      controlsDiv.appendChild(closeBtn);
      header.appendChild(controlsDiv);
      
      popup.appendChild(header);
      
      // Add content container
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'moodle-html-popup-results';
      resultsContainer.style.cssText = `
        height: calc(100% - 40px);
        overflow-y: auto;
        padding-right: 5px;
      `;
      popup.appendChild(resultsContainer);
      
      // Add resize handle (for browsers that don't support the resize property)
      const resizeHandle = document.createElement('div');
      resizeHandle.style.cssText = `
        position: absolute;
        width: 15px;
        height: 15px;
        bottom: 0;
        right: 0;
        cursor: nwse-resize;
        background: linear-gradient(135deg, transparent 50%, #ccc 50%, #ccc 100%);
        z-index: 10002;
      `;
      popup.appendChild(resizeHandle);
      
      // Enable custom resize functionality
      makeElementResizable(popup, resizeHandle);
      
      // Add to document
      document.body.appendChild(popup);
      
      // Make popup draggable
      makeElementDraggable(popup);
      
      // Position popup in fixed position
      // Load saved position and size from storage if available
      chrome.storage.local.get(['popupPosition', 'popupSize'], function(data) {
        if (data.popupPosition) {
          popup.style.left = data.popupPosition.left + 'px';
          popup.style.top = data.popupPosition.top + 'px';
        } else {
          // Set default fixed position (center of screen)
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const popupWidth = popup.offsetWidth;
          const popupHeight = popup.offsetHeight;
          
          const left = (viewportWidth - popupWidth) / 2;
          const top = (viewportHeight - popupHeight) / 3;
          
          popup.style.left = `${left}px`;
          popup.style.top = `${top}px`;
        }
        
        // Apply saved size if available
        if (data.popupSize) {
          popup.style.width = data.popupSize.width + 'px';
          popup.style.height = data.popupSize.height + 'px';
        }
      });
      
      console.log("HTML popup created and added to document");
    } else {
      // If popup exists, just get the results container to update
      resultsContainer = document.getElementById('moodle-html-popup-results');
      // Clear existing results
      resultsContainer.innerHTML = '';
      console.log("Updating existing HTML popup");
    }
    
    // Update the results content
    similarQuestions.forEach(question => {
      const resultItem = document.createElement('div');
      resultItem.className = 'html-popup-result';
      resultItem.style.cssText = `
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
      `;
      
      // Question
      const questionEl = document.createElement('div');
      questionEl.className = 'html-popup-question';
      questionEl.textContent = question.question;
      questionEl.style.cssText = `
        font-weight: bold;
        margin-bottom: 5px;
      `;
      resultItem.appendChild(questionEl);
      
      // Answer with first two words bold
      const answerEl = document.createElement('div');
      answerEl.className = 'html-popup-answer';
      answerEl.style.color = '#444';
      
      // Split answers by newline and make first two words bold
      const answers = question.answer.split('\n');
      answers.forEach((answer, index) => {
        if (answer.trim() === '') return;
        
        const p = document.createElement('p');
        p.style.margin = '5px 0';
        
        const words = answer.split(' ');
        if (words.length <= 2) {
          const strong = document.createElement('strong');
          strong.textContent = answer;
          p.appendChild(strong);
        } else {
          const firstTwoWords = words.slice(0, 2).join(' ');
          const restOfWords = words.slice(2).join(' ');
          
          const strong = document.createElement('strong');
          strong.textContent = firstTwoWords;
          p.appendChild(strong);
          p.appendChild(document.createTextNode(' ' + restOfWords));
        }
        
        answerEl.appendChild(p);
      });
      
      resultItem.appendChild(answerEl);
      
      // Similarity percentage
      const similarityEl = document.createElement('div');
      similarityEl.className = 'html-popup-similarity';
      similarityEl.textContent = `Similarity: ${Math.round(question.score * 100)}%`;
      similarityEl.style.cssText = `
        font-size: 12px;
        color: #888;
      `;
      resultItem.appendChild(similarityEl);
      
      resultsContainer.appendChild(resultItem);
    });
    
  } catch (error) {
    console.error("Error showing HTML popup:", error);
  }
}

// Simple function to position popup
function positionPopup(popup, event) {
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get popup dimensions
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;
  
  let left, top;
  
  if (event) {
    // Position based on mouse click
    left = event.pageX + 10;
    top = event.pageY + 10;
  } else {
    // Position based on selection or default position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      left = window.pageXOffset + rect.right + 10;
      top = window.pageYOffset + rect.top;
    } else {
      // Default position
      left = window.pageXOffset + (viewportWidth - popupWidth) / 2;
      top = window.pageYOffset + 100;
    }
  }
  
  // Ensure popup is within viewport bounds
  if (left + popupWidth > window.pageXOffset + viewportWidth) {
    left = window.pageXOffset + viewportWidth - popupWidth - 20;
  }
  
  if (top + popupHeight > window.pageYOffset + viewportHeight) {
    top = window.pageYOffset + viewportHeight - popupHeight - 20;
  }
  
  // Make sure we don't position offscreen
  left = Math.max(window.pageXOffset + 10, left);
  top = Math.max(window.pageYOffset + 10, top);
  
  // Set the position
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

// Function to remove HTML popup
function removeHtmlPopup() {
  const existingPopup = document.getElementById('moodle-html-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
}

// Make an element draggable
function makeElementDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // If there's a header in the element, attach the listeners to it
  const header = element.querySelector('.header') || element.querySelector('h3') || element;
  
  header.style.cursor = 'move';
  header.addEventListener('mousedown', dragMouseDown);
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the initial mouse cursor position
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Add event listeners for mouse movement and release
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement);
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set the element's new position with fixed positioning
    const newTop = parseInt(element.style.top || '0') - pos2;
    const newLeft = parseInt(element.style.left || '0') - pos1;
    
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('mouseup', closeDragElement);
    
    // Save the position to storage
    if (element.id === 'moodle-html-popup') {
      const position = {
        left: parseInt(element.style.left),
        top: parseInt(element.style.top)
      };
      
      chrome.storage.local.set({ 'popupPosition': position });
      console.log('Popup position saved:', position);
    }
  }
}

// Function to make an element resizable
function makeElementResizable(element, handle) {
  let startX, startY, startWidth, startHeight;

  // Add listener for native resize (in case browser supports 'resize: both')
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      // Save the size to storage when resized by native controls
      const size = {
        width: entry.contentRect.width,
        height: entry.contentRect.height
      };
      chrome.storage.local.set({ 'popupSize': size });
      console.log('Popup size saved from ResizeObserver:', size);
    }
  });
  
  // Start observing the element
  resizeObserver.observe(element);

  // Handle manual resize with the resize handle
  handle.addEventListener('mousedown', initResize);

  function initResize(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent dragging from starting
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
    startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
    document.documentElement.addEventListener('mousemove', doResize);
    document.documentElement.addEventListener('mouseup', stopResize);
  }

  function doResize(e) {
    // Calculate new dimensions based on mouse movement
    const newWidth = Math.max(startWidth + e.clientX - startX, 250); // Respect min width
    const newHeight = Math.max(startHeight + e.clientY - startY, 150); // Respect min height
    
    // Apply new dimensions
    element.style.width = newWidth + 'px';
    element.style.height = newHeight + 'px';
    
    // Ensure the popup stays within viewport bounds
    ensurePopupVisibility(element);
  }

  function stopResize() {
    document.documentElement.removeEventListener('mousemove', doResize);
    document.documentElement.removeEventListener('mouseup', stopResize);

    // Save the size to storage
    const size = {
      width: parseInt(element.style.width),
      height: parseInt(element.style.height)
    };

    chrome.storage.local.set({ 'popupSize': size });
    console.log('Popup size saved from handle resize:', size);
  }
}

// Function to ensure popup stays within viewport
function ensurePopupVisibility(popup) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const rect = popup.getBoundingClientRect();
  
  // Check if popup extends beyond right edge
  if (rect.right > viewportWidth) {
    const newWidth = viewportWidth - rect.left - 20;
    if (newWidth >= 250) { // Respect min width
      popup.style.width = newWidth + 'px';
    } else {
      // Move popup left instead of reducing width below minimum
      popup.style.left = (viewportWidth - 250 - 20) + 'px';
    }
  }
  
  // Check if popup extends beyond bottom edge
  if (rect.bottom > viewportHeight) {
    const newHeight = viewportHeight - rect.top - 20;
    if (newHeight >= 150) { // Respect min height
      popup.style.height = newHeight + 'px';
    } else {
      // Move popup up instead of reducing height below minimum
      popup.style.top = (viewportHeight - 150 - 20) + 'px';
    }
  }
}

// Function to find similar questions
function findSimilarQuestions(selection, qaData) {
  const lowerSelection = selection.toLowerCase();
  
  return qaData
    .map(qa => {
      const score = calculateSimilarity(lowerSelection, qa.question.toLowerCase());
      return { ...qa, score };
    })
    .filter(qa => qa.score > 0.1) // Filter out very low similarity matches
    .sort((a, b) => b.score - a.score) // Sort by score, highest first
    .slice(0, 3); // Return top 3 matches
}

// Check if we're on a Moodle page
function isMoodlePage() {
  // Look for typical Moodle page elements
  return document.querySelector('.que') !== null || 
         document.querySelector('.formulation') !== null;
}

// Main function to highlight correct answers
async function highlightCorrectAnswers(questionText) {
  try {
    // Get QA data from storage
    const qaData = await getQAData();
    if (!qaData || qaData.length === 0) {
      console.log("No QA data available");
      return;
    }

    // Find the most similar question
    const bestMatch = findBestMatchingQuestion(questionText, qaData);
    if (!bestMatch || bestMatch.score < 0.2) { // Threshold for minimum similarity
      console.log("No similar questions found");
      return;
    }

    // Parse the correct answers
    const correctAnswers = parseCorrectAnswers(bestMatch.answer);
    if (correctAnswers.length === 0) {
      console.log("No correct answers parsed");
      return;
    }

    // Find the question container on the page
    const questionContainer = findQuestionContainer(questionText);
    if (!questionContainer) {
      console.log("Question container not found on page");
      return;
    }

    // Highlight the answers
    highlightAnswers(questionContainer, correctAnswers);
  } catch (error) {
    console.error("Error highlighting answers:", error);
  }
}

// Function to get QA data from storage
async function getQAData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['qaData'], function(data) {
      resolve(data.qaData || []);
    });
  });
}

// Function to find the best matching question
function findBestMatchingQuestion(text, qaData) {
  const lowerText = text.toLowerCase();
  
  return qaData
    .map(qa => {
      const score = calculateSimilarity(lowerText, qa.question.toLowerCase());
      return { ...qa, score };
    })
    .sort((a, b) => b.score - a.score)[0]; // Return the highest scoring match
}

// Simple text similarity calculation
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

// Function to parse the correct answers from the answer text
// The answer string has different answers separated by \n
function parseCorrectAnswers(answerText) {
  if (!answerText) return [];
  
  // Split by newlines and filter empty lines
  return answerText.split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

// Function to find the question container based on question text
function findQuestionContainer(questionText) {
  // Look for formulation elements that might contain the question
  const formulations = document.querySelectorAll('.formulation, .content');
  
  for (const formulation of formulations) {
    if (formulation.textContent.includes(questionText.substring(0, 50))) {
      // Return the parent question container
      return formulation.closest('.que') || 
             formulation.closest('.content') || 
             formulation.parentElement;
    }
  }
  
  // If no specific container found, return the parent of the current selection
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    return range.commonAncestorContainer.parentElement;
  }
  
  return null;
}

// Function to highlight the answers in the question container
function highlightAnswers(container, correctAnswers) {
  // Remove any existing highlights first
  const existingHighlights = container.querySelectorAll('.moodle-answer-highlight');
  existingHighlights.forEach(el => {
    el.classList.remove('moodle-answer-highlight');
  });
  
  // Add styles for highlighting if not already added
  addHighlightStyles();
  
  // Find all potential answer elements (checkboxes and their labels)
  const answerElements = container.querySelectorAll('.answer, .r0, .r1, .d-flex');
  
  answerElements.forEach(answerEl => {
    const answerText = answerEl.textContent.trim();
    
    // Check if this answer matches any correct answer
    for (const correctAnswer of correctAnswers) {
      if (answerText.includes(correctAnswer) || correctAnswer.includes(answerText)) {
        // We no longer automatically highlight or select answers
        // Just track the match for potential future use
        answerEl.dataset.matchedAnswer = 'true';
        break;
      }
    }
  });
  
  // Remove notification feature - as requested
}

// Function to add highlight styles to the page
function addHighlightStyles() {
  if (!document.getElementById('moodle-highlight-styles')) {
    const style = document.createElement('style');
    style.id = 'moodle-highlight-styles';
    style.textContent = `
      .moodle-answer-highlight {
        background-color: rgba(76, 175, 80, 0.3) !important;
        border-left: 4px solid #4CAF50 !important;
        padding-left: 10px !important;
        animation: highlight-pulse 2s ease-in-out 1;
      }
      
      @keyframes highlight-pulse {
        0% { background-color: rgba(76, 175, 80, 0.1); }
        50% { background-color: rgba(76, 175, 80, 0.5); }
        100% { background-color: rgba(76, 175, 80, 0.3); }
      }
    `;
    document.head.appendChild(style);
  }
}