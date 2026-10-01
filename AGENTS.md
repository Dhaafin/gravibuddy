# 🛸 Gravibuddy — Agent Guide & Architecture Reference

> **Apple-Grade Dynamic Island Floating HUD Companion for Google Antigravity & Antigravity 2.0**

---

## 1. Project Overview & Vision
Gravibuddy is an ultra-lightweight, luxury desktop HUD companion designed for Google Antigravity development workflows (both **Antigravity CLI** and **Antigravity 2.0 Desktop**). 
It renders an Apple-grade Dynamic Island attached directly to the top screen bezel (MacBook-style notch) or docked vertically on the display edge, providing ambient glanceable awareness of agent states (`thinking`, `waiting`, `done`, `idle`) without stealing editor focus or cluttering workspace screen real estate.

---

## 2. Repository Layout

```text
├── assets/                  # High-resolution logos, sound effects, icon assets
├── cli/                     # Agent bridge scripts & simulations
│   ├── agy2-hook.js         # Fast fire-and-forget Lifecycle Hook bridge for Antigravity 2.0
│   ├── agy2-hook.cmd        # Windows cmd wrapper for agy2-hook
│   ├── forwarder.js         # Statusline forwarder for Antigravity CLI
│   ├── forwarder.cmd        # Windows cmd wrapper for forwarder
│   └── test-event.js        # Simulation script for state testing
├── references/              # External references (gitignored, e.g., Coucou)
│   └── coucou/              # Reference implementation for notch interaction patterns
├── src/
│   ├── main/
│   │   └── index.js         # Electron main process (HTTP bridge :8998, windows, watchdog, config)
│   ├── preload/
│   │   └── index.js         # Secure contextBridge API (`window.graviAPI`)
│   └── renderer/
│       ├── index.html       # Attached Hardware Notch & Dynamic Island canvas
│       ├── renderer.js      # Thin HUD state machine router & orchestrator
│       ├── modules/         # Domain-specific ES modules
│       │   ├── dom.js           # Centralized DOM element registry
│       │   ├── state.js         # Reactive state store, session helpers & timers
│       │   ├── audio.js         # Procedural Web Audio API synthesizer
│       │   ├── effects.js       # Fluid watery morph & light sheen animations
│       │   ├── compact-view.js  # Compact notch UI updates & orientation classes
│       │   ├── expanded-view.js # Luxury expanded card UI & multi-agent tabs deck
│       │   ├── lifecycle.js     # Sleep tab, wake logic & auto-dismiss countdown
│       │   └── interaction.js   # Zero-padding click-through pass & event handlers
│       ├── settings.html    # macOS / VisionOS Control Center modal
│       ├── settings.js      # Modal controls (docking positions, toggles, quit)
│       ├── style.css        # Modular CSS entry point (@import aggregator)
│       └── styles/          # Domain-specific modular stylesheets
│           ├── base.css         # Font typography & global resets
│           ├── island.css       # Notch capsule, hardware ears, layout & typography
│           ├── animations.css   # Fluid watery morph, specular light sheen, implosion/blossom
│           ├── states.css       # Aura glowing (Thinking violet, Done green, Waiting amber)
│           ├── vertical.css     # Vertical dock capsule, radial quota gauge, flyout tooltip
│           └── settings.css     # Control Center modal styles & spring physics
├── forwarder.cmd            # Root backward-compat shim delegating to cli/forwarder.cmd
├── package.json             # App manifest & scripts
├── README.md                # Public user documentation & installation guide
└── AGENTS.md                # Agent rules & codebase source of truth (this file)
```

---

## 3. Communication & Integration Architecture

### A. Antigravity 2.0 (Desktop App)
* **Channel:** Lifecycle Hooks (`~/.gemini/config/hooks.json`).
* **Events:**
  * `PreInvocation` $\rightarrow$ calls `cli/agy2-hook.cmd pre-invocation` $\rightarrow$ emits `{ state: 'thinking' }`.
  * `Stop` $\rightarrow$ calls `cli/agy2-hook.cmd stop` $\rightarrow$ emits `{ state: 'done' }`.
* **Bridge Contract:**
  * Hooks **must return `{}` on `stdout` immediately** (<5ms) and fire HTTP POST asynchronously.
  * Antigravity 2.0 must **never** be delayed or blocked by Gravibuddy.
  * If Gravibuddy is closed or offline, hook requests must fail silently without errors.

### B. Antigravity CLI (`agy`)
* **Channel:** `statusLine` command in `~/.gemini/antigravity-cli/settings.json`.
* Pipes telemetry to `forwarder.cmd` $\rightarrow$ HTTP POST to `http://127.0.0.1:8998/update`.
* Parallel pass-through to `agy-hud` if installed.

