const $ = (id) => document.getElementById(id);
const localizedNumber = (value) => { const text = String(value ?? '').trim().replace(',', '.'); return text === '' ? NaN : Number(text); };

const MODEL_BYTES = 33_833_206;
const FOODSEG_LABELS = ['background','candy','egg tart','french fries','chocolate','biscuit','popcorn','pudding','ice cream','cheese butter','cake','wine','milkshake','coffee','juice','milk','tea','almond','red beans','cashew','dried cranberries','soy','walnut','peanut','egg','apple','date','apricot','avocado','banana','strawberry','cherry','blueberry','raspberry','mango','olives','peach','lemon','pear','fig','pineapple','grape','kiwi','melon','orange','watermelon','steak','pork','chicken duck','sausage','fried meat','lamb','sauce','crab','fish','shellfish','shrimp','soup','bread','corn','hamburg','pizza','hanamaki baozi','wonton dumplings','pasta','noodles','rice','pie','tofu','eggplant','potato','garlic','cauliflower','tomato','kelp','seaweed','spring onion','rape','ginger','okra','lettuce','pumpkin','cucumber','white radish','carrot','asparagus','bamboo shoots','broccoli','celery stick','cilantro mint','snow peas','cabbage','bean sprouts','onion','pepper','green beans','French beans','king oyster mushroom','shiitake','enoki mushroom','oyster mushroom','white button mushroom','salad','other ingredients'];
const FR_LABELS = {
  candy:'bonbon', 'egg tart':'tarte aux œufs', 'french fries':'frites', chocolate:'chocolat', biscuit:'biscuit', popcorn:'maïs soufflé', pudding:'pouding', 'ice cream':'crème glacée', 'cheese butter':'fromage ou beurre', cake:'gâteau', wine:'vin', milkshake:'lait frappé', coffee:'café', juice:'jus', milk:'lait', tea:'thé', almond:'amandes', 'red beans':'haricots rouges', cashew:'noix de cajou', 'dried cranberries':'canneberges séchées', soy:'soja', walnut:'noix', peanut:'arachides', egg:'œuf', apple:'pomme', date:'datte', apricot:'abricot', avocado:'avocat', banana:'banane', strawberry:'fraises', cherry:'cerises', blueberry:'bleuets', raspberry:'framboises', mango:'mangue', olives:'olives', peach:'pêche', lemon:'citron', pear:'poire', fig:'figue', pineapple:'ananas', grape:'raisins', kiwi:'kiwi', melon:'melon', orange:'orange', watermelon:'pastèque', steak:'steak', pork:'porc', 'chicken duck':'poulet ou canard', sausage:'saucisse', 'fried meat':'viande frite', lamb:'agneau', sauce:'sauce', crab:'crabe', fish:'poisson', shellfish:'fruits de mer', shrimp:'crevettes', soup:'soupe', bread:'pain', corn:'maïs', hamburg:'hamburger', pizza:'pizza', 'hanamaki baozi':'pain vapeur', 'wonton dumplings':'raviolis wonton', pasta:'pâtes', noodles:'nouilles', rice:'riz', pie:'tarte', tofu:'tofu', eggplant:'aubergine', potato:'pomme de terre', garlic:'ail', cauliflower:'chou-fleur', tomato:'tomate', kelp:'varech', seaweed:'algues', 'spring onion':'oignon vert', rape:'légume vert', ginger:'gingembre', okra:'gombo', lettuce:'laitue', pumpkin:'citrouille', cucumber:'concombre', 'white radish':'radis blanc', carrot:'carotte', asparagus:'asperges', 'bamboo shoots':'pousses de bambou', broccoli:'brocoli', 'celery stick':'céleri', 'cilantro mint':'coriandre ou menthe', 'snow peas':'pois mange-tout', cabbage:'chou', 'bean sprouts':'germes de haricot', onion:'oignon', pepper:'poivron', 'green beans':'haricots verts', 'French beans':'haricots verts', 'king oyster mushroom':'pleurote royal', shiitake:'shiitake', 'enoki mushroom':'enoki', 'oyster mushroom':'pleurote', 'white button mushroom':'champignon blanc', salad:'salade', 'other ingredients':'autres ingrédients',
};
const state = {
  topFile: null,
  topUrl: '',
  angleFile: null,
  angleUrl: '',
  plateDiameterCm: Number(localStorage.getItem('macroflow-plate-cm')) || 27,
  plateImagePercent: Number(localStorage.getItem('macroflow-plate-percent')) || 82,
  plateProfiles: [],
  activePlateId: localStorage.getItem('macroflow-active-plate') || '',
  plateReferenceFile: null,
  plateReferenceUrl: '',
  foodSegSession: null,
  ort: null,
  depthEstimator: null,
  depthUnavailable: false,
  transformers: null,
  regions: [],
  results: [],
  verifiedReferences: [],
  busy: false,
};

const PLATE_DB_NAME = 'macroflow-plate-profiles';
const PLATE_DB_VERSION = 1;
const PLATE_STORE = 'plates';
const REFERENCE_DB_NAME = 'macroflow-scanner-references';
const REFERENCE_DB_VERSION = 1;
const REFERENCE_STORE = 'references';


const PERSONAL_MEALS_KEY = 'macroflow-personal-meals-v27';
const SCANNER_BENCHMARK_KEY = 'macroflow-scanner-benchmark-v34';

