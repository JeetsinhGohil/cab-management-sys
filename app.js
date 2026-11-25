/**
 * =========================================================================
 * CABPULSE - MOBILE OPERATIONS CONTROLLER (GITHUB PAGES)
 * =========================================================================
 * Connects directly to Google Apps Script Web App backend.
 * Zero servers or build tools required - ready for 1-click GitHub Pages deployment.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzqpqgmJMedMeWxtwjPFk65OBaBH7Bo7i8LFRkynzcrKhfErsHbiAcgNQKrz8nwGapinw/exec';

// Application State
const STATE = {
  entries: [],
  selectedDailyDate: getStandardDateString(new Date()),
  selectedMonth: getYearMonthString(new Date()),
  bestDayDate: null,
  isConnected: true,
  activeTab: 'today',
  editingRowIndex: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initMobileApp();
});

/**
 * Initialize Mobile App
 */
function initMobileApp() {
  updateHeaderDateDisplay();

  // Load cached entries
  const cached = localStorage.getItem('cab_mobile_entries');
  if (cached) {
    try {
      STATE.entries = JSON.parse(cached);
    } catch (e) {
      STATE.entries = [];
    }
  } else {
    STATE.entries = [];
  }

  // Set default form date to today
  setFormDateOffset(0);

  // Render initial view
  renderDailyView();
  renderMonthlyView();
  renderHistoryStream();

  // Load latest data from Google Sheets
  fetchLatestData(true);

  if (window.lucide) lucide.createIcons();
}

/**
 * Switch Bottom Navigation Tab ('today' | 'monthly' | 'entry' | 'history')
 */
