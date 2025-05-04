document.addEventListener('DOMContentLoaded', () => {
  // Tab functionality
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to selected tab and content
      tab.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  //==========================================================================
  // Settings Tab Functionality
  //==========================================================================
  const autoHighlightEnabled = document.getElementById('autoHighlightEnabled');
  const popupEnabled = document.getElementById('popupEnabled');
  const htmlPopupEnabled = document.getElementById('htmlPopupEnabled');
  const inPagePopupOnly = document.getElementById('inPagePopupOnly');
  const autoClearSelection = document.getElementById('autoClearSelection');
  const keyboardShortcutsEnabled = document.getElementById('keyboardShortcutsEnabled');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const settingsStatusMessage = document.getElementById('settings-status-message');
  
  // Default settings
  const defaultSettings = {
    autoHighlightEnabled: true,
    popupEnabled: true,
    htmlPopupEnabled: false,
    inPagePopupOnly: false,
    autoClearSelection: true,
    keyboardShortcutsEnabled: true
  };
  
  // Load settings
  loadSettings();
  
  // Add event listeners for settings
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
  
  // Function to load settings
  function loadSettings() {
    chrome.storage.sync.get(['settings'], (result) => {
      const settings = result.settings || defaultSettings;
      
      // Apply settings to form elements
      autoHighlightEnabled.checked = settings.autoHighlightEnabled !== false;
      popupEnabled.checked = settings.popupEnabled !== false;
      htmlPopupEnabled.checked = settings.htmlPopupEnabled === true;
      inPagePopupOnly.checked = settings.inPagePopupOnly === true;
      autoClearSelection.checked = settings.autoClearSelection !== false;
      keyboardShortcutsEnabled.checked = settings.keyboardShortcutsEnabled !== false;
    });
  }
  
  // Function to save settings
  function saveSettings() {
    const settings = {
      autoHighlightEnabled: autoHighlightEnabled.checked,
      popupEnabled: popupEnabled.checked,
      htmlPopupEnabled: htmlPopupEnabled.checked,
      inPagePopupOnly: inPagePopupOnly.checked,
      autoClearSelection: autoClearSelection.checked,
      keyboardShortcutsEnabled: keyboardShortcutsEnabled.checked
    };
    
    // Save to chrome.storage
    chrome.storage.sync.set({ 'settings': settings }, () => {
      // Show saved message
      showStatusMessage(settingsStatusMessage);
    });
  }
  
  // Function to reset settings to defaults
  function resetSettings() {
    // Reset form elements
    autoHighlightEnabled.checked = defaultSettings.autoHighlightEnabled;
    popupEnabled.checked = defaultSettings.popupEnabled;
    htmlPopupEnabled.checked = defaultSettings.htmlPopupEnabled;
    inPagePopupOnly.checked = defaultSettings.inPagePopupOnly;
    autoClearSelection.checked = defaultSettings.autoClearSelection;
    keyboardShortcutsEnabled.checked = defaultSettings.keyboardShortcutsEnabled;
    
    // Save defaults to storage
    chrome.storage.sync.set({ 'settings': defaultSettings }, () => {
      // Show saved message
      showStatusMessage(settingsStatusMessage);
    });
  }

  //==========================================================================
  // Q&A Manager Tab Functionality
  //==========================================================================
  const questionInput = document.getElementById('question');
  const answerInput = document.getElementById('answer');
  const addBtn = document.getElementById('add-btn');
  const qaContainer = document.getElementById('qa-container');
  const importBtn = document.getElementById('import-btn');
  const exportBtn = document.getElementById('export-btn');
  const importInput = document.getElementById('importInput');
  const qaStatusMessage = document.getElementById('qa-status-message');
  
  let qaData = [];
  let editingIndex = -1;
  
  // Load existing QA data
  loadQAData();
  
  // Add new QA
  addBtn.addEventListener('click', () => {
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();
    
    if (!question || !answer) {
      alert('Please enter both a question and an answer.');
      return;
    }
    
    if (editingIndex >= 0) {
      // Update existing QA
      qaData[editingIndex] = { question, answer };
      editingIndex = -1;
      addBtn.textContent = 'Add Q&A';
    } else {
      // Add new QA
      qaData.push({ question, answer });
    }
    
    // Save and reset
    saveQAData();
    questionInput.value = '';
    answerInput.value = '';
  });
  
  // Import functionality
  importBtn.addEventListener('click', () => {
    importInput.click();
  });
  
  importInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData) && importedData.every(item => item.question && item.answer)) {
          qaData = importedData;
          saveQAData();
          alert('Q&A data imported successfully!');
        } else {
          alert('Invalid Q&A data format.');
        }
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  });
  
  // Export functionality
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(qaData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'qa_data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  });
  
  // Function to load QA data
  function loadQAData() {
    chrome.storage.local.get(['qaData'], function(data) {
      if (data.qaData && Array.isArray(data.qaData)) {
        qaData = data.qaData;
        renderQAList();
      }
    });
  }
  
  // Function to save QA data
  function saveQAData() {
    chrome.storage.local.set({ 'qaData': qaData }, () => {
      renderQAList();
      showStatusMessage(qaStatusMessage);
    });
  }
  
  // Function to render QA list
  function renderQAList() {
    if (qaData.length === 0) {
      qaContainer.innerHTML = '<p class="no-data">No Q&A data available yet.</p>';
      return;
    }
    
    let html = '';
    qaData.forEach((item, index) => {
      html += `
        <div class="qa-item" data-index="${index}">
          <div class="qa-question">${escapeHtml(item.question)}</div>
          <div class="qa-answer">${escapeHtml(item.answer)}</div>
          <div class="qa-controls">
            <button class="edit-btn" data-index="${index}">Edit</button>
            <button class="delete-btn delete" data-index="${index}">Delete</button>
          </div>
        </div>
      `;
    });
    
    qaContainer.innerHTML = html;
    
    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', handleEdit);
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });
  }
  
  // Function to handle editing
  function handleEdit(event) {
    const index = parseInt(event.target.getAttribute('data-index'));
    const qa = qaData[index];
    
    questionInput.value = qa.question;
    answerInput.value = qa.answer;
    editingIndex = index;
    addBtn.textContent = 'Update Q&A';
    
    // Scroll to the form
    document.querySelector('.qa-form').scrollIntoView({ behavior: 'smooth' });
  }
  
  // Function to handle deletion
  function handleDelete(event) {
    const index = parseInt(event.target.getAttribute('data-index'));
    
    if (confirm('Are you sure you want to delete this Q&A pair?')) {
      qaData.splice(index, 1);
      saveQAData();
      
      if (editingIndex === index) {
        questionInput.value = '';
        answerInput.value = '';
        editingIndex = -1;
        addBtn.textContent = 'Add Q&A';
      }
    }
  }
  
  // Helper function to escape HTML
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Helper function to show status messages
  function showStatusMessage(element) {
    element.classList.add('visible');
    setTimeout(() => {
      element.classList.remove('visible');
    }, 2000);
  }
});