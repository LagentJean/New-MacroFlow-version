(() => {
  'use strict';

  const VERSION = 'MacroFlow-Gamification-v21';
  const STORAGE_KEY = 'macroflow.momentum.v21';
  const DATABASES = {
    general: { name: 'macroflow-local', version: 1, store: 'app-state', key: 'main' },
    training: { name: 'macroflow-training', version: 1, store: 'training-state', key: 'main' },
  };
  const LEVEL_TITLES = ['Départ', 'Régulier', 'Engagé', 'Solide', 'Constant', 'Déterminé', 'Inarrêtable'];
  const ui = { general: {}, training: {}, ready: { general: false, training: false }, celebrationOpen: false };

  const $ = (id) => document.getElementById(id);
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const safeDate = (value) => {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const localDate = (value = new Date()) => {
    const date = safeDate(value) || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const dateKey = (value) => {
    const date = safeDate(value);
    return date ? localDate(date) : null;
  };
  const shiftDate = (value, days) => {
    const date = safeDate(value) || new Date();
    date.setDate(date.getDate() + days);
    return date;
  };
  const startOfWeek = (value = new Date()) => {
    const date = safeDate(value) || new Date();
    const distance = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - distance);
    return localDate(date);
  };
  const weekKey = (value) => {
    const date = safeDate(value);
    return date ? startOfWeek(date) : null;
  };
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));

  function mealDays(meals) {
    const days = new Map();
    safeArray(meals).forEach((meal, index) => {
      const date = dateKey(meal?.date || meal?.createdAt);
      if (!date) return;
      if (!days.has(date)) days.set(date, { date, events: new Set(), mealTypes: new Set(), items: 0 });
      const day = days.get(date);
      day.events.add(meal.mealGroupId || `single:${meal.id || index}`);
      if (meal.mealType) day.mealTypes.add(meal.mealType);
      day.items += 1;
    });
    return new Map([...days].map(([date, day]) => [date, {
      date, events: day.events.size, mealTypes: day.mealTypes.size, items: day.items,
      tracked: day.events.size >= 2 || day.mealTypes.size >= 2,
    }]));
  }

  function prescribedSetsFor(session, program) {
    const day = safeArray(program?.days).find((item) => item.id === session?.dayId);
    return day ? safeArray(day.exercises).reduce((sum, exercise) => sum + Math.max(0, Number(exercise.sets) || 0), 0) : 0;
  }

  function sessionMetrics(training) {
    return safeArray(training?.sessions).filter((session) => safeDate(session?.completedAt)).map((session) => {
      const prescribed = prescribedSetsFor(session, training?.program);
      const completed = safeArray(session.sets).length;
      return {
        session, date: dateKey(session.completedAt), prescribed, completed,
        adherence: prescribed ? Math.min(1, completed / prescribed) : (completed ? 1 : 0),
      };
    });
  }

  function calculateProtectedStreak(activeDates, now = new Date()) {
    const dates = activeDates instanceof Set ? activeDates : new Set(activeDates || []);
    let cursor = safeDate(now) || new Date();
    if (!dates.has(localDate(cursor))) cursor = shiftDate(cursor, -1);
    let streak = 0;
    let graceUsed = false;
    let started = false;
    for (let index = 0; index < 365; index += 1) {
      const key = localDate(cursor);
      if (dates.has(key)) {
        streak += 1;
        started = true;
      } else if (started && !graceUsed) {
        graceUsed = true;
      } else {
        break;
      }
      cursor = shiftDate(cursor, -1);
    }
    return { streak, graceUsed };
  }

  function levelFromPoints(points) {
    const total = Math.max(0, Math.round(Number(points) || 0));
    let level = 1;
    let floor = 0;
    let requirement = 180;
    while (total >= floor + requirement && level < 99) {
      floor += requirement;
      level += 1;
      requirement = 180 + (level - 1) * 40;
    }
    return {
      level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
      floor, requirement, current: total - floor, total,
      progress: requirement ? Math.min(1, (total - floor) / requirement) : 0,
    };
  }

  function buildModel(general = {}, training = {}, now = new Date()) {
    const mealsByDay = mealDays(general.meals);
    const sessions = sessionMetrics(training);
    const trackedDays = [...mealsByDay.values()].filter((day) => day.tracked);
    const weighInDates = new Set(safeArray(general.weighIns).map((entry) => dateKey(entry?.date || entry?.createdAt)).filter(Boolean));
    const nutritionCheckInWeeks = new Set(safeArray(general.checkIns).map((entry) => weekKey(entry?.createdAt || entry?.date)).filter(Boolean));
    const trainingReviews = safeArray(training.trainingReviews).filter((entry) => entry?.createdAt);
    const trainingReviewWeeks = new Set(trainingReviews.map((entry) => weekKey(entry.createdAt)));
    const completedWithQuality = sessions.filter((entry) => entry.adherence >= 0.8).length;
    const sourcePoints = {
      nutrition: trackedDays.length * 35,
      training: sessions.length * 90 + completedWithQuality * 20,
      reflection: nutritionCheckInWeeks.size * 35 + trainingReviewWeeks.size * 45,
      markers: weighInDates.size * 15 + (general.nutritionPlan ? 50 : 0),
    };
    const points = Object.values(sourcePoints).reduce((sum, value) => sum + value, 0);
    const level = levelFromPoints(points);

    const activeDates = new Set(trackedDays.map((day) => day.date));
    sessions.forEach((entry) => activeDates.add(entry.date));
    safeArray(general.checkIns).forEach((entry) => {
      const date = dateKey(entry?.createdAt || entry?.date);
      if (date) activeDates.add(date);
    });
    trainingReviews.forEach((entry) => {
      const date = dateKey(entry.createdAt);
      if (date) activeDates.add(date);
    });
    const streak = calculateProtectedStreak(activeDates, now);
    const today = localDate(now);
    const todayMeals = mealsByDay.get(today) || { events: 0, mealTypes: 0, tracked: false };
    const todaySessions = sessions.filter((entry) => entry.date === today);
    const scheduledDay = safeArray(training?.program?.days).find((day) => Number(day.weekday) === (safeDate(now) || new Date()).getDay());
    const activeSession = training?.activeSession || null;
    const activePrescribed = activeSession ? prescribedSetsFor(activeSession, training?.program) : 0;
    const week = startOfWeek(now);
    const reflectionComplete = weighInDates.has(today)
      || nutritionCheckInWeeks.has(week) || trainingReviewWeeks.has(week)
      || [...weighInDates].some((date) => weekKey(date) === week);

    const missions = [{
      id: 'nutrition', icon: '🥗', title: 'Suivre deux moments de repas',
      detail: todayMeals.tracked ? 'Assez de données pour comprendre ta journée.' : 'Deux ajouts distincts suffisent; aucune cible parfaite requise.',
      current: Math.min(2, Math.max(todayMeals.events, todayMeals.mealTypes)), target: 2, reward: 35,
    }];
    if (activeSession || scheduledDay) {
      const complete = todaySessions.length > 0;
      const earnedToday = todaySessions.reduce((sum, entry) => sum + 90 + (entry.adherence >= 0.8 ? 20 : 0), 0);
      missions.push({
        id: 'training', icon: '🏋️', title: activeSession ? 'Continuer ta séance' : 'Séance prévue aujourd’hui',
        detail: complete ? 'Séance enregistrée. La qualité compte plus que la durée.' : activeSession ? `${safeArray(activeSession.sets).length} série${safeArray(activeSession.sets).length !== 1 ? 's' : ''} enregistrée${safeArray(activeSession.sets).length !== 1 ? 's' : ''}.` : 'Termine-la ou conserve-la partielle si la journée change.',
        current: complete ? 1 : activeSession && activePrescribed ? Math.min(0.99, safeArray(activeSession.sets).length / activePrescribed) : 0,
        target: 1, reward: 90, rewardText: complete ? `+${earnedToday} XP acquis` : '+90–110 XP',
        displayProgress: activeSession && !complete && activePrescribed ? `${safeArray(activeSession.sets).length}/${activePrescribed}` : null,
      });
    } else if (training?.program) {
      missions.push({ id: 'rest', icon: '🌙', title: 'Jour de récupération prévu', detail: 'Ton élan reste intact. Aucun entraînement à forcer.', current: 0, target: 0, reward: 0, neutral: true });
    } else {
      missions.push({ id: 'plan', icon: '🧭', title: 'Créer ton plan personnel', detail: 'Le plan reliera ton horaire, ton matériel et ton objectif.', current: 0, target: 1, reward: 50 });
    }
    const reflectionXpThisWeek = (nutritionCheckInWeeks.has(week) ? 35 : 0)
      + (trainingReviewWeeks.has(week) ? 45 : 0)
      + [...weighInDates].filter((date) => weekKey(date) === week).length * 15;
    missions.push({
      id: 'reflection', icon: '◎', title: 'Ajouter un repère cette semaine',
      detail: reflectionComplete ? 'Pesée ou bilan enregistré pour ajuster avec de vraies données.' : 'Une pesée ou un bilan suffit; inutile de le faire chaque jour.',
      current: reflectionComplete ? 1 : 0, target: 1, reward: 15,
      rewardText: reflectionComplete ? `+${reflectionXpThisWeek} XP acquis` : '+15 XP ou plus',
    });
    missions.forEach((mission) => { mission.complete = mission.target > 0 && mission.current >= mission.target; });

    const currentWeekActive = [...activeDates].filter((date) => weekKey(date) === week).length;
    const achievements = [
      { id: 'first_day', icon: '⚡', title: 'Premier élan', detail: 'Première journée utile enregistrée', unlocked: activeDates.size >= 1 },
      { id: 'three_streak', icon: '🔥', title: 'Élan 3', detail: 'Trois jours actifs dans ta série protégée', unlocked: streak.streak >= 3 },
      { id: 'tracked_7', icon: '🥗', title: 'Nutrition 7', detail: 'Sept journées nutritionnelles suivies', unlocked: trackedDays.length >= 7 },
      { id: 'first_session', icon: '🏋️', title: 'Séance lancée', detail: 'Première séance terminée', unlocked: sessions.length >= 1 },
      { id: 'five_sessions', icon: '💪', title: 'Régularité Training', detail: 'Cinq séances terminées', unlocked: sessions.length >= 5 },
      { id: 'first_review', icon: '◎', title: 'Pilotage réel', detail: 'Premier bilan enregistré', unlocked: nutritionCheckInWeeks.size + trainingReviewWeeks.size >= 1 },
      { id: 'balanced_week', icon: '◆', title: 'Semaine solide', detail: 'Quatre jours utiles cette semaine', unlocked: currentWeekActive >= 4 },
      { id: 'level_5', icon: '🏆', title: 'Élan durable', detail: 'Niveau 5 atteint sans raccourci', unlocked: level.level >= 5 },
    ];
    return {
      points, sourcePoints, level, missions, achievements, streak,
      counts: { trackedDays: trackedDays.length, sessions: sessions.length, qualitySessions: completedWithQuality, weighIns: weighInDates.size, reviews: nutritionCheckInWeeks.size + trainingReviewWeeks.size, activeDays: activeDates.size },
    };
  }

  function missionHtml(mission) {
    const progress = mission.neutral ? 'Repos' : mission.complete ? '✓' : (mission.displayProgress || `${Math.round(mission.current)}/${mission.target}`);
    const reward = mission.neutral ? 'protégé' : mission.rewardText || (mission.complete ? `+${mission.reward} XP acquis` : `+${mission.reward} XP`);
    return `<div class="momentum-mission ${mission.complete ? 'complete' : ''} ${mission.neutral ? 'neutral' : ''}"><span class="momentum-mission-icon">${escapeText(mission.icon)}</span><div class="momentum-mission-copy"><b>${escapeText(mission.title)}</b><small>${escapeText(mission.detail)}</small></div><div class="momentum-mission-value"><b>${escapeText(progress)}</b><small>${escapeText(reward)}</small></div></div>`;
  }

  function render(model) {
    if (!$('momentumCard')) return;
    const actionable = model.missions.filter((mission) => !mission.neutral);
    const completed = actionable.filter((mission) => mission.complete).length;
    $('momentumLevel').textContent = `Niveau ${model.level.level} · ${model.level.title}`;
    $('momentumXpText').textContent = `${model.level.current} / ${model.level.requirement} XP d’élan`;
    $('momentumLevelFill').style.width = `${Math.round(model.level.progress * 100)}%`;
    $('momentumMissionCount').textContent = `${completed}/${actionable.length} mission${actionable.length > 1 ? 's' : ''}`;
    $('momentumStreak').textContent = `${model.streak.streak} jour${model.streak.streak !== 1 ? 's' : ''}`;
    $('momentumMissions').innerHTML = model.missions.map(missionHtml).join('');
    $('momentumGraceNote').textContent = model.streak.graceUsed
      ? 'Un jour sans activité est protégé dans cette série. Aucun point n’a été perdu.'
      : 'Aucun point ne peut être perdu. Les jours de repos font partie du plan.';

    $('levelText').textContent = `Niv. ${model.level.level}`;
    $('levelText').closest('.level-pill')?.setAttribute('title', `${model.points} XP d’élan · ${model.level.title}`);
    if ($('streakStat')) $('streakStat').textContent = model.streak.streak;
    if ($('xpStat')) $('xpStat').textContent = model.points;

    $('momentumProgressLevel').textContent = `Niv. ${model.level.level}`;
    $('momentumProgressLead').textContent = `${model.points} XP d’élan gagnés par des actions réelles. Ils ne diminuent jamais et ne dépendent pas d’une journée parfaite.`;
    const sources = [
      ['🥗', 'journée suivie', 'journées suivies', model.counts.trackedDays, model.sourcePoints.nutrition],
      ['🏋️', 'séance terminée', 'séances terminées', model.counts.sessions, model.sourcePoints.training],
      ['◎', 'bilan', 'bilans', model.counts.reviews, model.sourcePoints.reflection],
      ['⚖️', 'repère ou plan', 'repères et plan', model.counts.weighIns + (ui.general.nutritionPlan ? 1 : 0), model.sourcePoints.markers],
    ];
    $('momentumPointSources').innerHTML = sources.map(([icon, singular, plural, count, points]) => `<div><span>${icon}</span><b>${points} XP</b><small>${count} ${escapeText(count === 1 ? singular : plural)}</small></div>`).join('');
    const unlockedCount = model.achievements.filter((badge) => badge.unlocked).length;
    $('momentumBadgeCount').textContent = `${unlockedCount} obtenue${unlockedCount !== 1 ? 's' : ''}`;
    $('momentumBadges').innerHTML = model.achievements.map((badge) => `<div class="momentum-badge ${badge.unlocked ? 'unlocked' : 'locked'}"><span>${badge.unlocked ? escapeText(badge.icon) : '·'}</span><b>${escapeText(badge.title)}</b><small>${escapeText(badge.detail)}</small></div>`).join('');
  }

  function celebrationState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  }

  function saveCelebrationState(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* L’interface continue sans historique d’animation. */ }
  }

  function showCelebration(icon, title, text) {
    if (ui.celebrationOpen || !$('momentumCelebration')) return;
    ui.celebrationOpen = true;
    $('momentumCelebrationIcon').textContent = icon;
    $('momentumCelebrationTitle').textContent = title;
    $('momentumCelebrationText').textContent = text;
    $('momentumCelebration').classList.remove('hidden');
    window.MacroFlowDelight?.haptic?.('success', true);
    window.MacroFlowDelight?.pulse?.($('momentumCelebrationIcon'));
  }

  function maybeCelebrate(model) {
    if (!ui.ready.general || !ui.ready.training) return;
    const unlocked = model.achievements.filter((badge) => badge.unlocked);
    const previous = celebrationState();
    if (!previous?.initialized) {
      saveCelebrationState({ initialized: true, badges: unlocked.map((badge) => badge.id), level: model.level.level });
      return;
    }
    const seen = new Set(safeArray(previous.badges));
    const newBadge = unlocked.find((badge) => !seen.has(badge.id));
    saveCelebrationState({ initialized: true, badges: unlocked.map((badge) => badge.id), level: Math.max(Number(previous.level) || 1, model.level.level) });
    if (newBadge) showCelebration(newBadge.icon, newBadge.title, newBadge.detail);
    else if (model.level.level > (Number(previous.level) || 1)) showCelebration('⚡', `Niveau ${model.level.level}`, `${model.level.title} · ton élan repose sur des actions réellement enregistrées.`);
  }

  function update() {
    const model = buildModel(ui.general, ui.training);
    render(model);
    maybeCelebrate(model);
    return model;
  }

  function readRecord(config) {
    if (typeof indexedDB === 'undefined') return Promise.resolve({});
    return new Promise((resolve) => {
      const request = indexedDB.open(config.name, config.version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(config.store)) request.result.createObjectStore(config.store);
      };
      request.onerror = () => resolve({});
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(config.store, 'readonly');
        const getRequest = transaction.objectStore(config.store).get(config.key);
        getRequest.onsuccess = () => resolve(getRequest.result || {});
        getRequest.onerror = () => resolve({});
        transaction.oncomplete = () => database.close();
      };
    });
  }

  function bind() {
    window.addEventListener('macroflow:general-state-rendered', (event) => {
      ui.general = event.detail || {};
      ui.ready.general = true;
      update();
    });
    window.addEventListener('macroflow:training-state-rendered', (event) => {
      ui.training = event.detail || {};
      ui.ready.training = true;
      update();
    });
    $('momentumCelebrationClose')?.addEventListener('click', () => {
      ui.celebrationOpen = false;
      $('momentumCelebration').classList.add('hidden');
    });
  }

  const publicApi = Object.freeze({
    version: VERSION, localDate, startOfWeek, mealDays, sessionMetrics,
    calculateProtectedStreak, levelFromPoints, buildModel,
    refresh: update,
  });
  window.MacroFlowGamificationV21 = publicApi;

  if (typeof document !== 'undefined' && $('momentumCard')) {
    bind();
    Promise.all([readRecord(DATABASES.general), readRecord(DATABASES.training)]).then(([general, training]) => {
      if (!ui.ready.general) ui.general = general;
      if (!ui.ready.training) ui.training = training;
      ui.ready.general = true;
      ui.ready.training = true;
      update();
    });
  }
})();