function switchTab(tabId) {
  hapticFeedback(10);
  STATE.activeTab = tabId;

  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.querySelectorAll('.bottom-tab-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabId}`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetView) targetView.classList.remove('hidden');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'today') {
    renderDailyView();
  } else if (tabId === 'monthly') {
    renderMonthlyView();
  } else if (tabId === 'history') {
    renderHistoryStream();
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Update Header Live Date text
 */
function updateHeaderDateDisplay() {
  const el = document.getElementById('header-today-date');
  if (el) {
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    el.textContent = `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]}`;
  }
}

/**
 * Day Selector on Today Screen ('today' | 'yesterday')
 */
function selectDailyDate(type) {
  hapticFeedback(10);
  const now = new Date();
  const btnToday = document.getElementById('btn-daily-today');
  const btnYest = document.getElementById('btn-daily-yesterday');

  if (type === 'today') {
    STATE.selectedDailyDate = getStandardDateString(now);
    btnToday?.classList.add('bg-amber-500', 'text-slate-950');
    btnToday?.classList.remove('text-gray-400');
    btnYest?.classList.remove('bg-amber-500', 'text-slate-950');
    btnYest?.classList.add('text-gray-400');
  } else if (type === 'yesterday') {
    const yest = new Date();
    yest.setDate(now.getDate() - 1);
    STATE.selectedDailyDate = getStandardDateString(yest);
    btnYest?.classList.add('bg-amber-500', 'text-slate-950');
    btnYest?.classList.remove('text-gray-400');
    btnToday?.classList.remove('bg-amber-500', 'text-slate-950');
    btnToday?.classList.add('text-gray-400');
  }

  renderDailyView();
}

/**
 * Custom Date selected on Today View
 */
function onDailyDatePickerChange(val) {
  if (!val) return;
  hapticFeedback(10);
  const d = new Date(val);
  STATE.selectedDailyDate = getStandardDateString(d);

  document.getElementById('btn-daily-today')?.classList.remove('bg-amber-500', 'text-slate-950');
  document.getElementById('btn-daily-today')?.classList.add('text-gray-400');
  document.getElementById('btn-daily-yesterday')?.classList.remove('bg-amber-500', 'text-slate-950');
  document.getElementById('btn-daily-yesterday')?.classList.add('text-gray-400');

  const pickerLabel = document.getElementById('daily-picker-label');
  if (pickerLabel) {
    pickerLabel.textContent = `${d.getDate()}/${d.getMonth() + 1}`;
  }

  renderDailyView();
}

/**
 * Render Today (Daily Cockpit) View
 */
function renderDailyView() {
  const targetDate = STATE.selectedDailyDate;
  const todayStandard = getStandardDateString(new Date());
  const yest = new Date();
  yest.setDate(new Date().getDate() - 1);
  const yestStandard = getStandardDateString(yest);

  let titleLabel = targetDate;
  if (targetDate === todayStandard) titleLabel = "Today";
  else if (targetDate === yestStandard) titleLabel = "Yesterday";

  setText('daily-view-date-title', `${titleLabel} (${targetDate})`);

  // Find shift record for target date
  const entry = STATE.entries.find(e => isSameDate(e.date, targetDate));

  const badge = document.getElementById('daily-shift-badge');
  const actionBtn = document.getElementById('btn-daily-action');
  const actionBtnText = document.getElementById('btn-daily-action-text');

  if (entry) {
    if (badge) {
      badge.textContent = "Shift Logged";
      badge.className = "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
    }

    const profit = entry.dailyProfit || 0;
    const earned = entry.totalEarning || 0;
    const spent = entry.totalExpense || 0;
    const km = entry.km || 0;
    const margin = earned > 0 ? ((profit / earned) * 100).toFixed(0) : 0;
    const rate = km > 0 ? (profit / km).toFixed(2) : '0.00';

    setText('daily-profit-hero', (profit >= 0 ? '+' : '') + `₹${formatINR(profit)}`);
    setText('daily-margin-badge', `${margin}% Margin`);
    setText('daily-earned-val', `₹${formatINR(earned)}`);
    setText('daily-spent-val', `₹${formatINR(spent)}`);

    setText('daily-metric-km', km);
    setText('daily-metric-trips', entry.totalTrip || 0);
    setText('daily-metric-time', entry.activeTime || '0H');
    setText('daily-metric-rate', `₹${rate}`);

    setText('daily-apps-total', `₹${formatINR(earned)} Total`);
    setText('daily-breakdown-rapido', `₹${formatINR(entry.rapido || 0)}`);
    setText('daily-breakdown-uber', `₹${formatINR(entry.uber || 0)}`);
    setText('daily-breakdown-ola', `₹${formatINR(entry.ola || 0)}`);
    setText('daily-breakdown-bharat', `₹${formatINR(entry.bharatTaxi || 0)}`);

    setText('daily-expenses-total', `₹${formatINR(spent)} Total`);
    setText('daily-breakdown-cng', `₹${formatINR(entry.cng || 0)}`);
    setText('daily-breakdown-pass', `₹${formatINR(entry.onlinePass || 0)}`);

    if (actionBtnText) actionBtnText.textContent = `✏️ Edit Shift for ${titleLabel}`;
    if (actionBtn) {
      actionBtn.className = "w-full py-3.5 rounded-xl font-black text-sm tracking-wide bg-gray-800 text-amber-400 border border-gray-700 flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition";
    }
  } else {
    if (badge) {
      badge.textContent = "No Shift Logged";
      badge.className = "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700";
    }

    setText('daily-profit-hero', '₹0');
    setText('daily-margin-badge', '0% Margin');
    setText('daily-earned-val', '₹0');
    setText('daily-spent-val', '₹0');

    setText('daily-metric-km', '0');
    setText('daily-metric-trips', '0');
    setText('daily-metric-time', '0H');
    setText('daily-metric-rate', '₹0.00');

    setText('daily-apps-total', '₹0 Total');
    setText('daily-breakdown-rapido', '₹0');
    setText('daily-breakdown-uber', '₹0');
    setText('daily-breakdown-ola', '₹0');
    setText('daily-breakdown-bharat', '₹0');

    setText('daily-expenses-total', '₹0 Total');
    setText('daily-breakdown-cng', '₹0');
    setText('daily-breakdown-pass', '₹0');

    if (actionBtnText) actionBtnText.textContent = `➕ Log Shift for ${titleLabel}`;
    if (actionBtn) {
      actionBtn.className = "w-full py-3.5 rounded-xl font-black text-sm tracking-wide bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition";
    }

    // Quick navigation hint if other shifts exist
    const otherShift = STATE.entries.find(e => !isSameDate(e.date, targetDate));
    if (otherShift && actionBtnText) {
      actionBtnText.innerHTML = `➕ Log Shift for ${titleLabel} <span class="text-[11px] font-normal block opacity-80">(or tap History to see ${otherShift.date})</span>`;
    }
  }
}

/**
 * Open Entry Form with current inspected date
 */
function openEntryForCurrentDailyDate() {
  const targetDate = STATE.selectedDailyDate;
  const entry = STATE.entries.find(e => isSameDate(e.date, targetDate));

  if (entry) {
    populateFormWithEntry(entry);
  } else {
    clearFormInputs();
    setFormDateFromStandardString(targetDate);
  }

  switchTab('entry');
}

/**
 * Quick date offset for form (0 = today, -1 = yesterday)
 */
function setFormDateOffset(offset) {
  const d = new Date();
  if (offset !== 0) d.setDate(d.getDate() + offset);

  const iso = d.toISOString().slice(0, 10);
  const input = document.getElementById('form-shift-date');
  if (input) input.value = iso;

  const btnToday = document.getElementById('form-btn-today');
  const btnYest = document.getElementById('form-btn-yesterday');

  if (offset === 0) {
    btnToday?.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
    btnToday?.classList.remove('text-gray-300');
    btnYest?.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
    btnYest?.classList.add('text-gray-300');
  } else {
    btnYest?.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
    btnYest?.classList.remove('text-gray-300');
    btnToday?.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
    btnToday?.classList.add('text-gray-300');
  }

  const standardDate = getStandardDateString(d);
  const existing = STATE.entries.find(e => isSameDate(e.date, standardDate));
  if (existing) {
    populateFormWithEntry(existing);
  } else {
    clearInputFieldsOnly();
  }
}

function setFormDateFromStandardString(standardStr) {
  const parts = standardStr.split('-');
  if (parts.length === 3) {
    const months = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };
    const m = months[parts[1].toLowerCase()] || '01';
    const day = parts[0].padStart(2, '0');
    const iso = `${parts[2]}-${m}-${day}`;
    const input = document.getElementById('form-shift-date');
    if (input) input.value = iso;
  }
}

function populateFormWithEntry(item) {
  STATE.editingRowIndex = item.rowIndex || null;
  setFormDateFromStandardString(item.date);

  setInputValue('in-rapido', item.rapido || '');
  setInputValue('in-uber', item.uber || '');
  setInputValue('in-ola', item.ola || '');
  setInputValue('in-bharat', item.bharatTaxi || '');
  setInputValue('in-cng', item.cng || '');
  setInputValue('in-pass', item.onlinePass || '');
  setInputValue('in-km', item.km || '');
  setInputValue('in-trips', item.totalTrip || '');
  setInputValue('in-active', item.activeTime || '');

  const label = document.getElementById('btn-save-label');
  if (label) label.textContent = 'Update Shift Record';

  updateLiveCalculations();
}

function clearFormInputs() {
  STATE.editingRowIndex = null;
  clearInputFieldsOnly();
  setFormDateOffset(0);
  const label = document.getElementById('btn-save-label');
  if (label) label.textContent = 'Save Shift Record';
  updateLiveCalculations();
}

function clearInputFieldsOnly() {
  ['in-rapido', 'in-uber', 'in-ola', 'in-bharat', 'in-cng', 'in-pass', 'in-km', 'in-trips', 'in-active'].forEach(id => {
    setInputValue(id, '');
  });
  updateLiveCalculations();
}

function updateLiveCalculations() {
  const rapido = parseNumVal('in-rapido');
  const uber = parseNumVal('in-uber');
  const ola = parseNumVal('in-ola');
  const bharat = parseNumVal('in-bharat');
  const cng = parseNumVal('in-cng');
  const pass = parseNumVal('in-pass');
  const km = parseNumVal('in-km');

  const totalEarn = rapido + uber + ola + bharat;
  const totalExp = cng + pass;
  const profit = totalEarn - totalExp;
  const rate = km > 0 ? (profit / km).toFixed(2) : '0.00';

  setText('live-form-earn', `₹${formatINR(totalEarn)}`);
  setText('live-form-exp', `₹${formatINR(totalExp)}`);
  setText('live-form-profit', (profit >= 0 ? '+' : '') + `₹${formatINR(profit)}`);
  setText('live-form-rate', `₹${rate} / KM`);
}

/**
 * Handle Shift Submit (Saves to Google Sheets via Apps Script)
 */
async function handleMobileSubmit(e) {
  e.preventDefault();
  hapticFeedback(40);

  const saveBtn = document.getElementById('btn-save-shift');
  const saveLabel = document.getElementById('btn-save-label');
  if (saveBtn) saveBtn.disabled = true;
  if (saveLabel) saveLabel.textContent = 'Saving...';

  const dateVal = document.getElementById('form-shift-date').value;
  const standardDate = dateVal ? getStandardDateString(new Date(dateVal)) : getStandardDateString(new Date());

  const rapido = parseNumVal('in-rapido');
  const uber = parseNumVal('in-uber');
  const ola = parseNumVal('in-ola');
  const bharat = parseNumVal('in-bharat');
  const cng = parseNumVal('in-cng');
  const pass = parseNumVal('in-pass');
  const km = parseNumVal('in-km');
  const trips = parseInt(document.getElementById('in-trips')?.value, 10) || 0;
  const activeTime = (document.getElementById('in-active')?.value || '0H').trim();

  const totalEarn = rapido + uber + ola + bharat;
  const totalExp = cng + pass;
  const profit = totalEarn - totalExp;
  const pKm = km > 0 ? parseFloat((profit / km).toFixed(2)) : 0;
  const hrs = extractHoursNum(activeTime);
  const pHr = hrs > 0 ? parseFloat((profit / hrs).toFixed(2)) : 0;

  const existingIdx = STATE.entries.findIndex(entry => isSameDate(entry.date, standardDate));
  const isUpdate = existingIdx !== -1;
  const rowIndex = isUpdate ? STATE.entries[existingIdx].rowIndex : (STATE.entries.length > 0 ? (Math.max(...STATE.entries.map(e => e.rowIndex || 0)) + 1) : 2);

  const entryRecord = {
    rowIndex: rowIndex,
    date: standardDate,
    rapido: rapido,
    uber: uber,
    ola: ola,
    bharatTaxi: bharat,
    totalEarning: totalEarn,
    cng: cng,
    onlinePass: pass,
    totalExpense: totalExp,
    dailyProfit: profit,
    km: km,
    totalTrip: trips,
    activeTime: activeTime,
    profitPerKm: pKm,
    profitPerHr: pHr
  };

  if (isUpdate) {
    STATE.entries[existingIdx] = entryRecord;
  } else {
    STATE.entries.unshift(entryRecord);
  }

  saveLocalStore();

  // Forward directly to Google Apps Script
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: isUpdate ? 'updateEntry' : 'addEntry',
        ...entryRecord
      })
    });

    if (res.ok) {
      showMobileToast('Shift saved to Google Sheets!', 'success');
    } else {
      showMobileToast('Saved to device storage.', 'warning');
    }
  } catch (err) {
    showMobileToast('Saved to device storage.', 'warning');
  }

  STATE.selectedDailyDate = standardDate;
  const savedParts = parseEntryDateParts(standardDate);
  if (savedParts) STATE.selectedMonth = savedParts.yearMonth;
  renderMonthlyView();

  if (saveBtn) saveBtn.disabled = false;
  if (saveLabel) saveLabel.textContent = 'Save Shift Record';

  switchTab('today');
}