function loadScannerBenchmark() {
  try {
    const value = JSON.parse(localStorage.getItem(SCANNER_BENCHMARK_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveScannerBenchmark(entries) {
  localStorage.setItem(SCANNER_BENCHMARK_KEY, JSON.stringify(entries.slice(-120)));
  window.dispatchEvent(new CustomEvent('macroflow:scanner-benchmark-updated'));
}
function recordScannerBenchmark(item, actualGrams) {
  const estimatedGrams = Number(item.scanEstimatedGrams);
  const actual = Number(actualGrams);
  if (!Number.isFinite(estimatedGrams) || estimatedGrams <= 0 || !Number.isFinite(actual) || actual <= 0) return;
  const absoluteError = Math.abs(estimatedGrams - actual);
  const percentError = (absoluteError / actual) * 100;
  const entries = loadScannerBenchmark();
  entries.push({
    id: `benchmark-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: item.label,
    estimatedGrams: Math.round(estimatedGrams),
    actualGrams: Math.round(actual),
    absoluteError: Math.round(absoluteError * 10) / 10,
    percentError: Math.round(percentError * 10) / 10,
    estimateSource: item.scanEstimateSource || 'generic',
    plateKey: referencePlateKey(),
    createdAt: new Date().toISOString(),
  });
  saveScannerBenchmark(entries);
}
function loadPersonalMeals() { try { const value = JSON.parse(localStorage.getItem(PERSONAL_MEALS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function savePersonalMeals(meals) { localStorage.setItem(PERSONAL_MEALS_KEY, JSON.stringify(meals.slice(0, 40))); }
function mealSignature(items) { return items.map((item) => normalize(item.label)).sort().join('|'); }
function mealConfidence(items) {
  if (!items.length) return { score: 0, label: 'Aucune donnée', stars: 0 };
  const score = Math.round(items.reduce((sum, item) => {
    if (item.estimateSource === 'verified-now') return sum + 99;
    if (item.estimateSource === 'verified') return sum + Math.min(96, Number(item.confidence) || 90);
    return sum + Math.min(70, Number(item.confidence) || 45);
  }, 0) / items.length);
  const stars = score >= 92 ? 5 : score >= 82 ? 4 : score >= 68 ? 3 : score >= 52 ? 2 : 1;
  const label = stars >= 5 ? 'Très fiable' : stars >= 4 ? 'Fiable' : stars >= 3 ? 'À vérifier' : 'Estimation prudente';
  return { score, stars, label };
}
function cloneMealItems(items) { return items.map((item) => ({ ...item, region: null, per100: item.per100 || lookupFood(item.label) })); }
function savePersonalMeal(kind) {
  if (!state.results.length) return;
  const suggested = kind === 'recipe' ? `Recette ${state.results[0].label}` : `Repas ${state.results.map((x) => x.label).join(' + ')}`;
  const name = window.prompt(kind === 'recipe' ? 'Nom de la recette' : 'Nom du repas habituel', suggested);
  if (!name?.trim()) return;
  const meals = loadPersonalMeals();
  const entry = { id: `meal-${Date.now()}`, kind, name: name.trim(), signature: mealSignature(state.results), items: cloneMealItems(state.results), uses: 0, updatedAt: new Date().toISOString() };
  const duplicate = meals.findIndex((meal) => meal.kind === kind && normalize(meal.name) === normalize(entry.name));
  if (duplicate >= 0) meals.splice(duplicate, 1);
  meals.unshift(entry); savePersonalMeals(meals); renderPersonalShortcuts();
  setStatus(`${kind === 'recipe' ? 'Recette' : 'Repas habituel'} enregistré. La prochaine fois, il s’ajoute en une pression.`, 100);
}
function usePersonalMeal(id) {
  const meals = loadPersonalMeals(); const meal = meals.find((entry) => entry.id === id); if (!meal) return;
  state.results = cloneMealItems(meal.items).map((item) => ({ ...item, estimateSource: item.estimateSource || 'verified', confidence: Math.max(85, Number(item.confidence) || 85) }));
  meal.uses = Number(meal.uses || 0) + 1; meal.updatedAt = new Date().toISOString(); savePersonalMeals(meals);
  renderResults(); setStatus(`${meal.name} chargé. Ajuste seulement ce qui a changé.`, 100);
}
function renderPersonalShortcuts() {
  const host = $('smartShortcuts'); if (!host) return;
  const meals = loadPersonalMeals().slice(0, 5); host.classList.toggle('hidden', !meals.length);
  host.innerHTML = meals.length ? `<b>Tes raccourcis</b>${meals.map((meal) => `<div class="smart-shortcut"><div><strong>${meal.name}</strong><small>${meal.kind === 'recipe' ? 'Recette vérifiée' : 'Repas habituel'} · ${meal.items.length} élément${meal.items.length > 1 ? 's' : ''}</small></div><button type="button" data-meal-id="${meal.id}">Utiliser</button></div>`).join('')}` : '';
  host.querySelectorAll('[data-meal-id]').forEach((button) => button.addEventListener('click', () => usePersonalMeal(button.dataset.mealId)));
}
function recordHabitUse() {
  const signature = mealSignature(state.results); if (!signature) return;
  const meals = loadPersonalMeals(); const match = meals.find((meal) => meal.signature === signature);
  if (match) { match.uses = Number(match.uses || 0) + 1; match.updatedAt = new Date().toISOString(); savePersonalMeals(meals); }
}

const FOOD_DB = [
  ['chicken breast|chicken|poulet|poulet grille|poulet grillé', 165, 31, 0, 3.6, 1.05, 2.7, 0.72],
  ['beef|steak|boeuf|bœuf', 250, 26, 0, 15, 1.05, 2.5, 0.78],
  ['ground beef|minced beef|boeuf hache|bœuf haché', 254, 26, 0, 17, 1.02, 2.8, 0.76],
  ['pork|porc|pork chop', 242, 27, 0, 14, 1.04, 2.5, 0.77],
  ['turkey|dinde', 135, 29, 0, 1.8, 1.04, 2.5, 0.74],
  ['salmon|saumon', 208, 20, 0, 13, 1.03, 2.2, 0.78],
  ['tuna|thon', 132, 29, 0, 1, 1.02, 2.0, 0.76],
  ['white fish|cod|fish|poisson|morue', 105, 23, 0, 1, 1.02, 2.0, 0.74],
  ['shrimp|prawn|crevette|crevettes', 99, 24, 0.2, 0.3, 0.96, 1.8, 0.62],
  ['egg|eggs|oeuf|oeufs|œuf|œufs|omelette|scrambled egg|scrambled eggs|oeufs brouilles|œufs brouillés', 155, 13, 1.1, 11, 1.03, 1.8, 0.72],
  ['tofu', 144, 17, 2.8, 8.7, 1.02, 2.5, 0.78],
  ['rice|white rice|brown rice|riz', 130, 2.7, 28, 0.3, 0.78, 2.1, 0.62],
  ['fried rice|riz frit', 174, 4, 32, 3.2, 0.82, 2.2, 0.64],
  ['pasta|spaghetti|noodle|noodles|pates|pâtes', 158, 5.8, 31, 0.9, 0.72, 2.2, 0.58],
  ['potato|potatoes|pomme de terre|pommes de terre', 87, 1.9, 20, 0.1, 0.78, 2.6, 0.74],
  ['mashed potato|mashed potatoes|puree|purée', 113, 2, 17, 4.2, 0.90, 2.0, 0.66],
  ['french fries|fries|frites', 312, 3.4, 41, 15, 0.45, 2.2, 0.56],
  ['sweet potato|patate douce', 90, 2, 21, 0.2, 0.78, 2.5, 0.72],
  ['bread|toast|pain|baguette', 265, 9, 49, 3.2, 0.27, 1.8, 0.88],
  ['oatmeal|porridge|avoine|gruau', 71, 2.5, 12, 1.5, 0.96, 1.8, 0.70],
  ['quinoa', 120, 4.4, 21, 1.9, 0.75, 2.0, 0.62],
  ['beans|bean|haricots|haricot', 127, 8.7, 23, 0.5, 0.75, 2.1, 0.64],
  ['lentils|lentil|lentilles|lentille', 116, 9, 20, 0.4, 0.77, 2.0, 0.64],
  ['broccoli|brocoli', 35, 2.4, 7.2, 0.4, 0.34, 3.3, 0.48],
  ['cauliflower|chou fleur|chou-fleur', 25, 1.9, 5, 0.3, 0.33, 3.1, 0.48],
  ['carrot|carrots|carotte|carottes', 35, 0.8, 8.2, 0.2, 0.62, 1.8, 0.60],
  ['peas|pea|petits pois|pois', 81, 5.4, 14, 0.4, 0.72, 1.7, 0.60],
  ['corn|mais|maïs', 96, 3.4, 21, 1.5, 0.72, 1.8, 0.61],
  ['green beans|haricots verts', 35, 1.9, 7.9, 0.3, 0.45, 1.8, 0.56],
  ['salad|lettuce|salade|laitue', 18, 1.2, 3.3, 0.2, 0.16, 2.3, 0.36],
  ['tomato|tomatoes|tomate|tomates', 18, 0.9, 3.9, 0.2, 0.62, 1.8, 0.64],
  ['cucumber|concombre', 15, 0.7, 3.6, 0.1, 0.59, 1.8, 0.60],
  ['avocado|avocat', 160, 2, 8.5, 14.7, 0.90, 2.2, 0.74],
  ['apple|pomme', 52, 0.3, 14, 0.2, 0.62, 3.0, 0.73],
  ['banana|banane', 89, 1.1, 23, 0.3, 0.94, 2.6, 0.70],
  ['strawberry|strawberries|fraise|fraises', 32, 0.7, 7.7, 0.3, 0.58, 2.0, 0.62],
  ['blueberry|blueberries|bleuet|bleuets|myrtille', 57, 0.7, 14, 0.3, 0.63, 1.8, 0.60],
  ['cheese|fromage', 350, 23, 3, 27, 1.05, 1.2, 0.88],
  ['yogurt|yoghurt|yogourt|yaourt', 78, 5.7, 7.8, 2.7, 1.03, 1.5, 0.82],
  ['sauce|gravy|salsa', 90, 2, 11, 4, 1.04, 0.35, 0.94],
  ['oil|olive oil|huile', 884, 0, 0, 100, 0.91, 0.12, 1],
  ['butter|beurre', 717, 0.9, 0.1, 81, 0.91, 0.18, 1],
  ['pizza', 266, 11, 33, 10, 0.54, 1.7, 0.88],
  ['hamburger|burger', 295, 17, 24, 14, 0.68, 3.3, 0.82],
  ['sandwich|wrap|burrito', 235, 12, 28, 8, 0.62, 3.0, 0.80],
  ['soup|stew|soupe|ragout|ragoût', 75, 4, 8, 3, 1.02, 2.3, 0.93],
  ['cake|brownie|gateau|gâteau', 360, 5, 52, 15, 0.48, 3.0, 0.82],
].map((row) => ({ aliases: row[0].split('|'), calories: row[1], protein: row[2], carbs: row[3], fat: row[4], density: row[5], height: row[6], shape: row[7] }));


function openReferenceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(REFERENCE_DB_NAME, REFERENCE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REFERENCE_STORE)) db.createObjectStore(REFERENCE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Stockage des références indisponible'));
  });
}
async function loadVerifiedReferences() {
  const db = await openReferenceDb();
  try { return await new Promise((resolve, reject) => { const request = db.transaction(REFERENCE_STORE, 'readonly').objectStore(REFERENCE_STORE).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
async function saveVerifiedReference(reference) {
  const db = await openReferenceDb();
  try { await new Promise((resolve, reject) => { const tx = db.transaction(REFERENCE_STORE, 'readwrite'); tx.objectStore(REFERENCE_STORE).put(reference); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Référence non enregistrée')); }); }
  finally { db.close(); }
}
function referencePlateKey() {
  const profile = activePlate();
  return profile ? `profile:${profile.id}` : `manual:${Math.round(state.plateDiameterCm * 2) / 2}`;
}
function compatibleReferences(item) {
  const label = normalize(item.label); const plateKey = referencePlateKey();
  return state.verifiedReferences.filter((ref) => normalize(ref.label) === label && ref.plateKey === plateKey && Number(ref.visualVolume) > 0 && Number(ref.grams) > 0);
}
function applyVerifiedEstimate(item) {
  const refs = compatibleReferences(item);
  if (!refs.length || !Number(item.visualVolume)) return item;
  const candidates = refs.map((ref) => { const ratio = item.visualVolume / ref.visualVolume; return { ref, ratio, distance: Math.abs(Math.log(Math.max(0.01, ratio))), grams: ref.grams * ratio }; })
    .filter((entry) => entry.ratio >= 0.45 && entry.ratio <= 2.2).sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return item;
  const weighted = candidates.slice(0, 3).reduce((sum, entry) => { const weight = 1 / (0.08 + entry.distance); sum.value += entry.grams * weight; sum.weight += weight; return sum; }, { value: 0, weight: 0 });
  item.grams = Math.round(Math.max(5, Math.min(900, weighted.value / weighted.weight)));
  item.estimateSource = 'verified'; item.referenceCount = refs.length;
  item.confidence = Math.min(96, 78 + Math.min(12, refs.length * 3) + (state.angleUrl ? 3 : 0));
  recalcItem(item); return item;
}
async function verifyResult(index) {
  const item = state.results[index];
  if (!item || item.estimateSource === 'verified-now' || !Number(item.grams) || !Number(item.visualVolume)) return;
  recordScannerBenchmark(item, Number(item.grams));
  const reference = { id: `scanref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: item.label.trim(), grams: Math.round(Number(item.grams)), visualVolume: Number(item.visualVolume), plateKey: referencePlateKey(), per100: { calories: item.per100.calories, protein: item.per100.protein, carbs: item.per100.carbs, fat: item.per100.fat }, createdAt: new Date().toISOString(), source: 'weighed-by-user' };
  await saveVerifiedReference(reference); state.verifiedReferences.push(reference);
  item.estimateSource = 'verified-now'; item.referenceCount = compatibleReferences(item).length; item.confidence = 98;
  renderResults(); setStatus(`${item.label} est maintenant une portion vérifiée. Les prochains scans compatibles utiliseront cette référence.`, 100);
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function lookupFood(label) {
  const clean = normalize(label);
  const ranked = FOOD_DB.map((food) => {
    const score = Math.max(...food.aliases.map((alias) => {
      const a = normalize(alias);
      if (clean === a) return 100;
      if (clean.includes(a) || a.includes(clean)) return Math.min(clean.length, a.length) + 30;
      return a.split(' ').filter((word) => clean.includes(word)).length * 4;
    }));
    return { food, score };
  }).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 4) return { ...ranked[0].food, matched: true };
  return { calories: 170, protein: 8, carbs: 20, fat: 7, density: 0.75, height: 2.3, shape: 0.65, matched: false };
}

function setStatus(message, progress = null, error = false) {
  const box = $('smartStatus');
  if (!box) return;
  box.classList.toggle('error', error);
  box.classList.remove('hidden');
  box.innerHTML = `<div>${message}</div>${progress == null ? '' : `<div class="smart-progress"><span style="width:${Math.max(2, Math.min(100, progress))}%"></span></div>`}`;
}

function setScanFlowStep(step) {
  const steps = [
    { name: 'photo', element: $('scanFlowStepPhoto') },
    { name: 'analyze', element: $('scanFlowStepAnalyze') },
    { name: 'review', element: $('scanFlowStepReview') },
  ];
  const activeIndex = Math.max(0, steps.findIndex((item) => item.name === step));
  steps.forEach((item, index) => {
    if (!item.element) return;
    item.element.classList.toggle('active', index === activeIndex);
    item.element.classList.toggle('done', index < activeIndex);
    if (index === activeIndex) item.element.setAttribute('aria-current', 'step');
    else item.element.removeAttribute('aria-current');
  });
}

function humanBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} Mo`;
}

function openPlateDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PLATE_DB_NAME, PLATE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLATE_STORE)) db.createObjectStore(PLATE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Stockage des assiettes indisponible'));
  });
}

async function loadPlateProfiles() {
  const db = await openPlateDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(PLATE_STORE, 'readonly').objectStore(PLATE_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.name.localeCompare(b.name)));
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function putPlateProfile(profile) {
  const db = await openPlateDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(PLATE_STORE, 'readwrite');
      transaction.objectStore(PLATE_STORE).put(profile);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Enregistrement de l’assiette annulé'));
    });
    return profile;
  } finally {
    db.close();
  }
}

async function removePlateProfile(id) {
  const db = await openPlateDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(PLATE_STORE, 'readwrite');
      transaction.objectStore(PLATE_STORE).delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Suppression de l’assiette annulée'));
    });
  } finally {
    db.close();
  }
}

function activePlate() {
  return state.plateProfiles.find((profile) => profile.id === state.activePlateId) || null;
}

function currentPlateSpec() {
  const profile = activePlate();
  if (profile) return profile;
  const diameter = Math.max(10, Math.min(50, localizedNumber($('plateDiameterCm')?.value) || state.plateDiameterCm || 27));
  return { id: '', name: 'Mesure manuelle', shape: 'round', widthCm: diameter, heightCm: diameter, depthCm: 0 };
}

function plateAreaCm2(spec = currentPlateSpec()) {
  if (spec.shape === 'rectangle') return spec.widthCm * spec.heightCm * 0.92;
  return Math.PI * (spec.widthCm / 2) * (spec.heightCm / 2);
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve(image);
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image illisible'));
  });
}

function isInsidePlate(x, y, plate, margin = 1) {
  const dx = Math.abs(x - plate.cx); const dy = Math.abs(y - plate.cy);
  if (plate.shape === 'rectangle') return dx <= plate.rx * margin && dy <= plate.ry * margin;
  return (dx / (plate.rx * margin)) ** 2 + (dy / (plate.ry * margin)) ** 2 <= 1;
}

function extractRimFingerprint(image, spec) {
  const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 72;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, 72, 72);
  const imageData = context.getImageData(0, 0, 72, 72).data;
  const ratio = Math.max(0.45, Math.min(1.8, Number(spec.heightCm) / Math.max(1, Number(spec.widthCm))));
  const plate = { cx: 36, cy: 36, rx: 29.5, ry: Math.min(34, 29.5 * ratio), shape: spec.shape || 'round' };
  const vector = new Array(32).fill(0); let count = 0;
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < 72; x += 1) {
      if (!isInsidePlate(x, y, plate, 1) || isInsidePlate(x, y, plate, 0.76)) continue;
      const offset = (y * 72 + x) * 4;
      const r = imageData[offset] / 255; const g = imageData[offset + 1] / 255; const b = imageData[offset + 2] / 255;
      vector[Math.min(7, Math.floor(r * 8))] += 1;
      vector[8 + Math.min(7, Math.floor(g * 8))] += 1;
      vector[16 + Math.min(7, Math.floor(b * 8))] += 1;
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      vector[24 + Math.min(7, Math.floor(luminance * 8))] += 1;
      count += 1;
    }
  }
  if (!count) return vector;
  return vector.map((value) => value / count);
}

function fingerprintSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0; let normA = 0; let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]; normA += a[index] ** 2; normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

function renderPlateProfiles() {
  const select = $('plateProfileSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Assiette standard · 27 cm</option>' + state.plateProfiles.map((profile) => `<option value="${profile.id}">${escapeText(profile.name)} · ${profile.widthCm}${profile.heightCm !== profile.widthCm ? ` × ${profile.heightCm}` : ''} cm</option>`).join('');
  select.value = state.activePlateId;
  $('plateProfileList').innerHTML = state.plateProfiles.length ? state.plateProfiles.map((profile) => `<div class="plate-profile-row"><div><b>${escapeText(profile.name)}</b><small>${profile.shape === 'round' ? 'Ronde' : profile.shape === 'oval' ? 'Ovale' : profile.shape === 'rectangle' ? 'Rectangulaire' : 'Bol'} · ${profile.widthCm}${profile.heightCm !== profile.widthCm ? ` × ${profile.heightCm}` : ''} cm${profile.fingerprint?.length ? ' · empreinte enregistrée' : ''}</small></div><button type="button" data-delete-plate="${profile.id}">×</button></div>`).join('') : '<p class="plate-empty">Aucune assiette enregistrée.</p>';
  document.querySelectorAll('[data-delete-plate]').forEach((button) => button.addEventListener('click', async () => {
    await removePlateProfile(button.dataset.deletePlate);
    if (state.activePlateId === button.dataset.deletePlate) state.activePlateId = '';
    state.plateProfiles = await loadPlateProfiles();
    state.verifiedReferences = await loadVerifiedReferences().catch(() => []);
    renderPlateProfiles(); updatePlateSelection();
  }));
}

function updatePlateSelection() {
  const profile = activePlate();
  localStorage.setItem('macroflow-active-plate', state.activePlateId || '');
  $('plateDiameterCm').disabled = Boolean(profile);
  if (profile) $('plateDiameterCm').value = profile.widthCm;
  $('activePlateHint').textContent = profile ? `${profile.name} sélectionnée · mesures automatiques` : 'L’estimation utilise une assiette standard de 27 cm.';
  updatePlateOverlay();
}

async function suggestPlateProfiles() {
  const area = $('plateSuggestion');
  if (!area || !state.plateProfiles.length || !state.topUrl) { area?.classList.add('hidden'); return; }
  const image = await waitForImage($('smartTopImage'));
  const matches = state.plateProfiles.filter((profile) => profile.fingerprint?.length).map((profile) => ({ profile, score: fingerprintSimilarity(extractRimFingerprint(image, profile), profile.fingerprint) })).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!matches.length) { area.classList.add('hidden'); return; }
  area.innerHTML = `<b>Assiette probablement reconnue</b><p>Confirme avant l’analyse.</p>${matches.map(({ profile, score }) => `<button type="button" data-suggest-plate="${profile.id}"><span>${escapeText(profile.name)}</span><small>${Math.round(score * 100)} %</small></button>`).join('')}`;
  area.classList.remove('hidden');
  area.querySelectorAll('[data-suggest-plate]').forEach((button) => button.addEventListener('click', () => {
    state.activePlateId = button.dataset.suggestPlate;
    $('plateProfileSelect').value = state.activePlateId;
    updatePlateSelection(); area.classList.add('hidden');
  }));
}

async function savePlateFromForm() {
  const name = $('plateName').value.trim(); const shape = $('plateShape').value;
  const widthCm = localizedNumber($('plateWidthCm').value); const heightCm = shape === 'round' || shape === 'bowl' ? widthCm : localizedNumber($('plateHeightCm').value);
  if (!name || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm < 8 || heightCm < 8) return setStatus('Complète le nom et les mesures de l’assiette.', null, true);
  let fingerprint = null;
  if (state.plateReferenceUrl) {
    const image = new Image(); image.src = state.plateReferenceUrl; await waitForImage(image);
    fingerprint = extractRimFingerprint(image, { shape, widthCm, heightCm });
  }
  const profile = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, shape, widthCm, heightCm, depthCm: localizedNumber($('plateDepthCm').value) || 0, fingerprint, createdAt: new Date().toISOString() };
  await putPlateProfile(profile);
  state.plateProfiles = await loadPlateProfiles(); state.activePlateId = profile.id;
  renderPlateProfiles(); updatePlateSelection();
  $('plateName').value = ''; $('plateReferencePreview').classList.add('hidden');
  setStatus(`${name} enregistrée localement${fingerprint ? ' avec son empreinte visuelle' : ''}.`, null, false);
}

async function loadFile(input, kind) {
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  if (kind === 'top') {
    if (state.topUrl) URL.revokeObjectURL(state.topUrl);
    state.topFile = file;
    state.topUrl = url;
    $('smartTopImage').src = url;
    $('smartTopStage').classList.remove('hidden');
    $('smartResults').classList.add('hidden');
    $('smartPhotoReady')?.classList.remove('hidden');
    $('smartStatus')?.classList.add('hidden');
    $('smartAnalyzeBtn').disabled = false;
    $('smartAnalyzeBtn').textContent = 'Analyser mon repas';
    state.regions = [];
    state.results = [];
    const overlay = $('smartOverlayCanvas');
    if (overlay) {
      overlay.width = 0;
      overlay.height = 0;
    }
    setScanFlowStep('analyze');
  } else if (kind === 'angle') {
    if (state.angleUrl) URL.revokeObjectURL(state.angleUrl);
    state.angleFile = file;
    state.angleUrl = url;
    $('smartAnglePreview').src = url;
    $('smartAnglePreview').classList.remove('hidden');
  } else {
    if (state.plateReferenceUrl) URL.revokeObjectURL(state.plateReferenceUrl);
    state.plateReferenceFile = file;
    state.plateReferenceUrl = url;
    $('plateReferencePreview').src = url;
    $('plateReferencePreview').classList.remove('hidden');
  }
  updatePlateOverlay();
  if (kind === 'top') suggestPlateProfiles().catch((error) => console.warn('Plate suggestion unavailable', error));
}

function updatePlateOverlay() {
  const value = Number($('plateImagePercent')?.value || state.plateImagePercent);
  state.plateImagePercent = value;
  localStorage.setItem('macroflow-plate-percent', String(value));
  const circle = $('plateGuide');
  if (circle) {
    const spec = currentPlateSpec();
    const aspect = Math.max(0.45, Math.min(1.8, spec.widthCm / Math.max(1, spec.heightCm)));
    circle.style.width = `${value}%`;
    circle.style.height = 'auto';
    circle.style.aspectRatio = String(aspect);
    circle.style.borderRadius = spec.shape === 'rectangle' ? '18px' : '50%';
  }
  if ($('plateImagePercentValue')) $('plateImagePercentValue').textContent = `${value}% de la largeur`;
}

function getPlateGeometry(width, height) {
  const spec = currentPlateSpec();
  const widthPx = width * state.plateImagePercent / 100;
  const heightPx = Math.min(height * 0.98, widthPx * spec.heightCm / Math.max(1, spec.widthCm));
  return { cx: width / 2, cy: height / 2, rx: widthPx / 2, ry: heightPx / 2, radius: widthPx / 2, diameterPx: widthPx, shape: spec.shape || 'round' };
}

function imageToCanvas(image, maxSide = 1024) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function samplePlateColor(data, width, height, plate) {
  const samples = [];
  for (let i = 0; i < 72; i += 1) {
    const angle = i / 72 * Math.PI * 2;
    const x = Math.max(0, Math.min(width - 1, Math.round(plate.cx + Math.cos(angle) * plate.rx * 0.88)));
    const y = Math.max(0, Math.min(height - 1, Math.round(plate.cy + Math.sin(angle) * plate.ry * 0.88)));
    const offset = (y * width + x) * 4;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  }
  return [0, 1, 2].map((channel) => samples.map((s) => s[channel]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
}

function segmentRegion(imageData, box, plate) {
  const { data, width, height } = imageData;
  const rim = samplePlateColor(data, width, height, plate);
  const x1 = Math.max(0, Math.floor(box[0]));
  const y1 = Math.max(0, Math.floor(box[1]));
  const x2 = Math.min(width, Math.ceil(box[2]));
  const y2 = Math.min(height, Math.ceil(box[3]));
  let pixels = 0;
  const points = [];
  const stride = Math.max(1, Math.round(Math.max(width, height) / 480));
  for (let y = y1; y < y2; y += stride) {
    for (let x = x1; x < x2; x += stride) {
      if (!isInsidePlate(x, y, plate)) continue;
      const offset = (y * width + x) * 4;
      const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
      const distance = Math.hypot(r - rim[0], g - rim[1], b - rim[2]);
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      const dark = (r + g + b) / 3 < 105;
      if (distance > 38 || saturation > 34 || dark) {
        pixels += stride * stride;
        if (points.length < 6000) points.push([x, y]);
      }
    }
  }
  const boxArea = Math.max(1, (x2 - x1) * (y2 - y1));
  if (pixels < boxArea * 0.12) pixels = boxArea * 0.45;
  return { pixels, points, occupancy: Math.min(1, pixels / boxArea) };
}

function drawRegions(image, regions, canvas) {
  const base = imageToCanvas(image, 1024);
  const scaleX = base.canvas.width / image.naturalWidth;
  const scaleY = base.canvas.height / image.naturalHeight;
  canvas.width = base.canvas.width;
  canvas.height = base.canvas.height;
  const context = canvas.getContext('2d');
  context.drawImage(base.canvas, 0, 0);
  const colors = ['#bf5af2', '#30d158', '#ff9f0a', '#0a84ff', '#ff453a', '#ffd60a'];
  context.lineWidth = Math.max(2, canvas.width / 280);
  context.font = `700 ${Math.max(13, canvas.width / 35)}px -apple-system`;
  regions.forEach((region, index) => {
    const color = colors[index % colors.length];
    context.strokeStyle = color;
    context.fillStyle = `${color}33`;
    const [rawX1, rawY1, rawX2, rawY2] = region.box;
    const [x1, y1, x2, y2] = [rawX1 * scaleX, rawY1 * scaleY, rawX2 * scaleX, rawY2 * scaleY];
    context.fillRect(x1, y1, x2 - x1, y2 - y1);
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    context.fillStyle = color;
    const label = `${index + 1}. ${region.label}`;
    const labelWidth = context.measureText(label).width + 14;
    context.fillRect(x1, Math.max(0, y1 - 26), labelWidth, 26);
    context.fillStyle = '#fff';
    context.fillText(label, x1 + 7, Math.max(18, y1 - 7));
  });
}

function getDepthValues(depthOutput) {
  const image = depthOutput?.depth || depthOutput?.predicted_depth || depthOutput;
  if (!image) return null;
  const data = image.data || image;
  const width = image.width || image.dims?.at(-1);
  const height = image.height || image.dims?.at(-2);
  if (!data || !width || !height) return null;
  return { data, width, height };
}

function median(values) {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function regionDepthScore(depth, box, sourceWidth, sourceHeight, platePercent) {
  if (!depth) return 0.5;
  const sx = depth.width / sourceWidth;
  const sy = depth.height / sourceHeight;
  const x1 = Math.max(0, Math.floor(box[0] * sx));
  const y1 = Math.max(0, Math.floor(box[1] * sy));
  const x2 = Math.min(depth.width, Math.ceil(box[2] * sx));
  const y2 = Math.min(depth.height, Math.ceil(box[3] * sy));
  const inside = [];
  for (let y = y1; y < y2; y += 3) for (let x = x1; x < x2; x += 3) inside.push(Number(depth.data[y * depth.width + x]));
  const rim = [];
  const cx = depth.width / 2; const cy = depth.height / 2;
  const radius = depth.width * platePercent / 200 * 0.9;
  for (let i = 0; i < 80; i += 1) {
    const a = i / 80 * Math.PI * 2;
    const x = Math.max(0, Math.min(depth.width - 1, Math.round(cx + Math.cos(a) * radius)));
    const y = Math.max(0, Math.min(depth.height - 1, Math.round(cy + Math.sin(a) * radius)));
    rim.push(Number(depth.data[y * depth.width + x]));
  }
  const delta = Math.abs(median(inside) - median(rim));
  const all = [...inside.slice(0, 1000), ...rim];
  const range = Math.max(...all) - Math.min(...all) || 1;
  return Math.max(0.15, Math.min(1, delta / range * 2.2));
}

const SCANNER_ENGINE_VERSION = '20260716b';
const SCANNER_ENGINE_TIMEOUT_MS = 45000;

function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} a dépassé ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function versionedAsset(path) {
  const url = new URL(path, window.location.href);
  url.searchParams.set('mfscanner', SCANNER_ENGINE_VERSION);
  return url.href;
}

async function freshModuleImport(path, label) {
  const url = versionedAsset(path);
  let blobUrl = '';
  try {
    setStatus(`Préparation de ${label}…`, 5);
    const response = await withTimeout(fetch(url, { cache: 'reload', credentials: 'same-origin' }), 20000, `Téléchargement de ${label}`);
    if (!response.ok) throw new Error(`${label} introuvable (${response.status})`);
    const source = await response.text();
    if (!source || source.length < 100) throw new Error(`${label} est vide ou incomplet`);
    blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    state.moduleBlobUrls ||= [];
    state.moduleBlobUrls.push(blobUrl);
    return await withTimeout(import(blobUrl), 20000, `Ouverture de ${label}`);
  } catch (blobError) {
    console.warn(`${label} blob import fallback`, blobError);
    try {
      return await withTimeout(import(url), 20000, `Ouverture directe de ${label}`);
    } catch (directError) {
      const error = new Error(`${label} n'a pas pu être chargé sur Safari`);
      error.cause = directError;
      error.details = `${blobError?.message || blobError} | ${directError?.message || directError}`;
      throw error;
    }
  }
}

async function createFreshWasmPaths() {
  if (state.wasmPaths) return state.wasmPaths;
  const mjsUrl = versionedAsset('./vendor/ort-wasm-simd-threaded.jsep.mjs');
  const wasmUrl = versionedAsset('./vendor/ort-wasm-simd-threaded.jsep.wasm');
  try {
    const response = await withTimeout(fetch(mjsUrl, { cache: 'reload', credentials: 'same-origin' }), 20000, 'Téléchargement du module WebAssembly');
    if (!response.ok) throw new Error(`Module WebAssembly introuvable (${response.status})`);
    const source = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    state.moduleBlobUrls ||= [];
    state.moduleBlobUrls.push(blobUrl);
    state.wasmPaths = { mjs: blobUrl, wasm: wasmUrl };
  } catch (error) {
    console.warn('WASM blob preparation fallback', error);
    state.wasmPaths = { mjs: mjsUrl, wasm: wasmUrl };
  }
  return state.wasmPaths;
}

function configureWasmEnvironment(env) {
  if (!env?.wasm) return;
  env.wasm.wasmPaths = state.wasmPaths;
  env.wasm.numThreads = 1;
  env.wasm.proxy = false;
  env.wasm.initTimeout = SCANNER_ENGINE_TIMEOUT_MS;
}

async function ensureDepthModel() {
  if (state.depthEstimator || state.depthUnavailable) return;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!navigator.gpu) {
    state.depthUnavailable = true;
    return;
  }
  try {
    setStatus('Ouverture optionnelle du moteur de profondeur…', 70);
    state.transformers ||= await freshModuleImport('./vendor/transformers.min.js', 'le moteur de profondeur');
    const { env, pipeline } = state.transformers;
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = './models/';
    await createFreshWasmPaths();
    configureWasmEnvironment(env.backends?.onnx);
    let loaded = 0;
    const progress = (entry) => {
      if (entry.status === 'progress' && Number.isFinite(entry.loaded)) loaded = Math.max(loaded, entry.loaded);
      setStatus(`Profondeur locale : ${humanBytes(loaded)} / ~${humanBytes(MODEL_BYTES)}`, Math.min(94, 70 + loaded / MODEL_BYTES * 24));
    };
    const depthTimeout = isAppleMobile ? 35000 : 60000;
    state.depthEstimator = await withTimeout(pipeline('depth-estimation', 'depth-anything', {
      local_files_only: true,
      device: 'webgpu',
      dtype: 'q4f16',
      progress_callback: progress,
    }), depthTimeout, 'Chargement du modèle de profondeur');
  } catch (error) {
    console.warn('Optional depth model unavailable; continuing with plate calibration', error);
    state.depthUnavailable = true;
    state.depthEstimator = null;
  }
}

