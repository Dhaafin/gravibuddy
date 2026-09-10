# 🛸 Gravibuddy

> **A delightful, Apple-grade Dynamic Island floating HUD companion for Google Antigravity CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41.0.0-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)
[![Antigravity](https://img.shields.io/badge/CLI-Google%20Antigravity-10B981?logo=google&logoColor=white)](https://antigravity.google)

---

## ✨ Features

- 🚀 **One-Click Workspace Launcher**: Auto-discovers your projects from Antigravity CLI's `trustedWorkspaces`. Launch any project in Windows Terminal with `agy` directly from the Gravibuddy Control Center without manually opening a terminal or typing commands.
- 🔍 **Center Spotlight Control Center**: Opens cleanly in the dead-center of your screen (Raycast/Spotlight style) with blur/Esc auto-hide, keeping the top notch 100% compact and uncluttered.
- 👻 **Complete Alt+Tab Stealth**: Native Win32 `WS_EX_TOOLWINDOW` integration completely hides Gravibuddy from the Windows Alt+Tab task switcher and taskbar.
- 🖥️ **Attached Hardware Notch**: Sits completely flush against the top screen bezel (zero floating gap) with signature MacBook-grade concave outer fillet ears that seamlessly bridge the notch into the display frame.
- 🌙 **Responsive Bezel Sleep Mode**:
  - On idle (~1.4s), smoothly retracts up into the screen bezel, leaving a minimalist 6px hardware tab with a gentle breathing ambient LED indicator.
  - **Hover Intent Filter (160ms)**: Fast cursor sweeps over browser tabs will never accidentally pop the notch open; blooms only on intentional hover or direct click.
- 🥷 **Stealth Coding & Peek-on-Start**:
  - While Antigravity is processing/coding (`thinking`), it stays tucked away in the notch tab with a gentle violet breathing LED line, keeping your code editor tabs and terminal 100% visible and unblocked.
  - **Peek on Start Toggle**: Optionally pops up for 2.5s upon task start so you see what is running, then automatically retracts into sleep.
  - **Persistent Alert & Done Displays**: When an action is required (`waiting`) or a task finishes (`done`), the HUD stays bloomed open continuously until you acknowledge it or continue with the next command.
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
node cli/test-event.js thinking   # Simulate active coding state
node cli/test-event.js done       # Simulate task finished (stays open until continued)
node cli/test-event.js waiting    # Simulate tool permission required (stays open)
node cli/test-event.js idle       # Reset to idle standby
```

Or open the in-app **Control Center Settings** (click the ⚙️ icon or right-click the pill) and use the **Preview States** tactile tiles.

---

## 📂 Project Structure

```
gravibuddy/
├── assets/                  # Official high-res branding & icons
│   └── antigravity-icon.png
├── cli/                     # CLI integration & forwarder
│   ├── forwarder.cmd        # Statusline pipe launcher
│   ├── forwarder.js         # HTTP dispatcher & agy-hud pipe
│   └── test-event.js        # CLI simulation tool
├── src/
│   ├── main/
│   │   └── index.js         # Window lifecycle & HTTP server (port 8998)
│   ├── preload/
│   │   └── index.js         # Secure contextBridge API
│   └── renderer/
│       ├── index.html       # Dynamic Island notch DOM
│       ├── renderer.js      # Notch state machine & audio
│       ├── settings.html    # Center Spotlight modal window DOM
│       ├── settings.js      # Spotlight controller & launcher
│       └── style.css        # Squircle glassmorphism & fluid spring physics
├── forwarder.cmd            # Root backward-compatible shim
└── package.json             # App metadata & dependencies
```

---

## 📄 License

MIT License © 2026 [Dhaafin](https://github.com/Dhaafin)