/**
 * Render Daily History Stream (Passbook format)
 */
function renderHistoryStream() {
  const container = document.getElementById('history-card-stream');
  const emptyState = document.getElementById('history-empty-state');
  const countBadge = document.getElementById('history-total-count');

  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${STATE.entries.length} shifts recorded`;
  }

  if (STATE.entries.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  let html = '';
  STATE.entries.forEach(item => {
    const profit = item.dailyProfit || 0;
    const isProfitable = profit >= 0;
    const profitColor = isProfitable ? 'text-emerald-400' : 'text-red-400';
    const profitSign = isProfitable ? '+' : '';

    html += `
      <div class="mobile-card p-4 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isProfitable ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            <span class="font-bold text-white text-sm">${item.date}</span>
          </div>
          <span class="text-base font-black ${profitColor}">
            ${profitSign}₹${formatINR(profit)}
          </span>
        </div>

        <div class="flex items-center justify-between text-xs text-gray-400 pt-1">
          <span>Earned: <b class="text-white">₹${formatINR(item.totalEarning || 0)}</b></span>
          <span>•</span>
          <span>Fuel/Pass: <b class="text-red-400">₹${formatINR(item.totalExpense || 0)}</b></span>
          <span>•</span>
          <span><b class="text-gray-200">${item.km || 0} KM</b></span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-bold">
          ${item.rapido ? `<span class="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">R: ₹${item.rapido}</span>` : ''}
          ${item.uber ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">U: ₹${item.uber}</span>` : ''}
          ${item.ola ? `<span class="px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-400 border border-lime-500/20">O: ₹${item.ola}</span>` : ''}
          ${item.bharatTaxi ? `<span class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">B: ₹${item.bharatTaxi}</span>` : ''}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
          <span class="text-gray-400 font-medium">Rate: <b class="text-amber-400">₹${item.profitPerKm || 0}</b>/km</span>
          <div class="flex items-center gap-1.5">
            <button onclick="viewDailyDate('${item.date}')" class="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 active:scale-95 text-[11px] font-bold">
              View
            </button>
            <button onclick="editShiftRecord(${item.rowIndex})" class="px-2.5 py-1 rounded-md bg-gray-900 border border-gray-700 text-gray-300 active:scale-95 text-[11px] font-semibold">
              Edit
            </button>
            <button onclick="deleteShiftRecord(${item.rowIndex})" class="px-2 py-1 rounded-md bg-red-950/40 border border-red-900/50 text-red-400 active:scale-95 text-[11px] font-semibold">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function viewDailyDate(dateStr) {
  hapticFeedback(10);
  STATE.selectedDailyDate = dateStr;
  switchTab('today');
}

function editShiftRecord(rowIndex) {
  const item = STATE.entries.find(e => e.rowIndex === rowIndex);
  if (!item) return;
  populateFormWithEntry(item);
  switchTab('entry');
}

async function deleteShiftRecord(rowIndex) {
  if (!confirm('Are you sure you want to delete this shift entry?')) return;
  hapticFeedback(20);

  STATE.entries = STATE.entries.filter(e => e.rowIndex !== rowIndex);
  saveLocalStore();

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteEntry', rowIndex })
    });
  } catch (e) {}

  renderDailyView();
  renderMonthlyView();
  renderHistoryStream();
  showMobileToast('Shift record deleted.', 'warning');
}

