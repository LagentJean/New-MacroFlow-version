(() => {
  'use strict';

  const VERSION = 'MacroFlow-Progress-v19';
  const MAX_ANALYZED_SESSIONS = 5000;
  const MAX_SUPPORTING_ROWS = 5000;
  const DATABASES = {
    general: { name: 'macroflow-local', version: 1, store: 'app-state', key: 'main' },
    training: { name: 'macroflow-training', version: 1, store: 'training-state', key: 'main' },
  };
  const MUSCLES = {
    chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', arms: 'Bras', quads: 'Quadriceps',
    glutes: 'Fessiers', hamstrings: 'Ischios', calves: 'Mollets', core: 'Tronc',
  };
  const ui = { periodWeeks: 8, exerciseId: null, panel: 'summary', model: null, renderToken: 0, refreshTimer: null };
  let progressUnits = 'metric';
  const KG_TO_LB = 2.2046226218;
  const displayedLoad = (kg) => progressUnits === 'imperial' ? Number(kg) * KG_TO_LB : Number(kg);
  const loadUnit = () => progressUnits === 'imperial' ? 'lb' : 'kg';
  const formatLoad = (kg, digits = 1) => `${round(displayedLoad(kg), digits)} ${loadUnit()}`;

  const $ = (id) => document.getElementById(id);
  const round = (value, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  };
  const finite = (value) => Number.isFinite(Number(value));
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const normalizeName = (value) => String(value || '').trim().toLocaleLowerCase('fr-CA');

  function asDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function localDateKey(value) {
    const date = asDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function startOfWeek(value) {
    const date = asDate(value) || new Date();
    date.setHours(0, 0, 0, 0);
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    return date;
  }

  function shortDate(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' }).format(date) : '—';
  }

  function fullDate(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : '—';
  }

  function weekBins(periodWeeks, now = new Date()) {
    const currentStart = startOfWeek(now);
    const bins = [];
    for (let index = periodWeeks - 1; index >= 0; index -= 1) {
      const start = new Date(currentStart);
      start.setDate(start.getDate() - index * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      bins.push({
        key: localDateKey(start), start, end, label: shortDate(start), planned: 0, completed: 0,
        sessions: 0, weightValues: [], adjustmentDelta: 0, adjustmentCount: 0,
      });
    }
    return bins;
  }

  function openDatabase(config) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(config.name, config.version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(config.store)) request.result.createObjectStore(config.store);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Stockage ${config.name} indisponible`));
    });
  }

  async function readEntry(config) {
    const database = await openDatabase(config);
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction(config.store, 'readonly').objectStore(config.store).get(config.key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  async function loadSnapshot() {
    const [general, training] = await Promise.all([
      readEntry(DATABASES.general).catch(() => null),
      readEntry(DATABASES.training).catch(() => null),
    ]);
    return { general: general || {}, training: training || {} };
  }

  function completedSessions(training) {
    const all = Array.isArray(training?.sessions) ? training.sessions : [];
    const completed = all.filter((session) => asDate(session?.completedAt));
    const truncatedCount = Math.max(0, completed.length - MAX_ANALYZED_SESSIONS);
    return {
      sessions: completed.sort((a, b) => asDate(a.completedAt) - asDate(b.completedAt)).slice(-MAX_ANALYZED_SESSIONS),
      truncatedCount,
    };
  }

  function exerciseMetadata(training) {
    const byId = new Map();
    const byName = new Map();
    for (const day of training?.program?.days || []) {
      for (const exercise of day.exercises || []) {
        const metadata = {
          id: exercise.id,
          name: exercise.name,
          muscle: exercise.muscle,
          secondary: Array.isArray(exercise.secondary) ? exercise.secondary : [],
        };
        if (metadata.id) byId.set(metadata.id, metadata);
        if (metadata.name) byName.set(normalizeName(metadata.name), metadata);
      }
    }
    return { byId, byName };
  }

  function setIdentity(set, fallbackIndex = 0) {
    const name = set?.exerciseName || set?.exercise || `Exercice ${fallbackIndex + 1}`;
    return { id: String(set?.exerciseId || `legacy:${normalizeName(name)}`), name };
  }

  function sessionGroups(session) {
    const groups = new Map();
    for (const [index, set] of (session?.sets || []).entries()) {
      const identity = setIdentity(set, index);
      if (!groups.has(identity.id)) groups.set(identity.id, { ...identity, sets: [] });
      groups.get(identity.id).sets.push(set);
    }
    return groups;
  }

  function e1rmForSet(set) {
    const weight = Number(set?.weight);
    const reps = Number(set?.reps);
    return weight > 0 && reps >= 1 && reps <= 15 ? weight * (1 + reps / 30) : null;
  }

  function buildExerciseSeries(sessions, cutoff) {
    const exercises = new Map();
    for (const session of sessions) {
      const date = asDate(session.completedAt);
      for (const group of sessionGroups(session).values()) {
        if (!exercises.has(group.id)) exercises.set(group.id, { id: group.id, name: group.name, exposures: [], lastAt: date });
        const entry = exercises.get(group.id);
        entry.name = group.name || entry.name;
        entry.lastAt = date > entry.lastAt ? date : entry.lastAt;
        const weighted = group.sets.map((set) => ({ set, value: e1rmForSet(set) })).filter((item) => item.value != null).sort((a, b) => b.value - a.value)[0];
        const bestRepSet = [...group.sets].filter((set) => finite(set.reps)).sort((a, b) => Number(b.reps) - Number(a.reps))[0];
        entry.exposures.push({
          date,
          e1rm: weighted ? round(weighted.value, 1) : null,
          reps: bestRepSet ? Number(bestRepSet.reps) : null,
          detail: weighted
            ? `${formatLoad(weighted.set.weight, 1)} × ${weighted.set.reps}${finite(weighted.set.rir) ? ` · ${weighted.set.rir} RIR` : ''}`
            : bestRepSet ? `${bestRepSet.reps} répétitions${finite(bestRepSet.rir) ? ` · ${bestRepSet.rir} RIR` : ''}` : '',
        });
      }
    }
    return [...exercises.values()].map((exercise) => {
      const metric = exercise.exposures.some((point) => point.e1rm != null) ? 'e1rm' : 'reps';
      const points = exercise.exposures
        .filter((point) => point.date >= cutoff && (metric === 'e1rm' ? point.e1rm != null : point.reps != null))
        .map((point) => ({ ...point, value: metric === 'e1rm' ? point.e1rm : point.reps }));
      const current = points.at(-1)?.value ?? null;
      const best = points.length ? Math.max(...points.map((point) => point.value)) : null;
      const first = points[0]?.value ?? null;
      const changePercent = first > 0 && current != null ? ((current - first) / first) * 100 : null;
      return { ...exercise, metric, points, current, best, changePercent };
    }).sort((a, b) => b.lastAt - a.lastAt || a.name.localeCompare(b.name, 'fr-CA'));
  }

  function prescribedSetsForSession(session, training, metadata) {
    if (finite(session?.summary?.prescribedSets) && Number(session.summary.prescribedSets) > 0) return Number(session.summary.prescribedSets);
    const day = (training?.program?.days || []).find((item) => item.id === session.dayId);
    if (day) return (day.exercises || []).reduce((sum, exercise) => sum + Math.max(0, Number(exercise.sets) || 0), 0);
    let total = 0;
    for (const group of sessionGroups(session).values()) {
      const current = metadata.byId.get(group.id) || metadata.byName.get(normalizeName(group.name));
      total += Math.max(group.sets.length, Number(current?.sets) || 0);
    }
    return total || (session.sets || []).length;
  }

  function assignToWeek(bins, value) {
    const date = asDate(value);
    return date ? bins.find((bin) => date >= bin.start && date < bin.end) : null;
  }

  function buildAdherence(sessions, training, bins, metadata) {
    for (const session of sessions) {
      const bin = assignToWeek(bins, session.completedAt);
      if (!bin) continue;
      bin.sessions += 1;
      bin.completed += (session.sets || []).length;
      bin.planned += prescribedSetsForSession(session, training, metadata);
    }
    const planned = bins.reduce((sum, bin) => sum + bin.planned, 0);
    const completed = bins.reduce((sum, bin) => sum + bin.completed, 0);
    return {
      weeks: bins,
      planned,
      completed,
      rate: planned ? Math.round((completed / planned) * 100) : null,
      sessions: bins.reduce((sum, bin) => sum + bin.sessions, 0),
    };
  }

  function metadataForSet(set, metadata) {
    const identity = setIdentity(set);
    const current = metadata.byId.get(identity.id) || metadata.byName.get(normalizeName(identity.name));
    const muscle = set.exerciseMuscle || current?.muscle || null;
    const secondary = Array.isArray(set.exerciseSecondary) ? set.exerciseSecondary : (current?.secondary || []);
    return { muscle, secondary };
  }

  function buildMuscleVolume(sessions, cutoff, metadata) {
    const volumes = new Map();
    let unclassifiedSets = 0;
    const ensure = (muscle) => {
      if (!volumes.has(muscle)) volumes.set(muscle, { id: muscle, label: MUSCLES[muscle] || muscle, direct: 0, indirect: 0, total: 0 });
      return volumes.get(muscle);
    };
    for (const session of sessions) {
      if (asDate(session.completedAt) < cutoff) continue;
      for (const set of session.sets || []) {
        const info = metadataForSet(set, metadata);
        if (!info.muscle) { unclassifiedSets += 1; continue; }
        ensure(info.muscle).direct += 1;
        for (const secondary of info.secondary) ensure(secondary).indirect += 0.5;
      }
    }
    const rows = [...volumes.values()].map((row) => ({ ...row, total: row.direct + row.indirect })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'fr-CA'));
    return { rows, unclassifiedSets };
  }

  function buildTimeline(sessions, cutoff, training, metadata) {
    const records = new Map();
    const events = [];
    for (const session of sessions) {
      const date = asDate(session.completedAt);
      if (!date) continue;
      for (const group of sessionGroups(session).values()) {
        const best = Math.max(0, ...group.sets.map((set) => e1rmForSet(set) || 0));
        if (!best) continue;
        const previous = records.get(group.id) || 0;
        if (date >= cutoff && previous > 0 && best > previous * 1.005) {
          events.push({ type: 'record', date, title: `Record estimé · ${group.name}`, detail: `1RM estimé ${formatLoad(best, 1)}`, value: best });
        }
        if (best > previous) records.set(group.id, best);
      }
      if (date >= cutoff) {
        const planned = prescribedSetsForSession(session, training, metadata);
        const completed = (session.sets || []).length;
        const minutes = finite(session.durationSeconds) ? Math.round(Number(session.durationSeconds) / 60) : null;
        events.push({
          type: 'session', date, title: `${session.name || 'Séance'} terminée`,
          detail: `${completed}/${planned || completed} séries${minutes != null ? ` · ${minutes} min` : ''}`,
        });
      }
    }
    const recent = events.sort((a, b) => b.date - a.date || (a.type === 'record' ? -1 : 1)).slice(0, 14);
    return { events: recent, recordCount: events.filter((event) => event.type === 'record').length };
  }

  function buildCombined(bins, general) {
    const weighIns = (Array.isArray(general?.weighIns) ? general.weighIns : []).slice(-MAX_SUPPORTING_ROWS);
    const adjustments = (Array.isArray(general?.adjustments) ? general.adjustments : []).slice(-MAX_SUPPORTING_ROWS);
    for (const entry of weighIns) {
      const date = entry?.date ? asDate(`${entry.date}T12:00:00`) : null;
      const bin = assignToWeek(bins, date);
      if (bin && finite(entry.weightKg)) bin.weightValues.push(Number(entry.weightKg));
    }
    for (const adjustment of adjustments) {
      if (adjustment?.status !== 'applied') continue;
      const bin = assignToWeek(bins, adjustment.appliedAt || adjustment.createdAt);
      if (!bin) continue;
      const after = Number(adjustment.suggestedGoals?.calories);
      const before = Number(adjustment.baseCalories);
      if (Number.isFinite(after) && Number.isFinite(before)) bin.adjustmentDelta += after - before;
      bin.adjustmentCount += 1;
    }
    return bins.map((bin) => ({
      key: bin.key,
      label: bin.label,
      weightAverage: bin.weightValues.length ? round(bin.weightValues.reduce((sum, value) => sum + value, 0) / bin.weightValues.length, 1) : null,
      weightCount: bin.weightValues.length,
      sessions: bin.sessions,
      adherence: bin.planned ? Math.round((bin.completed / bin.planned) * 100) : null,
      adjustmentDelta: Math.round(bin.adjustmentDelta),
      adjustmentCount: bin.adjustmentCount,
    }));
  }

  function buildProgressModel(training = {}, general = {}, periodWeeks = 8, now = new Date()) {
    progressUnits = training?.profile?.units === 'imperial' ? 'imperial' : 'metric';
    const safeWeeks = [4, 8, 12].includes(Number(periodWeeks)) ? Number(periodWeeks) : 8;
    const bins = weekBins(safeWeeks, now);
    const cutoff = bins[0].start;
    const { sessions, truncatedCount } = completedSessions(training);
    const metadata = exerciseMetadata(training);
    const exerciseSeries = buildExerciseSeries(sessions, cutoff);
    const adherence = buildAdherence(sessions, training, bins, metadata);
    const muscleVolume = buildMuscleVolume(sessions, cutoff, metadata);
    const timeline = buildTimeline(sessions, cutoff, training, metadata);
    const combined = buildCombined(bins, general);
    return {
      version: VERSION,
      periodWeeks: safeWeeks,
      cutoff,
      exerciseSeries,
      adherence,
      muscleVolume,
      timeline,
      combined,
      truncatedCount,
      latestSession: sessions.filter((session) => asDate(session.completedAt) >= cutoff).at(-1) || null,
      hasTrainingData: adherence.sessions > 0,
    };
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function summarizeProgress(model) {
    const comparable = model.exerciseSeries.filter((exercise) => exercise.points.length >= 2 && Number.isFinite(exercise.changePercent));
    const improved = comparable.filter((exercise) => exercise.changePercent >= 2);
    const declined = comparable.filter((exercise) => exercise.changePercent <= -2);
    const stable = comparable.length - improved.length - declined.length;
    const medianChange = median(comparable.map((exercise) => exercise.changePercent));
    const rate = model.adherence.rate;
    const hasEnoughAdherenceData = model.adherence.planned >= 6;
    let summary;

    if (!model.hasTrainingData) {
      summary = {
        tone: 'new', label: 'Point de départ', title: 'Ta progression commencera avec ta première séance',
        text: 'MacroFlow a besoin de performances réellement enregistrées pour comparer le même exercice dans le temps.',
        actionTitle: 'Crée ta première référence',
        actionText: 'Termine une séance et note tes séries. Une seule séance établit un point de départ; elle ne prouve pas encore une tendance.',
        actionLabel: 'Ouvrir Training',
      };
    } else if (model.adherence.sessions < 2 || !comparable.length) {
      summary = {
        tone: 'learning', label: 'Données en construction', title: 'C’est encore trop tôt pour juger',
        text: 'Tu as commencé à créer ton historique, mais il faut répéter au moins un exercice pour obtenir une comparaison utile.',
        actionTitle: 'Répète les mouvements principaux',
        actionText: 'Garde la même technique et enregistre la prochaine séance. MacroFlow comparera seulement des exercices identiques.',
        actionLabel: 'Continuer le programme',
      };
    } else if (hasEnoughAdherenceData && rate != null && rate < 65) {
      summary = {
        tone: 'attention', label: 'Priorité à la régularité', title: 'Ton plan manque encore de répétitions comparables',
        text: 'Modifier le programme maintenant risquerait de confondre un manque de données avec un manque d’efficacité.',
        actionTitle: 'Simplifie avant d’ajouter',
        actionText: 'Essaie d’abord de terminer davantage des séries prévues. Si le temps ou la récupération bloque, ajuste la prochaine séance plutôt que de tout changer.',
        actionLabel: 'Voir la prochaine séance',
      };
    } else if (improved.length > declined.length && improved.length > 0) {
      summary = {
        tone: 'positive', label: 'Tendance positive', title: 'Tu progresses sur tes exercices comparables',
        text: `${improved.length} exercice${improved.length > 1 ? 's montrent' : ' montre'} une hausse claire sur la période choisie.`,
        actionTitle: 'Continue avec une petite progression',
        actionText: 'Garde le plan tant que la technique et la récupération restent bonnes. Cherche une petite hausse de charge, de répétitions ou de qualité, pas les trois à la fois.',
        actionLabel: 'Préparer la prochaine séance',
      };
    } else if (declined.length >= 2 && declined.length > improved.length) {
      summary = {
        tone: 'attention', label: 'À surveiller', title: 'Plusieurs références récentes sont en baisse',
        text: 'Ce signal mérite une vérification, mais il ne suffit pas à conclure que ton programme ne fonctionne pas.',
        actionTitle: 'Vérifie la récupération avant de changer',
        actionText: 'Observe le sommeil, la fatigue, la technique et l’effort prévu à la prochaine séance. Confirme la tendance sur plus d’une exposition.',
        actionLabel: 'Voir la prochaine séance',
      };
    } else {
      summary = {
        tone: 'steady', label: 'Tendance stable', title: 'Tes performances sont globalement stables',
        text: 'La période ne montre pas encore une hausse ou une baisse assez cohérente pour justifier un grand changement.',
        actionTitle: 'Construis une comparaison de plus',
        actionText: 'Répète les exercices principaux avec une exécution comparable. Une bonne décision demande plusieurs expositions, pas une seule séance.',
        actionLabel: 'Continuer le programme',
      };
    }

    return {
      ...summary,
      comparableCount: comparable.length,
      improvedCount: improved.length,
      stableCount: stable,
      declinedCount: declined.length,
      medianChange,
      performanceSignal: comparable.length
        ? `${improved.length} en hausse · ${stable} stable${stable === 1 ? '' : 's'} · ${declined.length} à surveiller`
        : 'Pas encore assez de répétitions du même exercice',
      adherenceSignal: rate == null
        ? 'Aucune série planifiée comparable pour cette période'
        : `${model.adherence.completed}/${model.adherence.planned} séries réalisées · ${rate} %`,
      evidenceSignal: comparable.length
        ? `${comparable.length} exercice${comparable.length > 1 ? 's' : ''} avec au moins deux références`
        : `${model.adherence.sessions} séance${model.adherence.sessions > 1 ? 's' : ''} enregistrée${model.adherence.sessions > 1 ? 's' : ''}`,
    };
  }

  function dashboardShell() {
    return `
      <section class="card v14-hero" aria-labelledby="v14DashboardTitle">
        <div class="v14-title-row"><div><span class="eyebrow">Ta progression</span><h2 id="v14DashboardTitle">Ce que tes données disent</h2></div><span id="v19Status" class="v19-status">Analyse locale</span></div>
        <div class="v19-verdict"><span id="v19VerdictLabel">Point de départ</span><h3 id="v19SummaryTitle">Analyse en cours…</h3><p id="v19SummaryText" class="v14-lead"></p></div>
        <div id="v19NextStep" class="v19-next-step"></div>
        <div id="v14HeroStats" class="v14-hero-stats"></div>
        <div class="v19-period-row"><span>Période analysée</span><div class="v14-periods" aria-label="Période analysée">
          <button type="button" data-v14-weeks="4">4 sem.</button><button type="button" data-v14-weeks="8" class="active">8 sem.</button><button type="button" data-v14-weeks="12">12 sem.</button>
        </div></div>
        <p id="v14DataNotice" class="v14-data-notice hidden"></p>
      </section>

      <nav class="v19-section-tabs" aria-label="Sections de progression">
        <button type="button" class="active" data-v19-section="summary" aria-selected="true">Résumé</button>
        <button type="button" data-v19-section="exercise" aria-selected="false">Exercices</button>
        <button type="button" data-v19-section="analysis" aria-selected="false">Analyses</button>
      </nav>

      <section class="v19-section-panel" data-v19-panel="summary">
        <section class="card v14-panel v19-signals" aria-labelledby="v19SignalsTitle">
          <div class="v14-panel-head"><div><span class="eyebrow">Les repères utiles</span><h2 id="v19SignalsTitle">Pourquoi MacroFlow te dit ça</h2></div></div>
          <div id="v19SignalList" class="v19-signal-list"></div>
          <p class="v14-note">Une tendance compare le même exercice dans le temps. Une séance isolée, un poids corporel ou une estimation de 1RM ne suffit jamais à prouver un progrès global.</p>
        </section>
      </section>

      <section class="v19-section-panel hidden" data-v19-panel="exercise">
      <section class="card v14-panel" aria-labelledby="v14ExerciseTitle">
        <div class="v14-panel-head"><div><span class="eyebrow">Performance comparable</span><h2 id="v14ExerciseTitle">Progression par exercice</h2></div><label class="v14-select-label">Exercice<select id="v14ExerciseSelect"></select></label></div>
        <div id="v14ExerciseStats" class="v14-metric-grid"></div>
        <div id="v14ExerciseChart" class="v14-chart"></div>
        <p id="v14ExerciseNote" class="v14-note"></p>
      </section>
      </section>

      <section class="v19-section-panel hidden" data-v19-panel="analysis">
      <details class="card v14-panel v19-analysis-block" open>
        <summary><div><span class="eyebrow">Régularité réelle</span><h2 id="v14AdherenceTitle">Séries prévues vs réalisées</h2></div><div id="v14AdherenceRate" class="v14-rate">—</div></summary>
        <div class="v19-analysis-content">
        <div id="v14AdherenceChart" class="v14-week-chart"></div>
        <div id="v14AdherenceStats" class="v14-metric-grid compact"></div>
        <p class="v14-note">L’adhérence compare les séries des séances commencées. Elle ne transforme pas automatiquement une semaine manquée en diagnostic.</p>
        </div>
      </details>

      <details class="card v14-panel v19-analysis-block">
        <summary><div><span class="eyebrow">Répartition du travail</span><h2 id="v14MuscleTitle">Volume par groupe musculaire</h2></div><span class="v19-summary-arrow">⌄</span></summary>
        <div class="v19-analysis-content"><div class="v14-legend"><span class="direct">Direct</span><span class="indirect">Indirect × 0,5</span></div>
        <div id="v14MuscleChart" class="v14-muscle-chart"></div>
        <p id="v14MuscleNote" class="v14-note">Une série indirecte compte ici comme 0,5 série. C’est un repère pratique, pas une mesure parfaite du stimulus.</p>
        </div>
      </details>

      <details class="card v14-panel v19-analysis-block">
        <summary><div><span class="eyebrow">Chronologie</span><h2 id="v14TimelineTitle">Séances et records estimés</h2></div><span id="v14RecordCount" class="v14-record-count">0 record</span></summary>
        <div class="v19-analysis-content">
        <div id="v14Timeline" class="v14-timeline"></div>
        <p class="v14-note">Les records utilisent une estimation d’Epley sur les séries de 15 répétitions ou moins. Ce ne sont jamais des tests maximaux.</p>
        </div>
      </details>

      <details class="card v14-panel v19-analysis-block">
        <summary><div><span class="eyebrow">Vue combinée</span><h2 id="v14CombinedTitle">Poids, Training et nutrition</h2></div><span class="v19-summary-arrow">⌄</span></summary>
        <div class="v19-analysis-content">
        <div class="v14-combined-head" aria-hidden="true"><span>Semaine</span><span>Poids moyen</span><span>Training</span><span>Nutrition</span></div>
        <div id="v14Combined" class="v14-combined"></div>
        <p class="v14-note">Ces données sont alignées dans le temps pour t’aider à observer. MacroFlow ne prétend pas qu’une variation est causée par une seule autre donnée.</p>
        </div>
      </details>
      </section>`;
  }

  function emptyState(title, text) {
    return `<div class="v14-empty"><span>↗</span><b>${escapeText(title)}</b><small>${escapeText(text)}</small></div>`;
  }

  function metric(value, label, detail = '') {
    return `<div><strong>${escapeText(value)}</strong><small>${escapeText(label)}</small>${detail ? `<em>${escapeText(detail)}</em>` : ''}</div>`;
  }

  function renderHero(model) {
    const summary = summarizeProgress(model);
    const rate = model.adherence.rate == null ? '—' : `${model.adherence.rate} %`;
    const status = $('v19Status');
    status.textContent = summary.label;
    status.className = `v19-status ${summary.tone}`;
    $('v19VerdictLabel').textContent = summary.label;
    $('v19SummaryTitle').textContent = summary.title;
    $('v19SummaryText').textContent = summary.text;
    $('v19NextStep').innerHTML = `<div><small>Prochaine étape</small><strong>${escapeText(summary.actionTitle)}</strong><p>${escapeText(summary.actionText)}</p></div><button type="button" data-v19-go-training>${escapeText(summary.actionLabel)} <span>›</span></button>`;
    $('v14HeroStats').innerHTML = [
      metric(model.adherence.sessions, 'séances', `sur ${model.periodWeeks} semaines`),
      metric(summary.comparableCount, 'exercices comparables', `${summary.improvedCount} en hausse`),
      metric(rate, 'séries réalisées', `${model.adherence.completed}/${model.adherence.planned || 0} prévues`),
    ].join('');
    $('v19SignalList').innerHTML = [
      ['↗', 'Performance', summary.performanceSignal],
      ['✓', 'Régularité', summary.adherenceSignal],
      ['◇', 'Fiabilité', summary.evidenceSignal],
    ].map(([icon, label, text]) => `<div><span>${icon}</span><p><b>${escapeText(label)}</b><small>${escapeText(text)}</small></p></div>`).join('');
    document.querySelectorAll('[data-v14-weeks]').forEach((button) => button.classList.toggle('active', Number(button.dataset.v14Weeks) === model.periodWeeks));
    const notice = $('v14DataNotice');
    if (model.truncatedCount > 0) {
      notice.textContent = `Historique exceptionnellement grand : l’analyse visuelle utilise les ${MAX_ANALYZED_SESSIONS.toLocaleString('fr-CA')} séances les plus récentes pour garder l’app rapide. ${model.truncatedCount.toLocaleString('fr-CA')} séances plus anciennes restent sauvegardées.`;
      notice.classList.remove('hidden');
    } else notice.classList.add('hidden');
  }

  function lineChart(series) {
    const allPoints = series.points;
    const points = allPoints.length <= 120 ? allPoints : Array.from({ length: 120 }, (_, index) => allPoints[Math.round(index * (allPoints.length - 1) / 119)]);
    if (!points.length) return emptyState('Aucune donnée dans cette période', 'Choisis une période plus longue ou enregistre une séance complète.');
    if (points.length === 1) return `<div class="v14-single-point"><span>Première référence</span><strong>${round(points[0].value, 1)}${series.metric === 'e1rm' ? ' kg estimés' : ' reps'}</strong><small>${escapeText(fullDate(points[0].date))} · ${escapeText(points[0].detail)}</small></div>`;
    const width = 620; const height = 220; const left = 46; const right = 18; const top = 18; const bottom = 36;
    const values = points.map((point) => point.value);
    let minimum = Math.min(...values); let maximum = Math.max(...values);
    const range = Math.max(series.metric === 'e1rm' ? 1 : 2, maximum - minimum);
    minimum = Math.max(0, minimum - range * 0.12); maximum += range * 0.12;
    const x = (index) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
    const y = (value) => top + (maximum - value) / Math.max(0.001, maximum - minimum) * (height - top - bottom);
    const coordinates = points.map((point, index) => `${round(x(index), 2)},${round(y(point.value), 2)}`);
    const area = `${left},${height - bottom} ${coordinates.join(' ')} ${width - right},${height - bottom}`;
    const yTicks = [maximum, (maximum + minimum) / 2, minimum];
    const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    return `<svg class="v14-line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution de ${escapeText(series.name)}">
      <title>Évolution de ${escapeText(series.name)}</title>
      <desc>${allPoints.length} meilleures performances de séance pendant la période choisie${allPoints.length > points.length ? `, représentées par ${points.length} points pour préserver la rapidité` : ''}.</desc>
      ${yTicks.map((tick) => `<line x1="${left}" y1="${y(tick)}" x2="${width - right}" y2="${y(tick)}" class="v14-grid-line"></line><text x="${left - 8}" y="${y(tick) + 4}" text-anchor="end" class="v14-axis-text">${round(tick, 1)}</text>`).join('')}
      <polygon points="${area}" class="v14-line-area"></polygon>
      <polyline points="${coordinates.join(' ')}" class="v14-line-path"></polyline>
      ${points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.value)}" r="5" class="v14-line-dot" tabindex="0"><title>${escapeText(fullDate(point.date))} · ${round(point.value, 1)}${series.metric === 'e1rm' ? ' kg estimés' : ' reps'} · ${escapeText(point.detail)}</title></circle>`).join('')}
      ${labelIndexes.map((index) => `<text x="${x(index)}" y="${height - 10}" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}" class="v14-axis-text">${escapeText(shortDate(points[index].date))}</text>`).join('')}
    </svg>`;
  }

  function renderExercise(model) {
    const select = $('v14ExerciseSelect');
    if (!model.exerciseSeries.length) {
      select.innerHTML = '<option>Aucun exercice</option>'; select.disabled = true;
      $('v14ExerciseStats').innerHTML = '';
      $('v14ExerciseChart').innerHTML = emptyState('Ta première courbe arrive bientôt', 'Termine une séance Training pour créer une référence par exercice.');
      $('v14ExerciseNote').textContent = 'Les performances restent locales et sont comparées seulement avec le même exercice.';
      return;
    }
    select.disabled = false;
    if (!ui.exerciseId || !model.exerciseSeries.some((exercise) => exercise.id === ui.exerciseId)) ui.exerciseId = model.exerciseSeries[0].id;
    select.innerHTML = model.exerciseSeries.map((exercise) => `<option value="${escapeText(exercise.id)}">${escapeText(exercise.name)}</option>`).join('');
    select.value = ui.exerciseId;
    const series = model.exerciseSeries.find((exercise) => exercise.id === ui.exerciseId) || model.exerciseSeries[0];
    const suffix = series.metric === 'e1rm' ? ` ${loadUnit()} est.` : ' reps';
    const change = series.changePercent == null ? '—' : `${series.changePercent >= 0 ? '+' : ''}${round(series.changePercent, 1)} %`;
    $('v14ExerciseStats').innerHTML = [
      metric(series.current == null ? '—' : `${round(series.current, 1)}${suffix}`, 'dernière référence'),
      metric(series.best == null ? '—' : `${round(series.best, 1)}${suffix}`, 'meilleure référence'),
      metric(change, 'variation sur la période'),
    ].join('');
    $('v14ExerciseChart').innerHTML = lineChart(series);
    const densityNote = series.points.length > 120 ? ` La courbe affiche 120 points répartis parmi ${series.points.length} références pour rester fluide.` : '';
    $('v14ExerciseNote').textContent = (series.metric === 'e1rm'
      ? 'Chaque point est le meilleur 1RM estimé de la séance pour cet exercice, calculé seulement avec 15 répétitions ou moins.'
      : 'Cet exercice sans charge externe est comparé par répétitions. Les anciennes séances ne distinguent pas toujours les variantes au poids du corps.') + densityNote;
  }

  function renderAdherence(model) {
    const weeks = model.adherence.weeks;
    const maximum = Math.max(1, ...weeks.flatMap((week) => [week.planned, week.completed]));
    $('v14AdherenceRate').textContent = model.adherence.rate == null ? '—' : `${model.adherence.rate} %`;
    $('v14AdherenceRate').classList.toggle('good', model.adherence.rate != null && model.adherence.rate >= 85);
    $('v14AdherenceChart').innerHTML = weeks.some((week) => week.planned || week.completed)
      ? `<div class="v14-week-bars" style="--v14-week-count:${weeks.length}">${weeks.map((week) => `<div class="v14-week-col" title="Semaine du ${escapeText(week.label)} : ${week.completed}/${week.planned} séries"><div class="v14-bars"><i class="planned" style="height:${Math.max(week.planned ? 3 : 0, week.planned / maximum * 118)}px"></i><i class="completed" style="height:${Math.max(week.completed ? 3 : 0, week.completed / maximum * 118)}px"></i></div><b>${week.completed}/${week.planned}</b><small>${escapeText(week.label)}</small></div>`).join('')}</div>`
      : emptyState('Aucune séance dans cette période', 'Tes prochaines séries prévues et réalisées apparaîtront semaine par semaine.');
    $('v14AdherenceStats').innerHTML = [
      metric(model.adherence.planned, 'séries prévues'),
      metric(model.adherence.completed, 'séries réalisées'),
      metric(model.adherence.sessions, 'séances enregistrées'),
    ].join('');
  }

  function renderMuscles(model) {
    const rows = model.muscleVolume.rows;
    if (!rows.length) {
      $('v14MuscleChart').innerHTML = emptyState('Aucun volume classable', 'Les nouvelles séries mémoriseront leur groupe musculaire pour garder cet historique fiable.');
    } else {
      const maximum = Math.max(...rows.map((row) => row.total), 1);
      $('v14MuscleChart').innerHTML = rows.map((row) => `<div class="v14-muscle-row"><div class="v14-muscle-label"><b>${escapeText(row.label)}</b><span>${round(row.total, 1)} séries</span></div><div class="v14-muscle-track" title="${round(row.direct, 1)} directes · ${round(row.indirect, 1)} indirectes"><i class="direct" style="width:${row.direct / maximum * 100}%"></i><i class="indirect" style="width:${row.indirect / maximum * 100}%"></i></div><small>${round(row.direct, 1)} directes · ${round(row.indirect, 1)} indirectes</small></div>`).join('');
    }
    const suffix = model.muscleVolume.unclassifiedSets
      ? ` ${model.muscleVolume.unclassifiedSets} ancienne${model.muscleVolume.unclassifiedSets > 1 ? 's' : ''} série${model.muscleVolume.unclassifiedSets > 1 ? 's' : ''} ne pouvait pas être classée sans inventer son muscle.`
      : '';
    $('v14MuscleNote').textContent = `Une série indirecte compte ici comme 0,5 série. C’est un repère pratique, pas une mesure parfaite du stimulus.${suffix}`;
  }

  function renderTimeline(model) {
    const events = model.timeline.events;
    $('v14RecordCount').textContent = `${model.timeline.recordCount} record${model.timeline.recordCount === 1 ? '' : 's'}`;
    $('v14Timeline').innerHTML = events.length ? events.map((event) => `<div class="v14-timeline-row ${event.type}"><span>${event.type === 'record' ? '🏆' : '✓'}</span><div><b>${escapeText(event.title)}</b><small>${escapeText(event.detail)}</small></div><time datetime="${escapeText(event.date.toISOString())}">${escapeText(shortDate(event.date))}</time></div>`).join('') : emptyState('La chronologie est vide', 'Termine une séance pour enregistrer sa durée, ses séries et ses futures progressions.');
  }

  function renderCombined(model) {
    const rows = model.combined;
    $('v14Combined').innerHTML = rows.map((week) => {
      const training = week.sessions ? `${week.sessions} séance${week.sessions > 1 ? 's' : ''}${week.adherence != null ? ` · ${week.adherence} %` : ''}` : '—';
      const nutrition = week.adjustmentCount ? `${week.adjustmentDelta > 0 ? '+' : ''}${week.adjustmentDelta} kcal` : 'Aucun changement';
      return `<div class="v14-combined-row"><b>${escapeText(week.label)}</b><span>${week.weightAverage == null ? '—' : `${week.weightAverage} kg`}<small>${week.weightCount ? `${week.weightCount} pesée${week.weightCount > 1 ? 's' : ''}` : 'aucune pesée'}</small></span><span>${escapeText(training)}</span><span class="${week.adjustmentCount ? 'changed' : ''}">${escapeText(nutrition)}</span></div>`;
    }).join('');
  }

  async function render() {
    const container = $('trainingProgressDashboard');
    if (!container) return;
    const token = ++ui.renderToken;
    container.setAttribute('aria-busy', 'true');
    try {
      const snapshot = await loadSnapshot();
      if (token !== ui.renderToken) return;
      const model = buildProgressModel(snapshot.training, snapshot.general, ui.periodWeeks, new Date());
      ui.model = model;
      renderHero(model);
      renderExercise(model);
      renderAdherence(model);
      renderMuscles(model);
      renderTimeline(model);
      renderCombined(model);
    } catch (error) {
      console.error('Tableau de progression indisponible.', error);
      container.innerHTML = `<section class="card v14-panel">${emptyState('Tableau momentanément indisponible', 'Tes données restent intactes. Ferme puis rouvre MacroFlow pour réessayer.')}</section>`;
    } finally {
      if (token === ui.renderToken) container.setAttribute('aria-busy', 'false');
    }
  }

  function scheduleRender(delay = 80) {
    clearTimeout(ui.refreshTimer);
    ui.refreshTimer = window.setTimeout(render, delay);
  }

  function showPanel(name) {
    const safeName = ['summary', 'exercise', 'analysis'].includes(name) ? name : 'summary';
    ui.panel = safeName;
    document.querySelectorAll('[data-v19-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.v19Panel !== safeName));
    document.querySelectorAll('[data-v19-section]').forEach((button) => {
      const active = button.dataset.v19Section === safeName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function bind() {
    const container = $('trainingProgressDashboard');
    container.addEventListener('click', (event) => {
      const sectionButton = event.target.closest('[data-v19-section]');
      if (sectionButton) {
        showPanel(sectionButton.dataset.v19Section);
        return;
      }
      if (event.target.closest('[data-v19-go-training]')) {
        document.querySelector('[data-tab="workout"]')?.click();
        return;
      }
      const periodButton = event.target.closest('[data-v14-weeks]');
      if (!periodButton) return;
      ui.periodWeeks = Number(periodButton.dataset.v14Weeks);
      render();
    });
    $('v14ExerciseSelect').addEventListener('change', (event) => {
      ui.exerciseId = event.target.value;
      if (ui.model) renderExercise(ui.model);
    });
    window.addEventListener('macroflow:progress-view-rendered', () => scheduleRender(120));
    window.addEventListener('macroflow:session-complete', () => scheduleRender(40));
    window.addEventListener('macroflow:apply-nutrition-plan', () => scheduleRender(120));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && document.querySelector('[data-view="progress"]')?.classList.contains('active')) scheduleRender(40);
    });
  }

  function initialize() {
    const container = $('trainingProgressDashboard');
    if (!container) return;
    container.innerHTML = dashboardShell();
    showPanel(ui.panel);
    bind();
    render();
  }

  const publicApi = Object.freeze({
    version: VERSION,
    buildProgressModel,
    summarizeProgress,
    refresh: () => scheduleRender(0),
  });
  window.MacroFlowProgressV19 = publicApi;
  window.MacroFlowProgressV14 = publicApi;

  if (typeof document !== 'undefined') initialize();
})();
