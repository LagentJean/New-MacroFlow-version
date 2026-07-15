(() => {
  'use strict';

  const VERSION = 'MacroFlow-Delight-v1';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  const patterns = Object.freeze({ light: 7, selection: 5, medium: 13, success: [9, 35, 14], warning: [16, 42, 16] });
  const enterSelector = '.meal-row,.logged-set,.history-row,.pr-card,.recommendation,.program-summary,.plate-profile-row,.weight-pill';
  let lastHapticAt = 0;

  function haptic(kind = 'light', force = false) {
    if (typeof navigator.vibrate !== 'function' || document.visibilityState === 'hidden') return false;
    const now = Date.now();
    if (!force && now - lastHapticAt < 90) return false;
    try {
      const accepted = navigator.vibrate(patterns[kind] || patterns.light);
      lastHapticAt = now;
      return accepted !== false;
    } catch (_error) {
      return false;
    }
  }

  function restartAnimation(element, className, duration = 600) {
    if (!element || reducedMotion.matches) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  }

  function pulse(element, kind = 'success') {
    restartAnimation(element, kind === 'error' ? 'ux-shake' : 'ux-success-pulse');
  }

  function addRipple(target, event) {
    if (reducedMotion.matches || !target.matches('button')) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ripple = document.createElement('span');
    ripple.className = 'ux-ripple';
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;
    ripple.style.left = `${x - rect.left}px`;
    ripple.style.top = `${y - rect.top}px`;
    ripple.setAttribute('aria-hidden', 'true');
    target.classList.add('ux-ripple-host');
    target.append(ripple);
    window.setTimeout(() => ripple.remove(), 560);
  }

  function hapticKind(target) {
    if (target.matches('.danger,.delete-btn,.recommendation-dismiss,.backup-cancel')) return 'warning';
    if (target.matches('.big-button,.primary-action,.recommendation-apply,.set-entry button,.add-training-set,.backup-confirm')) return 'medium';
    return 'light';
  }

  function interactiveTarget(node) {
    return node instanceof Element ? node.closest('button,[role="button"],.camera-button,.gallery-button,.smart-capture') : null;
  }

  function animateInserted(root) {
    if (!(root instanceof Element)) return;
    const elements = root.matches(enterSelector) ? [root] : [...root.querySelectorAll(enterSelector)];
    elements.slice(0, 24).forEach((element, index) => {
      if (reducedMotion.matches) return;
      window.setTimeout(() => restartAnimation(element, 'ux-enter', 360), Math.min(index * 22, 150));
    });
  }

  document.documentElement.classList.add('ux-ready');
  const toast = document.getElementById('toast');
  if (toast) {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    new MutationObserver(() => {
      if (!toast.classList.contains('show')) return;
      const text = toast.textContent.toLowerCase();
      const error = /impossible|invalide|complète|choisis|d’abord|erreur|incomplet/.test(text);
      if (error) {
        pulse(toast, 'error');
        haptic('warning');
        return;
      }
      if (/ajout|appliqu|créé|restaur|enregistr|prête|termin/.test(text)) {
        pulse(document.getElementById('scoreRing'));
        pulse(document.getElementById('levelText')?.closest('.level-pill'));
        haptic('success');
      }
    }).observe(toast, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['class'] });
  }

  document.addEventListener('click', (event) => {
    const target = interactiveTarget(event.target);
    if (!target || target.matches(':disabled,[aria-disabled="true"]')) return;
    addRipple(target, event);
    if (event.isTrusted) haptic(hapticKind(target));
  }, { passive: true });

  document.addEventListener('change', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (event.target.matches('.choice-chip input,input[type="checkbox"],input[type="radio"],select')) haptic('selection');
  }, { passive: true });

  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) animateInserted(node);
  }).observe(document.body, { childList: true, subtree: true });

  window.MacroFlowDelight = Object.freeze({ version: VERSION, haptic, pulse, reducedMotion: () => reducedMotion.matches });
})();