### C. Internal Bridge Server
* Port: `127.0.0.1:8998` (`/update` endpoint).
* Handles normalized event payloads: `{ state, model, project, message, quotaPercent, contextPercent }`.
* Includes safety watchdog timer (3 minutes) to automatically revert stuck states if connections drop abruptly.

---

## 4. UI & Interaction Foundations

1. **Hardware Attached Notch**:
   * Sits flush against the physical top bezel (0px gap).
   * Outer concave fillets (`.notch-ear`) bridge the black notch into the display border.
2. **Zero-Padding Click-Through**:
   * Uses `mainWindow.setIgnoreMouseEvents(true, { forward: true })`.
   * Transparent screen areas pass clicks directly to windows underneath with zero dead zones.
   * `checkInteractiveHit` on `mousemove` re-enables pointer events only over the island pill.
3. **Hover Intent Filter (160ms)**:
   * Fast cursor sweeps over browser tabs will never accidentally pop open the notch.
   * Notch wakes up only on deliberate hover (160ms dwell) or click.
4. **Stealth Mode & Sleep Tab**:
   * While coding (`thinking`), tucks into a minimalist 6px hardware bezel tab with violet breathing LED.
   * Alerts (`waiting`) and completions (`done`) bloom open and stay visible until acknowledged.
5. **Procedural Web Audio Synthesizer**:
   * Zero external MP3/WAV files for core feedback. Procedurally generates Apple-grade sine wave completion chimes (E5 $\rightarrow$ B5) and bubble pops via Web Audio API.

---

## 5. Renderer Process Architecture (Native ESM)

The renderer process utilizes **native ECMAScript Modules (`<script type="module">`)** supported out-of-the-box by Chromium in Electron. No bundlers (Webpack, Vite, Rollup) or build steps are required.

```text
src/renderer/
├── index.html          # Entry HTML (<script type="module" src="renderer.js">)
├── renderer.js         # Thin state machine router & IPC subscriber (~190 lines)
└── modules/            # Single-responsibility domain modules
    ├── dom.js          # Centralized DOM query selector cache & element registry
    ├── state.js        # Reactive state store, active session accessors, & timer cleanup
    ├── audio.js        # Procedural Web Audio API synthesizer (sine chimes & bubble pops)
    ├── effects.js      # Fluid watery morph & specular light sheen triggers
    ├── compact-view.js # Compact notch UI (labels, radial quota gauge ring, state glyphs)
    ├── expanded-view.js# Luxury expanded card (multi-agent tabs deck, session detail, sticky expand)
    ├── lifecycle.js    # Sleep mode tab, deliberate wake triggers, & auto-dismiss countdown
    └── interaction.js  # Zero-padding click-through hit testing & event bindings
```

### Module Responsibilities & Flow:
1. **`dom.js`**: Single source of truth for all cached DOM elements. Prevents duplicate `document.getElementById` queries.
2. **`state.js`**: Shared state container (`activeSessionsList`, `selectedSessionId`, preference toggles, active timers). Pure accessors: `getActiveSession()`, `hasAnyWaitingSession()`.
3. **`lifecycle.js` & `interaction.js`**: Decoupled hit-testing (`elementFromPoint`) and sleep/wake timers so mouse pass-through remains snappy and glitch-free.
4. **`renderer.js`**: High-level orchestrator that subscribes to `window.graviAPI` IPC channels and delegates rendering to `compact-view.js` and `expanded-view.js`.

---

## 6. Coding Principles (Ponytail Ladder)

Whenever contributing or refactoring Gravibuddy:

1. **No Unnecessary Dependencies (YAGNI)**:
   * Use native Web APIs, Electron standard libraries, and CSS transforms over heavy external packages.
2. **Small & Focused Commits**:
   * Follow conventional commits format (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
   * Commit in small, verifiable units.
3. **Clean Code & No Redundant Comments**:
   * Avoid giant banner comment walls or verbose self-evident comments. Keep code minimal, expressive, and self-documenting.
4. **Resilient & Crash-Proof**:
   * Always wrap IPC and network calls in try/catch or error handlers.
   * State machine hierarchy: `waiting` (priority alert) $\succ$ `thinking` $\succ$ `done` $\succ$ `idle`.

---

## 7. Development & Testing Commands

```bash
# Start Gravibuddy
npm start

# Test simulated agent states
node cli/test-event.js agy2        # Thinking / Coding (Antigravity 2.0)
node cli/test-event.js agy2-done   # Task Completed (Chime & Green)
node cli/test-event.js waiting     # Tool Approval Required (Amber Alert)
node cli/test-event.js idle        # Reset to Idle Standby

# Test bridge ping
curl http://127.0.0.1:8998/ping
```