/**
 * Fetch latest data from Google Apps Script
 */
async function fetchLatestData(isSilent = false) {
  const spinner = document.getElementById('refresh-spinner');
  if (spinner) spinner.classList.add('animate-spin');

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getData&_t=${Date.now()}`);
    if (!res.ok) throw new Error('Network error');
    
    const json = await res.json();
    if (json && json.status === 'success' && Array.isArray(json.data)) {
      STATE.entries = json.data;
      saveLocalStore();
      updateStatusHeader(true, 'Live');

      const hasCurrent = STATE.entries.some(e => isSameDate(e.date, STATE.selectedDailyDate));
      if (!hasCurrent && STATE.entries.length > 0 && STATE.entries[0].date) {
        STATE.selectedDailyDate = STATE.entries[0].date;
      }

      const hasCurrentMonth = STATE.entries.some(e => {
        const parts = parseEntryDateParts(e.date);
        return parts && parts.yearMonth === STATE.selectedMonth;
      });
      if (!hasCurrentMonth && STATE.entries.length > 0 && STATE.entries[0].date) {
        const latestParts = parseEntryDateParts(STATE.entries[0].date);
        if (latestParts) STATE.selectedMonth = latestParts.yearMonth;
      }

      renderDailyView();
      renderMonthlyView();
      renderHistoryStream();
      if (!isSilent) showMobileToast(`Loaded ${json.data.length} shifts.`, 'success');
    }
  } catch (err) {
    updateStatusHeader(false, 'Offline');
    if (!isSilent) showMobileToast('Working with local data.', 'warning');
  } finally {
    if (spinner) spinner.classList.remove('animate-spin');
  }
}

/**
 * =========================================================================
 * MONTHLY OVERVIEW CONTROLLER
 * =========================================================================
 */

function changeMonthlyOffset(delta) {
  hapticFeedback(10);
  const [yStr, mStr] = (STATE.selectedMonth || getYearMonthString(new Date())).split('-');
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
  STATE.selectedMonth = getYearMonthString(d);
  renderMonthlyView();
}

function onMonthlyPickerChange(val) {
  if (!val || !/^\d{4}-\d{2}$/.test(val)) return;
  hapticFeedback(10);
  STATE.selectedMonth = val;
  renderMonthlyView();
}

function getMonthlyEntries(yearMonth) {
  return STATE.entries.filter(e => {
    const parts = parseEntryDateParts(e.date);
    return parts && parts.yearMonth === yearMonth;
  });
}

function renderMonthlyView() {
  const targetYM = STATE.selectedMonth || getYearMonthString(new Date());
  const [yStr, mStr] = targetYM.split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;

  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthTitle = `${fullMonths[monthIdx] || 'Month'} ${year}`;
  setText('monthly-title-label', monthTitle);

  const picker = document.getElementById('monthly-month-picker');
  if (picker && picker.value !== targetYM) picker.value = targetYM;

  const now = new Date();
  const currentYM = getYearMonthString(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = getYearMonthString(prevMonthDate);

  let subtitle = 'Month Overview';
  if (targetYM === currentYM) subtitle = 'This Month';
  else if (targetYM === prevYM) subtitle = 'Last Month';
  setText('monthly-subtitle-label', subtitle);

  const monthEntries = getMonthlyEntries(targetYM);
  const shiftCount = monthEntries.length;
  setText('monthly-shifts-badge', `${shiftCount} ${shiftCount === 1 ? 'Shift' : 'Shifts'}`);

  let totalEarning = 0;
  let totalExpense = 0;
  let totalKm = 0;
  let totalTrips = 0;
  let totalHours = 0;
  let rapido = 0;
  let uber = 0;
  let ola = 0;
  let bharatTaxi = 0;
  let cng = 0;
  let onlinePass = 0;
  let bestEntry = null;

  monthEntries.forEach(e => {
    const eEarn = Number(e.totalEarning) || 0;
    const eExp = Number(e.totalExpense) || 0;
    const eProfit = (e.dailyProfit !== undefined && e.dailyProfit !== null) ? Number(e.dailyProfit) : (eEarn - eExp);

    totalEarning += eEarn;
    totalExpense += eExp;
    totalKm += Number(e.km) || 0;
    totalTrips += Number(e.totalTrip) || 0;
    totalHours += extractHoursNum(e.activeTime);

    rapido += Number(e.rapido) || 0;
    uber += Number(e.uber) || 0;
    ola += Number(e.ola) || 0;
    bharatTaxi += Number(e.bharatTaxi) || 0;
    cng += Number(e.cng) || 0;
    onlinePass += Number(e.onlinePass) || 0;

    if (!bestEntry || eProfit > ((bestEntry.dailyProfit !== undefined && bestEntry.dailyProfit !== null) ? Number(bestEntry.dailyProfit) : ((Number(bestEntry.totalEarning) || 0) - (Number(bestEntry.totalExpense) || 0)))) {
      bestEntry = e;
    }
  });

  const netProfit = totalEarning - totalExpense;
  const margin = totalEarning > 0 ? Math.round((netProfit / totalEarning) * 100) : 0;
  const avgRate = totalKm > 0 ? (netProfit / totalKm).toFixed(2) : '0.00';
  const avgProfit = shiftCount > 0 ? Math.round(netProfit / shiftCount) : 0;
  const avgEarn = shiftCount > 0 ? Math.round(totalEarning / shiftCount) : 0;
  const hoursFormatted = Number.isInteger(totalHours) ? `${totalHours}H` : `${totalHours.toFixed(1)}H`;

  const heroEl = document.getElementById('monthly-profit-hero');
  if (heroEl) {
    heroEl.textContent = (netProfit >= 0 ? '+' : '-') + `₹${formatINR(Math.abs(netProfit))}`;
    heroEl.className = `text-4xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  }

  setText('monthly-margin-badge', `${margin}% Margin`);
  setText('monthly-earned-val', `₹${formatINR(totalEarning)}`);
  setText('monthly-spent-val', `₹${formatINR(totalExpense)}`);

  setText('monthly-metric-km', formatINR(Math.round(totalKm * 10) / 10));
  setText('monthly-metric-trips', formatINR(totalTrips));
  setText('monthly-metric-hours', hoursFormatted);
  setText('monthly-metric-rate', `₹${avgRate}`);

  const avgProfitEl = document.getElementById('monthly-avg-profit');
  if (avgProfitEl) {
    avgProfitEl.textContent = (avgProfit >= 0 ? '' : '-') + `₹${formatINR(Math.abs(avgProfit))}`;
    avgProfitEl.className = `text-base font-black mt-0.5 block ${avgProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  }
  setText('monthly-avg-earn', `₹${formatINR(avgEarn)}`);

  // Best Day Highlight
  const bestCard = document.getElementById('monthly-best-day-card');
  if (bestEntry && bestCard) {
    STATE.bestDayDate = bestEntry.date;
    const bestProfit = (bestEntry.dailyProfit !== undefined && bestEntry.dailyProfit !== null)
      ? Number(bestEntry.dailyProfit)
      : ((Number(bestEntry.totalEarning) || 0) - (Number(bestEntry.totalExpense) || 0));
    setText('monthly-best-day-date', bestEntry.date);
    setText('monthly-best-day-profit', (bestProfit >= 0 ? '+' : '-') + `₹${formatINR(Math.abs(bestProfit))}`);
    bestCard.classList.remove('hidden');
  } else if (bestCard) {
    STATE.bestDayDate = null;
    bestCard.classList.add('hidden');
  }

  // Platform Breakdown with percentages & progress bars
  setText('monthly-apps-total', `₹${formatINR(totalEarning)} Total`);
  const updatePlatformBar = (key, val) => {
    const pct = totalEarning > 0 ? Math.round((val / totalEarning) * 100) : 0;
    setText(`monthly-breakdown-${key}`, `₹${formatINR(val)}`);
    setText(`monthly-pct-${key}`, `(${pct}%)`);
    const bar = document.getElementById(`monthly-bar-${key}`);
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  };
  updatePlatformBar('rapido', rapido);
  updatePlatformBar('uber', uber);
  updatePlatformBar('ola', ola);
  updatePlatformBar('bharat', bharatTaxi);

  // Expense Breakdown
  setText('monthly-expenses-total', `₹${formatINR(totalExpense)} Total`);
  const cngPct = totalExpense > 0 ? Math.round((cng / totalExpense) * 100) : 0;
  const passPct = totalExpense > 0 ? Math.round((onlinePass / totalExpense) * 100) : 0;
  setText('monthly-breakdown-cng', `₹${formatINR(cng)}`);
  setText('monthly-pct-cng', `${cngPct}% of expenses`);
  setText('monthly-breakdown-pass', `₹${formatINR(onlinePass)}`);
  setText('monthly-pct-pass', `${passPct}% of expenses`);
}

function openMonthlyBestDay() {
  if (!STATE.bestDayDate) return;
  hapticFeedback(10);
  STATE.selectedDailyDate = STATE.bestDayDate;
  switchTab('today');
}

function exportMonthlyCSV() {
  const targetYM = STATE.selectedMonth || getYearMonthString(new Date());
  const monthEntries = getMonthlyEntries(targetYM);
  if (monthEntries.length === 0) {
    showMobileToast('No shifts in this month to export.', 'warning');
    return;
  }

  const headers = ['Date', 'Rapido', 'Uber', 'Ola', 'Bharat Taxi', 'Total Earning', 'CNG', 'Online Pass', 'Total Expense', 'Net Profit', 'KM', 'Trips', 'Active Time', 'Profit/KM'];
  const rows = monthEntries.map(e => [
    `"${e.date || ''}"`, e.rapido || 0, e.uber || 0, e.ola || 0, e.bharatTaxi || 0,
    e.totalEarning || 0, e.cng || 0, e.onlinePass || 0, e.totalExpense || 0,
    e.dailyProfit || 0, e.km || 0, e.totalTrip || 0, `"${e.activeTime || ''}"`, e.profitPerKm || 0
  ]);

  const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const uri = encodeURI(csv);
  const a = document.createElement('a');
  a.href = uri;
  a.download = `cab_monthly_${targetYM}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showMobileToast(`Exported ${monthEntries.length} shifts for ${targetYM}!`, 'success');
}

