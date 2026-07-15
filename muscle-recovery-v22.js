(() => {
  const LABELS = {
    chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
    core: 'Abdominaux et tronc', quads: 'Quadriceps', glutes: 'Fessiers', hamstrings: 'Ischio-jambiers', calves: 'Mollets',
  };
  const MUSCLES = Object.keys(LABELS);
  const PUSH_PATTERNS = new Set(['horizontalPush', 'verticalPush', 'triceps']);
  const PULL_PATTERNS = new Set(['horizontalPull', 'verticalPull', 'biceps']);
  const FRONT_MUSCLES = ['shoulders', 'chest', 'biceps', 'core', 'quads', 'calves'];
  const BACK_MUSCLES = ['shoulders', 'back', 'triceps', 'glutes', 'hamstrings', 'calves'];
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
  function mixHex(baseHex, accentHex, amount = .5) {
    const base = hexToRgb(baseHex); const accent = hexToRgb(accentHex);
    const mix = (a, b) => Math.round(a + (b - a) * amount);
    return `rgb(${mix(base.r, accent.r)}, ${mix(base.g, accent.g)}, ${mix(base.b, accent.b)})`;
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
    profile = profile || {};
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

  const FRONT_SILHOUETTE = [
    '<circle class="figure-head" cx="120" cy="39" r="22" />',
    '<path class="figure-body" d="M104 61 C98 67 95 76 93 87 L84 103 L76 140 L71 189 L67 242 L69 296 L77 355 L85 420 L92 492 L107 492 L111 435 L114 382 L120 334 L126 382 L129 435 L133 492 L148 492 L155 420 L163 355 L171 296 L173 242 L169 189 L164 140 L156 103 L147 87 C145 76 142 67 136 61 Z"/>',
    '<path class="figure-arm" d="M82 99 C61 115 52 141 48 182 C45 210 46 241 52 268 C56 288 60 297 70 293 C76 290 77 282 75 267 C69 226 71 181 86 142 C92 125 95 111 92 104 Z"/>',
    '<path class="figure-arm" d="M158 99 C179 115 188 141 192 182 C195 210 194 241 188 268 C184 288 180 297 170 293 C164 290 163 282 165 267 C171 226 169 181 154 142 C148 125 145 111 148 104 Z"/>',
    '<path class="figure-leg" d="M94 492 C89 511 82 531 77 549 C73 562 75 578 87 582 C99 586 107 577 109 564 L117 492 Z"/>',
    '<path class="figure-leg" d="M146 492 C151 511 158 531 163 549 C167 562 165 578 153 582 C141 586 133 577 131 564 L123 492 Z"/>'
  ].join('');
  const BACK_SILHOUETTE = [
    '<circle class="figure-head" cx="120" cy="39" r="22" />',
    '<path class="figure-body" d="M104 61 C97 68 95 80 95 92 L84 110 L76 149 L71 198 L68 246 L70 299 L77 359 L84 420 L91 492 L106 492 L111 437 L116 383 L120 336 L124 383 L129 437 L134 492 L149 492 L156 420 L163 359 L170 299 L172 246 L169 198 L164 149 L156 110 L145 92 C145 80 143 68 136 61 Z"/>',
    '<path class="figure-arm" d="M83 104 C61 120 51 149 48 188 C45 218 47 247 53 275 C57 294 62 302 71 298 C78 294 78 286 76 270 C70 229 72 183 87 145 C93 128 96 113 92 107 Z"/>',
    '<path class="figure-arm" d="M157 104 C179 120 189 149 192 188 C195 218 193 247 187 275 C183 294 178 302 169 298 C162 294 162 286 164 270 C170 229 168 183 153 145 C147 128 144 113 148 107 Z"/>',
    '<path class="figure-leg" d="M94 492 C89 511 82 531 77 549 C73 562 75 578 87 582 C99 586 107 577 109 564 L117 492 Z"/>',
    '<path class="figure-leg" d="M146 492 C151 511 158 531 163 549 C167 562 165 578 153 582 C141 586 133 577 131 564 L123 492 Z"/>'
  ].join('');

  const FIGURE_REGIONS = {
    front: {
      shoulders: [
        '<ellipse cx="80" cy="98" rx="28" ry="24" transform="rotate(-18 80 98)"/>',
        '<ellipse cx="160" cy="98" rx="28" ry="24" transform="rotate(18 160 98)"/>'
      ],
      chest: [
        '<path d="M94 104 C92 126 98 143 114 155 C118 146 118 118 116 102 C109 100 101 101 94 104 Z"/>',
        '<path d="M146 104 C148 126 142 143 126 155 C122 146 122 118 124 102 C131 100 139 101 146 104 Z"/>'
      ],
      biceps: [
        '<ellipse cx="63" cy="160" rx="17" ry="36" transform="rotate(8 63 160)"/>',
        '<ellipse cx="177" cy="160" rx="17" ry="36" transform="rotate(-8 177 160)"/>'
      ],
      core: [
        '<path d="M110 165 C100 177 98 193 100 211 C102 237 108 263 120 280 C132 263 138 237 140 211 C142 193 140 177 130 165 Z"/>',
        '<path d="M92 180 C82 193 79 214 82 236 C84 252 90 267 97 276 C100 251 102 224 104 191 C101 184 97 181 92 180 Z"/>',
        '<path d="M148 180 C158 193 161 214 158 236 C156 252 150 267 143 276 C140 251 138 224 136 191 C139 184 143 181 148 180 Z"/>'
      ],
      quads: [
        '<path d="M93 286 C81 301 76 327 79 363 C82 400 88 434 100 460 C109 428 114 398 116 356 C117 326 110 301 93 286 Z"/>',
        '<path d="M147 286 C159 301 164 327 161 363 C158 400 152 434 140 460 C131 428 126 398 124 356 C123 326 130 301 147 286 Z"/>'
      ],
      calves: [
        '<path d="M98 463 C86 476 79 500 83 528 C86 548 92 563 100 575 C107 553 111 531 112 508 C113 488 108 473 98 463 Z"/>',
        '<path d="M142 463 C154 476 161 500 157 528 C154 548 148 563 140 575 C133 553 129 531 128 508 C127 488 132 473 142 463 Z"/>'
      ]
    },
    back: {
      shoulders: [
        '<ellipse cx="80" cy="98" rx="28" ry="24" transform="rotate(-18 80 98)"/>',
        '<ellipse cx="160" cy="98" rx="28" ry="24" transform="rotate(18 160 98)"/>'
      ],
      back: [
        '<path d="M120 84 C103 98 95 117 93 144 C91 173 97 198 110 226 L120 244 L130 226 C143 198 149 173 147 144 C145 117 137 98 120 84 Z"/>',
        '<path d="M90 138 C74 155 66 183 66 219 C66 245 73 267 86 285 C96 257 102 227 104 196 C105 175 100 154 90 138 Z"/>',
        '<path d="M150 138 C166 155 174 183 174 219 C174 245 167 267 154 285 C144 257 138 227 136 196 C135 175 140 154 150 138 Z"/>'
      ],
      triceps: [
        '<ellipse cx="64" cy="165" rx="16" ry="38" transform="rotate(8 64 165)"/>',
        '<ellipse cx="176" cy="165" rx="16" ry="38" transform="rotate(-8 176 165)"/>'
      ],
      glutes: [
        '<ellipse cx="103" cy="301" rx="25" ry="27" transform="rotate(-10 103 301)"/>',
        '<ellipse cx="137" cy="301" rx="25" ry="27" transform="rotate(10 137 301)"/>'
      ],
      hamstrings: [
        '<path d="M95 327 C84 343 79 369 81 404 C83 431 89 454 100 477 C109 448 114 421 115 387 C116 361 109 342 95 327 Z"/>',
        '<path d="M145 327 C156 343 161 369 159 404 C157 431 151 454 140 477 C131 448 126 421 125 387 C124 361 131 342 145 327 Z"/>'
      ],
      calves: [
        '<path d="M98 463 C87 478 80 502 84 530 C87 549 93 564 101 575 C108 553 112 532 112 510 C112 491 108 475 98 463 Z"/>',
        '<path d="M142 463 C153 478 160 502 156 530 C153 549 147 564 139 575 C132 553 128 532 128 510 C128 491 132 475 142 463 Z"/>'
      ]
    }
  };

  function muscleGroupMarkup(muscle, shapes, entry) {
    const status = entry.status;
    const selected = muscle === selectedMuscle;
    const intensity = status.key === 'neutral' ? .12 : clamp(.24 + entry.score * .58, .24, .86);
    const fill = mixHex('#4e4b55', status.color, intensity);
    const stroke = selected ? '#ffffff' : mixHex('#2f2c34', status.color, Math.min(.48, intensity * .72));
    const glow = rgba(status.color, status.key === 'neutral' ? 0 : Math.min(.28, entry.score * .32));
    return `<g class="muscle-region${selected ? ' selected' : ''}" data-muscle="${muscle}" tabindex="0" role="button" aria-label="${escapeText(`${entry.label} : sollicitation ${status.label.toLowerCase()}`)}" aria-pressed="${muscle === selectedMuscle}" style="--muscle-fill:${fill};--muscle-stroke:${stroke};--muscle-glow:${glow}">${shapes.map((shape) => shape.replace(/\/>$/, ' class="muscle-part"/>')).join('')}</g>`;
  }

  function figureMarkup(view, model) {
    const silhouette = view === 'front' ? FRONT_SILHOUETTE : BACK_SILHOUETTE;
    const order = view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;
    return `
      <div class="muscle-figure-wrap muscle-figure-${view}">
        <svg class="muscle-figure-svg" viewBox="0 0 240 590" aria-hidden="true" focusable="false">
          <defs>
            <filter id="recoveryGlow-${view}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4.2" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g class="figure-silhouette">${silhouette}</g>
          <g class="figure-muscles">${order.map((muscle) => muscleGroupMarkup(muscle, FIGURE_REGIONS[view][muscle], model[muscle])).join('')}</g>
        </svg>
      </div>`;
  }

  function renderZones(model) {
    const container = document.getElementById('muscleMapZones');
    if (!container) return;
    container.innerHTML = `${figureMarkup('front', model)}${figureMarkup('back', model)}`;
  }

  function renderDetail(model) {
    const container = document.getElementById('muscleRecoveryDetail');
    if (!container) return;
    const entry = model[selectedMuscle] || model.chest; const status = entry.status;
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
    if (!highest) container.innerHTML = '<div><strong>La carte attend ta première séance</strong><small>Enregistre tes séries et ton RIR : les muscles se coloreront automatiquement.</small></div><span>0 zone active</span>';
    else {
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
      event.preventDefault();
      selectedMuscle = button.dataset.muscle; render();
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

  window.MacroFlowMuscleRecoveryV22 = { version: 'MacroFlow-Muscle-Recovery-v22.1', buildRecoveryModel, statusFor, muscleContributionsForSet, profileRecoveryMultiplier, frontMuscles: FRONT_MUSCLES, backMuscles: BACK_MUSCLES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
