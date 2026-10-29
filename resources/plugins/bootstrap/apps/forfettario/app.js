'use strict';

const fields = ['revenue', 'coefficient', 'paid', 'contributions'].map(id => document.getElementById(id));
const tax = document.getElementById('tax');
const warning = document.getElementById('warning');
const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
let active = fields[0];

function calculate() {
  const [revenue, coefficient, paid, contributions] = fields.map(field => Number(field.value));
  const valid = fields.every(field => field.value !== '' && field.checkValidity() && Number.isFinite(Number(field.value)));
  const outputs = ['net', 'income', 'base', 'amount', 'total'];
  if (!valid || revenue > 100000) {
    outputs.forEach(id => document.getElementById(id).textContent = '—');
    warning.hidden = false;
    warning.textContent = !valid ? 'Inserisci valori validi e non negativi; la redditività deve essere tra 0 e 100%.' : 'Oltre 100.000 € il regime cessa nello stesso anno. Questa stima non si applica.';
    return;
  }
  const income = revenue * coefficient / 100;
  const base = Math.max(0, income - paid);
  const amount = base * Number(tax.value) / 100;
  const total = amount + contributions;
  [revenue - total, income, base, amount, total].forEach((value, index) => document.getElementById(outputs[index]).textContent = money.format(value));
  warning.hidden = revenue <= 85000;
  warning.textContent = 'Oltre 85.000 € il regime cessa dall’anno successivo, salvo altre condizioni.';
}

fields.forEach(field => {
  field.addEventListener('focus', () => { active = field; });
  field.addEventListener('input', calculate);
});
tax.addEventListener('change', calculate);
document.querySelector('.keypad').addEventListener('click', event => {
  const key = event.target.dataset.key;
  if (!key) return;
  if (key === 'next') {
    active = fields[(fields.indexOf(active) + 1) % fields.length];
    active.focus();
    active.select();
    return;
  }
  if (key === 'clear') active.value = '0';
  else if (key === 'back') active.value = active.value.slice(0, -1) || '0';
  else if (key === '.') {
    if (!active.value.includes('.')) active.value += '.';
  } else active.value = active.value === '0' ? key : active.value + key;
  calculate();
});
calculate();
