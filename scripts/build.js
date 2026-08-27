const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://salarydecoded.com';

const ukSalaries = [20000,25000,30000,35000,40000,45000,50000,60000,70000,75000,80000,90000,100000,125000,150000];
const usSalaries = [30000,40000,50000,60000,75000,100000,125000,150000,200000,250000];
const statePages = [
  ['california', 'California', 100000],
  ['california', 'California', 150000],
  ['new-york', 'New York', 100000],
  ['new-york', 'New York', 150000],
  ['texas', 'Texas', 100000],
  ['texas', 'Texas', 150000],
  ['florida', 'Florida', 100000],
  ['florida', 'Florida', 150000],
];
const states = [
  ['california','California','Progressive state income tax makes the state example materially different from the national estimate.'],
  ['new-york','New York','State income tax changes the paycheck result before any city-level or local assumptions are considered.'],
  ['texas','Texas','No broad individual state income tax means federal tax and FICA do most of the payroll work in this model.'],
  ['florida','Florida','No broad individual state income tax keeps the state estimate close to the national no-state-tax scenario.'],
];
const tools = [
  ['tools/salary-to-hourly','Salary to Hourly Calculator','Convert annual pay into hourly, weekly and monthly equivalents.','salaryToHourly'],
  ['tools/hourly-to-salary','Hourly to Salary Calculator','Convert hourly pay into annual, monthly and weekly equivalents.','hourlyToSalary'],
  ['tools/pay-rise-calculator','Pay Rise Calculator','Estimate how much extra take-home pay a raise may actually create.','payRise'],
  ['tools/salary-comparison','Salary Comparison Calculator','Compare two salary offers by gross, estimated net and monthly difference.','compare'],
  ['tools/bonus-calculator','Bonus Calculator','Estimate the take-home impact of a one-off bonus.','bonus'],
];
const trust = [
  ['about','About SalaryDecoded','What SalaryDecoded is for, who it helps and how to interpret its estimates.'],
  ['methodology','Methodology','How SalaryDecoded calculates take-home pay and salary equivalents.'],
  ['tax-assumptions','Tax Assumptions','The tax years, thresholds and simplifications used in the calculators.'],
  ['editorial-standards','Editorial Standards','How SalaryDecoded keeps calculation-led content useful and clear.'],
  ['privacy','Privacy Policy','What the site stores, what calculators do locally and how user privacy is handled.'],
  ['disclaimer','Disclaimer','Limits of the estimates and why the site is educational, not advice.'],
  ['accessibility','Accessibility','Accessibility principles used across SalaryDecoded.'],
];

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function write(file, text) { ensureDir(path.join(ROOT, file)); fs.writeFileSync(path.join(ROOT, file), text); }
function clean() {
  for (const name of fs.readdirSync(ROOT)) {
    if (['scripts','docs','.git','.gitignore','.gitattributes','CNAME'].includes(name)) continue;
    fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
  }
}
function url(route) { return `${SITE}/${route ? route.replace(/\/?$/, '/') : ''}`; }
function fileFor(route) { return route ? `${route}/index.html` : 'index.html'; }
function money(n, currency) {
  const sym = currency === 'GBP' ? '&pound;' : '$';
  return sym + Math.round(n).toLocaleString('en-US');
}
function pct(n) { return `${(n * 100).toFixed(1)}%`; }
function taxBand(amount, bands) {
  let tax = 0;
  for (const [from, to, rate] of bands) {
    if (amount > from) tax += (Math.min(amount, to ?? amount) - from) * rate;
  }
  return Math.max(0, tax);
}
function ukCalc(salary, pensionPct = 0, studentPlan = 'none') {
  const pension = salary * pensionPct / 100;
  const taxableIncome = Math.max(0, salary - pension);
  const allowance = taxableIncome <= 100000 ? 12570 : Math.max(0, 12570 - (taxableIncome - 100000) / 2);
  const taxable = Math.max(0, taxableIncome - allowance);
  const incomeTax = taxBand(taxable, [[0,37700,0.20],[37700,125140 - 12570,0.40],[125140 - 12570,null,0.45]]);
  const ni = Math.max(0, Math.min(salary,50270)-12570)*0.08 + Math.max(0, salary-50270)*0.02;
  const studentThresholds = { plan1: 26065, plan2: 28470, plan4: 32745, plan5: 25000, postgraduate: 21000 };
  const student = studentPlan === 'none' ? 0 : Math.max(0, salary - studentThresholds[studentPlan]) * (studentPlan === 'postgraduate' ? 0.06 : 0.09);
  const net = salary - incomeTax - ni - pension - student;
  return { gross: salary, pension, allowance, taxable, incomeTax, ni, student, net, monthly: net/12, weekly: net/52, hourly: salary/(37.5*52), effective: (salary-net)/salary };
}
const federalSingle2025 = [[0,11925,0.10],[11925,48475,0.12],[48475,103350,0.22],[103350,197300,0.24],[197300,250525,0.32],[250525,626350,0.35],[626350,null,0.37]];
const stateModels = {
  california: { deduction: 5706, bands: [[0,11079,0.01],[11079,26264,0.02],[26264,41452,0.04],[41452,57542,0.06],[57542,72724,0.08],[72724,371479,0.093],[371479,445771,0.103],[445771,742953,0.113],[742953,null,0.123]] },
  'new-york': { deduction: 8000, bands: [[0,8500,0.04],[8500,11700,0.045],[11700,13900,0.0525],[13900,80650,0.055],[80650,215400,0.06],[215400,1077550,0.0685],[1077550,null,0.0965]] },
  texas: { deduction: 0, bands: [] },
  florida: { deduction: 0, bands: [] },
};
function usCalc(salary, state = null) {
  const taxableFederal = Math.max(0, salary - 15000);
  const federal = taxBand(taxableFederal, federalSingle2025);
  const socialSecurity = Math.min(salary,176100) * 0.062;
  const medicare = salary * 0.0145 + Math.max(0, salary - 200000) * 0.009;
  const model = state ? stateModels[state] : null;
  const stateTax = model ? taxBand(Math.max(0, salary - model.deduction), model.bands) : 0;
  const net = salary - federal - socialSecurity - medicare - stateTax;
  return { gross: salary, federal, socialSecurity, medicare, stateTax, net, monthly: net/12, weekly: net/52, hourly: salary/(40*52), effective: (salary-net)/salary };
}
function a(route, label) { return `<a href="/${route ? route.replace(/\/?$/, '/') : ''}">${label}</a>`; }
function crumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map(([r,l],i)=> i === items.length-1 ? `<span>${l}</span>` : a(r,l)).join('<span>/</span>')}</nav>`;
}
function table(rows) {
  const headers = rows[0] || [];
  return `<div class="table-wrap"><table>${rows.map((r,i)=>`<tr>${r.map((c,j)=> i===0 ? `<th>${c}</th>` : `<td data-label="${headers[j] || ''}">${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
function metric(label, value, note = '') {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
}
function resultPanel(items, trust) {
  return `<section class="result-panel" aria-label="Calculation summary">
    <div class="result-panel__intro"><p class="eyebrow">Calculation summary</p><p>${trust}</p></div>
    <div class="metric-grid">${items.map(([label,value,note]) => metric(label,value,note)).join('')}</div>
  </section>`;
}
function deductionBar(parts) {
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  return `<div class="deduction-bar" aria-label="Gross pay composition">${parts.filter(p => p.value > 0).map(p => `<span class="${p.class}" style="--w:${Math.max(4, (p.value / total) * 100).toFixed(2)}%">${p.label}</span>`).join('')}</div>`;
}
function faq(items, route) {
  const html = `<section class="section faq"><h2>FAQ</h2>${items.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
  const schema = { '@context':'https://schema.org', '@type':'FAQPage', mainEntity: items.map(([name, text]) => ({ '@type':'Question', name, acceptedAnswer:{ '@type':'Answer', text: text.replace(/<[^>]*>/g,'') } })) };
  return html + `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
function layout(page) {
  const canonical = url(page.route);
  const org = { '@context':'https://schema.org', '@graph': [
    { '@type':'Organization', '@id':`${SITE}/#organization`, name:'SalaryDecoded', url:SITE+'/', description:'SalaryDecoded is an independent salary and take-home-pay calculation product.' },
    { '@type':'WebSite', '@id':`${SITE}/#website`, url:SITE+'/', name:'SalaryDecoded', publisher:{ '@id':`${SITE}/#organization` } },
    { '@type':'WebPage', '@id':canonical + '#webpage', url:canonical, name:page.title, isPartOf:{ '@id':`${SITE}/#website` } }
  ]};
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.title}</title>
  <meta name="description" content="${page.description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SalaryDecoded">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.description}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${page.title}">
  <meta name="twitter:description" content="${page.description}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/style.css">
  <script type="application/ld+json">${JSON.stringify(org)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">SD</span><span>SalaryDecoded</span></a>
    <nav aria-label="Primary">
      ${a('uk','UK')} ${a('us','US')} ${a('tools/salary-to-hourly','Tools')} ${a('methodology','Methodology')}
    </nav>
  </header>
  <main>${page.body}</main>
  <footer class="site-footer">
    <p>SalaryDecoded provides educational salary estimates, not payroll, tax, legal or financial advice.</p>
    <nav>${a('about','About')} ${a('tax-assumptions','Tax assumptions')} ${a('editorial-standards','Editorial standards')} ${a('privacy','Privacy')} ${a('disclaimer','Disclaimer')} ${a('accessibility','Accessibility')}</nav>
  </footer>
  <script src="/assets/calculators.js"></script>
</body>
</html>`;
}
function hero(h1, lead, cta = '') { return `<section class="hero"><div class="hero-copy"><p class="eyebrow">Understand what your salary is really worth</p><h1>${h1}</h1><p class="lead">${lead}</p>${cta}</div></section>`; }
function cards(items) { return `<div class="card-grid">${items.map(([r,t,d])=>`<article class="card"><h3>${a(r,t)}</h3><p>${d}</p></article>`).join('')}</div>`; }
function calcBox(kind) {
  const title = { salaryToHourly:'Convert salary into usable pay figures', hourlyToSalary:'Convert hourly pay into salary', payRise:'Estimate the value of a raise', compare:'Compare two salary outcomes', bonus:'Estimate a bonus impact' }[kind] || 'Try the calculator';
  const copy = {
    salaryToHourly: 'Turn an annual salary into hourly, monthly and weekly equivalents for quick pay planning.',
    hourlyToSalary: 'Convert an hourly rate into annual salary equivalents before comparing offers or schedules.',
    payRise: 'Estimate how a higher salary changes take-home pay rather than only looking at gross income.',
    compare: 'Compare two salaries side by side using estimated net pay and monthly difference.',
    bonus: 'Model a one-off bonus separately from recurring salary so the result is easier to interpret.'
  }[kind] || 'Use this calculator as a practical estimate before reading the worked examples below.';
  const amountLabel = kind === 'hourlyToSalary' ? 'Hourly rate' : kind === 'bonus' ? 'Base salary' : 'Salary / starting amount';
  const compareLabel = kind === 'bonus' ? 'Bonus amount' : kind === 'compare' ? 'Second salary' : 'Comparison amount';
  return `<section class="calculator app-surface calculator--${kind}" data-calculator="${kind}">
    <div class="tool-heading"><p class="eyebrow">Interactive estimate</p><h2>${title}</h2><p>${copy}</p></div>
    <div class="form-grid">
      <label>${amountLabel} <input data-input="amount" type="number" value="${kind === 'hourlyToSalary' ? 25 : 60000}" min="0" step="100"></label>
      <label>${compareLabel} <input data-input="compare" type="number" value="75000" min="0" step="100"></label>
      <label>Region <select data-input="region"><option value="uk">UK</option><option value="us">US</option></select></label>
      <label>Pension / retirement % <input data-input="pension" type="number" value="5" min="0" max="30" step="1"></label>
    </div>
    <button type="button" data-action="calculate">Calculate</button>
    <div class="result" data-output>Enter values and calculate. The static examples below explain the method even without JavaScript.</div>
  </section>`;
}
function home() {
  const popular = [...ukSalaries.slice(2,9).map(s=>[`uk/${s}-salary`, `${money(s,'GBP')} UK salary`]), ...usSalaries.slice(2,8).map(s=>[`us/${s}-salary`, `${money(s,'USD')} US salary`])];
  return layout({ route:'', title:'SalaryDecoded | Salary and Take-Home Pay Calculators', description:'Understand salary, take-home pay, hourly equivalents, pay rises and tax deductions with clear UK and US salary calculators.', body:
    `<section class="home-hero"><div class="hero-copy"><p class="eyebrow">SalaryDecoded</p><h1>Understand what your salary is really worth.</h1><p class="lead">Estimate take-home pay, monthly income, weekly pay and hourly equivalents with clear UK and US salary calculations.</p><p class="actions">${a('uk/salary-calculator','Start with UK salary')} ${a('us/salary-calculator','Start with US salary')}</p></div>${calcBox('salaryToHourly')}</section>` +
    `<section class="section"><h2>Start with the answer, then inspect the calculation</h2><p>SalaryDecoded is built around the calculation first. Each guide shows gross pay, estimated deductions, take-home pay and the assumptions used, then routes you to the next useful comparison.</p>${cards([['uk','UK salary tools','Income Tax, National Insurance, pension examples and selected salary guides.'],['us','US salary tools','Federal tax, FICA, selected state examples and national salary guides.'],['tools/salary-comparison','Decision tools','Compare salaries, pay rises, bonuses and hourly equivalents.']])}</section>` +
    `<section class="section"><h2>Popular salary examples</h2><div class="link-cloud">${popular.map(([r,l])=>a(r,l)).join('')}</div></section>` +
    `<section class="section"><h2>Calculation tools</h2>${cards(tools.map(([r,t,d])=>[r,t,d]))}</section>` +
    `<section class="section"><h2>Trust and assumptions</h2><p>Every result is an estimate, not a payslip replacement. Read the ${a('methodology','methodology')} and ${a('tax-assumptions','tax assumptions')} before using results for decisions.</p></section>` +
    faq([
      ['What does SalaryDecoded calculate?','It estimates gross salary, tax deductions, take-home pay, monthly pay, weekly pay and hourly equivalents for selected UK and US examples.'],
      ['Is the calculator exact?','No. It is an educational estimate based on documented assumptions and simplified scenarios. Actual payroll can differ.'],
      ['Why are there only selected salary pages?','V1 publishes only useful cohorts with clear independent intent, instead of generating every salary permutation.']
    ], '')
  });
}
function hub(route, title, desc, h1, lead, sections) {
  return layout({ route, title, description: desc, body: crumbs([['','Home'],[route,h1]]) + hero(h1, lead) + sections + commonNext() });
}
function commonNext() {
  return `<section class="section next"><h2>Useful next routes</h2>${cards([['methodology','Methodology','See how estimates are calculated.'],['tax-assumptions','Tax assumptions','Check rates, thresholds and simplifications.'],['tools/salary-comparison','Compare salaries','Compare two salary amounts side by side.']])}</section>`;
}
function ukSalaryPage(salary) {
  const c = ukCalc(salary, 0);
  const p5 = ukCalc(salary, 5);
  const below = ukSalaries.filter(x=>x<salary).slice(-1)[0];
  const above = ukSalaries.find(x=>x>salary);
  const nearby = [below, salary, above].filter(Boolean).map(s => {
    const x = ukCalc(s);
    return [money(s,'GBP'), money(x.net,'GBP'), s===salary ? 'Current page' : `${money(Math.abs(x.net-c.net),'GBP')} ${x.net>c.net?'more':'less'}`];
  });
  const marginal = ukCalc(salary + 5000);
  const threshold = salary >= 100000 ? 'This salary enters the personal allowance taper zone, so the effective deduction rate can feel sharper than the headline tax band suggests.' : salary >= 50270 ? 'This salary sits above the higher-rate threshold, so additional gross pay faces higher Income Tax while NI falls to the upper earnings rate.' : 'This salary is mainly shaped by the personal allowance, basic-rate Income Tax and Class 1 National Insurance.';
  return layout({ route:`uk/${salary}-salary`, title:`${money(salary,'GBP')} Salary After Tax UK | SalaryDecoded`, description:`Estimate ${money(salary,'GBP')} after tax in the UK, including Income Tax, National Insurance, monthly pay, weekly pay and pension scenarios.`, body:
    crumbs([['','Home'],['uk','UK'],['uk/salary-guides','Salary Guides'],[`uk/${salary}-salary`,`${money(salary,'GBP')} salary`]]) +
    hero(`${money(salary,'GBP')} Salary After Tax UK`, `A ${money(salary,'GBP')} gross salary is estimated at about ${money(c.net,'GBP')} take-home pay before optional pension or student-loan deductions.`) +
    resultPanel([
      ['Gross salary', money(c.gross,'GBP'), 'annual'],
      ['Take-home pay', money(c.net,'GBP'), 'estimated annual net'],
      ['Monthly', money(c.monthly,'GBP'), 'after tax and NI'],
      ['Weekly', money(c.weekly,'GBP'), 'planning estimate'],
      ['Income Tax', money(c.incomeTax,'GBP'), 'annual estimate'],
      ['National Insurance', money(c.ni,'GBP'), 'employee NI'],
      ['Effective rate', pct(c.effective), 'deductions / gross']
    ], 'UK V1 estimate using England, Wales and Northern Ireland Income Tax and employee National Insurance assumptions.') +
    deductionBar([{ label:'Take-home', value:c.net, class:'net' }, { label:'Income Tax', value:c.incomeTax, class:'tax' }, { label:'NI', value:c.ni, class:'ni' }]) +
    `<section class="answer"><h2>Direct answer</h2><p>On the standard UK V1 assumptions, ${money(salary,'GBP')} gives about <strong>${money(c.monthly,'GBP')} per month</strong> or <strong>${money(c.weekly,'GBP')} per week</strong> after Income Tax and employee National Insurance.</p></section>` +
    `<section class="section"><h2>Your ${money(salary,'GBP')} salary breakdown</h2>${table([['Item','Annual estimate'],['Gross salary',money(c.gross,'GBP')],['Income Tax',money(c.incomeTax,'GBP')],['National Insurance',money(c.ni,'GBP')],['Estimated take-home',money(c.net,'GBP')],['Effective deduction rate',pct(c.effective)]])}<p>${threshold}</p></section>` +
    `<section class="section"><h2>Monthly, weekly and hourly view</h2>${table([['Period','Gross equivalent','Estimated net'],['Annual',money(c.gross,'GBP'),money(c.net,'GBP')],['Monthly',money(c.gross/12,'GBP'),money(c.monthly,'GBP')],['Weekly',money(c.gross/52,'GBP'),money(c.weekly,'GBP')],['Hourly equivalent',money(c.hourly,'GBP'),'Based on 37.5 hours/week']])}</section>` +
    `<section class="section"><h2>Pension scenarios</h2>${table([['Pension choice','Take-home estimate','What changes'],['0%',money(c.net,'GBP'),'No pension deduction modelled'],['5%',money(p5.net,'GBP'),`${money(p5.pension,'GBP')} gross pension contribution`],['8%',money(ukCalc(salary,8).net,'GBP'),'Higher contribution, lower immediate take-home'],['10%',money(ukCalc(salary,10).net,'GBP'),'Useful for sensitivity checking']])}</section>` +
    `<section class="section"><h2>Nearby salary comparison</h2>${table([['Salary','Estimated take-home','Difference'],...nearby])}<p>The next ${money(5000,'GBP')} of gross pay is estimated to add about ${money(marginal.net-c.net,'GBP')} of take-home pay.</p></section>` +
    `<section class="section"><h2>Related calculations</h2><p>${a('uk/salary-calculator','Use the UK calculator')}, compare with ${a('tools/pay-rise-calculator','a pay rise')}, or convert this salary using the ${a('tools/salary-to-hourly','salary to hourly calculator')}.</p></section>` +
    faq([
      [`What is ${money(salary,'GBP')} after tax in the UK?`, `The V1 estimate is about ${money(c.net,'GBP')} per year after Income Tax and employee National Insurance.`],
      ['Does pension change the result?','Yes. Pension contributions reduce immediate take-home pay and may also change taxable pay depending on the arrangement.'],
      ['Does this include Scotland?','No. V1 UK salary pages use the England, Wales and Northern Ireland Income Tax structure unless a page says otherwise.']
    ], `uk/${salary}-salary`)
  });
}
function usSalaryPage(salary, stateSlug = null, stateName = null) {
  const c = usCalc(salary, stateSlug);
  const noState = usCalc(salary, null);
  const route = stateSlug ? `us/${stateSlug}/${salary}-salary` : `us/${salary}-salary`;
  const label = stateSlug ? `${money(salary,'USD')} Salary in ${stateName}` : `${money(salary,'USD')} Salary After Tax US`;
  const geo = stateSlug ? `${stateName} state tax is included in this estimate, so the page owns a different intent from the national salary example.` : 'This national estimate uses federal income tax and FICA, without a state income-tax layer.';
  return layout({ route, title:`${label} | SalaryDecoded`, description:`Estimate ${label.toLowerCase()}, with federal tax, FICA, monthly pay, weekly pay and clear calculation assumptions.`, body:
    crumbs(stateSlug ? [['','Home'],['us','US'],[`us/${stateSlug}`,stateName],[route,`${money(salary,'USD')} salary`]] : [['','Home'],['us','US'],['us/salary-guides','Salary Guides'],[route,`${money(salary,'USD')} salary`]]) +
    hero(label, `${money(salary,'USD')} gross pay is estimated at about ${money(c.net,'USD')} take-home pay under the V1 single-filer assumptions.`) +
    resultPanel([
      ['Gross salary', money(c.gross,'USD'), 'annual'],
      ['Take-home pay', money(c.net,'USD'), 'estimated annual net'],
      ['Monthly', money(c.monthly,'USD'), 'after modelled deductions'],
      ['Weekly', money(c.weekly,'USD'), 'planning estimate'],
      ['Federal tax', money(c.federal,'USD'), 'annual estimate'],
      ['FICA', money(c.socialSecurity + c.medicare,'USD'), 'Social Security + Medicare'],
      ['Effective rate', pct(c.effective), 'deductions / gross']
    ], stateSlug ? `${stateName} V1 estimate using federal tax, FICA and selected state income-tax assumptions.` : 'US V1 estimate using single-filer federal tax and employee FICA assumptions.') +
    deductionBar([{ label:'Take-home', value:c.net, class:'net' }, { label:'Federal', value:c.federal, class:'tax' }, { label:'FICA', value:c.socialSecurity + c.medicare, class:'ni' }, { label:'State', value:c.stateTax, class:'state' }]) +
    `<section class="answer"><h2>Direct answer</h2><p>${label} works out at about <strong>${money(c.monthly,'USD')} per month</strong> or <strong>${money(c.weekly,'USD')} per week</strong> after modelled payroll deductions.</p></section>` +
    `<section class="section"><h2>Tax and payroll breakdown</h2>${table([['Item','Annual estimate'],['Gross salary',money(c.gross,'USD')],['Federal income tax',money(c.federal,'USD')],['Social Security',money(c.socialSecurity,'USD')],['Medicare',money(c.medicare,'USD')],['State income tax',stateSlug ? money(c.stateTax,'USD') : 'Not modelled'],['Estimated take-home',money(c.net,'USD')],['Effective deduction rate',pct(c.effective)]])}<p>${geo}</p></section>` +
    `<section class="section"><h2>Pay-period view</h2>${table([['Period','Gross equivalent','Estimated net'],['Annual',money(c.gross,'USD'),money(c.net,'USD')],['Monthly',money(c.gross/12,'USD'),money(c.monthly,'USD')],['Weekly',money(c.gross/52,'USD'),money(c.weekly,'USD')],['Hourly equivalent',money(c.hourly,'USD'),'Based on 40 hours/week']])}</section>` +
    `${stateSlug ? `<section class="section"><h2>${stateName} versus no-state-tax estimate</h2>${table([['Scenario','Estimated take-home','Difference'],[stateName,money(c.net,'USD'),'Current page'],['No state income tax model',money(noState.net,'USD'),money(noState.net-c.net,'USD') + ' higher']])}</section>` : `<section class="section"><h2>State context</h2><p>State income tax can materially change take-home pay. Compare selected examples in ${a('us/california','California')}, ${a('us/new-york','New York')}, ${a('us/texas','Texas')} and ${a('us/florida','Florida')}.</p></section>`}` +
    `<section class="section"><h2>Related calculations</h2><p>${a('us/salary-calculator','Use the US calculator')}, compare offers with ${a('tools/salary-comparison','salary comparison')}, or review ${a('tax-assumptions','tax assumptions')}.</p></section>` +
    faq([
      [`What is ${money(salary,'USD')} after tax?`, `The V1 estimate is about ${money(c.net,'USD')} per year after federal tax, FICA and any selected state tax.`],
      ['Does this include filing status choices?','V1 uses a single-filer standard deduction model. Future versions can add filing status controls.'],
      ['Why can state results differ?','States may apply different income-tax systems, deductions and rates, while Texas and Florida do not have broad individual state income tax.']
    ], route)
  });
}
function toolPage(route, title, desc, kind) {
  return layout({ route, title:`${title} | SalaryDecoded`, description:desc, body:
    crumbs([['','Home'],['tools/salary-to-hourly','Tools'],[route,title]]) +
    hero(title, desc) + calcBox(kind) +
    `<section class="section"><h2>How to read the result</h2><p>The calculator is designed for fast scenario work. It gives an estimate based on documented assumptions, then points you to salary pages where the same logic is shown in more detail.</p>${table([['Use case','Best next page'],['UK salary after tax',a('uk/salary-calculator','UK salary calculator')],['US salary after tax',a('us/salary-calculator','US salary calculator')],['Compare offers',a('tools/salary-comparison','Salary comparison')]])}</section>` +
    `<section class="section"><h2>Example</h2><p>A ${money(60000,'GBP')} salary is not the same as ${money(60000/2080,'GBP')} per hour after tax. Convert gross first, then check take-home pay separately.</p></section>` +
    faq([
      ['Does this replace payroll software?','No. It is an educational estimate for planning and comparison.'],
      ['Are UK and US assumptions different?','Yes. UK examples use Income Tax and National Insurance, while US examples use federal tax and FICA.'],
      ['Where are the assumptions explained?',`See the ${a('methodology','methodology')} and ${a('tax-assumptions','tax assumptions')} pages.`]
    ], route)
  });
}
function trustPage(route, title, desc) {
  const extra = route === 'tax-assumptions' ? `<p>UK V1 uses 2026/27 England, Wales and Northern Ireland Income Tax and Class 1 employee National Insurance assumptions. US V1 uses 2025 federal single-filer brackets, the 2025 standard deduction, employee FICA rates and selected simplified state models.</p>` : `<p>SalaryDecoded favours transparent, calculation-led pages. The site avoids publishing a page unless it has a clear independent purpose and a stable route from relevant hubs.</p>`;
  return layout({ route, title:`${title} | SalaryDecoded`, description:desc, body:
    crumbs([['','Home'],[route,title]]) + hero(title, desc) +
    `<section class="section"><h2>What this page covers</h2>${extra}${table([['Principle','How SalaryDecoded handles it'],['Transparency','Assumptions are published and linked from calculation pages.'],['Limits','Results are estimates, not payslip or tax-return outputs.'],['Updates','Tax inputs should be reviewed when official thresholds change.']])}</section>` +
    `<section class="section"><h2>Useful routes</h2>${cards([['uk/salary-calculator','UK calculator','Estimate UK take-home pay.'],['us/salary-calculator','US calculator','Estimate US take-home pay.'],['tools/salary-comparison','Comparison tool','Compare two salary outcomes.']])}</section>` +
    faq([
      ['Is SalaryDecoded regulated financial advice?','No. It is an educational calculation product and does not provide personal tax, legal or financial advice.'],
      ['Can actual payslips differ?','Yes. Payroll frequency, benefits, tax codes, filing status, local taxes and deductions can change real outcomes.']
    ], route)
  });
}
function premiumCss() {
  return `:root{--ink:#111827;--soft-ink:#273241;--muted:#667085;--line:#d8e0e8;--line-strong:#b8c4d2;--bg:#f5f7fa;--panel:#ffffff;--panel-soft:#fbfcfe;--teal:#0f766e;--teal-dark:#0b4f4a;--blue:#2454a6;--gold:#b7791f;--coral:#b5473b;--green:#12715b;--shadow:0 18px 48px rgba(17,24,39,.10);--shadow-soft:0 10px 28px rgba(17,24,39,.07);--radius:8px;--max:1120px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:var(--ink);background:radial-gradient(circle at top left,#e9f7f4 0,#f5f7fa 32rem);line-height:1.6}a{color:var(--teal-dark);text-decoration-thickness:.08em;text-underline-offset:.2em}a:hover{color:var(--blue)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid rgba(36,84,166,.35);outline-offset:3px}.site-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px clamp(18px,4vw,56px);background:rgba(255,255,255,.88);border-bottom:1px solid rgba(216,224,232,.85);backdrop-filter:blur(14px)}.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);font-weight:850;text-decoration:none;letter-spacing:.01em}.brand-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;color:#fff;background:linear-gradient(135deg,var(--teal),var(--blue));box-shadow:0 10px 24px rgba(15,118,110,.24);font-size:.78rem}.site-header nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.site-header nav a{display:inline-flex;align-items:center;min-height:36px;padding:7px 11px;border-radius:999px;color:var(--soft-ink);font-weight:750;text-decoration:none}.site-header nav a:hover{background:#eef5f5;color:var(--teal-dark)}.breadcrumbs{max-width:var(--max);margin:18px auto 0;padding:0 20px;color:var(--muted);font-size:.92rem}.breadcrumbs a{font-weight:700}.breadcrumbs span{margin-right:8px}.home-hero,.hero{position:relative;overflow:hidden}.home-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,460px);gap:28px;align-items:center;max-width:1280px;margin:0 auto;padding:64px clamp(18px,5vw,72px) 50px}.hero{padding:54px clamp(18px,6vw,84px) 40px;border-bottom:1px solid rgba(216,224,232,.8);background:linear-gradient(135deg,#f7fbfa,#fffaf3)}.hero-copy{max-width:760px}.eyebrow{margin:0 0 10px;color:var(--gold);font-size:.76rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}h1{margin:0 0 16px;font-size:clamp(2.35rem,5vw,5.6rem);line-height:.98;letter-spacing:0}h2{margin:0 0 12px;font-size:clamp(1.35rem,2.1vw,2rem);line-height:1.15}h3{margin:0 0 8px;font-size:1.05rem}.lead{max-width:760px;margin:0 0 22px;color:var(--soft-ink);font-size:clamp(1.05rem,1.6vw,1.28rem)}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.actions a,.calculator button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 16px;border-radius:8px;border:1px solid transparent;background:var(--ink);color:#fff;font-weight:850;text-decoration:none;box-shadow:var(--shadow-soft)}.actions a+ a{background:#fff;color:var(--teal-dark);border-color:var(--line)}.section,.answer,.calculator,.result-panel{max-width:var(--max);margin:0 auto;padding:34px 20px}.section>p,.answer>p{max-width:780px;color:var(--soft-ink)}.answer{margin-top:24px;padding:24px;background:#fff;border:1px solid var(--line);border-left:5px solid var(--teal);border-radius:var(--radius);box-shadow:var(--shadow-soft)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}.card{position:relative;min-height:142px;padding:20px;background:linear-gradient(180deg,#fff,#fbfcfe);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-soft)}.card:before{content:"";position:absolute;left:20px;right:20px;top:0;height:3px;background:linear-gradient(90deg,var(--teal),var(--blue),var(--gold));border-radius:999px}.card p{margin:0;color:var(--muted)}.card h3 a{text-decoration:none;color:var(--ink)}.app-surface{background:linear-gradient(180deg,#10212f,#17364a);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius);box-shadow:var(--shadow);color:#fff}.home-hero .app-surface{padding:22px}.tool-heading h2{color:#fff}.tool-heading .eyebrow{color:#f0bd67}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:6px;color:inherit;font-weight:800;font-size:.9rem}input,select{width:100%;min-height:46px;padding:11px 12px;border:1px solid var(--line-strong);border-radius:8px;background:#fff;color:var(--ink);font:inherit}button{cursor:pointer}.calculator button{width:100%;margin-top:14px;background:linear-gradient(135deg,var(--teal),var(--blue))}.result{margin-top:14px;padding:15px;border-radius:8px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:#fff}.result-panel{margin-top:-8px}.result-panel__intro{display:flex;justify-content:space-between;gap:24px;align-items:end;padding:18px 0}.result-panel__intro p:last-child{max-width:520px;margin:0;color:var(--muted)}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{padding:16px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-soft)}.metric span,.metric small{display:block;color:var(--muted);font-size:.82rem}.metric strong{display:block;margin:5px 0;color:var(--ink);font-size:clamp(1.35rem,2.2vw,2rem);line-height:1.05}.metric:nth-child(2){grid-column:span 2;background:linear-gradient(135deg,#0e6f68,#2454a6);color:#fff}.metric:nth-child(2) span,.metric:nth-child(2) small,.metric:nth-child(2) strong{color:#fff}.deduction-bar{display:flex;max-width:var(--max);height:42px;margin:8px auto 22px;padding:0 20px}.deduction-bar span{display:flex;align-items:center;justify-content:center;min-width:var(--w);width:var(--w);color:#fff;font-size:.78rem;font-weight:850;white-space:nowrap;overflow:hidden}.deduction-bar .net{background:var(--green);border-radius:8px 0 0 8px}.deduction-bar .tax{background:var(--coral)}.deduction-bar .ni{background:var(--gold)}.deduction-bar .state{background:var(--blue);border-radius:0 8px 8px 0}.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-soft)}table{width:100%;border-collapse:collapse;min-width:560px}th,td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#eef5f5;color:var(--soft-ink);font-size:.83rem;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.link-cloud{display:flex;flex-wrap:wrap;gap:10px}.link-cloud a{display:inline-flex;align-items:center;min-height:38px;padding:8px 12px;background:#fff;border:1px solid var(--line);border-radius:999px;color:var(--soft-ink);font-weight:780;text-decoration:none}.link-cloud a:hover{border-color:var(--teal);box-shadow:var(--shadow-soft)}.faq details{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;margin:10px 0}.faq summary{cursor:pointer;font-weight:850}.site-footer{margin-top:36px;padding:28px clamp(18px,4vw,56px);background:#111827;color:#d7dee8}.site-footer p{max-width:760px}.site-footer a{color:#fff;margin-right:14px;font-weight:760}.next{border-top:1px solid var(--line)}@media(max-width:900px){.home-hero{grid-template-columns:1fr;padding-top:42px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metric:nth-child(2){grid-column:span 1}.result-panel__intro{display:block}.form-grid{grid-template-columns:1fr}}@media(max-width:560px){.site-header{position:static;align-items:flex-start;display:block}.site-header nav{justify-content:flex-start;margin-top:12px}.site-header nav a{padding-left:0}.home-hero,.hero{padding:32px 18px}.section,.answer,.calculator,.result-panel{padding:26px 16px}.metric-grid{grid-template-columns:1fr}.metric strong{font-size:1.55rem}.deduction-bar{display:grid;height:auto;gap:4px}.deduction-bar span{width:100%;min-width:0;min-height:34px;border-radius:8px!important}table{min-width:0}thead,tbody,tr,th,td{display:block}tr{border-bottom:1px solid var(--line)}th{display:none}td{display:grid;grid-template-columns:minmax(110px,40%) 1fr;gap:10px;border:0;padding:8px 12px}td:before{content:attr(data-label);font-weight:850;color:var(--muted)}.card{min-height:0}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important;animation:none!important}}`;
}
function generate() {
  clean();
  write('assets/style.css', `:root{--ink:#17212b;--muted:#5d6875;--line:#dce3ea;--bg:#f7fafc;--panel:#fff;--accent:#126b6f;--accent2:#9b5b1a}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6}.site-header,.site-footer{background:#fff;border-bottom:1px solid var(--line);padding:16px clamp(18px,4vw,56px);display:flex;gap:24px;align-items:center;justify-content:space-between}.site-footer{border-top:1px solid var(--line);border-bottom:0;display:block}.brand{font-weight:800;color:var(--ink);text-decoration:none;font-size:1.25rem}nav a,.link-cloud a,.actions a{color:var(--accent);font-weight:700;margin-right:14px}.hero{padding:58px clamp(18px,6vw,84px);background:linear-gradient(120deg,#eef8f7,#fff7ec);border-bottom:1px solid var(--line)}h1{font-size:clamp(2rem,4vw,4.2rem);line-height:1.05;margin:0 0 14px}h2{font-size:1.55rem;margin:0 0 12px}.lead{font-size:1.2rem;max-width:780px}.eyebrow{font-weight:800;color:var(--accent2);text-transform:uppercase;font-size:.78rem;letter-spacing:.08em}.section,.answer,.calculator{max-width:1060px;margin:0 auto;padding:34px 20px}.answer{background:#fff;border:1px solid var(--line);border-radius:8px;margin-top:28px}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card,.calculator,.table-wrap{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px}.card h3{margin:0 0 8px}.table-wrap{overflow:auto;padding:0}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left}th{background:#eef5f5}.breadcrumbs{max-width:1060px;margin:16px auto 0;padding:0 20px;color:var(--muted)}.breadcrumbs span{margin-right:8px}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}label{font-weight:700}input,select,button{width:100%;padding:12px;border:1px solid var(--line);border-radius:6px;font:inherit}button{background:var(--accent);color:#fff;border:0;margin-top:12px;font-weight:800}.result{margin-top:14px;padding:14px;background:#eef8f7;border-radius:6px}.link-cloud{display:flex;flex-wrap:wrap;gap:10px}.link-cloud a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 12px;text-decoration:none}.faq details{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}@media(max-width:720px){.site-header{display:block}.site-header nav{margin-top:10px}.hero{padding-top:38px}}`);
  write('assets/style.css', premiumCss());
  write('assets/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111827"/><path d="M15 43h34" stroke="#38b2ac" stroke-width="5" stroke-linecap="round"/><path d="M19 37l8-17 9 17 9-22" fill="none" stroke="#f0bd67" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="16" y="54" fill="#fff" font-family="Arial,sans-serif" font-size="12" font-weight="700">SD</text></svg>`);
  write('assets/calculators.js', `(()=>{function gbp(n){return '£'+Math.round(n).toLocaleString('en-GB')}function usd(n){return '$'+Math.round(n).toLocaleString('en-US')}function uk(s,p=0){let pen=s*p/100,t=Math.max(0,s-pen),pa=t<=100000?12570:Math.max(0,12570-(t-100000)/2),taxable=Math.max(0,t-pa),it=Math.max(0,Math.min(taxable,37700))*0.2+Math.max(0,Math.min(taxable,112570)-37700)*0.4+Math.max(0,taxable-112570)*0.45,ni=Math.max(0,Math.min(s,50270)-12570)*0.08+Math.max(0,s-50270)*0.02,net=s-pen-it-ni;return{net,monthly:net/12,weekly:net/52}}function us(s){let taxable=Math.max(0,s-15000),bands=[[0,11925,.1],[11925,48475,.12],[48475,103350,.22],[103350,197300,.24],[197300,250525,.32],[250525,626350,.35],[626350,1e12,.37]],fed=0;for(let b of bands)if(taxable>b[0])fed+=(Math.min(taxable,b[1])-b[0])*b[2];let fica=Math.min(s,176100)*.062+s*.0145+Math.max(0,s-200000)*.009,net=s-fed-fica;return{net,monthly:net/12,weekly:net/52}}document.querySelectorAll('[data-calculator]').forEach(box=>{let btn=box.querySelector('[data-action]'),out=box.querySelector('[data-output]');btn&&btn.addEventListener('click',()=>{let kind=box.dataset.calculator,amount=+box.querySelector('[data-input=amount]').value||0,cmp=+box.querySelector('[data-input=compare]').value||0,region=box.querySelector('[data-input=region]').value,p=+box.querySelector('[data-input=pension]').value||0,fmt=region==='uk'?gbp:usd,calc=region==='uk'?uk(amount,p):us(amount),calc2=region==='uk'?uk(cmp,p):us(cmp);if(kind==='salaryToHourly')out.textContent=fmt(amount)+' gross is about '+fmt(amount/(region==='uk'?1950:2080))+' per hour before tax. Estimated monthly take-home: '+fmt(calc.monthly)+'.';else if(kind==='hourlyToSalary'){let sal=amount*(region==='uk'?1950:2080),c=region==='uk'?uk(sal,p):us(sal);out.textContent=fmt(amount)+' per hour is about '+fmt(sal)+' gross per year. Estimated annual take-home: '+fmt(c.net)+'.'}else if(kind==='compare'||kind==='payRise')out.textContent='Estimated take-home difference: '+fmt(calc2.net-calc.net)+' per year, or '+fmt((calc2.net-calc.net)/12)+' per month.';else if(kind==='bonus')out.textContent='A rough bonus impact can be estimated by comparing salary alone with salary plus bonus. Estimated retained amount on comparison: '+fmt(calc2.net-calc.net)+'.';});});})();`);
  const pages = [];
  const add = (route, html) => { pages.push(route); write(fileFor(route), html); };
  add('', home());
  add('uk', hub('uk','UK Salary and Take-Home Pay | SalaryDecoded','UK salary calculators, salary guides and take-home-pay explanations using transparent assumptions.','UK Salary and Take-Home Pay','Start with UK gross salary, then inspect estimated Income Tax, National Insurance, pension scenarios and pay-period equivalents.', `<section class="section"><h2>UK calculator routes</h2>${cards([['uk/salary-calculator','UK salary calculator','Interactive UK take-home-pay estimate.'],['uk/salary-guides','UK salary guides','Selected salary examples from &pound;20,000 to &pound;150,000.'],['uk/monthly-take-home-pay','Monthly take-home pay','Understand annual-to-monthly salary conversion.'],['uk/weekly-take-home-pay','Weekly take-home pay','Convert annual salary into weekly planning numbers.']])}</section>`));
  add('uk/salary-calculator', hub('uk/salary-calculator','UK Salary Calculator | SalaryDecoded','Estimate UK salary after tax, including Income Tax, National Insurance and pension contribution examples.','UK Salary Calculator','Use the calculator for a fast UK take-home-pay estimate, then compare against selected salary guide pages.', calcBox('salaryToHourly') + `<section class="section"><h2>Selected salary guides</h2><div class="link-cloud">${ukSalaries.map(s=>a(`uk/${s}-salary`,money(s,'GBP'))).join('')}</div></section>`));
  add('uk/salary-guides', hub('uk/salary-guides','UK Salary Guides | SalaryDecoded','Selected UK salary-after-tax examples chosen for common salary levels and tax-threshold usefulness.','UK Salary Guides','These salary pages are selected deliberately: common salaries, threshold areas and high-income examples with real calculation differences.', `<section class="section"><h2>Selected UK salaries</h2><div class="link-cloud">${ukSalaries.map(s=>a(`uk/${s}-salary`,`${money(s,'GBP')} salary`)).join('')}</div></section>`));
  add('uk/monthly-take-home-pay', hub('uk/monthly-take-home-pay','Monthly Take-Home Pay UK | SalaryDecoded','Understand monthly take-home pay from annual salary using UK tax and National Insurance assumptions.','Monthly Take-Home Pay UK','Monthly pay is often the budget number that matters most. This hub links annual salary examples to monthly take-home estimates.', `<section class="section"><h2>Monthly examples</h2>${table([['Salary','Estimated monthly take-home','Guide'],...ukSalaries.slice(4,12).map(s=>[money(s,'GBP'),money(ukCalc(s).monthly,'GBP'),a(`uk/${s}-salary`,'View guide')])])}</section>`));
  add('uk/weekly-take-home-pay', hub('uk/weekly-take-home-pay','Weekly Take-Home Pay UK | SalaryDecoded','Convert annual UK salary into estimated weekly take-home pay and payroll planning figures.','Weekly Take-Home Pay UK','Weekly estimates are useful when comparing shifts, hours and short-term budget commitments.', `<section class="section"><h2>Weekly examples</h2>${table([['Salary','Estimated weekly take-home','Guide'],...ukSalaries.slice(2,10).map(s=>[money(s,'GBP'),money(ukCalc(s).weekly,'GBP'),a(`uk/${s}-salary`,'View guide')])])}</section>`));
  for (const s of ukSalaries) add(`uk/${s}-salary`, ukSalaryPage(s));
  add('us', hub('us','US Salary and Take-Home Pay | SalaryDecoded','US salary calculators, national salary examples and selected state salary guides.','US Salary and Take-Home Pay','Estimate federal tax, FICA, monthly pay, weekly pay and selected state-tax differences.', `<section class="section"><h2>US calculator routes</h2>${cards([['us/salary-calculator','US salary calculator','Estimate federal tax and FICA.'],['us/salary-guides','US salary guides','Selected national salary examples.'],['us/state-salary-guides','State salary guides','Selected state examples where geography changes the answer.']])}</section>`));
  add('us/salary-calculator', hub('us/salary-calculator','US Salary Calculator | SalaryDecoded','Estimate US salary after federal tax and FICA, with selected state context.','US Salary Calculator','Use the calculator to estimate US take-home pay under transparent single-filer assumptions.', calcBox('salaryToHourly') + `<section class="section"><h2>Selected US salaries</h2><div class="link-cloud">${usSalaries.map(s=>a(`us/${s}-salary`,money(s,'USD'))).join('')}</div></section>`));
  add('us/salary-guides', hub('us/salary-guides','US Salary Guides | SalaryDecoded','Selected US salary-after-tax examples with federal tax, FICA and pay-period interpretation.','US Salary Guides','A small national cohort gives useful salary anchors without publishing every salary permutation.', `<section class="section"><h2>Selected national salaries</h2><div class="link-cloud">${usSalaries.map(s=>a(`us/${s}-salary`,`${money(s,'USD')} salary`)).join('')}</div></section>`));
  add('us/state-salary-guides', hub('us/state-salary-guides','State Salary Guides | SalaryDecoded','Selected US state salary examples where state tax changes take-home pay interpretation.','State Salary Guides','V1 includes only a few state pages where geography changes the calculation enough to justify separate URLs.', `<section class="section"><h2>Selected states</h2>${cards(states.map(([slug,name,desc])=>[`us/${slug}`,name,desc]))}</section>`));
  for (const [slug,name,desc] of states) add(`us/${slug}`, hub(`us/${slug}`,`${name} Salary After Tax | SalaryDecoded`,`Selected ${name} salary after tax examples with state-specific payroll interpretation.`,`${name} Salary After Tax`,desc, `<section class="section"><h2>${name} salary examples</h2><div class="link-cloud">${statePages.filter(p=>p[0]===slug).map(p=>a(`us/${slug}/${p[2]}-salary`,`${money(p[2],'USD')} in ${name}`)).join('')}</div></section>`));
  for (const s of usSalaries) add(`us/${s}-salary`, usSalaryPage(s));
  for (const [slug,name,salary] of statePages) add(`us/${slug}/${salary}-salary`, usSalaryPage(salary, slug, name));
  for (const [r,t,d,k] of tools) add(r, toolPage(r,t,d,k));
  for (const [r,t,d] of trust) add(r, trustPage(r,t,d));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(r=>`  <url><loc>${url(r)}</loc></url>`).join('\n')}\n</urlset>\n`;
  write('sitemap.xml', sitemap);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  write('docs/salarydecoded-v1-url-manifest.csv', 'route,canonical,family\n' + pages.map(r=>`${r || '/'},${url(r)},${r.split('/')[0] || 'homepage'}`).join('\n') + '\n');
  write('docs/salarydecoded-v1-architecture.md', `# SalaryDecoded V1 Architecture\n\nV1 publishes ${pages.length} indexable URLs in a shallow hierarchy: homepage, UK, US, tools, selected salary pages, selected state pages and trust pages.\n\nUK salary cohort: ${ukSalaries.map(s=>money(s,'GBP')).join(', ')}.\n\nUS salary cohort: ${usSalaries.map(s=>money(s,'USD')).join(', ')}.\n\nSelected states: California, New York, Texas and Florida.\n`);
  write('docs/salarydecoded-calculation-methodology.md', `# Calculation Methodology\n\nCentral calculations live in the build script and browser calculator helper. UK V1 uses England/Wales/Northern Ireland Income Tax and Class 1 employee NI assumptions. US V1 uses single-filer federal assumptions, standard deduction, employee FICA and selected simplified state models.\n\nOfficial references used during build: GOV.UK Income Tax rates and allowances, GOV.UK National Insurance rates, IRS federal income tax brackets, SSA/IRS FICA guidance, California FTB schedules, New York State tax law, and Texas constitutional income-tax prohibition.\n`);
  write('docs/salarydecoded-expansion-governance.md', `# Expansion Governance\n\nFuture expansion must use an approved URL manifest. Do not publish every salary, pay period, state or country combination automatically. Expand only when existing cohorts show discovery, crawl, indexing and search participation.\n`);
  write('docs/salarydecoded-prelaunch-audit.md', `# Prelaunch Audit\n\nRun: node scripts/test-calculations.js and node scripts/audit-site.js after each build. Targets: zero broken internal links, zero orphans, sitemap/canonical parity, one H1, unique metadata and P95 depth <= 3.\n`);
  write('docs/salarydecoded-crawl-graph.csv', 'Run node scripts/audit-site.js to regenerate crawl metrics.\n');
  console.log(JSON.stringify({ pages: pages.length, root: ROOT }, null, 2));
}
generate();
