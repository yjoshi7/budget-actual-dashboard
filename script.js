const API = 'YOUR_APPS_SCRIPT_URL';  // <-- paste your web app URL here

const deptList = ['Finance','IT','HR','Marketing','Sales','Operations','Legal','Customer Support','Administration'];
const deptSelect = document.getElementById('deptSelect');
const monthPicker = document.getElementById('monthPicker');

// Set default month to current
monthPicker.value = new Date().toISOString().slice(0,7);

// Populate department dropdown
deptList.forEach(d => {
  const opt = document.createElement('option');
  opt.value = d;
  opt.textContent = d;
  deptSelect.appendChild(opt);
});

// Event listeners
document.getElementById('loadBtn').addEventListener('click', loadDashboard);
document.getElementById('addBtn').addEventListener('click', addEntry);
document.getElementById('clearBtn').addEventListener('click', clearMonth);
document.getElementById('summaryTable').addEventListener('click', handleDrillClick);

// Help toggle
document.getElementById('helpToggle').addEventListener('click', function() {
  const content = document.getElementById('helpContent');
  const isVisible = content.style.display === 'block';
  content.style.display = isVisible ? 'none' : 'block';
  this.textContent = isVisible ? '📘 How to Use This Dashboard' : '📘 Hide Guide';
});

// -------------------------------------------
async function fetchData(type) {
  const res = await fetch(`${API}?action=get${type}`);
  const data = await res.json();
  const month = monthPicker.value;
  return data.filter(row => row[0] === month).map(row => ({
    month: row[0],
    dept: row[1],
    category: row[2],
    amount: parseFloat(row[3])
  }));
}

async function loadDashboard() {
  const month = monthPicker.value;
  if (!month) return;

  const [budgetData, actualData] = await Promise.all([
    fetchData('Budget'),
    fetchData('Actual')
  ]);

  // Summarize by department
  const budgetByDept = {}, actualByDept = {};
  budgetData.forEach(b => budgetByDept[b.dept] = (budgetByDept[b.dept]||0)+b.amount);
  actualData.forEach(a => actualByDept[a.dept] = (actualByDept[a.dept]||0)+a.amount);

  const rows = deptList.map(dept => {
    const budget = budgetByDept[dept] || 0;
    const actual = actualByDept[dept] || 0;
    const variance = actual - budget;
    const utilisation = budget ? ((actual/budget)*100).toFixed(1) : 0;
    return { dept, budget, actual, variance, utilisation };
  });

  // KPIs
  const totalBudget = rows.reduce((s,r)=>s+r.budget,0);
  const totalActual = rows.reduce((s,r)=>s+r.actual,0);
  const totalVariance = totalActual - totalBudget;
  const overallUtil = totalBudget ? ((totalActual/totalBudget)*100).toFixed(1) : 0;

  document.getElementById('totalBudget').textContent = '₹' + totalBudget.toLocaleString();
  document.getElementById('totalActual').textContent = '₹' + totalActual.toLocaleString();
  document.getElementById('variance').textContent = '₹' + totalVariance.toLocaleString();
  document.getElementById('utilisation').textContent = overallUtil + '%';

  renderTable(rows);
  renderDeptChart(rows);

  // Hide drilldown initially
  document.getElementById('drilldownPanel').style.display = 'none';
}

