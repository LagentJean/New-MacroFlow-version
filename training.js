(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const DB_NAME = 'macroflow-training';
  const DB_VERSION = 1;
  const STORE = 'training-state';
  const KEY = 'main';
  const DEFAULT_STATE = { localProfile: null, profile: null, program: null, nutritionPlan: null, draftProfile: null, onboardingStep: 0, sessions: [], activeSession: null, sessionSummaryId: null, trainingReviews: [], trainingAdjustments: [], activeAdaptation: null, dailyCoachDecisions: [] };
  let data = structuredClone(DEFAULT_STATE);
  let onboardingStep = 0;
  let sessionTicker = null;
  let restTicker = null;
  let restRemaining = 0;
  let restTotal = 0;
  let sessionNoticeTimer = null;
  let editingSetId = null;
  let replaceExerciseIndex = null;

  const WEEKDAYS = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };
  const GOALS = { hypertrophy: 'Prise de muscle', strength: 'Force', balanced: 'Force + muscle', general: 'Santé générale' };
  const BODY_GOALS = { lean_bulk: 'Prise de muscle contrôlée', recomp: 'Recomposition corporelle', fat_loss: 'Perte de gras avec maintien musculaire', maintain: 'Maintien et performance' };
  const LEVELS = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' };
  const ACTIVITY_LOADS = { none: 'Aucune fatigue externe', light: 'Fatigue externe légère', moderate: 'Fatigue externe modérée', high: 'Fatigue externe élevée' };
  const MUSCLES = { chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', arms: 'Bras', quads: 'Quadriceps', glutes: 'Fessiers', hamstrings: 'Ischios', calves: 'Mollets', core: 'Tronc' };
  const PATTERNS = { knee: 'dominante quadriceps', horizontalPush: 'press horizontal', horizontalPull: 'rowing', verticalPush: 'press vertical', verticalPull: 'tirage vertical', hinge: 'charnière de hanche', unilateral: 'jambes unilatéral', hamstringIsolation: 'isolation des ischios', quadIsolation: 'isolation des quadriceps', shoulderIsolation: 'élévations latérales', rearDelt: 'arrière d’épaule', biceps: 'biceps', triceps: 'triceps', calves: 'mollets', core: 'tronc', chestIsolation: 'isolation des pectoraux' };
  const MACHINE_EQUIPMENT = ['machine_legpress', 'machine_chestpress', 'machine_shoulderpress', 'machine_legcurl', 'machine_legextension', 'machine_calf', 'machine_hacksquat', 'machine_pendulum', 'machine_beltsquat', 'machine_tbar', 'machine_row', 'machine_assisted', 'machine_pullover', 'backextension', 'machine_lateral', 'machine_pecdeck', 'machine_preacher'];
  const EQUIPMENT_PRESETS = {
    gym: ['dumbbells', 'bench', 'barbell', 'rack', 'cable', 'smith', 'kettlebell', 'pullup', 'dipstation', 'bands', ...MACHINE_EQUIPMENT],
    homebar: ['dumbbells', 'bench', 'barbell', 'rack', 'pullup', 'bands'],
    basic: ['dumbbells', 'bench', 'bands'],
    bodyweight: [],
    custom: [],
  };

  const EX = {
    squat: ex('Squat barre', 'knee', 'quads', ['glutes'], true, ['barbell', 'rack'], 'free', 5),
    gobletSquat: ex('Goblet squat', 'knee', 'quads', ['glutes'], true, ['dumbbells'], 'free', 2),
    legpress: ex('Presse à cuisses', 'knee', 'quads', ['glutes'], true, ['machine_legpress'], 'machines', 5),
    bodySquat: ex('Squat au poids du corps', 'knee', 'quads', ['glutes'], true, [], 'bodyweight', 0),
    bench: ex('Développé couché barre', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['barbell', 'bench', 'rack'], 'free', 2.5),
    dbBench: ex('Développé couché haltères', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['dumbbells', 'bench'], 'free', 2),
    chestPress: ex('Chest press', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['machine_chestpress'], 'machines', 2.5),
    pushup: ex('Pompes', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, [], 'bodyweight', 0),
    row: ex('Rowing barre', 'horizontalPull', 'back', ['arms'], true, ['barbell'], 'free', 2.5),
    dbRow: ex('Rowing unilatéral haltère', 'horizontalPull', 'back', ['arms'], true, ['dumbbells'], 'free', 2),
    cableRow: ex('Rowing poulie', 'horizontalPull', 'back', ['arms'], true, ['cable'], 'machines', 2.5),
    bandRow: ex('Rowing avec bande', 'horizontalPull', 'back', ['arms'], true, ['bands'], 'bodyweight', 0),
    ohp: ex('Développé militaire barre', 'verticalPush', 'shoulders', ['arms'], true, ['barbell'], 'free', 2.5),
    dbOhp: ex('Développé épaules haltères', 'verticalPush', 'shoulders', ['arms'], true, ['dumbbells'], 'free', 2),
    machinePress: ex('Shoulder press', 'verticalPush', 'shoulders', ['arms'], true, ['machine_shoulderpress'], 'machines', 2.5),
    pikePushup: ex('Pompes pike', 'verticalPush', 'shoulders', ['arms'], true, [], 'bodyweight', 0),
    pullup: ex('Tractions', 'verticalPull', 'back', ['arms'], true, ['pullup'], 'bodyweight', 0),
    pulldown: ex('Tirage vertical', 'verticalPull', 'back', ['arms'], true, ['cable'], 'machines', 2.5),
    bandPulldown: ex('Tirage vertical avec bande', 'verticalPull', 'back', ['arms'], true, ['bands'], 'bodyweight', 0),
    deadlift: ex('Soulevé de terre', 'hinge', 'glutes', ['hamstrings', 'back'], true, ['barbell'], 'free', 5),
    rdl: ex('Soulevé de terre roumain', 'hinge', 'hamstrings', ['glutes', 'back'], true, ['barbell'], 'free', 5),
    dbRdl: ex('Soulevé de terre roumain haltères', 'hinge', 'hamstrings', ['glutes'], true, ['dumbbells'], 'free', 2),
    gluteBridge: ex('Pont fessier', 'hinge', 'glutes', ['hamstrings'], true, [], 'bodyweight', 0),
    lunge: ex('Fentes', 'unilateral', 'quads', ['glutes'], true, ['dumbbells'], 'free', 2),
    splitSquat: ex('Split squat', 'unilateral', 'quads', ['glutes'], true, [], 'bodyweight', 0),
    legcurl: ex('Leg curl', 'hamstringIsolation', 'hamstrings', [], false, ['machine_legcurl'], 'machines', 2.5),
    bandLegcurl: ex('Leg curl avec bande', 'hamstringIsolation', 'hamstrings', [], false, ['bands'], 'bodyweight', 0),
    legext: ex('Leg extension', 'quadIsolation', 'quads', [], false, ['machine_legextension'], 'machines', 2.5),
    spanishSquat: ex('Spanish squat avec bande', 'quadIsolation', 'quads', [], false, ['bands'], 'bodyweight', 0),
    lateral: ex('Élévations latérales haltères', 'shoulderIsolation', 'shoulders', [], false, ['dumbbells'], 'free', 1),
    cableLateral: ex('Élévations latérales poulie', 'shoulderIsolation', 'shoulders', [], false, ['cable'], 'machines', 1),
    bandLateral: ex('Élévations latérales avec bande', 'shoulderIsolation', 'shoulders', [], false, ['bands'], 'bodyweight', 0),
    facepull: ex('Face pull', 'rearDelt', 'shoulders', ['back'], false, ['cable'], 'machines', 2),
    bandFacepull: ex('Face pull avec bande', 'rearDelt', 'shoulders', ['back'], false, ['bands'], 'bodyweight', 0),
    curl: ex('Curl haltères', 'biceps', 'arms', [], false, ['dumbbells'], 'free', 1),
    cableCurl: ex('Curl poulie', 'biceps', 'arms', [], false, ['cable'], 'machines', 1),
    bandCurl: ex('Curl avec bande', 'biceps', 'arms', [], false, ['bands'], 'bodyweight', 0),
    triceps: ex('Extension triceps poulie', 'triceps', 'arms', [], false, ['cable'], 'machines', 1),
    dbTriceps: ex('Extension triceps haltère', 'triceps', 'arms', [], false, ['dumbbells'], 'free', 1),
    closePushup: ex('Pompes serrées', 'triceps', 'arms', ['chest'], false, [], 'bodyweight', 0),
    calf: ex('Mollets debout', 'calves', 'calves', [], false, [], 'bodyweight', 0),
    machineCalf: ex('Mollets à la machine', 'calves', 'calves', [], false, ['machine_calf'], 'machines', 2.5),
    abs: ex('Gainage / abdominaux', 'core', 'core', [], false, [], 'bodyweight', 0),
    cableAbs: ex('Crunch à la poulie', 'core', 'core', [], false, ['cable'], 'machines', 2),
    dbFly: ex('Écartés haltères', 'chestIsolation', 'chest', [], false, ['dumbbells', 'bench'], 'free', 1),
    cableFly: ex('Écartés poulie', 'chestIsolation', 'chest', [], false, ['cable'], 'machines', 1),
    frontSquat: ex('Front squat', 'knee', 'quads', ['glutes'], true, ['barbell', 'rack'], 'free', 2.5),
    hackSquat: ex('Hack squat', 'knee', 'quads', ['glutes'], true, ['machine_hacksquat'], 'machines', 5),
    pendulumSquat: ex('Pendulum squat', 'knee', 'quads', ['glutes'], true, ['machine_pendulum'], 'machines', 5),
    beltSquat: ex('Belt squat', 'knee', 'quads', ['glutes'], true, ['machine_beltsquat'], 'machines', 5),
    smithSquat: ex('Squat à la Smith machine', 'knee', 'quads', ['glutes'], true, ['smith'], 'machines', 2.5),
    kettlebellGoblet: ex('Goblet squat kettlebell', 'knee', 'quads', ['glutes'], true, ['kettlebell'], 'free', 2),
    inclineBench: ex('Développé incliné barre', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['barbell', 'bench', 'rack'], 'free', 2.5),
    inclineDbBench: ex('Développé incliné haltères', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['dumbbells', 'bench'], 'free', 2),
    declineBench: ex('Développé décliné barre', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['barbell', 'bench', 'rack'], 'free', 2.5),
    smithBench: ex('Développé couché Smith machine', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['smith', 'bench'], 'machines', 2.5),
    inclineChestPress: ex('Chest press inclinée', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['machine_chestpress'], 'machines', 2.5),
    floorPress: ex('Floor press haltères', 'horizontalPush', 'chest', ['arms'], true, ['dumbbells'], 'free', 2),
    dip: ex('Dips', 'horizontalPush', 'chest', ['arms', 'shoulders'], true, ['dipstation'], 'bodyweight', 0),
    tbarRow: ex('T-bar row', 'horizontalPull', 'back', ['arms'], true, ['machine_tbar'], 'machines', 2.5),
    chestSupportedRow: ex('Rowing haltères poitrine appuyée', 'horizontalPull', 'back', ['arms'], true, ['dumbbells', 'bench'], 'free', 2),
    machineRow: ex('Rowing machine', 'horizontalPull', 'back', ['arms'], true, ['machine_row'], 'machines', 2.5),
    invertedRow: ex('Rowing inversé', 'horizontalPull', 'back', ['arms'], true, ['rack'], 'bodyweight', 0),
    sealRow: ex('Seal row barre', 'horizontalPull', 'back', ['arms'], true, ['barbell', 'bench'], 'free', 2.5),
    landminePress: ex('Landmine press', 'verticalPush', 'shoulders', ['arms', 'chest'], true, ['barbell'], 'free', 2.5),
    arnoldPress: ex('Arnold press', 'verticalPush', 'shoulders', ['arms'], true, ['dumbbells'], 'free', 2),
    smithOhp: ex('Développé épaules Smith machine', 'verticalPush', 'shoulders', ['arms'], true, ['smith'], 'machines', 2.5),
    chinup: ex('Chin-up · tractions supination', 'verticalPull', 'back', ['arms'], true, ['pullup'], 'bodyweight', 0),
    neutralPullup: ex('Tractions prise neutre', 'verticalPull', 'back', ['arms'], true, ['pullup'], 'bodyweight', 0),
    assistedPullup: ex('Tractions assistées', 'verticalPull', 'back', ['arms'], true, ['machine_assisted'], 'machines', 2.5),
    straightArmPulldown: ex('Tirage bras tendus', 'verticalPull', 'back', [], false, ['cable'], 'machines', 1),
    machinePullover: ex('Pullover machine', 'verticalPull', 'back', [], false, ['machine_pullover'], 'machines', 2.5),
    hipThrust: ex('Hip thrust barre', 'hinge', 'glutes', ['hamstrings'], true, ['barbell', 'bench'], 'free', 5),
    smithHipThrust: ex('Hip thrust Smith machine', 'hinge', 'glutes', ['hamstrings'], true, ['smith', 'bench'], 'machines', 2.5),
    goodMorning: ex('Good morning barre', 'hinge', 'hamstrings', ['glutes', 'back'], true, ['barbell'], 'free', 2.5),
    cablePullthrough: ex('Pull-through à la poulie', 'hinge', 'glutes', ['hamstrings'], false, ['cable'], 'machines', 2),
    backExtension: ex('Extension lombaire à 45°', 'hinge', 'glutes', ['hamstrings', 'back'], true, ['backextension'], 'machines', 0),
    kettlebellSwing: ex('Kettlebell swing', 'hinge', 'glutes', ['hamstrings'], true, ['kettlebell'], 'free', 2),
    bulgarian: ex('Split squat bulgare', 'unilateral', 'quads', ['glutes'], true, ['dumbbells', 'bench'], 'free', 2),
    stepup: ex('Step-up', 'unilateral', 'quads', ['glutes'], true, ['dumbbells', 'bench'], 'free', 2),
    reverseLunge: ex('Fentes arrière', 'unilateral', 'quads', ['glutes'], true, ['dumbbells'], 'free', 2),
    walkingLunge: ex('Fentes marchées', 'unilateral', 'quads', ['glutes'], true, ['dumbbells'], 'free', 2),
    singleLegPress: ex('Presse à cuisses unilatérale', 'unilateral', 'quads', ['glutes'], true, ['machine_legpress'], 'machines', 2.5),
    seatedLegcurl: ex('Leg curl assis', 'hamstringIsolation', 'hamstrings', [], false, ['machine_legcurl'], 'machines', 2.5),
    lyingLegcurl: ex('Leg curl couché', 'hamstringIsolation', 'hamstrings', [], false, ['machine_legcurl'], 'machines', 2.5),
    nordicCurl: ex('Nordic curl', 'hamstringIsolation', 'hamstrings', [], false, [], 'bodyweight', 0),
    ballLegcurl: ex('Leg curl au ballon', 'hamstringIsolation', 'hamstrings', [], false, [], 'bodyweight', 0),
    sissySquat: ex('Sissy squat', 'quadIsolation', 'quads', [], false, [], 'bodyweight', 0),
    reverseNordic: ex('Reverse Nordic', 'quadIsolation', 'quads', [], false, [], 'bodyweight', 0),
    machineLateral: ex('Élévations latérales machine', 'shoulderIsolation', 'shoulders', [], false, ['machine_lateral'], 'machines', 2.5),
    cableYraise: ex('Y-raise à la poulie', 'shoulderIsolation', 'shoulders', [], false, ['cable'], 'machines', 1),
    uprightRow: ex('Tirage menton à la poulie', 'shoulderIsolation', 'shoulders', ['arms'], false, ['cable'], 'machines', 1),
    rearDeltFly: ex('Oiseau haltères', 'rearDelt', 'shoulders', ['back'], false, ['dumbbells'], 'free', 1),
    reversePecDeck: ex('Reverse pec deck', 'rearDelt', 'shoulders', ['back'], false, ['machine_pecdeck'], 'machines', 2.5),
    cableRearDelt: ex('Oiseau à la poulie', 'rearDelt', 'shoulders', ['back'], false, ['cable'], 'machines', 1),
    hammerCurl: ex('Curl marteau', 'biceps', 'arms', [], false, ['dumbbells'], 'free', 1),
    inclineCurl: ex('Curl incliné haltères', 'biceps', 'arms', [], false, ['dumbbells', 'bench'], 'free', 1),
    preacherCurl: ex('Curl pupitre machine', 'biceps', 'arms', [], false, ['machine_preacher'], 'machines', 2.5),
    ezCurl: ex('Curl barre EZ', 'biceps', 'arms', [], false, ['barbell'], 'free', 1),
    concentrationCurl: ex('Curl concentration', 'biceps', 'arms', [], false, ['dumbbells'], 'free', 1),
    ropePushdown: ex('Extension triceps corde', 'triceps', 'arms', [], false, ['cable'], 'machines', 1),
    skullCrusher: ex('Skull crusher barre', 'triceps', 'arms', [], false, ['barbell', 'bench'], 'free', 1),
    overheadCableTriceps: ex('Extension triceps au-dessus de la tête', 'triceps', 'arms', [], false, ['cable'], 'machines', 1),
    dipMachine: ex('Dips assistés machine', 'triceps', 'arms', ['chest'], false, ['machine_assisted'], 'machines', 2.5),
    kickback: ex('Kickback triceps haltère', 'triceps', 'arms', [], false, ['dumbbells'], 'free', 1),
    seatedCalf: ex('Mollets assis', 'calves', 'calves', [], false, ['machine_calf'], 'machines', 2.5),
    legPressCalf: ex('Mollets à la presse', 'calves', 'calves', [], false, ['machine_legpress'], 'machines', 2.5),
    singleCalf: ex('Mollets unilatéraux debout', 'calves', 'calves', [], false, [], 'bodyweight', 0),
    hangingRaise: ex('Relevés de genoux suspendu', 'core', 'core', [], false, ['pullup'], 'bodyweight', 0),
    abWheel: ex('Roue abdominale', 'core', 'core', [], false, [], 'bodyweight', 0),
    deadBug: ex('Dead bug', 'core', 'core', [], false, [], 'bodyweight', 0),
    pallof: ex('Pallof press', 'core', 'core', [], false, ['cable'], 'machines', 1),
    sidePlank: ex('Planche latérale', 'core', 'core', [], false, [], 'bodyweight', 0),
    pecDeck: ex('Pec deck', 'chestIsolation', 'chest', [], false, ['machine_pecdeck'], 'machines', 2.5),
    lowCableFly: ex('Écartés poulie bas vers haut', 'chestIsolation', 'chest', [], false, ['cable'], 'machines', 1),
    highCableFly: ex('Écartés poulie haut vers bas', 'chestIsolation', 'chest', [], false, ['cable'], 'machines', 1),
  };

  const EXERCISE_ALIASES = {
    squat: ['back squat', 'barbell squat'], gobletSquat: ['goblet'], legpress: ['leg press'], bench: ['bench press', 'développé couché', 'dc'],
    dbBench: ['dumbbell bench press', 'bench haltères'], inclineBench: ['incline bench press'], inclineDbBench: ['incline dumbbell press', 'incline db press'],
    chestPress: ['machine chest press'], row: ['barbell row'], dbRow: ['dumbbell row'], cableRow: ['seated cable row'], tbarRow: ['t bar row'],
    ohp: ['overhead press', 'military press', 'développé militaire'], dbOhp: ['dumbbell shoulder press'], pullup: ['pull up', 'pull-up'],
    pulldown: ['lat pulldown', 'tirage vertical'], deadlift: ['soulevé de terre'], rdl: ['romanian deadlift', 'stiff leg deadlift'],
    dbRdl: ['dumbbell romanian deadlift'], hipThrust: ['barbell hip thrust'], lunge: ['lunges'], bulgarian: ['bulgarian split squat'],
    legcurl: ['leg curl'], legext: ['leg extension'], lateral: ['lateral raise'], facepull: ['face pull'], curl: ['dumbbell curl'],
    triceps: ['triceps pushdown', 'push down'], ropePushdown: ['rope pushdown'], calf: ['calf raise'], abs: ['abdos', 'plank'],
    cableAbs: ['cable crunch'], dbFly: ['dumbbell fly'], cableFly: ['cable fly'], pecDeck: ['machine fly'],
  };

  const ONBOARDING_LABELS = ['Bienvenue', 'Mesures', 'Expérience', 'Objectifs', 'Horaire', 'Activités', 'Équipement', 'Préférences', 'Récupération', 'Vérification'];
  const EXERCISE_PICKERS = {
    focus: { name: 'trainingMovementFocus', searchId: 'focusExerciseSearch', selectedId: 'focusExerciseSelected', resultsId: 'focusExerciseResults', max: 2 },
    likes: { name: 'trainingLike', searchId: 'likesExerciseSearch', selectedId: 'likesExerciseSelected', resultsId: 'likesExerciseResults', max: 5 },
    dislikes: { name: 'trainingDislike', searchId: 'dislikesExerciseSearch', selectedId: 'dislikesExerciseSelected', resultsId: 'dislikesExerciseResults', max: 20 },
  };
  const EQUIPMENT_LABELS = {
    dumbbells: 'Haltères', bench: 'Banc', barbell: 'Barre', rack: 'Rack', cable: 'Poulie', smith: 'Smith', kettlebell: 'Kettlebell', pullup: 'Barre à tractions', dipstation: 'Barres à dips', bands: 'Bandes',
    machine_legpress: 'Presse à cuisses', machine_chestpress: 'Chest press', machine_shoulderpress: 'Shoulder press', machine_legcurl: 'Leg curl', machine_legextension: 'Leg extension', machine_calf: 'Machine à mollets', machine_hacksquat: 'Hack squat', machine_pendulum: 'Pendulum squat', machine_beltsquat: 'Belt squat', machine_tbar: 'T-bar row', machine_row: 'Rowing machine', machine_assisted: 'Tractions/dips assistés', machine_pullover: 'Pullover machine', backextension: 'Banc à extension 45°', machine_lateral: 'Machine élévations latérales', machine_pecdeck: 'Pec deck', machine_preacher: 'Curl pupitre machine',
  };

  const TEMPLATES = {
    fullbody2: [
      ['Full Body A', ['knee', 'horizontalPush', 'horizontalPull', 'hinge', 'verticalPush', 'core']],
      ['Full Body B', ['hinge', 'verticalPull', 'horizontalPush', 'unilateral', 'horizontalPull', 'shoulderIsolation']],
    ],
    fullbody3: [
      ['Full Body A', ['knee', 'horizontalPush', 'horizontalPull', 'hinge', 'shoulderIsolation', 'core']],
      ['Full Body B', ['hinge', 'verticalPush', 'verticalPull', 'unilateral', 'biceps', 'triceps']],
      ['Full Body C', ['knee', 'horizontalPush', 'horizontalPull', 'hinge', 'rearDelt', 'calves']],
    ],
    upperlower: [
      ['Upper A', ['horizontalPush', 'horizontalPull', 'verticalPush', 'verticalPull', 'shoulderIsolation', 'triceps']],
      ['Lower A', ['knee', 'hinge', 'hamstringIsolation', 'quadIsolation', 'calves', 'core']],
      ['Upper B', ['verticalPull', 'horizontalPush', 'horizontalPull', 'verticalPush', 'rearDelt', 'biceps']],
      ['Lower B', ['hinge', 'knee', 'unilateral', 'hamstringIsolation', 'calves', 'core']],
    ],
    hybrid: [
      ['Upper', ['horizontalPush', 'horizontalPull', 'verticalPush', 'verticalPull', 'shoulderIsolation', 'biceps']],
      ['Lower', ['knee', 'hinge', 'hamstringIsolation', 'quadIsolation', 'calves', 'core']],
      ['Push', ['horizontalPush', 'verticalPush', 'chestIsolation', 'shoulderIsolation', 'triceps']],
      ['Pull', ['verticalPull', 'horizontalPull', 'rearDelt', 'biceps', 'core']],
      ['Legs', ['knee', 'hinge', 'unilateral', 'hamstringIsolation', 'calves', 'core']],
    ],
    ppl: [
      ['Push A', ['horizontalPush', 'verticalPush', 'chestIsolation', 'shoulderIsolation', 'triceps']],
      ['Pull A', ['verticalPull', 'horizontalPull', 'rearDelt', 'biceps', 'core']],
      ['Legs A', ['knee', 'hinge', 'hamstringIsolation', 'quadIsolation', 'calves', 'core']],
      ['Push B', ['verticalPush', 'horizontalPush', 'chestIsolation', 'shoulderIsolation', 'triceps']],
      ['Pull B', ['horizontalPull', 'verticalPull', 'rearDelt', 'biceps', 'core']],
      ['Legs B', ['hinge', 'knee', 'unilateral', 'hamstringIsolation', 'calves', 'core']],
    ],
  };

  const PATTERN_STRESS = {
    knee: { quads: 1, glutes: .55 }, horizontalPush: { chest: 1, shoulders: .45, arms: .35 },
    horizontalPull: { back: 1, arms: .4, shoulders: .2 }, verticalPush: { shoulders: 1, arms: .45, chest: .2 },
    verticalPull: { back: 1, arms: .45 }, hinge: { hamstrings: 1, glutes: .9, back: .25 },
    unilateral: { quads: .9, glutes: .75, hamstrings: .25 }, hamstringIsolation: { hamstrings: 1 },
    quadIsolation: { quads: 1 }, shoulderIsolation: { shoulders: 1 }, rearDelt: { shoulders: .8, back: .35 },
    biceps: { arms: 1 }, triceps: { arms: 1 }, calves: { calves: 1 }, core: { core: 1 }, chestIsolation: { chest: 1 },
  };
  const ACTIVITY_STRESS = {
    running: { quads: .8, glutes: .65, hamstrings: .65, calves: 1 },
    cycling: { quads: 1, glutes: .55, hamstrings: .25, calves: .35 },
    team: { quads: .75, glutes: .7, hamstrings: .65, calves: .7, core: .3 },
    climbing: { back: 1, arms: .9, shoulders: .55, core: .45 },
    combat: { quads: .55, glutes: .5, hamstrings: .45, shoulders: .65, arms: .55, core: .65 },
    physicalWork: { quads: .55, glutes: .55, hamstrings: .5, back: .55, shoulders: .4, arms: .35, core: .4 },
    other: { quads: .25, glutes: .25, hamstrings: .25, back: .25, shoulders: .25, arms: .25, calves: .25, core: .25 },
  };

  const EXERCISE_PREFERENCES = {
    strength: {
      knee: ['squat', 'frontSquat', 'smithSquat', 'legpress', 'hackSquat', 'gobletSquat', 'bodySquat'],
      horizontalPush: ['bench', 'inclineBench', 'smithBench', 'dbBench', 'chestPress', 'inclineDbBench', 'pushup'],
      horizontalPull: ['row', 'tbarRow', 'sealRow', 'chestSupportedRow', 'cableRow', 'machineRow', 'dbRow', 'invertedRow'],
      verticalPush: ['ohp', 'smithOhp', 'dbOhp', 'machinePress', 'landminePress', 'pikePushup'],
      verticalPull: ['pullup', 'chinup', 'neutralPullup', 'pulldown', 'assistedPullup', 'bandPulldown'],
      hinge: ['deadlift', 'rdl', 'hipThrust', 'dbRdl', 'smithHipThrust', 'backExtension', 'gluteBridge'],
      unilateral: ['bulgarian', 'reverseLunge', 'singleLegPress', 'splitSquat', 'stepup', 'walkingLunge'],
    },
    hypertrophy: {
      knee: ['pendulumSquat', 'hackSquat', 'legpress', 'smithSquat', 'beltSquat', 'frontSquat', 'gobletSquat', 'squat', 'bodySquat'],
      horizontalPush: ['inclineChestPress', 'chestPress', 'smithBench', 'inclineDbBench', 'dbBench', 'inclineBench', 'bench', 'pushup'],
      horizontalPull: ['chestSupportedRow', 'machineRow', 'cableRow', 'tbarRow', 'dbRow', 'sealRow', 'row', 'bandRow'],
      verticalPush: ['machinePress', 'smithOhp', 'dbOhp', 'landminePress', 'ohp', 'pikePushup'],
      verticalPull: ['pulldown', 'assistedPullup', 'neutralPullup', 'chinup', 'pullup', 'straightArmPulldown', 'machinePullover', 'bandPulldown'],
      hinge: ['rdl', 'dbRdl', 'smithHipThrust', 'hipThrust', 'backExtension', 'cablePullthrough', 'gluteBridge', 'goodMorning', 'deadlift'],
      unilateral: ['singleLegPress', 'bulgarian', 'reverseLunge', 'stepup', 'walkingLunge', 'splitSquat'],
    },
    general: {
      knee: ['gobletSquat', 'legpress', 'bodySquat', 'smithSquat', 'hackSquat', 'squat', 'frontSquat'],
      horizontalPush: ['dbBench', 'chestPress', 'pushup', 'smithBench', 'bench', 'inclineDbBench'],
      horizontalPull: ['cableRow', 'chestSupportedRow', 'machineRow', 'dbRow', 'bandRow', 'invertedRow', 'row'],
      verticalPush: ['dbOhp', 'machinePress', 'landminePress', 'smithOhp', 'pikePushup', 'ohp'],
      verticalPull: ['pulldown', 'assistedPullup', 'bandPulldown', 'neutralPullup', 'chinup', 'pullup'],
      hinge: ['dbRdl', 'gluteBridge', 'backExtension', 'rdl', 'cablePullthrough', 'hipThrust', 'smithHipThrust', 'deadlift'],
      unilateral: ['reverseLunge', 'splitSquat', 'stepup', 'singleLegPress', 'bulgarian', 'walkingLunge'],
    },
    accessory: {
      hamstringIsolation: ['seatedLegcurl', 'lyingLegcurl', 'legcurl', 'bandLegcurl', 'ballLegcurl', 'nordicCurl'],
      quadIsolation: ['legext', 'spanishSquat', 'reverseNordic', 'sissySquat'],
      shoulderIsolation: ['cableLateral', 'machineLateral', 'lateral', 'bandLateral', 'cableYraise', 'uprightRow'],
      rearDelt: ['reversePecDeck', 'cableRearDelt', 'facepull', 'rearDeltFly', 'bandFacepull'],
      biceps: ['inclineCurl', 'preacherCurl', 'cableCurl', 'hammerCurl', 'curl', 'ezCurl', 'concentrationCurl', 'bandCurl'],
      triceps: ['overheadCableTriceps', 'ropePushdown', 'triceps', 'skullCrusher', 'dbTriceps', 'dipMachine', 'closePushup', 'kickback'],
      calves: ['machineCalf', 'legPressCalf', 'seatedCalf', 'singleCalf', 'calf'],
      core: ['cableAbs', 'hangingRaise', 'abWheel', 'deadBug', 'pallof', 'sidePlank', 'abs'],
      chestIsolation: ['cableFly', 'pecDeck', 'lowCableFly', 'highCableFly', 'dbFly'],
    },
  };
  const BEGINNER_FRIENDLY = new Set(['gobletSquat', 'legpress', 'bodySquat', 'smithSquat', 'dbBench', 'chestPress', 'pushup', 'cableRow', 'chestSupportedRow', 'machineRow', 'dbRow', 'dbOhp', 'machinePress', 'landminePress', 'pulldown', 'assistedPullup', 'bandPulldown', 'dbRdl', 'gluteBridge', 'backExtension', 'reverseLunge', 'splitSquat', 'singleLegPress', 'legcurl', 'seatedLegcurl', 'lyingLegcurl', 'legext', 'lateral', 'cableLateral', 'machineLateral', 'facepull', 'reversePecDeck', 'curl', 'cableCurl', 'ropePushdown', 'triceps', 'calf', 'machineCalf', 'deadBug', 'pallof', 'abs', 'cableAbs', 'pecDeck', 'cableFly']);
  const HIGH_SKILL = new Set(['deadlift', 'goodMorning', 'kettlebellSwing', 'nordicCurl', 'sissySquat', 'reverseNordic', 'dip', 'abWheel', 'walkingLunge']);
  const HIGH_FATIGUE = new Set(['deadlift', 'squat', 'frontSquat', 'goodMorning', 'walkingLunge']);
  const STABLE_LOADING = new Set(['legpress', 'hackSquat', 'pendulumSquat', 'beltSquat', 'smithSquat', 'chestPress', 'inclineChestPress', 'smithBench', 'cableRow', 'machineRow', 'chestSupportedRow', 'machinePress', 'smithOhp', 'pulldown', 'assistedPullup', 'smithHipThrust', 'singleLegPress', 'seatedLegcurl', 'lyingLegcurl', 'legcurl', 'legext', 'machineLateral', 'cableLateral', 'reversePecDeck', 'cableRearDelt', 'preacherCurl', 'cableCurl', 'ropePushdown', 'overheadCableTriceps', 'machineCalf', 'seatedCalf', 'cableAbs', 'pecDeck', 'cableFly']);

  function ex(name, pattern, muscle, secondary, compound, requires, style, increment) {
    return { name, pattern, muscle, secondary, compound, requires, style, increment };
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function load() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve({ ...structuredClone(DEFAULT_STATE), ...(request.result || {}) });
      request.onerror = () => reject(request.error);
    });
  }

  async function save() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
  function escapeText(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function round(value, step = 0.5) { return Math.round(value / step) * step; }
  function checkedValues(name) { return $$(`[name="${name}"]:checked`).map((input) => input.value); }
  function splitName(split) { return ({ fullbody: 'Full Body', upperlower: 'Upper / Lower', hybrid: 'Upper / Lower + PPL', ppl: 'Push / Pull / Legs' })[split] || split; }

  function levelFromExperience(months, consistency = 'steady2', technique = 'basic') {
    if (months < 6 || consistency === 'starting' || technique === 'learning') return 'beginner';
    if (months < 36 || consistency === 'irregular' || technique !== 'confident') return 'intermediate';
    return 'advanced';
  }

  function ageGroupFromAge(age) {
    if (age < 16) return 'under16';
    if (age < 18) return 'teen';
    if (age < 40) return 'adult';
    if (age < 65) return 'midlife';
    return 'older';
  }

  function ageForLegacyGroup(group) {
    return ({ under16: 15, teen: 17, adult: 30, midlife: 50, older: 67 })[group] || 18;
  }

  function normalizeProfile(profile = {}) {
    const experienceMonths = Number(profile.experienceMonths) || 0;
    const consistency = profile.consistency || (experienceMonths ? 'steady2' : 'starting');
    const technique = profile.technique || (experienceMonths >= 12 ? 'basic' : 'learning');
    return {
      consistency, technique, movementFocus: [], activityLoad: 'none', activityTypes: [], activityDays: [], loadIncrement: 2.5,
      units: 'metric', age: ageForLegacyGroup(profile.ageGroup), sex: '', heightCm: null, weightKg: null, weightTrend: 'stable', dailyMovement: 'average', bodyGoal: 'recomp',
      style: 'mixed', variety: 'balanced', likes: [], stress: 'normal', priorities: [], availableDays: [], equipment: [], avoidPatterns: [], dislikes: [],
      ...profile,
      experienceMonths,
      age: Number(profile.age) || ageForLegacyGroup(profile.ageGroup),
      ageGroup: ageGroupFromAge(Number(profile.age) || ageForLegacyGroup(profile.ageGroup)),
      heightCm: Number(profile.heightCm) || null,
      weightKg: Number(profile.weightKg) || null,
      injury: profile.injury === 'yes' ? 'managed' : (profile.injury || 'no'),
      level: levelFromExperience(experienceMonths, consistency, technique),
      startingConservative: ['starting', 'irregular'].includes(consistency) || technique === 'learning',
      priorities: profile.priorities || [], movementFocus: profile.movementFocus || [], availableDays: profile.availableDays || [],
      equipment: profile.equipment || [], activityTypes: profile.activityTypes || [], activityDays: (profile.activityDays || []).map(Number).filter((day) => day >= 0 && day <= 6), likes: profile.likes || [],
      avoidPatterns: profile.avoidPatterns || [], dislikes: profile.dislikes || [],
    };
  }

  function experienceSelectValue(months) {
    if (months <= 0) return '0';
    if (months < 6) return '3';
    if (months < 12) return '6';
    if (months < 30) return '18';
    if (months < 54) return '36';
    return '60';
  }

  function applyEquipmentPreset(preset) {
    const selected = EQUIPMENT_PRESETS[preset] || [];
    $$('[name="trainingEquipment"]').forEach((input) => { input.checked = selected.includes(input.value); });
    renderAllExercisePickers();
  }

  function enforceChoiceLimit(name, limit, changed) {
    const selected = $$(`[name="${name}"]:checked`);
    if (selected.length > limit && changed) changed.checked = false;
    const full = $$(`[name="${name}"]:checked`).length >= limit;
    $$(`[name="${name}"]`).forEach((input) => { input.disabled = full && !input.checked; });
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function initializeCardSelects() {
    $$('select[data-card-select]').forEach((select) => {
      if (select.dataset.cardsReady === 'true') return;
      select.dataset.cardsReady = 'true';
      select.classList.add('card-select-source');
      const options = document.createElement('div');
      options.className = 'card-options';
      options.dataset.columns = select.dataset.cardColumns || '2';
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', select.closest('.onboarding-question, label')?.querySelector('label, strong')?.textContent?.trim() || 'Choix');
      [...select.options].forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card-option';
        button.dataset.value = option.value;
        button.textContent = option.textContent;
        button.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncCardSelect(select);
        });
        options.append(button);
      });
      select.after(options);
      syncCardSelect(select);
    });
  }

  function syncCardSelect(select) {
    const container = select?.nextElementSibling;
    if (!container?.classList.contains('card-options')) return;
    [...container.children].forEach((button) => {
      const selected = button.dataset.value === select.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function syncAllCardSelects() { $$('select[data-card-select]').forEach(syncCardSelect); }

  function equipmentSummary(item) {
    if (!item.requires.length) return 'Sans matériel';
    return item.requires.map((key) => EQUIPMENT_LABELS[key] || key).join(' + ');
  }

  function equipmentCompatible(item, profileOrEquipment) {
    const values = profileOrEquipment instanceof Set ? profileOrEquipment : Array.isArray(profileOrEquipment) ? profileOrEquipment : profileOrEquipment?.equipment;
    const equipment = values instanceof Set ? values : new Set(values || []);
    return item.requires.every((requirement) => equipment.has(requirement));
  }

  function exerciseSearchText(id, item) {
    return normalizeSearch([id, item.name, MUSCLES[item.muscle], item.pattern, equipmentSummary(item), ...(EXERCISE_ALIASES[id] || [])].join(' '));
  }

  function selectedExercises(kind) {
    const config = EXERCISE_PICKERS[kind];
    return config ? checkedValues(config.name).filter((id) => EX[id]) : [];
  }

  function setExerciseSelections(kind, ids = []) {
    const config = EXERCISE_PICKERS[kind];
    if (!config) return;
    const selected = $(config.selectedId);
    if (!selected) return;
    selected.innerHTML = '';
    [...new Set(ids)].filter((id) => EX[id]).slice(0, config.max).forEach((id) => {
      const input = document.createElement('input');
      input.type = 'checkbox'; input.name = config.name; input.value = id; input.checked = true; input.hidden = true;
      const chip = document.createElement('div'); chip.className = 'exercise-selection';
      const label = document.createElement('span'); label.textContent = EX[id].name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.removeExercise = id; remove.setAttribute('aria-label', `Retirer ${EX[id].name}`); remove.textContent = '×';
      chip.append(input, label, remove); selected.append(chip);
    });
    renderExercisePicker(kind);
  }

  function toggleExerciseSelection(kind, id) {
    const config = EXERCISE_PICKERS[kind];
    if (!config || !EX[id]) return;
    const ids = selectedExercises(kind);
    const removing = ids.includes(id);
    if (!removing && ids.length >= config.max) {
      showOnboardingError(`Tu peux choisir au maximum ${config.max} exercice${config.max > 1 ? 's' : ''} ici.`);
      return;
    }
    const next = removing ? ids.filter((value) => value !== id) : [...ids, id];
    if (!removing && kind === 'likes' && selectedExercises('dislikes').includes(id)) setExerciseSelections('dislikes', selectedExercises('dislikes').filter((value) => value !== id));
    if (!removing && kind === 'dislikes' && selectedExercises('likes').includes(id)) setExerciseSelections('likes', selectedExercises('likes').filter((value) => value !== id));
    setExerciseSelections(kind, next);
    $(config.selectedId)?.dispatchEvent(new Event('change', { bubbles: true }));
    showOnboardingError('');
  }

  function renderExercisePicker(kind) {
    const config = EXERCISE_PICKERS[kind];
    if (!config || !$(config.resultsId)) return;
    const selected = selectedExercises(kind);
    const query = normalizeSearch($(config.searchId)?.value);
    const equipment = new Set(checkedValues('trainingEquipment'));
    let matches = Object.entries(EX).filter(([id, item]) => !query || exerciseSearchText(id, item).includes(query));
    matches.sort(([idA, a], [idB, b]) => {
      const availableA = equipmentCompatible(a, equipment);
      const availableB = equipmentCompatible(b, equipment);
      return Number(availableB) - Number(availableA) || Number(b.compound) - Number(a.compound) || a.name.localeCompare(b.name, 'fr');
    });
    const results = $(config.resultsId);
    results.innerHTML = '';
    if (!matches.length) {
      results.innerHTML = '<div class="exercise-catalog-note">Aucun résultat. Essaie un nom plus court, en français ou en anglais.</div>';
      return;
    }
    matches.forEach(([id, item]) => {
      const available = equipmentCompatible(item, equipment);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'exercise-option'; button.dataset.exerciseId = id;
      button.classList.toggle('selected', selected.includes(id));
      button.setAttribute('aria-pressed', String(selected.includes(id)));
      const title = document.createElement('b'); title.textContent = item.name;
      const meta = document.createElement('small'); meta.textContent = `${MUSCLES[item.muscle]} · ${equipmentSummary(item)}${available ? '' : ' · matériel non sélectionné'}`;
      button.append(title, meta); results.append(button);
    });
    const note = document.createElement('div'); note.className = 'exercise-catalog-note';
    note.textContent = `${matches.length} résultat${matches.length > 1 ? 's' : ''} sur ${Object.keys(EX).length} exercices · recherche français/anglais · les choix incompatibles avec ton matériel ne seront pas placés dans le plan.`;
    results.prepend(note);
  }

  function renderAllExercisePickers() { Object.keys(EXERCISE_PICKERS).forEach(renderExercisePicker); }

  function initializeExercisePickers() {
    Object.entries(EXERCISE_PICKERS).forEach(([kind, config]) => {
      $(config.searchId)?.addEventListener('input', () => renderExercisePicker(kind));
      $(config.resultsId)?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-exercise-id]');
        if (button) toggleExerciseSelection(kind, button.dataset.exerciseId);
      });
      $(config.selectedId)?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-exercise]');
        if (button) toggleExerciseSelection(kind, button.dataset.removeExercise);
      });
      renderExercisePicker(kind);
    });
  }

  function measurementValues() {
    const units = $('profileUnits').value;
    if (units === 'imperial') {
      const totalInches = Number($('profileHeightFeet').value) * 12 + Number($('profileHeightInches').value);
      return { units, heightCm: totalInches * 2.54, weightKg: Number($('profileWeightLb').value) / 2.2046226218 };
    }
    return { units, heightCm: Number($('profileHeight').value), weightKg: Number($('profileWeight').value) };
  }

  function collectProfile() {
    const experienceMonths = Number($('trainingExperience').value);
    const consistency = $('trainingConsistency').value; const technique = $('trainingTechnique').value;
    const measurements = measurementValues();
    return normalizeProfile({
      name: $('localProfileName').value.trim(), age: Number($('profileAge').value), sex: $('profileSex').value,
      units: measurements.units, heightCm: measurements.heightCm, weightKg: measurements.weightKg, weightTrend: $('profileWeightTrend').value,
      dailyMovement: $('profileDailyMovement').value, bodyGoal: $('bodyGoal').value,
      experienceMonths, consistency, technique, level: levelFromExperience(experienceMonths, consistency, technique), goal: $('trainingGoal').value,
      priorities: checkedValues('trainingPriority'), movementFocus: checkedValues('trainingMovementFocus'), days: Number($('trainingDays').value),
      availableDays: checkedValues('trainingWeekday').map(Number), maxMinutes: Number($('trainingMinutes').value),
      maxConsecutive: Number($('trainingMaxConsecutive').value), equipmentPreset: $('trainingEquipmentPreset').value,
      equipment: checkedValues('trainingEquipment'), loadIncrement: Number($('trainingLoadIncrement').value),
      activityLoad: $('trainingActivityLoad').value, activityTypes: checkedValues('trainingActivityType'), activityDays: checkedValues('trainingActivityDay').map(Number),
      style: $('trainingStyle').value, variety: $('trainingVariety').value, likes: checkedValues('trainingLike'),
      recovery: $('trainingRecovery').value, sleep: $('trainingSleep').value, stress: $('trainingStress').value, injury: $('trainingInjury').value,
      avoidPatterns: checkedValues('trainingAvoid'), dislikes: checkedValues('trainingDislike'),
    });
  }

  function fillProfile(profile) {
    if (!profile) { applyEquipmentPreset($('trainingEquipmentPreset').value); setExerciseSelections('focus', []); setExerciseSelections('likes', []); setExerciseSelections('dislikes', []); updateConditionalQuestions(); return; }
    profile = normalizeProfile(profile);
    const fields = {
      localProfileName: profile.name, profileUnits: profile.units, profileAge: profile.age, profileSex: profile.sex, profileHeight: round(profile.heightCm, 0.1), profileWeight: round(profile.weightKg, 0.1),
      profileWeightTrend: profile.weightTrend, profileDailyMovement: profile.dailyMovement, bodyGoal: profile.bodyGoal,
      trainingExperience: experienceSelectValue(profile.experienceMonths),
      trainingConsistency: profile.consistency, trainingTechnique: profile.technique, trainingGoal: profile.goal,
      trainingDays: String(profile.days), trainingMinutes: String(profile.maxMinutes), trainingActivityLoad: profile.activityLoad,
      trainingMaxConsecutive: String(profile.maxConsecutive), trainingEquipmentPreset: profile.equipment.includes('machines') ? 'custom' : profile.equipmentPreset,
      trainingLoadIncrement: String(profile.loadIncrement), trainingStyle: profile.style, trainingVariety: profile.variety,
      trainingRecovery: profile.recovery, trainingSleep: profile.sleep, trainingStress: profile.stress, trainingInjury: profile.injury,
    };
    Object.entries(fields).forEach(([id, value]) => { if ($(id) && value != null) $(id).value = value; });
    const totalInches = Number(profile.heightCm) / 2.54;
    $('profileHeightFeet').value = Math.floor(totalInches / 12) || '';
    $('profileHeightInches').value = round(totalInches % 12, 0.1) || '';
    $('profileWeightLb').value = round(Number(profile.weightKg) * 2.2046226218, 0.1) || '';
    const groups = { trainingPriority: profile.priorities, trainingWeekday: (profile.availableDays || []).map(String), trainingActivityType: profile.activityTypes, trainingActivityDay: (profile.activityDays || []).map(String), trainingEquipment: profile.equipment, trainingAvoid: profile.avoidPatterns };
    Object.entries(groups).forEach(([name, values]) => $$(`[name="${name}"]`).forEach((input) => { input.checked = (values || []).includes(input.value); }));
    setExerciseSelections('focus', profile.movementFocus);
    setExerciseSelections('likes', profile.likes);
    setExerciseSelections('dislikes', profile.dislikes);
    enforceChoiceLimit('trainingPriority', 2);
    updateConditionalQuestions(); syncAllCardSelects(); renderAllExercisePickers();
  }

  function showOnboardingError(message) {
    $('onboardingError').textContent = message;
    $('onboardingError').classList.toggle('hidden', !message);
  }

  function validateStep(step) {
    const profile = collectProfile();
    if (step === 0 && !profile.name) return 'Entre un prénom ou un pseudo.';
    if (step === 1 && (!Number.isFinite(profile.age) || profile.age < 13 || profile.age > 90)) return 'Entre un âge entre 13 et 90 ans.';
    if (step === 1 && !profile.sex) return 'Choisis l’option qui permettra d’estimer tes besoins énergétiques.';
    if (step === 1 && (!Number.isFinite(profile.heightCm) || profile.heightCm < 120 || profile.heightCm > 230)) return 'Entre une taille réaliste entre 120 et 230 cm.';
    if (step === 1 && (!Number.isFinite(profile.weightKg) || profile.weightKg < 30 || profile.weightKg > 300)) return 'Entre un poids réaliste entre 30 et 300 kg.';
    if (step === 4 && profile.availableDays.length < profile.days) return `Choisis au moins ${profile.days} jours disponibles.`;
    if (step === 5 && profile.activityLoad !== 'none' && !profile.activityTypes.length) return 'Choisis au moins un type d’activité, ou sélectionne « Aucune ou presque ».';
    if (step === 7 && profile.likes.some((id) => profile.dislikes.includes(id))) return 'Un même exercice ne peut pas être dans « J’aime » et « Je ne veux pas ».';
    if (step === 8 && profile.injury === 'managed' && !profile.avoidPatterns.length) return 'Choisis au moins un mouvement à éviter pour que MacroFlow puisse l’exclure.';
    if (step === 8 && profile.injury === 'unsure') return 'MacroFlow ne peut pas déterminer quels exercices sont sécuritaires avec une douleur inexpliquée. Demande d’abord l’avis d’un professionnel qualifié.';
    return '';
  }

  function roundTo(value, step) { return Math.round(value / step) * step; }

  function estimateNutrition(profile) {
    const engine = globalThis.MacroFlowNutrition;
    if (!engine?.estimatePlan) throw new Error('Moteur nutritionnel v30 indisponible');
    const plan = engine.estimatePlan(profile);
    const labels = BODY_GOALS[profile.bodyGoal];
    const rationales = [
      `Maintien initial estimé à environ ${plan.maintenanceCalories} kcal avec Mifflin–St Jeor et l’activité déclarée.`,
      `${plan.goals.protein} g de protéines (${plan.proteinFactor.toFixed(1).replace('.', ',')} g/kg) pour soutenir l’entraînement et la masse musculaire.`,
      `${plan.goals.fat} g de lipides comme plancher prudent; le reste favorise les glucides et la performance.`,
      'La moyenne du poids sur au moins deux semaines sert à corriger cette estimation; une seule pesée ne suffit pas.',
      ...(plan.warnings || []),
    ];
    return { ...plan, goalLabel: labels, rationales };
  }

  function renderReview() {
    const p = collectProfile();
    const nutrition = estimateNutrition(p);
    const equipmentText = p.equipment.length ? `${p.equipment.length} types d’équipement` : 'Poids du corps';
    const favorites = p.likes.length ? p.likes.map((id) => EX[id]?.name).filter(Boolean).join(' · ') : 'Aucun choix imposé';
    const measures = p.units === 'imperial' ? `${round(p.weightKg * 2.2046226218, 0.1)} lb` : `${round(p.weightKg, 0.1)} kg`;
    $('onboardingReview').innerHTML = `<strong>${escapeText(p.name)} · ${LEVELS[p.level]}${p.startingConservative ? ' · départ prudent' : ''}</strong><small>${GOALS[p.goal]} · ${p.days} séances de ${p.maxMinutes} min maximum · ${measures}</small><div class="plan-explainer"><div class="plan-stat"><strong>${p.availableDays.map((day) => WEEKDAYS[day].slice(0, 3)).join(' · ')}</strong><small>Jours possibles</small></div><div class="plan-stat"><strong>${equipmentText}</strong><small>Exercices filtrés</small></div><div class="plan-stat"><strong>${ACTIVITY_LOADS[p.activityLoad]}</strong><small>Autres activités</small></div><div class="plan-stat"><strong>${p.priorities.length ? p.priorities.map((muscle) => MUSCLES[muscle]).join(' · ') : 'Équilibré'}</strong><small>Priorités</small></div></div><div class="onboarding-note"><strong>Exercices favoris</strong><br>${escapeText(favorites)}${p.movementFocus.length ? `<br><strong>Progression prioritaire</strong><br>${escapeText(p.movementFocus.map((id) => EX[id]?.name).filter(Boolean).join(' · '))}` : ''}${p.activityDays.length ? `<br><strong>Jours d’activités externes</strong><br>${escapeText(p.activityDays.map((day) => WEEKDAYS[day]).join(' · '))}` : ''}</div><div class="nutrition-preview"><span class="eyebrow">Objectifs nutritionnels proposés</span><strong>${nutrition.goals.calories} kcal</strong><div class="nutrition-macros"><span>P ${nutrition.goals.protein} g</span><span>G ${nutrition.goals.carbs} g</span><span>L ${nutrition.goals.fat} g</span></div><small>${escapeText(nutrition.goalLabel)} · maintien estimé ${nutrition.maintenanceCalories} kcal</small><small>${escapeText(nutrition.rateText)}</small></div>${p.injury !== 'no' ? '<div class="training-alert">Une douleur qui modifie ton entraînement mérite l’avis d’un professionnel qualifié. MacroFlow peut exclure des mouvements, mais ne peut pas déterminer lesquels sont sécuritaires ni poser un diagnostic.</div>' : ''}${['under16', 'teen'].includes(p.ageGroup) ? '<div class="training-alert">Pour un jeune, le plan privilégiera la technique, une marge de répétitions et la supervision. Il ne demandera pas de test maximal ni de changement de poids agressif.</div>' : ''}`;
  }

  function renderOnboarding() {
    $$('[data-onboarding-step]').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.onboardingStep) === onboardingStep));
    const percent = (onboardingStep + 1) * 10;
    $('onboardingProgressLabel').textContent = ONBOARDING_LABELS[onboardingStep];
    $('onboardingProgressPercent').textContent = `${percent} %`;
    $('onboardingProgressFill').style.width = `${percent}%`;
    $('onboardingProgress').setAttribute('aria-valuenow', String(onboardingStep + 1));
    $('onboardingBackBtn').style.visibility = onboardingStep === 0 ? 'hidden' : 'visible';
    $('onboardingNextBtn').textContent = onboardingStep === 9 ? 'Créer mon plan complet' : 'Continuer';
    if (onboardingStep === 9) renderReview();
    updateConditionalQuestions();
    syncAllCardSelects();
    if ([3, 7].includes(onboardingStep)) renderAllExercisePickers();
    showOnboardingError('');
    $('trainingOnboarding').scrollTo({ top: 0, behavior: 'auto' });
  }

  function updateConditionalQuestions() {
    const imperial = $('profileUnits')?.value === 'imperial';
    $('metricMeasurements')?.classList.toggle('hidden', imperial);
    $('imperialMeasurements')?.classList.toggle('hidden', !imperial);
    $('activityTypesQuestion')?.classList.toggle('hidden', $('trainingActivityLoad').value === 'none');
    $('activityDaysQuestion')?.classList.toggle('hidden', $('trainingActivityLoad').value === 'none');
    $('trainingAvoidQuestion')?.classList.toggle('hidden', $('trainingInjury').value !== 'managed');
    syncAllCardSelects();
  }

  function openOnboarding() {
    onboardingStep = data.program ? 0 : Math.max(0, Math.min(9, Number(data.onboardingStep) || 0));
    fillProfile(data.draftProfile || data.profile);
    $('onboardingCloseBtn').classList.toggle('hidden', !data.program);
    $('trainingOnboarding').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderOnboarding();
  }

  let draftSaveTimer = null;
  function saveDraft() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      data.draftProfile = collectProfile();
      data.onboardingStep = onboardingStep;
      save().catch((error) => console.warn('Questionnaire draft could not be saved', error));
    }, 150);
  }

  function closeOnboarding() {
    if (!data.program) return;
    $('trainingOnboarding').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function chooseSchedule(available, count, maxConsecutive) {
    const ordered = [1, 2, 3, 4, 5, 6, 0].filter((day) => available.includes(day));
    const choices = combinations(ordered, count);
    let best = choices[0] || ordered.slice(0, count);
    let bestScore = -Infinity;
    for (const choice of choices) {
      const indexes = choice.map((day) => day === 0 ? 6 : day - 1).sort((a, b) => a - b);
      const active = Array.from({ length: 7 }, (_, index) => indexes.includes(index));
      let longest = 0;
      for (let start = 0; start < 7; start += 1) {
        let streak = 0;
        while (streak < 7 && active[(start + streak) % 7]) streak += 1;
        longest = Math.max(longest, streak);
      }
      const gaps = indexes.map((value, index) => (indexes[(index + 1) % indexes.length] - value + 7) % 7).filter(Boolean);
      const minimumGap = gaps.length ? Math.min(...gaps) : 7;
      const score = (longest > maxConsecutive ? -100 * (longest - maxConsecutive) : 0) + minimumGap * 8 - longest;
      if (score > bestScore) { best = choice; bestScore = score; }
    }
    return [1, 2, 3, 4, 5, 6, 0].filter((day) => best.includes(day));
  }

  function combinations(values, count, start = 0, prefix = [], result = []) {
    if (prefix.length === count) { result.push(prefix); return result; }
    for (let index = start; index <= values.length - (count - prefix.length); index += 1) combinations(values, count, index + 1, [...prefix, values[index]], result);
    return result;
  }

  function templateFor(rawProfile) {
    const profile = typeof rawProfile === 'number' ? { days: rawProfile } : normalizeProfile(rawProfile);
    const days = Number(profile.days) || 3;
    if (days === 2) return { split: 'fullbody', rows: TEMPLATES.fullbody2, reason: 'Deux expositions complètes maximisent la couverture avec seulement deux séances.' };
    if (days === 3) return { split: 'fullbody', rows: TEMPLATES.fullbody3, reason: 'Trois journées complètes distribuent les grands mouvements sans réserver un muscle à une seule séance.' };
    if (days === 4) return { split: 'upperlower', rows: TEMPLATES.upperlower, reason: profile.goal === 'general' ? 'L’alternance Upper/Lower garde les séances simples et laisse plusieurs jours entre deux sollicitations principales du même groupe.' : 'Deux expositions Upper et deux Lower permettent de répartir le volume avec plusieurs jours entre les mêmes muscles.' };
    if (days === 5) return { split: 'hybrid', rows: TEMPLATES.hybrid, reason: 'Le format hybride conserve deux expositions principales par groupe sans transformer chaque séance en marathon.' };
    return { split: 'ppl', rows: TEMPLATES.ppl, reason: 'Deux cycles Push, Pull et Legs répartissent six séances sans répéter le même groupe lourd deux jours de suite.' };
  }

  function rowStress(patterns = []) {
    const stress = {};
    for (const pattern of patterns) for (const [muscle, value] of Object.entries(PATTERN_STRESS[pattern] || {})) stress[muscle] = (stress[muscle] || 0) + value;
    return stress;
  }

  function activityStress(profile) {
    const stress = {};
    for (const type of profile.activityTypes || []) for (const [muscle, value] of Object.entries(ACTIVITY_STRESS[type] || {})) stress[muscle] = Math.max(stress[muscle] || 0, value);
    return stress;
  }

  function stressOverlap(first = {}, second = {}) {
    return Object.keys(first).reduce((sum, muscle) => sum + Math.min(first[muscle] || 0, second[muscle] || 0), 0);
  }

  function weekdayIndex(day) { return Number(day) === 0 ? 6 : Number(day) - 1; }

  function sequenceVariants(rows) {
    const variants = [];
    for (let offset = 0; offset < rows.length; offset += 1) variants.push([...rows.slice(offset), ...rows.slice(0, offset)]);
    return variants;
  }

  function longestTrainingRun(schedule) {
    const active = Array.from({ length: 7 }, (_, index) => schedule.some((day) => weekdayIndex(day) === index));
    let longest = 0;
    for (let start = 0; start < 7; start += 1) {
      let run = 0;
      while (run < 7 && active[(start + run) % 7]) run += 1;
      longest = Math.max(longest, run);
    }
    return longest;
  }

  function layoutScore(schedule, rows, rawProfile) {
    const profile = normalizeProfile(rawProfile);
    const sessions = schedule.map((weekday, index) => ({ weekday, index: weekdayIndex(weekday), stress: rowStress(rows[index]?.[1]), name: rows[index]?.[0] }));
    const recoverySensitive = profile.recovery === 'variable' || profile.sleep === 'under6' || profile.stress === 'high' || profile.startingConservative;
    let score = 0;
    const longest = longestTrainingRun(schedule);
    if (longest > profile.maxConsecutive) score -= (longest - profile.maxConsecutive) * 900;
    score -= longest * 2;
    for (let index = 0; index < sessions.length; index += 1) {
      const current = sessions[index]; const next = sessions[(index + 1) % sessions.length];
      const gap = (next.index - current.index + 7) % 7 || 7;
      const overlap = stressOverlap(current.stress, next.stress);
      if (gap === 1) score -= overlap * (recoverySensitive ? 34 : 24);
      else if (gap === 2) score -= overlap * (recoverySensitive ? 7 : 3);
      else score += Math.min(gap, 4) * 1.5;
    }
    const external = activityStress(profile); const activityDays = new Set(profile.activityDays || []);
    const activityFactor = ({ light: 5, moderate: 10, high: 16 })[profile.activityLoad] || 0;
    if (activityFactor && activityDays.size) for (const session of sessions) {
      const same = activityDays.has(session.weekday); const previous = activityDays.has((session.weekday + 6) % 7); const next = activityDays.has((session.weekday + 1) % 7);
      const overlap = stressOverlap(session.stress, external);
      if (same) score -= overlap * activityFactor;
      if (previous) score -= overlap * activityFactor * .7;
      if (next) score -= overlap * activityFactor * .35;
    }
    return score;
  }

  function buildWeeklyLayout(rawProfile, rows) {
    const profile = normalizeProfile(rawProfile);
    const ordered = [1, 2, 3, 4, 5, 6, 0].filter((day) => profile.availableDays.includes(day));
    const scheduleOptions = combinations(ordered, Number(profile.days)) || [];
    const schedules = scheduleOptions.length ? scheduleOptions : [chooseSchedule(profile.availableDays, profile.days, profile.maxConsecutive)];
    let best = null;
    for (const schedule of schedules) for (const sequence of sequenceVariants(rows)) {
      const score = layoutScore(schedule, sequence, profile);
      const key = `${schedule.map(weekdayIndex).join('')}:${sequence.map((row) => row[0]).join('|')}`;
      if (!best || score > best.score || (score === best.score && key.localeCompare(best.key, 'fr') < 0)) best = { schedule, rows: sequence, score, key };
    }
    return {
      schedule: best?.schedule || [], rows: best?.rows || rows, score: Math.round((best?.score || 0) * 10) / 10,
      activityAware: profile.activityLoad !== 'none' && profile.activityDays.length > 0,
      maxConsecutive: longestTrainingRun(best?.schedule || []),
    };
  }

  function patternAvoided(pattern, profile) {
    if (profile.avoidPatterns.includes(pattern)) return true;
    if (profile.avoidPatterns.includes('knee') && ['knee', 'unilateral', 'quadIsolation'].includes(pattern)) return true;
    if (profile.avoidPatterns.includes('hinge') && ['hinge', 'hamstringIsolation'].includes(pattern)) return true;
    return false;
  }

  function activityFatiguedMuscles(profile) {
    const muscles = new Set(); const types = new Set(profile.activityTypes || []);
    if (['running', 'team', 'combat', 'physicalWork'].some((type) => types.has(type))) ['quads', 'glutes', 'hamstrings', 'calves'].forEach((muscle) => muscles.add(muscle));
    if (types.has('cycling')) ['quads', 'glutes', 'calves'].forEach((muscle) => muscles.add(muscle));
    if (types.has('climbing')) ['back', 'arms', 'shoulders'].forEach((muscle) => muscles.add(muscle));
    return muscles;
  }

  function preferenceRank(pattern, id, profile) {
    const lists = pattern in EXERCISE_PREFERENCES.accessory
      ? [EXERCISE_PREFERENCES.accessory[pattern]]
      : profile.goal === 'balanced'
        ? [EXERCISE_PREFERENCES.strength[pattern], EXERCISE_PREFERENCES.hypertrophy[pattern]]
        : [EXERCISE_PREFERENCES[profile.goal]?.[pattern] || EXERCISE_PREFERENCES.general[pattern]];
    return lists.reduce((total, list) => {
      const index = (list || []).indexOf(id);
      return total + (index < 0 ? 0 : Math.max(4, 28 - index * 3)) / lists.length;
    }, 0);
  }

  function exerciseQualityScore(id, item, profile) {
    let score = 45 + preferenceRank(item.pattern, id, profile);
    const novice = profile.level === 'beginner' || profile.startingConservative;
    if (profile.goal === 'strength' && item.compound) score += 8;
    if (profile.goal === 'hypertrophy' && STABLE_LOADING.has(id)) score += 7;
    if (profile.goal === 'general' && BEGINNER_FRIENDLY.has(id)) score += 7;
    if (novice) score += BEGINNER_FRIENDLY.has(id) ? 15 : 0;
    if (novice && HIGH_SKILL.has(id)) score -= 24;
    if ((profile.startingConservative || profile.recovery === 'variable' || profile.sleep === 'under6' || profile.stress === 'high') && HIGH_FATIGUE.has(id)) score -= 12;
    if (['older', 'under16', 'teen'].includes(profile.ageGroup) && HIGH_SKILL.has(id)) score -= 8;
    if (profile.style !== 'mixed' && item.style === profile.style) score += 6;
    if (profile.variety === 'stable' && STABLE_LOADING.has(id)) score += 4;
    if (profile.likes.includes(id)) score += 18;
    if (profile.movementFocus.includes(id)) score += 42;
    return Math.round(score);
  }

  function selectionReason(id, item, profile, trainingRole = '') {
    if (profile.movementFocus.includes(id)) return 'Mouvement prioritaire choisi dans ton profil';
    if (profile.likes.includes(id)) return 'Exercice apprécié et compatible avec le rôle prévu';
    if ((profile.level === 'beginner' || profile.startingConservative) && BEGINNER_FRIENDLY.has(id)) return 'Stable, simple à apprendre et facile à faire progresser';
    if (profile.goal === 'strength' && trainingRole === 'main') return 'Mouvement principal placé tôt pour développer la force';
    if (profile.goal === 'strength' && item.compound) return 'Exercice de soutien pour construire de la force sans tout charger lourd';
    if (profile.goal === 'hypertrophy' && STABLE_LOADING.has(id)) return 'Bon stimulus musculaire avec progression facile à mesurer';
    if (profile.goal === 'general') return 'Choix efficace, accessible et durable';
    return 'Variante efficace et compatible avec ton profil';
  }

  function chooseExercise(pattern, profile, dayIndex, used, weeklyUses = new Map()) {
    if (patternAvoided(pattern, profile)) return null;
    const available = Object.entries(EX).filter(([id, item]) => item.pattern === pattern && equipmentCompatible(item, profile) && !used.has(id) && !profile.dislikes.includes(id));
    if (!available.length) return null;
    const ranked = available.map(([id, item]) => {
      const repeatedHighFatigue = HIGH_FATIGUE.has(id) && (weeklyUses.get(id) || 0) > 0 && !profile.movementFocus.includes(id);
      return [id, item, exerciseQualityScore(id, item, profile) - (repeatedHighFatigue ? 22 : 0)];
    }).sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name, 'fr'));
    const qualityPool = ranked.filter((entry) => entry[2] >= ranked[0][2] - 10);
    const variantCount = profile.variety === 'stable' ? 1 : profile.variety === 'varied' ? Math.min(3, qualityPool.length) : Math.min(2, qualityPool.length);
    return qualityPool[dayIndex % Math.max(1, variantCount)] || ranked[0];
  }

  function exerciseConfig(id, item, order, profile, qualityScore = exerciseQualityScore(id, item, profile)) {
    let sets = item.compound ? (profile.level === 'beginner' || profile.startingConservative ? 2 : 3) : 2;
    if (profile.level === 'advanced' && profile.goal === 'hypertrophy' && !item.compound) sets = 3;
    if ((profile.sleep === 'under6' || profile.recovery === 'variable' || profile.stress === 'high') && !item.compound) sets = Math.max(1, sets - 1);
    if (profile.activityLoad === 'high' && activityFatiguedMuscles(profile).has(item.muscle)) sets = Math.max(item.compound ? 2 : 1, sets - 1);
    const strengthMain = profile.goal === 'strength' && item.compound && (profile.movementFocus.includes(id) || order <= 1) && item.pattern !== 'unilateral';
    const trainingRole = strengthMain ? 'main' : item.compound ? 'compoundSupport' : 'accessory';
    let minRep; let maxRep;
    if (profile.goal === 'strength') { minRep = strengthMain ? 4 : item.compound ? 6 : 8; maxRep = strengthMain ? 6 : item.compound ? 10 : 12; }
    else if (profile.goal === 'hypertrophy') { minRep = item.compound ? 6 : 10; maxRep = item.compound ? 10 : 15; }
    else if (profile.goal === 'general') { minRep = item.compound ? 8 : 10; maxRep = item.compound ? 12 : 15; }
    else { minRep = item.compound ? 5 : 8; maxRep = item.compound ? 8 : 12; }
    const restSeconds = strengthMain ? 180 : item.compound ? 150 : 90;
    const youth = ['under16', 'teen'].includes(profile.ageGroup);
    const increment = item.increment > 0 ? Math.max(item.increment, Number(profile.loadIncrement) || 0) : 0;
    return { id, ...item, increment, sets, minRep, maxRep, restSeconds, targetRir: youth || profile.level === 'beginner' || profile.startingConservative ? 3 : 2, order, priorityBoost: false, qualityScore, trainingRole, selectionReason: selectionReason(id, item, profile, trainingRole) };
  }

  function warmupSetCount(exercise, profile) {
    if (!exercise.compound || exercise.style === 'bodyweight' || Number(exercise.increment) === 0) return 0;
    if (exercise.trainingRole === 'main') {
      if (profile.goal === 'strength') return profile.level === 'advanced' ? 3 : profile.level === 'intermediate' ? 2 : 1;
      return profile.level === 'advanced' ? 2 : 1;
    }
    return exercise.trainingRole === 'compoundSupport' && ['free', 'machines'].includes(exercise.style) ? 1 : 0;
  }

  function durationBreakdown(exercises, rawProfile = {}) {
    const profile = normalizeProfile(rawProfile);
    const generalWarmupSeconds = profile.goal === 'strength' || ['older', 'under16', 'teen'].includes(profile.ageGroup) ? 360 : 300;
    let setupSeconds = 0; let workSeconds = 0; let restSeconds = 0; let rampSeconds = 0; let warmupSets = 0;
    exercises.forEach((exercise, index) => {
      const requirements = new Set(exercise.requires || []);
      const barbellSetup = requirements.has('barbell') || requirements.has('rack') || requirements.has('smith');
      const machineSetup = [...requirements].some((requirement) => requirement.startsWith('machine_')) || requirements.has('cable');
      setupSeconds += (index ? 55 : 25) + (barbellSetup ? 105 : machineSetup ? 70 : requirements.size ? 55 : 35);
      const averageReps = Math.max(5, (Number(exercise.minRep || 8) + Number(exercise.maxRep || 12)) / 2);
      workSeconds += Number(exercise.sets || 0) * (16 + averageReps * 3.2);
      restSeconds += Math.max(0, Number(exercise.sets || 0) - 1) * Number(exercise.restSeconds || 90);
      const ramps = warmupSetCount(exercise, profile); warmupSets += ramps;
      rampSeconds += ramps * (35 + (exercise.trainingRole === 'main' ? 75 : 50));
    });
    const activeSeconds = generalWarmupSeconds + setupSeconds + workSeconds + restSeconds + rampSeconds;
    const bufferSeconds = Math.max(120, activeSeconds * 0.08);
    const lowMinutes = Math.max(10, Math.floor((activeSeconds + bufferSeconds * 0.45) / 300) * 5);
    const highMinutes = Math.max(lowMinutes + 5, Math.ceil((activeSeconds + bufferSeconds * 1.35) / 300) * 5);
    return {
      lowMinutes, highMinutes, warmupSets,
      generalWarmupMinutes: Math.round(generalWarmupSeconds / 60),
      setupMinutes: Math.round(setupSeconds / 60), workMinutes: Math.round(workSeconds / 60),
      restMinutes: Math.round(restSeconds / 60), rampMinutes: Math.round(rampSeconds / 60), bufferMinutes: Math.round(bufferSeconds / 60),
    };
  }

  function estimateMinutes(exercises, profile = {}) { return durationBreakdown(exercises, profile).highMinutes; }

  function fitToTime(exercises, maxMinutes, profile) {
    const adjustments = []; let guard = 0; const minimumExercises = Number(maxMinutes) <= 30 || Number(profile.days) >= 5 ? 2 : 3;
    while (estimateMinutes(exercises, profile) > maxMinutes && guard < 40) {
      guard += 1;
      const reducibleAccessory = [...exercises].reverse().find((exercise) => !exercise.compound && !exercise.priorityBoost && exercise.sets > 2);
      if (reducibleAccessory) { reducibleAccessory.sets -= 1; adjustments.push(`1 série retirée de ${reducibleAccessory.name}`); continue; }
      const removableAccessory = [...exercises].map((exercise, index) => ({ exercise, index })).reverse().find(({ exercise }) => !exercise.compound && !exercise.priorityBoost && exercises.length > minimumExercises);
      if (removableAccessory) { adjustments.push(`${removableAccessory.exercise.name} retiré`); exercises.splice(removableAccessory.index, 1); continue; }
      const reducibleSupport = [...exercises].reverse().find((exercise) => exercise.trainingRole === 'compoundSupport' && !exercise.priorityBoost && exercise.sets > 2);
      if (reducibleSupport) { reducibleSupport.sets -= 1; adjustments.push(`1 série retirée de ${reducibleSupport.name}`); continue; }
      const removableSupport = [...exercises].map((exercise, index) => ({ exercise, index })).reverse().find(({ exercise }) => exercise.trainingRole === 'compoundSupport' && !exercise.priorityBoost && exercises.length > minimumExercises);
      if (removableSupport) { adjustments.push(`${removableSupport.exercise.name} retiré`); exercises.splice(removableSupport.index, 1); continue; }
      const reducibleMain = [...exercises].reverse().find((exercise) => !exercise.priorityBoost && exercise.sets > 2);
      if (reducibleMain) { reducibleMain.sets -= 1; adjustments.push(`1 série retirée de ${reducibleMain.name}`); continue; }
      break;
    }
    return { exercises, adjustments };
  }

  function updateDayDuration(day, profile) {
    const duration = durationBreakdown(day.exercises, profile);
    day.duration = duration; day.estimatedMinutes = duration.highMinutes; day.estimatedRange = { low: duration.lowMinutes, high: duration.highMinutes };
    return day;
  }

  function dayDuration(day, profile) {
    if (day?.duration?.lowMinutes && day?.duration?.highMinutes) return day.duration;
    return durationBreakdown(day?.exercises || [], profile);
  }

  function durationLabel(day, profile) {
    const duration = dayDuration(day, profile);
    return `${duration.lowMinutes}–${duration.highMinutes} min`;
  }

  function omissionFor(pattern, profile, dayName) {
    if (patternAvoided(pattern, profile)) return { dayName, pattern, label: PATTERNS[pattern] || pattern, reason: 'mouvement exclu dans ton profil de sécurité' };
    const candidates = Object.entries(EX).filter(([id, item]) => item.pattern === pattern && !profile.dislikes.includes(id));
    const missing = [...new Set(candidates.flatMap(([, item]) => item.requires.filter((requirement) => !profile.equipment.includes(requirement))).map((requirement) => EQUIPMENT_LABELS[requirement] || requirement))];
    return { dayName, pattern, label: PATTERNS[pattern] || pattern, reason: missing.length ? `matériel absent : ${missing.slice(0, 3).join(', ')}` : 'toutes les variantes compatibles ont été exclues' };
  }

  function volumeTargetFor(muscle, rawProfile) {
    const profile = normalizeProfile(rawProfile);
    const levelBase = profile.level === 'advanced' ? 10 : profile.level === 'intermediate' ? 8 : 6;
    let target = profile.goal === 'hypertrophy' ? levelBase : profile.goal === 'balanced' ? Math.max(5, levelBase - 2) : profile.goal === 'strength' ? Math.max(4, levelBase - 3) : 4;
    if (profile.priorities.includes(muscle)) target += 2;
    if (profile.startingConservative) target = Math.max(4, target - 2);
    // Une priorité ne doit jamais effacer les contraintes de récupération.
    // Le muscle reste prioritaire, mais son volume de départ est réduit tant que
    // le sommeil, le stress ou une autre activité indiquent une capacité moindre.
    if (profile.sleep === 'under6' || profile.stress === 'high' || profile.recovery === 'variable') target = Math.max(4, target - 1);
    if (profile.activityLoad === 'high' && activityFatiguedMuscles(profile).has(muscle)) target = Math.max(4, target - (profile.priorities.includes(muscle) ? 1 : 2));
    return Math.min(12, target);
  }

  function dayMuscleVolume(day) {
    const volumes = {};
    for (const exercise of day?.exercises || []) {
      volumes[exercise.muscle] = (volumes[exercise.muscle] || 0) + Number(exercise.sets || 0);
      for (const secondary of exercise.secondary || []) volumes[secondary] = (volumes[secondary] || 0) + Number(exercise.sets || 0) * .5;
    }
    return volumes;
  }

  function dayRecoveryVolume(day) {
    const volumes = {};
    for (const exercise of day?.exercises || []) {
      const sets = Number(exercise.sets || 0);
      const armMuscle = ['horizontalPush', 'verticalPush', 'triceps'].includes(exercise.pattern) ? 'triceps' : ['horizontalPull', 'verticalPull', 'biceps'].includes(exercise.pattern) ? 'biceps' : null;
      const primary = exercise.muscle === 'arms' ? armMuscle : exercise.pattern === 'rearDelt' ? 'shoulders' : exercise.muscle;
      if (primary) volumes[primary] = (volumes[primary] || 0) + sets;
      for (const secondary of exercise.secondary || []) {
        const muscle = secondary === 'arms' ? armMuscle : secondary;
        if (muscle) volumes[muscle] = (volumes[muscle] || 0) + sets * .4;
      }
    }
    return volumes;
  }

  function recoveryMuscleLabel(muscle) {
    return ({ biceps: 'Biceps', triceps: 'Triceps' })[muscle] || MUSCLES[muscle] || muscle;
  }

  function programRecoveryReport(program, rawProfile = {}) {
    const profile = normalizeProfile(rawProfile); const exposures = {};
    for (const day of program?.days || []) for (const [muscle, sets] of Object.entries(dayRecoveryVolume(day))) {
      if (sets < 1) continue;
      if (!exposures[muscle]) exposures[muscle] = [];
      exposures[muscle].push({ weekday: Number(day.weekday), sets: Number(sets.toFixed(1)), dayName: day.name });
    }
    const muscles = {}; const warnings = [];
    for (const [muscle, entries] of Object.entries(exposures)) {
      const indexes = [...new Set(entries.map((entry) => weekdayIndex(entry.weekday)))].sort((a, b) => a - b);
      const gaps = indexes.length > 1 ? indexes.map((value, index) => (indexes[(index + 1) % indexes.length] - value + 7) % 7 || 7) : [7];
      const minimumGap = Math.min(...gaps); const frequency = indexes.length;
      muscles[muscle] = { frequency, minimumGap, entries };
      if (minimumGap < 2 && entries.some((entry) => entry.sets >= 2)) warnings.push(`${recoveryMuscleLabel(muscle)} sollicité fortement deux jours consécutifs`);
    }
    const activityDays = new Set(profile.activityDays || []); const external = activityStress(profile); const activityConflicts = [];
    if (profile.activityLoad !== 'none' && activityDays.size) for (const day of program?.days || []) {
      const overlap = stressOverlap(dayMuscleVolume(day), external);
      if (activityDays.has(Number(day.weekday)) && overlap >= 1.5) activityConflicts.push(`${day.name} partage une forte demande musculaire avec une autre activité le ${WEEKDAYS[day.weekday].toLowerCase()}`);
    }
    return { passed: warnings.length === 0, warnings, activityConflicts, muscles };
  }

  function calibrationPlan(profile) {
    const targetSessions = Math.max(4, Math.min(12, Number(profile.days || 3) * 2));
    return { phase: 'calibration', targetSessions, targetWeeks: 2, minimumAdherence: 70, minimumRirCoverage: 60 };
  }

  function calibrationStatus(program, sessions = []) {
    const calibration = program?.calibration || { targetSessions: Math.max(4, Number(program?.days?.length || 3) * 2), minimumAdherence: 70, minimumRirCoverage: 60 };
    const createdAt = new Date(program?.createdAt || 0).getTime();
    const relevant = (sessions || []).filter((session) => session.completedAt && (session.programId === program?.id || (!session.programId && new Date(session.completedAt).getTime() >= createdAt)));
    const recent = relevant.slice(-calibration.targetSessions); let prescribed = 0; let logged = 0; let rir = 0;
    for (const session of recent) {
      const day = program?.days?.find((item) => item.id === session.dayId);
      prescribed += day ? day.exercises.reduce((sum, exercise) => sum + Number(exercise.sets || 0), 0) : Number(session.summary?.prescribedSets || 0);
      logged += (session.sets || []).length;
      rir += (session.sets || []).filter((set) => Number.isFinite(set.rir)).length;
    }
    const adherence = prescribed ? Math.round(Math.min(1.2, logged / prescribed) * 100) : 0;
    const rirCoverage = logged ? Math.round(rir / logged * 100) : 0;
    const enoughSessions = relevant.length >= calibration.targetSessions;
    const complete = enoughSessions && adherence >= calibration.minimumAdherence && rirCoverage >= calibration.minimumRirCoverage;
    return { ...calibration, completedSessions: relevant.length, progress: Math.min(1, relevant.length / calibration.targetSessions), adherence, rirCoverage, enoughSessions, complete };
  }

  function programQualityReport(program, profile, omissions = []) {
    const violations = []; const timeConflicts = []; const exercises = program.days.flatMap((day) => day.exercises.map((exercise) => ({ day, exercise })));
    for (const { day, exercise } of exercises) {
      const catalogExercise = EX[exercise.id] || exercise;
      if (!equipmentCompatible(catalogExercise, profile)) violations.push(`${exercise.name} exige du matériel non déclaré`);
      if (profile.dislikes.includes(exercise.id)) violations.push(`${exercise.name} est dans les exercices refusés`);
      if (patternAvoided(exercise.pattern, profile)) violations.push(`${exercise.name} utilise un mouvement à éviter`);
      const duplicates = day.exercises.filter((item) => item.id === exercise.id).length;
      if (duplicates > 1) violations.push(`${exercise.name} est dupliqué dans ${day.name}`);
    }
    for (const day of program.days) {
      const estimated = estimateMinutes(day.exercises, profile);
      if (estimated > profile.maxMinutes) timeConflicts.push({ dayId: day.id, dayName: day.name, estimatedMinutes: estimated, requestedMinutes: profile.maxMinutes });
    }
    const qualityValues = exercises.map(({ exercise }) => Number(exercise.qualityScore)).filter(Number.isFinite);
    const averageQuality = qualityValues.length ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length) : 0;
    const compatibleFocus = profile.movementFocus.filter((id) => EX[id] && equipmentCompatible(EX[id], profile) && !profile.dislikes.includes(id) && !patternAvoided(EX[id].pattern, profile));
    const selectedIds = new Set(exercises.map(({ exercise }) => exercise.id));
    const missingFocus = compatibleFocus.filter((id) => !selectedIds.has(id));
    const recovery = programRecoveryReport(program, profile);
    return { passed: violations.length === 0, violations: [...new Set(violations)], timePassed: timeConflicts.length === 0, timeConflicts, recoveryPassed: recovery.passed, recoveryWarnings: recovery.warnings, activityConflicts: recovery.activityConflicts, recovery, checkedExercises: exercises.length, averageQuality, omissions, missingFocus };
  }

  function buildProgram(profile) {
    profile = normalizeProfile(profile);
    const selected = templateFor(profile);
    const layout = buildWeeklyLayout(profile, selected.rows);
    const schedule = layout.schedule;
    const omissions = []; const weeklyUses = new Map();
    const days = layout.rows.map(([name, patterns], dayIndex) => {
      const used = new Set();
      const exercises = patterns.map((pattern, order) => {
        const choice = chooseExercise(pattern, profile, dayIndex, used, weeklyUses);
        if (!choice) { omissions.push(omissionFor(pattern, profile, name)); return null; }
        used.add(choice[0]);
        weeklyUses.set(choice[0], (weeklyUses.get(choice[0]) || 0) + 1);
        return exerciseConfig(choice[0], choice[1], order, profile, choice[2]);
      }).filter(Boolean);
      const orderScore = (exercise) => (profile.movementFocus.includes(exercise.id) ? 20 : 0) + (profile.priorities.includes(exercise.muscle) ? 10 : 0);
      exercises.sort((a, b) => orderScore(b) - orderScore(a) || a.order - b.order).forEach((exercise, index) => { exercise.order = index; });
      return { id: `day-${dayIndex + 1}`, name, order: dayIndex, weekday: schedule[dayIndex], exercises };
    });

    for (const priority of profile.priorities) {
      const recoveryLimited = profile.startingConservative || profile.sleep === 'under6' || profile.stress === 'high' || profile.recovery === 'variable' || (profile.activityLoad === 'high' && activityFatiguedMuscles(profile).has(priority));
      const maximumBoosts = recoveryLimited ? 1 : 2;
      let boosts = 0;
      for (const day of days) {
        const exercise = day.exercises.find((item) => item.muscle === priority);
        if (exercise && boosts < maximumBoosts && exercise.sets < 4) { exercise.sets += 1; exercise.priorityBoost = true; boosts += 1; }
      }
    }
    const volumeTargets = {};
    if (['hypertrophy', 'balanced'].includes(profile.goal)) {
      for (const muscle of ['chest', 'back', 'shoulders', 'quads', 'glutes', 'hamstrings']) {
        const target = volumeTargetFor(muscle, profile); volumeTargets[muscle] = target;
        let current = weeklyVolume({ days })[muscle] || 0;
        for (const day of days) {
          const exercise = day.exercises.find((item) => item.muscle === muscle && item.sets < 4);
          if (exercise && current < target) { exercise.sets += 1; current += 1; }
        }
      }
    }
    days.forEach((day) => {
      const fitted = fitToTime(day.exercises, profile.maxMinutes, profile);
      day.exercises = fitted.exercises; day.durationAdjustments = fitted.adjustments; updateDayDuration(day, profile);
    });
    const program = { id: uid(), split: selected.split, createdAt: new Date().toISOString(), days, rationales: [], evidenceVersion: 'ACSM-2026-Training-v6', layout, volumeTargets, calibration: calibrationPlan(profile) };
    program.qualityReport = programQualityReport(program, profile, omissions);
    const rationales = [
      `${splitName(selected.split)} choisi : ${selected.reason}`,
      `Ordre hebdomadaire optimisé selon le chevauchement musculaire, les jours disponibles et un maximum de ${profile.maxConsecutive} jour${profile.maxConsecutive > 1 ? 's' : ''} consécutif${profile.maxConsecutive > 1 ? 's' : ''}.`,
      `${program.qualityReport.checkedExercises} exercices vérifiés un par un contre ton matériel, tes refus et les mouvements à éviter.`,
      `Durées calculées avec l’échauffement, les montées en charge, l’installation, les séries, les repos et une marge réaliste.`,
      `Progression par répétitions puis petite hausse de charge, avec ${days[0]?.exercises[0]?.targetRir || 2} répétitions en réserve visées.`,
    ];
    if (profile.startingConservative) rationales.push('Régularité récente ou aisance technique limitée : départ volontairement prudent, même si tu as déjà de l’expérience.');
    if (profile.likes.length) rationales.push('Tes exercices appréciés ont été favorisés lorsqu’ils correspondaient au matériel et à la structure.');
    if (profile.activityLoad !== 'none') rationales.push(`${ACTIVITY_LOADS[profile.activityLoad]} prise en compte pour ne pas ignorer le sport ou le travail physique.`);
    if (layout.activityAware) rationales.push(`Les jours de tes autres activités ont été comparés à la demande musculaire de chaque séance; les conflits évitables ont été pénalisés.`);
    if (profile.recovery === 'fast') rationales.push('Récupération rapide notée, mais le volume de départ reste prudent et augmentera seulement si tes performances le justifient.');
    if (profile.sleep === 'under6') rationales.push('Sommeil court déclaré : volume accessoire conservateur au départ.');
    if (profile.stress === 'high') rationales.push('Stress élevé déclaré : le plan évite de maximiser le volume dès le départ.');
    const timeAdjustments = days.reduce((sum, day) => sum + day.durationAdjustments.length, 0);
    if (timeAdjustments) rationales.push(`${timeAdjustments} ajustement${timeAdjustments > 1 ? 's' : ''} de volume ou d’exercice effectué${timeAdjustments > 1 ? 's' : ''} pour respecter ton temps disponible sans sacrifier les priorités en premier.`);
    if (!program.qualityReport.timePassed) rationales.push(`La durée demandée de ${profile.maxMinutes} min est trop courte pour ${program.qualityReport.timeConflicts.length} séance${program.qualityReport.timeConflicts.length > 1 ? 's' : ''} sans retirer un mouvement essentiel ou raccourcir artificiellement l’échauffement. La fourchette minimale réaliste est affichée plutôt qu’une fausse promesse.`);
    if (profile.equipment.includes('machines')) rationales.push('Ancien choix générique « Machines » détecté : aucun poste précis n’a été supposé. Ouvre Équipement pour indiquer les machines réellement présentes.');
    if (omissions.length) rationales.push(`${omissions.length} rôle${omissions.length > 1 ? 's' : ''} de mouvement omis faute de matériel compatible ou selon tes exclusions; MacroFlow n’invente jamais un équipement.`);
    if (program.qualityReport.missingFocus.length) rationales.push('Un mouvement prioritaire compatible n’a pas pu entrer sans déséquilibrer ou dépasser la séance; il reste disponible comme remplacement.');
    if (program.qualityReport.recoveryWarnings.length) rationales.push(`Ton horaire impose ${program.qualityReport.recoveryWarnings.length} chevauchement${program.qualityReport.recoveryWarnings.length > 1 ? 's' : ''} rapproché${program.qualityReport.recoveryWarnings.length > 1 ? 's' : ''}; le plan le signale au lieu de prétendre que la récupération est parfaite.`);
    rationales.push(`Les ${program.calibration.targetSessions} premières séances servent à calibrer les charges, l’adhérence et le RIR avant toute hausse de volume.`);
    program.rationales = rationales;
    return program;
  }

  function weeklyVolume(program) {
    const totals = {};
    for (const day of program.days) for (const exercise of day.exercises) {
      totals[exercise.muscle] = (totals[exercise.muscle] || 0) + exercise.sets;
      for (const secondary of exercise.secondary || []) totals[secondary] = (totals[secondary] || 0) + exercise.sets * 0.5;
    }
    return totals;
  }

  async function finishOnboarding() {
    const profile = collectProfile();
    if (data.activeAdaptation?.type === 'light_week') restoreLightWeek(data.activeAdaptation, false);
    data.localProfile = { name: profile.name, ageGroup: profile.ageGroup, createdAt: data.localProfile?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    data.profile = profile;
    data.program = buildProgram(profile);
    data.nutritionPlan = estimateNutrition(profile);
    data.draftProfile = null;
    data.onboardingStep = 0;
    data.activeSession = null;
    data.sessionSummaryId = null;
    await save();
    window.dispatchEvent(new CustomEvent('macroflow:apply-nutrition-plan', { detail: data.nutritionPlan }));
    $('trainingOnboarding').classList.add('hidden');
    document.body.style.overflow = '';
    renderAll();
    showPlanReady();
  }

  function showPlanReady() {
    if (!data.program || !data.profile) return;
    const longestLow = Math.max(...data.program.days.map((day) => dayDuration(day, data.profile).lowMinutes));
    const longestHigh = Math.max(...data.program.days.map((day) => dayDuration(day, data.profile).highMinutes));
    $('planReadyLead').textContent = `${data.profile.name}, MacroFlow a optimisé la structure, l’alternance musculaire, l’horaire, le matériel et la récupération sans imposer un modèle générique.`;
    $('planReadyStats').innerHTML = `<div><strong>${escapeText(splitName(data.program.split))}</strong><small>Structure</small></div><div><strong>${data.program.days.length} séances</strong><small>Par semaine</small></div><div><strong>${longestLow}–${longestHigh} min</strong><small>Plus longue séance</small></div>`;
    $('planReadyModal').classList.remove('hidden');
    window.MacroFlowDelight?.haptic?.('success');
    window.MacroFlowDelight?.pulse?.();
  }

  function completedSessions() { return data.sessions.filter((session) => session.completedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt)); }
  function exerciseHistory(exerciseId) { return completedSessions().map((session) => ({ session, sets: session.sets.filter((set) => set.exerciseId === exerciseId) })).filter((entry) => entry.sets.length); }

  function nextPerformanceTarget(exercise, previousSets = []) {
    const prescribedSets = Math.max(1, Number(exercise.sets) || 1);
    const targetRir = Number(exercise.targetRir) || 2;
    const valid = previousSets.filter((set) => Number(set.reps) >= 1);
    if (!valid.length) return { weight: 0, repPlaceholder: exercise.minRep, type: 'missing', title: 'Première référence', text: `Choisis une difficulté qui permet ${exercise.minRep}-${exercise.maxRep} répétitions avec environ ${targetRir} RIR.` };

    const weighted = valid.filter((set) => Number(set.weight) > 0);
    if (!weighted.length || !(Number(exercise.increment) > 0)) {
      const workSets = valid.slice(-prescribedSets); const complete = workSets.length >= prescribedSets;
      const rirComplete = complete && workSets.every((set) => Number.isFinite(set.rir));
      const topReached = complete && workSets.every((set) => Number(set.reps) >= Number(exercise.maxRep));
      const controlled = rirComplete && workSets.every((set) => Number(set.rir) >= targetRir);
      const previousReps = Math.round(workSets.reduce((sum, set) => sum + Number(set.reps), 0) / workSets.length);
      const techniqueConcern = techniqueConcernFor(workSets);
      if (techniqueConcern === 'pain') return { weight: 0, repPlaceholder: Math.min(exercise.maxRep, Math.max(exercise.minRep, previousReps)), type: 'caution', title: 'Pas de progression après une douleur', text: 'Garde ou simplifie la variante. Une douleur signalée ne doit pas être gérée en forçant; arrête le mouvement et fais-la évaluer si elle est nouvelle ou inexpliquée.' };
      if (techniqueConcern) return { weight: 0, repPlaceholder: Math.min(exercise.maxRep, Math.max(exercise.minRep, previousReps)), type: 'caution', title: 'Technique avant difficulté', text: 'Garde la même variante et rends toutes les répétitions stables avant de la compliquer. Une hausse n’est pas proposée quand l’exécution est à surveiller ou dégradée.' };
      if (topReached && controlled) return { weight: 0, repPlaceholder: exercise.minRep, type: 'up', title: 'Variante plus difficile proposée', text: `Toutes les séries ont atteint ${exercise.maxRep} répétitions à au moins ${targetRir} RIR. Essaie une progression simple de la variante, puis confirme tes répétitions réelles.` };
      if (topReached && !rirComplete) return { weight: 0, repPlaceholder: exercise.maxRep, type: 'missing', title: 'RIR requis avant de progresser', text: 'Garde la même variante et note le RIR sur toutes les séries. MacroFlow ne rend pas le mouvement plus difficile sans cette information.' };
      return { weight: 0, repPlaceholder: Math.min(exercise.maxRep, Math.max(exercise.minRep, previousReps + 1)), type: 'same', title: 'Même variante', text: 'Essaie d’ajouter une répétition tout en gardant la technique et le RIR prévus.' };
    }

    const groups = new Map();
    for (const set of weighted) { const weight = Number(set.weight); if (!groups.has(weight)) groups.set(weight, []); groups.get(weight).push(set); }
    const [referenceWeight, atWeight] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0];
    const workSets = atWeight.slice(-prescribedSets); const enoughComparableSets = workSets.length >= prescribedSets;
    const rirComplete = enoughComparableSets && workSets.every((set) => Number.isFinite(set.rir));
    const topReached = enoughComparableSets && workSets.every((set) => Number(set.reps) >= Number(exercise.maxRep));
    const controlled = rirComplete && workSets.every((set) => Number(set.rir) >= targetRir);
    const averageReps = workSets.reduce((sum, set) => sum + Number(set.reps), 0) / workSets.length;
    const repPlaceholder = Math.min(exercise.maxRep, Math.max(exercise.minRep, Math.round(averageReps) + (averageReps < exercise.maxRep ? 1 : 0)));
    const increment = Number(exercise.increment);
    const techniqueConcern = techniqueConcernFor(workSets);
    if (techniqueConcern === 'pain') return { weight: referenceWeight, repPlaceholder: Math.min(exercise.maxRep, Math.max(exercise.minRep, Math.round(averageReps))), type: 'caution', title: `Pas de hausse au-delà de ${referenceWeight} kg`, text: 'Une douleur a été signalée. N’essaie pas de la dépasser en forçant; arrête ce mouvement et fais évaluer toute douleur nouvelle ou inexpliquée.' };
    if (techniqueConcern) return { weight: referenceWeight, repPlaceholder: Math.min(exercise.maxRep, Math.max(exercise.minRep, Math.round(averageReps))), type: 'caution', title: `Reste à ${referenceWeight} kg`, text: 'La charge n’augmente pas tant que l’exécution est à surveiller ou dégradée. Stabilise d’abord toutes les répétitions.' };
    if (topReached && controlled) return { weight: round(referenceWeight + increment, 0.5), repPlaceholder: exercise.minRep, type: 'up', title: `${round(referenceWeight + increment, 0.5)} kg proposés`, text: `Les séries comparables ont atteint le haut de la plage avec au moins ${targetRir} RIR. Le plus petit incrément disponible est proposé, jamais imposé.` };
    if (topReached && !rirComplete) return { weight: referenceWeight, repPlaceholder: exercise.maxRep, type: 'missing', title: `Garde ${referenceWeight} kg`, text: 'Le haut de la plage est atteint, mais le RIR manque. Enregistre-le sur toutes les séries avant d’augmenter.' };
    const hardSets = workSets.filter((set) => Number(set.reps) < Number(exercise.minRep) || (Number.isFinite(set.rir) && Number(set.rir) === 0));
    if (hardSets.length >= Math.min(2, prescribedSets)) return { weight: referenceWeight, repPlaceholder: exercise.minRep, type: 'caution', title: `Reste à ${referenceWeight} kg aujourd’hui`, text: `La dernière exposition était difficile. Une seule mauvaise séance ne réduit pas la charge automatiquement; si cela se répète, le bilan hebdomadaire cherchera la cause.` };
    return { weight: referenceWeight, repPlaceholder, type: 'same', title: `${referenceWeight} kg · vise ${repPlaceholder} reps`, text: `Garde la charge et progresse dans la plage ${exercise.minRep}-${exercise.maxRep} avec environ ${targetRir} RIR.` };
  }

  function techniqueConcernFor(sets = []) {
    const qualities = sets.map((set) => set?.techniqueQuality).filter((value) => ['solid', 'uncertain', 'degraded', 'pain'].includes(value));
    if (qualities.includes('pain')) return 'pain';
    if (qualities.includes('degraded')) return 'degraded';
    if (qualities.includes('uncertain')) return 'uncertain';
    return null;
  }

  function suggestionFor(exercise) {
    return nextPerformanceTarget(exercise, exerciseHistory(exercise.id)[0]?.sets || []);
  }

  function plateauFor(exerciseId) {
    const history = exerciseHistory(exerciseId).slice(0, 4);
    if (history.length < 4) return false;
    const metrics = history.map((entry) => Math.max(...entry.sets.filter((set) => set.reps <= 15).map((set) => set.weight * (1 + set.reps / 30)), 0));
    return metrics[0] <= Math.max(...metrics.slice(1)) * 1.005;
  }

  function previousText(exerciseId) {
    const previous = exerciseHistory(exerciseId)[0]?.sets || [];
    if (!previous.length) return 'Aucune performance précédente';
    return `Dernière fois : ${previous.map((set) => `${Number(set.weight) > 0 ? `${set.weight} kg × ` : ''}${set.reps} reps${Number.isFinite(set.rir) ? ` · ${set.rir} RIR` : ''}`).join(' · ')}`;
  }

  function localDayKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function localWeekKey(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return localDayKey(date);
  }

  function effectiveWeekdayMap(program, decisions = [], value = new Date()) {
    const mapping = Object.fromEntries((program?.days || []).map((day) => [day.id, Number(day.weekday)]));
    const weekKey = localWeekKey(value);
    [...(decisions || [])]
      .filter((decision) => decision?.swapSchedule && decision.weekKey === weekKey)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .forEach((decision) => {
        if (!(decision.scheduledDayId in mapping) || !(decision.chosenDayId in mapping) || decision.scheduledDayId === decision.chosenDayId) return;
        const scheduledWeekday = mapping[decision.scheduledDayId];
        mapping[decision.scheduledDayId] = mapping[decision.chosenDayId];
        mapping[decision.chosenDayId] = scheduledWeekday;
      });
    return mapping;
  }

  function nextScheduledDay() {
    if (!data.program?.days?.length) return null;
    const today = new Date(); const weekday = today.getDay(); const todayKey = localDayKey(today);
    const effectiveWeekdays = effectiveWeekdayMap(data.program, data.dailyCoachDecisions, today);
    const completedToday = new Set((data.sessions || []).filter((session) => session.completedAt && localDayKey(session.completedAt) === todayKey).map((session) => session.dayId));
    return data.program.days.map((day) => {
      let daysAway = ((Number(effectiveWeekdays[day.id] ?? day.weekday) - weekday) + 7) % 7;
      if (daysAway === 0 && completedToday.has(day.id)) daysAway = 7;
      return { day, daysAway };
    }).sort((a, b) => a.daysAway - b.daysAway || a.day.order - b.day.order)[0];
  }

  function openWorkoutSession() {
    document.querySelector('[data-tab="workout"]')?.click();
    switchTab('session');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTodayCoach() {
    const card = $('todayTrainingCard');
    if (!card) return;
    if (!data.program || !data.profile) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const button = $('todayTrainingActionBtn');
    if (data.activeSession) {
      const day = data.program.days.find((item) => item.id === data.activeSession.dayId);
      const logged = data.activeSession.sets.length;
      $('todayTrainingEyebrow').textContent = 'Séance en cours'; $('todayTrainingTitle').textContent = day?.name || data.activeSession.name;
      $('todayTrainingDescription').textContent = `${logged} série${logged > 1 ? 's' : ''} enregistrée${logged > 1 ? 's' : ''}. Ton chronomètre et tes données sont conservés.`;
      $('todayTrainingMeta').innerHTML = `<span>⏱ En cours</span><span>✓ ${logged} séries</span><span>${day?.exercises.length || 0} exercices</span>`;
      $('todayTrainingIcon').textContent = '⏱️'; $('todayTrainingHint').textContent = 'Reprends exactement où tu étais.'; button.textContent = 'Reprendre la séance';
      button.onclick = openWorkoutSession;
      return;
    }
    const scheduled = nextScheduledDay();
    if (!scheduled) { card.classList.add('hidden'); return; }
    const { day, daysAway } = scheduled; const setCount = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const muscles = [...new Set(day.exercises.map((exercise) => MUSCLES[exercise.muscle]))].slice(0, 3);
    const progressions = day.exercises.map(suggestionFor).filter((target) => target.type === 'up').length;
    $('todayTrainingEyebrow').textContent = daysAway === 0 ? 'Séance du jour' : `Prochaine séance · ${WEEKDAYS[day.weekday]}`;
    $('todayTrainingTitle').textContent = day.name;
    $('todayTrainingDescription').textContent = daysAway === 0 ? 'Ton coach de séance a préparé les charges à partir de tes dernières performances.' : `Prévue dans ${daysAway} jour${daysAway > 1 ? 's' : ''}. Tu peux quand même la commencer maintenant si ton horaire change.`;
    $('todayTrainingMeta').innerHTML = `<span>${durationLabel(day, data.profile)}</span><span>${setCount} séries</span><span>${escapeText(muscles.join(' · '))}</span>`;
    $('todayTrainingIcon').textContent = progressions ? '📈' : '🏋️'; $('todayTrainingHint').textContent = progressions ? `${progressions} progression${progressions > 1 ? 's' : ''} à confirmer.` : 'Chaque cible reste modifiable.'; button.textContent = daysAway === 0 ? 'Commencer ma séance' : 'Commencer maintenant';
    button.onclick = () => startSession(day.id);
  }

  function renderProfile() {
    if (!data.program || !data.profile) {
      $('programSummary').classList.add('hidden');
      $('programDays').innerHTML = '';
      $('sessionDayChoices').innerHTML = '<p class="plate-empty">Crée d’abord ton programme.</p>';
      return;
    }
    const volumes = weeklyVolume(data.program);
    const maxDurationLow = Math.max(...data.program.days.map((day) => dayDuration(day, data.profile).lowMinutes));
    const maxDurationHigh = Math.max(...data.program.days.map((day) => dayDuration(day, data.profile).highMinutes));
    const quality = data.program.qualityReport || programQualityReport(data.program, normalizeProfile(data.profile), []);
    const currentGenerator = data.program.evidenceVersion === 'ACSM-2026-Training-v6';
    const calibration = calibrationStatus(data.program, data.sessions || []);
    $('trainingProfileDigest').textContent = `${data.profile.name} · ${LEVELS[data.profile.level]} · ${GOALS[data.profile.goal]}`;
    const nutrition = data.nutritionPlan;
    const activeAdaptationCard = data.activeAdaptation?.type === 'light_week' ? `<div class="training-alert"><strong>Semaine légère active</strong><br>${data.activeAdaptation.remainingSessions} séance${data.activeAdaptation.remainingSessions > 1 ? 's' : ''} restante${data.activeAdaptation.remainingSessions > 1 ? 's' : ''}. Les séries sont temporairement réduites et le RIR augmenté; le plan original reviendra automatiquement.</div>` : '';
    const nutritionCard = nutrition ? `<div class="nutrition-preview"><span class="eyebrow">Nutrition liée au plan</span><strong>${nutrition.goals.calories} kcal</strong><div class="nutrition-macros"><span>P ${nutrition.goals.protein} g</span><span>G ${nutrition.goals.carbs} g</span><span>L ${nutrition.goals.fat} g</span></div><small>${escapeText(nutrition.goalLabel)} · maintien estimé ${nutrition.maintenanceCalories} kcal</small><small>${escapeText(nutrition.rateText)}</small></div>` : '';
    const qualityCard = !currentGenerator ? `<div class="training-alert"><strong>Nouveau moteur disponible</strong><br>Ce programme vient d’une ancienne version. Appuie sur « Modifier », confirme ton horaire, les jours de tes autres activités et les machines disponibles, puis termine le questionnaire.</div>` : quality.passed ? `<div class="onboarding-note program-quality-note"><strong>Compatibilité validée</strong><br>${quality.checkedExercises} exercices vérifiés · aucun matériel absent · aucun exercice refusé ou mouvement exclu.</div>` : `<div class="training-alert"><strong>Plan à vérifier</strong><br>${escapeText((quality.violations || []).join(' · '))}</div>`;
    const timeCard = quality.timePassed === false ? `<div class="training-alert"><strong>Temps demandé trop court</strong><br>Après les ajustements raisonnables, ${quality.timeConflicts.length} séance${quality.timeConflicts.length > 1 ? 's demandent' : ' demande'} encore jusqu’à ${Math.max(...quality.timeConflicts.map((item) => item.estimatedMinutes))} min au lieu de ${data.profile.maxMinutes}. MacroFlow affiche la vérité plutôt que de retirer un mouvement essentiel ou raccourcir l’échauffement.</div>` : '';
    const recoveryIssues = [...(quality.recoveryWarnings || []), ...(quality.activityConflicts || [])];
    const recoveryCard = recoveryIssues.length ? `<div class="training-alert"><strong>Récupération contrainte par l’horaire</strong><br>${escapeText(recoveryIssues.join(' · '))}. Ces conflits sont visibles et le volume reste conservateur.</div>` : `<div class="onboarding-note"><strong>Alternance musculaire vérifiée</strong><br>L’ordre des journées minimise les répétitions lourdes du même groupe deux jours de suite${data.program.layout?.activityAware ? ' et tient compte des autres activités indiquées' : ''}.</div>`;
    const calibrationCard = calibration.complete
      ? `<div class="onboarding-note"><strong>Plan calibré</strong><br>${calibration.completedSessions} séances analysées · adhérence ${calibration.adherence} % · RIR saisi ${calibration.rirCoverage} %. Les adaptations peuvent maintenant utiliser tes données réelles.</div>`
      : `<div class="nutrition-preview"><span class="eyebrow">Phase de calibration</span><strong>${Math.min(calibration.completedSessions, calibration.targetSessions)}/${calibration.targetSessions} séances</strong><div class="progress-track"><div class="progress-fill" style="width:${Math.round(calibration.progress * 100)}%;background:linear-gradient(90deg,var(--purple),#30d158)"></div></div><small>${calibration.enoughSessions ? `Les séances sont faites, mais vise au moins ${calibration.minimumAdherence} % des séries et note le RIR sur ${calibration.minimumRirCoverage} % des séries.` : 'MacroFlow apprend tes charges et ton effort réel. Le volume ne sera pas augmenté pendant cette phase.'}</small></div>`;
    $('programSummary').innerHTML = `<strong>${splitName(data.program.split)} · ${data.program.days.length} jours</strong><small>${data.program.days.map((day) => `${WEEKDAYS[day.weekday].slice(0, 3)} ${day.name}`).join(' · ')}</small>${activeAdaptationCard}<div class="plan-explainer"><div class="plan-stat"><strong>${maxDurationLow}–${maxDurationHigh} min</strong><small>Plus longue séance réaliste</small></div><div class="plan-stat"><strong>${data.program.days[0]?.exercises[0]?.targetRir || 2} RIR</strong><small>Marge de départ</small></div></div>${qualityCard}${recoveryCard}${timeCard}${calibrationCard}${nutritionCard}<div class="volume-chips">${Object.entries(volumes).filter(([, sets]) => sets >= 2).map(([muscle, sets]) => `<span class="volume-chip">${MUSCLES[muscle]} ~${round(sets, 0.5)} séries${data.program.volumeTargets?.[muscle] ? ` · cible initiale ${data.program.volumeTargets[muscle]}` : ''}</span>`).join('')}</div><ul class="rationale-list">${[...data.program.rationales, ...(nutrition?.rationales || [])].map((reason) => `<li>${escapeText(reason)}</li>`).join('')}</ul><p class="evidence-note">Le programme suit les repères ACSM 2026. La structure sert à distribuer le volume et la récupération; elle n’est pas choisie parce qu’un split serait universellement supérieur. La durée inclut l’échauffement, les montées en charge, l’installation, les séries, les repos et une marge pour les transitions.</p>`;
    $('programSummary').classList.remove('hidden');
    $('programDays').innerHTML = data.program.days.map((day) => { const duration = dayDuration(day, data.profile); return `<div class="day-card"><div class="day-head"><b>${WEEKDAYS[day.weekday] || `Jour ${day.order + 1}`} · ${escapeText(day.name)}</b><span>${duration.lowMinutes}–${duration.highMinutes} min</span></div><div class="duration-breakdown"><span>${duration.generalWarmupMinutes} min échauffement</span><span>${duration.warmupSets} montée${duration.warmupSets > 1 ? 's' : ''} en charge</span><span>~${duration.restMinutes} min de repos</span></div>${day.durationAdjustments?.length ? `<small class="time-fit-note">Ajusté à ton temps : ${escapeText(day.durationAdjustments.join(' · '))}</small>` : ''}${day.exercises.map((exercise) => `<div class="exercise-line"><div><b>${escapeText(exercise.name)}</b><small>${exercise.sets} séries · ${exercise.minRep}-${exercise.maxRep} reps · ${exercise.targetRir} RIR</small><small class="exercise-selection-note">${escapeText(exercise.selectionReason || 'Compatible avec ton profil')}</small></div><small>${exercise.restSeconds / 60} min repos</small></div>`).join('')}<button class="big-button start-day" data-start-day="${day.id}" type="button" style="margin-top:9px">Commencer cette séance</button></div>`; }).join('');
    $('sessionDayChoices').innerHTML = data.program.days.map((day) => `<button class="prediction start-day" data-start-day="${day.id}" type="button"><span>${WEEKDAYS[day.weekday]} · ${escapeText(day.name)}</span><span>›</span></button>`).join('');
    $$('[data-start-day]').forEach((button) => button.addEventListener('click', () => startSession(button.dataset.startDay)));
  }

  function adaptExercisesForDailyCoach(exercises = [], adjustment = {}, coachTargets = {}) {
    const adaptedExercises = structuredClone(exercises || []);
    const adaptedTargets = structuredClone(coachTargets || {});
    const mode = adjustment?.mode || 'normal';
    const changes = { reducedAccessoryExercises: 0, addedRir: 0, suppressedProgressions: 0 };
    if (mode !== 'lighter') return { exercises: adaptedExercises, coachTargets: adaptedTargets, changes };
    const setReduction = Math.max(0, Number(adjustment.accessorySetReduction ?? 1));
    const rirAdd = Math.max(0, Number(adjustment.rirAdd ?? 1));
    for (const exercise of adaptedExercises) {
      if (!exercise.compound && setReduction > 0 && Number(exercise.sets) > 1) {
        exercise.sets = Math.max(1, Number(exercise.sets) - setReduction);
        changes.reducedAccessoryExercises += 1;
      }
      if (rirAdd > 0) {
        exercise.targetRir = Math.min(4, Number(exercise.targetRir || 2) + rirAdd);
        changes.addedRir = rirAdd;
      }
      const target = adaptedTargets[exercise.id];
      if (adjustment.suppressProgression && target?.type === 'up') {
        const previousWeight = Math.max(0, Number(target.weight || 0) - Number(exercise.increment || 0));
        adaptedTargets[exercise.id] = {
          ...target,
          weight: round(previousWeight, 0.5),
          type: 'caution',
          title: previousWeight > 0 ? `Garde ${round(previousWeight, 0.5)} kg aujourd’hui` : 'Garde ta variante actuelle aujourd’hui',
          text: 'Le bilan du jour suspend cette hausse pour cette séance seulement. Le programme permanent et la progression suivante ne sont pas modifiés.',
        };
        changes.suppressedProgressions += 1;
      }
    }
    return { exercises: adaptedExercises, coachTargets: adaptedTargets, changes };
  }

  function startSession(dayId, dailyCoach = null) {
    const day = data.program?.days.find((item) => item.id === dayId);
    if (!day) return;
    if (data.activeSession) { openWorkoutSession(); renderSession(); return; }
    const baseTargets = Object.fromEntries(day.exercises.map((exercise) => [exercise.id, suggestionFor(exercise)]));
    const adapted = adaptExercisesForDailyCoach(day.exercises, dailyCoach?.adjustment, baseTargets);
    data.sessionSummaryId = null;
    data.activeSession = {
      id: uid(), programId: data.program.id, dayId, name: day.name, startedAt: new Date().toISOString(), sets: [], coachTargets: adapted.coachTargets,
      exercises: adapted.exercises, currentExerciseIndex: 0, skippedExerciseIds: [],
      dailyCoach: dailyCoach ? { decisionId: dailyCoach.decisionId || null, mode: dailyCoach.adjustment?.mode || 'normal', swapSchedule: Boolean(dailyCoach.swapSchedule), reasons: [...(dailyCoach.reasons || [])], changes: adapted.changes } : null,
    };
    $('sessionSummaryModal')?.classList.add('hidden');
    document.body.style.overflow = '';
    save(); openWorkoutSession(); renderAll();
  }

  function activeSessionExercises(day) {
    if (!data.activeSession) return [];
    if (!Array.isArray(data.activeSession.exercises) || !data.activeSession.exercises.length) data.activeSession.exercises = structuredClone(day?.exercises || []);
    if (!Array.isArray(data.activeSession.skippedExerciseIds)) data.activeSession.skippedExerciseIds = [];
    if (!Number.isInteger(data.activeSession.currentExerciseIndex)) {
      const firstPending = data.activeSession.exercises.findIndex((exercise) => data.activeSession.sets.filter((set) => set.exerciseId === exercise.id).length < exercise.sets);
      data.activeSession.currentExerciseIndex = firstPending >= 0 ? firstPending : 0;
    }
    data.activeSession.currentExerciseIndex = Math.max(0, Math.min(data.activeSession.exercises.length - 1, data.activeSession.currentExerciseIndex));
    return data.activeSession.exercises;
  }

  function sessionSetsFor(exerciseId) {
    return data.activeSession?.sets.filter((set) => set.exerciseId === exerciseId) || [];
  }

  function nextPendingExerciseIndex(exercises, fromIndex) {
    for (let offset = 1; offset <= exercises.length; offset += 1) {
      const index = (fromIndex + offset) % exercises.length;
      const exercise = exercises[index];
      if (data.activeSession.skippedExerciseIds.includes(exercise.id)) continue;
      if (sessionSetsFor(exercise.id).length < exercise.sets) return index;
    }
    return -1;
  }

  function setCurrentExercise(index) {
    if (!data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId);
    const exercises = activeSessionExercises(day);
    if (!exercises.length) return;
    data.activeSession.currentExerciseIndex = Math.max(0, Math.min(exercises.length - 1, Number(index) || 0));
    editingSetId = null;
    save(); renderSession();
  }

  function moveCurrentExercise(direction) {
    if (!data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId);
    const exercises = activeSessionExercises(day);
    setCurrentExercise(data.activeSession.currentExerciseIndex + direction);
  }

  function nextSetDefaults(exercise, logged, suggestion) {
    const previousSet = logged.at(-1);
    if (previousSet) return { weight: previousSet.weight, reps: previousSet.reps };
    return {
      weight: Number(suggestion.weight) > 0 ? suggestion.weight : exercise.increment === 0 ? 0 : '',
      reps: suggestion.repPlaceholder || exercise.minRep,
    };
  }

  function setDisplayValue(set) {
    const load = Number(set.weight) > 0 ? `${set.weight} kg` : 'Poids du corps';
    const labels = { solid: 'Technique solide', uncertain: 'Technique à surveiller', degraded: 'Technique dégradée', pain: 'Douleur signalée' };
    return `${load} × ${set.reps}${Number.isFinite(set.rir) ? ` · ${set.rir} RIR` : ''}${labels[set.techniqueQuality] ? ` · ${labels[set.techniqueQuality]}` : ''}`;
  }

  function renderLoggedSet(set, index) {
    if (editingSetId === set.id) return `<div class="logged-set logged-set-editing" data-edit-set="${set.id}"><input class="edit-set-weight" aria-label="Modifier le poids" type="number" inputmode="decimal" min="0" step="0.5" value="${set.weight}"><input class="edit-set-reps" aria-label="Modifier les répétitions" type="number" inputmode="numeric" min="1" value="${set.reps}"><input class="edit-set-rir" aria-label="Modifier le RIR" type="number" inputmode="numeric" min="0" max="5" value="${Number.isFinite(set.rir) ? set.rir : ''}" placeholder="RIR"><select class="edit-set-technique" aria-label="Modifier la qualité technique"><option value=""${!set.techniqueQuality ? ' selected' : ''}>Technique non notée</option><option value="solid"${set.techniqueQuality === 'solid' ? ' selected' : ''}>Solide</option><option value="uncertain"${set.techniqueQuality === 'uncertain' ? ' selected' : ''}>À surveiller</option><option value="degraded"${set.techniqueQuality === 'degraded' ? ' selected' : ''}>Dégradée</option><option value="pain"${set.techniqueQuality === 'pain' ? ' selected' : ''}>Douleur</option></select><div class="logged-set-edit-actions"><button class="delete-set-button" type="button">Supprimer</button><button class="cancel-set-edit" type="button">Annuler</button><button class="save-set-button" type="button">Sauvegarder</button></div></div>`;
    return `<div class="logged-set" data-set-id="${set.id}"><span>Série ${index + 1}</span><b class="logged-set-value">${escapeText(setDisplayValue(set))}</b><div class="logged-set-actions"><button class="edit-set-button" type="button" aria-label="Modifier la série ${index + 1}">✎</button></div></div>`;
  }

  function renderSession() {
    if (!data.activeSession || !data.program) {
      $('noSessionCard').classList.remove('hidden'); $('activeSession').classList.add('hidden'); stopSessionClock(); return;
    }
    const day = data.program.days.find((item) => item.id === data.activeSession.dayId);
    if (!day) return;
    const exercises = activeSessionExercises(day);
    if (!exercises.length) return;
    const currentIndex = data.activeSession.currentExerciseIndex;
    const exercise = exercises[currentIndex];
    const logged = sessionSetsFor(exercise.id);
    const skipped = data.activeSession.skippedExerciseIds.includes(exercise.id);
    const complete = logged.length >= exercise.sets;
    const suggestion = data.activeSession.coachTargets?.[exercise.id] || suggestionFor(exercise);
    const defaults = nextSetDefaults(exercise, logged, suggestion);
    const progress = Math.min(100, Math.round((logged.length / exercise.sets) * 100));
    const totalSets = exercises.reduce((sum, item) => sum + item.sets, 0);
    const loggedSets = data.activeSession.sets.length;
    const overallPercent = totalSets ? Math.min(100, Math.round((loggedSets / totalSets) * 100)) : 0;

    $('noSessionCard').classList.add('hidden'); $('activeSession').classList.remove('hidden'); $('activeSessionName').textContent = day.name;
    $('sessionOverallLabel').textContent = `${loggedSets} sur ${totalSets} séries`;
    $('sessionExerciseLabel').textContent = `Exercice ${currentIndex + 1} sur ${exercises.length}`;
    $('sessionOverallPercent').textContent = `${overallPercent} %`;
    $('sessionOverallFill').style.width = `${overallPercent}%`;
    $('sessionExerciseNav').innerHTML = exercises.map((item, index) => {
      const count = sessionSetsFor(item.id).length; const done = count >= item.sets; const wasSkipped = data.activeSession.skippedExerciseIds.includes(item.id);
      const marker = done ? '✓' : wasSkipped ? '—' : index + 1;
      return `<button class="session-exercise-pill${index === currentIndex ? ' active' : ''}${done ? ' complete' : ''}${wasSkipped ? ' skipped' : ''}" data-session-exercise-index="${index}" type="button"><b>${marker}</b><span>${escapeText(item.name)}</span></button>`;
    }).join('');

    let entry = '';
    if (skipped) entry = `<div class="exercise-skipped-state"><span>↷</span><b>Exercice passé pour aujourd’hui</b><small>Les séries déjà faites sont conservées. Tu peux reprendre l’exercice si tu changes d’idée.</small></div><button class="resume-exercise-button" type="button">Reprendre cet exercice</button>`;
    else if (complete) entry = '<span class="exercise-complete-label">✓ Séries prévues complétées</span>';
    else entry = `<div class="set-entry-heading"><span>Poids (kg)</span><span>Répétitions</span><span>RIR</span></div><div class="set-entry with-rir"><input class="set-weight" aria-label="Poids pour ${escapeText(exercise.name)}" type="number" inputmode="decimal" step="0.5" min="0" value="${defaults.weight}" placeholder="kg"><input class="set-reps" aria-label="Répétitions pour ${escapeText(exercise.name)}" type="number" inputmode="numeric" min="1" value="${defaults.reps}" placeholder="${exercise.minRep}"><input class="set-rir" aria-label="Répétitions en réserve" type="number" inputmode="numeric" min="0" max="5" placeholder="cible ${exercise.targetRir}"><button class="add-training-set" aria-label="Enregistrer la série de ${escapeText(exercise.name)}" type="button">Enregistrer la série ${logged.length + 1}</button></div><span class="set-rir-label">RIR = répétitions que tu aurais encore pu faire, entre 0 et 5.</span><div class="technique-quality"><span>Qualité de cette série · optionnel mais utile pour la progression</span><input class="set-technique" type="hidden" value=""><div class="technique-quality-options"><button class="technique-quality-button" data-technique-quality="solid" aria-pressed="false" type="button">✓ Solide</button><button class="technique-quality-button" data-technique-quality="uncertain" aria-pressed="false" type="button">? À surveiller</button><button class="technique-quality-button" data-technique-quality="degraded" aria-pressed="false" type="button">↘ Dégradée</button><button class="technique-quality-button" data-technique-quality="pain" aria-pressed="false" type="button">! Douleur</button></div><span class="technique-pain-warning hidden">Arrête la série. Ne force pas à travers une douleur nouvelle, vive ou inexpliquée; remplace ou cesse le mouvement et fais-la évaluer si nécessaire.</span></div>`;

    const replaceDisabled = logged.length ? ' disabled title="Supprime les séries de cet exercice avant de le remplacer"' : '';
    const dailyCoachBanner = data.activeSession.dailyCoach ? `<div class="session-daily-coach-banner"><strong>${data.activeSession.dailyCoach.mode === 'lighter' ? 'Version allégée confirmée' : data.activeSession.dailyCoach.swapSchedule ? 'Ordre de la semaine échangé' : 'Coach du jour confirmé'}</strong><span>${data.activeSession.dailyCoach.mode === 'lighter' ? '+1 RIR · accessoires légèrement réduits · hausse de charge suspendue pour aujourd’hui seulement.' : data.activeSession.dailyCoach.swapSchedule ? 'Cette séance prend la place de la séance prévue aujourd’hui; l’autre journée est déplacée dans cette semaine seulement.' : 'La séance et sa progression restent inchangées.'}</span></div>` : '';
    $('sessionExercises').innerHTML = `${dailyCoachBanner}<div class="exercise-session focused-exercise-card${complete ? ' exercise-complete' : ''}${skipped ? ' exercise-skipped' : ''}" data-exercise="${exercise.id}"><div class="exercise-session-head"><div><b>${escapeText(exercise.name)}</b><small>${exercise.sets} × ${exercise.minRep}-${exercise.maxRep} · cible ${exercise.targetRir} RIR${exercise.replacedFromName ? ` · remplace ${escapeText(exercise.replacedFromName)}` : ''}</small></div><span class="load-tip">${logged.length}/${exercise.sets}</span></div><div class="coach-target ${suggestion.type}"><strong>${escapeText(suggestion.title)}</strong><small>${escapeText(suggestion.text)}${plateauFor(exercise.id) ? ' · La tendance hebdomadaire sera vérifiée séparément.' : ''}</small></div><p class="previous-sets">${previousText(exercise.id)}</p><div class="exercise-progress"><span>${logged.length} sur ${exercise.sets}</span><div class="exercise-progress-track"><div class="exercise-progress-fill" style="width:${progress}%"></div></div></div><div class="exercise-quick-actions"><button class="technique-guide-button" type="button">◎ Technique</button><button class="replace-exercise-button" type="button"${replaceDisabled}>⇄ Remplacer</button><button class="skip-exercise-button" type="button">↷ ${skipped ? 'Déjà passé' : 'Passer'}</button></div>${entry}<div class="logged-sets">${logged.map(renderLoggedSet).join('')}</div></div>`;

    $('previousExerciseBtn').disabled = currentIndex === 0;
    $('nextExerciseBtn').disabled = currentIndex === exercises.length - 1;
    $('finishSessionBtn').textContent = loggedSets >= totalSets ? 'Terminer et voir mon bilan' : `Terminer la séance · ${overallPercent} %`;

    $$('[data-session-exercise-index]').forEach((button) => button.addEventListener('click', () => setCurrentExercise(Number(button.dataset.sessionExerciseIndex))));
    document.querySelector('.add-training-set')?.addEventListener('click', () => addTrainingSet(document.querySelector('.focused-exercise-card'), day));
    document.querySelector('.technique-guide-button')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('macroflow:open-technique-guide', { detail: { exercise: structuredClone(exercise), profile: structuredClone(data.profile || {}), loggedSets: structuredClone(logged) } })));
    document.querySelector('.replace-exercise-button')?.addEventListener('click', () => openReplaceExercise(currentIndex));
    document.querySelector('.skip-exercise-button')?.addEventListener('click', skipCurrentExercise);
    document.querySelector('.resume-exercise-button')?.addEventListener('click', resumeCurrentExercise);
    $$('.edit-set-button').forEach((button) => button.addEventListener('click', () => { editingSetId = button.closest('[data-set-id]').dataset.setId; renderSession(); }));
    $$('.save-set-button').forEach((button) => button.addEventListener('click', () => saveEditedSet(button.closest('[data-edit-set]'))));
    $$('.cancel-set-edit').forEach((button) => button.addEventListener('click', () => { editingSetId = null; renderSession(); }));
    $$('.delete-set-button').forEach((button) => button.addEventListener('click', () => deleteTrainingSet(button.closest('[data-edit-set]').dataset.editSet)));
    $$('.technique-quality-button').forEach((button) => button.addEventListener('click', () => {
      const container = button.closest('.technique-quality'); const input = container?.querySelector('.set-technique'); if (!input) return;
      const alreadySelected = input.value === button.dataset.techniqueQuality;
      input.value = alreadySelected ? '' : button.dataset.techniqueQuality;
      container.querySelectorAll('.technique-quality-button').forEach((option) => option.setAttribute('aria-pressed', String(!alreadySelected && option === button)));
      container.querySelector('.technique-pain-warning')?.classList.toggle('hidden', input.value !== 'pain');
    }));
    startSessionClock();
  }

  function addTrainingSet(element, day) {
    const exercise = activeSessionExercises(day).find((item) => item.id === element.dataset.exercise);
    if (!exercise) return;
    const weight = Number(element.querySelector('.set-weight').value); const reps = Number(element.querySelector('.set-reps').value);
    const rirText = element.querySelector('.set-rir').value; const rir = rirText === '' ? null : Number(rirText);
    const techniqueQuality = element.querySelector('.set-technique')?.value || null;
    if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(reps) || reps < 1 || (rir != null && (!Number.isFinite(rir) || rir < 0 || rir > 5))) return;
    if (data.activeSession.sets.filter((set) => set.exerciseId === exercise.id).length >= exercise.sets) return;
    const set = {
      id: uid(), exerciseId: exercise.id, exerciseName: exercise.name, weight, reps, rir, techniqueQuality,
      exerciseMuscle: exercise.muscle,
      exerciseSecondary: [...(exercise.secondary || [])],
      createdAt: new Date().toISOString(),
    };
    data.activeSession.sets.push(set);
    window.dispatchEvent(new CustomEvent('macroflow:add-training-set', { detail: set }));
    const exerciseComplete = data.activeSession.sets.filter((item) => item.exerciseId === exercise.id).length >= exercise.sets;
    if (exerciseComplete) {
      const exercises = activeSessionExercises(day); const currentIndex = data.activeSession.currentExerciseIndex;
      const nextIndex = nextPendingExerciseIndex(exercises, currentIndex);
      if (nextIndex >= 0) data.activeSession.currentExerciseIndex = nextIndex;
    }
    save(); renderSession(); startRest(exercise.restSeconds);
    if (techniqueQuality === 'pain') showSessionNotice('Douleur enregistrée : ne force pas à travers. Arrête ou remplace ce mouvement et fais évaluer toute douleur nouvelle ou inexpliquée.');
    if (exerciseComplete) window.setTimeout(() => { const card = document.querySelector('.focused-exercise-card'); window.MacroFlowDelight?.pulse(card); window.MacroFlowDelight?.haptic('success'); }, 20);
  }

  function saveEditedSet(element) {
    const set = data.activeSession?.sets.find((item) => item.id === element?.dataset.editSet);
    if (!set) return;
    const weight = Number(element.querySelector('.edit-set-weight').value); const reps = Number(element.querySelector('.edit-set-reps').value);
    const rirText = element.querySelector('.edit-set-rir').value; const rir = rirText === '' ? null : Number(rirText);
    const techniqueQuality = element.querySelector('.edit-set-technique')?.value || null;
    if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(reps) || reps < 1 || (rir != null && (!Number.isFinite(rir) || rir < 0 || rir > 5))) return showSessionNotice('Vérifie le poids, les répétitions et le RIR.');
    Object.assign(set, { weight, reps, rir, techniqueQuality, editedAt: new Date().toISOString() });
    editingSetId = null; save(); renderSession(); showSessionNotice('Série modifiée.');
  }

  function deleteTrainingSet(setId) {
    if (!data.activeSession) return;
    data.activeSession.sets = data.activeSession.sets.filter((set) => set.id !== setId);
    editingSetId = null; save(); renderSession(); showSessionNotice('Série supprimée.');
  }

  function skipCurrentExercise() {
    if (!data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const current = exercises[data.activeSession.currentExerciseIndex];
    if (!data.activeSession.skippedExerciseIds.includes(current.id)) data.activeSession.skippedExerciseIds.push(current.id);
    const nextIndex = nextPendingExerciseIndex(exercises, data.activeSession.currentExerciseIndex);
    if (nextIndex >= 0) data.activeSession.currentExerciseIndex = nextIndex;
    editingSetId = null; save(); renderSession(); showSessionNotice(`${current.name} passé pour aujourd’hui.`);
  }

  function resumeCurrentExercise() {
    if (!data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const current = exercises[data.activeSession.currentExerciseIndex];
    data.activeSession.skippedExerciseIds = data.activeSession.skippedExerciseIds.filter((id) => id !== current.id);
    save(); renderSession(); showSessionNotice(`${current.name} repris.`);
  }

  function replacementCandidates(exercise, query = '') {
    if (!exercise || !data.activeSession) return [];
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const profile = normalizeProfile(data.profile); const used = new Set(exercises.map((item) => item.id)); const clean = normalizeSearch(query);
    return Object.entries(EX).filter(([id, item]) => id !== exercise.id && !used.has(id) && item.pattern === exercise.pattern && equipmentCompatible(item, profile) && !profile.dislikes.includes(id) && !patternAvoided(item.pattern, profile) && (!clean || exerciseSearchText(id, item).includes(clean))).sort(([idA, a], [idB, b]) => exerciseQualityScore(idB, b, profile) - exerciseQualityScore(idA, a, profile) || a.name.localeCompare(b.name, 'fr'));
  }

  function renderReplacementOptions() {
    if (replaceExerciseIndex == null || !data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const exercise = exercises[replaceExerciseIndex]; if (!exercise) return;
    const candidates = replacementCandidates(exercise, $('replaceExerciseSearch').value);
    $('replaceExerciseResults').innerHTML = candidates.length ? candidates.map(([id, item]) => `<button class="replace-exercise-option" data-replace-exercise="${id}" type="button"><span><b>${escapeText(item.name)}</b><small>${escapeText(MUSCLES[item.muscle] || item.muscle)} · ${escapeText(equipmentSummary(item))}</small><small>${escapeText(selectionReason(id, item, normalizeProfile(data.profile)))}</small></span><span>›</span></button>`).join('') : '<p class="plate-empty">Aucune autre variante compatible trouvée pour ce mouvement et ton matériel.</p>';
    $$('[data-replace-exercise]').forEach((button) => button.addEventListener('click', () => applyExerciseReplacement(button.dataset.replaceExercise)));
  }

  function openReplaceExercise(index) {
    if (!data.activeSession) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const exercise = exercises[index]; if (!exercise) return;
    if (sessionSetsFor(exercise.id).length) return showSessionNotice('Supprime d’abord les séries de cet exercice pour pouvoir le remplacer.');
    replaceExerciseIndex = index;
    $('replaceExerciseTitle').textContent = `Remplacer ${exercise.name}`;
    $('replaceExerciseLead').textContent = 'MacroFlow affiche seulement les variantes du même type de mouvement compatibles avec ton matériel.';
    $('replaceExerciseSearch').value = '';
    renderReplacementOptions();
    $('replaceExerciseModal').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  }

  function closeReplaceExercise() {
    replaceExerciseIndex = null; $('replaceExerciseModal').classList.add('hidden'); document.body.style.overflow = '';
  }

  function applyExerciseReplacement(replacementId) {
    if (replaceExerciseIndex == null || !data.activeSession || !EX[replacementId]) return;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); const exercises = activeSessionExercises(day);
    const original = exercises[replaceExerciseIndex];
    if (!original || sessionSetsFor(original.id).length) return;
    if (!replacementCandidates(original).some(([id]) => id === replacementId)) return showSessionNotice('Cette variante ne respecte pas ton matériel ou tes exclusions.');
    const configured = exerciseConfig(replacementId, EX[replacementId], original.order, normalizeProfile(data.profile));
    const replacement = {
      ...configured,
      sets: original.sets, minRep: original.minRep, maxRep: original.maxRep, restSeconds: original.restSeconds,
      targetRir: original.targetRir, priorityBoost: original.priorityBoost,
      replacedFromId: original.replacedFromId || original.id, replacedFromName: original.replacedFromName || original.name,
    };
    exercises[replaceExerciseIndex] = replacement;
    data.activeSession.skippedExerciseIds = data.activeSession.skippedExerciseIds.filter((id) => id !== original.id);
    if (!data.activeSession.coachTargets) data.activeSession.coachTargets = {};
    delete data.activeSession.coachTargets[original.id];
    data.activeSession.coachTargets[replacement.id] = suggestionFor(replacement);
    closeReplaceExercise(); save(); renderSession(); showSessionNotice(`${original.name} remplacé par ${replacement.name}.`);
  }

  function startSessionClock() {
    stopSessionClock();
    const tick = () => { const seconds = Math.max(0, Math.floor((Date.now() - new Date(data.activeSession.startedAt).getTime()) / 1000)); $('sessionClock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
    tick(); sessionTicker = setInterval(tick, 1000);
  }
  function stopSessionClock() { if (sessionTicker) clearInterval(sessionTicker); sessionTicker = null; }
  function showSessionNotice(message) {
    const notice = $('trainingSessionNotice'); if (!notice) return;
    notice.textContent = message; notice.classList.remove('hidden');
    clearTimeout(sessionNoticeTimer); sessionNoticeTimer = setTimeout(() => notice.classList.add('hidden'), 3200);
  }
  function startRest(seconds) { restTotal = Math.max(1, Number(seconds) || 1); restRemaining = restTotal; $('restTimer').classList.remove('hidden'); renderRest(); if (restTicker) clearInterval(restTicker); restTicker = setInterval(() => { restRemaining -= 1; renderRest(); if (restRemaining <= 0) { stopRest(); showSessionNotice('Repos terminé — tu peux repartir quand ta technique est prête.'); window.MacroFlowDelight?.haptic('success', true); } }, 1000); }
  function renderRest() {
    const timer = $('restTimer'); const remaining = Math.max(0, restRemaining); const progress = Math.max(0, Math.min(100, (remaining / Math.max(1, restTotal)) * 100));
    $('restTimerValue').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    timer.style.setProperty('--rest-progress', `${progress}%`); timer.classList.toggle('rest-soon', remaining > 0 && remaining <= 15);
  }
  function adjustRest(seconds) {
    if (!restTicker && $('restTimer').classList.contains('hidden')) return;
    restRemaining = Math.max(0, restRemaining + Number(seconds || 0));
    restTotal = Math.max(restTotal, restRemaining);
    if (restRemaining <= 0) { stopRest(); showSessionNotice('Repos terminé manuellement.'); return; }
    renderRest();
  }
  function stopRest() { if (restTicker) clearInterval(restTicker); restTicker = null; $('restTimer').classList.add('hidden'); $('restTimer').classList.remove('rest-soon'); }

  function performanceScoreForSets(sets = []) {
    const weighted = sets.filter((set) => Number(set.weight) > 0 && Number(set.reps) >= 1 && Number(set.reps) <= 15);
    if (weighted.length) return Math.max(...weighted.map((set) => Number(set.weight) * (1 + (Number(set.reps) + (Number.isFinite(set.rir) ? Number(set.rir) : 0)) / 30)));
    return sets.reduce((sum, set) => sum + Math.max(0, Number(set.reps) || 0), 0);
  }

  function estimatedOneRepMax(sets = []) {
    const values = sets.filter((set) => Number(set.weight) > 0 && Number(set.reps) >= 1 && Number(set.reps) <= 15).map((set) => Number(set.weight) * (1 + Number(set.reps) / 30));
    return values.length ? Math.max(...values) : 0;
  }

  function buildSessionSummary(session, day) {
    const sessionExerciseList = Array.isArray(session.exercises) && session.exercises.length ? session.exercises : day.exercises;
    const prescribedSets = sessionExerciseList.reduce((sum, exercise) => sum + exercise.sets, 0); const loggedSets = session.sets.length;
    const exercises = sessionExerciseList.map((exercise) => {
      const current = session.sets.filter((set) => set.exerciseId === exercise.id); const history = exerciseHistory(exercise.id); const previous = history[0]?.sets || [];
      const currentScore = performanceScoreForSets(current); const previousScore = performanceScoreForSets(previous); const first = !previous.length && current.length > 0;
      const improved = !first && current.length > 0 && previousScore > 0 && currentScore > previousScore * 1.005;
      const currentE1rm = estimatedOneRepMax(current); const previousBestE1rm = Math.max(0, ...history.map((entry) => estimatedOneRepMax(entry.sets)));
      const pr = currentE1rm > 0 && previousBestE1rm > 0 && currentE1rm > previousBestE1rm * 1.005;
      return { exerciseId: exercise.id, name: exercise.name, loggedSets: current.length, prescribedSets: exercise.sets, status: first ? 'first' : improved ? 'improved' : 'steady', pr, e1rm: currentE1rm ? round(currentE1rm, 0.5) : null };
    });
    const progressions = exercises.filter((exercise) => exercise.status === 'improved').length; const prs = exercises.filter((exercise) => exercise.pr).length;
    const completionRate = prescribedSets ? Math.round((loggedSets / prescribedSets) * 100) : 0; const durationSeconds = session.durationSeconds;
    let message = 'Une nouvelle référence est enregistrée. Continue à noter le RIR pour rendre les prochaines propositions plus précises.';
    if (completionRate < 75) message = 'Séance partielle enregistrée. MacroFlow la conserve, mais évitera de tirer une grande conclusion d’une seule séance incomplète.';
    else if (prs) message = `${prs} nouveau${prs > 1 ? 'x' : ''} record${prs > 1 ? 's' : ''} estimé${prs > 1 ? 's' : ''}. La prochaine charge restera malgré tout une proposition à confirmer.`;
    else if (progressions) message = `${progressions} exercice${progressions > 1 ? 's progressent' : ' progresse'} à effort comparable. Pas besoin de bouleverser un programme qui avance.`;
    return { createdAt: new Date().toISOString(), prescribedSets, loggedSets, completionRate, durationSeconds, volumeKg: round(session.sets.reduce((sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0), 0), 1), progressions, prs, message, exercises };
  }

  function renderSessionSummary() {
    const modal = $('sessionSummaryModal'); const session = data.sessions.find((item) => item.id === data.sessionSummaryId); const summary = session?.summary;
    if (!session || !summary) { modal.classList.add('hidden'); return; }
    const dialog = $('sessionSummaryDialog'); dialog.classList.toggle('has-pr', summary.prs > 0); $('sessionSummaryIcon').textContent = summary.prs ? '🏆' : summary.progressions ? '📈' : '✅';
    $('sessionSummaryTitle').textContent = `${session.name} terminée`; $('sessionSummaryLead').textContent = summary.message;
    $('sessionSummaryGrid').innerHTML = `<div><strong>${Math.round(summary.durationSeconds / 60)} min</strong><small>Durée</small></div><div><strong>${summary.loggedSets}/${summary.prescribedSets}</strong><small>Séries</small></div><div><strong>${summary.volumeKg} kg</strong><small>Volume enregistré</small></div><div><strong>${summary.prs ? `🏆 ${summary.prs}` : summary.progressions}</strong><small>${summary.prs ? 'Records estimés' : 'Progressions'}</small></div>`;
    const labels = { first: 'Première référence', improved: 'En progrès', steady: 'Référence conservée' };
    $('sessionSummaryExercises').innerHTML = summary.exercises.filter((exercise) => exercise.loggedSets).map((exercise) => `<div class="session-summary-row"><div><b>${escapeText(exercise.name)}</b><small>${exercise.loggedSets}/${exercise.prescribedSets} séries${exercise.e1rm ? ` · 1RM estimé ${exercise.e1rm} kg` : ''}</small></div><span class="session-summary-status ${exercise.status}">${exercise.pr ? '🏆 Record estimé' : labels[exercise.status]}</span></div>`).join('') || '<p class="plate-empty">Aucune série enregistrée.</p>';
    modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
  }

  function closeSessionSummary(destination = 'stay') {
    data.sessionSummaryId = null; save(); $('sessionSummaryModal').classList.add('hidden'); document.body.style.overflow = '';
    if (destination === 'history') { document.querySelector('[data-tab="workout"]')?.click(); switchTab('history'); }
    if (destination === 'home') document.querySelector('[data-tab="home"]')?.click();
  }

  function sessionCompletionDetails() {
    if (!data.activeSession) return null;
    const day = data.program?.days.find((item) => item.id === data.activeSession.dayId); if (!day) return null;
    const exercises = activeSessionExercises(day);
    const prescribedSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const loggedSets = data.activeSession.sets.length;
    const incomplete = exercises.map((exercise) => ({ exercise, logged: sessionSetsFor(exercise.id).length, skipped: data.activeSession.skippedExerciseIds.includes(exercise.id) })).filter((item) => item.logged < item.exercise.sets);
    return { day, exercises, prescribedSets, loggedSets, incomplete };
  }

  function requestFinishSession() {
    const details = sessionCompletionDetails(); if (!details) return;
    if (!details.incomplete.length) { finishSession(); return; }
    const percent = details.prescribedSets ? Math.round(details.loggedSets / details.prescribedSets * 100) : 0;
    $('finishSessionLead').textContent = `${details.loggedSets} série${details.loggedSets !== 1 ? 's' : ''} sur ${details.prescribedSets} sont enregistrées (${percent} %). Tu peux continuer ou conserver cette séance comme partielle.`;
    $('finishSessionDetails').innerHTML = details.incomplete.map(({ exercise, logged, skipped }) => `<div><b>${escapeText(exercise.name)}</b> · ${logged}/${exercise.sets} séries${skipped ? ' · passé' : ''}</div>`).join('');
    $('finishSessionModal').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  }

  function closeFinishSession() {
    $('finishSessionModal').classList.add('hidden'); document.body.style.overflow = '';
  }

  async function finishSession() {
    if (!data.activeSession) return;
    const session = data.activeSession; const day = data.program?.days.find((item) => item.id === session.dayId); if (!day) return;
    closeFinishSession(); closeReplaceExercise();
    session.completedAt = new Date().toISOString(); session.durationSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000); session.summary = buildSessionSummary(session, day);
    data.sessions.push(session); data.sessionSummaryId = session.id; data.activeSession = null;
    if (data.activeAdaptation?.type === 'light_week') { data.activeAdaptation.remainingSessions -= 1; if (data.activeAdaptation.remainingSessions <= 0) restoreLightWeek(data.activeAdaptation, true); }
    await save(); stopRest(); stopSessionClock(); renderAll(); switchTab('session'); renderSessionSummary();
    window.dispatchEvent(new CustomEvent('macroflow:session-complete', { detail: session.summary }));
    window.MacroFlowDelight?.haptic('success', true); window.MacroFlowDelight?.pulse($('sessionSummaryDialog'));
  }

  function personalRecords() {
    const records = new Map();
    for (const session of completedSessions()) for (const set of session.sets) {
      if (set.reps > 15 || set.weight <= 0) continue;
      const e1rm = set.weight * (1 + set.reps / 30); const existing = records.get(set.exerciseId);
      if (!existing || e1rm > existing.e1rm) records.set(set.exerciseId, { name: set.exerciseName, weight: set.weight, reps: set.reps, e1rm });
    }
    return [...records.values()].sort((a, b) => b.e1rm - a.e1rm);
  }

  function extraSetFits(day, exerciseId, profile) {
    const simulated = day.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: exercise.sets + 1 } : exercise);
    return estimateMinutes(simulated, profile) <= Number(profile.maxMinutes);
  }

  function evaluateTrainingData(profile, program, sessions, checkIn) {
    const completed = (sessions || []).filter((session) => session.completedAt).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    const exerciseMap = new Map((program?.days || []).flatMap((day) => day.exercises.map((exercise) => [exercise.id, exercise])));
    const exposures = new Map(); let knownRirSets = 0; let totalSets = 0;
    for (const session of completed) {
      const groups = new Map();
      for (const set of session.sets || []) {
        totalSets += 1;
        if (Number.isFinite(set.rir)) knownRirSets += 1;
        if (!groups.has(set.exerciseId)) groups.set(set.exerciseId, []);
        groups.get(set.exerciseId).push(set);
      }
      for (const [exerciseId, sets] of groups) {
        const valid = sets.filter((set) => Number(set.weight) > 0 && Number(set.reps) >= 1 && Number(set.reps) <= 15);
        if (!valid.length || !exerciseMap.has(exerciseId)) continue;
        const score = Math.max(...valid.map((set) => Number(set.weight) * (1 + (Number(set.reps) + (Number.isFinite(set.rir) ? Number(set.rir) : 0)) / 30)));
        if (!exposures.has(exerciseId)) exposures.set(exerciseId, []);
        exposures.get(exerciseId).push({ completedAt: session.completedAt, score });
      }
    }
    const exerciseTrends = [];
    for (const [exerciseId, entries] of exposures) {
      if (entries.length < 4) continue;
      const recent = entries.slice(-4); const earlyAverage = (recent[0].score + recent[1].score) / 2; const lateAverage = (recent[2].score + recent[3].score) / 2;
      const changePercent = earlyAverage ? ((lateAverage - earlyAverage) / earlyAverage) * 100 : 0;
      const status = changePercent > 1.5 ? 'improving' : changePercent < -2 ? 'declining' : 'stable';
      const exercise = exerciseMap.get(exerciseId);
      exerciseTrends.push({ exerciseId, name: exercise.name, muscle: exercise.muscle, status, changePercent: Number(changePercent.toFixed(2)), exposures: entries.length });
    }
    const recentSessions = completed.slice(-Math.max(6, Number(profile?.days || 3) * 3)); let prescribedSets = 0; let completedSets = 0;
    for (const session of recentSessions) {
      const day = program?.days?.find((item) => item.id === session.dayId);
      prescribedSets += day ? day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) : 0;
      completedSets += (session.sets || []).length;
    }
    const adherence = prescribedSets ? Math.min(1.2, completedSets / prescribedSets) : 0;
    const rirCoverage = totalSets ? knownRirSets / totalSets : 0;
    const recentRirs = recentSessions.flatMap((session) => session.sets || []).map((set) => set.rir).filter(Number.isFinite);
    const averageRir = recentRirs.length ? recentRirs.reduce((sum, value) => sum + value, 0) / recentRirs.length : null;
    const improving = exerciseTrends.filter((item) => item.status === 'improving'); const declining = exerciseTrends.filter((item) => item.status === 'declining'); const stable = exerciseTrends.filter((item) => item.status === 'stable');
    const summary = { completedSessions: completed.length, analyzedExercises: exerciseTrends.length, improving: improving.length, stable: stable.length, declining: declining.length, adherence: Number((adherence * 100).toFixed(0)), rirCoverage: Number((rirCoverage * 100).toFixed(0)), averageRir: averageRir == null ? null : Number(averageRir.toFixed(1)), exerciseTrends };
    if (checkIn.pain === 'unsure') return { summary, recommendation: { status: 'blocked', type: 'none', title: 'Analyse bloquée par sécurité', reason: 'Une douleur inexpliquée ne doit pas être gérée par un changement automatique de séries. Fais-la d’abord évaluer par un professionnel qualifié.' } };
    if (checkIn.pain === 'managed') return { summary, recommendation: { status: 'hold', type: 'none', title: 'Programme conservé', reason: 'Une douleur gérée est présente. MacroFlow conserve le plan plutôt que d’augmenter ou réduire le volume sans connaître les consignes du professionnel.' } };
    const calibration = calibrationStatus(program, sessions);
    if (!calibration.complete) return { summary, recommendation: { status: 'calibrating', type: 'none', title: 'Calibration toujours en cours', reason: calibration.enoughSessions ? `Les séances prévues sont enregistrées, mais l’adhérence est ${calibration.adherence} % et le RIR est saisi sur ${calibration.rirCoverage} % des séries. MacroFlow attend des données comparables avant de modifier le volume.` : `${calibration.completedSessions}/${calibration.targetSessions} séances de calibration sont terminées. Les charges progressent déjà séance par séance, mais le volume global reste stable.` } };
    if (completed.length < 4 || exerciseTrends.length < 2) return { summary, recommendation: { status: 'insufficient', type: 'none', title: 'Encore trop peu de données', reason: 'Il faut au moins quatre expositions comparables sur deux exercices avant de distinguer une tendance d’une variation normale.' } };
    if (adherence < 0.75) return { summary, recommendation: { status: 'hold', type: 'none', title: 'On garde le programme', reason: `Environ ${Math.round(adherence * 100)} % des séries prévues ont été enregistrées. Il faut d’abord suivre le plan plus régulièrement avant de modifier son volume.` } };
    if (rirCoverage < 0.6) return { summary, recommendation: { status: 'hold', type: 'none', title: 'RIR insuffisamment enregistré', reason: 'MacroFlow ne peut pas comparer correctement des performances sans savoir si les séries étaient faciles ou proches de l’échec.' } };
    if (averageRir != null && averageRir > 3.2) return { summary, recommendation: { status: 'hold', type: 'none', title: 'Effort à calibrer avant le volume', reason: `Le RIR moyen est ${averageRir.toFixed(1).replace('.', ',')}. Rapproche progressivement les séries de la cible du programme avant d’ajouter des séries.` } };
    const fatigueFlags = [Number(checkIn.recovery) <= 2, Number(checkIn.soreness) >= 4, Number(checkIn.motivation) <= 2, Number(checkIn.sleep) <= 2].filter(Boolean).length;
    if (fatigueFlags >= 2 && (declining.length >= 1 || stable.length >= 2)) return { summary, recommendation: { status: 'pending', type: 'light_week', title: 'Proposition : semaine plus légère', reason: 'Plusieurs signaux de fatigue sont présents et les performances ne progressent pas. MacroFlow propose temporairement moins de séries et un RIR plus élevé.', remainingSessions: Math.max(1, Number(profile.days) || 3) } };
    if (improving.length >= Math.max(1, Math.ceil(exerciseTrends.length / 3))) return { summary, recommendation: { status: 'on_track', type: 'none', title: 'Le programme fonctionne', reason: `${improving.length} exercice${improving.length > 1 ? 's progressent' : ' progresse'} avec une adhérence suffisante. Aucun changement n’est justifié.` } };
    if (!declining.length && stable.length >= 2) {
      const muscleCounts = stable.reduce((acc, item) => { acc[item.muscle] = (acc[item.muscle] || 0) + 1; return acc; }, {});
      const targetMuscle = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1])[0]?.[0]; const volumes = weeklyVolume(program);
      const possibleCandidates = program.days.flatMap((day) => day.exercises.map((exercise) => ({ day, exercise }))).filter(({ exercise }) => exercise.muscle === targetMuscle && exercise.sets < 4).sort((a, b) => a.exercise.sets - b.exercise.sets);
      const candidate = possibleCandidates.find(({ day, exercise }) => extraSetFits(day, exercise.id, profile));
      if (targetMuscle && candidate && Number(volumes[targetMuscle] || 0) < 10) return { summary, recommendation: { status: 'pending', type: 'add_set', title: `Proposition : +1 série de ${MUSCLES[targetMuscle]}`, reason: 'Les performances sont stables, la récupération est correcte et le volume direct reste modéré. Une seule série hebdomadaire supplémentaire est le plus petit test utile.', target: { muscle: targetMuscle, dayId: candidate.day.id, exerciseId: candidate.exercise.id, exerciseName: candidate.exercise.name } } };
      if (targetMuscle && possibleCandidates.length && Number(volumes[targetMuscle] || 0) < 10) return { summary, recommendation: { status: 'hold', type: 'none', title: 'Temps de séance déjà utilisé', reason: `Une série supplémentaire pourrait être utile pour ${MUSCLES[targetMuscle]}, mais elle dépasserait la durée que tu as choisie. MacroFlow conserve le plan au lieu d’allonger la séance silencieusement.` } };
      return { summary, recommendation: { status: 'hold', type: 'none', title: 'Volume déjà suffisant', reason: 'La tendance est stable, mais le volume n’est pas bas. Ajouter des séries n’est pas automatiquement la solution; vérifie d’abord la technique, la charge et la régularité.' } };
    }
    return { summary, recommendation: { status: 'hold', type: 'none', title: 'On observe encore', reason: 'Les données sont mélangées : certaines performances baissent sans signal assez clair pour conclure à un manque de volume ou à une fatigue accumulée.' } };
  }

  function collectTrainingReview() {
    return { recovery: Number($('trainingReviewRecovery').value), soreness: Number($('trainingReviewSoreness').value), motivation: Number($('trainingReviewMotivation').value), sleep: Number($('trainingReviewSleep').value), pain: $('trainingReviewPain').value };
  }

  async function analyzeTrainingReview() {
    if (!data.program || !data.profile) return;
    data.trainingReviews = Array.isArray(data.trainingReviews) ? data.trainingReviews : []; data.trainingAdjustments = Array.isArray(data.trainingAdjustments) ? data.trainingAdjustments : [];
    if (data.trainingAdjustments.some((entry) => entry.status === 'pending')) return;
    const previous = data.trainingReviews.at(-1);
    if (previous && Date.now() - new Date(previous.createdAt).getTime() < 6 * 86400000) { $('trainingReviewStatus').textContent = 'Un bilan a déjà été enregistré cette semaine.'; return; }
    const checkIn = collectTrainingReview(); const analysis = evaluateTrainingData(data.profile, data.program, data.sessions, checkIn);
    const review = { id: uid(), createdAt: new Date().toISOString(), checkIn, summary: analysis.summary, recommendation: analysis.recommendation };
    const adjustment = { id: uid(), reviewId: review.id, createdAt: review.createdAt, baseProgramId: data.program.id, ...analysis.recommendation, summary: analysis.summary };
    data.trainingReviews.push(review); data.trainingAdjustments.push(adjustment); await save(); renderHistory(); renderProfile();
  }

  function restoreLightWeek(adaptation, completed = true) {
    if (!adaptation || !data.program) return;
    for (const original of adaptation.originals || []) {
      const exercise = data.program.days.find((day) => day.id === original.dayId)?.exercises.find((item) => item.id === original.exerciseId);
      if (exercise) { exercise.sets = original.sets; exercise.targetRir = original.targetRir; }
    }
    const adjustment = data.trainingAdjustments.find((entry) => entry.id === adaptation.adjustmentId);
    if (adjustment) { adjustment.status = completed ? 'completed' : 'cancelled'; adjustment.completedAt = new Date().toISOString(); }
    data.program.days.forEach((day) => updateDayDuration(day, data.profile));
    data.program.qualityReport = programQualityReport(data.program, normalizeProfile(data.profile), data.program.qualityReport?.omissions || []);
    data.activeAdaptation = null;
  }

  function applyTrainingAdjustment(id) {
    const adjustment = data.trainingAdjustments.find((entry) => entry.id === id && entry.status === 'pending');
    if (!adjustment || adjustment.baseProgramId !== data.program?.id) return;
    if (adjustment.type === 'add_set') {
      const exercise = data.program.days.find((day) => day.id === adjustment.target.dayId)?.exercises.find((item) => item.id === adjustment.target.exerciseId);
      if (!exercise || exercise.sets >= 4) return;
      adjustment.beforeSets = exercise.sets; exercise.sets += 1; adjustment.afterSets = exercise.sets; adjustment.status = 'applied'; adjustment.appliedAt = new Date().toISOString();
    } else if (adjustment.type === 'light_week') {
      const originals = data.program.days.flatMap((day) => day.exercises.map((exercise) => ({ dayId: day.id, exerciseId: exercise.id, sets: exercise.sets, targetRir: exercise.targetRir })));
      for (const day of data.program.days) for (const exercise of day.exercises) { exercise.sets = Math.max(1, Math.round(exercise.sets * 0.6)); exercise.targetRir = Math.min(4, exercise.targetRir + 1); }
      data.activeAdaptation = { id: uid(), adjustmentId: adjustment.id, type: 'light_week', appliedAt: new Date().toISOString(), remainingSessions: adjustment.remainingSessions, originals };
      adjustment.status = 'applied'; adjustment.appliedAt = new Date().toISOString();
    }
    data.program.days.forEach((day) => updateDayDuration(day, data.profile));
    data.program.qualityReport = programQualityReport(data.program, normalizeProfile(data.profile), data.program.qualityReport?.omissions || []);
    save(); renderAll();
  }

  function dismissTrainingAdjustment(id) {
    const adjustment = data.trainingAdjustments.find((entry) => entry.id === id && entry.status === 'pending');
    if (!adjustment) return;
    adjustment.status = 'dismissed'; adjustment.dismissedAt = new Date().toISOString(); save(); renderHistory();
  }

  function renderTrainingRecommendation() {
    const container = $('trainingAdaptationRecommendation'); const latest = (data.trainingAdjustments || []).at(-1);
    if (!latest || !['pending', 'on_track', 'hold', 'blocked', 'insufficient'].includes(latest.status)) { container.classList.add('hidden'); container.innerHTML = ''; return; }
    const summary = latest.summary || {}; const actions = latest.status === 'pending' ? `<div class="recommendation-actions"><button class="recommendation-dismiss" data-dismiss-training-adjustment="${latest.id}" type="button">Conserver mon plan</button><button class="recommendation-apply" data-apply-training-adjustment="${latest.id}" type="button">Appliquer</button></div>` : '';
    container.innerHTML = `<strong>${escapeText(latest.title)}</strong><small>${escapeText(latest.reason)}</small><small>${summary.completedSessions || 0} séances · ${summary.analyzedExercises || 0} exercices analysés · adhérence ${summary.adherence || 0} % · RIR saisi ${summary.rirCoverage || 0} %</small>${actions}`;
    container.classList.remove('hidden');
    container.querySelector('[data-apply-training-adjustment]')?.addEventListener('click', () => applyTrainingAdjustment(latest.id));
    container.querySelector('[data-dismiss-training-adjustment]')?.addEventListener('click', () => dismissTrainingAdjustment(latest.id));
  }

  function renderTrainingReviewHistory() {
    const labels = { pending: 'À confirmer', applied: 'Appliqué', completed: 'Terminé', cancelled: 'Annulé', dismissed: 'Refusé', on_track: 'Aucun changement', hold: 'Plan conservé', blocked: 'Bloqué', calibrating: 'Calibration', insufficient: 'Données insuffisantes' };
    const rows = [...(data.trainingAdjustments || [])].reverse().slice(0, 8);
    $('trainingReviewHistory').innerHTML = rows.length ? rows.map((entry) => `<div class="history-row"><b>${new Date(entry.createdAt).toLocaleDateString('fr-CA')} · ${labels[entry.status] || entry.status}</b><small>${escapeText(entry.title)} · ${entry.summary?.improving || 0} en progrès, ${entry.summary?.stable || 0} stables, ${entry.summary?.declining || 0} en baisse</small></div>`).join('') : '<p class="plate-empty">Aucun bilan pour le moment.</p>';
  }

  function renderHistory() {
    const records = personalRecords();
    $('personalRecords').innerHTML = records.length ? records.slice(0, 8).map((record) => `<div class="pr-card"><strong>${round(record.e1rm, 0.5)} kg</strong><small>${escapeText(record.name)} · 1RM estimé</small></div>`).join('') : '<p class="plate-empty">Les records apparaîtront après tes séances.</p>';
    const sessions = completedSessions();
    $('trainingHistory').innerHTML = sessions.length ? sessions.slice(0, 20).map((session) => `<div class="history-row"><b>${escapeText(session.name)} · ${session.sets.length} séries${session.summary?.prs ? ` · 🏆 ${session.summary.prs}` : ''}</b><small>${new Date(session.completedAt).toLocaleDateString('fr-CA')} · ${Math.round(session.durationSeconds / 60)} min · ${round(session.sets.reduce((sum, set) => sum + set.weight * set.reps, 0), 1)} kg de volume${session.summary?.progressions ? ` · ${session.summary.progressions} progression${session.summary.progressions > 1 ? 's' : ''}` : ''}</small></div>`).join('') : '<p class="plate-empty">Aucune séance terminée.</p>';
    const plateauCount = data.program ? [...new Set(data.program.days.flatMap((day) => day.exercises.map((exercise) => exercise.id)))].filter(plateauFor).length : 0;
    const advice = $('deloadAdvice');
    if (plateauCount >= 3) { advice.textContent = `${plateauCount} exercices n’ont pas progressé sur quatre expositions. Vérifie d’abord sommeil, technique et effort. Si la fatigue est élevée, une semaine avec moins de séries peut être utile; MacroFlow ne l’impose pas automatiquement.`; advice.classList.remove('hidden'); }
    else advice.classList.add('hidden');
    const eligible = (data.sessions || []).filter((session) => session.completedAt).length;
    const calibration = data.program ? calibrationStatus(data.program, data.sessions || []) : null;
    $('trainingReviewStatus').textContent = data.activeAdaptation?.type === 'light_week' ? `Semaine légère active · ${data.activeAdaptation.remainingSessions} séance${data.activeAdaptation.remainingSessions > 1 ? 's' : ''} restante${data.activeAdaptation.remainingSessions > 1 ? 's' : ''}.` : calibration && !calibration.complete ? `Calibration · ${Math.min(calibration.completedSessions, calibration.targetSessions)}/${calibration.targetSessions} séances · adhérence ${calibration.adherence} % · RIR ${calibration.rirCoverage} %.` : eligible < 4 ? `${eligible}/4 séances terminées avant la première analyse minimale.` : 'Calibration terminée. Prêt à analyser lorsque plusieurs exercices ont quatre expositions comparables.';
    renderTrainingRecommendation(); renderTrainingReviewHistory();
  }

  function switchTab(name) {
    $$('[data-training-tab]').forEach((button) => button.classList.toggle('active', button.dataset.trainingTab === name));
    $$('[data-training-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.trainingPanel === name));
  }

  function renderAll() {
    renderProfile(); renderSession(); renderHistory(); renderTodayCoach(); renderSessionSummary();
    $('trainingHeroTitle').textContent = data.program ? `${splitName(data.program.split)} · ${data.program.days.length} jours` : 'Construis ton programme';
    $('trainingHeroText').textContent = data.program ? `Plan déterministe de ${data.profile.name} : alternance musculaire, autres activités, matériel et récupération pris en compte.` : 'Réponds au questionnaire pour créer un plan réaliste, personnel et explicable.';
    window.dispatchEvent(new CustomEvent('macroflow:training-state-rendered', { detail: {
      profile: data.profile, program: data.program, activeSession: data.activeSession,
      sessions: (data.sessions || []).map((item) => ({ ...item, sets: (item.sets || []).map((set) => ({ ...set })) })),
      trainingReviews: (data.trainingReviews || []).map((item) => ({ ...item })),
      dailyCoachDecisions: (data.dailyCoachDecisions || []).map((item) => ({ ...item })),
    } }));
  }

  function bind() {
    initializeCardSelects();
    initializeExercisePickers();
    $$('[data-training-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.trainingTab)));
    $('finishSessionBtn').addEventListener('click', requestFinishSession);
    $('previousExerciseBtn').addEventListener('click', () => moveCurrentExercise(-1));
    $('nextExerciseBtn').addEventListener('click', () => moveCurrentExercise(1));
    $('analyzeTrainingBtn').addEventListener('click', analyzeTrainingReview);
    $('skipRestBtn').addEventListener('click', stopRest);
    $('restMinusBtn').addEventListener('click', () => adjustRest(-15));
    $('restPlusBtn').addEventListener('click', () => adjustRest(30));
    $('replaceExerciseSearch').addEventListener('input', renderReplacementOptions);
    $('replaceExerciseCancelBtn').addEventListener('click', closeReplaceExercise);
    $('continueSessionBtn').addEventListener('click', closeFinishSession);
    $('confirmFinishSessionBtn').addEventListener('click', finishSession);
    $('sessionSummaryCloseBtn').addEventListener('click', () => closeSessionSummary('stay'));
    $('sessionSummaryHistoryBtn').addEventListener('click', () => closeSessionSummary('history'));
    $('sessionSummaryDoneBtn').addEventListener('click', () => closeSessionSummary('home'));
    $('editTrainingProfileBtn').addEventListener('click', openOnboarding);
    $('onboardingCloseBtn').addEventListener('click', closeOnboarding);
    $('planReadyBtn').addEventListener('click', () => { $('planReadyModal').classList.add('hidden'); switchTab('program'); });
    $('profileUnits').addEventListener('change', updateConditionalQuestions);
    $('trainingEquipmentPreset').addEventListener('change', (event) => applyEquipmentPreset(event.target.value));
    $('trainingActivityLoad').addEventListener('change', updateConditionalQuestions);
    $('trainingInjury').addEventListener('change', updateConditionalQuestions);
    $$('[name="trainingEquipment"]').forEach((input) => input.addEventListener('change', () => {
      $('trainingEquipmentPreset').value = 'custom'; syncCardSelect($('trainingEquipmentPreset')); renderAllExercisePickers();
    }));
    $$('[name="trainingPriority"]').forEach((input) => input.addEventListener('change', () => enforceChoiceLimit('trainingPriority', 2, input)));
    $$('[data-review-step]').forEach((button) => button.addEventListener('click', () => { onboardingStep = Number(button.dataset.reviewStep); data.onboardingStep = onboardingStep; saveDraft(); renderOnboarding(); }));
    $('trainingOnboarding').addEventListener('input', saveDraft);
    $('trainingOnboarding').addEventListener('change', saveDraft);
    window.addEventListener('macroflow:daily-coach-start', (event) => {
      const request = event.detail || {};
      const day = data.program?.days.find((item) => item.id === request.dayId);
      if (!day || data.activeSession) { if (data.activeSession) openWorkoutSession(); return; }
      data.dailyCoachDecisions = Array.isArray(data.dailyCoachDecisions) ? data.dailyCoachDecisions : [];
      const decision = {
        id: uid(),
        createdAt: new Date().toISOString(),
        dateKey: request.dateKey || localDayKey(),
        weekKey: request.weekKey || localWeekKey(),
        scheduledDayId: request.scheduledDayId || day.id,
        chosenDayId: day.id,
        swapSchedule: Boolean(request.swapSchedule && request.scheduledDayId && request.scheduledDayId !== day.id),
        adjustmentMode: request.adjustment?.mode || 'normal',
      };
      data.dailyCoachDecisions = data.dailyCoachDecisions.filter((item) => item.dateKey !== decision.dateKey);
      data.dailyCoachDecisions.push(decision);
      startSession(day.id, { decisionId: decision.id, adjustment: request.adjustment || null, swapSchedule: decision.swapSchedule, reasons: request.reasons || [] });
    });
    $('onboardingBackBtn').addEventListener('click', () => { if (onboardingStep > 0) { onboardingStep -= 1; data.onboardingStep = onboardingStep; saveDraft(); renderOnboarding(); } });
    $('onboardingNextBtn').addEventListener('click', async () => {
      const error = validateStep(onboardingStep);
      if (error) { showOnboardingError(error); return; }
      if (onboardingStep < 9) { onboardingStep += 1; data.onboardingStep = onboardingStep; saveDraft(); renderOnboarding(); return; }
      $('onboardingNextBtn').disabled = true;
      try { await finishOnboarding(); } finally { $('onboardingNextBtn').disabled = false; }
    });
  }

  const exerciseCatalog = Object.freeze(Object.fromEntries(Object.entries(EX).map(([id, exercise]) => [id, Object.freeze({ id, ...structuredClone(exercise) })])));
  window.MacroFlowTrainingEngine = Object.freeze({ buildProgram, weeklyVolume, chooseSchedule, buildWeeklyLayout, layoutScore, templateFor, volumeTargetFor, calibrationStatus, programRecoveryReport, estimateMinutes, durationBreakdown, estimateNutrition, evaluateTrainingData, nextPerformanceTarget, equipmentCompatible, exerciseQualityScore, programQualityReport, adaptExercisesForDailyCoach, effectiveWeekdayMap, localWeekKey, exerciseCatalog });

  async function initialize() {
    if (!$('trainingApp')) return;
    bind();
    try { data = await load(); } catch (error) { console.warn('Training storage unavailable', error); }
    data.dailyCoachDecisions = Array.isArray(data.dailyCoachDecisions) ? data.dailyCoachDecisions : [];
    renderAll();
    if (data.sessionSummaryId) {
      document.querySelector('[data-tab="workout"]')?.click();
      switchTab('session');
      renderSessionSummary();
    } else if (!data.localProfile || !data.program) {
      document.querySelector('[data-tab="workout"]')?.click();
      openOnboarding();
    }
  }

  initialize().catch((error) => console.warn('Training initialization failed', error));
})();
