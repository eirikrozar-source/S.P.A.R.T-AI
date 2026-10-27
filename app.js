/**
 * S.P.A.R.T: Smart Perpetual Assistant for Research Tasks
 * Voice-First Client Application Logic
 * Supports: Continuous Voice Input, Male AI Voice Synthesis, Study & Career Intelligence
 */

// Application State
const AppState = {
  currentMode: 'general', // 'general', 'study', 'career'
  currentChatId: null,
  chats: [],
  isGenerating: false,
  isMicActive: false, // User continuous listening state
  isSpeaking: false,
  isVoiceAudioMuted: false,
  attachedFile: null,
  recognitionInstance: null,
  silenceTimer: null,
  lastTranscript: '',
  voiceLanguage: 'en-IN', // 'en-IN' or 'ta-IN'
  audioStream: null,
  audioContext: null,
  analyserNode: null,
  audioAnimFrame: null,
  mediaRecorder: null,
  recordedAudioChunks: [],
  isFallbackRecording: false,
  settings: {
    theme: 'dark',
    defaultMode: 'general',
    userName: '',
    hasIntroduced: false
  }
};

// DOM Cache
const DOM = {
  // Onboarding
  nameModalOverlay: document.getElementById('nameModalOverlay'),
  initialNameInput: document.getElementById('initialNameInput'),
  btnInitializeSpart: document.getElementById('btnInitializeSpart'),

  // Sidebar & Top Nav
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  menuBarIconBtn: document.getElementById('menuBarIconBtn'),
  sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  activeModeIndicator: document.getElementById('activeModeIndicator'),
  indicatorText: document.getElementById('indicatorText'),
  voiceMuteToggleBtn: document.getElementById('voiceMuteToggleBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),

  // Sidebar Content
  quickToolsLabel: document.getElementById('quickToolsLabel'),
  quickToolsList: document.getElementById('quickToolsList'),
  chatHistoryList: document.getElementById('chatHistoryList'),
  userNameLabel: document.getElementById('userNameLabel'),
  userAvatar: document.getElementById('userAvatar'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),

  // Viewport & Hero
  chatViewport: document.getElementById('chatViewport'),
  heroScreen: document.getElementById('heroScreen'),
  spartOrbCore: document.getElementById('spartOrbCore'),
  voiceStatusTitle: document.getElementById('voiceStatusTitle'),
  voiceStatusSub: document.getElementById('voiceStatusSub'),
  liveTranscriptBox: document.getElementById('liveTranscriptBox'),
  liveTranscriptText: document.getElementById('liveTranscriptText'),
  messagesContainer: document.getElementById('messagesContainer'),
  followUpsBar: document.getElementById('followUpsBar'),
  followUpsList: document.getElementById('followUpsList'),

  // Dock: Dynamic Voice Command Board (Above Mic)
  voiceCommandBoard: document.getElementById('voiceCommandBoard'),
  voiceCommandStatus: document.getElementById('voiceCommandStatus'),
  voiceActionPill: document.getElementById('voiceActionPill'),
  voicePrintedContent: document.getElementById('voicePrintedContent'),
  voiceTypingCursor: document.getElementById('voiceTypingCursor'),

  // Dock: Mic + Typing Bar + Hardware & Language
  prominentMicBtn: document.getElementById('prominentMicBtn'),
  micStatusText: document.getElementById('micStatusText'),
  btnLangEn: document.getElementById('btnLangEn'),
  btnLangTa: document.getElementById('btnLangTa'),
  micHardwareStatus: document.getElementById('micHardwareStatus'),
  micVolumeFill: document.getElementById('micVolumeFill'),
  micHardwareText: document.getElementById('micHardwareText'),
  inputContainer: document.getElementById('inputContainer'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  attachBtn: document.getElementById('attachBtn'),
  fileInput: document.getElementById('fileInput'),
  attachmentTray: document.getElementById('attachmentTray'),
  attachedFileName: document.getElementById('attachedFileName'),
  removeAttachmentBtn: document.getElementById('removeAttachmentBtn'),
  inputModeTag: document.getElementById('inputModeTag'),
  inputModeTagIcon: document.getElementById('inputModeTagIcon'),
  inputModeTagText: document.getElementById('inputModeTagText'),

  // Modals & Floating UI
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  userNameInput: document.getElementById('userNameInput'),
  clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),
  toastNotification: document.getElementById('toastNotification'),
  toastMessage: document.getElementById('toastMessage')
};

// ==========================================================================
// INITIALIZATION & ONBOARDING
// ==========================================================================

function initApp() {
  loadStoredSettings();
  loadStoredChats();
  applyTheme(AppState.settings.theme);

  // Set default mode
  setMode(AppState.settings.defaultMode || 'general', false);

  // Set up event listeners
  setupEventListeners();

  // Always display name onboarding modal on visit so user confirms name and unlocks browser audio
  const savedName = localStorage.getItem('spart_user_name') || AppState.settings.userName || 'Devadharshini';
  AppState.settings.userName = savedName;
  if (DOM.initialNameInput) DOM.initialNameInput.value = savedName;
  if (DOM.nameModalOverlay) {
    DOM.nameModalOverlay.style.display = 'flex';
    setTimeout(() => {
      if (DOM.initialNameInput) DOM.initialNameInput.focus();
    }, 120);
  }

  // Pre-load speech synthesis voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

function handleNameSubmission() {
  const enteredName = DOM.initialNameInput.value.trim() || 'Devadharshini';
  AppState.settings.userName = enteredName;
  localStorage.setItem('spart_user_name', enteredName);
  saveSettings();

  DOM.nameModalOverlay.style.display = 'none';
  updateUserNameDisplay(enteredName);

  if (AppState.chats.length === 0) {
    createNewChat();
  } else {
    loadChat(AppState.chats[0].id);
  }

  // Play S.P.A.R.T voice introduction requested by user, then make mic continuously listen
  playInitialSpartIntroduction(enteredName);
}

function updateUserNameDisplay(name) {
  if (DOM.userNameLabel) DOM.userNameLabel.textContent = name;
  if (DOM.userAvatar) DOM.userAvatar.textContent = name.charAt(0).toUpperCase();
  if (DOM.userNameInput) DOM.userNameInput.value = name;
  if (DOM.voiceStatusTitle) DOM.voiceStatusTitle.textContent = `Ready to assist you, ${name}`;
}

/**
 * Speaks S.P.A.R.T's exact opening phrase requested by the user:
 * "I am your assistant S.P.A.R.T (SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS) I AM HERE TO HELP AND FULFILL YOUR NEEDS BASED ON MY PERFORMANCE"
 */
function playInitialSpartIntroduction(name) {
  const introText = "I am your assistant S.P.A.R.T (SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS). I am here to help and fulfill your needs based on my performance.";

  // Display initial assistant greeting message visually in chat
  const currentChat = getCurrentChat();
  if (currentChat && currentChat.messages.length === 0) {
    const welcomeMsg = {
      role: 'assistant',
      content: `### 🛡️ S.P.A.R.T Initialized\n\n**I am your assistant S.P.A.R.T** (*SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS*).\n\nI am here to help and fulfill your needs based on my performance.\n\n- 🎓 **Study Intelligence:** Feynman explanations, interactive quizzes & flashcards.\n- 💼 **Career Intelligence:** ATS resume optimization & mock interviews.\n- 🟢 **Universal AI:** Multi-disciplinary problem solving & coding.`,
      timestamp: Date.now()
    };
    currentChat.messages.push(welcomeMsg);
    saveChats();
    renderChatUI();
  }

  // Speak aloud in male assistant voice through speaker/audio, then activate mic for user speech
  speakSpartVoice(introText, () => {
    // S.P.A.R.T finished introduction: make the mic immediately ready to listen continuously to the user!
    startContinuousListening();
    showToast('S.P.A.R.T is ready: Speak your command!');
  });
}

// ==========================================================================
// VOICE SYNTHESIS (MALE AI VOICE - WELL-MANNERED & ACCURATE)
// ==========================================================================

function speakSpartVoice(textToSpeak, onComplete) {
  if (AppState.isVoiceAudioMuted || !('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  window.speechSynthesis.cancel();

  // Strip code blocks and raw markdown for natural pronunciation
  const cleanSpoken = textToSpeak
    .replace(/```[\s\S]*?```/g, 'I have displayed the code implementation on your screen.')
    .replace(/\$\$[\s\S]*?\$\$/g, 'I have displayed the mathematical formula on your screen.')
    .replace(/\$[^$]+\$/g, '')
    .replace(/[*#`_>|]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanSpoken);

  // Select dignified male AI voice
  const maleVoice = getPreferredMaleVoice();
  if (maleVoice) {
    utterance.voice = maleVoice;
  }

  // Well-mannered male pitch and rhythm
  utterance.pitch = 0.94; // slightly deeper male pitch
  utterance.rate = 1.0;   // calm, steady rate
  utterance.volume = 1.0;

  AppState.isSpeaking = true;
  updateVisualizerState('speaking');

  // If continuous mic was listening, temporarily pause recognition so S.P.A.R.T doesn't hear itself
  pauseMicWhileSpeaking();

  window.currentSpartUtterance = utterance;

  let hasFinished = false;
  const finishSpeech = () => {
    if (hasFinished) return;
    hasFinished = true;
    clearTimeout(window.spartSpeechSafetyTimer);
    AppState.isSpeaking = false;
    window.currentSpartUtterance = null;
    updateVisualizerState('idle');
    resumeMicAfterSpeaking();
    if (onComplete) {
      const cb = onComplete;
      onComplete = null;
      cb();
    }
  };

  utterance.onend = finishSpeech;
  utterance.onerror = (e) => {
    console.warn('Speech synthesis event:', e);
    finishSpeech();
  };

  // Watchdog timer: in case Chromium drops onend event, recover automatically
  const wordCount = (cleanSpoken.split(/\s+/) || []).length;
  const safetyTimeout = Math.max(3000, wordCount * 550);
  clearTimeout(window.spartSpeechSafetyTimer);
  window.spartSpeechSafetyTimer = setTimeout(() => {
    if (AppState.isSpeaking) {
      console.warn('Speech safety watchdog triggered; resuming mic state');
      finishSpeech();
    }
  }, safetyTimeout);

  window.speechSynthesis.speak(utterance);
}

function getPreferredMaleVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Search for male voices across platforms
  const maleKeywords = [
    'Google UK English Male',
    'Microsoft David',
    'Microsoft Mark',
    'Microsoft George',
    'Daniel',
    'Alex',
    'en-US-Standard-B',
    'en-US-Standard-D',
    'en-US-Neural2-D',
    'en-US-Wavenet-D',
    'Male'
  ];

  for (const kw of maleKeywords) {
    const match = voices.find(v => v.name.includes(kw) || (v.name.toLowerCase().includes('male') && v.lang.startsWith('en')));
    if (match) return match;
  }

  // Fallback: first English voice
  return voices.find(v => v.lang.startsWith('en')) || voices[0];
}

// ==========================================================================
// DYNAMIC VOICE COMMAND BOARD (ABOVE THE MIC) & CONTINUOUS LISTENING
// ==========================================================================

// ==========================================================================
// DYNAMIC VOICE COMMAND BOARD (ABOVE THE MIC) & CONTINUOUS LISTENING
// ==========================================================================

function showUserVoiceCommandBoard(userSpokenText) {
  if (!DOM.voiceCommandBoard) return;
  DOM.voiceCommandBoard.style.display = 'block';
  DOM.voiceCommandBoard.classList.remove('analyzing');
  
  const userIndicator = DOM.voiceCommandBoard.querySelector('.voice-user-indicator');
  if (userIndicator) {
    userIndicator.textContent = 'User Voice:';
    userIndicator.style.color = '#38bdf8';
  }

  if (DOM.voicePrintedContent) {
    DOM.voicePrintedContent.textContent = userSpokenText || '';
  }
  if (DOM.voiceCommandStatus) {
    DOM.voiceCommandStatus.textContent = 'VOICE COMMAND INPUT • LISTENING';
  }
  if (DOM.voiceActionPill) {
    DOM.voiceActionPill.textContent = 'Live Voice';
  }

  if (DOM.prominentMicBtn) {
    if (userSpokenText && userSpokenText.trim().length > 0) {
      DOM.prominentMicBtn.classList.add('user-speaking');
    }
  }

  if (DOM.micStatusText && AppState.isMicActive) {
    DOM.micStatusText.textContent = userSpokenText ? '🎙️ Recognizing speech...' : '🟢 Mic Active: Listening to you';
  }
}

// Backward compatibility alias for fallback audio transcription
function showVoiceTypingBar(printedText) {
  showUserVoiceCommandBoard(printedText);
}

function hideVoiceTypingBar(onComplete) {
  if (!DOM.voiceCommandBoard) {
    if (onComplete) onComplete();
    return;
  }

  DOM.voiceCommandBoard.classList.add('analyzing');
  if (DOM.voiceCommandStatus) {
    DOM.voiceCommandStatus.textContent = 'ANALYZING VOICE COMMAND...';
  }
  if (DOM.voiceActionPill) {
    DOM.voiceActionPill.textContent = 'Processing AI Model';
  }
  if (DOM.prominentMicBtn) {
    DOM.prominentMicBtn.classList.remove('user-speaking');
  }

  // After analyzing animation, disappear the typing board
  setTimeout(() => {
    DOM.voiceCommandBoard.style.display = 'none';
    DOM.voiceCommandBoard.classList.remove('analyzing');
    if (DOM.voicePrintedContent) DOM.voicePrintedContent.textContent = '';
    if (onComplete) onComplete();
  }, 420);
}

function finalizeVoiceCommandAndSubmit(commandText) {
  clearTimeout(AppState.silenceTimer);
  const cleanCmd = (commandText || '').trim();
  if (!cleanCmd || cleanCmd.length < 2) return;

  // Cleanly abort active recognition instance to reset sentence buffer for next prompt
  if (AppState.recognitionInstance) {
    const prev = AppState.recognitionInstance;
    AppState.recognitionInstance = null;
    prev.onstart = null;
    prev.onspeechstart = null;
    prev.onspeechend = null;
    prev.onresult = null;
    prev.onerror = null;
    prev.onend = null;
    try {
      prev.abort();
    } catch (e) {}
  }
  AppState.isRecognitionRunning = false;

  // 1. The typing board disappears after analyzing
  hideVoiceTypingBar(() => {
    // 2. Submit the command to S.P.A.R.T
    submitUserPrompt(cleanCmd, true);
  });
}

function pauseMicWhileSpeaking() {
  clearTimeout(AppState.silenceTimer);
  if (AppState.recognitionInstance) {
    const prev = AppState.recognitionInstance;
    AppState.recognitionInstance = null;
    prev.onstart = null;
    prev.onspeechstart = null;
    prev.onspeechend = null;
    prev.onresult = null;
    prev.onerror = null;
    prev.onend = null;
    try {
      prev.abort();
    } catch (e) {}
  }
  AppState.isRecognitionRunning = false;

  // The mic is strictly for user voice input: never turn it blue or pretend it speaks
  if (DOM.prominentMicBtn) {
    DOM.prominentMicBtn.classList.remove('user-speaking');
  }
  if (AppState.isMicActive && DOM.micStatusText) {
    DOM.micStatusText.textContent = '🟢 Mic Ready (AI responding)';
  }
}

function resumeMicAfterSpeaking() {
  if (DOM.prominentMicBtn) {
    DOM.prominentMicBtn.classList.remove('user-speaking');
  }

  // When S.P.A.R.T finishes speaking, immediately resume listening if mic is active
  if (AppState.isMicActive) {
    const langLabel = AppState.voiceLanguage === 'ta-IN' ? 'தமிழ்' : 'English';
    if (DOM.micStatusText) {
      DOM.micStatusText.textContent = `🟢 Mic Active: Listening (${langLabel})`;
    }
    setTimeout(() => {
      if (AppState.isMicActive && !AppState.isSpeaking && !AppState.isGenerating) {
        startRecognition();
      }
    }, 250);
  }
}

// --------------------------------------------------------------------------
// LANGUAGE SWITCHING: ENGLISH & TAMIL
// --------------------------------------------------------------------------
function setVoiceLanguage(langCode) {
  AppState.voiceLanguage = langCode;

  if (DOM.btnLangEn) DOM.btnLangEn.classList.toggle('active', langCode === 'en-IN');
  if (DOM.btnLangTa) DOM.btnLangTa.classList.toggle('active', langCode === 'ta-IN');

  const langLabel = langCode === 'ta-IN' ? 'தமிழ் (Tamil ta-IN)' : 'English (India en-IN)';
  showToast(`Speech language set to: ${langLabel}`);

  if (AppState.isMicActive) {
    if (DOM.micStatusText) {
      DOM.micStatusText.textContent = `MIC READY: LISTENING (${langCode === 'ta-IN' ? 'தமிழ்' : 'English'})`;
    }
    // Clean restart of recognition with new language code
    startRecognition();
  }
}

// --------------------------------------------------------------------------
// HARDWARE AUDIO CAPTURE & VOLUME METER
// --------------------------------------------------------------------------
async function startHardwareAudioCaptureAsync() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return;
  }

  try {
    // If stream is already active and tracks are ready, reuse it
    if (AppState.audioStream && AppState.audioStream.active && AppState.audioStream.getAudioTracks().length > 0) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (!AppState.isMicActive) {
      // User turned off mic while permission was pending
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      return;
    }

    AppState.audioStream = stream;

    // Attach Web Audio API to drive volume meter
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!AppState.audioContext || AppState.audioContext.state === 'closed') {
        AppState.audioContext = new AudioContextClass();
      }
      if (AppState.audioContext.state === 'suspended') {
        await AppState.audioContext.resume();
      }

      const source = AppState.audioContext.createMediaStreamSource(stream);
      AppState.analyserNode = AppState.audioContext.createAnalyser();
      AppState.analyserNode.fftSize = 256;
      AppState.analyserNode.smoothingTimeConstant = 0.5;
      source.connect(AppState.analyserNode);

      startVolumeMonitoring();
    }

    if (DOM.micHardwareStatus) {
      DOM.micHardwareStatus.style.display = 'flex';
    }
    if (DOM.micHardwareText) {
      DOM.micHardwareText.textContent = `Mic active (${AppState.voiceLanguage === 'ta-IN' ? 'Tamil' : 'English'})`;
    }
  } catch (err) {
    console.warn('Optional hardware audio meter skipped:', err.message);
  }
}

function startVolumeMonitoring() {
  if (!AppState.analyserNode) return;
  const dataArray = new Uint8Array(AppState.analyserNode.frequencyBinCount);

  const checkVolume = () => {
    if (!AppState.isMicActive || !AppState.analyserNode) {
      return;
    }

    AppState.analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const level = Math.min(100, Math.round((avg / 128) * 100));

    // Update real-time volume fill width
    if (DOM.micVolumeFill) {
      DOM.micVolumeFill.style.width = `${Math.min(100, level * 2)}%`;
    }

    // If user's voice reaches audible threshold, highlight mic
    if (level > 10 && !AppState.isSpeaking && AppState.isMicActive) {
      if (DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.add('user-speaking');
      }
      if (DOM.micHardwareText) {
        DOM.micHardwareText.textContent = 'Voice detected: Capturing...';
      }
    } else if (level <= 6 && !AppState.silenceTimer && AppState.isMicActive) {
      if (DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.remove('user-speaking');
      }
      if (DOM.micHardwareText) {
        DOM.micHardwareText.textContent = `Mic active (${AppState.voiceLanguage === 'ta-IN' ? 'Tamil' : 'English'})`;
      }
    }

    AppState.audioAnimFrame = requestAnimationFrame(checkVolume);
  };

  if (AppState.audioAnimFrame) {
    cancelAnimationFrame(AppState.audioAnimFrame);
  }
  AppState.audioAnimFrame = requestAnimationFrame(checkVolume);
}

function stopVolumeMonitoring() {
  if (AppState.audioAnimFrame) {
    cancelAnimationFrame(AppState.audioAnimFrame);
    AppState.audioAnimFrame = null;
  }
  if (DOM.micVolumeFill) {
    DOM.micVolumeFill.style.width = '0%';
  }
  if (DOM.micHardwareStatus) {
    DOM.micHardwareStatus.style.display = 'none';
  }

  // Stop media tracks
  if (AppState.audioStream) {
    AppState.audioStream.getTracks().forEach(track => {
      try { track.stop(); } catch(e) {}
    });
    AppState.audioStream = null;
  }

  // Close AudioContext
  if (AppState.audioContext) {
    try {
      if (AppState.audioContext.state !== 'closed') {
        AppState.audioContext.close();
      }
    } catch(e) {}
    AppState.audioContext = null;
    AppState.analyserNode = null;
  }
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// CONTINUOUS VOICE LISTENING CONTROLLER
// --------------------------------------------------------------------------
function toggleContinuousVoiceListening() {
  if (AppState.isMicActive) {
    // User clicked mic button once: turn it OFF completely
    stopContinuousListening();
  } else {
    // User clicked mic button second time: wake up and start listening immediately!
    startContinuousListening();
  }
}

function startContinuousListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Speech recognition not supported in this browser. Please use Chrome or Edge.');
    return;
  }

  // Cancel any active speech synthesis so user voice has immediate floor
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  AppState.isSpeaking = false;
  clearTimeout(window.spartSpeechSafetyTimer);

  // Set active state
  AppState.isMicActive = true;

  // Update UI immediately (Green glow + pulsing ripple rings)
  if (DOM.prominentMicBtn) {
    DOM.prominentMicBtn.classList.remove('user-speaking');
    DOM.prominentMicBtn.classList.add('active-listening');
  }

  const isTamil = AppState.voiceLanguage === 'ta-IN';
  const langLabel = isTamil ? 'தமிழ் (Tamil)' : 'English';
  if (DOM.micStatusText) {
    DOM.micStatusText.textContent = `🟢 Mic Active: Listening (${langLabel})`;
  }
  updateVisualizerState('listening');

  // Clear previous voice print and start speech recognition directly
  if (DOM.voicePrintedContent) DOM.voicePrintedContent.textContent = '';
  startRecognition();

  // Run optional volume meter in background
  startHardwareAudioCaptureAsync();

  showToast('Microphone activated: Speak your command!');
}