async function ensureModels() {
  if (state.foodSegSession && (state.depthEstimator || state.depthUnavailable)) return;
  await createFreshWasmPaths();
  if (!state.ort) {
    setStatus('Ouverture sécurisée du moteur de segmentation…', 8);
    state.ort = await freshModuleImport('./vendor/ort.min.js', 'le moteur ONNX');
    configureWasmEnvironment(state.ort.env);
  }
  if (!state.foodSegSession) {
    setStatus('Chargement du modèle FoodSeg103 (~15 Mo)…', 32);
    const modelUrl = versionedAsset('./models/foodseg103.onnx');
    try {
      state.foodSegSession = await withTimeout(state.ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      }), SCANNER_ENGINE_TIMEOUT_MS, 'Initialisation de FoodSeg103');
    } catch (firstError) {
      console.warn('FoodSeg first initialization failed; retrying once', firstError);
      state.foodSegSession = null;
      configureWasmEnvironment(state.ort.env);
      state.foodSegSession = await withTimeout(state.ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic',
      }), SCANNER_ENGINE_TIMEOUT_MS, 'Deuxième initialisation de FoodSeg103');
    }
  }
  setStatus('Segmentation prête. Vérification optionnelle de la profondeur…', 68);
  await ensureDepthModel();
  const depthMode = state.depthEstimator ? 'avec profondeur WebGPU' : 'avec calibration de l’assiette et hauteur typique';
  setStatus(`Modèles prêts ${depthMode}. La photo reste sur cet appareil.`, 100);
}

