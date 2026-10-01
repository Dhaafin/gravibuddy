// Compact View UI: labels, radial gauge, state glyphs, cycle indicator
import { dom } from './dom.js';
import { state } from './state.js';

export function updateRadialGauge(quotaPercent) {
  if (!dom.gaugeFill) return;
  const pct = Math.max(0, Math.min(100, quotaPercent ?? 95));
  // Circle radius 18.5 -> Circumference = 2 * PI * 18.5 = 116.24
  const offset = 116.24 * (1 - pct / 100);
  dom.gaugeFill.style.strokeDasharray = '116.24';
  dom.gaugeFill.style.strokeDashoffset = offset.toFixed(1);

  if (pct <= 15) {
    dom.gaugeFill.style.stroke = '#ef4444';
  } else if (pct <= 35) {
    dom.gaugeFill.style.stroke = '#f59e0b';
  } else {
    dom.gaugeFill.style.stroke = '#10b981';
  }
}

export function updateStateGlyph(agentState, modelLabel, message) {
  const glyphs = [dom.glyphIdle, dom.glyphThinking, dom.glyphWaiting, dom.glyphDone];
  glyphs.forEach(g => {
    if (g) g.classList.remove('active');
  });

  const model = modelLabel || 'Antigravity';
  if (dom.vTooltipModel) dom.vTooltipModel.textContent = model;

  if (agentState === 'thinking') {
    if (dom.glyphThinking) dom.glyphThinking.classList.add('active');
    if (dom.vTooltipStatus) dom.vTooltipStatus.textContent = 'Coding...';
    if (dom.vTooltipDot) dom.vTooltipDot.className = 'v-tooltip-dot dot-thinking';
  } else if (agentState === 'waiting') {
    if (dom.glyphWaiting) dom.glyphWaiting.classList.add('active');
    if (dom.vTooltipStatus) dom.vTooltipStatus.textContent = message || 'Action Required';
    if (dom.vTooltipDot) dom.vTooltipDot.className = 'v-tooltip-dot dot-waiting';
  } else if (agentState === 'done') {
    if (dom.glyphDone) dom.glyphDone.classList.add('active');
    if (dom.vTooltipStatus) dom.vTooltipStatus.textContent = 'Task Completed';
    if (dom.vTooltipDot) dom.vTooltipDot.className = 'v-tooltip-dot dot-done';
  } else {
    if (dom.glyphIdle) dom.glyphIdle.classList.add('active');
    if (dom.vTooltipStatus) dom.vTooltipStatus.textContent = 'Standby';
    if (dom.vTooltipDot) dom.vTooltipDot.className = 'v-tooltip-dot dot-idle';
  }
}

export function updateCompactCycleIndicator() {
  if (!dom.islandContent) return;
  if (state.activeSessionsList.length > 1) {
    dom.islandContent.classList.add('can-cycle');
    dom.islandContent.title = `Click to switch agent (${state.activeSessionsList.length} active)`;
  } else {
    dom.islandContent.classList.remove('can-cycle');
    dom.islandContent.removeAttribute('title');
  }
}

export function updateIslandLabels(data, modelLabel) {
  updateRadialGauge(data.quotaPercent);
  updateStateGlyph(data.state, modelLabel, data.message);

  if (data.state === 'thinking') {
    if (dom.primaryLabel) dom.primaryLabel.textContent = data.project || 'Antigravity Coding';
    if (dom.secondaryLabel) dom.secondaryLabel.textContent = data.message || `Processing with ${modelLabel}`;
    if (dom.metricVal) dom.metricVal.textContent = 'ACTIVE';
  } else if (data.state === 'done') {
    if (dom.primaryLabel) dom.primaryLabel.textContent = data.project ? `${data.project} • Done` : 'Task Completed';
    if (dom.secondaryLabel) dom.secondaryLabel.textContent = `Ready for next prompt • ${modelLabel}`;
    if (dom.metricVal) dom.metricVal.textContent = 'DONE';
  } else if (data.state === 'waiting') {
    if (dom.primaryLabel) dom.primaryLabel.textContent = data.project ? `${data.project} • Action` : 'Action Required';
    if (dom.secondaryLabel) dom.secondaryLabel.textContent = data.message || 'Waiting for approval';
    if (dom.metricVal) dom.metricVal.textContent = 'WAIT';
  } else {
    if (dom.primaryLabel) dom.primaryLabel.textContent = data.project || 'Antigravity';
    if (dom.secondaryLabel) dom.secondaryLabel.textContent = modelLabel;
    if (dom.metricVal) {
      dom.metricVal.textContent = data.quotaPercent !== null && data.quotaPercent !== undefined
        ? `${data.quotaPercent}% QTA`
        : (data.contextPercent !== null && data.contextPercent !== undefined ? `${data.contextPercent}% CTX` : 'READY');
    }
  }
}

export function applyOrientationClasses(orientation) {
  if (!dom.islandRoot) return;
  dom.islandRoot.classList.remove('vertical-left', 'vertical-right');
  if (orientation === 'vertical-left') {
    dom.islandRoot.classList.add('vertical-left');
  } else if (orientation === 'vertical-right') {
    dom.islandRoot.classList.add('vertical-right');
  }
}