function stopContinuousListening() {
  AppState.isMicActive = false;
  AppState.isRecognitionRunning = false;
  clearTimeout(AppState.silenceTimer);
  clearTimeout(window.spartSpeechSafetyTimer);

  // Stop active speech recognition immediately
  if (AppState.recognitionInstance) {
    const prev = AppState.recognitionInstance;
    AppState.recognitionInstance = null;
    prev.onstart = null;
    prev.onspeechstart = null;
    prev.onspeechend = null;
    prev.onresult = null;
    prev.onerror = null;
    prev.onend = null;
    try {
      prev.abort();
    } catch (e) {}
  }

  // Cancel any speech synthesis
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  AppState.isSpeaking = false;
  window.currentSpartUtterance = null;

  // Reset mic button style to OFF (dark/idle, no glow)
  if (DOM.prominentMicBtn) {
    DOM.prominentMicBtn.classList.remove('active-listening', 'ready-listening', 'user-speaking');
  }
  if (DOM.micStatusText) {
    DOM.micStatusText.textContent = '⚪ Mic Off • Click to Speak';
  }
  if (DOM.voiceCommandBoard) {
    DOM.voiceCommandBoard.style.display = 'none';
    DOM.voiceCommandBoard.classList.remove('analyzing');
    if (DOM.voicePrintedContent) DOM.voicePrintedContent.textContent = '';
  }
  updateVisualizerState('idle');

  // Stop volume monitoring
  stopVolumeMonitoring();

  showToast('Microphone turned off. Click mic anytime to activate.');
}

