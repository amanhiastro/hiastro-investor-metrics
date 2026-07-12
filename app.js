const cohortData = [
  ['2026-06-22',54995.05,3858,3314,263,40,5,0,35],
  ['2026-06-23',43396.40,3501,3004,237,39,5,0,34],
  ['2026-06-24',43095.71,3271,2783,252,49,7,0,42],
  ['2026-06-25',58645.31,4610,3983,370,76,6,0,70],
  ['2026-06-26',70669.60,4917,4324,398,65,2,0,63],
  ['2026-06-27',61892.75,4459,3885,385,79,8,0,71],
  ['2026-06-28',68793.99,5259,4525,445,74,2,0,72],
  ['2026-06-29',60950.79,4771,4163,411,74,8,0,66],
  ['2026-06-30',57931.31,4387,3853,416,58,4,0,54],
  ['2026-07-01',70136.66,4586,3963,453,76,4,0,72],
  ['2026-07-02',60978.31,4293,3739,390,76,6,24,46],
  ['2026-07-03',66632.90,4873,4289,490,88,7,35,46],
  ['2026-07-04',66708.09,5599,4953,511,80,2,30,48],
  ['2026-07-05',82984.71,6079,5419,567,106,6,35,65],
].map(([date,cost,installs,logins,trials,paid,p199,p299,p499]) => ({
  date,cost,installs,logins,trials,paid,p199,p299,p499,
  loginTrial: trials/logins,
  trialPaid: paid/trials,
  loginPaid: paid/logins,
  cac: cost/paid,
}));