/**
 * Export history to CSV
 */
function exportHistoryCSV() {
  if (STATE.entries.length === 0) {
    showMobileToast('No shift entries to export.', 'warning');
    return;
  }

  const headers = ['Date', 'Rapido', 'Uber', 'Ola', 'Bharat Taxi', 'Total Earning', 'CNG', 'Online Pass', 'Total Expense', 'Net Profit', 'KM', 'Trips', 'Active Time', 'Profit/KM'];
  const rows = STATE.entries.map(e => [
    `"${e.date || ''}"`, e.rapido || 0, e.uber || 0, e.ola || 0, e.bharatTaxi || 0,
    e.totalEarning || 0, e.cng || 0, e.onlinePass || 0, e.totalExpense || 0,
    e.dailyProfit || 0, e.km || 0, e.totalTrip || 0, `"${e.activeTime || ''}"`, e.profitPerKm || 0
  ]);

  const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const uri = encodeURI(csv);
  const a = document.createElement('a');
  a.href = uri;
  a.download = `cab_shifts_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showMobileToast('CSV downloaded!', 'success');
}

function saveLocalStore() {
  localStorage.setItem('cab_mobile_entries', JSON.stringify(STATE.entries));
}

function updateStatusHeader(connected, text) {
  STATE.isConnected = connected;
  const dot = document.getElementById('header-status-dot');
  const txt = document.getElementById('header-status-text');
  if (dot) dot.className = 'status-dot-pulse ' + (connected ? 'connected' : 'demo');
  if (txt) txt.textContent = text;
}

function showMobileToast(msg, type = 'success') {
  const box = document.getElementById('mobile-toast-box');
  if (!box) return;

  const t = document.createElement('div');
  t.className = `mobile-toast ${type}`;
  let icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';
  if (type === 'warning') icon = 'alert-triangle';

  t.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
    <span>${msg}</span>
  `;
  box.appendChild(t);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    t.style.transition = 'opacity 0.25s, transform 0.25s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    setTimeout(() => t.remove(), 250);
  }, 2500);
}

function hapticFeedback(ms = 10) {
  if (navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function parseNumVal(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return 0;
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function formatINR(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function extractHoursNum(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const m = String(str).match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function getStandardDateString(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = ('0' + d.getDate()).slice(-2);
  const m = months[d.getMonth()];
  const y = d.getFullYear();
  return `${day}-${m}-${y}`;
}

function isSameDate(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function getYearMonthString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseEntryDateParts(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  // Match DD-MMM-YYYY (e.g., 23-Nov-2026)
  const dmyAlpha = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmyAlpha) {
    const day = parseInt(dmyAlpha[1], 10);
    const monthIndex = monthMap[dmyAlpha[2].toLowerCase()];
    const year = parseInt(dmyAlpha[3], 10);
    if (monthIndex !== undefined) {
      return {
        year,
        monthIndex,
        day,
        yearMonth: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      };
    }
  }

  // Match YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const monthIndex = parseInt(iso[2], 10) - 1;
    const day = parseInt(iso[3], 10);
    return {
      year,
      monthIndex,
      day,
      yearMonth: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    };
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      monthIndex: parsed.getMonth(),
      day: parsed.getDate(),
      yearMonth: getYearMonthString(parsed)
    };
  }

  return null;
}