function sigmoid(value) { return 1 / (1 + Math.exp(-value)); }

function intersectionOverUnion(a, b) {
  const x1 = Math.max(a.box[0], b.box[0]); const y1 = Math.max(a.box[1], b.box[1]);
  const x2 = Math.min(a.box[2], b.box[2]); const y2 = Math.min(a.box[3], b.box[3]);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a.box[2] - a.box[0]) * Math.max(0, a.box[3] - a.box[1]);
  const areaB = Math.max(0, b.box[2] - b.box[0]) * Math.max(0, b.box[3] - b.box[1]);
  return intersection / Math.max(1, areaA + areaB - intersection);
}

function nms(detections, limit = 10) {
  const kept = [];
  for (const detection of detections.sort((a, b) => b.score - a.score)) {
    if (kept.every((other) => detection.classId !== other.classId || intersectionOverUnion(detection, other) < 0.48)) kept.push(detection);
    if (kept.length >= limit) break;
  }
  return kept;
}

function maskRatioForDetection(detection, prototypes) {
  const [,, protoHeight, protoWidth] = prototypes.dims;
  const protoArea = protoWidth * protoHeight;
  const x1 = Math.max(0, Math.floor(detection.inputBox[0] / 768 * protoWidth));
  const y1 = Math.max(0, Math.floor(detection.inputBox[1] / 768 * protoHeight));
  const x2 = Math.min(protoWidth, Math.ceil(detection.inputBox[2] / 768 * protoWidth));
  const y2 = Math.min(protoHeight, Math.ceil(detection.inputBox[3] / 768 * protoHeight));
  let active = 0; let total = 0;
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const pixel = y * protoWidth + x;
      let logit = 0;
      for (let channel = 0; channel < 32; channel += 1) logit += detection.coefficients[channel] * prototypes.data[channel * protoArea + pixel];
      if (sigmoid(logit) > 0.52) active += 1;
      total += 1;
    }
  }
  return total ? Math.max(0.08, Math.min(1, active / total)) : 0.5;
}