const $ = selector => document.querySelector(selector);
const number = value => Math.round(value).toLocaleString('en-IN');
const money = value => `₹${Math.round(value).toLocaleString('en-IN')}`;
const money2 = value => `₹${Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const percent = value => `${(value*100).toFixed(value < .05 ? 2 : 1)}%`;
const safeDivide = (a,b) => b > 0 ? a/b : 0;
const clamp = (value,min=0,max=Infinity) => Math.min(max,Math.max(min,Number(value)||0));

function cohortTotals(){
  const total = cohortData.reduce((acc,row) => {
    ['cost','installs','logins','trials','paid','p199','p299','p499'].forEach(key => acc[key] += row[key]);
    return acc;
  },{cost:0,installs:0,logins:0,trials:0,paid:0,p199:0,p299:0,p499:0});
  return {...total,date:'all',loginTrial:total.trials/total.logins,trialPaid:total.paid/total.trials,loginPaid:total.paid/total.logins,cac:total.cost/total.paid};
}

const workbookCurrent = {
  spend:66632.90, impressions:880360, clicks:13377, installs:4873, trials:444, subscribers:88,
  arpu:469, llmCost:277.5, m1Retention:35, m2Retention:30, m3Retention:25, m4Retention:20,
  priorWeekSubscribers:68.804, minutesPerSub:26.2, m1Minutes:0, m1Engaged:35.8,
};

const workbookTarget = {
  spend:66632.90, impressions:1144468, clicks:17390.1, installs:6334.9, trials:823.537, subscribers:148.23666,
  arpu:469, llmCost:194.25, m1Retention:38, m2Retention:30, m3Retention:25, m4Retention:20,
  priorWeekSubscribers:98.82444, minutesPerSub:30, m1Minutes:30, m1Engaged:38,
};

function loadStored(key,fallback){
  try { return {...fallback,...JSON.parse(localStorage.getItem(key) || '{}')}; }
  catch { return {...fallback}; }
}

let plans = {
  current: loadStored('hiastro-plan-current-v3',workbookCurrent),
  target: loadStored('hiastro-plan-target-v3',workbookTarget),
};
let spendMode = localStorage.getItem('hiastro-spend-mode') || 'hold';

function calculated(plan){
  const costPerImpression = safeDivide(plan.spend,plan.impressions);
  const ctr = safeDivide(plan.clicks,plan.impressions)*100;
  const cpc = safeDivide(plan.spend,plan.clicks);
  const clickInstall = safeDivide(plan.installs,plan.clicks)*100;
  const cpi = safeDivide(plan.spend,plan.installs);
  const installTrial = safeDivide(plan.trials,plan.installs)*100;
  const costTrial = safeDivide(plan.spend,plan.trials);
  const trialSub = safeDivide(plan.subscribers,plan.trials)*100;
  const cac = safeDivide(plan.spend,plan.subscribers);
  const totalCost = cac + plan.llmCost;
  const m0Revenue = plan.arpu;
  const m1Revenue = plan.arpu * plan.m1Retention/100;
  const m2Revenue = plan.arpu * plan.m2Retention/100;
  const m3Revenue = plan.arpu * plan.m3Retention/100;
  const m4Revenue = plan.arpu * plan.m4Retention/100;
  const ltv120 = m0Revenue+m1Revenue+m2Revenue+m3Revenue+m4Revenue;
  const weeklyGrowth = (safeDivide(plan.subscribers,plan.priorWeekSubscribers)-1)*100;
  const revenue = [m0Revenue,m1Revenue,m2Revenue,m3Revenue,m4Revenue];
  const payback = cost => {
    let cumulative = 0;
    for(let index=0;index<revenue.length;index++){
      cumulative += revenue[index];
      if(cost <= cumulative + .0001) return index === 0 ? 'Day 0' : `Day ${index*30}`;
    }
    return '>Day 120';
  };
  return {costPerImpression,ctr,cpc,clickInstall,cpi,installTrial,costTrial,trialSub,cac,totalCost,m0Revenue,m1Revenue,m2Revenue,m3Revenue,m4Revenue,ltv120,weeklyGrowth,adPayback:payback(cac),fullPayback:payback(totalCost)};
}

function paymentThreshold(plan,label){
  const calc = calculated(plan);
  const payments = [calc.m0Revenue,calc.m1Revenue,calc.m2Revenue,calc.m3Revenue,calc.m4Revenue];
  const index = {'Day 0':0,'Day 30':1,'Day 60':2,'Day 90':3,'Day 120':4,'>Day 120':5}[label] ?? 5;
  if(index === 5) return calc.ltv120 + 1;
  return payments.slice(0,index+1).reduce((sum,value) => sum+value,0);
}

function setMetric(plan,key,rawValue){
  const value = clamp(rawValue);
  const before = calculated(plan);
  const cascadeSubscribers = () => { plan.subscribers = plan.trials*before.trialSub/100; };
  const cascadeTrials = () => { plan.trials = plan.installs*before.installTrial/100; cascadeSubscribers(); };
  const cascadeInstalls = () => { plan.installs = plan.clicks*before.clickInstall/100; cascadeTrials(); };
  const cascadeClicks = () => { plan.clicks = plan.impressions*before.ctr/100; cascadeInstalls(); };
  const base = ['arpu','llmCost','priorWeekSubscribers','minutesPerSub','m1Minutes'];
  const rates = ['m1Retention','m2Retention','m3Retention','m4Retention','m1Engaged'];
  if(base.includes(key)) plan[key] = value;
  else if(rates.includes(key)) plan[key] = clamp(value,0,100);
  else if(key === 'spend'){
    if(spendMode === 'scale' && plan.spend > 0){
      const ratio = value/plan.spend;
      plan.spend=value;
      plan.impressions*=ratio; plan.clicks*=ratio; plan.installs*=ratio; plan.trials*=ratio; plan.subscribers*=ratio;
    } else plan.spend=value;
  }
  else if(key === 'impressions'){ plan.impressions=value; cascadeClicks(); }
  else if(key === 'clicks'){ plan.clicks=value; cascadeInstalls(); }
  else if(key === 'installs'){ plan.installs=value; cascadeTrials(); }
  else if(key === 'trials'){ plan.trials=value; cascadeSubscribers(); }
  else if(key === 'subscribers') plan.subscribers=value;
  else if(key === 'costPerImpression' && value){ plan.impressions=plan.spend/value; cascadeClicks(); }
  else if(key === 'ctr'){ plan.clicks=plan.impressions*clamp(value,0,100)/100; cascadeInstalls(); }
  else if(key === 'cpc' && value){ plan.clicks=plan.spend/value; cascadeInstalls(); }
  else if(key === 'clickInstall'){ plan.installs=plan.clicks*clamp(value,0,100)/100; cascadeTrials(); }
  else if(key === 'cpi' && value){ plan.installs=plan.spend/value; cascadeTrials(); }
  else if(key === 'installTrial'){ plan.trials=plan.installs*clamp(value,0,100)/100; cascadeSubscribers(); }
  else if(key === 'costTrial' && value){ plan.trials=plan.spend/value; cascadeSubscribers(); }
  else if(key === 'trialSub') plan.subscribers = plan.trials*clamp(value,0,100)/100;
  else if(key === 'cac' && value) plan.subscribers = plan.spend/value;
  else if(key === 'totalCost') plan.llmCost = Math.max(0,value-before.cac);
  else if(key === 'm0Revenue') plan.arpu = value;
  else if(key === 'm1Revenue' && plan.arpu) plan.m1Retention = clamp(value/plan.arpu*100,0,100);
  else if(key === 'm2Revenue' && plan.arpu) plan.m2Retention = clamp(value/plan.arpu*100,0,100);
  else if(key === 'm3Revenue' && plan.arpu) plan.m3Retention = clamp(value/plan.arpu*100,0,100);
  else if(key === 'm4Revenue' && plan.arpu) plan.m4Retention = clamp(value/plan.arpu*100,0,100);
  else if(key === 'ltv120'){
    const retentionMultiplier = 1+(plan.m1Retention+plan.m2Retention+plan.m3Retention+plan.m4Retention)/100;
    plan.arpu = safeDivide(value,retentionMultiplier);
  }
  else if(key === 'weeklyGrowth') plan.subscribers = plan.priorWeekSubscribers*(1+value/100);
  else if(key === 'adPayback'){
    const desiredCac = paymentThreshold(plan,rawValue);
    plan.subscribers = safeDivide(plan.spend,desiredCac);
  }
  else if(key === 'fullPayback'){
    const threshold = paymentThreshold(plan,rawValue);
    if(plan.llmCost >= threshold) plan.llmCost = threshold*.25;
    const desiredCac = Math.max(1,threshold-plan.llmCost);
    plan.subscribers = safeDivide(plan.spend,desiredCac);
  }
}

const metricGroups = [
  {name:'Acquisition volume and efficiency',metrics:[
    {key:'spend',label:'Ad spend',formula:'Direct driver',type:'money',direction:'neutral'},
    {key:'impressions',label:'Impressions',formula:'Direct driver',type:'count',direction:'higher'},
    {key:'costPerImpression',label:'Cost per impression',formula:'Spend / impressions',type:'money3',direction:'lower',derived:'Editing adjusts impressions'},
    {key:'clicks',label:'Clicks',formula:'Direct driver',type:'count',direction:'higher'},
    {key:'cpc',label:'Cost per click',formula:'Spend / clicks',type:'money2',direction:'lower',derived:'Editing adjusts clicks'},
    {key:'installs',label:'Installs',formula:'Direct driver',type:'count',direction:'higher'},
    {key:'cpi',label:'Cost per install',formula:'Spend / installs',type:'money2',direction:'lower',derived:'Editing adjusts installs'},
  ]},
  {name:'Trial and subscription conversion',metrics:[
    {key:'trials',label:'Net trial starts',formula:'Direct driver',type:'count',direction:'higher'},
    {key:'installTrial',label:'Install to trial',formula:'Trials / installs',type:'percent',direction:'higher',derived:'Editing adjusts trials'},
    {key:'costTrial',label:'Cost per trial',formula:'Spend / trials',type:'money2',direction:'lower',derived:'Editing adjusts trials'},
    {key:'subscribers',label:'Paid subscribers',formula:'Direct driver',type:'count',direction:'higher'},
    {key:'trialSub',label:'Trial to subscription',formula:'Subscribers / trials',type:'percent',direction:'higher',derived:'Editing adjusts subscribers'},
    {key:'cac',label:'Subscriber CAC',formula:'Spend / subscribers',type:'money2',direction:'lower',derived:'Editing adjusts subscribers'},
  ]},
  {name:'Revenue, retention and payback',metrics:[
    {key:'arpu',label:'M0 ARPU',formula:'Upfront subscription revenue per acquired subscriber',type:'money2',direction:'higher'},
    {key:'llmCost',label:'Five-month blended LLM cost',formula:'Direct cost per acquired subscriber',type:'money2',direction:'lower'},
    {key:'totalCost',label:'Fully loaded subscriber cost',formula:'CAC + LLM cost',type:'money2',direction:'lower',derived:'Editing adjusts LLM cost'},
    {key:'m0Revenue',label:'M0 revenue / acquired sub',formula:'ARPU x 100%, collected Day 0',type:'money2',direction:'higher',derived:'Editing adjusts ARPU'},
    {key:'m1Retention',label:'M1 retention',formula:'Direct retention assumption',type:'percent',direction:'higher'},
    {key:'m1Revenue',label:'M1 expected revenue / acquired sub',formula:'ARPU x M1 retention',type:'money2',direction:'higher',derived:'Editing adjusts M1 retention'},
    {key:'m2Retention',label:'M2 retention',formula:'Direct retention assumption',type:'percent',direction:'higher'},
    {key:'m2Revenue',label:'M2 expected revenue / acquired sub',formula:'ARPU x M2 retention',type:'money2',direction:'higher',derived:'Editing adjusts M2 retention'},
    {key:'m3Retention',label:'M3 retention',formula:'Direct retention assumption',type:'percent',direction:'higher'},
    {key:'m3Revenue',label:'M3 expected revenue / acquired sub',formula:'ARPU x M3 retention',type:'money2',direction:'higher',derived:'Editing adjusts M3 retention'},
    {key:'m4Retention',label:'M4 retention',formula:'Direct retention assumption',type:'percent',direction:'higher'},
    {key:'m4Revenue',label:'M4 expected revenue / acquired sub',formula:'ARPU x M4 retention',type:'money2',direction:'higher',derived:'Editing adjusts M4 retention'},
    {key:'ltv120',label:'120-day retained revenue / acquired sub',formula:'M0 + M1 + M2 + M3 + M4 revenue',type:'money2',direction:'higher',derived:'Editing adjusts ARPU'},
    {key:'adPayback',label:'Ad-only cash payback',formula:'CAC recovered at payment checkpoints',type:'payback',direction:'lower',derived:'Editing adjusts subscribers'},
    {key:'fullPayback',label:'Fully loaded cash payback',formula:'CAC + LLM recovered at payment checkpoints',type:'payback',direction:'lower',derived:'Editing adjusts subscribers and, if needed, LLM cost'},
  ]},
  {name:'Growth and engagement targets',metrics:[
    {key:'priorWeekSubscribers',label:'Prior-week subscribers',formula:'Baseline for weekly growth',type:'count',direction:'neutral'},
    {key:'weeklyGrowth',label:'Weekly subscriber growth',formula:'Subscribers / prior-week subscribers - 1',type:'percent',direction:'higher',derived:'Editing adjusts paid subscribers'},
    {key:'minutesPerSub',label:'Minutes per subscriber / week',formula:'Direct engagement input',type:'number2',direction:'higher'},
    {key:'m1Minutes',label:'M1 retained minutes / week',formula:'Direct engagement input',type:'number2',direction:'higher'},
    {key:'m1Engaged',label:'M1 engaged subscribers',formula:'Direct retained-and-engaged rate',type:'percent',direction:'higher'},
  ]},
];

const allMetrics = metricGroups.flatMap(group => group.metrics);
const paybackOptions = ['Day 0','Day 30','Day 60','Day 90','Day 120','>Day 120'];
const paybackRank = value => ({'Day 0':0,'Day 30':30,'Day 60':60,'Day 90':90,'Day 120':120,'>Day 120':150}[value] ?? 150);

function metricValue(plan,key){
  if(Object.prototype.hasOwnProperty.call(plan,key)) return plan[key];
  return calculated(plan)[key];
}

function inputValue(value,type){
  if(type === 'payback') return value;
  if(type === 'count') return Number(value.toFixed(2));
  if(type === 'money3') return Number(value.toFixed(4));
  return Number(value.toFixed(2));
}

function displayValue(value,type){
  if(type === 'money' || type === 'money2') return money2(value);
  if(type === 'money3') return `₹${value.toFixed(4)}`;
  if(type === 'percent') return `${value.toFixed(2)}%`;
  if(type === 'count') return Number(value.toFixed(1)).toLocaleString('en-IN');
  if(type === 'number2') return value.toFixed(2);
  return value;
}

function metricInput(metric,side){
  const value = metricValue(plans[side],metric.key);
  if(metric.type === 'payback'){
    return `<div class="editable-wrap derived"><select data-plan-side="${side}" data-plan-key="${metric.key}">${paybackOptions.map(option => `<option ${option===value?'selected':''}>${option}</option>`).join('')}</select><div class="cell-note">${metric.derived}</div></div>`;
  }
  return `<div class="editable-wrap ${metric.derived?'derived':''}"><input type="number" step="any" value="${inputValue(value,metric.type)}" data-plan-side="${side}" data-plan-key="${metric.key}"><div class="cell-note">${metric.derived || 'Direct editable driver'}</div></div>`;
}

function comparison(metric){
  const current = metricValue(plans.current,metric.key);
  const target = metricValue(plans.target,metric.key);
  if(metric.direction === 'neutral') return {status:'neutral',label:'Planning input',gap:'Editable on both sides'};
  const currentComparable = metric.type === 'payback' ? paybackRank(current) : current;
  const targetComparable = metric.type === 'payback' ? paybackRank(target) : target;
  const met = metric.direction === 'lower' ? currentComparable <= targetComparable : currentComparable >= targetComparable;
  let gap;
  if(metric.type === 'percent') gap = `${(current-target)>=0?'+':''}${(current-target).toFixed(2)} pp`;
  else if(metric.type.startsWith('money')) gap = `${current-target>=0?'+':''}${money2(current-target)}`;
  else if(metric.type === 'payback') gap = `${current} vs ${target}`;
  else gap = `${current-target>=0?'+':''}${Number((current-target).toFixed(1)).toLocaleString('en-IN')}`;
  return {status:met?'good':'bad',label:met?'Target met':'Needs improvement',gap};
}

function renderPlanner(){
  $('#plannerGrid').innerHTML = metricGroups.map(group => {
    const rows = group.metrics.map(metric => {
      const comp = comparison(metric);
      return `<div class="model-row">
        <div class="model-cell"><div class="metric-name">${metric.label}</div><div class="metric-formula">${metric.formula}</div></div>
        <div class="model-cell">${metricInput(metric,'current')}</div>
        <div class="model-cell">${metricInput(metric,'target')}</div>
        <div class="model-cell gap-cell"><span class="status ${comp.status}">${comp.label}</span><div class="gap-value">${comp.gap}</div><div class="gap-caption">Current compared with team target</div></div>
      </div>`;
    }).join('');
    return `<div class="section-row">${group.name.toUpperCase()}</div>${rows}`;
  }).join('');

  document.querySelectorAll('[data-plan-key]').forEach(control => {
    control.addEventListener('input',event => {
      const side = event.target.dataset.planSide;
      const key = event.target.dataset.planKey;
      setMetric(plans[side],key,event.target.value);
      savePlans();
      syncPlannerControls(event.target);
      renderPlannerOutcomes();
      renderObservedScorecard();
    });
    control.addEventListener('change',() => renderPlanner());
  });

  renderPlannerOutcomes();
  syncPlannerControls();

  $('#formulaAudit').innerHTML = [
    ['Acquisition chain','Impressions cascade to clicks, installs, trials, and subscribers at the saved rates. CPC and CPI edits also cascade downstream.'],
    ['Spend behavior','Hold volumes makes spend change unit costs and CAC. Scale funnel grows all volumes at unchanged unit economics.'],
    ['Conversion chain','Installs feed trials; trials feed subscribers. Editing a rate or unit cost adjusts its volume driver and everything downstream.'],
    ['Revenue chain','ARPU is M0 revenue. M1-M4 revenue equals ARPU multiplied by each editable retention assumption.'],
    ['Payback chain','CAC and blended LLM cost are recovered only when M0-M4 subscription cash is collected on Days 0, 30, 60, 90, and 120.'],
  ].map(([title,body]) => `<div class="audit-card"><strong>${title}</strong><span>${body}</span></div>`).join('');
}

function syncPlannerControls(activeControl){
  document.querySelectorAll('[data-plan-key]').forEach(control => {
    if(control === activeControl) return;
    const side = control.dataset.planSide;
    const key = control.dataset.planKey;
    const metric = allMetrics.find(item => item.key === key);
    const value = metricValue(plans[side],key);
    control.value = inputValue(value,metric.type);
  });
}

function renderPlannerOutcomes(){
  const current = calculated(plans.current);
  const target = calculated(plans.target);
  const pairs = [
    ['Paid subscribers',number(plans.current.subscribers),number(plans.target.subscribers),'Projected volume','Projected volume'],
    ['Subscriber CAC',money(current.cac),money(target.cac),'Ad spend / subscribers','Team acquisition target'],
    ['Fully loaded cost',money(current.totalCost),money(target.totalCost),'CAC + blended LLM cost','CAC + blended LLM cost'],
    ['CAC + LLM payback',current.fullPayback,target.fullPayback,'Fully loaded cash recovery','Fully loaded cash recovery'],
    ['CAC (ad-only) payback',current.adPayback,target.adPayback,'Ad spend only','Ad spend only'],
  ];
  $('#plannerOutcomes').innerHTML = pairs.map(([title,currentValue,targetValue,currentNote,targetNote]) => `<div class="outcome-pair"><div class="outcome-pair-title">${title}</div><div class="outcome-pair-grid"><div class="outcome-card"><span>CURRENT</span><strong>${currentValue}</strong><small>${currentNote}</small></div><div class="outcome-card target"><span>TARGET</span><strong>${targetValue}</strong><small>${targetNote}</small></div></div></div>`).join('');
}

function savePlans(){
  localStorage.setItem('hiastro-plan-current-v3',JSON.stringify(plans.current));
  localStorage.setItem('hiastro-plan-target-v3',JSON.stringify(plans.target));
}

function observedPlan(cohort){
  const calc = calculated(plans.current);
  return {...plans.current,spend:cohort.cost,installs:cohort.installs,trials:cohort.trials,subscribers:cohort.paid,clicks:safeDivide(cohort.cost,calc.cpc),impressions:safeDivide(cohort.cost,calc.costPerImpression)};
}

function loadSelectedCohort(){
  const selected = $('#dateSelect').value;
  const cohort = selected === 'all' ? cohortTotals() : cohortData.find(row => row.date === selected);
  plans.current = observedPlan(cohort);
  savePlans();
  renderPlanner();
  renderObservedScorecard();
}

function resetPlanner(){
  plans = {current:{...workbookCurrent},target:{...workbookTarget}};
  savePlans();
  renderPlanner();
  renderObservedScorecard();
}

function metricCard(value,label,highlight=false){
  return `<div class="metric ${highlight?'highlight':''}"><strong>${value}</strong><span>${label}</span></div>`;
}

function renderOverview(selected='2026-07-05'){
  const cohort = selected === 'all' ? cohortTotals() : cohortData.find(row => row.date === selected);
  $('#periodText').textContent = selected === 'all'
    ? '14 fully matured daily cohorts · 22 Jun-5 Jul 2026 · paid outcomes observed for 7 days'
    : `${new Date(cohort.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} cohort · paid outcomes observed for 7 days`;
  $('#metrics').innerHTML = [
    metricCard(money(cohort.cost),'Acquisition spend'),
    metricCard(number(cohort.installs),'Installs'),
    metricCard(number(cohort.logins),'Subscription-mode logins'),
    metricCard(number(cohort.trials),'Trial starts'),
    metricCard(number(cohort.paid),'Paid subscribers'),
    metricCard(percent(cohort.trials/cohort.installs),'Install to trial'),
    metricCard(percent(cohort.trialPaid),'Trial to paid'),
    metricCard(money(cohort.cac),'Subscriber CAC',true),
  ].join('');

  const target = calculated(plans.target);
  const observed = calculated(observedPlan(cohort));
  const installTrial = cohort.trials/cohort.installs*100;
  const trialGap = installTrial - calculated(plans.target).installTrial;
  const cacGap = cohort.cac-target.cac;
  $('#summaryTitle').textContent = selected === 'all' ? '14-day operating view' : `${new Date(cohort.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long'})} cohort`;
  $('#summaryPoints').innerHTML = [
    [`${number(cohort.paid)} paid · ${money(cohort.cac)} CAC`,cacGap<=0?'CAC is at or below the saved target.':`CAC is ${money(cacGap)} above the ${money(target.cac)} target.`],
    [`${installTrial.toFixed(1)}% install to trial`,trialGap>=0?'Saved target met.':`${Math.abs(trialGap).toFixed(1)} percentage points below the ${target.installTrial.toFixed(1)}% target. Trial to paid is ${(cohort.trialPaid*100).toFixed(1)}%.`],
    [`${observed.fullPayback} fully loaded payback`,`Includes ${money(plans.current.llmCost)} blended LLM cost and the saved M1-M4 retention curve.`],
  ].map(([title,body]) => `<div class="summary-point"><strong>${title}</strong><span>${body}</span></div>`).join('');

  const july3 = selected === '2026-07-03';
  $('#chatCount').textContent = july3 ? '3,611' : '-';
  $('#chatRate').textContent = july3 ? '84.2% of subscription-mode logins' : 'Not verified for this cohort';
  $('#paywallCount').textContent = july3 ? '3,110' : '-';
  $('#paywallRate').textContent = july3 ? '72.5% of subscription-mode logins' : 'Not verified for this cohort';
  $('#activationNote').textContent = july3 ? 'Verified July 3 Mixpanel funnel values.' : 'Select 3 July to view the verified checkpoint. Mixpanel tracking is incomplete on part of this period.';
  document.querySelectorAll('#dataRows tr').forEach(row => row.classList.toggle('selected',row.dataset.date===selected));
  renderObservedScorecard(cohort);
}

const scorecardMetrics = [
  {key:'cpi',label:'Cost per install',type:'money2',direction:'lower'},
  {key:'installTrial',label:'Install to trial',type:'percent',direction:'higher'},
  {key:'costTrial',label:'Cost per trial',type:'money2',direction:'lower'},
  {key:'trialSub',label:'Trial to subscription',type:'percent',direction:'higher'},
  {key:'cac',label:'Subscriber CAC',type:'money2',direction:'lower'},
  {key:'adPayback',label:'Ad-only payback',type:'payback',direction:'lower'},
  {key:'fullPayback',label:'Fully loaded payback',type:'payback',direction:'lower'},
  {key:'m1Retention',label:'M1 retention',type:'percent',direction:'higher'},
];

function renderObservedScorecard(cohort){
  const selected = $('#dateSelect')?.value || '2026-07-05';
  const source = cohort || (selected==='all'?cohortTotals():cohortData.find(row=>row.date===selected));
  const currentPlan = observedPlan(source);
  const currentCalc = calculated(currentPlan);
  const targetCalc = calculated(plans.target);
  $('#compactScorecard').innerHTML = scorecardMetrics.map(metric => {
    const current = Object.prototype.hasOwnProperty.call(currentPlan,metric.key) ? currentPlan[metric.key] : currentCalc[metric.key];
    const target = Object.prototype.hasOwnProperty.call(plans.target,metric.key) ? plans.target[metric.key] : targetCalc[metric.key];
    const left = metric.type==='payback'?paybackRank(current):current;
    const right = metric.type==='payback'?paybackRank(target):target;
    const met = metric.direction==='lower'?left<=right:left>=right;
    return `<div class="compact-card"><div class="top"><h3>${metric.label}</h3><span class="status ${met?'good':'bad'}">${met?'Target met':'Needs improvement'}</span></div><div class="values"><div><span>Observed</span><strong>${displayValue(current,metric.type)}</strong></div><div><span>Target</span><strong>${displayValue(target,metric.type)}</strong></div></div></div>`;
  }).join('');
}

function lineChart(){
  const w=650,h=270,p={l:48,r:15,t:12,b:38},iw=w-p.l-p.r,ih=h-p.t-p.b,max=.25;
  const x=i=>p.l+i*iw/(cohortData.length-1), y=value=>p.t+ih-value/max*ih;
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily conversion chart">`;
  for(let i=0;i<=5;i++){
    const value=i*.05,yy=y(value);
    svg+=`<line x1="${p.l}" y1="${yy}" x2="${w-p.r}" y2="${yy}" stroke="#e5e8ec"/><text x="${p.l-9}" y="${yy+4}" text-anchor="end" font-size="10" fill="#6b7178">${Math.round(value*100)}%</text>`;
  }
  [['trialPaid','#111'],['loginTrial','#2878e8'],['loginPaid','#65c5e8']].forEach(([key,color]) => {
    svg+=`<polyline fill="none" stroke="${color}" stroke-width="3" points="${cohortData.map((row,index)=>`${x(index)},${y(row[key])}`).join(' ')}"/>`;
    svg+=cohortData.map((row,index)=>`<circle cx="${x(index)}" cy="${y(row[key])}" r="3" fill="${color}"/>`).join('');
  });
  cohortData.forEach((row,index) => svg+=`<text x="${x(index)}" y="${h-12}" text-anchor="middle" font-size="9" fill="#666">${index===0?'22 Jun':row.date.slice(8)}</text>`);
  return svg+'</svg>';
}

function barChart(){
  const w=650,h=270,p={l:50,r:15,t:12,b:38},iw=w-p.l-p.r,ih=h-p.t-p.b,max=1500,bw=iw/cohortData.length*.64;
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily subscriber CAC chart">`;
  [0,500,1000,1500].forEach(value => {
    const yy=p.t+ih-value/max*ih;
    svg+=`<line x1="${p.l}" y1="${yy}" x2="${w-p.r}" y2="${yy}" stroke="#e5e8ec"/><text x="${p.l-9}" y="${yy+4}" text-anchor="end" font-size="10" fill="#6b7178">${value===0?'0':value/1000+'k'}</text>`;
  });
  cohortData.forEach((row,index) => {
    const x=p.l+(index+.5)*iw/cohortData.length-bw/2,y=p.t+ih-row.cac/max*ih;
    svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${p.t+ih-y}" fill="#2878e8"/><text x="${x+bw/2}" y="${h-12}" text-anchor="middle" font-size="9" fill="#666">${index===0?'22 Jun':row.date.slice(8)}</text>`;
  });
  return svg+'</svg>';
}

function switchView(view){
  document.querySelectorAll('[data-view-button]').forEach(button => button.classList.toggle('active',button.dataset.viewButton===view));
  document.querySelectorAll('[data-view]').forEach(section => section.classList.toggle('active',section.dataset.view===view));
  localStorage.setItem('hiastro-active-view',view);
}

function unlock(){
  sessionStorage.setItem('hiastro-access','yes');
  $('#lock').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

function initialize(){
  const select=$('#dateSelect');
  select.innerHTML='<option value="all">14-day overview</option>'+cohortData.map(row=>`<option value="${row.date}">${new Date(row.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</option>`).join('');
  select.value='2026-07-05';
  select.addEventListener('change',()=>renderOverview(select.value));
  $('#conversionChart').innerHTML=lineChart();
  $('#cacChart').innerHTML=barChart();
  $('#dataRows').innerHTML=cohortData.map(row=>`<tr data-date="${row.date}"><td>${new Date(row.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td><td>${money(row.cost)}</td><td>${number(row.installs)}</td><td>${number(row.logins)}</td><td>${number(row.trials)}</td><td><b>${number(row.paid)}</b></td><td>${row.p199}</td><td>${row.p299}</td><td>${row.p499}</td><td>${percent(row.loginTrial)}</td><td>${percent(row.trialPaid)}</td><td>${money(row.cac)}</td></tr>`).join('');
  document.querySelectorAll('#dataRows tr').forEach(row => row.addEventListener('click',()=>{select.value=row.dataset.date;renderOverview(row.dataset.date);switchView('overview');window.scrollTo({top:0,behavior:'smooth'});}));
  document.querySelectorAll('[data-view-button]').forEach(button => button.addEventListener('click',()=>switchView(button.dataset.viewButton)));
  $('#loadCohort').addEventListener('click',loadSelectedCohort);
  $('#resetPlanner').addEventListener('click',resetPlanner);
  $('#spendMode').value=spendMode;
  $('#spendMode').addEventListener('change',event=>{spendMode=event.target.value;localStorage.setItem('hiastro-spend-mode',spendMode);});
  $('#logout').addEventListener('click',()=>{sessionStorage.removeItem('hiastro-access');location.reload();});
  $('#loginForm').addEventListener('submit',event=>{event.preventDefault();if($('#password').value==='3011196420')unlock();else{$('#error').textContent='Incorrect access code';$('#password').select();}});
  if(sessionStorage.getItem('hiastro-access')==='yes') unlock();
  renderOverview(select.value);
  renderPlanner();
  switchView(localStorage.getItem('hiastro-active-view') || 'overview');
}

initialize();
