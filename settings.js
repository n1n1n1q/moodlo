document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const autoHighlightEnabled = document.getElementById('autoHighlightEnabled');
  const popupEnabled = document.getElementById('popupEnabled');
  const htmlPopupEnabled = document.getElementById('htmlPopupEnabled');
  const autoClearSelection = document.getElementById('autoClearSelection');
  const keyboardShortcutsEnabled = document.getElementById('keyboardShortcutsEnabled');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusSaved = document.getElementById('status-saved');
  
  // Default settings
  const defaultSettings = {
    autoHighlightEnabled: true,
    popupEnabled: true,
    htmlPopupEnabled: false,
    autoClearSelection: true,
    keyboardShortcutsEnabled: true
  };
  
  // Load settings from storage
  loadSettings();
  
  // Add event listeners
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
      autoClearSelection: autoClearSelection.checked,
      keyboardShortcutsEnabled: keyboardShortcutsEnabled.checked
    };
    
    // Save to chrome.storage
    chrome.storage.sync.set({ 'settings': settings }, () => {
      // Show saved message
      statusSaved.classList.add('visible');
      setTimeout(() => {
        statusSaved.classList.remove('visible');
      }, 2000);
    });
  }
  
  // Function to reset settings to defaults
  function resetSettings() {
    // Reset form elements
    autoHighlightEnabled.checked = defaultSettings.autoHighlightEnabled;
    popupEnabled.checked = defaultSettings.popupEnabled;
    htmlPopupEnabled.checked = defaultSettings.htmlPopupEnabled;
    autoClearSelection.checked = defaultSettings.autoClearSelection;
    keyboardShortcutsEnabled.checked = defaultSettings.keyboardShortcutsEnabled;
    
    // Save defaults to storage
    chrome.storage.sync.set({ 'settings': defaultSettings }, () => {
      // Show saved message
      statusSaved.classList.add('visible');
      setTimeout(() => {
        statusSaved.classList.remove('visible');
      }, 2000);
    });
  }
});