// --------------------------------------------------------------------------
// SPEECH RECOGNITION PIPELINE
// --------------------------------------------------------------------------
function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || !AppState.isMicActive) {
    return;
  }

  // If recognition instance is already actively capturing, return
  if (AppState.isRecognitionRunning && AppState.recognitionInstance) {
    return;
  }

  // Safely cleanup previous instance before starting fresh
  if (AppState.recognitionInstance) {
    const prev = AppState.recognitionInstance;
    AppState.recognitionInstance = null;
    prev.onstart = null;
    prev.onspeechstart = null;
    prev.onspeechend = null;
    prev.onresult = null;
    prev.onerror = null;
    prev.onend = null;
    try {
      prev.abort();
    } catch (e) {}
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = AppState.voiceLanguage || 'en-IN'; // Dynamic language: en-IN or ta-IN
    AppState.recognitionInstance = recognition;

    recognition.onstart = () => {
      AppState.isRecognitionRunning = true;
      if (AppState.isMicActive && DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.add('active-listening');
      }
      const langLabel = AppState.voiceLanguage === 'ta-IN' ? 'தமிழ்' : 'English';
      if (AppState.isMicActive && DOM.micStatusText) {
        DOM.micStatusText.textContent = `🟢 Mic Active: Listening (${langLabel})`;
      }
      updateVisualizerState('listening');
    };

    recognition.onspeechstart = () => {
      if (!AppState.isMicActive) return;
      if (DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.add('user-speaking');
      }
      if (DOM.micStatusText) {
        DOM.micStatusText.textContent = '🎙️ Recognizing speech...';
      }
      showUserVoiceCommandBoard('');
    };

    recognition.onspeechend = () => {
      if (DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.remove('user-speaking');
      }
    };

    recognition.onresult = (event) => {
      if (!AppState.isMicActive) return;

      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item && item[0]) {
          if (item.isFinal) {
            finalTranscript += item[0].transcript + ' ';
          } else {
            interimTranscript += item[0].transcript;
          }
        }
      }

      const activeText = (finalTranscript + interimTranscript).trim();
      if (activeText) {
        // Print recognized speech above mic in the command board (USER'S WORDS ONLY)
        showUserVoiceCommandBoard(activeText);

        // Also sync live text directly into chat message input below mic
        if (DOM.messageInput) {
          DOM.messageInput.value = activeText;
          adjustTextareaHeight();
        }
        if (DOM.sendBtn) DOM.sendBtn.disabled = false;

        // Reset silence timer: when user pauses for 1.2s, finalize and submit
        clearTimeout(AppState.silenceTimer);
        AppState.silenceTimer = setTimeout(() => {
          if (activeText.length > 1 && AppState.isMicActive && !AppState.isGenerating) {
            finalizeVoiceCommandAndSubmit(activeText);
          }
        }, 1200);
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition event:', e.error);

      if (e.error === 'not-allowed') {
        AppState.isMicActive = false;
        AppState.isRecognitionRunning = false;
        if (DOM.prominentMicBtn) {
          DOM.prominentMicBtn.classList.remove('active-listening', 'user-speaking');
        }
        if (DOM.micStatusText) {
          DOM.micStatusText.textContent = '⚪ Mic blocked. Click lock icon in browser to allow.';
        }
        showToast('Please allow microphone access in your browser to speak with S.P.A.R.T');
        return;
      }

      if (e.error === 'network') {
        console.warn('Web Speech API network disconnect. Falling back to server-side audio transcription.');
        startMediaRecorderFallback();
        return;
      }

      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('Speech recognition warning:', e.error);
      }
    };

    recognition.onend = () => {
      AppState.isRecognitionRunning = false;
      if (DOM.prominentMicBtn) {
        DOM.prominentMicBtn.classList.remove('user-speaking');
      }

      // If mic is still active and S.P.A.R.T is not currently speaking, automatically keep listening!
      if (AppState.isMicActive && !AppState.isSpeaking && !AppState.isGenerating) {
        setTimeout(() => {
          if (AppState.isMicActive && !AppState.isSpeaking && !AppState.isGenerating && !AppState.isRecognitionRunning) {
            startRecognition();
          }
        }, 150);
      }
    };

    recognition.start();
  } catch (err) {
    AppState.isRecognitionRunning = false;
    console.warn('Speech recognition start exception:', err.message);
    if (AppState.isMicActive) {
      setTimeout(() => {
        if (AppState.isMicActive && !AppState.isRecognitionRunning && !AppState.isSpeaking) {
          startRecognition();
        }
      }, 300);
    }
  }
}

