document.addEventListener('DOMContentLoaded', async () => {
  const selectionElement = document.getElementById('current-selection');
  const resultsElement = document.getElementById('results');
  const manageBtn = document.getElementById('manage-btn');
  
  // Check if we have any selection from content script
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
      resultsElement.innerHTML = '<p class="no-results">Select text on a page to find similar questions.</p>';
    }
  });
  
  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'manage.html' });
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
  
  // Display the results in the popup with the first 2 words of each answer in bold
  function displayResults(results) {
    if (results.length === 0) {
      resultsElement.innerHTML = '<p class="no-results">No similar questions found.</p>';
      return;
    }
    
    let html = '';
    results.forEach(result => {
      const similarityPercentage = Math.round(result.score * 100);
      
      // Make the first two words of the answer bold
      const answerWithBoldWords = makeFirstTwoWordsBold(result.answer);
      
      html += `
        <div class="result-item">
          <div class="question">${escapeHtml(result.question)}</div>
          <div class="answer">${answerWithBoldWords}</div>
          <div class="similarity">Similarity: ${similarityPercentage}%</div>
        </div>
      `;
    });
    
    resultsElement.innerHTML = html;
  }
  
  // Function to make the first two words of a text bold
  function makeFirstTwoWordsBold(text) {
    if (!text) return '';
    
    // Split the answer by newline to process each line
    const lines = text.split('\n');
    
    return lines.map(line => {
      // For each line, make the first two words bold
      const words = line.split(' ');
      
      if (words.length <= 2) {
        // If there are 2 or fewer words, make them all bold
        return `<strong>${escapeHtml(line)}</strong>`;
      } else {
        // Make first two words bold, keep the rest as is
        const firstTwoWords = words.slice(0, 2).join(' ');
        const restOfText = words.slice(2).join(' ');
        return `<strong>${escapeHtml(firstTwoWords)}</strong> ${escapeHtml(restOfText)}`;
      }
    }).join('<br>'); // Join lines with line breaks for HTML display
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