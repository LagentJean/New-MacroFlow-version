(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.MacroFlowNutrition=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const roundTo=(v,step)=>Math.round(v/step)*step;
  function estimatePlan(profile){
    const age=Number(profile.age), weight=Number(profile.weightKg), height=Number(profile.heightCm);
    if(!Number.isFinite(age)||!Number.isFinite(weight)||!Number.isFinite(height)) throw new Error('Profil incomplet');
    const male=10*weight+6.25*height-5*age+5;
    const female=10*weight+6.25*height-5*age-161;
    const bmr=profile.sex==='male'?male:profile.sex==='female'?female:(male+female)/2;
    const movement=({low:1.25,average:1.35,high:1.45})[profile.dailyMovement]||1.35;
    const minutes=Math.max(0,Number(profile.days||0)*Number(profile.maxMinutes||0));
    const lifting=Math.min(.20,minutes/420*.20);
    const external=({none:0,light:.04,moderate:.09,high:.15})[profile.activityLoad]||0;
    const activityMultiplier=clamp(movement+lifting+external,1.2,1.85);
    const maintenance=roundTo(bmr*activityMultiplier,25);
    const youth=age<18;
    let target=maintenance, rate='Poids relativement stable';
    if(profile.bodyGoal==='lean_bulk'){
      const surplus=clamp(maintenance*(youth?.04:.06),100,youth?200:300);
      target=roundTo(maintenance+surplus,25);
      rate=youth?'Progression lente, croissance et performance prioritaires':'Environ 0,1–0,25 % du poids par semaine';
    }else if(profile.bodyGoal==='fat_loss'){
      const deficit=clamp(maintenance*(youth?.06:.12),100,youth?200:500);
      target=roundTo(maintenance-deficit,25);
      rate=youth?'Déficit très prudent; arrêter si énergie, croissance ou performance diminuent':'Environ 0,25–0,5 % du poids par semaine';
    }else if(profile.bodyGoal==='recomp'){
      target=roundTo(maintenance*(profile.weightTrend==='rising_fast'?.97:1),25);
      rate='Poids stable ou changement très lent';
    }
    const proteinFactor=profile.bodyGoal==='fat_loss'?(youth?1.8:2.0):profile.bodyGoal==='recomp'?1.8:profile.bodyGoal==='lean_bulk'?1.6:profile.goal==='general'?1.4:1.6;
    const protein=roundTo(weight*proteinFactor,5);
    const fatFloor=weight*(youth?.9:.8);
    const fatShare=target*(youth?.25:.20)/9;
    let fat=roundTo(Math.max(fatFloor,fatShare),5);
    const carbFloor=weight*2;
    let carbs=roundTo((target-protein*4-fat*9)/4,5);
    if(carbs<carbFloor){
      fat=roundTo(Math.max(fatFloor,(target-protein*4-carbFloor*4)/9),5);
      carbs=roundTo(Math.max(0,(target-protein*4-fat*9)/4),5);
    }
    const calories=Math.round(protein*4+carbs*4+fat*9);
    const warnings=[];
    if(youth&&profile.bodyGoal==='fat_loss') warnings.push('Pour un adolescent, une perte de poids doit rester graduelle et idéalement être supervisée par un professionnel qualifié.');
    return {goal:profile.bodyGoal,maintenanceCalories:maintenance,activityMultiplier:Number(activityMultiplier.toFixed(2)),goals:{calories,protein,carbs,fat},rateText:rate,proteinFactor,warnings,createdAt:new Date().toISOString(),evidenceVersion:'MacroFlow-Nutrition-v30',calibrationWeeks:2,profileSnapshot:{age,weightKg:weight,youth,bodyGoal:profile.bodyGoal}};
  }
  function scoreDay({totals,goals,meals=[]}){
    const closeness=(value,target,toleranceOver=.15)=>{
      if(!target)return 0;
      const ratio=value/target;
      if(ratio<=1)return clamp(ratio,0,1);
      return clamp(1-(ratio-1)/toleranceOver*.35,0,1);
    };
    const calories=closeness(totals.calories,goals.calories,.20);
    const protein=closeness(totals.protein,goals.protein,.35);
    const fatMin=clamp(totals.fat/Math.max(1,goals.fat*.8),0,1);
    const carbs=closeness(totals.carbs,goals.carbs,.50);
    const quality=meals.length?meals.reduce((s,m)=>{
      if(m.source==='smart-local-scan') return s+(m.estimateSource==='verified-now'?1:m.estimateSource==='verified'?.9:.55);
      if(m.source==='manual'||m.source==='quick-add-v20') return s+.85;
      return s+.7;
    },0)/meals.length:0;
    const score=Math.round((calories*.35+protein*.30+fatMin*.15+carbs*.10+quality*.10)*100);
    return {score:clamp(score,0,100),components:{calories,protein,fatMin,carbs,quality}};
  }
  function recommendAdjustment({goal,youth,changePercent,trackedDays,adherence,energy,hunger,recovery,dataQuality=1}){
    const ranges=goal==='lean_bulk'?(youth?{min:0,max:.25}:{min:.1,max:.25}):goal==='fat_loss'?(youth?{min:-.25,max:-.05}:{min:-.5,max:-.25}):{min:-.15,max:.15};
    const step=youth?100:150;
    if(trackedDays<5||adherence!=='high'||dataQuality<.7) return {status:'hold',delta:0,title:'On garde les objectifs',reason:'Les données ne sont pas encore assez fiables pour modifier les calories.'};
    let delta=0,reason='La tendance se trouve dans la zone prévue.';
    if(goal==='lean_bulk'){
      if(changePercent<ranges.min){delta=step;reason='La prise de poids est sous la zone visée.';}
      else if(changePercent>ranges.max){delta=-step;reason='La prise de poids dépasse la zone prudente.';}
    }else if(goal==='fat_loss'){
      if(changePercent>ranges.max){delta=-step;reason='La perte de poids est sous la zone visée.';}
      else if(changePercent<ranges.min){delta=step;reason='La perte est trop rapide; protéger énergie et performance devient prioritaire.';}
    }else{
      if(changePercent>ranges.max){delta=-step;reason='Le poids monte au-delà de la stabilité visée.';}
      else if(changePercent<ranges.min){delta=step;reason='Le poids descend au-delà de la stabilité visée.';}
    }
    const lowReadiness=Number(energy)<=2||Number(recovery)<=2;
    const highHunger=Number(hunger)>=4;
    if(delta<0&&(lowReadiness||highHunger)) return {status:'hold',delta:0,title:'Pas de réduction cette semaine',reason:'Énergie, récupération ou faim rendent une baisse supplémentaire imprudente.'};
    if(!delta)return {status:'on_track',delta:0,title:'Tu es dans la bonne zone',reason};
    return {status:'pending',delta,title:delta>0?`Proposition : +${delta} kcal`:`Proposition : ${delta} kcal`,reason};
  }
  return {estimatePlan,scoreDay,recommendAdjustment};
});