// --------------------------------------------------------------------------
// SERVER-SIDE AUDIO RECORDING FALLBACK (VIA POST /api/transcribe)
// --------------------------------------------------------------------------
function startMediaRecorderFallback() {
  if (!AppState.audioStream || AppState.isFallbackRecording) return;
  if (typeof MediaRecorder === 'undefined') return;

  try {
    AppState.isFallbackRecording = true;
    AppState.recordedAudioChunks = [];
    const mediaRecorder = new MediaRecorder(AppState.audioStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        AppState.recordedAudioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      AppState.isFallbackRecording = false;
      if (AppState.recordedAudioChunks.length === 0) return;

      const audioBlob = new Blob(AppState.recordedAudioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      if (audioBlob.size < 500) return; // Too short/silent

      showVoiceTypingBar('Transcribing recorded audio with AI...');

      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: base64Audio,
              mimeType: audioBlob.type || 'audio/webm',
              language: AppState.voiceLanguage || 'en-IN'
            })
          });

          if (response.ok) {
            const data = await response.json();
            const transcript = (data.transcript || '').trim();
            if (transcript) {
              showVoiceTypingBar(transcript);
              if (DOM.messageInput) {
                DOM.messageInput.value = transcript;
                adjustTextareaHeight();
              }
              finalizeVoiceCommandAndSubmit(transcript);
            }
          }
        };
      } catch (err) {
        console.error('Fallback transcription error:', err);
      }
    };

    mediaRecorder.start();
    // Record in 3-second slices
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 3200);
  } catch (err) {
    AppState.isFallbackRecording = false;
    console.warn('MediaRecorder fallback init failed:', err);
  }
}