async function detectRegions(imageUrl, displayImage) {
  const inputSize = 768;
  const sourceWidth = displayImage.naturalWidth; const sourceHeight = displayImage.naturalHeight;
  const scale = Math.min(inputSize / sourceWidth, inputSize / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale); const drawHeight = Math.round(sourceHeight * scale);
  const offsetX = Math.floor((inputSize - drawWidth) / 2); const offsetY = Math.floor((inputSize - drawHeight) / 2);
  const canvas = document.createElement('canvas'); canvas.width = inputSize; canvas.height = inputSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#727272'; context.fillRect(0, 0, inputSize, inputSize);
  context.drawImage(displayImage, offsetX, offsetY, drawWidth, drawHeight);
  const pixels = context.getImageData(0, 0, inputSize, inputSize).data;
  const plane = inputSize * inputSize; const tensorData = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    tensorData[index] = pixels[index * 4] / 255;
    tensorData[plane + index] = pixels[index * 4 + 1] / 255;
    tensorData[plane * 2 + index] = pixels[index * 4 + 2] / 255;
  }
  const output = await state.foodSegSession.run({ images: new state.ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize]) });
  const predictions = output.output0; const prototypes = output.output1;
  const anchors = predictions.dims[2]; const channels = predictions.dims[1]; const classCount = channels - 4 - 32;
  const detections = [];
  for (let anchor = 0; anchor < anchors; anchor += 1) {
    let classId = 0; let score = 0;
    for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
      const value = predictions.data[(4 + classIndex) * anchors + anchor];
      if (value > score) { score = value; classId = classIndex; }
    }
    const classThreshold = classId === 24 ? 0.10 : 0.15;
    if (score < classThreshold || classId === 0) continue;
    const centerX = predictions.data[anchor]; const centerY = predictions.data[anchors + anchor];
    const width = predictions.data[anchors * 2 + anchor]; const height = predictions.data[anchors * 3 + anchor];
    const inputBox = [centerX - width / 2, centerY - height / 2, centerX + width / 2, centerY + height / 2];
    const box = [
      Math.max(0, (inputBox[0] - offsetX) / scale), Math.max(0, (inputBox[1] - offsetY) / scale),
      Math.min(sourceWidth, (inputBox[2] - offsetX) / scale), Math.min(sourceHeight, (inputBox[3] - offsetY) / scale),
    ];
    if (box[2] <= box[0] || box[3] <= box[1]) continue;
    const coefficients = new Float32Array(32);
    for (let channel = 0; channel < 32; channel += 1) coefficients[channel] = predictions.data[(4 + classCount + channel) * anchors + anchor];
    detections.push({ classId, score, box, inputBox, coefficients });
  }
  // FoodSeg103 confond parfois les œufs brouillés avec du riz, des nouilles ou des pommes de terre
  // lorsque toutes les prédictions sont faibles et occupent exactement la même zone. Dans ce cas,
  // on privilégie l'œuf uniquement si sa prédiction est presque aussi forte que la meilleure.
  const eggCandidate = detections.filter((item) => item.classId === 24).sort((a, b) => b.score - a.score)[0];
  let adjustedDetections = detections;
  if (eggCandidate) {
    const strongest = [...detections].sort((a, b) => b.score - a.score)[0];
    const commonScrambledEggConfusions = new Set([3, 9, 65, 66, 69]);
    if (strongest && commonScrambledEggConfusions.has(strongest.classId) && strongest.score < 0.25 && eggCandidate.score >= strongest.score - 0.06 && intersectionOverUnion(eggCandidate, strongest) >= 0.72) {
      eggCandidate.score = Math.max(eggCandidate.score, strongest.score + 0.015);
      eggCandidate.scrambledEggHint = true;
      adjustedDetections = detections.filter((item) => item === eggCandidate || !commonScrambledEggConfusions.has(item.classId) || item.score >= 0.25 || intersectionOverUnion(eggCandidate, item) < 0.72);
    }
  }
  const grouped = new Map();
  for (const detection of nms(adjustedDetections, 18)) {
    const ratio = maskRatioForDetection(detection, prototypes);
    const area = Math.max(1, (detection.box[2] - detection.box[0]) * (detection.box[3] - detection.box[1]));
    const existing = grouped.get(detection.classId);
    if (!existing) {
      grouped.set(detection.classId, { classId: detection.classId, box: [...detection.box], score: detection.score, maskedArea: area * ratio, scrambledEggHint: Boolean(detection.scrambledEggHint) });
    } else {
      existing.box = [Math.min(existing.box[0], detection.box[0]), Math.min(existing.box[1], detection.box[1]), Math.max(existing.box[2], detection.box[2]), Math.max(existing.box[3], detection.box[3])];
      existing.score = Math.max(existing.score, detection.score);
      existing.maskedArea += area * ratio;
      existing.scrambledEggHint ||= Boolean(detection.scrambledEggHint);
    }
  }
  const regions = [...grouped.values()].sort((a, b) => b.score - a.score).slice(0, 10).map((detection) => {
    const unionArea = Math.max(1, (detection.box[2] - detection.box[0]) * (detection.box[3] - detection.box[1]));
    const rawLabel = FOODSEG_LABELS[detection.classId] || 'other ingredients';
    return {
      label: detection.scrambledEggHint ? 'œufs brouillés' : (FR_LABELS[rawLabel] || rawLabel),
      rawLabel,
      box: detection.box,
      score: detection.score,
      maskRatio: Math.max(0.06, Math.min(1, detection.maskedArea / unionArea)),
    };
  });
  if (!regions.length) throw new Error('Aucun ingrédient distinct détecté. Utilise le scanner classique ou ajoute manuellement.');
  return regions;
}

