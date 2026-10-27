/**
 * S.P.A.R.T - Smart Perpetual Assistant for Research Tasks
 * Autonomous Voice-First Research Assistant Application
 */

(function () {
  'use strict';

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    userName: localStorage.getItem('spart_user_name') || '',
    isMicActive: true,          // Continuous mic listening on by default
    isSpeaking: false,
    isListening: false,
    researchMode: 'general',
    geminiApiKey: localStorage.getItem('spart_gemini_key') || '',
    selectedVoiceURI: localStorage.getItem('spart_voice_uri') || '',
    voiceRate: parseFloat(localStorage.getItem('spart_voice_rate') || '1.0'),
    voicePitch: parseFloat(localStorage.getItem('spart_voice_pitch') || '1.0'),
    currentGreeting: "I am your assistant S.P.A.R.T (SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS). I am here to help and fulfill your needs based on my performance.",
    history: []
  };

  // Speech Recognition & Synthesis handles
  let recognition = null;
  let synth = window.speechSynthesis;
  let availableVoices = [];
  let speechRestartTimeout = null;
  let silenceTimer = null;
  let activeUtterance = null;

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const elements = {
    // Top Nav & Brand
    menuToggleBtn: document.getElementById('menuToggleBtn'),
    systemStatus: document.getElementById('systemStatus'),
    userPill: document.getElementById('userPill'),
    userAvatar: document.getElementById('userAvatar'),
    navUserName: document.getElementById('navUserName'),

    // Sidebar & Drawer
    sidebarDrawer: document.getElementById('sidebarDrawer'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    sidebarAvatar: document.getElementById('sidebarAvatar'),
    sidebarUserName: document.getElementById('sidebarUserName'),
    editNameBtn: document.getElementById('editNameBtn'),
    voiceSelect: document.getElementById('voiceSelect'),
    voiceRate: document.getElementById('voiceRate'),
    voiceRateVal: document.getElementById('voiceRateVal'),
    voicePitch: document.getElementById('voicePitch'),
    voicePitchVal: document.getElementById('voicePitchVal'),
    testVoiceBtn: document.getElementById('testVoiceBtn'),
    geminiApiKey: document.getElementById('geminiApiKey'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    replayGreetingBtn: document.getElementById('replayGreetingBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    modePills: document.querySelectorAll('.mode-pill'),

    // Home Page - Element 1: Output & Visualizer
    outputSection: document.getElementById('outputSection'),
    visualizerContainer: document.getElementById('visualizerContainer'),
    voiceStateLabel: document.getElementById('voiceStateLabel'),
    transcriptPreviewBox: document.getElementById('transcriptPreviewBox'),
    liveTranscriptText: document.getElementById('liveTranscriptText'),
    aiResponseViewport: document.getElementById('aiResponseViewport'),
    currentResponseCard: document.getElementById('currentResponseCard'),
    responseCardBody: document.getElementById('responseCardBody'),
    historyContainer: document.getElementById('historyContainer'),
    speakAgainBtn: document.getElementById('speakAgainBtn'),
    copyResponseBtn: document.getElementById('copyResponseBtn'),

    // Home Page - Element 2: Master Mic (Above typing bar)
    masterMicBtn: document.getElementById('masterMicBtn'),
    micStatusText: document.getElementById('micStatusText'),
    micIconActive: document.querySelector('.mic-icon-active'),
    micIconMuted: document.querySelector('.mic-icon-muted'),

    // Home Page - Element 3: Typing Bar
    textQueryForm: document.getElementById('textQueryForm'),
    userTextInput: document.getElementById('userTextInput'),
    sendTextBtn: document.getElementById('sendTextBtn'),

    // Name Prompt Dialog Modal
    namePromptModal: document.getElementById('namePromptModal'),
    nameForm: document.getElementById('nameForm'),
    userNameInput: document.getElementById('userNameInput')
  };

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    setupSidebarEvents();
    setupVoiceSynthesis();
    setupSpeechRecognition();
    setupHomeEvents();
    loadUserSettings();

    // Check if user name exists, otherwise show modal on opening webpage
    if (!state.userName) {
      promptUserName();
    } else {
      updateUserDisplay();
      setTimeout(() => {
        speakGreeting();
      }, 700);
    }
  }

  // ==========================================================================
  // User Identity & Name Modal Logic
  // ==========================================================================
  function promptUserName() {
    elements.userNameInput.value = state.userName || '';
    if (typeof elements.namePromptModal.showModal === 'function') {
      elements.namePromptModal.showModal();
    } else {
      const entered = window.prompt("Welcome to S.P.A.R.T! Please enter your name:", "Guest");
      if (entered) applyNewName(entered);
    }
  }

  function applyNewName(name) {
    const sanitized = (name || '').trim() || 'Researcher';
    state.userName = sanitized;
    localStorage.setItem('spart_user_name', sanitized);
    updateUserDisplay();

    // After getting name, the AI should speak the official S.P.A.R.T greeting
    setTimeout(() => {
      speakGreeting();
    }, 400);
  }

  function updateUserDisplay() {
    const initial = (state.userName.charAt(0) || 'U').toUpperCase();
    elements.userAvatar.textContent = initial;
    elements.sidebarAvatar.textContent = initial;
    elements.navUserName.textContent = state.userName || 'Guest';
    elements.sidebarUserName.textContent = state.userName || 'Guest User';
  }

  elements.nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = elements.userNameInput.value;
    if (val.trim()) {
      elements.namePromptModal.close();
      applyNewName(val);
    }
  });

  elements.editNameBtn.addEventListener('click', () => {
    closeSidebar();
    promptUserName();
  });

  elements.userPill.addEventListener('click', () => {
    openSidebar();
  });

  // ==========================================================================
  // Sidebar Drawer Logic
  // (Closed by default, opens ONLY when menu bar icon is activated)
  // ==========================================================================
  function setupSidebarEvents() {
    elements.menuToggleBtn.addEventListener('click', () => {
      toggleSidebar();
    });

    elements.closeSidebarBtn.addEventListener('click', () => {
      closeSidebar();
    });

    elements.sidebarBackdrop.addEventListener('click', () => {
      closeSidebar();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.sidebarDrawer.classList.contains('open')) {
        closeSidebar();
      }
    });

    // Voice sliders
    elements.voiceRate.addEventListener('input', (e) => {
      state.voiceRate = parseFloat(e.target.value);
      elements.voiceRateVal.textContent = state.voiceRate.toFixed(2) + 'x';
      localStorage.setItem('spart_voice_rate', state.voiceRate);
    });

    elements.voicePitch.addEventListener('input', (e) => {
      state.voicePitch = parseFloat(e.target.value);
      elements.voicePitchVal.textContent = state.voicePitch.toFixed(2);
      localStorage.setItem('spart_voice_pitch', state.voicePitch);
    });

    elements.voiceSelect.addEventListener('change', (e) => {
      state.selectedVoiceURI = e.target.value;
      localStorage.setItem('spart_voice_uri', state.selectedVoiceURI);
    });

    elements.testVoiceBtn.addEventListener('click', () => {
      const testMsg = `Greetings, ${state.userName || 'Researcher'}. S.P.A.R.T voice synthesis is configured and operational.`;
      speakText(testMsg, false);
    });

    // Research Mode selection
    elements.modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        elements.modePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.researchMode = pill.getAttribute('data-mode');
        speakText(`Research mode updated to ${pill.textContent}.`, false);
      });
    });

    // Gemini API Key
    elements.geminiApiKey.value = state.geminiApiKey;
    elements.saveApiKeyBtn.addEventListener('click', () => {
      state.geminiApiKey = elements.geminiApiKey.value.trim();
      localStorage.setItem('spart_gemini_key', state.geminiApiKey);
      alert('API Key updated successfully.');
    });

    // Replay Intro
    elements.replayGreetingBtn.addEventListener('click', () => {
      closeSidebar();
      speakGreeting();
    });

    // Clear Chat
    elements.clearChatBtn.addEventListener('click', () => {
      elements.historyContainer.innerHTML = '';
      state.history = [];
      closeSidebar();
      displayAIResponse(
        `<p>Conversation memory cleared. S.P.A.R.T is ready for your next research inquiry.</p>`,
        `Conversation reset successfully. How may I assist you now, ${state.userName}?`
      );
    });
  }

  function openSidebar() {
    elements.sidebarDrawer.classList.add('open');
    elements.sidebarBackdrop.classList.add('active');
    elements.menuToggleBtn.classList.add('active');
    elements.sidebarDrawer.setAttribute('aria-hidden', 'false');
    elements.sidebarBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeSidebar() {
    elements.sidebarDrawer.classList.remove('open');
    elements.sidebarBackdrop.classList.remove('active');
    elements.menuToggleBtn.classList.remove('active');
    elements.sidebarDrawer.setAttribute('aria-hidden', 'true');
    elements.sidebarBackdrop.setAttribute('aria-hidden', 'true');
  }

  function toggleSidebar() {
    if (elements.sidebarDrawer.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // ==========================================================================
  // Voice Synthesis (S.P.A.R.T Voice Speech)
  // ==========================================================================
  function setupVoiceSynthesis() {
    if (!synth) {
      console.warn('SpeechSynthesis not supported on this browser.');
      return;
    }

    function populateVoices() {
      availableVoices = synth.getVoices();
      if (!availableVoices.length) return;

      elements.voiceSelect.innerHTML = '';
      let defaultSelected = false;

      availableVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [Default]' : ''}`;
        
        if (state.selectedVoiceURI && voice.voiceURI === state.selectedVoiceURI) {
          option.selected = true;
          defaultSelected = true;
        } else if (!defaultSelected && (voice.lang.includes('en') || voice.default)) {
          if (voice.name.includes('Natural') || voice.name.includes('Google') || voice.name.includes('Online')) {
            option.selected = true;
            defaultSelected = true;
            state.selectedVoiceURI = voice.voiceURI;
          }
        }
        elements.voiceSelect.appendChild(option);
      });
    }

    populateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoices;
    }

    elements.voiceRate.value = state.voiceRate;
    elements.voiceRateVal.textContent = state.voiceRate.toFixed(2) + 'x';
    elements.voicePitch.value = state.voicePitch;
    elements.voicePitchVal.textContent = state.voicePitch.toFixed(2);
  }

  /**
   * AI Spoken Greeting requirement:
   * "I am your assitant S.P.A.R.T (SMART. PERPETUAL. ASSISTANT for RESEACH. TASKS) I HERE TO HELP AND FULFILL YOUR NEEDS BASED ON MY PERFORMANCE"
   */
  function speakGreeting() {
    const greetingSpoken = `Hello ${state.userName}! I am your assistant S.P.A.R.T: Smart, Perpetual Assistant for Research Tasks. I am here to help and fulfill your needs based on my performance.`;
    
    const displayHTML = `
      <p class="welcome-lead">
        "Hello <strong>${escapeHTML(state.userName)}</strong>! I am your assistant <strong>S.P.A.R.T</strong> (SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS). I am here to help and fulfill your needs based on my performance."
      </p>
      <div class="welcome-guide">
        <div class="guide-item">
          <span class="guide-icon">🎙️</span>
          <span><strong>Continuous Voice Mode:</strong> Speak your question anytime. S.P.A.R.T listens and replies with voice and text.</span>
        </div>
        <div class="guide-item">
          <span class="guide-icon">⌨️</span>
          <span><strong>Typing Option:</strong> If you prefer writing, type your research queries into the bar below.</span>
        </div>
        <div class="guide-item">
          <span class="guide-icon">🧠</span>
          <span><strong>Active Intelligence:</strong> Powered by Gemini API to provide accurate, comprehensive research answers.</span>
        </div>
      </div>
    `;

    displayAIResponse(displayHTML, greetingSpoken);
  }

  function speakText(textToSpeak, restartMicAfter = true) {
    if (!synth) return;

    // Pause recognition while S.P.A.R.T speaks to avoid self-echo feedback
    pauseRecognitionTemporarily();
    synth.cancel();

    // Clean text for speech: remove code blocks, markdown asterisks, URLs
    let cleanText = textToSpeak
      .replace(/```[\s\S]*?```/g, 'Code block provided on screen.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]*>?/gm, '')
      .replace(/[*_#~]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    // Limit voice speech to the first 2-3 sentences for pleasant auditory brevity
    const sentenceList = cleanText.split(/(?<=[.?!])\s+/);
    if (sentenceList.length > 3) {
      cleanText = sentenceList.slice(0, 3).join(' ') + ' The complete details are shown on your screen.';
    }

    activeUtterance = new SpeechSynthesisUtterance(cleanText);
    
    if (state.selectedVoiceURI && availableVoices.length) {
      const foundVoice = availableVoices.find(v => v.voiceURI === state.selectedVoiceURI);
      if (foundVoice) activeUtterance.voice = foundVoice;
    }

    activeUtterance.rate = state.voiceRate;
    activeUtterance.pitch = state.voicePitch;

    activeUtterance.onstart = () => {
      state.isSpeaking = true;
      setVisualizerState('speaking');
    };

    activeUtterance.onend = () => {
      state.isSpeaking = false;
      activeUtterance = null;
      if (state.isMicActive && restartMicAfter) {
        setVisualizerState('listening');
        resumeRecognition();
      } else {
        setVisualizerState('idle');
      }
    };

    activeUtterance.onerror = (err) => {
      console.warn('Speech synthesis error:', err);
      state.isSpeaking = false;
      activeUtterance = null;
      if (state.isMicActive && restartMicAfter) {
        setVisualizerState('listening');
        resumeRecognition();
      }
    };

    synth.speak(activeUtterance);
  }

  // ==========================================================================
  // Speech Recognition (Speech-to-Text with Continuous Listening)
  // ==========================================================================
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      elements.voiceStateLabel.textContent = 'Voice recognition not supported in this browser. Please use Typing bar.';
      elements.micStatusText.textContent = 'Speech Recognition API unavailable in this browser';
      elements.masterMicBtn.classList.add('muted');
      elements.masterMicBtn.disabled = true;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      state.isListening = true;
      if (!state.isSpeaking) {
        setVisualizerState('listening');
      }
    };

    recognition.onresult = (event) => {
      if (state.isSpeaking) return;

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();

      if (activeText) {
        elements.transcriptPreviewBox.style.display = 'flex';
        elements.liveTranscriptText.textContent = activeText;

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (activeText.length > 1 && !state.isSpeaking) {
            const query = activeText;
            finalTranscript = '';
            elements.transcriptPreviewBox.style.display = 'none';
            handleUserQuery(query);
          }
        }, 1300);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition event:', event.error);
      if (event.error === 'not-allowed') {
        elements.voiceStateLabel.textContent = 'Microphone access denied. Please allow microphone.';
        state.isMicActive = false;
        updateMicButtonUI();
      }
    };

    recognition.onend = () => {
      state.isListening = false;
      if (state.isMicActive && !state.isSpeaking) {
        clearTimeout(speechRestartTimeout);
        speechRestartTimeout = setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {}
        }, 250);
      }
    };

    if (state.isMicActive) {
      try {
        recognition.start();
      } catch (e) {}
    }
  }

  function pauseRecognitionTemporarily() {
    if (recognition && state.isListening) {
      try {
        recognition.abort();
      } catch (e) {}
    }
  }

  function resumeRecognition() {
    if (!state.isMicActive || !recognition) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  // ==========================================================================
  // Master Mic Button Controls (Element 2)
  // Continuous listening until user clicks the mic button
  // ==========================================================================
  elements.masterMicBtn.addEventListener('click', () => {
    toggleContinuousMic();
  });

  function toggleContinuousMic() {
    state.isMicActive = !state.isMicActive;
    updateMicButtonUI();

    if (state.isMicActive) {
      resumeRecognition();
      setVisualizerState('listening');
      speakText(`Continuous voice mode activated. I am listening, ${state.userName}.`, true);
    } else {
      pauseRecognitionTemporarily();
      if (synth) synth.cancel();
      setVisualizerState('muted');
    }
  }

  function updateMicButtonUI() {
    if (state.isMicActive) {
      elements.masterMicBtn.classList.remove('muted');
      elements.masterMicBtn.classList.add('active');
      elements.micIconActive.style.display = 'block';
      elements.micIconMuted.style.display = 'none';
      elements.micStatusText.textContent = 'Continuous Mic: ON (Listening to your voice commands)';
      elements.visualizerContainer.classList.remove('muted');
    } else {
      elements.masterMicBtn.classList.remove('active');
      elements.masterMicBtn.classList.add('muted');
      elements.micIconActive.style.display = 'none';
      elements.micIconMuted.style.display = 'block';
      elements.micStatusText.textContent = 'Continuous Mic: OFF (Click to activate voice listening)';
      elements.visualizerContainer.classList.add('muted');
      elements.voiceStateLabel.textContent = 'Mic Muted • Click Mic Button to Resume';
    }
  }

  // ==========================================================================
  // Visualizer States
  // ==========================================================================
  function setVisualizerState(mode) {
    elements.visualizerContainer.classList.remove('listening', 'speaking', 'muted');

    if (mode === 'speaking') {
      elements.visualizerContainer.classList.add('speaking');
      elements.voiceStateLabel.textContent = 'S.P.A.R.T is Speaking...';
    } else if (mode === 'listening') {
      elements.visualizerContainer.classList.add('listening');
      elements.voiceStateLabel.textContent = 'Continuous Mic Active • Listening to you...';
    } else if (mode === 'muted') {
      elements.visualizerContainer.classList.add('muted');
      elements.voiceStateLabel.textContent = 'Microphone Muted • Click Mic to Start';
    } else {
      elements.voiceStateLabel.textContent = 'S.P.A.R.T Ready';
    }
  }

  // ==========================================================================
  // Typing Bar Logic (Element 3)
  // ==========================================================================
  function setupHomeEvents() {
    elements.textQueryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = elements.userTextInput.value.trim();
      if (query) {
        elements.userTextInput.value = '';
        handleUserQuery(query);
      }
    });

    elements.speakAgainBtn.addEventListener('click', () => {
      if (state.currentSpokenText) {
        speakText(state.currentSpokenText, true);
      }
    });

    elements.copyResponseBtn.addEventListener('click', () => {
      const textToCopy = elements.responseCardBody.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        elements.copyResponseBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        setTimeout(() => {
          elements.copyResponseBtn.innerHTML = `
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          `;
        }, 1800);
      });
    });
  }

  // ==========================================================================
  // Intelligent Research & Voice Conversational Engine
  // ==========================================================================
  async function handleUserQuery(queryText) {
    if (!queryText || !queryText.trim()) return;

    appendUserMessageToHistory(queryText);

    elements.responseCardBody.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; color: var(--accent-cyan); padding: 12px 0;">
        <span class="status-pulse"></span>
        <span>Consulting S.P.A.R.T research intelligence for you, <strong>${escapeHTML(state.userName || 'Researcher')}</strong>...</span>
      </div>
    `;
    elements.voiceStateLabel.textContent = 'S.P.A.R.T is processing research inquiry...';

    try {
      const response = await generateSmartResponse(queryText);
      displayAIResponse(response.displayHTML, response.spokenText);
    } catch (err) {
      console.error(err);
      displayAIResponse(
        `<p>I apologize, ${escapeHTML(state.userName)}. I encountered an anomaly while processing that query. Please restate your research objective.</p>`,
        `I apologize, ${state.userName}. I encountered an anomaly while processing that inquiry. Please restate your request.`
      );
    }
  }

  function appendUserMessageToHistory(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble-user';
    bubble.innerHTML = `
      <span class="speaker-tag">${escapeHTML(state.userName || 'You')}</span>
      <div>${escapeHTML(text)}</div>
    `;
    elements.historyContainer.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function displayAIResponse(displayHTML, spokenText) {
    state.currentSpokenText = spokenText;
    elements.responseCardBody.innerHTML = displayHTML;
    elements.currentResponseCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    speakText(spokenText, true);
  }

  // ==========================================================================
  // Conversational Intelligence Engine (Gemini API + Local Knowledge)
  // ==========================================================================
  async function generateSmartResponse(rawQuery) {
    const query = rawQuery.trim().toLowerCase();

    // 1. Direct Voice System Commands
    if (query.includes('open sidebar') || query.includes('open menu') || query.includes('show menu')) {
      openSidebar();
      return {
        displayHTML: `<p>Opening the sidebar menu for you now, <strong>${escapeHTML(state.userName)}</strong>.</p>`,
        spokenText: `Opening the sidebar menu for you now, ${state.userName}.`
      };
    }

    if (query.includes('close sidebar') || query.includes('close menu') || query.includes('hide menu')) {
      closeSidebar();
      return {
        displayHTML: `<p>Sidebar menu closed, <strong>${escapeHTML(state.userName)}</strong>.</p>`,
        spokenText: `Sidebar menu closed, ${state.userName}.`
      };
    }

    if (query.includes('change my name') || query.startsWith('my name is ') || query.startsWith('call me ')) {
      let newName = '';
      if (query.startsWith('my name is ')) newName = rawQuery.substring(11).trim();
      else if (query.startsWith('call me ')) newName = rawQuery.substring(8).trim();
      else newName = rawQuery.replace(/.*change my name to\s+/i, '').trim();

      if (newName) {
        applyNewName(newName);
        return {
          displayHTML: `<p>It is my honor to address you as <strong>${escapeHTML(newName)}</strong>. System records updated.</p>`,
          spokenText: `It is my honor to address you as ${newName}. System records have been updated.`
        };
      }
    }

    if (query.includes('clear chat') || query.includes('clear history') || query.includes('reset conversation')) {
      elements.historyContainer.innerHTML = '';
      return {
        displayHTML: `<p>Conversation history has been cleared. S.P.A.R.T is ready for new research.</p>`,
        spokenText: `Conversation history has been cleared, ${state.userName}. S.P.A.R.T is ready for new research tasks.`
      };
    }

    if (query.includes('who are you') || query.includes('what is spart') || query.includes('what is s.p.a.r.t')) {
      return {
        displayHTML: `
          <p>I am <strong>S.P.A.R.T</strong> — an acronym for <strong>Smart. Perpetual. Assistant for Research. Tasks.</strong></p>
          <p>I am engineered to operate autonomously through continuous voice and text, helping you explore scientific concepts, conduct literature reviews, synthesize knowledge, and fulfill your research objectives with utmost precision.</p>
        `,
        spokenText: `I am S.P.A.R.T: Smart, Perpetual Assistant for Research Tasks. I am here to help and fulfill your needs based on my performance.`
      };
    }

    // 2. Query Gemini API via Local Server Proxy or Direct API
    try {
      const geminiResult = await fetchGeminiAnswer(rawQuery);
      if (geminiResult) return geminiResult;
    } catch (e) {
      console.warn('Gemini proxy error, trying fallback:', e);
    }

    // 3. Fallback: Live Wikipedia Search
    const encyclopedicPattern = /(?:what is|who is|who was|tell me about|explain|search for|define|describe|history of|research on)\s+([a-zA-Z0-9\s\-]+)/i;
    const match = rawQuery.match(encyclopedicPattern);
    const searchTarget = match ? match[1].trim() : rawQuery.trim();

    if (searchTarget.length > 2) {
      const wikiData = await fetchWikipediaSummary(searchTarget);
      if (wikiData) {
        return {
          displayHTML: `
            <p><strong>${escapeHTML(wikiData.title)}:</strong></p>
            <p>${escapeHTML(wikiData.extract)}</p>
            ${wikiData.content_urls ? `<p style="font-size: 0.82rem; color: var(--text-muted);"><a href="${wikiData.content_urls.desktop.page}" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">View Academic Source ↗</a></p>` : ''}
          `,
          spokenText: `Certainly, ${state.userName}. ${wikiData.title}: ${wikiData.extract.split('. ').slice(0, 2).join('. ')}.`
        };
      }
    }

    // 4. Fallback: Curated Knowledge Base
    const localAnswer = queryKnowledgeBase(query);
    if (localAnswer) {
      return {
        displayHTML: localAnswer.html,
        spokenText: `Certainly, ${state.userName}. ${localAnswer.speech}`
      };
    }

    return {
      displayHTML: `
        <p>I have processed your query: <em>"${escapeHTML(rawQuery)}"</em>.</p>
        <p>In accordance with our research protocols in <strong>${escapeHTML(state.researchMode)} mode</strong>, I am ready to delve further into this topic.</p>
      `,
      spokenText: `I have analyzed your request regarding "${rawQuery}". How would you like me to proceed, ${state.userName}?`
    };
  }

  // ==========================================================================
  // Gemini API Fetcher (Backend Proxy + Direct Fallback)
  // ==========================================================================
  async function fetchGeminiAnswer(prompt) {
    // Attempt 1: Call server proxy /api/ask
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          userName: state.userName || 'Researcher',
          mode: state.researchMode || 'general'
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.text) {
          return formatGeminiResponse(json.text);
        }
      }
    } catch (proxyErr) {
      console.warn('Server proxy unavailable, falling back to client-side fetch:', proxyErr);
    }

    // Attempt 2: Direct browser call to Gemini 3.5 Flash Lite
    const apiKey = state.geminiApiKey;
    if (!apiKey) return null;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    
    const systemPrompt = `You are S.P.A.R.T (Smart Perpetual Assistant for Research Tasks), speaking to ${state.userName || 'Researcher'}.
Always reply with an articulate, polite, well-mannered research tone. Provide accurate and factual explanations.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: systemPrompt + '\n\n' + prompt }]
        }]
      })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.candidates && json.candidates[0] && json.candidates[0].content) {
        const answerText = json.candidates[0].content.parts[0].text;
        return formatGeminiResponse(answerText);
      }
    }

    return null;
  }

  function formatGeminiResponse(text) {
    // Format markdown to HTML
    let html = escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = `<p>${html}</p>`;

    // Extract first 1-2 sentences for speech
    const plainText = text.replace(/[*_#`]/g, '').trim();
    const sentences = plainText.split(/(?<=[.?!])\s+/);
    const spoken = sentences.slice(0, 2).join(' ') || plainText.substring(0, 160);

    return {
      displayHTML: html,
      spokenText: spoken
    };
  }

  // ==========================================================================
  // Wikipedia REST API Integration
  // ==========================================================================
  async function fetchWikipediaSummary(term) {
    try {
      const formattedTerm = encodeURIComponent(term.replace(/\s+/g, '_'));
      const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTerm}`;
      
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        const searchEndpoint = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&namespace=0&format=json&origin=*`;
        const searchRes = await fetch(searchEndpoint);
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          if (searchJson[1] && searchJson[1].length > 0) {
            const firstResult = searchJson[1][0];
            const secondaryEndpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.replace(/\s+/g, '_'))}`;
            const secondaryRes = await fetch(secondaryEndpoint);
            if (secondaryRes.ok) return await secondaryRes.json();
          }
        }
        return null;
      }

      const data = await res.json();
      if (data && data.extract && data.type !== 'disambiguation') {
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ==========================================================================
  // Curated Knowledge Base
  // ==========================================================================
  function queryKnowledgeBase(query) {
    const kb = [
      {
        triggers: ['quantum computing', 'qubit', 'superposition'],
        speech: 'Quantum computing harnesses quantum mechanical superposition and entanglement to perform complex computations exponentially faster than classical computers.',
        html: `<p><strong>Quantum Computing:</strong></p><p>Quantum computing processes information in quantum bits (qubits) capable of simultaneous superposition states, accelerating optimization, molecular modeling, and cryptographic research.</p>`
      },
      {
        triggers: ['crispr', 'gene editing', 'cas9'],
        speech: 'CRISPR-Cas9 is an advanced gene-editing technology allowing precise genomic alterations.',
        html: `<p><strong>CRISPR-Cas9:</strong></p><p>A precision gene-editing mechanism derived from bacterial adaptive immunity, utilizing guide RNA and Cas9 endonuclease to introduce targeted genetic modifications.</p>`
      }
    ];

    for (const entry of kb) {
      if (entry.triggers.some(t => query.includes(t))) return entry;
    }
    return null;
  }

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================
  function loadUserSettings() {
    if (state.userName) {
      updateUserDisplay();
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