function updateVisualizerState(state) {
  if (!DOM.spartOrbCore) return;
  DOM.spartOrbCore.classList.remove('listening', 'speaking');

  if (state === 'listening') {
    DOM.spartOrbCore.classList.add('listening');
    if (DOM.voiceStatusTitle) DOM.voiceStatusTitle.textContent = 'Listening to your voice...';
    if (DOM.voiceStatusSub) DOM.voiceStatusSub.textContent = 'Speak your question, study topic, or career goal naturally.';
  } else if (state === 'speaking') {
    DOM.spartOrbCore.classList.add('speaking');
    if (DOM.voiceStatusTitle) DOM.voiceStatusTitle.textContent = 'S.P.A.R.T is speaking...';
    if (DOM.voiceStatusSub) DOM.voiceStatusSub.textContent = 'Listen to the voice answer or review the full output on your screen.';
  } else {
    const name = AppState.settings.userName || 'Devadharshini';
    if (DOM.voiceStatusTitle) DOM.voiceStatusTitle.textContent = `Ready to assist you, ${name}`;
    if (DOM.voiceStatusSub) DOM.voiceStatusSub.textContent = 'Speak naturally via the mic or type below. S.P.A.R.T simplifies every concept in voice.';
  }
}

// ==========================================================================
// STORAGE MANAGEMENT
// ==========================================================================

function loadStoredSettings() {
  try {
    const saved = localStorage.getItem('spart_settings') || localStorage.getItem('chatgpt_settings');
    if (saved) {
      AppState.settings = Object.assign(AppState.settings, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Could not load settings', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem('spart_settings', JSON.stringify(AppState.settings));
  } catch (e) {}
}

function loadStoredChats() {
  try {
    const saved = localStorage.getItem('spart_sessions') || localStorage.getItem('chatgpt_sessions');
    if (saved) {
      AppState.chats = JSON.parse(saved);
    }
  } catch (e) {
    AppState.chats = [];
  }
}

function saveChats() {
  try {
    localStorage.setItem('spart_sessions', JSON.stringify(AppState.chats));
    renderChatHistory();
  } catch (e) {}
}

// ==========================================================================
// MODE MANAGEMENT (Universal S.P.A.R.T, Study Intelligence, Career Intelligence)
// ==========================================================================

function setMode(modeId, resetChatIfEmpty = true) {
  if (!AIEngine.modes[modeId]) modeId = 'general';
  AppState.currentMode = modeId;
  const modeData = AIEngine.modes[modeId];

  // Update Top Nav Indicator
  DOM.indicatorText.textContent = modeData.shortName;
  DOM.activeModeIndicator.className = `active-mode-indicator ${modeId}`;

  // Update Sidebar Tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === modeId);
  });

  // Update Hero Pills
  document.querySelectorAll('.hero-pill-btn').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.mode === modeId);
  });

  // Update Input Mode Tag
  DOM.inputModeTagIcon.textContent = modeId === 'study' ? '🎓' : modeId === 'career' ? '💼' : '🟢';
  DOM.inputModeTagText.textContent = modeId === 'study' ? 'Study AI' : modeId === 'career' ? 'Career AI' : 'S.P.A.R.T';
  DOM.messageInput.placeholder = modeId === 'study'
    ? 'Ask study question, request a quiz or Feynman breakdown...'
    : modeId === 'career'
    ? 'Ask career question, paste resume bullet, or request interview...'
    : 'Ask S.P.A.R.T anything or speak via the mic...';

  // Render Sidebar Quick Tools
  renderQuickTools(modeId);

  // Update active chat's mode
  const currentChat = getCurrentChat();
  if (currentChat) {
    currentChat.mode = modeId;
    saveChats();
  }

  document.title = `${modeData.shortName} - S.P.A.R.T`;
}

function renderQuickTools(modeId) {
  const modeData = AIEngine.modes[modeId];
  if (!modeData.tools || modeData.tools.length === 0) {
    DOM.quickToolsLabel.style.display = 'none';
    DOM.quickToolsList.innerHTML = '';
    return;
  }

  DOM.quickToolsLabel.style.display = 'block';
  DOM.quickToolsLabel.textContent = `${modeData.shortName.toUpperCase()} TOOLS`;

  DOM.quickToolsList.innerHTML = modeData.tools.map(tool => `
    <button class="quick-tool-btn" data-action="${escapeHtml(tool.action)}">
      <span>${tool.label}</span>
    </button>
  `).join('');

  DOM.quickToolsList.querySelectorAll('.quick-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-action');
      if (prompt) {
        closeSidebar();
        submitUserPrompt(prompt);
      }
    });
  });
}

// ==========================================================================
// CHAT SESSION MANAGEMENT
// ==========================================================================

function createNewChat() {
  const newId = 'spart_chat_' + Date.now();
  const newChat = {
    id: newId,
    title: 'New conversation',
    mode: AppState.currentMode,
    createdAt: Date.now(),
    messages: []
  };

  AppState.chats.unshift(newChat);
  AppState.currentChatId = newId;
  saveChats();
  renderChatUI();
  DOM.messageInput.value = '';
}

function getCurrentChat() {
  return AppState.chats.find(c => c.id === AppState.currentChatId);
}

function loadChat(chatId) {
  const chat = AppState.chats.find(c => c.id === chatId);
  if (!chat) return;

  AppState.currentChatId = chatId;
  if (chat.mode && chat.mode !== AppState.currentMode) {
    setMode(chat.mode, false);
  }

  renderChatUI();
  renderChatHistory();
}

function deleteChat(chatId, e) {
  if (e) e.stopPropagation();
  AppState.chats = AppState.chats.filter(c => c.id !== chatId);
  saveChats();

  if (AppState.currentChatId === chatId) {
    if (AppState.chats.length > 0) {
      loadChat(AppState.chats[0].id);
    } else {
      createNewChat();
    }
  } else {
    renderChatHistory();
  }
  showToast('Conversation deleted');
}

