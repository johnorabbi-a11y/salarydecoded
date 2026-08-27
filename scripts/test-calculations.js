function taxBand(amount, bands) {
  let tax = 0;
  for (const [from, to, rate] of bands) {
    if (amount > from) tax += (Math.min(amount, to ?? amount) - from) * rate;
  }
  return Math.max(0, tax);
}
function ukCalc(salary, pensionPct = 0) {
  const pension = salary * pensionPct / 100;
  const taxableIncome = Math.max(0, salary - pension);
  const allowance = taxableIncome <= 100000 ? 12570 : Math.max(0, 12570 - (taxableIncome - 100000) / 2);
  const taxable = Math.max(0, taxableIncome - allowance);
  const incomeTax = taxBand(taxable, [[0,37700,0.20],[37700,112570,0.40],[112570,null,0.45]]);
  const ni = Math.max(0, Math.min(salary,50270)-12570)*0.08 + Math.max(0, salary-50270)*0.02;
  const net = salary - incomeTax - ni - pension;
  return { salary, pension, allowance, taxable, incomeTax, ni, net };
}
function usCalc(salary) {
  const taxable = Math.max(0, salary - 15000);
  const federal = taxBand(taxable, [[0,11925,0.10],[11925,48475,0.12],[48475,103350,0.22],[103350,197300,0.24],[197300,250525,0.32],[250525,626350,0.35],[626350,null,0.37]]);
  const fica = Math.min(salary,176100)*0.062 + salary*0.0145 + Math.max(0, salary-200000)*0.009;
  return { salary, taxable, federal, fica, net: salary - federal - fica };
}
function assert(name, condition, detail) {
  if (!condition) {
    console.error(`FAIL ${name}: ${detail}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${name}`);
  }
}
const uk12570 = ukCalc(12570);
assert('UK personal allowance boundary', Math.round(uk12570.incomeTax) === 0 && Math.round(uk12570.ni) === 0, JSON.stringify(uk12570));
const uk50270 = ukCalc(50270);
assert('UK higher-rate threshold taxable span', Math.round(uk50270.incomeTax) === 7540, JSON.stringify(uk50270));
const uk100k = ukCalc(100000);
const uk125k = ukCalc(125000);
assert('UK allowance taper starts after 100k', uk100k.allowance === 12570 && uk125k.allowance < 12570, `${uk100k.allowance}, ${uk125k.allowance}`);
const us15k = usCalc(15000);
assert('US standard deduction boundary', Math.round(us15k.federal) === 0, JSON.stringify(us15k));
const us200k = usCalc(200000);
assert('US Social Security wage cap applied', Math.round(us200k.fica) === Math.round(176100*0.062 + 200000*0.0145), JSON.stringify(us200k));
if (!process.exitCode) console.log('Calculation tests passed.');
