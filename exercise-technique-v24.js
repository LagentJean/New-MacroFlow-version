(() => {
  const VERSION = '24.0.0';

  const PATTERN_LABELS = {
    knee: 'Dominante quadriceps',
    horizontalPush: 'Développé horizontal',
    horizontalPull: 'Tirage horizontal',
    verticalPush: 'Développé vertical',
    verticalPull: 'Tirage vertical',
    hinge: 'Charnière de hanche',
    unilateral: 'Jambes unilatéral',
    hamstringIsolation: 'Isolation des ischios',
    quadIsolation: 'Isolation des quadriceps',
    shoulderIsolation: 'Épaules · isolation',
    rearDelt: 'Arrière d’épaule',
    biceps: 'Biceps',
    triceps: 'Triceps',
    calves: 'Mollets',
    core: 'Tronc',
    chestIsolation: 'Pectoraux · isolation',
  };

  const PATTERN_GUIDES = {
    knee: {
      goal: 'Plier les genoux et les hanches sous contrôle en gardant un appui stable.',
      setup: ['Place tout le pied en contact avec le support.', 'Choisis une largeur qui laisse les genoux suivre naturellement les orteils.', 'Inspire et crée une tension du tronc avant la descente.'],
      cues: ['Pied entier stable', 'Genoux dans l’axe des orteils', 'Descends seulement aussi loin que tu contrôles'],
      execution: ['Descends de façon régulière sans relâcher le tronc.', 'Pousse le sol en gardant la trajectoire stable.', 'Garde une amplitude confortable que tu peux répéter.'],
      mistakes: ['Talons ou bord interne du pied qui se soulèvent.', 'Genoux qui s’effondrent nettement vers l’intérieur.', 'Rebond incontrôlé ou amplitude forcée.'],
      breathing: 'Inspire et bloque brièvement la pression du tronc avant la répétition; expire après la portion la plus difficile si cela reste confortable.',
      safety: 'Arrête si une douleur vive ou inhabituelle apparaît au genou, à la hanche ou au dos. Réduis la charge ou l’amplitude si tu perds l’équilibre ou le contrôle.',
    },
    horizontalPush: {
      goal: 'Pousser devant soi avec des poignets stables et une trajectoire contrôlée.',
      setup: ['Place mains et poignets pour que la charge reste au-dessus de l’avant-bras.', 'Stabilise les pieds et le tronc.', 'Choisis une prise qui garde les épaules confortables.'],
      cues: ['Poignet au-dessus de l’avant-bras', 'Tronc et pieds stables', 'Contrôle la descente'],
      execution: ['Abaisse la charge sans perdre l’alignement du poignet et du coude.', 'Pousse avec une trajectoire reproductible.', 'Termine sans projeter les épaules ni forcer l’articulation.'],
      mistakes: ['Poignets fortement cassés vers l’arrière.', 'Coudes ou épaules placés dans une position douloureuse.', 'Rebond ou charge qui descend sans contrôle.'],
      breathing: 'Inspire pendant la descente et expire en poussant; sur une charge lourde, garde brièvement la pression du tronc autour du point difficile.',
      safety: 'Une gêne musculaire normale n’est pas une douleur articulaire. Arrête en cas de douleur vive à l’épaule, au coude ou à la poitrine.',
    },
    horizontalPull: {
      goal: 'Tirer les bras vers le tronc sans transformer le mouvement en élan du corps.',
      setup: ['Stabilise les pieds, le bassin et le tronc.', 'Commence avec une prise ferme mais sans crisper le cou.', 'Place-toi pour obtenir une amplitude sans arrondir ou cambrer excessivement.'],
      cues: ['Torse stable', 'Conduis avec les coudes', 'Retour lent et complet'],
      execution: ['Tire les coudes vers l’arrière dans une trajectoire confortable.', 'Marque un contrôle bref en fin de tirage.', 'Laisse les bras revenir sans que la charge t’arrache.'],
      mistakes: ['Donner un coup de reins pour lancer la charge.', 'Hausser les épaules vers les oreilles.', 'Raccourcir progressivement l’amplitude.'],
      breathing: 'Expire en tirant et inspire pendant le retour contrôlé.',
      safety: 'Réduis la charge si le bas du dos doit produire l’élan ou si l’épaule pince pendant le tirage.',
    },
    verticalPush: {
      goal: 'Pousser au-dessus de la tête tout en gardant le tronc et les épaules sous contrôle.',
      setup: ['Place la charge au-dessus des avant-bras.', 'Superpose le bassin et les côtes sans exagérer la cambrure.', 'Utilise une amplitude qui reste confortable pour les épaules.'],
      cues: ['Côtes au-dessus du bassin', 'Avant-bras sous la charge', 'Monte sans cambrer pour tricher'],
      execution: ['Pousse vers le haut avec une trajectoire proche du corps.', 'Laisse les omoplates bouger naturellement quand les bras montent.', 'Redescends avec la même maîtrise.'],
      mistakes: ['Transformer le mouvement en forte extension du bas du dos.', 'Poignets très cassés ou coudes loin sous la charge.', 'Forcer une amplitude douloureuse.'],
      breathing: 'Inspire et stabilise le tronc avant de pousser; expire une fois le point difficile franchi.',
      safety: 'Arrête si l’épaule pince, si le cou devient douloureux ou si tu dois fortement cambrer pour terminer.',
    },
    verticalPull: {
      goal: 'Tirer depuis au-dessus de la tête avec une épaule contrôlée et sans élan involontaire.',
      setup: ['Fixe solidement la prise et garde le tronc stable.', 'Commence avec les épaules dans une position confortable, sans te laisser pendre passivement si cela fait mal.', 'Choisis une prise qui permet aux coudes de descendre naturellement.'],
      cues: ['Tronc calme', 'Coudes vers les côtés', 'Retour contrôlé en haut'],
      execution: ['Initie le tirage sans secousse.', 'Amène les coudes vers le bas jusqu’à ton amplitude contrôlée.', 'Remonte lentement sans perdre la position des épaules.'],
      mistakes: ['Se balancer ou donner un coup de jambes sans l’avoir prévu.', 'Tirer derrière la nuque.', 'Relâcher brutalement la charge en haut.'],
      breathing: 'Expire pendant le tirage et inspire sur le retour.',
      safety: 'Utilise une assistance ou moins de charge si tu ne peux pas contrôler le départ et le retour. Arrête si l’épaule devient douloureuse.',
    },
    hinge: {
      goal: 'Déplacer les hanches vers l’arrière en gardant la charge proche et le tronc stable.',
      setup: ['Crée trois appuis stables sous chaque pied.', 'Place la charge près du corps et engage légèrement les dorsaux.', 'Inspire et verrouille la position du tronc avant de bouger.'],
      cues: ['Hanches vers l’arrière', 'Charge près du corps', 'Tronc stable du début à la fin'],
      execution: ['Recule les hanches jusqu’à sentir une tension contrôlée dans l’arrière des cuisses.', 'Garde la trajectoire près des jambes.', 'Reviens en poussant le sol et en avançant les hanches, sans hyperextension finale.'],
      mistakes: ['Charge qui s’éloigne du corps.', 'Bas du dos qui change nettement de position sous l’effort.', 'Descendre plus bas que l’amplitude réellement contrôlée.'],
      breathing: 'Inspire et crée une pression abdominale avant la répétition; expire après le point difficile ou au verrouillage.',
      safety: 'Une fatigue musculaire des fessiers et ischios est attendue; une douleur vive au dos ne l’est pas. Arrête et réduis la difficulté si la position du tronc n’est plus contrôlée.',
    },
    unilateral: {
      goal: 'Produire l’effort avec une jambe tout en gardant pied, genou et bassin stables.',
      setup: ['Place le pied de travail entièrement sur le sol ou le support.', 'Choisis une longueur de pas qui te laisse stable.', 'Fixe un point devant toi et prépare le tronc.'],
      cues: ['Pied avant stable', 'Genou dans l’axe du pied', 'Bassin reste de niveau'],
      execution: ['Descends verticalement ou selon la trajectoire prévue sans perdre l’équilibre.', 'Pousse surtout à travers la jambe de travail.', 'Termine la répétition avant de replacer les pieds.'],
      mistakes: ['Pied avant qui roule vers l’intérieur.', 'Impulsion excessive de la jambe arrière.', 'Bassin qui tourne ou chute à chaque répétition.'],
      breathing: 'Inspire pendant la descente, stabilise le tronc, puis expire en remontant.',
      safety: 'Utilise un support ou retire la charge si l’équilibre limite le mouvement. Arrête en cas de douleur vive au genou ou à la hanche.',
    },
    hamstringIsolation: {
      goal: 'Fléchir le genou avec les ischios sans laisser le bassin ou la machine lancer la charge.',
      setup: ['Aligne autant que possible l’axe du genou avec celui de la machine.', 'Ajuste le rouleau pour qu’il ne repose pas directement sur l’articulation.', 'Stabilise le bassin contre le support.'],
      cues: ['Bassin immobile', 'Plie le genou sans élan', 'Retour lent'],
      execution: ['Fléchis jusqu’à une contraction forte mais contrôlée.', 'Marque brièvement la position.', 'Reviens sans laisser les plaques se percuter.'],
      mistakes: ['Soulever ou tourner le bassin.', 'Lancer la charge au départ.', 'Relâcher la phase de retour.'],
      breathing: 'Expire en fléchissant et inspire pendant le retour.',
      safety: 'Réduis l’amplitude ou la résistance si une crampe empêche le contrôle; arrête si l’arrière du genou devient douloureux.',
    },
    quadIsolation: {
      goal: 'Charger les quadriceps avec une trajectoire contrôlée et une amplitude tolérée par le genou.',
      setup: ['Sur machine, aligne le genou avec l’axe de rotation et ajuste le rouleau au-dessus de la cheville.', 'Stabilise le bassin et le dos.', 'Commence avec une charge que tu peux arrêter à tout moment.'],
      cues: ['Bassin stable', 'Monte sans lancer', 'Redescends lentement'],
      execution: ['Étends ou fléchis les genoux dans l’amplitude confortable prévue.', 'Contracte sans claquer l’articulation en fin de course.', 'Contrôle toute la descente.'],
      mistakes: ['Utiliser l’élan du bassin.', 'Verrouiller brutalement le genou.', 'Forcer malgré une douleur antérieure du genou.'],
      breathing: 'Expire pendant l’effort et inspire au retour.',
      safety: 'La brûlure du quadriceps est normale; une douleur vive ou croissante dans le genou ne l’est pas.',
    },
    shoulderIsolation: {
      goal: 'Déplacer le bras avec l’épaule sous une résistance assez légère pour rester précis.',
      setup: ['Choisis une charge légère à modérée.', 'Garde le cou long et le tronc stable.', 'Travaille dans un plan et une amplitude confortables.'],
      cues: ['Mène avec le bras, pas avec l’élan', 'Épaules loin des oreilles', 'Descente contrôlée'],
      execution: ['Monte les bras sans accélération brusque.', 'Arrête avant que le cou ou le tronc prenne le relais.', 'Redescends lentement jusqu’à conserver une tension maîtrisée.'],
      mistakes: ['Hausser fortement les épaules.', 'Balancer le torse.', 'Choisir une charge qui réduit beaucoup l’amplitude.'],
      breathing: 'Expire en levant et inspire en redescendant.',
      safety: 'L’amplitude n’a pas besoin d’atteindre un angle précis. Arrête avant une sensation de pincement à l’épaule.',
    },
    rearDelt: {
      goal: 'Écarter le haut des bras pour entraîner l’arrière des épaules sans lancer le torse.',
      setup: ['Stabilise le buste et garde le cou détendu.', 'Utilise une charge qui permet une trajectoire régulière.', 'Garde les coudes légèrement fléchis.'],
      cues: ['Torse immobile', 'Bras s’ouvrent vers les côtés', 'Pas de haussement d’épaules'],
      execution: ['Ouvre les bras jusqu’à sentir l’arrière des épaules.', 'Marque un contrôle bref.', 'Reviens lentement sans laisser les épaules s’effondrer.'],
      mistakes: ['Tirer principalement avec les mains.', 'Donner un élan du torse.', 'Pincer exagérément les omoplates avec une charge trop lourde.'],
      breathing: 'Expire en ouvrant les bras et inspire au retour.',
      safety: 'Réduis l’amplitude si l’avant de l’épaule pince ou si le cou prend toute la tension.',
    },
    biceps: {
      goal: 'Fléchir le coude avec un bras et un tronc stables.',
      setup: ['Place les poignets dans une position confortable.', 'Stabilise les épaules et le bassin.', 'Commence avec les coudes dans la position prévue par la variante.'],
      cues: ['Coudes stables', 'Pas d’élan du dos', 'Redescends jusqu’à ton amplitude contrôlée'],
      execution: ['Fléchis le coude sans projeter l’épaule vers l’avant.', 'Contracte brièvement en haut.', 'Contrôle la descente sans hyperétendre le coude.'],
      mistakes: ['Balancer le torse.', 'Avancer fortement les coudes pour finir.', 'Laisser tomber la charge.'],
      breathing: 'Expire en montant et inspire en redescendant.',
      safety: 'Réduis la charge si le poignet, le coude ou l’avant de l’épaule devient douloureux.',
    },
    triceps: {
      goal: 'Étendre le coude en gardant l’épaule et le tronc suffisamment stables.',
      setup: ['Choisis une prise confortable pour les poignets.', 'Place les coudes dans une position que tu peux conserver.', 'Stabilise le tronc avant de commencer.'],
      cues: ['Coudes calmes', 'Étends sans lancer', 'Retour contrôlé'],
      execution: ['Étends les coudes jusqu’à une contraction contrôlée.', 'Évite de claquer l’articulation en fin de course.', 'Reviens lentement dans l’amplitude confortable.'],
      mistakes: ['Épaules et torse qui donnent l’élan.', 'Coudes qui se déplacent beaucoup sans intention.', 'Charge relâchée pendant le retour.'],
      breathing: 'Expire en étendant et inspire pendant le retour.',
      safety: 'Arrête ou change de variante si l’arrière ou la pointe du coude devient douloureux.',
    },
    calves: {
      goal: 'Déplacer la cheville sur une amplitude contrôlée sans rebondir.',
      setup: ['Place l’avant-pied solidement sur le support.', 'Garde la jambe et le pied alignés.', 'Utilise un appui pour l’équilibre si nécessaire.'],
      cues: ['Pression sur l’avant-pied', 'Pause en haut', 'Étirement contrôlé en bas'],
      execution: ['Monte le talon aussi haut que tu peux sans rouler le pied.', 'Marque une courte contraction.', 'Redescends lentement jusqu’à l’amplitude confortable.'],
      mistakes: ['Rebondir rapidement en bas.', 'Rouler sur le bord externe du pied.', 'Raccourcir les répétitions avec une charge trop lourde.'],
      breathing: 'Respire régulièrement; expire en montant si cela t’aide à garder le rythme.',
      safety: 'Réduis l’amplitude si le tendon d’Achille ou le dessous du pied devient douloureux.',
    },
    core: {
      goal: 'Créer ou maintenir une position du tronc sans compenser par le bas du dos.',
      setup: ['Place les côtes au-dessus du bassin.', 'Crée une tension abdominale que tu peux maintenir en respirant.', 'Choisis une variante dont tu contrôles le levier.'],
      cues: ['Côtes et bassin restent reliés', 'Respire derrière la tension', 'Arrête avant que le dos compense'],
      execution: ['Déplace les bras ou les jambes sans perdre la position choisie.', 'Garde un rythme lent et reproductible.', 'Réduis le levier dès que le contrôle diminue.'],
      mistakes: ['Bloquer totalement la respiration trop longtemps.', 'Cambrer ou tourner le bas du dos sans intention.', 'Allonger la série après la perte de contrôle.'],
      breathing: 'Expire lentement pendant la portion difficile tout en gardant la tension du tronc; reprends de petites inspirations contrôlées.',
      safety: 'Arrête en cas de douleur au dos, au cou ou à l’aine. Une série plus courte et propre est préférable à une durée forcée.',
    },
    chestIsolation: {
      goal: 'Rapprocher les bras en arc de cercle avec une épaule confortable et un coude légèrement fléchi.',
      setup: ['Place les épaules dans une position stable et non forcée.', 'Garde une légère flexion de coude.', 'Choisis une charge qui permet de contrôler l’étirement.'],
      cues: ['Arc de bras constant', 'Coude légèrement fléchi', 'Étirement confortable, jamais forcé'],
      execution: ['Rapproche les bras sans transformer le mouvement en développé.', 'Contracte brièvement les pectoraux.', 'Ouvre lentement jusqu’à l’amplitude que l’épaule tolère.'],
      mistakes: ['Descendre dans un étirement excessif.', 'Changer fortement l’angle du coude.', 'Laisser la charge tirer brutalement les épaules vers l’arrière.'],
      breathing: 'Expire en rapprochant les bras et inspire pendant l’ouverture contrôlée.',
      safety: 'Arrête avant une douleur ou un pincement à l’avant de l’épaule; réduis d’abord l’amplitude, puis la charge.',
    },
  };

  const EXERCISE_NOTES = {
    squat: ['Règle les sécurités du rack juste sous ton point le plus bas.', 'La barre doit rester équilibrée au-dessus du milieu du pied.'],
    frontSquat: ['Garde les coudes assez hauts pour conserver le support de la barre.', 'Utilise une prise adaptée à ta mobilité de poignets et d’épaules.'],
    gobletSquat: ['Garde l’haltère près du sternum pour éviter qu’il t’attire vers l’avant.'],
    kettlebellGoblet: ['Garde la kettlebell proche du sternum et les poignets neutres.'],
    legpress: ['Règle le siège pour que le bassin reste en contact avec le dossier au bas du mouvement.', 'Ne verrouille pas brutalement les genoux.'],
    hackSquat: ['Garde le dos et le bassin contre le support pendant toute la répétition.'],
    pendulumSquat: ['Laisse la machine dicter l’arc tout en gardant les pieds entièrement stables.'],
    beltSquat: ['Centre la ceinture et vérifie que la charge ne touche pas le sol au bas du mouvement.'],
    smithSquat: ['Place les pieds selon la trajectoire fixe de la barre plutôt que de forcer une trajectoire naturelle impossible.'],
    bench: ['Utilise les sécurités ou une personne compétente pour t’assurer quand la charge devient exigeante.', 'Garde les fesses en contact avec le banc et touche la poitrine sans rebondir.'],
    inclineBench: ['Règle les sécurités et évite un angle de banc qui provoque un pincement à l’épaule.'],
    declineBench: ['Sécurise les jambes et utilise une assistance pour sortir ou remettre la barre.'],
    dbBench: ['Pose et reprends les haltères avec contrôle; évite de les laisser tomber derrière les épaules.'],
    inclineDbBench: ['Amène les haltères en position avec l’aide des cuisses plutôt qu’avec une torsion brusque.'],
    chestPress: ['Ajuste le siège pour que les poignées arrivent près du milieu de la poitrine.'],
    inclineChestPress: ['Ajuste le siège pour que les poignées suivent une trajectoire confortable pour l’épaule.'],
    smithBench: ['Place le banc pour que la trajectoire fixe arrive au point de contact voulu et règle les butées.'],
    floorPress: ['Pose les bras au sol avec contrôle; ne laisse pas les coudes frapper le sol.'],
    pushup: ['Laisse les omoplates bouger naturellement autour de la cage et garde tête, tronc et bassin alignés.'],
    closePushup: ['Garde les mains assez écartées pour que les poignets et les coudes restent confortables.'],
    dip: ['Commence avec une assistance si tu ne contrôles pas la descente.', 'Ne poursuis pas l’amplitude quand l’avant de l’épaule tire ou pince.'],
    row: ['Maintiens l’angle du torse; si le bas du dos fatigue avant le dos, choisis une variante appuyée.'],
    dbRow: ['Appuie-toi sans tourner le bassin; tire vers la hanche plutôt que vers le cou.'],
    cableRow: ['Ne laisse pas la pile de poids t’arrondir brusquement en avant.'],
    chestSupportedRow: ['Garde la poitrine sur le support et le cou neutre.'],
    machineRow: ['Ajuste le siège ou le support pour tirer sans hausser les épaules.'],
    tbarRow: ['Garde la poitrine appuyée si la machine possède un support; sinon conserve un angle de torse stable.'],
    invertedRow: ['Garde le corps en bloc et ajuste la hauteur de la barre pour choisir la difficulté.'],
    sealRow: ['Vérifie que le banc est stable et assez haut pour que les disques circulent librement.'],
    ohp: ['Déplace légèrement la tête pour laisser passer la barre, puis replace-la sous la barre en haut.'],
    dbOhp: ['Garde les avant-bras sous les haltères et utilise un dossier si le tronc limite le mouvement.'],
    machinePress: ['Ajuste le siège pour que les poignées commencent près du niveau des épaules.'],
    landminePress: ['Pousse dans l’arc naturel de la barre et laisse l’omoplate tourner vers le haut.'],
    pikePushup: ['Déplace la tête vers l’espace entre les mains, pas seulement verticalement vers le sol.'],
    pullup: ['Commence avec une assistance si tu ne peux pas contrôler le premier et le dernier quart de la répétition.'],
    chinup: ['Évite de forcer une supination qui irrite les poignets ou les coudes.'],
    neutralPullup: ['Garde une prise neutre stable et évite de chercher le menton au prix d’une forte extension du cou.'],
    assistedPullup: ['Choisis assez d’assistance pour supprimer l’élan et contrôle la remontée de la plateforme.'],
    pulldown: ['Tire vers le haut de la poitrine, pas derrière la nuque.'],
    straightArmPulldown: ['Garde seulement une légère flexion du coude et termine avec les bras près des côtés sans cambrer.'],
    machinePullover: ['Aligne l’épaule avec l’axe de la machine et ne force pas l’étirement initial.'],
    deadlift: ['Place la barre au-dessus du milieu du pied et crée de la tension avant qu’elle quitte le sol.', 'La barre et les hanches doivent démarrer sans à-coup; dépose chaque répétition sous contrôle.'],
    rdl: ['Les genoux restent légèrement fléchis et la descente s’arrête quand les hanches ne peuvent plus reculer sans compensation.'],
    dbRdl: ['Fais glisser les haltères près des cuisses et arrête la descente avant que le dos change de position.'],
    goodMorning: ['Commence très léger et utilise les sécurités du rack.', 'Ce mouvement exige une charnière solide; remplace-le par un RDL si tu ne contrôles pas le tronc.'],
    hipThrust: ['Place le bord du banc sous le haut du dos et termine avec les côtes abaissées, sans hyperétendre le bas du dos.'],
    smithHipThrust: ['Centre le banc et vérifie les butées de sécurité avant de charger.'],
    gluteBridge: ['Termine en contractant les fessiers sans pousser les côtes vers le haut.'],
    cablePullthrough: ['Éloigne-toi assez de la pile pour garder la tension et laisse la corde passer sans heurter.'],
    backExtension: ['Fais le mouvement aux hanches; termine quand le corps est aligné, sans hyperextension lombaire.'],
    kettlebellSwing: ['C’est une charnière explosive, pas un squat ni une élévation des bras.', 'Maîtrise d’abord le deadlift kettlebell et arrête la série dès que le rythme ou la trajectoire change.'],
    lunge: ['Stabilise chaque appui avant la répétition suivante.'],
    splitSquat: ['Le pied arrière sert d’appui; la jambe avant produit l’essentiel de l’effort.'],
    bulgarian: ['Place le support assez bas et assez près pour ne pas forcer la hanche arrière.'],
    stepup: ['Choisis une hauteur qui permet de monter sans pousser fortement avec le pied au sol.'],
    reverseLunge: ['Pose le pied arrière assez loin pour garder l’équilibre puis pousse dans la jambe avant.'],
    walkingLunge: ['Stabilise la position avant chaque pas; réduis la charge si l’équilibre ou l’espace devient incertain.'],
    singleLegPress: ['Garde le bassin centré sur le siège et ne laisse pas la hanche rouler au bas du mouvement.'],
    nordicCurl: ['Utilise une assistance suffisante et ralentis surtout la descente.', 'Vérifie que les chevilles sont solidement ancrées; ne tente pas de rattraper une chute avec un à-coup.'],
    ballLegcurl: ['Garde le bassin haut seulement tant que le tronc reste contrôlé et le ballon stable.'],
    sissySquat: ['Utilise un support stable et commence avec une très petite amplitude.', 'Ce mouvement avancé n’est pas requis pour développer les quadriceps.'],
    reverseNordic: ['Garde les hanches ouvertes et le tronc en bloc; recule seulement aussi loin que tu peux revenir sans élan.', 'Commence avec une amplitude très courte.'],
    uprightRow: ['Arrête la montée avant un pincement; la hauteur des coudes n’a pas à dépasser les épaules.'],
    lateral: ['Une légère trajectoire vers l’avant, dans le plan de l’omoplate, est souvent plus confortable.'],
    cableLateral: ['Place-toi pour que le câble ne tire pas l’épaule dans une position inconfortable au départ.'],
    cableYraise: ['Utilise une charge très légère et monte dans une trajectoire en Y sans hausser le cou.'],
    facepull: ['Tire vers le visage avec les avant-bras qui suivent une trajectoire confortable, sans cambrer.'],
    skullCrusher: ['Laisse les coudes suivre une trajectoire confortable et évite de descendre la barre directement vers le visage.', 'Réduis la charge dès que les coudes deviennent douloureux.'],
    overheadCableTriceps: ['Garde les côtes au-dessus du bassin et choisis une amplitude que les épaules tolèrent.'],
    dbTriceps: ['Stabilise le tronc et évite de forcer l’épaule en fin d’amplitude.'],
    kickback: ['Garde le haut du bras stable; utilise une charge légère pour atteindre l’extension sans élan.'],
    hangingRaise: ['Commence par une rétroversion contrôlée du bassin plutôt que de balancer les jambes.'],
    abWheel: ['Commence près d’un mur ou avec une petite amplitude pour limiter la sortie.', 'Arrête immédiatement la répétition quand le bas du dos commence à s’affaisser.'],
    deadBug: ['Garde doucement le bas du dos en contact avec le sol et raccourcis le levier si nécessaire.'],
    pallof: ['Résiste à la rotation; ne transforme pas la répétition en mouvement des épaules.'],
    sidePlank: ['Empile les épaules et les hanches; utilise les genoux comme appui si la position complète se dégrade.'],
    cableAbs: ['Enroule le tronc sans tirer la corde avec les bras ni t’asseoir sur les talons.'],
    abs: ['Choisis une variante précise et arrête la série quand la position du tronc n’est plus reproductible.'],
    dbFly: ['Ne descends pas les coudes beaucoup plus bas que le banc si l’épaule tire à l’avant.'],
    cableFly: ['Place-toi pour que les câbles restent sous contrôle au départ et à la fin.'],
    lowCableFly: ['Monte les bras dans un arc confortable sans hausser les épaules.'],
    highCableFly: ['Descends les bras dans un arc contrôlé sans arrondir brutalement le tronc.'],
    pecDeck: ['Ajuste le siège pour que les coudes ou poignées soient alignés avec une zone confortable de la poitrine.'],
  };

  const HIGH_SKILL = new Set(['deadlift', 'goodMorning', 'kettlebellSwing', 'nordicCurl', 'sissySquat', 'reverseNordic', 'dip', 'abWheel', 'walkingLunge']);

  function safeArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
  }

  function buildTechniqueGuide(exercise = {}, profile = {}) {
    const base = PATTERN_GUIDES[exercise.pattern] || PATTERN_GUIDES.core;
    const specific = safeArray(EXERCISE_NOTES[exercise.id]);
    const isLearning = profile.technique === 'learning' || profile.level === 'beginner' || Number(profile.experienceMonths) < 6;
    const highSkill = HIGH_SKILL.has(exercise.id);
    let levelNote = '';
    if (highSkill && isLearning) levelNote = 'Mouvement technique : commence avec une variante assistée ou plus simple et demande une vérification en personne si tu n’es pas certain de la position.';
    else if (highSkill) levelNote = 'Mouvement technique : garde une marge avant l’échec et arrête la série dès que la trajectoire n’est plus reproductible.';
    else if (isLearning) levelNote = 'Apprentissage : utilise une charge qui te laisse répéter exactement la même trajectoire et garde plusieurs répétitions en réserve.';

    return Object.freeze({
      version: VERSION,
      exerciseId: exercise.id || 'unknown',
      exerciseName: exercise.name || 'Exercice',
      pattern: exercise.pattern || 'core',
      patternLabel: PATTERN_LABELS[exercise.pattern] || 'Mouvement',
      goal: base.goal,
      setup: Object.freeze([...base.setup]),
      cues: Object.freeze([...base.cues]),
      execution: Object.freeze([...base.execution]),
      mistakes: Object.freeze([...base.mistakes]),
      breathing: base.breathing,
      safety: base.safety,
      specific: Object.freeze(specific),
      highSkill,
      levelNote,
      disclaimer: 'Guide éducatif, sans analyse vidéo ni diagnostic. Une douleur nouvelle, vive ou inexpliquée justifie d’arrêter le mouvement et de demander une évaluation appropriée.',
    });
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function list(items) {
    return items.map((item) => `<li>${escapeText(item)}</li>`).join('');
  }

  function closeGuide() {
    const modal = document.getElementById('exerciseTechniqueModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function openGuide(detail = {}) {
    const modal = document.getElementById('exerciseTechniqueModal');
    const content = document.getElementById('exerciseTechniqueContent');
    if (!modal || !content || !detail.exercise) return;
    const guide = buildTechniqueGuide(detail.exercise, detail.profile || {});
    const specific = guide.specific.length ? `<section class="technique-specific"><h3>Pour cette variante</h3><ul>${list(guide.specific)}</ul></section>` : '';
    const level = guide.levelNote ? `<p class="technique-level-note">${escapeText(guide.levelNote)}</p>` : '';
    content.innerHTML = `
      <div class="technique-title-row"><div><span class="technique-pattern">${escapeText(guide.patternLabel)}</span><h2 id="exerciseTechniqueTitle">${escapeText(guide.exerciseName)}</h2></div><button id="exerciseTechniqueCloseBtn" class="technique-close" type="button" aria-label="Fermer">✕</button></div>
      <p class="technique-goal">${escapeText(guide.goal)}</p>
      ${level}
      <section class="technique-cues"><h3>3 repères pendant la série</h3><div>${guide.cues.map((cue, index) => `<article><span>${index + 1}</span><b>${escapeText(cue)}</b></article>`).join('')}</div></section>
      ${specific}
      <div class="technique-columns"><section><h3>Avant de commencer</h3><ul>${list(guide.setup)}</ul></section><section><h3>Exécution</h3><ul>${list(guide.execution)}</ul></section></div>
      <section class="technique-mistakes"><h3>À corriger</h3><ul>${list(guide.mistakes)}</ul></section>
      <section class="technique-breathing"><h3>Respiration</h3><p>${escapeText(guide.breathing)}</p></section>
      <section class="technique-safety"><h3>Arrête la série si…</h3><p>${escapeText(guide.safety)}</p></section>
      <p class="technique-disclaimer">${escapeText(guide.disclaimer)}</p>
      <button id="exerciseTechniqueReadyBtn" class="technique-ready" type="button">Prêt pour ma série</button>`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('exerciseTechniqueCloseBtn')?.addEventListener('click', closeGuide);
    document.getElementById('exerciseTechniqueReadyBtn')?.addEventListener('click', closeGuide);
    document.getElementById('exerciseTechniqueCloseBtn')?.focus();
  }

  window.addEventListener('macroflow:open-technique-guide', (event) => openGuide(event.detail || {}));
  document.getElementById('exerciseTechniqueModal')?.addEventListener('click', (event) => { if (event.target.id === 'exerciseTechniqueModal') closeGuide(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !document.getElementById('exerciseTechniqueModal')?.classList.contains('hidden')) closeGuide(); });

  window.MacroFlowExerciseTechniqueV24 = Object.freeze({
    version: VERSION,
    buildTechniqueGuide,
    patternGuides: PATTERN_GUIDES,
    exerciseNotes: EXERCISE_NOTES,
  });
})();