function renderChatHistory() {
  if (AppState.chats.length === 0) {
    DOM.chatHistoryList.innerHTML = `<div style="padding: 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">No conversations yet</div>`;
    return;
  }

  DOM.chatHistoryList.innerHTML = AppState.chats.map(chat => {
    const isActive = chat.id === AppState.currentChatId;
    const modeIcon = chat.mode === 'study' ? '🎓' : chat.mode === 'career' ? '💼' : '💬';
    return `
      <div class="history-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
        <div class="history-title-wrap">
          <span>${modeIcon}</span>
          <span>${escapeHtml(chat.title)}</span>
        </div>
        <div class="history-actions">
          <button class="history-action-btn delete" data-delete-id="${chat.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  DOM.chatHistoryList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete')) return;
      loadChat(item.dataset.chatId);
      closeSidebar();
    });
  });

  DOM.chatHistoryList.querySelectorAll('.history-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteChat(btn.dataset.deleteId, e);
    });
  });
}

function renderChatUI() {
  const currentChat = getCurrentChat();
  if (!currentChat || currentChat.messages.length === 0) {
    DOM.heroScreen.style.display = 'flex';
    DOM.messagesContainer.style.display = 'none';
    DOM.followUpsBar.style.display = 'none';
    DOM.messagesContainer.innerHTML = '';
  } else {
    DOM.heroScreen.style.display = 'none';
    DOM.messagesContainer.style.display = 'flex';
    DOM.messagesContainer.innerHTML = '';

    currentChat.messages.forEach(msg => {
      appendMessageToDOM(msg);
    });

    const lastMsg = currentChat.messages[currentChat.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.followUps && lastMsg.followUps.length > 0) {
      renderFollowUps(lastMsg.followUps);
    } else {
      DOM.followUpsBar.style.display = 'none';
    }

    scrollToBottom();
  }
}

// ==========================================================================
// PROMPT SUBMISSION & PROCESSING
// ==========================================================================

async function submitUserPrompt(promptText, isVoiceOrigin = false) {
  promptText = promptText.trim();
  if (!promptText || AppState.isGenerating) return;

  const currentChat = getCurrentChat();
  if (!currentChat) createNewChat();

  let fullPrompt = promptText;
  if (AppState.attachedFile) {
    fullPrompt = `[Attached Document: ${AppState.attachedFile.name}]\n\n${promptText}`;
    clearAttachment();
  }

  // Update chat title if first message
  if (currentChat.messages.length === 0) {
    currentChat.title = promptText.length > 36 ? promptText.substring(0, 36) + '...' : promptText;
  }

  // 1. Add User Message
  const userMsg = {
    role: 'user',
    content: fullPrompt,
    timestamp: Date.now()
  };
  currentChat.messages.push(userMsg);
  saveChats();
  renderChatUI();

  // Clear Input Box
  DOM.messageInput.value = '';
  adjustTextareaHeight();
  DOM.sendBtn.disabled = true;

  // 2. Prepare Assistant Message Placeholder
  const assistantMsg = {
    id: 'msg_' + Date.now(),
    role: 'assistant',
    content: '',
    mode: AppState.currentMode,
    widget: null,
    followUps: [],
    timestamp: Date.now()
  };
  currentChat.messages.push(assistantMsg);

  DOM.heroScreen.style.display = 'none';
  DOM.messagesContainer.style.display = 'flex';
  DOM.followUpsBar.style.display = 'none';

  const msgRowEl = createAssistantMessageElement(assistantMsg);
  DOM.messagesContainer.appendChild(msgRowEl);
  scrollToBottom();

  setGenerating(true);

  try {
    const response = await AIEngine.generateResponse(
      promptText,
      AppState.currentMode,
      currentChat.messages,
      (progress) => {
        const bodyEl = msgRowEl.querySelector('.assistant-body');
        if (progress.type === 'chunk') {
          bodyEl.innerHTML = formatMarkdown(progress.text);
          assistantMsg.content = progress.text;

          if (progress.isComplete && progress.widget) {
            assistantMsg.widget = progress.widget;
            assistantMsg.followUps = progress.followUps;
            renderWidget(msgRowEl.querySelector('.widget-dock'), progress.widget);
          }
          scrollToBottom();
        }
      }
    );

    // Save final response state
    assistantMsg.content = response.text;
    assistantMsg.widget = response.widget;
    assistantMsg.followUps = response.followUps;
    saveChats();

    if (response.followUps && response.followUps.length > 0) {
      renderFollowUps(response.followUps);
    }

    // SPEAK RESPONSE ALOUD IN MALE AI VOICE (SIMPLIFIED VOICE SUMMARY)
    const voiceText = response.speechText || AIEngine.simplifyTextForSpeech(response.text, AppState.settings.userName);
    speakSpartVoice(voiceText, () => {
      // Completed speech
    });

  } catch (error) {
    console.error('Error generating response:', error);
    const bodyEl = msgRowEl.querySelector('.assistant-body');
    bodyEl.innerHTML = `<p style="color: var(--error);">An error occurred. Please try speaking or typing again.</p>`;
  } finally {
    setGenerating(false);
  }
}

function setGenerating(isGen) {
  AppState.isGenerating = isGen;
  const sendIcon = DOM.sendBtn.querySelector('.send-icon');
  const stopIcon = DOM.sendBtn.querySelector('.stop-icon');

  if (isGen) {
    DOM.sendBtn.disabled = false;
    DOM.sendBtn.title = 'Stop';
    if (sendIcon) sendIcon.style.display = 'none';
    if (stopIcon) stopIcon.style.display = 'block';
  } else {
    DOM.sendBtn.disabled = DOM.messageInput.value.trim().length === 0;
    DOM.sendBtn.title = 'Send message';
    if (sendIcon) sendIcon.style.display = 'block';
    if (stopIcon) stopIcon.style.display = 'none';
  }
}

// ==========================================================================
// DOM RENDERING & WIDGET BUILDERS
// ==========================================================================

function appendMessageToDOM(msg) {
  if (msg.role === 'user') {
    const row = document.createElement('div');
    row.className = 'message-row user';
    row.innerHTML = `<div class="message-body">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>`;
    DOM.messagesContainer.appendChild(row);
  } else {
    const row = createAssistantMessageElement(msg);
    DOM.messagesContainer.appendChild(row);
  }
}

function createAssistantMessageElement(msg) {
  const row = document.createElement('div');
  const mode = msg.mode || AppState.currentMode;
  row.className = `message-row assistant ${mode}-theme`;

  const modeIcon = mode === 'study' ? '🎓' : mode === 'career' ? '💼' : '🛡️';
  const modeName = mode === 'study' ? 'S.P.A.R.T Study Intelligence' : mode === 'career' ? 'S.P.A.R.T Career Intelligence' : 'S.P.A.R.T Assistant';
  const badgeName = mode === 'study' ? 'Study AI' : mode === 'career' ? 'Career AI' : 'Universal AI';

  row.innerHTML = `
    <div class="assistant-avatar ${mode}">
      <span>${modeIcon}</span>
    </div>
    <div class="message-content-wrap">
      <div class="assistant-header-meta">
        <span class="assistant-name">${modeName}</span>
        <span class="assistant-tag">${badgeName}</span>
      </div>

      <!-- Message Text Body -->
      <div class="message-body assistant-body">
        ${formatMarkdown(msg.content)}
      </div>

      <!-- Interactive Widget Dock -->
      <div class="widget-dock"></div>

      <!-- Action Toolbar -->
      <div class="message-actions">
        <button class="msg-action-btn speak-btn" title="Read voice answer aloud">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          <span>Speak</span>
        </button>
        <button class="msg-action-btn copy-btn" title="Copy text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copy</span>
        </button>
      </div>
    </div>
  `;

  // Read Aloud click listener
  const speakBtn = row.querySelector('.speak-btn');
  speakBtn.addEventListener('click', () => {
    speakSpartVoice(AIEngine.simplifyTextForSpeech(msg.content, AppState.settings.userName));
  });

  const copyBtn = row.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(msg.content);
    showToast('Copied to clipboard!');
  });

  if (msg.widget) {
    renderWidget(row.querySelector('.widget-dock'), msg.widget);
  }

  attachCodeCopyEvents(row);
  return row;
}

function renderWidget(container, widget) {
  if (!container || !widget) return;
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'interactive-widget-card';

  // 1. QUIZ WIDGET
  if (widget.type === 'quiz') {
    card.innerHTML = `
      <div class="widget-badge-title">
        <span style="font-size: 1.2rem;">📝</span>
        <span class="widget-title">${escapeHtml(widget.data.title)}</span>
      </div>
      <div class="quiz-questions-wrapper">
        ${widget.data.questions.map((q, qIdx) => `
          <div class="quiz-question-box" data-q-idx="${qIdx}">
            <div class="quiz-q-num">Question ${qIdx + 1} of ${widget.data.questions.length}</div>
            <div class="quiz-q-text">${escapeHtml(q.question)}</div>
            <div class="quiz-options-list">
              ${q.options.map((opt, optIdx) => `
                <button class="quiz-option-btn" data-opt-idx="${optIdx}">
                  <span class="quiz-opt-marker">${String.fromCharCode(65 + optIdx)}</span>
                  <span>${escapeHtml(opt)}</span>
                </button>
              `).join('')}
            </div>
            <div class="quiz-feedback-box" id="feedback_${qIdx}"></div>
          </div>
        `).join('')}
      </div>
    `;

    card.querySelectorAll('.quiz-question-box').forEach(qBox => {
      const qIdx = parseInt(qBox.dataset.qIdx, 10);
      const question = widget.data.questions[qIdx];
      const feedbackBox = qBox.querySelector('.quiz-feedback-box');
      const optButtons = qBox.querySelectorAll('.quiz-option-btn');

      optButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('disabled')) return;
          optButtons.forEach(b => b.classList.add('disabled'));

          const chosenIdx = parseInt(btn.dataset.optIdx, 10);
          if (chosenIdx === question.correctIndex) {
            btn.classList.add('correct');
            feedbackBox.innerHTML = `<strong>✅ Correct!</strong> ${escapeHtml(question.explanation)}`;
            speakSpartVoice(`Correct! ${question.explanation}`);
          } else {
            btn.classList.add('incorrect');
            optButtons[question.correctIndex].classList.add('correct');
            feedbackBox.innerHTML = `<strong>❌ Incorrect.</strong> ${escapeHtml(question.explanation)}`;
            speakSpartVoice(`That is incorrect. The correct answer is option ${String.fromCharCode(65 + question.correctIndex)}. ${question.explanation}`);
          }
          feedbackBox.classList.add('show');
        });
      });
    });
  }

  // 2. FLASHCARDS
  else if (widget.type === 'flashcards') {
    let currentCardIdx = 0;
    const cards = widget.data.cards;

    card.innerHTML = `
      <div class="widget-badge-title">
        <span style="font-size: 1.2rem;">🗂️</span>
        <span class="widget-title">${escapeHtml(widget.data.title)}</span>
      </div>
      <div class="flashcards-container">
        <div class="flashcard-stage" id="flashcardStage">
          <div class="flashcard-inner" id="flashcardInner">
            <div class="flashcard-front">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--accent-study); margin-bottom: 8px;" id="fcTag"></span>
              <div style="font-size: 1rem; font-weight: 600; line-height: 1.45;" id="fcFrontText"></div>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 14px;">Click card to flip 🔄</span>
            </div>
            <div class="flashcard-back">
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--accent-general); margin-bottom: 8px;">Answer & Explanation</span>
              <div style="font-size: 0.92rem; line-height: 1.45;" id="fcBackText"></div>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 14px;">Click to flip back</span>
            </div>
          </div>
        </div>
        <div class="flashcard-controls">
          <button class="fc-btn" id="fcPrevBtn">← Prev</button>
          <span style="font-size: 0.82rem; color: var(--text-muted);" id="fcCounter">1 / ${cards.length}</span>
          <button class="fc-btn" id="fcNextBtn">Next →</button>
        </div>
      </div>
    `;

    const stage = card.querySelector('#flashcardStage');
    const inner = card.querySelector('#flashcardInner');
    const tag = card.querySelector('#fcTag');
    const front = card.querySelector('#fcFrontText');
    const back = card.querySelector('#fcBackText');
    const prevBtn = card.querySelector('#fcPrevBtn');
    const nextBtn = card.querySelector('#fcNextBtn');
    const counter = card.querySelector('#fcCounter');

    function updateCardUI() {
      inner.classList.remove('flipped');
      const c = cards[currentCardIdx];
      tag.textContent = c.tag || 'Concept';
      front.textContent = c.front;
      back.innerHTML = escapeHtml(c.back).replace(/\n/g, '<br>');
      counter.textContent = `${currentCardIdx + 1} / ${cards.length}`;
      prevBtn.disabled = currentCardIdx === 0;
      nextBtn.disabled = currentCardIdx === cards.length - 1;
    }

    stage.addEventListener('click', () => {
      inner.classList.toggle('flipped');
      if (inner.classList.contains('flipped')) {
        speakSpartVoice(`Answer: ${cards[currentCardIdx].back}`);
      }
    });

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCardIdx > 0) { currentCardIdx--; updateCardUI(); }
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCardIdx < cards.length - 1) { currentCardIdx++; updateCardUI(); }
    });

    updateCardUI();
  }

  // 3. RESUME SCORECARD
  else if (widget.type === 'resume-score') {
    card.innerHTML = `
      <div class="widget-badge-title">
        <span style="font-size: 1.2rem;">📄</span>
        <span class="widget-title">ATS Resume Health Scorecard</span>
      </div>
      <div class="resume-score-grid">
        <div class="score-radial-box">
          <span class="radial-number">${widget.data.overallScore}%</span>
          <span class="radial-label">Tier-1 ATS Match</span>
        </div>
        <div class="score-submetrics">
          ${widget.data.metrics.map(m => `
            <div class="submetric-row">
              <div class="submetric-header">
                <span>${escapeHtml(m.label)}</span>
                <span>${m.score}%</span>
              </div>
              <div class="submetric-bar-bg">
                <div class="submetric-bar-fill" style="width: ${m.score}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="bullet-comparison-box">
        <h4 style="font-size: 0.88rem; margin: 10px 0 6px;">Google XYZ Transformation:</h4>
        ${widget.data.bulletTransforms.map(b => `
          <div class="diff-card before">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--error); margin-bottom: 4px;">Before (Generic)</div>
            <div>${escapeHtml(b.before)}</div>
          </div>
          <div class="diff-card after">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--success); margin-bottom: 4px;">After (Google XYZ - ${escapeHtml(b.improvement)})</div>
            <div>${escapeHtml(b.after)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 4. MOCK INTERVIEW
  else if (widget.type === 'interview-sim') {
    card.innerHTML = `
      <div class="widget-badge-title">
        <span style="font-size: 1.2rem;">🎙️</span>
        <span class="widget-title">Live Interview Assessment</span>
      </div>
      <div class="interview-sim-box">
        <span class="interview-persona-badge">Role: ${escapeHtml(widget.data.role)}</span>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          Type or speak your answer using the <strong>STAR method (Situation, Task, Action, Result)</strong>:
        </p>
        <textarea class="interview-answer-input" placeholder="In my previous position, we faced a major outage..."></textarea>
        <button class="interview-eval-btn">Evaluate My Answer</button>
      </div>
    `;

    const evalBtn = card.querySelector('.interview-eval-btn');
    const inputArea = card.querySelector('.interview-answer-input');
    evalBtn.addEventListener('click', () => {
      const text = inputArea.value.trim();
      if (!text) {
        showToast('Please type or speak your answer first!');
        return;
      }
      submitUserPrompt(`Evaluate this interview response using STAR method:\n\n"${text}"`);
    });
  }

  container.appendChild(card);
}

function renderFollowUps(followUps) {
  if (!followUps || followUps.length === 0) {
    DOM.followUpsBar.style.display = 'none';
    return;
  }

  DOM.followUpsBar.style.display = 'block';
  DOM.followUpsList.innerHTML = followUps.map(fu => `
    <button class="follow-up-chip" data-fu="${escapeHtml(fu)}">
      ${escapeHtml(fu)}
    </button>
  `).join('');

  DOM.followUpsList.querySelectorAll('.follow-up-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      submitUserPrompt(chip.dataset.fu);
    });
  });
}

