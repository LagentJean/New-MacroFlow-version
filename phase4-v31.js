(() => {
  'use strict';
  const VERSION = 34;
  const $ = (id) => document.getElementById(id);
  const colors = { calories:'#bf5af2', protein:'#30d158', carbs:'#0a84ff', fat:'#ff9f0a' };
  const viewMeta = {
    home:['Aujourd’hui','MacroFlow'], scan:['Nutrition','Scanner'], workout:['Entraînement','Mon plan'],
    progress:['Progression','Mes progrès'], settings:['Profil et données','Réglages']
  };
  let lastScore = 0, initialized = false;
  const numberFrom = (text) => { const m=String(text||'').replace(/\s/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/); return m?Number(m[0]):0; };
  const pct = (v,g) => Math.max(0,Math.min(1,(Number(v)||0)/(Number(g)||1)));

  function haptic(kind='light'){ try{ window.MacroFlowDelight?.haptic?.(kind); }catch{} }
  function readMacroCards(){
    const r={totals:{calories:0,protein:0,carbs:0,fat:0},goals:{calories:1,protein:1,carbs:1,fat:1}}, keys=['calories','protein','carbs','fat'];
    document.querySelectorAll('#macroGrid .macro-card').forEach((card,i)=>{ const k=keys[i]; if(!k)return; r.totals[k]=numberFrom(card.querySelector('.macro-value')?.textContent); const s=card.querySelectorAll('.macro-sub span'); r.goals[k]=Math.max(1,numberFrom(s[1]?.textContent)); });
    return r;
  }
  function upgradeMacroRing(){
    const card=$('scoreRing')?.closest('.score-card'); if(!card || card.classList.contains('macro-orbit-card')) return;
    card.classList.add('macro-orbit-card'); const old=$('scoreRing'), orbit=document.createElement('div'); orbit.className='macro-orbit'; orbit.id='macroOrbit';
    const radius=58;
    orbit.innerHTML=`<svg viewBox="0 0 138 138" aria-label="Progression des macros"><circle class="track" cx="69" cy="69" r="${radius}"/>${['calories','protein','carbs','fat'].map(k=>`<circle class="arc arc-${k}" cx="69" cy="69" r="${radius}" stroke="${colors[k]}"/>`).join('')}</svg><div class="macro-orbit-center"><strong id="phase4Calories">0</strong><span>kcal consommées</span><small id="phase4CaloriesLeft">objectif</small></div>`;
    old.replaceWith(orbit);
    const legend=document.createElement('div'); legend.className='macro-orbit-legend'; legend.innerHTML=Object.entries(colors).map(([k,c])=>`<span><i style="color:${c};background:${c}"></i>${({calories:'Calories',protein:'Protéines',carbs:'Glucides',fat:'Lipides'})[k]}</span>`).join(''); card.querySelector('.score-copy')?.append(legend);
  }
  function updateRing(){
    upgradeMacroRing(); const d=readMacroCards(),t=d.totals,g=d.goals; if(!$('macroOrbit'))return;
    $('phase4Calories').textContent=Math.round(t.calories).toLocaleString('fr-CA'); const left=Math.round(g.calories-t.calories); $('phase4CaloriesLeft').textContent=left>0?`${left} restantes`:`objectif atteint`;
    const circumference=2*Math.PI*58, segment=circumference/4, gap=8;
    ['calories','protein','carbs','fat'].forEach((k,i)=>{ const a=document.querySelector(`.arc-${k}`); if(!a)return; const fill=(segment-gap)*pct(t[k],g[k]); a.style.strokeDasharray=`${fill} ${circumference-fill}`; a.style.strokeDashoffset=String(-(i*segment)); a.setAttribute('aria-label',`${k} ${Math.round(pct(t[k],g[k])*100)} %`); });
    document.querySelectorAll('.macro-card').forEach((c,i)=>{ const k=['calories','protein','carbs','fat'][i]; if(k)c.style.setProperty('--macro-glow',`${colors[k]}22`); });
    const score=Number($('scoreValue')?.textContent || document.querySelector('.score-card')?.dataset.dailyScore)||0; if(initialized&&score>=90&&lastScore<90)celebrate(); lastScore=score; initialized=true;
  }
  function celebrate(){ if(matchMedia('(prefers-reduced-motion: reduce)').matches)return; const l=document.createElement('div'); l.className='celebration-layer'; const p=Object.values(colors); for(let i=0;i<24;i++){const e=document.createElement('i');e.className='celebration-particle';e.style.cssText=`--particle:${p[i%4]};--x:${(Math.random()-.5)*320}px;--y:${-80-Math.random()*280}px;--r:${Math.random()*540}deg;animation-delay:${Math.random()*.12}s`;l.append(e)} document.body.append(l);setTimeout(()=>l.remove(),1300);haptic('success'); }
  function profileExists(){ return ['macroflow-profile','macroflow-onboarding-v15','macroflow-training-profile'].some(k=>{try{return !!localStorage.getItem(k)}catch{return false}}); }
  function installWelcome(){
    if(localStorage.getItem('macroflow-phase4-welcome-seen')==='1')return; const hasProfile=profileExists();
    const o=document.createElement('section');o.className='phase4-welcome';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.innerHTML=`<div class="phase4-welcome-card"><div class="phase4-logo">⚡</div><span class="eyebrow">Ton système personnel</span><h1>Bienvenue dans MacroFlow</h1><p>Nutrition fiable, entraînement intelligent et progression, sans abonnement et sans sacrifier tes données.</p><div class="phase4-features"><div><b>📷</b><small>Scanner vérifié</small></div><div><b>🏋️</b><small>Plan personnalisé</small></div><div><b>🔒</b><small>Données locales</small></div></div><button class="phase4-start">${hasProfile?'Ouvrir MacroFlow':'Créer mon plan'}</button><small class="phase4-local-note">Tout reste sur ton appareil.</small></div>`;
    document.body.append(o); requestAnimationFrame(()=>o.classList.add('ready')); o.querySelector('button').focus(); o.querySelector('button').addEventListener('click',()=>{localStorage.setItem('macroflow-phase4-welcome-seen','1');o.classList.add('hidden-welcome');haptic('medium');setTimeout(()=>o.remove(),420);});
  }
  function contextualHeader(view){ const m=viewMeta[view]||viewMeta.home; const eye=$('todayLabel'), title=document.querySelector('.topbar h1'); if(eye)eye.textContent=m[0]; if(title)title.textContent=m[1]; }
  function animateView(view){ const el=document.querySelector(`[data-view="${view}"]`); if(!el)return; el.classList.remove('phase4-enter'); void el.offsetWidth; el.classList.add('phase4-enter'); const cards=[...el.querySelectorAll('.card,.section-head,.quick-actions')].slice(0,12); cards.forEach((c,i)=>{c.style.setProperty('--reveal-delay',`${Math.min(i*28,220)}ms`);c.classList.add('phase4-reveal')}); }
  function installNavigationPolish(){
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{const view=tab.dataset.tab;contextualHeader(view);animateView(view);haptic('selection');setTimeout(()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}),0);}));
    document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.open;if(v){contextualHeader(v);animateView(v)}}));
    const active=document.querySelector('.tab.active')?.dataset.tab||'home'; contextualHeader(active); animateView(active);
  }
  function installPressFeedback(){ document.addEventListener('pointerdown',e=>{const b=e.target.closest('button,.primary-action,.secondary-action,label.scan-primary-capture');if(b)b.classList.add('is-pressed')}); document.addEventListener('pointerup',()=>document.querySelectorAll('.is-pressed').forEach(e=>e.classList.remove('is-pressed'))); document.addEventListener('pointercancel',()=>document.querySelectorAll('.is-pressed').forEach(e=>e.classList.remove('is-pressed'))); }
  function polishAccessibility(){ document.querySelectorAll('button:not([type])').forEach(b=>b.type='button');document.querySelectorAll('.card').forEach(c=>{if(!c.getAttribute('role')&&c.querySelector('button'))c.setAttribute('role','group')});document.querySelectorAll('input,select,button').forEach(e=>{if(!e.getAttribute('aria-label')&&!e.textContent.trim()&&!e.id)e.setAttribute('aria-label','Action MacroFlow')}); }
  function handleViewChange(view){ if(!view)return; contextualHeader(view); animateView(view); if(view==='home')requestAnimationFrame(updateRing); }
  function boot(){
    installWelcome();upgradeMacroRing();updateRing();polishAccessibility();installNavigationPolish();installPressFeedback();
    window.addEventListener('macroflow:home-rendered',()=>requestAnimationFrame(updateRing));
    window.addEventListener('macroflow:view-change',(event)=>handleViewChange(event.detail?.view));
    let lastObservedView=document.querySelector('.view.active')?.dataset.view||null;
    new MutationObserver(()=>{
      const active=document.querySelector('.view.active')?.dataset.view||null;
      if(!active || active===lastObservedView) return;
      lastObservedView=active;
      handleViewChange(active);
    }).observe(document.querySelector('main')||document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.MacroFlowPhase4=Object.freeze({version:VERSION,updateRing,celebrate,animateView});
})();
