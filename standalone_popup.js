document.addEventListener('DOMContentLoaded', async () => {
  const selectionElement = document.getElementById('current-selection');
  const resultsElement = document.getElementById('results');
  const manageBtn = document.getElementById('manage-btn');
  const closeBtn = document.getElementById('close-btn');

  // Get the current selection from storage
  chrome.storage.local.get(['currentSelection'], async function(data) {
    if (data.currentSelection) {
      selectionElement.textContent = data.currentSelection.length > 50 
        ? data.currentSelection.substring(0, 50) + '...' 
        : data.currentSelection;
        
      // Get the QA data
      const qaData = await getQAData();
      
      if (qaData && qaData.length > 0) {
        const similarQuestions = findSimilarQuestions(data.currentSelection, qaData);
        displayResults(similarQuestions);
      } else {
        resultsElement.innerHTML = '<p class="no-results">No QA data available. Click "Manage Q&A Data" to add some.</p>';
      }
    } else {
      selectionElement.textContent = "None";
      resultsElement.innerHTML = '<p class="no-results">No selection available.</p>';
    }
  });
  
  // Handle the manage button click - open management page in a new tab
  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'manage.html' });
  });
  
  // Handle the close button click
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  // Function to get QA data from storage
  async function getQAData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['qaData'], function(data) {
        resolve(data.qaData || []);
      });
    });
  }
  
  // Function to find similar questions using simple text similarity
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
  
  // Display the results in the popup
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
          <div class="answer">${escapeHtml(result.answer)}</div>
          <div class="similarity">Similarity: ${similarityPercentage}%</div>
        </div>
      `;
    });
    
    resultsElement.innerHTML = html;
  }
  
  // Helper function to escape HTML to prevent XSS
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});