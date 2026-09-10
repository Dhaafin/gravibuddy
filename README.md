# 🛸 Gravibuddy

> **A delightful, Apple-grade Dynamic Island floating HUD companion for Google Antigravity CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Antigravity](https://img.shields.io/badge/CLI-Google%20Antigravity-10B981?logo=google&logoColor=white)](https://antigravity.google)

---

## ✨ Features

- 🖥️ **Attached Hardware Notch**: Sits completely flush against the top screen bezel (zero floating gap) with signature MacBook-grade concave outer fillet ears that seamlessly bridge the notch into the display frame.
- 🌙 **Responsive Bezel Sleep Mode**:
  - On idle (~1.4s), smoothly retracts up into the screen bezel, leaving a minimalist 6px hardware tab with a gentle breathing ambient LED indicator.
  - **Hover Intent Filter (160ms)**: Fast cursor sweeps over browser tabs will never accidentally pop the notch open; blooms only on intentional hover or direct click.
- 🥷 **Stealth Coding (Zen Mode)**:
  - While Antigravity is processing/coding (`thinking`), it stays tucked away in the notch tab with a gentle violet breathing LED line, keeping your code editor tabs and terminal 100% visible and unblocked.
  - Only pops out when an action is required (`waiting`) or when the task finishes (`done`).
  - Terminal keystrokes and cursor movements update telemetry silently without triggering annoying popups.
- 🎯 **Intelligent Zero-Padding Click-Through**:
  - Full mouse event pass-through on transparent screen areas.
  - Clicks right next to the island pass directly through to underlying browser tabs, window titlebars, and code editors with zero dead zones.
- 🎛️ **Multi-Position Docking**:
  - **Center Top**: Horizontal Dynamic Island notch.
  - **Left Dock**: Vertical edge capsule.
  - **Right Dock**: Vertical edge capsule.
  - Teleport between docks with a 3-phase droplet implosion and spring blossoming transition.
- 🔮 **Official Antigravity Branding**:
  - Authentic high-resolution Google Antigravity logo.
  - Continuous organic breathing animation.
  - Dynamic state auras (Idle Emerald, Thinking Violet, Done Green, Waiting Amber).
- 🎵 **Procedural Web Audio Chimes & Pops**:
  - Crisp Apple-style bubble pop on expand/morph.
  - Harmonious chime on task completion and gentle pulse on confirmation prompts.
  - Fully toggleable in settings.
- 🔗 **Zero-Impact Statusline Forwarder**:
  - Non-blocking pipe from Antigravity CLI statusline.
  - Simultaneously chains output to `agy-hud` without conflicts.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **npm** or **pnpm**
- **Google Antigravity CLI**

### 2. Clone & Install
```bash
git clone https://github.com/Dhaafin/gravibuddy.git
cd gravibuddy
npm install
```

### 3. Start Gravibuddy
```bash
npm start
```

---

## ⚙️ Antigravity CLI Integration

To pipe real-time agent states from Antigravity CLI into Gravibuddy:

1. Open your Antigravity settings file:
   `~/.gemini/antigravity-cli/settings.json`

2. Configure the `statusLine` command to point to `forwarder.cmd`:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "C:\\path\\to\\gravibuddy\\forwarder.cmd"
     }
   }
   ```
   *(Note: On Windows, use direct `.cmd` paths without escaped quotes or `cmd.exe /c` wrappers).*

---

## 🧪 Testing State Animations

In a separate terminal, trigger state simulations:

```powershell
node test-event.js thinking   # Simulate active coding state
node test-event.js done       # Simulate task finished with chime
node test-event.js waiting    # Simulate tool permission required
node test-event.js idle       # Reset to idle standby
```

Or open the in-app **Control Center Settings** (click the ⚙️ icon or right-click the pill) and use the **Preview States** tactile tiles.

---

## 📂 Project Structure

```
gravibuddy/
├── assets/
│   └── antigravity-icon.png  # Official high-res logo
├── main.js                   # Electron main process & HTTP bridge (port 8998)
├── renderer.js               # Web Audio synth, click-through, state machine
├── index.html                # Dynamic Island & Control Center DOM
├── style.css                 # Squircle glassmorphism & fluid spring physics
├── forwarder.js              # Asynchronous CLI statusline forwarder
├── forwarder.cmd             # Windows launcher script for forwarder
├── test-event.js             # CLI event tester utility
└── package.json              # Project configuration
```

---

## 📄 License

MIT License © 2026 [Dhaafin](https://github.com/Dhaafin)
