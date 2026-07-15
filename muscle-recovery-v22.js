(() => {
  const LABELS = {
    chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
    core: 'Abdominaux et tronc', quads: 'Quadriceps', glutes: 'Fessiers', hamstrings: 'Ischio-jambiers', calves: 'Mollets',
  };
  const MUSCLES = Object.keys(LABELS);
  const PUSH_PATTERNS = new Set(['horizontalPush', 'verticalPush', 'triceps']);
  const PULL_PATTERNS = new Set(['horizontalPull', 'verticalPull', 'biceps']);
  const ZONES = [
    zone('chest', 24.5, 19.8, 12.7, 9.2, 'torso'),
    zone('shoulders', 21.1, 19.0, 5.6, 9.5), zone('shoulders', 35.7, 19.0, 5.6, 9.5),
    zone('biceps', 19.1, 27.2, 4.8, 13.0, 'long'), zone('biceps', 39.0, 27.2, 4.8, 13.0, 'long'),
    zone('core', 27.4, 29.2, 7.7, 16.5, 'torso'),
    zone('quads', 23.6, 52.0, 6.6, 19.0, 'long'), zone('quads', 32.1, 52.0, 6.6, 19.0, 'long'),
    zone('calves', 23.7, 72.3, 5.2, 17.3, 'long'), zone('calves', 33.5, 72.3, 5.2, 17.3, 'long'),
    zone('back', 60.6, 19.0, 15.2, 24.3, 'torso'), zone('back', 63.4, 39.1, 9.5, 10.7, 'torso'),
    zone('shoulders', 57.4, 19.1, 5.8, 9.8), zone('shoulders', 74.0, 19.1, 5.8, 9.8),
    zone('triceps', 54.5, 27.0, 4.7, 14.1, 'long'), zone('triceps', 79.0, 27.0, 4.7, 14.1, 'long'),
    zone('glutes', 61.0, 47.1, 14.2, 14.7, 'torso'),
    zone('hamstrings', 59.5, 59.4, 6.8, 16.8, 'long'), zone('hamstrings', 69.9, 59.4, 6.8, 16.8, 'long'),
    zone('calves', 59.7, 74.0, 5.7, 16.2, 'long'), zone('calves', 71.0, 74.0, 5.7, 16.2, 'long'),
  ];
  let latestState = { profile: {}, program: null, sessions: [], trainingReviews: [] };
  let selectedMuscle = 'chest';
  let refreshTimer = null;

  function zone(muscle, left, top, width, height, shape = '') { return { muscle, left, top, width, height, shape }; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function hoursBetween(now, value) { return Math.max(0, (now - new Date(value).getTime()) / 3600000); }
  function round(value, digits = 1) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
  function escapeText(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

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

  function renderZones(model) {
    const container = document.getElementById('muscleMapZones');
    if (!container) return;
    container.innerHTML = ZONES.map((item, index) => {
      const entry = model[item.muscle]; const status = entry.status;
      const alpha = status.key === 'neutral' ? .08 : clamp(.23 + entry.score * .48, .23, .72);
      const selected = item.muscle === selectedMuscle ? ' selected' : '';
      const shape = item.shape ? ` data-shape="${item.shape}"` : '';
      const label = `${entry.label} : sollicitation ${status.label.toLowerCase()}`;
      return `<button type="button" class="muscle-zone${selected}" data-muscle="${item.muscle}"${shape} aria-label="${escapeText(label)}" aria-pressed="${item.muscle === selectedMuscle}" style="left:${item.left}%;top:${item.top}%;width:${item.width}%;height:${item.height}%;--zone-color:${status.color};--zone-alpha:${alpha}" data-zone-index="${index}"></button>`;
    }).join('');
  }

  function renderDetail(model) {
    const container = document.getElementById('muscleRecoveryDetail');
    if (!container) return;
    const entry = model[selectedMuscle] || model.chest; const status = entry.status;
    const note = !entry.lastWorkedAt
      ? 'Aucune série récente n’est attribuée à cette zone. Commence une séance et enregistre tes séries pour activer l’estimation.'
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
    if (!highest) container.innerHTML = '<div><strong>La carte attend ta première séance</strong><small>Enregistre tes séries et ton RIR : les zones se coloreront automatiquement.</small></div><span>0 zone active</span>';
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

  window.MacroFlowMuscleRecoveryV22 = { version: 'MacroFlow-Muscle-Recovery-v22', buildRecoveryModel, statusFor, muscleContributionsForSet, profileRecoveryMultiplier, zoneDefinitions: ZONES.map((item) => ({ ...item })) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