async function estimateQuantities(regions, displayImage) {
  const { canvas, context } = imageToCanvas(displayImage, 1024);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / displayImage.naturalWidth;
  const scaleY = canvas.height / displayImage.naturalHeight;
  const plate = getPlateGeometry(canvas.width, canvas.height);
  const spec = currentPlateSpec();
  const plateAreaPx = plate.shape === 'rectangle' ? plate.rx * 2 * plate.ry * 2 * 0.92 : Math.PI * plate.rx * plate.ry;
  const realPlateAreaCm2 = plateAreaCm2(spec);
  setStatus('Calcul de la profondeur et de la hauteur des aliments…', 96);
  let depth = null;
  if (state.depthEstimator) {
    try { depth = getDepthValues(await state.depthEstimator(state.topUrl)); } catch (error) { console.warn('Depth fallback', error); }
  }
  let angleDepthBoost = 1;
  if (state.angleUrl && state.depthEstimator) {
    try {
      const angleDepth = getDepthValues(await state.depthEstimator(state.angleUrl));
      if (angleDepth) angleDepthBoost = 1.08;
    } catch (error) { console.warn('Second view fallback', error); }
  }
  return regions.map((region) => {
    const scaledBox = [region.box[0] * scaleX, region.box[1] * scaleY, region.box[2] * scaleX, region.box[3] * scaleY];
    const classicalSegment = segmentRegion(imageData, scaledBox, plate);
    const boxArea = Math.max(1, (scaledBox[2] - scaledBox[0]) * (scaledBox[3] - scaledBox[1]));
    const segmented = region.maskRatio ? { pixels: boxArea * region.maskRatio, occupancy: region.maskRatio } : classicalSegment;
    const food = lookupFood(region.rawLabel || region.label);
    const areaCm2 = segmented.pixels / plateAreaPx * realPlateAreaCm2;
    const depthScore = regionDepthScore(depth, scaledBox, canvas.width, canvas.height, state.plateImagePercent);
    const heightCm = food.height * (0.72 + depthScore * 0.56) * angleDepthBoost;
    const volumeMl = areaCm2 * heightCm * food.shape;
    const rawGrams = volumeMl * food.density;
    const grams = Math.round(Math.max(8, Math.min(650, rawGrams)) / 5) * 5;
    const factor = grams / 100;
    const confidence = Math.round(Math.max(35, Math.min(90, (region.score || 0.45) * 42 + 28 + segmented.occupancy * 8 + (depth ? 6 : 0) + (state.angleUrl ? 5 : 0) + (food.matched ? 3 : -6))));
    const item = {
      label: region.label,
      grams,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
      per100: food,
      confidence,
      matched: food.matched,
      visualVolume: volumeMl,
      estimateSource: 'generic',
      referenceCount: 0,
      region,
    };
    const estimated = applyVerifiedEstimate(item);
    estimated.scanEstimatedGrams = Number(estimated.grams);
    estimated.scanEstimateSource = estimated.estimateSource;
    return estimated;
  });
}

