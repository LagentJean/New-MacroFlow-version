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
    const recent = [...(reviews || [])].filter((review) => review.createdAt && hoursBetween(now, review.createdAt) <= 14 * 24).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
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
      // front left and right delts
      'M 354 208 C 328 220 316 248 321 278 C 326 306 342 325 365 332 C 385 338 404 333 418 320 C 431 307 437 289 438 265 C 439 240 431 221 412 209 C 394 198 374 198 354 208 Z',
      'M 582 208 C 608 220 620 248 615 278 C 610 306 594 325 571 332 C 551 338 532 333 518 320 C 505 307 499 289 498 265 C 497 240 505 221 524 209 C 542 198 562 198 582 208 Z',
      // back left and right rear delts
      'M 897 204 C 870 216 857 244 861 273 C 865 302 881 321 905 328 C 925 335 944 330 959 316 C 972 304 979 286 980 263 C 981 238 973 219 954 208 C 936 197 916 196 897 204 Z',
      'M 1145 204 C 1172 216 1185 244 1181 273 C 1177 302 1161 321 1137 328 C 1117 335 1098 330 1083 316 C 1070 304 1063 286 1062 263 C 1061 238 1069 219 1088 208 C 1106 197 1126 196 1145 204 Z'
    ],
    chest: [
      // front pectorals tightly following the illustrated pecs
      'M 388 233 C 368 241 356 256 352 280 C 348 304 355 325 372 340 C 388 354 408 361 429 362 C 452 363 471 356 485 342 C 497 330 503 314 505 296 C 507 277 505 261 500 247 C 479 237 458 232 437 231 C 419 230 403 231 388 233 Z',
      'M 548 231 C 527 232 506 237 485 247 C 480 261 478 277 480 296 C 482 314 488 330 500 342 C 514 356 533 363 556 362 C 577 361 597 354 613 340 C 630 325 637 304 633 280 C 629 256 617 241 597 233 C 582 231 566 230 548 231 Z'
    ],
    biceps: [
      // front biceps following upper-arm bellies
      'M 329 273 C 314 287 307 312 308 348 C 309 380 316 409 330 431 C 342 451 357 459 371 455 C 384 451 391 438 393 419 C 396 393 392 364 386 334 C 380 305 370 283 357 271 C 347 262 338 263 329 273 Z',
      'M 607 273 C 622 287 629 312 628 348 C 627 380 620 409 606 431 C 594 451 579 459 565 455 C 552 451 545 438 543 419 C 540 393 544 364 550 334 C 556 305 566 283 579 271 C 589 262 598 263 607 273 Z'
    ],
    triceps: [
      // front outer triceps hint
      'M 309 328 C 297 356 293 389 296 426 C 300 458 309 483 323 499 C 334 511 345 511 353 502 C 362 492 364 476 361 450 C 356 414 348 379 339 346 C 333 323 321 314 309 328 Z',
      'M 627 328 C 639 356 643 389 640 426 C 636 458 627 483 613 499 C 602 511 591 511 583 502 C 574 492 572 476 575 450 C 580 414 588 379 597 346 C 603 323 615 314 627 328 Z',
      // back triceps primary
      'M 869 284 C 856 301 850 331 852 372 C 854 409 862 442 876 466 C 888 486 904 495 918 489 C 930 484 936 470 938 449 C 940 420 936 387 928 352 C 921 319 911 293 896 281 C 886 273 877 274 869 284 Z',
      'M 1173 284 C 1186 301 1192 331 1190 372 C 1188 409 1180 442 1166 466 C 1154 486 1138 495 1124 489 C 1112 484 1106 470 1104 449 C 1102 420 1106 387 1114 352 C 1121 319 1131 293 1146 281 C 1156 273 1165 274 1173 284 Z'
    ],
    core: [
      // upper abs / central trunk
      'M 439 317 C 430 333 425 354 425 381 C 425 421 437 461 459 496 C 470 513 484 526 500 537 C 516 526 530 513 541 496 C 563 461 575 421 575 381 C 575 354 570 333 561 317 C 542 323 522 327 500 327 C 478 327 458 323 439 317 Z',
      // left oblique
      'M 397 316 C 380 333 371 357 370 389 C 370 426 382 460 405 492 C 416 507 428 518 441 527 C 447 500 451 473 452 444 C 454 399 448 358 433 322 C 420 319 408 317 397 316 Z',
      // right oblique
      'M 603 316 C 620 333 629 357 630 389 C 630 426 618 460 595 492 C 584 507 572 518 559 527 C 553 500 549 473 548 444 C 546 399 552 358 567 322 C 580 319 592 317 603 316 Z'
    ],
    quads: [
      // front left quad bundle
      'M 393 492 C 372 518 363 558 364 613 C 365 675 376 734 398 782 C 411 809 428 828 448 841 C 466 815 478 782 484 744 C 491 699 491 648 485 590 C 480 548 471 516 456 496 C 438 483 412 482 393 492 Z',
      'M 459 494 C 474 518 481 551 482 593 C 483 642 477 692 466 740 C 457 778 443 812 426 840 C 445 834 461 819 476 795 C 503 752 520 695 523 628 C 526 571 514 528 490 499 C 481 487 469 485 459 494 Z',
      // front right quad bundle
      'M 607 492 C 628 518 637 558 636 613 C 635 675 624 734 602 782 C 589 809 572 828 552 841 C 534 815 522 782 516 744 C 509 699 509 648 515 590 C 520 548 529 516 544 496 C 562 483 588 482 607 492 Z',
      'M 541 494 C 526 518 519 551 518 593 C 517 642 523 692 534 740 C 543 778 557 812 574 840 C 555 834 539 819 524 795 C 497 752 480 695 477 628 C 474 571 486 528 510 499 C 519 487 531 485 541 494 Z'
    ],
    calves: [
      // front left calf
      'M 406 732 C 393 759 389 795 392 836 C 396 882 409 924 428 957 C 440 977 453 986 464 983 C 475 980 481 968 484 947 C 489 908 490 869 484 829 C 478 788 467 754 452 733 C 440 719 417 718 406 732 Z',
      // front right calf
      'M 594 732 C 607 759 611 795 608 836 C 604 882 591 924 572 957 C 560 977 547 986 536 983 C 525 980 519 968 516 947 C 511 908 510 869 516 829 C 522 788 533 754 548 733 C 560 719 583 718 594 732 Z',
      // back left calf
      'M 972 730 C 959 757 955 792 958 833 C 962 880 975 922 994 954 C 1006 974 1019 983 1030 980 C 1041 977 1047 965 1050 944 C 1055 905 1056 866 1050 826 C 1044 786 1033 751 1018 730 C 1006 716 983 716 972 730 Z',
      // back right calf
      'M 1110 730 C 1123 757 1127 792 1124 833 C 1120 880 1107 922 1088 954 C 1076 974 1063 983 1052 980 C 1041 977 1035 965 1032 944 C 1027 905 1026 866 1032 826 C 1038 786 1049 751 1064 730 C 1076 716 1099 716 1110 730 Z'
    ],
    back: [
      // upper traps / spinal erectors central
      'M 994 144 C 980 170 974 202 976 242 C 978 281 988 313 1008 340 C 1021 358 1037 367 1054 367 C 1071 367 1087 358 1100 340 C 1120 313 1130 281 1132 242 C 1134 202 1128 170 1114 144 C 1095 159 1075 167 1054 167 C 1033 167 1013 159 994 144 Z',
      // left lat / mid back
      'M 905 230 C 887 253 878 286 878 330 C 878 377 888 421 908 463 C 923 495 943 520 968 539 C 988 502 1000 453 1004 390 C 1008 326 998 271 975 225 C 954 214 926 216 905 230 Z',
      // right lat / mid back
      'M 1203 230 C 1221 253 1230 286 1230 330 C 1230 377 1220 421 1200 463 C 1185 495 1165 520 1140 539 C 1120 502 1108 453 1104 390 C 1100 326 1110 271 1133 225 C 1154 214 1182 216 1203 230 Z'
    ],
    glutes: [
      'M 956 438 C 930 453 917 478 916 515 C 915 548 924 578 941 602 C 958 625 981 638 1008 639 C 1033 640 1051 630 1060 612 C 1068 595 1070 569 1066 535 C 1061 492 1047 460 1024 440 C 1005 428 975 427 956 438 Z',
      'M 1152 438 C 1178 453 1191 478 1192 515 C 1193 548 1184 578 1167 602 C 1150 625 1127 638 1100 639 C 1075 640 1057 630 1048 612 C 1040 595 1038 569 1042 535 C 1047 492 1061 460 1084 440 C 1103 428 1133 427 1152 438 Z'
    ],
    hamstrings: [
      'M 954 566 C 935 594 927 631 929 677 C 931 733 943 787 964 836 C 977 866 993 888 1011 901 C 1030 877 1043 847 1051 810 C 1060 769 1062 724 1058 675 C 1054 631 1045 595 1031 568 C 1013 553 972 552 954 566 Z',
      'M 1154 566 C 1173 594 1181 631 1179 677 C 1177 733 1165 787 1144 836 C 1131 866 1115 888 1097 901 C 1078 877 1065 847 1057 810 C 1048 769 1046 724 1050 675 C 1054 631 1063 595 1077 568 C 1095 553 1136 552 1154 566 Z'
    ]
  };

  function regionMarkup(muscle, entry) {
    const status = entry.status;
    const selected = muscle === selectedMuscle;
    const alpha = status.key === 'neutral' ? 0 : clamp(0.18 + entry.score * 0.40, 0.18, 0.62);
    const fill = status.key === 'neutral' ? 'rgba(0,0,0,0)' : rgba(status.color, alpha);
    const glow = status.key === 'neutral' ? 'transparent' : rgba(status.color, Math.min(0.34, alpha * 0.65));
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
    renderOverview(model);
    renderZones(model);
    renderSelector(model);
    renderDetail(model);
  }
  function bind() {
    document.getElementById('muscleMapZones')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-muscle]');
      if (!button) return;
      selectedMuscle = button.dataset.muscle;
      render();
    });
    document.getElementById('muscleMapZones')?.addEventListener('keydown', (event) => {
      const button = event.target.closest('[data-muscle]');
      if (!button) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectedMuscle = button.dataset.muscle;
      render();
    });
    document.getElementById('muscleRecoverySelector')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-select-muscle]');
      if (!button) return;
      selectedMuscle = button.dataset.selectMuscle;
      render();
    });
    window.addEventListener('macroflow:training-state-rendered', (event) => {
      latestState = event.detail || latestState;
      render();
    });
    window.addEventListener('macroflow:session-complete', () => window.setTimeout(render, 50));
    render();
    refreshTimer = window.setInterval(render, 15 * 60 * 1000);
    refreshTimer?.unref?.();
  }

  window.MacroFlowMuscleRecoveryV22 = {
    version: 'MacroFlow-Muscle-Recovery-v22.3',
    buildRecoveryModel,
    statusFor,
    muscleContributionsForSet,
    profileRecoveryMultiplier,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
