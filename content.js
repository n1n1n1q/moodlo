// Listen for text selections
document.addEventListener('mouseup', function(event) {
  const selection = window.getSelection().toString().trim();
  
  // Only process non-empty selections
  if (selection) {
    try {
      // Get settings before taking any action
      chrome.storage.sync.get(['settings'], function(data) {
        const settings = data.settings || {
          autoHighlightEnabled: true,
          popupEnabled: true,
          htmlPopupEnabled: false,
          autoClearSelection: true,
          keyboardShortcutsEnabled: true
        };
        
        // Save the current selection to storage
        chrome.storage.local.set({ 'currentSelection': selection });
        
        // Let the background script know there's a new selection and request popup if enabled
        chrome.runtime.sendMessage({ 
          action: 'newSelection',
          selection: selection,
          showPopup: settings.popupEnabled
        });
        
        // If we're on a Moodle quiz page and auto-highlight is enabled
        if (isMoodlePage() && settings.autoHighlightEnabled) {
          highlightCorrectAnswers(selection);
          
          // Clear the selection to make it disappear if auto-clear is enabled
          if (settings.autoClearSelection) {
            window.getSelection().removeAllRanges();
          }
        }
      });
    } catch (error) {
      console.error("Error processing selection:", error);
    }
  }
});

// Listen for keyboard shortcuts
document.addEventListener('keydown', function(event) {
  try {
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
  } catch (error) {
    console.error("Error processing keyboard shortcut:", error);
  }
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
    try {
      chrome.storage.sync.get(['settings'], function(data) {
        const settings = data.settings || {
          autoHighlightEnabled: true,
          autoClearSelection: true,
          htmlPopupEnabled: false
        };
        
        // Only highlight if the feature is enabled
        if (settings.autoHighlightEnabled && isMoodlePage()) {
          highlightCorrectAnswers(request.selection);
          
          // Show HTML-based popup if enabled
          if (settings.htmlPopupEnabled) {
            showHtmlPopup(request.selection, null);
          }
          
          // Clear the selection if auto-clear is enabled
          if (settings.autoClearSelection) {
            window.getSelection().removeAllRanges();
          }
        }
      });
    } catch (error) {
      console.error("Error handling highlight answers request:", error);
    }
  }
});

// Function to create and show HTML-based popup
async function showHtmlPopup(selection, event) {
  try {
    // Remove any existing popup
    removeHtmlPopup();
    
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

    // Create popup element
    const popup = document.createElement('div');
    popup.id = 'moodle-html-popup';
    popup.style.cssText = `
      position: absolute;
      z-index: 10000;
      background: white;
      border: 1px solid #ccc;
      border-radius: 5px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      padding: 15px;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333;
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
    `;
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Matching Answers';
    title.style.margin = '0';
    title.style.fontSize = '16px';
    header.appendChild(title);
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #777;
    `;
    closeBtn.addEventListener('click', removeHtmlPopup);
    header.appendChild(closeBtn);
    
    popup.appendChild(header);
    
    // Add content with results
    const resultsContainer = document.createElement('div');
    
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
    
    popup.appendChild(resultsContainer);
    
    // Position the popup near the selection or mouse event
    if (event) {
      popup.style.left = `${event.pageX + 10}px`;
      popup.style.top = `${event.pageY + 10}px`;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        popup.style.left = `${window.pageXOffset + rect.right + 10}px`;
        popup.style.top = `${window.pageYOffset + rect.top}px`;
      } else {
        popup.style.left = '50%';
        popup.style.top = '100px';
        popup.style.transform = 'translateX(-50%)';
      }
    }
    
    // Add to document
    document.body.appendChild(popup);
    
    // Make popup draggable
    makeElementDraggable(popup);
    
  } catch (error) {
    console.error("Error showing HTML popup:", error);
  }
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
  const header = element.querySelector('h3') || element;
  
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
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('mouseup', closeDragElement);
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
  try {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['qaData'], function(data) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(data.qaData || []);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error("Error getting QA data:", error);
    return [];
  }
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
        // Find the checkbox input
        const checkbox = answerEl.querySelector('input[type="checkbox"]');
        
        // Highlight the container
        answerEl.classList.add('moodle-answer-highlight');
        
        // Check the checkbox if it exists
        if (checkbox) {
          checkbox.checked = true;
        }
        
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