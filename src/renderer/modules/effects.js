// Fluid Watery Morphing & Light Sheen Animations
import { dom } from './dom.js';

export function triggerWateryMorph() {
  if (!dom.island) return;
  dom.island.classList.remove('watery-morph', 'sheen-active');
  void dom.island.offsetWidth; // Force CSS reflow
  dom.island.classList.add('watery-morph', 'sheen-active');
  setTimeout(() => {
    if (dom.island) dom.island.classList.remove('watery-morph', 'sheen-active');
  }, 680);
}
