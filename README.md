# 🛸 Gravibuddy

> **A delightful, Apple-grade Dynamic Island floating HUD companion for Google Antigravity CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Antigravity](https://img.shields.io/badge/CLI-Google%20Antigravity-10B981?logo=google&logoColor=white)](https://antigravity.google)

---

## ✨ Features

- 🌊 **Fluid Watery Morphing**: Viscous jelly squash-and-stretch rubber-band spring physics (`cubic-bezier(0.19, 1.45, 0.26, 1)`) with specular glass light sweeps.
- 🌙 **Option 1 Sleep Mode (Ultra-Thin Notch Tab)**:
  - On idle (~4.5s), the island tucks smoothly into the screen edge, leaving a minimalist ~8px notch tab with a gentle breathing ambient LED line.
  - Instantly blooms and unfurls on cursor hover or on any CLI activity (`thinking`, `done`, `waiting`).
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

Or open the in-app **Island Settings** (click the ⚙️ icon or right-click the pill) and use the **Test Animations** buttons.

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
