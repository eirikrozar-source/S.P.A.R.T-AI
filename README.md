# S.P.A.R.T (Smart Perpetual Assistant for Research Tasks)

An autonomous, voice-first AI research assistant designed with a clean, distraction-free interface and comprehensive speech interaction.

---

## Key Features & Architecture

### 1. Menu Bar & Sliding Sidebar Drawer
- **Closed by Default**: The sidebar drawer stays completely hidden off-canvas to keep the workspace clean.
- **Menu Bar Icon Activation**: Clicking the menu icon (`☰`) in the top navigation slides open the sidebar drawer with an animated backdrop.
- **Sidebar Options**:
  - User identity configuration & name editor.
  - Speech synthesis voice selector (choose from installed browser natural voices).
  - Speaking speed (rate) and pitch controls with instant voice testing.
  - Research Intelligence Mode switch (Comprehensive, Science & Tech, Academic Literature, Concise Voice).
  - Optional Gemini API Key field for unbounded generative capabilities.
  - Session controls (Replay introductory speech, clear conversation memory).

### 2. Home Page (3 Main Elements Focus)
The home page contains only three primary operational elements:
1. **Primary Output & Visualizer Area (Central Display)**:
   - Displays S.P.A.R.T's spoken responses with well-mannered, articulate research findings.
   - Central futuristic reactor orb & sound frequency bars reacting in real time to speech synthesis and speech recognition.
   - Live speech transcript preview that shows words as you speak them.
2. **Master Microphone Button (Directly ABOVE the Typing Bar)**:
   - Placed directly above the input bar for intuitive voice interaction.
   - **Continuous Listening**: The microphone stays permanently active, listening and conversing back and forth naturally.
   - **Manual Off Control**: The mic only turns off when the user explicitly clicks the mic button.
   - Dual glowing ripple rings and status tags indicate active listening vs. muted states.
3. **Primary Typing Bar (Bottom Area)**:
   - Sleek glassmorphic text input bar.
   - Enables users to type questions or search queries whenever preferred.

### 3. Automatic User Onboarding & Voice Welcome
- **User Name Acquisition**: Upon opening the webpage for the first time, a modal prompts for the user's name alone.
- **Autonomous Voice Introduction**:
  Once the user enters their name, S.P.A.R.T immediately speaks out loud with polite tone:
  > *"I am your assistant S.P.A.R.T (SMART. PERPETUAL. ASSISTANT for RESEARCH. TASKS). I am here to help and fulfill your needs based on my performance."*

### 4. Well-Mannered AI Research Engine
- **Voice Synthesis & Recognition**: Full bi-directional voice conversation using the Web Speech API (`SpeechRecognition` + `SpeechSynthesis`).
- **Encyclopedic Facts & Calculations**: Instant arithmetic computation and live Wikipedia research lookups.
- **Voice System Commands**:
  - *"Open sidebar"* / *"Close sidebar"*
  - *"Change my name to [Your Name]"*
  - *"Clear conversation"*
  - *"Who are you?"*

---

## How to Run

### Method 1: Using the Built-in Node.js Server (Recommended for Best Microphone Permissions)
Run the following in PowerShell / Terminal:
```bash
node server.js
```
Then open your browser to:
**[http://localhost:3000](http://localhost:3000)**

### Method 2: Direct Browser Launch
You can also directly open `index.html` in Google Chrome, Microsoft Edge, or any modern Chromium browser.