function totals() {
  return state.results.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs,
    fat: sum.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function renderResults() {
  const total = totals();
  $('smartTotal').innerHTML = `<strong>${Math.round(total.calories)} kcal</strong><span>${total.protein.toFixed(1)} g protéines · ${total.carbs.toFixed(1)} g glucides · ${total.fat.toFixed(1)} g lipides</span>`;
  const confidence = mealConfidence(state.results);
  if ($('smartConfidenceSummary')) { $('smartConfidenceSummary').className = `smart-confidence-summary ${confidence.stars < 4 ? 'warn' : ''}`; $('smartConfidenceSummary').innerHTML = `<b>${'★'.repeat(confidence.stars)}${'☆'.repeat(5-confidence.stars)} · ${confidence.label}</b><br><span>${confidence.score}% fondé sur ${state.results.filter((item) => item.estimateSource === 'verified' || item.estimateSource === 'verified-now').length}/${state.results.length} portions vérifiées. Les huiles et sauces invisibles restent à confirmer.</span>`; }
  $('smartIngredientList').innerHTML = state.results.map((item, index) => `
    <div class="smart-ingredient" data-smart-index="${index}">
      <div class="smart-ingredient-head"><b>${index + 1}. <input class="smart-name" value="${item.label.replace(/"/g, '&quot;')}" aria-label="Nom de l’ingrédient"></b><span class="smart-confidence ${item.estimateSource === 'verified' || item.estimateSource === 'verified-now' ? 'verified' : item.confidence < 55 ? 'low' : ''}">${item.estimateSource === 'verified-now' ? 'Pesé' : item.estimateSource === 'verified' ? `Vérifié · ${item.referenceCount}` : `${item.confidence}%`}</span></div>
      <div class="smart-fields"><label>Quantité<input class="smart-grams" type="text" inputmode="decimal" pattern="[0-9]+([.,][0-9]+)?" value="${item.grams}"><small>g</small></label><div><strong class="smart-kcal">${item.calories} kcal</strong><small class="smart-macros">${item.protein} P · ${item.carbs} G · ${item.fat} L</small></div></div>
      <div class="smart-reference-actions"><button class="smart-verify" type="button">${item.estimateSource === 'verified-now' ? '✓ Portion vérifiée' : '✓ Vérifier cette portion pesée'}</button><button class="smart-remove" type="button">Retirer</button></div>
      <p class="smart-source-note">${item.estimateSource === 'verified' ? `Quantité calculée à partir de ${item.referenceCount} portion${item.referenceCount > 1 ? 's' : ''} réellement pesée${item.referenceCount > 1 ? 's' : ''}.` : item.estimateSource === 'verified-now' ? 'Cette quantité a été enregistrée comme vérité de référence.' : 'Estimation visuelle non vérifiée : corrige les grammes avec une balance avant de l’enregistrer comme référence.'}</p>${item.matched ? '' : '<p class="smart-warning">Aliment non relié précisément à la base locale : macros génériques à corriger.</p>'}
    </div>`).join('');
  $('smartResults').classList.remove('hidden');
  $('smartAddAllBtn').disabled = state.results.length === 0;
  $('smartIngredientList').querySelectorAll('.smart-ingredient').forEach((element) => {
    const index = Number(element.dataset.smartIndex);
    element.querySelector('.smart-name').addEventListener('change', (event) => {
      const item = state.results[index];
      item.label = event.target.value.trim() || item.label;
      item.per100 = lookupFood(item.label);
      item.matched = item.per100.matched;
      recalcItem(item);
      renderResults();
    });
    element.querySelector('.smart-grams').addEventListener('input', (event) => {
      state.results[index].grams = Math.max(1, localizedNumber(event.target.value) || 1);
      recalcItem(state.results[index]);
      const updated = totals();
      $('smartTotal').innerHTML = `<strong>${Math.round(updated.calories)} kcal</strong><span>${updated.protein.toFixed(1)} g protéines · ${updated.carbs.toFixed(1)} g glucides · ${updated.fat.toFixed(1)} g lipides</span>`;
      element.querySelector('.smart-kcal').textContent = `${state.results[index].calories} kcal`;
      element.querySelector('.smart-macros').textContent = `${state.results[index].protein} P · ${state.results[index].carbs} G · ${state.results[index].fat} L`;
    });
    element.querySelector('.smart-verify').addEventListener('click', () => verifyResult(index).catch((error) => setStatus(`Impossible de vérifier cette portion : ${error.message || error}`, null, true)));
    element.querySelector('.smart-remove').addEventListener('click', () => {
      state.results.splice(index, 1);
      renderResults();
    });
  });
  if (state.results.length) setScanFlowStep('review');
  $('smartResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function recalcItem(item) {
  const factor = item.grams / 100;
  item.calories = Math.round(item.per100.calories * factor);
  item.protein = Math.round(item.per100.protein * factor * 10) / 10;
  item.carbs = Math.round(item.per100.carbs * factor * 10) / 10;
  item.fat = Math.round(item.per100.fat * factor * 10) / 10;
}

async function runAnalysis() {
  if (state.busy) return;
  if (!state.topFile) return setStatus('Prends d’abord la photo du dessus.', null, true);
  if (!activePlate()) {
    state.plateDiameterCm = Math.max(10, Math.min(50, Number($('plateDiameterCm').value) || 27));
    localStorage.setItem('macroflow-plate-cm', String(state.plateDiameterCm));
  }
  state.busy = true;
  $('smartAnalyzeBtn').disabled = true;
  $('smartAnalyzeBtn').textContent = 'Analyse en cours…';
  setScanFlowStep('analyze');
  try {
    const image = $('smartTopImage');
    await withTimeout(waitForImage(image), 12000, 'Décodage de la photo');
    await ensureModels();
    setStatus('Détection locale des ingrédients séparés…', 95);
    const regions = await detectRegions(state.topUrl, image);
    state.regions = regions;
    drawRegions(image, regions, $('smartOverlayCanvas'));
    state.results = await estimateQuantities(regions, image);
    setStatus('Estimation terminée. Vérifie les ingrédients et les grammes avant d’enregistrer.', 100);
    renderResults();
  } catch (error) {
    console.error(error);
    const details = error?.details ? ` (${error.details})` : '';
    setStatus(`Le scanner avancé n’a pas terminé : ${error.message || error}${details}. Réessaie une fois; le scanner classique reste disponible plus bas.`, null, true);
  } finally {
    state.busy = false;
    $('smartAnalyzeBtn').disabled = false;
    $('smartAnalyzeBtn').textContent = state.results.length ? 'Analyser de nouveau' : 'Réessayer l’analyse';
  }
}

function updatePlateFormShape() {
  const shape = $('plateShape').value;
  const needsSecondMeasure = shape === 'oval' || shape === 'rectangle';
  $('plateHeightField').classList.toggle('hidden', !needsSecondMeasure);
  $('plateWidthLabel').textContent = shape === 'round' || shape === 'bowl' ? 'Diamètre / ouverture (cm)' : 'Largeur (cm)';
  $('plateDepthField').classList.toggle('hidden', shape !== 'bowl');
}

async function bind() {
  if (!$('smartScanner')) return;
  $('plateDiameterCm').value = state.plateDiameterCm;
  $('plateImagePercent').value = state.plateImagePercent;
  renderPlateProfiles(); updatePlateSelection(); updatePlateFormShape();
  updatePlateOverlay();
  setScanFlowStep('photo');
  renderPersonalShortcuts();
  $('smartTopInput').addEventListener('change', (event) => loadFile(event.target, 'top'));
  $('smartGalleryInput')?.addEventListener('change', (event) => loadFile(event.target, 'top'));
  $('smartAngleInput').addEventListener('change', (event) => loadFile(event.target, 'angle'));
  $('plateReferenceInput').addEventListener('change', (event) => loadFile(event.target, 'reference'));
  $('plateImagePercent').addEventListener('input', updatePlateOverlay);
  $('plateProfileSelect').addEventListener('change', (event) => { state.activePlateId = event.target.value; updatePlateSelection(); });
  $('plateManagerToggle').addEventListener('click', () => {
    const advanced = $('smartAdvancedOptions');
    const manager = $('plateManager');
    const willOpen = manager.classList.contains('hidden');
    if (advanced) advanced.open = true;
    manager.classList.toggle('hidden');
    $('plateManagerToggle').textContent = willOpen ? 'Fermer' : 'Gérer mes assiettes';
    if (willOpen) setTimeout(() => manager.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  });
  $('plateShape').addEventListener('change', updatePlateFormShape);
  $('savePlateProfileBtn').addEventListener('click', () => savePlateFromForm().catch((error) => setStatus(`Impossible d’enregistrer l’assiette : ${error.message || error}`, null, true)));
  $('smartAnalyzeBtn').addEventListener('click', runAnalysis);
  $('smartSaveRecipeBtn')?.addEventListener('click', () => savePersonalMeal('recipe'));
  $('smartSaveHabitBtn')?.addEventListener('click', () => savePersonalMeal('habit'));
  $('smartAddAllBtn').addEventListener('click', () => {
    if (!state.results.length) return;
    recordHabitUse();
    window.dispatchEvent(new CustomEvent('macroflow:add-smart-meal', { detail: { items: state.results.map((item) => ({ ...item })), totals: totals(), confidence: mealConfidence(state.results) } }));
  });
  try {
    state.plateProfiles = await loadPlateProfiles();
    state.verifiedReferences = await loadVerifiedReferences().catch(() => []);
    if (state.activePlateId && !activePlate()) state.activePlateId = '';
    renderPlateProfiles(); updatePlateSelection();
  } catch (error) {
    console.warn('Plate profiles unavailable', error);
  }
}

bind().catch((error) => console.warn('Smart scanner initialization failed', error));
