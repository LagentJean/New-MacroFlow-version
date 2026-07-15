(() => {
  const LABELS = {
    chest: 'Pectoraux',
    back: 'Dos',
    shoulders: 'Épaules',
    biceps: 'Biceps',
    triceps: 'Triceps',
    core: 'Abdominaux et tronc',
    quads: 'Quadriceps',
    glutes: 'Fessiers',
    hamstrings: 'Ischio-jambiers',
    calves: 'Mollets',
  };
  const MUSCLES = Object.keys(LABELS);
  const PUSH_PATTERNS = new Set(['horizontalPush', 'verticalPush', 'triceps']);
  const PULL_PATTERNS = new Set(['horizontalPull', 'verticalPull', 'biceps']);
  let latestState = { profile: {}, program: null, sessions: [], trainingReviews: [] };
  let selectedMuscle = 'chest';
  let refreshTimer = null;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function hoursBetween(now, value) { return Math.max(0, (now - new Date(value).getTime()) / 3600000); }
  function round(value, digits = 1) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
  function escapeText(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }
  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    const value = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean;
    const int = parseInt(value, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }
  function rgba(hex, alpha = 1) { const { r, g, b } = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
  function mixHex(baseHex, accentHex, amount = .5) {
    const a = hexToRgb(baseHex); const b = hexToRgb(accentHex);
    const m = (x, y) => Math.round(x + (y - x) * amount);
    return `rgb(${m(a.r,b.r)}, ${m(a.g,b.g)}, ${m(a.b,b.b)})`;
  }

  function inferPattern(set, exercise = {}) {
    if (exercise.pattern) return exercise.pattern;
    const text = `${set.exerciseId || ''} ${set.exerciseName || ''}`.toLowerCase();
    if (/curl|biceps|supination|chin.?up/.test(text)) return 'biceps';
    if (/triceps|pushdown|push.?down|skull|kickback|pompes serr|close.?push|extension.*bras|dip/.test(text)) return 'triceps';
    if (/press|développ|pompe|push.?up/.test(text)) return 'horizontalPush';
    if (/row|rowing|tirage|traction|pull.?up/.test(text)) return 'horizontalPull';
    return '';
  }
  function exerciseIndex(program, sessions = []) {
    const index = new Map();
    for (const day of program?.days || []) for (const exercise of day.exercises || []) index.set(exercise.id, exercise);
    for (const session of sessions || []) for (const exercise of session.exercises || []) index.set(exercise.id, exercise);
    return index;
  }
  function armTarget(pattern) {
    if (pattern === 'biceps' || PULL_PATTERNS.has(pattern)) return 'biceps';
    if (pattern === 'triceps' || PUSH_PATTERNS.has(pattern)) return 'triceps';
    return null;
  }
  function muscleContributionsForSet(set = {}, exercise = {}) {
    const pattern = inferPattern(set, exercise);
    const primary = set.exerciseMuscle || exercise.muscle;
    const secondary = Array.isArray(set.exerciseSecondary) ? set.exerciseSecondary : (exercise.secondary || []);
    const result = {};
    const add = (muscle, amount) => { if (MUSCLES.includes(muscle)) result[muscle] = (result[muscle] || 0) + amount; };
    if (primary === 'arms') {
      const target = armTarget(pattern);
      if (target) add(target, 1); else { add('biceps', .5); add('triceps', .5); }
    } else add(primary, 1);
    for (const muscle of secondary) {
      if (muscle === 'arms') {
        const target = armTarget(pattern);
        if (target) add(target, .38); else { add('biceps', .19); add('triceps', .19); }
      } else add(muscle, .38);
    }
    return result;
  }
  function rirFactor(rir) {
    if (!Number.isFinite(Number(rir))) return 1;
    return ({ 0: 1.35, 1: 1.18, 2: 1, 3: .86, 4: .72, 5: .6 })[clamp(Math.round(rir), 0, 5)] || 1;
  }
  function profileRecoveryMultiplier(profile = {}, reviews = [], now = Date.now()) {
    let multiplier = profile.recovery === 'variable' ? 1.16 : profile.recovery === 'fast' ? .92 : 1;
    if (profile.sleep === 'under6') multiplier *= 1.14;
    else if (profile.sleep === '6to7') multiplier *= 1.05;
    else if (profile.sleep === 'over9') multiplier *= .97;
    if (profile.stress === 'high') multiplier *= 1.1;
    else if (profile.stress === 'low') multiplier *= .96;
    const recent = [...(reviews || [])]
      .filter((review) => review.createdAt && hoursBetween(now, review.createdAt) <= 14 * 24)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (recent) {
      if (Number(recent.recovery) <= 2) multiplier *= 1.1;
      else if (Number(recent.recovery) >= 4) multiplier *= .96;
      if (Number(recent.soreness) >= 4) multiplier *= 1.08;
      if (Number(recent.sleep) <= 2) multiplier *= 1.06;
    }
    return clamp(multiplier, .78, 1.5);
  }
  function statusFor(score) {
    const value = clamp(score, 0, 1);
    if (value >= .62) return { key: 'very-high', label: 'Très récente', color: '#ff453a' };
    if (value >= .42) return { key: 'high', label: 'Élevée', color: '#ff9f0a' };
    if (value >= .24) return { key: 'moderate', label: 'Modérée', color: '#ffd60a' };
    if (value >= .1) return { key: 'low', label: 'Faible', color: '#30d158' };
    return { key: 'neutral', label: 'Aucune trace récente', color: '#69666f' };
  }
  function buildRecoveryModel({ profile = {}, program = null, sessions = [], trainingReviews = [] } = {}, now = Date.now()) {
    const model = Object.fromEntries(MUSCLES.map((muscle) => [muscle, { muscle, label: LABELS[muscle], score: 0, effectiveSets: 0, lastWorkedAt: null, lastSessionSets: 0, sessions: 0 }]));
    const exercises = exerciseIndex(program, sessions);
    const multiplier = profileRecoveryMultiplier(profile, trainingReviews, now);
    const baseHalfLife = 18 * multiplier;
    for (const session of sessions || []) {
      if (!session.completedAt) continue;
      const ageHours = hoursBetween(now, session.completedAt);
      if (ageHours > 120 || new Date(session.completedAt).getTime() > now + 300000) continue;
      const demand = Object.fromEntries(MUSCLES.map((muscle) => [muscle, { sets: 0, failure: 0 }]));
      for (const set of session.sets || []) {
        const exercise = exercises.get(set.exerciseId) || {};
        const factor = rirFactor(set.rir);
        for (const [muscle, share] of Object.entries(muscleContributionsForSet(set, exercise))) {
          demand[muscle].sets += share * factor;
          if (Number(set.rir) === 0) demand[muscle].failure += share;
        }
      }
      for (const muscle of MUSCLES) {
        const effectiveSets = demand[muscle].sets;
        if (effectiveSets <= 0) continue;
        const failureShare = clamp(demand[muscle].failure / Math.max(.1, effectiveSets), 0, 1);
        const halfLife = baseHalfLife * (1 + failureShare * .16);
        const initial = clamp(.28 + effectiveSets * .13, 0, .97);
        const contribution = initial * (0.5 ** (ageHours / halfLife));
        const entry = model[muscle];
        entry.score = 1 - ((1 - entry.score) * (1 - contribution));
        entry.effectiveSets += effectiveSets;
        entry.sessions += 1;
        if (!entry.lastWorkedAt || new Date(session.completedAt) > new Date(entry.lastWorkedAt)) {
          entry.lastWorkedAt = session.completedAt;
          entry.lastSessionSets = effectiveSets;
        }
      }
    }
    for (const muscle of MUSCLES) {
      const entry = model[muscle];
      entry.score = clamp(entry.score, 0, 1);
      entry.effectiveSets = round(entry.effectiveSets, 1);
      entry.lastSessionSets = round(entry.lastSessionSets, 1);
      entry.hoursSince = entry.lastWorkedAt ? round(hoursBetween(now, entry.lastWorkedAt), 1) : null;
      entry.status = statusFor(entry.score);
      entry.halfLifeModel = round(baseHalfLife, 1);
    }
    return model;
  }
  function formatElapsed(hours) {
    if (hours == null) return 'Jamais enregistré';
    if (hours < 1) return 'Il y a moins de 1 h';
    if (hours < 24) return `Il y a ${Math.round(hours)} h`;
    const days = Math.floor(hours / 24); const remainder = Math.round(hours % 24);
    return `Il y a ${days} j${remainder ? ` ${remainder} h` : ''}`;
  }

  const REGIONS = {
    shoulders: [
      'M 368 196 C 334 204 318 227 322 264 C 328 302 349 323 383 320 C 408 317 423 301 430 278 C 438 250 434 227 416 210 C 403 198 388 194 368 196 Z',
      'M 633 196 C 667 204 683 227 679 264 C 673 302 652 323 618 320 C 593 317 578 301 571 278 C 563 250 567 227 585 210 C 598 198 613 194 633 196 Z',
      'M 892 194 C 858 201 842 222 846 259 C 852 296 872 316 906 316 C 932 315 950 300 957 277 C 965 249 960 227 942 210 C 929 198 914 193 892 194 Z',
      'M 1157 194 C 1191 201 1207 222 1203 259 C 1197 296 1177 316 1143 316 C 1117 315 1099 300 1092 277 C 1084 249 1089 227 1107 210 C 1120 198 1135 193 1157 194 Z'
    ],
    chest: [
      'M 402 238 C 368 245 349 268 352 309 C 355 348 382 370 426 368 C 459 366 484 349 495 319 C 502 300 503 275 500 247 C 468 234 435 232 402 238 Z',
      'M 599 238 C 633 245 652 268 649 309 C 646 348 619 370 575 368 C 542 366 517 349 506 319 C 499 300 498 275 501 247 C 533 234 566 232 599 238 Z'
    ],
    biceps: [
      'M 323 279 C 301 300 291 331 294 380 C 296 422 307 452 327 472 C 345 490 368 488 380 471 C 391 455 391 434 386 402 C 378 351 375 316 364 292 C 354 272 340 267 323 279 Z',
      'M 678 279 C 700 300 710 331 707 380 C 705 422 694 452 674 472 C 656 490 633 488 621 471 C 610 455 610 434 615 402 C 623 351 626 316 637 292 C 647 272 661 267 678 279 Z'
    ],
    core: [
      'M 447 324 C 430 347 424 376 426 417 C 429 470 446 517 500 564 C 554 517 571 470 574 417 C 576 376 570 347 553 324 C 531 333 515 338 500 338 C 485 338 469 333 447 324 Z',
      'M 403 324 C 383 341 373 370 375 410 C 377 450 391 489 417 523 C 434 501 442 463 447 411 C 451 372 447 341 437 321 C 424 321 413 322 403 324 Z',
      'M 597 324 C 617 341 627 370 625 410 C 623 450 609 489 583 523 C 566 501 558 463 553 411 C 549 372 553 341 563 321 C 576 321 587 322 597 324 Z'
    ],
    quads: [
      'M 405 505 C 375 541 361 592 365 662 C 369 742 387 801 424 840 C 457 813 478 752 482 668 C 486 600 472 547 445 513 C 433 499 419 496 405 505 Z',
      'M 520 505 C 505 533 498 585 501 653 C 504 727 517 786 540 829 C 571 789 587 734 593 664 C 600 591 590 536 566 505 C 553 489 532 491 520 505 Z',
      'M 595 505 C 625 541 639 592 635 662 C 631 742 613 801 576 840 C 543 813 522 752 518 668 C 514 600 528 547 555 513 C 567 499 581 496 595 505 Z',
      'M 480 505 C 495 533 502 585 499 653 C 496 727 483 786 460 829 C 429 789 413 734 407 664 C 400 591 410 536 434 505 C 447 489 468 491 480 505 Z'
    ],
    calves: [
      'M 419 740 C 398 772 390 815 397 872 C 403 920 419 956 445 985 C 466 952 476 913 477 868 C 478 817 462 772 438 744 C 432 737 425 735 419 740 Z',
      'M 583 740 C 604 772 612 815 605 872 C 599 920 583 956 557 985 C 536 952 526 913 525 868 C 524 817 540 772 564 744 C 570 737 577 735 583 740 Z',
      'M 995 743 C 972 777 963 821 970 878 C 976 922 993 956 1017 982 C 1040 948 1050 909 1052 864 C 1054 816 1038 775 1013 745 C 1008 739 1001 737 995 743 Z',
      'M 1097 743 C 1120 777 1129 821 1122 878 C 1116 922 1099 956 1075 982 C 1052 948 1042 909 1040 864 C 1038 816 1054 775 1079 745 C 1084 739 1091 737 1097 743 Z'
    ],
    back: [
      'M 957 205 C 922 228 902 267 898 323 C 894 393 911 453 948 512 C 973 471 991 414 999 345 C 1004 299 999 252 980 213 C 972 200 966 197 957 205 Z',
      'M 1092 205 C 1127 228 1147 267 1151 323 C 1155 393 1138 453 1101 512 C 1076 471 1058 414 1050 345 C 1045 299 1050 252 1069 213 C 1077 200 1083 197 1092 205 Z',
      'M 1002 146 C 986 175 980 212 983 257 C 986 295 1001 325 1030 349 C 1049 365 1075 365 1094 349 C 1123 325 1138 295 1141 257 C 1144 212 1138 175 1122 146 C 1103 163 1084 173 1062 173 C 1040 173 1021 163 1002 146 Z'
    ],
    triceps: [
      'M 904 285 C 882 305 871 337 874 389 C 876 431 887 463 907 485 C 924 503 947 502 959 484 C 969 468 970 444 966 411 C 959 358 955 322 944 298 C 935 280 921 275 904 285 Z',
      'M 1145 285 C 1167 305 1178 337 1175 389 C 1173 431 1162 463 1142 485 C 1125 503 1102 502 1090 484 C 1080 468 1079 444 1083 411 C 1090 358 1094 322 1105 298 C 1114 280 1128 275 1145 285 Z'
    ],
    glutes: [
      'M 966 446 C 929 468 915 509 924 563 C 931 608 958 634 1002 635 C 1039 636 1060 613 1064 574 C 1068 525 1053 479 1027 453 C 1011 437 986 434 966 446 Z',
      'M 1158 446 C 1195 468 1209 509 1200 563 C 1193 608 1166 634 1122 635 C 1085 636 1064 613 1060 574 C 1056 525 1071 479 1097 453 C 1113 437 1138 434 1158 446 Z'
    ],
    hamstrings: [
      'M 972 565 C 944 604 933 661 938 735 C 943 794 958 844 983 885 C 1019 845 1037 786 1039 712 C 1042 651 1031 603 1007 570 C 998 558 984 556 972 565 Z',
      'M 1152 565 C 1180 604 1191 661 1186 735 C 1181 794 1166 844 1141 885 C 1105 845 1087 786 1085 712 C 1082 651 1093 603 1117 570 C 1126 558 1140 556 1152 565 Z'
    ]
  };

  function regionMarkup(muscle, entry) {
    const status = entry.status;
    const selected = muscle === selectedMuscle;
    const opacity = status.key === 'neutral' ? .02 : clamp(.18 + entry.score * .48, .18, .72);
    const fill = status.key === 'neutral' ? 'rgba(255,255,255,0.01)' : rgba(status.color, opacity);
    const glow = status.key === 'neutral' ? 'transparent' : rgba(status.color, Math.min(.42, opacity * .7));
    return `<g class="muscle-region${selected ? ' selected' : ''}" data-muscle="${muscle}" tabindex="0" role="button" aria-label="${escapeText(`${entry.label} : sollicitation ${status.label.toLowerCase()}`)}" aria-pressed="${selected}" style="--region-fill:${fill};--region-glow:${glow}">${REGIONS[muscle].map((d) => `<path class="muscle-path" d="${d}"/>`).join('')}</g>`;
  }
  function renderZones(model) {
    const container = document.getElementById('muscleMapZones');
    if (!container) return;
    container.innerHTML = `<svg class="muscle-map-svg" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g class="muscle-layer">${MUSCLES.map((muscle) => regionMarkup(muscle, model[muscle])).join('')}</g></svg>`;
  }
  function renderDetail(model) {
    const container = document.getElementById('muscleRecoveryDetail');
    if (!container) return;
    const entry = model[selectedMuscle] || model.chest;
    const status = entry.status;
    const note = !entry.lastWorkedAt
      ? 'Aucune série récente n’est attribuée à ce muscle. Commence une séance et enregistre tes séries pour activer l’estimation.'
      : entry.score >= .42
        ? 'Sollicitation encore importante dans le modèle. Ce n’est pas une interdiction de t’entraîner : vérifie ton échauffement, ta performance et toute douleur inhabituelle.'
        : 'La trace calculée a diminué. Ta sensation, la qualité du mouvement et ta performance restent les meilleurs signaux avant de charger lourd.';
    container.innerHTML = `<div class="muscle-detail-head"><div><strong>${escapeText(entry.label)}</strong><small>${formatElapsed(entry.hoursSince)}</small></div><span class="muscle-detail-state" style="--state-color:${status.color}">${escapeText(status.label)}</span></div><div class="muscle-detail-meter" aria-label="Indice de sollicitation ${Math.round(entry.score * 100)} sur 100"><span style="width:${Math.round(entry.score * 100)}%"></span></div><div class="muscle-detail-facts"><div><b>${Math.round(entry.score * 100)}/100</b><small>Indice estimé</small></div><div><b>${entry.lastSessionSets || 0}</b><small>Séries pondérées · dernière séance</small></div><div><b>${entry.sessions}</b><small>Séance${entry.sessions !== 1 ? 's' : ''} prise${entry.sessions !== 1 ? 's' : ''} en compte · 5 jours</small></div></div><p class="muscle-detail-note">${escapeText(note)}</p>`;
  }
  function renderSelector(model) {
    const container = document.getElementById('muscleRecoverySelector');
    if (!container) return;
    container.innerHTML = MUSCLES.map((muscle) => {
      const entry = model[muscle];
      return `<button type="button" class="muscle-selector-button${muscle === selectedMuscle ? ' selected' : ''}" data-select-muscle="${muscle}" aria-pressed="${muscle === selectedMuscle}" style="--chip-color:${entry.status.color}"><i></i>${escapeText(entry.label)}</button>`;
    }).join('');
  }
  function renderOverview(model) {
    const container = document.getElementById('muscleRecoveryOverview');
    const updated = document.getElementById('muscleRecoveryUpdated');
    if (!container) return;
    const worked = Object.values(model).filter((entry) => entry.lastWorkedAt);
    const highest = [...worked].sort((a, b) => b.score - a.score)[0];
    if (!highest) {
      container.innerHTML = '<div><strong>La carte attend ta première séance</strong><small>Enregistre tes séries et ton RIR : les muscles se coloreront automatiquement.</small></div><span>0 zone active</span>';
    } else {
      const active = worked.filter((entry) => entry.score >= .1).length;
      container.innerHTML = `<div><strong>${escapeText(highest.label)} : zone la plus sollicitée</strong><small>${escapeText(highest.status.label)} · ${formatElapsed(highest.hoursSince).toLowerCase()}</small></div><span>${active} zone${active !== 1 ? 's' : ''} active${active !== 1 ? 's' : ''}</span>`;
      if (!worked.some((entry) => entry.muscle === selectedMuscle)) selectedMuscle = highest.muscle;
    }
    if (updated) updated.textContent = `Calcul ${new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  }
  function render() {
    if (!document.getElementById('muscleMapZones')) return;
    const model = buildRecoveryModel(latestState);
    renderOverview(model); renderZones(model); renderSelector(model); renderDetail(model);
  }
  function bind() {
    document.getElementById('muscleMapZones')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-muscle]');
      if (!button) return;
      selectedMuscle = button.dataset.muscle; render();
    });
    document.getElementById('muscleMapZones')?.addEventListener('keydown', (event) => {
      const button = event.target.closest('[data-muscle]');
      if (!button) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); selectedMuscle = button.dataset.muscle; render();
    });
    document.getElementById('muscleRecoverySelector')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-select-muscle]');
      if (!button) return;
      selectedMuscle = button.dataset.selectMuscle; render();
    });
    window.addEventListener('macroflow:training-state-rendered', (event) => { latestState = event.detail || latestState; render(); });
    window.addEventListener('macroflow:session-complete', () => window.setTimeout(render, 50));
    render();
    refreshTimer = window.setInterval(render, 15 * 60 * 1000);
    refreshTimer?.unref?.();
  }

  window.MacroFlowMuscleRecoveryV22 = { version: 'MacroFlow-Muscle-Recovery-v22.2', buildRecoveryModel, statusFor, muscleContributionsForSet, profileRecoveryMultiplier };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