function renderTable(rows) {
  let html = `<table>
    <tr><th>Department</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Utilisation</th><th>Status</th></tr>`;
  rows.forEach(r => {
    const varClass = r.variance >= 0 ? 'negative' : 'positive';
    const status = r.variance > 0 ? '🔴 Over' : (r.variance < 0 ? '🟢 Under' : '⚪ On track');
    html += `<tr data-dept="${r.dept}" style="cursor:pointer;">
      <td>${r.dept}</td>
      <td>₹${r.budget.toLocaleString()}</td>
      <td>₹${r.actual.toLocaleString()}</td>
      <td class="${varClass}">₹${r.variance.toLocaleString()}</td>
      <td>${r.utilisation}%</td>
      <td>${status}</td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('summaryTable').innerHTML = html;
}

let deptChartInstance;
function renderDeptChart(rows) {
  const ctx = document.getElementById('deptChart').getContext('2d');
  if (deptChartInstance) deptChartInstance.destroy();
  deptChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.dept),
      datasets: [
        { label: 'Budget', data: rows.map(r => r.budget), backgroundColor: '#3B82F6' },
        { label: 'Actual', data: rows.map(r => r.actual), backgroundColor: '#10B981' }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });
}

// Drill-down with Totals Row
async function handleDrillClick(e) {
  const tr = e.target.closest('tr');
  if (!tr || !tr.dataset.dept) return;
  const dept = tr.dataset.dept;
  const month = monthPicker.value;
  if (!month) return;

  const [budgetData, actualData] = await Promise.all([fetchData('Budget'), fetchData('Actual')]);
  const bFilter = budgetData.filter(d => d.dept === dept);
  const aFilter = actualData.filter(d => d.dept === dept);

  const categories = [...new Set([...bFilter.map(d => d.category), ...aFilter.map(d => d.category)])];
  const catRows = categories.map(cat => {
    const b = bFilter.filter(d => d.category === cat).reduce((s,d) => s+d.amount, 0);
    const a = aFilter.filter(d => d.category === cat).reduce((s,d) => s+d.amount, 0);
    return { category: cat, budget: b, actual: a, variance: a-b };
  });

  const totalBudget = catRows.reduce((s, r) => s + r.budget, 0);
  const totalActual = catRows.reduce((s, r) => s + r.actual, 0);
  const totalVariance = totalActual - totalBudget;

  document.getElementById('drillTitle').textContent = `${dept} - Expense Breakdown`;

  let html = `<table>
    <tr><th>Category</th><th>Budget</th><th>Actual</th><th>Variance</th></tr>`;
  catRows.forEach(r => {
    const varClass = r.variance >= 0 ? 'negative' : 'positive';
    html += `<tr>
      <td>${r.category}</td>
      <td>₹${r.budget.toLocaleString()}</td>
      <td>₹${r.actual.toLocaleString()}</td>
      <td class="${varClass}">₹${r.variance.toLocaleString()}</td>
    </tr>`;
  });

  // Totals row
  html += `<tr>
    <td><strong>TOTAL</strong></td>
    <td><strong>₹${totalBudget.toLocaleString()}</strong></td>
    <td><strong>₹${totalActual.toLocaleString()}</strong></td>
    <td class="${totalVariance >= 0 ? 'negative' : 'positive'}"><strong>₹${totalVariance.toLocaleString()}</strong></td>
  </tr>`;

  html += '</table>';
  document.getElementById('drillTable').innerHTML = html;
  document.getElementById('drilldownPanel').style.display = 'block';

  renderCategoryChart(catRows);
}

let catChartInstance;
function renderCategoryChart(rows) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (catChartInstance) catChartInstance.destroy();
  catChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.category),
      datasets: [
        { label: 'Budget', data: rows.map(r => r.budget), backgroundColor: '#94A3B8' },
        { label: 'Actual', data: rows.map(r => r.actual), backgroundColor: '#F59E0B' }
      ]
    },
    options: { responsive: true }
  });
}

async function addEntry() {
  const type = document.getElementById('typeSelect').value;
  const dept = deptSelect.value;
  const category = document.getElementById('categoryInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  if (!dept || !category || isNaN(amount)) return alert('Fill all fields');

  const action = type === 'budget' ? 'addBudget' : 'addActual';
  const params = `action=${action}&month=${monthPicker.value}&dept=${encodeURIComponent(dept)}&category=${encodeURIComponent(category)}&amount=${amount}`;
  await fetch(`${API}?${params}`);
  document.getElementById('categoryInput').value = '';
  document.getElementById('amountInput').value = '';
  loadDashboard();
}

async function clearMonth() {
  if (!confirm('Clear all data for this month?')) return;
  await fetch(`${API}?action=clearMonth&month=${monthPicker.value}`);
  loadDashboard();
}