function attachCodeCopyEvents(scope) {
  scope.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.code-block-wrapper');
      const codeEl = wrapper.querySelector('pre code') || wrapper.querySelector('pre');
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.innerText);
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>✓ Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      }
    });
  });
}

function clearAttachment() {
  AppState.attachedFile = null;
  DOM.attachmentTray.style.display = 'none';
  DOM.fileInput.value = '';
}

// ==========================================================================
// SIDEBAR CONTROL (CLOSED BY DEFAULT, OPENS VIA MENU BAR ICON)
// ==========================================================================

function openSidebar() {
  DOM.sidebar.classList.add('open');
  DOM.sidebarBackdrop.classList.add('active');
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.sidebarBackdrop.classList.remove('active');
}

function toggleSidebar() {
  if (DOM.sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ==========================================================================
// THEME & UTILITIES
// ==========================================================================

function applyTheme(theme) {
  let effective = theme;
  if (theme === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', effective);
  AppState.settings.theme = theme;
  saveSettings();

  const isDark = effective === 'dark';
  const moon = DOM.themeToggleBtn.querySelector('.theme-icon-moon');
  const sun = DOM.themeToggleBtn.querySelector('.theme-icon-sun');
  if (moon && sun) {
    moon.style.display = isDark ? 'block' : 'none';
    sun.style.display = isDark ? 'none' : 'block';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(`Switched to ${next} theme`);
}

function toggleVoiceMute() {
  AppState.isVoiceAudioMuted = !AppState.isVoiceAudioMuted;
  const soundIcon = DOM.voiceMuteToggleBtn.querySelector('.voice-sound-icon');
  const mutedIcon = DOM.voiceMuteToggleBtn.querySelector('.voice-muted-icon');

  if (AppState.isVoiceAudioMuted) {
    window.speechSynthesis.cancel();
    if (soundIcon) soundIcon.style.display = 'none';
    if (mutedIcon) mutedIcon.style.display = 'block';
    showToast('S.P.A.R.T voice output muted');
  } else {
    if (soundIcon) soundIcon.style.display = 'block';
    if (mutedIcon) mutedIcon.style.display = 'none';
    showToast('S.P.A.R.T voice output unmuted');
  }
}

function showToast(message) {
  DOM.toastMessage.textContent = message;
  DOM.toastNotification.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    DOM.toastNotification.classList.remove('show');
  }, 2600);
}

function scrollToBottom() {
  DOM.chatViewport.scrollTo({
    top: DOM.chatViewport.scrollHeight,
    behavior: 'smooth'
  });
}

function adjustTextareaHeight() {
  DOM.messageInput.style.height = 'auto';
  DOM.messageInput.style.height = Math.min(DOM.messageInput.scrollHeight, 180) + 'px';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatMarkdown(text) {
  if (!text) return '';

  let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const langDisplay = lang || 'code';
    return `
      <div class="code-block-wrapper">
        <div class="code-header-bar">
          <span>${escapeHtml(langDisplay)}</span>
          <button class="copy-code-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>
      </div>
    `;
  });

  formatted = formatted.replace(/^>\s*(.*?)$/gm, '<blockquote>$1</blockquote>');
  formatted = formatted.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  formatted = formatted.replace(/^---$/gm, '<hr style="border:0; border-top: 1px solid var(--border-light); margin: 16px 0;">');
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.88em; border: 1px solid var(--border-light);">$1</code>');
  formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, '<div style="background: var(--bg-tertiary); padding: 10px 14px; border-radius: 6px; font-family: var(--font-mono); margin: 8px 0; overflow-x: auto; font-size: 0.9em; border: 1px solid var(--border-light);">$1</div>');
  formatted = formatted.replace(/\$([^$]+)\$/g, '<span style="font-family: var(--font-mono); background: var(--bg-tertiary); padding: 1px 4px; border-radius: 3px;">$1</span>');
  formatted = formatted.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*?<\/li>\s*)+/g, '<ul>$&</ul>');
  formatted = formatted.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li>$2</li>');

  const paragraphs = formatted.split('\n\n');
  return paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<div') || p.startsWith('<blockquote') || p.startsWith('<hr')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================

