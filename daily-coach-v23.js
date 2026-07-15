(() => {
  'use strict';

  const STORAGE_KEY = 'macroflow.daily-coach.v23';
  const UPPER = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core']);
  const LOWER = new Set(['quads', 'glutes', 'hamstrings', 'calves']);
  const STATUS_COPY = {
    normal: { icon: '✅', eyebrow: 'Feu vert', label: 'Séance normale' },
    lighter: { icon: '🟠', eyebrow: 'Dose ajustée', label: 'Séance allégée' },
    swap: { icon: '↔️', eyebrow: 'Échange conseillé', label: 'Ordre de la semaine ajusté' },
    rest: { icon: '🌙', eyebrow: 'Récupération utile', label: 'Repos conseillé' },
    blocked: { icon: '🛑', eyebrow: 'Signal de sécurité', label: 'Pas de recommandation automatique' },
    completed: { icon: '🏁', eyebrow: 'Séance terminée', label: 'Travail du jour accompli' },
    active: { icon: '⏱️', eyebrow: 'Séance en cours', label: 'Reprendre la séance' },
    prompt: { icon: '🧭', eyebrow: 'Coach du jour', label: 'Bilan express requis' },
  };
  let latestState = { profile: null, program: null, activeSession: null, sessions: [], trainingReviews: [], dailyCoachDecisions: [] };
  let latestRecommendation = null;

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round = (value, digits = 0) => { const factor = 10 ** digits; return Math.round(Number(value || 0) * factor) / factor; };
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function localDayKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function localWeekKey(value = new Date()) {
    const engine = window.MacroFlowTrainingEngine;
    if (engine?.localWeekKey) return engine.localWeekKey(value);
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return localDayKey(date);
  }

  function hoursBetween(now, value) {
    return Math.max(0, (Number(now) - new Date(value).getTime()) / 3600000);
  }

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  function writeCheckIn(checkIn) {
    try {
      const store = readStore();
      store[checkIn.dateKey] = checkIn;
      const recent = Object.entries(store).sort(([a], [b]) => b.localeCompare(a)).slice(0, 35);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(recent)));
    } catch { /* Le coach reste utilisable même si le stockage privé est bloqué. */ }
  }

  function checkInFor(value = new Date()) { return readStore()[localDayKey(value)] || null; }

  function normalizeCheckIn(checkIn = {}) {
    return {
      energy: clamp(checkIn.energy || 3, 1, 5),
      sleep: clamp(checkIn.sleep || 3, 1, 5),
      motivation: clamp(checkIn.motivation || 3, 1, 5),
      soreness: clamp(checkIn.soreness || 1, 1, 5),
      sorenessArea: ['none', 'upper', 'lower', 'whole'].includes(checkIn.sorenessArea) ? checkIn.sorenessArea : 'none',
      pain: ['no', 'managed', 'unexplained'].includes(checkIn.pain) ? checkIn.pain : 'no',
    };
  }

  function effectiveWeekdays(state, now) {
    const engine = window.MacroFlowTrainingEngine;
    if (engine?.effectiveWeekdayMap) return engine.effectiveWeekdayMap(state.program, state.dailyCoachDecisions || [], new Date(now));
    return Object.fromEntries((state.program?.days || []).map((day) => [day.id, Number(day.weekday)]));
  }

  function contributionForExercise(exercise = {}) {
    const recovery = window.MacroFlowMuscleRecoveryV22;
    if (recovery?.muscleContributionsForSet) return recovery.muscleContributionsForSet({}, exercise);
    const result = {};
    const add = (muscle, share) => { if (muscle && muscle !== 'arms') result[muscle] = (result[muscle] || 0) + share; };
    if (exercise.muscle === 'arms') {
      const target = /biceps|curl|pull/i.test(exercise.pattern || exercise.name || '') ? 'biceps' : 'triceps';
      add(target, 1);
    } else add(exercise.muscle, 1);
    for (const muscle of exercise.secondary || []) add(muscle === 'arms' ? (/pull|row/i.test(exercise.pattern || '') ? 'biceps' : 'triceps') : muscle, .38);
    return result;
  }

  function dayDemand(day = {}) {
    const demand = {};
    for (const exercise of day.exercises || []) {
      for (const [muscle, share] of Object.entries(contributionForExercise(exercise))) {
        demand[muscle] = (demand[muscle] || 0) + Number(exercise.sets || 0) * Number(share || 0);
      }
    }
    return demand;
  }

  function recoveryModel(state, now) {
    const recovery = window.MacroFlowMuscleRecoveryV22;
    if (recovery?.buildRecoveryModel) return recovery.buildRecoveryModel(state, now);
    return Object.fromEntries([...UPPER, ...LOWER].map((muscle) => [muscle, { muscle, score: 0, hoursSince: null }]));
  }

  function areaShare(demand, area) {
    const total = Object.values(demand).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
    if (area === 'whole') return 1;
    if (area === 'none') return 0;
    const group = area === 'upper' ? UPPER : LOWER;
    return Object.entries(demand).reduce((sum, [muscle, value]) => sum + (group.has(muscle) ? Number(value || 0) : 0), 0) / total;
  }

  function programSessions(state) {
    return (state.sessions || []).filter((session) => session?.completedAt && (!session.programId || !state.program?.id || session.programId === state.program.id));
  }

  function dayTiming(state, now) {
    const date = new Date(now); const weekday = date.getDay(); const currentWeek = localWeekKey(date);
    const weekdays = effectiveWeekdays(state, now);
    const completedThisWeek = new Set(programSessions(state).filter((session) => localWeekKey(session.completedAt) === currentWeek).map((session) => session.dayId));
    return (state.program?.days || []).map((day) => {
      let daysAway = ((Number(weekdays[day.id] ?? day.weekday) - weekday) + 7) % 7;
      const target = new Date(date); target.setDate(target.getDate() + daysAway);
      if (completedThisWeek.has(day.id) && localWeekKey(target) === currentWeek) daysAway += 7;
      return { day, daysAway, effectiveWeekday: Number(weekdays[day.id] ?? day.weekday), completedThisWeek: completedThisWeek.has(day.id) };
    }).sort((a, b) => a.daysAway - b.daysAway || Number(a.day.order || 0) - Number(b.day.order || 0));
  }

  function scoreDay(day, timing, state, model, checkIn, now) {
    const demand = dayDemand(day);
    const total = Object.values(demand).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
    const overlap = Object.entries(demand).reduce((sum, [muscle, value]) => sum + (Number(model[muscle]?.score || 0) * Number(value || 0)), 0) / total;
    const maxFatigue = Math.max(0, ...Object.keys(demand).map((muscle) => Number(model[muscle]?.score || 0)));
    const sorenessMatch = areaShare(demand, checkIn.sorenessArea);
    const latestSameDay = programSessions(state).filter((session) => session.dayId === day.id).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0];
    const ageHours = latestSameDay ? hoursBetween(now, latestSameDay.completedAt) : null;
    const recencyPenalty = ageHours == null ? 0 : ageHours < 36 ? 38 : ageHours < 60 ? 22 : ageHours < 96 ? 9 : 0;
    const sorenessPenalty = ((checkIn.soreness - 1) / 4) * sorenessMatch * 34;
    const scheduleBase = 100 - Math.min(6, timing.daysAway) * 10;
    const score = scheduleBase - overlap * 48 - maxFatigue * 12 - sorenessPenalty - recencyPenalty - (timing.completedThisWeek && timing.daysAway < 7 ? 70 : 0);
    return { day, timing, demand, overlap, maxFatigue, sorenessMatch, ageHours, score: round(score, 1) };
  }

  function readinessScore(checkIn) {
    return round(checkIn.energy * .42 + checkIn.sleep * .36 + checkIn.motivation * .22, 1);
  }

  function buildDailyRecommendation(state = {}, rawCheckIn = null, value = Date.now()) {
    const now = value instanceof Date ? value.getTime() : Number(value);
    const date = new Date(now); const dateKey = localDayKey(date); const weekKey = localWeekKey(date);
    if (!state.profile || !state.program?.days?.length) return { status: 'unavailable', startable: false, dateKey, weekKey };
    if (state.activeSession) return { status: 'active', startable: false, dateKey, weekKey, day: state.program.days.find((day) => day.id === state.activeSession.dayId) || null };
    const sessionsToday = programSessions(state).filter((session) => localDayKey(session.completedAt) === dateKey);
    if (sessionsToday.length) return { status: 'completed', startable: false, dateKey, weekKey, day: state.program.days.find((day) => day.id === sessionsToday.at(-1).dayId) || null };
    const timings = dayTiming(state, now);
    const scheduled = timings[0];
    if (!rawCheckIn) return { status: 'prompt', startable: false, dateKey, weekKey, scheduledDay: scheduled?.day || null, scheduledDaysAway: scheduled?.daysAway ?? null };
    const checkIn = normalizeCheckIn(rawCheckIn);
    const readiness = readinessScore(checkIn);
    if (checkIn.pain === 'unexplained') {
      return { status: 'blocked', startable: false, dateKey, weekKey, checkIn, readiness, scheduledDay: scheduled?.day || null, day: null, title: 'Douleur inhabituelle : le coach s’arrête ici', summary: 'MacroFlow ne peut pas déterminer si modifier une séance est sécuritaire. Évite de laisser un score automatisé décider à ta place.', reasons: ['Une douleur nouvelle ou inexpliquée n’est pas un simple signal de fatigue.', 'Fais-la évaluer par un professionnel qualifié avant de reprendre ou d’adapter les mouvements concernés.'] };
    }
    if (!scheduled || scheduled.daysAway > 0) {
      return { status: 'rest', startable: false, dateKey, weekKey, checkIn, readiness, scheduledDay: scheduled?.day || null, scheduledDaysAway: scheduled?.daysAway ?? null, day: null, title: 'Aujourd’hui reste un jour de récupération', summary: scheduled ? `${scheduled.day.name} demeure prévue dans ${scheduled.daysAway} jour${scheduled.daysAway > 1 ? 's' : ''}.` : 'Aucune séance n’est prévue aujourd’hui.', reasons: ['Le moteur respecte l’alternance et les jours disponibles de ton programme au lieu d’ajouter une séance parce que tu te sens en forme.', 'Tu peux toujours choisir manuellement une séance dans le programme si ton horaire a réellement changé.'] };
    }
    if (checkIn.energy === 1 || (checkIn.energy <= 2 && checkIn.sleep <= 2) || (checkIn.soreness === 5 && checkIn.sorenessArea === 'whole')) {
      return { status: 'rest', startable: false, dateKey, weekKey, checkIn, readiness, scheduledDay: scheduled.day, scheduledDaysAway: 0, day: null, title: 'Repos conseillé pour aujourd’hui', summary: 'Plusieurs signaux globaux sont trop faibles pour justifier une adaptation locale de quelques séries.', reasons: [`Énergie ${checkIn.energy}/5 · sommeil ${checkIn.sleep}/5 · courbatures ${checkIn.soreness}/5.`, 'Une journée manquée ne supprime pas le plan : la prochaine recommandation repartira de la semaine réellement accomplie.'] };
    }

    const model = recoveryModel(state, now);
    const planned = scoreDay(scheduled.day, scheduled, state, model, checkIn, now);
    const alternatives = timings
      .filter((timing) => timing.day.id !== scheduled.day.id && timing.daysAway > 0 && timing.daysAway <= 3 && !timing.completedThisWeek)
      .map((timing) => scoreDay(timing.day, timing, state, model, checkIn, now))
      .sort((a, b) => b.score - a.score);
    const bestAlternative = alternatives[0];
    const swapJustified = Boolean(bestAlternative && bestAlternative.score >= planned.score + 12 && (planned.overlap >= .42 || planned.sorenessMatch >= .55));
    const chosen = swapJustified ? bestAlternative : planned;
    const sorenessRelevant = checkIn.soreness >= 4 && chosen.sorenessMatch >= .35;
    const lighter = readiness <= 3.2 || chosen.overlap >= .42 || sorenessRelevant || checkIn.pain === 'managed';
    const adjustment = lighter ? { mode: 'lighter', accessorySetReduction: 1, rirAdd: 1, suppressProgression: true } : { mode: 'normal', accessorySetReduction: 0, rirAdd: 0, suppressProgression: false };
    const status = swapJustified ? 'swap' : lighter ? 'lighter' : 'normal';
    const fatiguePercent = Math.round(chosen.overlap * 100);
    const reasons = [];
    if (swapJustified) reasons.push(`${scheduled.day.name} chevauche davantage les zones encore sollicitées; ${chosen.day.name} obtient un avantage clair dans le calcul du jour.`);
    else reasons.push(`${scheduled.day.name} reste le meilleur choix sans bouleverser inutilement l’ordre de la semaine.`);
    reasons.push(`Disponibilité déclarée : énergie ${checkIn.energy}/5, sommeil ${checkIn.sleep}/5, motivation ${checkIn.motivation}/5.`);
    reasons.push(`Chevauchement avec la sollicitation récente de cette séance : ${fatiguePercent}/100 (estimation, pas mesure biologique).`);
    if (lighter) reasons.push('Pour cette séance seulement : +1 RIR, une série de moins sur les accessoires de plus d’une série et aucune hausse de charge suggérée. Les mouvements principaux restent présents.');
    else reasons.push('Aucune réduction automatique : les séries, le RIR et les progressions prévues restent inchangés.');
    if (checkIn.pain === 'managed') reasons.push('Douleur déjà gérée déclarée : respecte strictement les mouvements à éviter et les consignes reçues; MacroFlow ne les remplace pas.');
    return {
      status, mode: adjustment.mode, startable: true, dateKey, weekKey, checkIn, readiness,
      scheduledDay: scheduled.day, scheduledDaysAway: 0, day: chosen.day,
      swapSchedule: swapJustified, adjustment, score: chosen.score, overlap: chosen.overlap,
      title: swapJustified ? `${chosen.day.name} est un meilleur choix aujourd’hui` : lighter ? `${chosen.day.name}, en version allégée` : `${chosen.day.name}, comme prévu`,
      summary: swapJustified ? `MacroFlow échange temporairement ${scheduled.day.name} et ${chosen.day.name} dans cette semaine seulement.` : lighter ? 'Le contenu utile reste là, mais la dose baisse légèrement pour refléter ton état du jour.' : 'Tes signaux sont compatibles avec la séance planifiée et sa progression habituelle.',
      reasons,
    };
  }

  function statusCopy(recommendation) { return STATUS_COPY[recommendation?.status] || STATUS_COPY.prompt; }

  function openWorkoutPanel(panel = 'session') {
    document.querySelector('[data-tab="workout"]')?.click();
    document.querySelector(`[data-training-tab="${panel}"]`)?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderHomeCard(recommendation) {
    const card = $('todayTrainingCard'); const button = $('todayTrainingActionBtn');
    if (!card || !button || !latestState.profile || !latestState.program) return;
    card.classList.remove('hidden');
    if (recommendation.status === 'active') return;
    const copy = statusCopy(recommendation);
    $('todayTrainingEyebrow').textContent = copy.eyebrow;
    $('todayTrainingIcon').textContent = copy.icon;
    if (recommendation.status === 'prompt') {
      $('todayTrainingTitle').textContent = 'Quelle séance est la meilleure aujourd’hui?';
      $('todayTrainingDescription').textContent = 'Un bilan de moins d’une minute relie ton sommeil, ton énergie, tes courbatures et la sollicitation de tes dernières séances.';
      $('todayTrainingMeta').innerHTML = '<span>6 réponses</span><span>Explication visible</span><span>Confirmation requise</span>';
      $('todayTrainingHint').textContent = 'Aucun changement silencieux.';
      button.textContent = 'Faire mon bilan express'; button.onclick = openModal;
      return;
    }
    $('todayTrainingTitle').textContent = recommendation.title || copy.label;
    $('todayTrainingDescription').textContent = recommendation.summary || '';
    const dayMeta = recommendation.day ? `<span>${escapeText(recommendation.day.name)}</span>` : '';
    const readiness = recommendation.readiness ? `<span>Disponibilité ${recommendation.readiness}/5</span>` : '';
    const fatigue = Number.isFinite(recommendation.overlap) ? `<span>Chevauchement ${Math.round(recommendation.overlap * 100)}/100</span>` : '';
    $('todayTrainingMeta').innerHTML = `${dayMeta}${readiness}${fatigue}`;
    $('todayTrainingHint').textContent = recommendation.startable ? 'À confirmer avant de commencer.' : 'Consulte l’explication complète.';
    button.textContent = recommendation.status === 'completed' ? 'Voir ma récupération' : recommendation.status === 'active' ? 'Reprendre' : 'Voir la recommandation';
    button.onclick = recommendation.status === 'completed' ? () => openWorkoutPanel('recovery') : recommendation.status === 'active' ? () => openWorkoutPanel('session') : openModal;
  }

  function renderProgramCard(recommendation) {
    const card = $('dailyCoachProgramCard'); const button = $('dailyCoachProgramBtn');
    if (!card || !button) return;
    card.classList.toggle('hidden', !latestState.profile || !latestState.program);
    if (!latestState.profile || !latestState.program) return;
    const copy = statusCopy(recommendation);
    $('dailyCoachProgramIcon').textContent = copy.icon;
    $('dailyCoachProgramEyebrow').textContent = copy.eyebrow;
    $('dailyCoachProgramTitle').textContent = recommendation.status === 'prompt' ? 'Décide avec tes données du jour' : recommendation.title || copy.label;
    $('dailyCoachProgramText').textContent = recommendation.status === 'prompt' ? 'Le plan donne la structure; ce court bilan choisit la bonne dose sans réécrire ton programme.' : recommendation.summary || '';
    $('dailyCoachProgramMeta').innerHTML = recommendation.status === 'prompt'
      ? '<span>Sommeil</span><span>Énergie</span><span>Courbatures</span><span>Douleur</span>'
      : `${recommendation.day ? `<span>${escapeText(recommendation.day.name)}</span>` : ''}${recommendation.readiness ? `<span>${recommendation.readiness}/5</span>` : ''}<span>${escapeText(copy.label)}</span>`;
    button.textContent = recommendation.status === 'completed' ? 'Voir la carte corporelle' : recommendation.status === 'active' ? 'Reprendre la séance' : recommendation.status === 'prompt' ? 'Faire le bilan (≈ 45 s)' : 'Voir et confirmer';
    button.onclick = recommendation.status === 'completed' ? () => openWorkoutPanel('recovery') : recommendation.status === 'active' ? () => openWorkoutPanel('session') : openModal;
  }

  function setForm(checkIn) {
    const values = normalizeCheckIn(checkIn || {});
    for (const [key, value] of Object.entries(values)) if ($(`dailyCoach${key[0].toUpperCase()}${key.slice(1)}`)) $(`dailyCoach${key[0].toUpperCase()}${key.slice(1)}`).value = String(value);
  }

  function formCheckIn() {
    return normalizeCheckIn({
      energy: $('dailyCoachEnergy')?.value, sleep: $('dailyCoachSleep')?.value, motivation: $('dailyCoachMotivation')?.value,
      soreness: $('dailyCoachSoreness')?.value, sorenessArea: $('dailyCoachSorenessArea')?.value, pain: $('dailyCoachPain')?.value,
    });
  }

  function renderModalResult(recommendation) {
    const result = $('dailyCoachResult'); if (!result) return;
    const copy = statusCopy(recommendation);
    result.className = `daily-coach-result status-${recommendation.status}`;
    result.innerHTML = `<div class="daily-coach-result-head"><span>${copy.icon}</span><div><small>${escapeText(copy.eyebrow)}</small><h3>${escapeText(recommendation.title || copy.label)}</h3></div></div><p>${escapeText(recommendation.summary || '')}</p><ul>${(recommendation.reasons || []).map((reason) => `<li>${escapeText(reason)}</li>`).join('')}</ul><div class="daily-coach-proof"><strong>Ce que le score ne sait pas</strong><span>Il estime une disponibilité à partir de tes déclarations et de tes séries. Il ne mesure ni la réparation du muscle, ni une blessure, ni ta technique du jour.</span></div>`;
    $('dailyCoachConfirmBtn').classList.toggle('hidden', !recommendation.startable);
    if (recommendation.startable) $('dailyCoachConfirmBtn').textContent = recommendation.mode === 'lighter' ? 'Confirmer et commencer la version allégée' : recommendation.swapSchedule ? 'Confirmer l’échange et commencer' : 'Confirmer et commencer';
    $('dailyCoachEditBtn').classList.remove('hidden');
    $('dailyCoachForm').classList.add('hidden'); result.classList.remove('hidden'); $('dailyCoachActions').classList.remove('hidden');
  }

  function openModal() {
    const modal = $('dailyCoachModal'); if (!modal) return;
    setForm(checkInFor());
    $('dailyCoachForm').classList.remove('hidden'); $('dailyCoachResult').classList.add('hidden'); $('dailyCoachActions').classList.add('hidden');
    modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
    if (latestRecommendation && latestRecommendation.status !== 'prompt' && latestRecommendation.status !== 'active') renderModalResult(latestRecommendation);
  }

  function closeModal() { $('dailyCoachModal')?.classList.add('hidden'); document.body.style.overflow = ''; }

  function analyzeFromForm() {
    const checkIn = { ...formCheckIn(), id: crypto.randomUUID?.() || `${Date.now()}`, createdAt: new Date().toISOString(), dateKey: localDayKey() };
    writeCheckIn(checkIn);
    latestRecommendation = buildDailyRecommendation(latestState, checkIn, Date.now());
    renderModalResult(latestRecommendation); renderHomeCard(latestRecommendation); renderProgramCard(latestRecommendation);
  }

  function confirmRecommendation() {
    const recommendation = latestRecommendation;
    if (!recommendation?.startable || !recommendation.day) return;
    window.dispatchEvent(new CustomEvent('macroflow:daily-coach-start', { detail: {
      dayId: recommendation.day.id,
      scheduledDayId: recommendation.scheduledDay?.id || recommendation.day.id,
      swapSchedule: recommendation.swapSchedule,
      adjustment: recommendation.adjustment,
      reasons: recommendation.reasons,
      dateKey: recommendation.dateKey,
      weekKey: recommendation.weekKey,
    } }));
    closeModal();
  }

  function render() {
    const checkIn = checkInFor();
    latestRecommendation = buildDailyRecommendation(latestState, checkIn, Date.now());
    renderHomeCard(latestRecommendation); renderProgramCard(latestRecommendation);
  }

  function bind() {
    $('dailyCoachCloseBtn')?.addEventListener('click', closeModal);
    $('dailyCoachAnalyzeBtn')?.addEventListener('click', analyzeFromForm);
    $('dailyCoachEditBtn')?.addEventListener('click', () => { $('dailyCoachForm').classList.remove('hidden'); $('dailyCoachResult').classList.add('hidden'); $('dailyCoachActions').classList.add('hidden'); });
    $('dailyCoachConfirmBtn')?.addEventListener('click', confirmRecommendation);
    $('dailyCoachModal')?.addEventListener('click', (event) => { if (event.target === $('dailyCoachModal')) closeModal(); });
    window.addEventListener('macroflow:training-state-rendered', (event) => { latestState = event.detail || latestState; render(); });
    window.addEventListener('macroflow:session-complete', () => window.setTimeout(render, 80));
    render();
  }

  window.MacroFlowDailyCoachV23 = Object.freeze({
    version: 'MacroFlow-Daily-Coach-v23', buildDailyRecommendation, normalizeCheckIn, dayDemand, scoreDay, readinessScore, localDayKey, localWeekKey,
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
