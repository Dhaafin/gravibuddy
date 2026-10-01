// DOM Elements registry for Gravibuddy Island HUD
export const dom = {
  // Island Root & Notch Container
  islandRoot: document.getElementById('islandRoot'),
  island: document.getElementById('island'),
  compactView: document.getElementById('compactView'),
  expandedView: document.getElementById('expandedView'),
  islandContent: document.getElementById('islandContent'),
  primaryLabel: document.getElementById('primaryLabel'),
  secondaryLabel: document.getElementById('secondaryLabel'),
  metricVal: document.getElementById('metricVal'),
  btnExpandCard: document.getElementById('btnExpandCard'),
  gaugeFill: document.getElementById('gaugeFill'),
  
  // Vertical Mode Glyphs & Tooltip
  glyphIdle: document.getElementById('glyphIdle'),
  glyphThinking: document.getElementById('glyphThinking'),
  glyphWaiting: document.getElementById('glyphWaiting'),
  glyphDone: document.getElementById('glyphDone'),
  vTooltipDot: document.getElementById('vTooltipDot'),
  vTooltipStatus: document.getElementById('vTooltipStatus'),
  vTooltipModel: document.getElementById('vTooltipModel'),
  vGlyphBtn: document.getElementById('vGlyphBtn'),
  
  // Compact Accessory Controls
  btnSettings: document.getElementById('btnSettings'),
  btnMiniClose: document.getElementById('btnMiniClose'),
  countdownBar: document.getElementById('countdownBar'),

  // Expanded View Activity Deck Elements
  agentListDeck: document.getElementById('agentListDeck'),
  headerCountBadge: document.getElementById('headerCountBadge'),
  expandedQuotaBadge: document.getElementById('expandedQuotaBadge'),
  btnExpandedSettings: document.getElementById('btnExpandedSettings'),
  btnHeaderRetract: document.getElementById('btnHeaderRetract'),
  btnFocusAntigravity: document.getElementById('btnFocusAntigravity'),
  btnDismissActive: document.getElementById('btnDismissActive'),
  btnRetractExpanded: document.getElementById('btnRetractExpanded')
};