function setupEventListeners() {
  // 1. Initial Name Onboarding
  DOM.btnInitializeSpart.addEventListener('click', handleNameSubmission);
  DOM.initialNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSubmission();
    }
  });

  // 2. Menu Bar Icon (Opens the Sidebar)
  DOM.menuBarIconBtn.addEventListener('click', toggleSidebar);
  DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
  DOM.sidebarBackdrop.addEventListener('click', closeSidebar);

  // 3. New Chat Session
  DOM.newChatBtn.addEventListener('click', () => {
    createNewChat();
    closeSidebar();
  });

  // 4. Intelligence Mode Tabs in Sidebar
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setMode(tab.dataset.mode);
      closeSidebar();
    });
  });

  // 5. Hero Mode Pills
  document.querySelectorAll('.hero-pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      setMode(pill.dataset.mode);
    });
  });

  // 6. Prominent Voice Mic Button & Speech Language Selector
  DOM.prominentMicBtn.addEventListener('click', toggleContinuousVoiceListening);

  if (DOM.btnLangEn) {
    DOM.btnLangEn.addEventListener('click', () => setVoiceLanguage('en-IN'));
  }
  if (DOM.btnLangTa) {
    DOM.btnLangTa.addEventListener('click', () => setVoiceLanguage('ta-IN'));
  }

  // 7. Textarea Input and Send Button
  DOM.messageInput.addEventListener('input', () => {
    adjustTextareaHeight();
    DOM.sendBtn.disabled = DOM.messageInput.value.trim().length === 0;
  });

  DOM.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!DOM.sendBtn.disabled) {
        submitUserPrompt(DOM.messageInput.value);
      }
    }
  });

  DOM.sendBtn.addEventListener('click', () => {
    if (AppState.isGenerating) {
      setGenerating(false);
      showToast('Generation stopped');
    } else {
      submitUserPrompt(DOM.messageInput.value);
    }
  });

  // 8. File Upload Attachment
  DOM.attachBtn.addEventListener('click', () => {
    DOM.fileInput.click();
  });

  DOM.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      AppState.attachedFile = file;
      DOM.attachedFileName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      DOM.attachmentTray.style.display = 'block';
      showToast(`Attached ${file.name} for research analysis!`);
    }
  });

  DOM.removeAttachmentBtn.addEventListener('click', clearAttachment);

  // 9. Audio Mute Toggle & Theme Toggle
  DOM.voiceMuteToggleBtn.addEventListener('click', toggleVoiceMute);
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // 10. Settings Modal
  DOM.openSettingsBtn.addEventListener('click', () => {
    DOM.settingsModal.style.display = 'flex';
    closeSidebar();
  });

  DOM.closeSettingsModal.addEventListener('click', () => {
    DOM.settingsModal.style.display = 'none';
  });

  document.querySelectorAll('.theme-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeVal);
    });
  });

  DOM.saveSettingsBtn.addEventListener('click', () => {
    const newName = DOM.userNameInput.value.trim() || 'Devadharshini';
    AppState.settings.userName = newName;
    localStorage.setItem('spart_user_name', newName);
    saveSettings();
    updateUserNameDisplay(newName);
    DOM.settingsModal.style.display = 'none';
    showToast('Settings saved!');
  });

  DOM.clearAllChatsBtn.addEventListener('click', () => {
    if (confirm('Clear all conversation history?')) {
      AppState.chats = [];
      saveChats();
      createNewChat();
      DOM.settingsModal.style.display = 'none';
      showToast('All conversations cleared');
    }
  });

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) DOM.settingsModal.style.display = 'none';
  });
}

// Start application on DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
