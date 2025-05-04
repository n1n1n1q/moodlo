// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: "findSimilarQuestions",
    title: "Highlight correct answers",
    contexts: ["selection"]
  });
  
  // Add a context menu item to open settings
  chrome.contextMenus.create({
    id: "openSettings",
    title: "Extension Settings",
    contexts: ["action"]
  });

  // Set up default QA data if none exists
  chrome.storage.local.get(['qaData'], function(data) {
    if (!data.qaData) {
      const sampleQAData = [
        {
          question: "Which types of relationships are used in Conceptual Modelling?",
          answer: "One-to-One Relationship - a relationship that connects single Entities\nOne-to-Many relationship - a relationship that connects one Entity with several other Entities\nMany-to-Many Relationship - a relationship that connects many Entities of one Entity Type to many Entities of the other Entity Type\nGeneralization Relationship - a relationship that connects several sub-concepts (Entity Types) to one super-concept (Entity Type). Sub-concepts inherit the properties of the super-concept\nPart-Whole Relationship - a relationship that connects several Entity Types representing the parts of something to the Entity Type representing this something as a whole. Part-Whole Relationships could Aggregations or Compositions."
        },
        {
          question: "What are the modelling elements used in Conceptual Modelling?",
          answer: "An Entity Type - a container for entities having the same defining properties but with different values\nAn Entity - an element that corresponds to a real-world object or process\nA Relationship - a property that reflects the connection between different Entity Types or Entities\nAn Attribute - a property of an Entity Type, Entity, or Relationship"
        },
        {
          question: "What is a conceptual model",
          answer: "A mapping of implicit domain interpretations (mental structures) – interlinked concepts – into commonly agreed symbols and schemas – term graphs\nAn explicit description of implicit mental structures that is in a semantic agreement between the stakeholders"
        }
      ];
      chrome.storage.local.set({ 'qaData': sampleQAData });
    }
  });

  // Set up default settings if none exist
  const defaultSettings = {
    autoHighlightEnabled: true,
    popupEnabled: true,
    autoClearSelection: true,
    keyboardShortcutsEnabled: true
  };
  
  chrome.storage.sync.get(['settings'], function(data) {
    if (!data.settings) {
      chrome.storage.sync.set({ 'settings': defaultSettings });
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "findSimilarQuestions") {
    // Save the selection
    chrome.storage.local.set({ 'currentSelection': info.selectionText });
    
    // Check settings before performing actions
    chrome.storage.sync.get(['settings'], function(data) {
      const settings = data.settings || { 
        autoHighlightEnabled: true, 
        popupEnabled: true,
        inPagePopupOnly: false
      };
      
      // Send message to content script to highlight answers if highlighting is enabled
      if (settings.autoHighlightEnabled) {
        chrome.tabs.sendMessage(tab.id, { 
          action: "highlightAnswers",
          selection: info.selectionText
        });
      }
      
      // Show popup if enabled and not in "in-page popup only" mode
      if (settings.popupEnabled && !settings.inPagePopupOnly) {
        chrome.action.openPopup();
      }
    });
  } else if (info.menuItemId === "openSettings") {
    chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "newSelection") {
    // Update the badge to indicate there's a selection, regardless of popup settings
    chrome.action.setBadgeText({
      text: "✓",
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: "#4CAF50",  // Green color
      tabId: sender.tab.id
    });
    
    // Check settings before showing popup
    if (message.showPopup) {
      chrome.storage.sync.get(['settings'], function(data) {
        const settings = data.settings || { popupEnabled: true, inPagePopupOnly: false };
        
        // Only open the popup if enabled and not in "in-page popup only" mode
        if (settings.popupEnabled && !settings.inPagePopupOnly) {
          setTimeout(() => {
            chrome.action.openPopup();
          }, 100);
        }
      });
    }
  }
});