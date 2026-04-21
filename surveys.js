// ═══════════════════════════════════════════════════════════════════════
// Surveys Module — v11.5 Phase 5a/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Developer mode helpers: isDeveloperMode, applyDeveloperModeUI
//   - Main screen: renderSurveys, renderSurveysStats, renderSurveysGrid, buildSurveyCardHTML,
//                  escapeHTML, filterSurveys, updateSurveysBadge, loadQuestionCountsForCards
//   - Results panel: openSurveyResults, _renderResultsAnalysis, _renderResultsIndividual,
//                    exportCurrentResults, exportCurrentResultsPDF
//   - Settings modal: openSurveySettings, buildSSM*, saveSurveySettings, autoManageScheduledSurveys
//   - Date Warning Modal: showDateWarningModal
//   - Questions Manager: openQuestionsManager, loadQuestions, editor, saveQuestion, reorderQuestions
//   - Create/Duplicate/Delete/Export/Import/Preview: full survey CRUD + JSON IO + Preview
//
// Dependencies (globals):
//   - ui-helpers.js:  showToast, showConfirm, showActionModal
//   - admin.html:     ALL_DATA, loadData, _getLogo, _applyDevLogo, _applyCompanyName,
//                     _getCompanyName, _getLicense, openModal, closeModals
//   - supabase.js:    window.DB.Surveys.*
//   - CDN:            Sortable, Quill, DOMPurify, jsPDF, html2canvas
// ═══════════════════════════════════════════════════════════════════════

// ======================================================================
// ===== نظام الاستبيانات — المرحلة 2A: الشاشة الرئيسية =====
// ======================================================================

const SYSTEM_SURVEY_CODES = ['pre_trip','arrival','mashaer','transport','post_trip'];
window._surveysCache = null;
window._surveysResponseCounts = {};
window._surveysSearchQuery = '';

// ====================================================================
// TODO: عند البيع لشركات أخرى، استبدل هذه الدالة بفحص جدول
//       developer_access من Supabase. راجع قسم "ميزات مستقبلية مطلوبة"
//       في CLAUDE.md > "نظام المطور العالمي" للتفاصيل الكاملة.
// ====================================================================
function isDeveloperMode() {
  const user = window._currentUser || {};
  if (user.username === '1057653261' || user.role === 'superadmin') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1') return true;
  } catch (e) {}
  return false;
}

function applyDeveloperModeUI() {
  const devMode = isDeveloperMode();
  const importBtn = document.getElementById('surveys-import-btn');
  if (importBtn) importBtn.style.display = devMode ? '' : 'none';
  const devBadge = document.getElementById('surveys-dev-badge');
  if (devBadge) devBadge.style.display = devMode ? 'inline-flex' : 'none';
}

function isSystemSurvey(survey) {
  return survey && SYSTEM_SURVEY_CODES.indexOf(survey.code) !== -1;
}

function getSurveyStatus(s) {
  const now = new Date();
  if (!s.active) return 'inactive';
  if (s.start_date && new Date(s.start_date) > now) return 'scheduled';
  if (s.end_date && new Date(s.end_date) < now) return 'expired';
  return 'active';
}

function _formatScheduleInfo(s) {
  if (!s.active) return '';
  const start = s.start_date ? new Date(s.start_date) : null;
  const end = s.end_date ? new Date(s.end_date) : null;
  if (!start && !end) return '';
  const now = new Date();
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getDate()} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (start && now < start) {
    return `<span class="schedule-badge schedule-upcoming">⏰ يبدأ: ${fmt(start)}</span>`;
  }
  if (end && now > end) {
    return `<span class="schedule-badge schedule-ended">✓ انتهى: ${fmt(end)}</span>`;
  }
  if (end) {
    const diffMs = end - now;
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (hours <= 24) {
      return `<span class="schedule-badge schedule-active">🔥 ينتهي خلال ${hours} ساعة</span>`;
    }
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `<span class="schedule-badge schedule-active">📅 ينتهي بعد ${days} يوم</span>`;
  }
  return '';
}

function getSurveyStatusLabel(status) {
  return {
    active: 'مفعّل',
    inactive: 'متوقف',
    scheduled: 'مجدول',
    expired: 'منتهي'
  }[status] || status;
}

function getRepeatLabel(repeatType) {
  return {
    once: 'مرة واحدة',
    daily: 'يومي',
    weekly: 'أسبوعي'
  }[repeatType] || repeatType || 'مرة واحدة';
}

async function renderSurveys() {
  const grid = document.getElementById('surveys-grid');
  const statsBar = document.getElementById('surveys-stats-bar');
  if (!grid || !statsBar) return;

  // حالة تحميل
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">⏳ جارٍ التحميل...</div>';
  statsBar.innerHTML = '';

  try {
    const [surveys, counts] = await Promise.all([
      window.DB.Surveys.getAll(),
      window.DB.Surveys.getAllResponseCountsBySurvey()
    ]);
    window._surveysCache = surveys;
    window._surveysResponseCounts = counts;
    await autoManageScheduledSurveys();
    renderSurveysStats();
    renderSurveysGrid();
    updateSurveysBadge();
    loadQuestionCountsForCards();
    applyDeveloperModeUI();
  } catch (e) {
    grid.innerHTML = '<div class="surveys-empty"><div class="se-ico">⚠️</div><div class="se-title">خطأ في التحميل</div><div class="se-desc">' + (e.message || 'حاول مرة أخرى') + '</div></div>';
  }
}

function renderSurveysStats() {
  const surveys = window._surveysCache || [];
  const counts = window._surveysResponseCounts || {};
  const total = surveys.length;
  const active = surveys.filter(s => s.active).length;
  const totalResponses = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPilgrims = (typeof ALL_DATA !== 'undefined' && ALL_DATA.length) ? ALL_DATA.length : 0;
  const participation = (totalPilgrims && totalResponses) ? Math.round((totalResponses / (totalPilgrims * Math.max(1, active))) * 100) : 0;

  const statsBar = document.getElementById('surveys-stats-bar');
  statsBar.innerHTML = `
    <div class="sv-stat c1"><span class="sv-ico">📋</span><div class="sv-num">${total}</div><div class="sv-lbl">إجمالي الاستبيانات</div></div>
    <div class="sv-stat c2"><span class="sv-ico">✅</span><div class="sv-num">${active}</div><div class="sv-lbl">الاستبيانات المفعّلة</div></div>
    <div class="sv-stat c3"><span class="sv-ico">💬</span><div class="sv-num">${totalResponses}</div><div class="sv-lbl">إجمالي الإجابات</div></div>
    <div class="sv-stat c4"><span class="sv-ico">📊</span><div class="sv-num">${participation}%</div><div class="sv-lbl">نسبة المشاركة</div></div>
  `;
}

function renderSurveysGrid() {
  const grid = document.getElementById('surveys-grid');
  const q = (window._surveysSearchQuery || '').toLowerCase().trim();
  let list = window._surveysCache || [];
  if (q) {
    list = list.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q)
    );
  }
  if (!list.length) {
    grid.innerHTML = `
      <div class="surveys-empty" style="grid-column:1/-1">
        <div class="se-ico">${q ? '🔍' : '📋'}</div>
        <div class="se-title">${q ? 'لا توجد نتائج' : 'لا توجد استبيانات بعد'}</div>
        <div class="se-desc">${q ? 'جرّب كلمة بحث أخرى' : 'أنشئ استبيانك الأول للبدء'}</div>
      </div>`;
    return;
  }
  const counts = window._surveysResponseCounts || {};
  const totalPilgrims = (typeof ALL_DATA !== 'undefined' && ALL_DATA.length) ? ALL_DATA.length : 0;
  grid.innerHTML = list.map(s => buildSurveyCardHTML(s, counts[s.id] || 0, totalPilgrims)).join('');
}

function buildSurveyCardHTML(s, responseCount, totalPilgrims) {
  const status = getSurveyStatus(s);
  const isSystem = isSystemSurvey(s);
  const iconClass = isSystem ? ('ic-' + s.code) : 'ic-custom';
  const progress = totalPilgrims ? Math.min(100, Math.round((responseCount / totalPilgrims) * 100)) : 0;
  const hasResponses = responseCount > 0;
  const icon = s.icon || '📋';
  const title = escapeHTML(s.title || 'استبيان');
  const desc = escapeHTML(s.description || '');

  return `
    <div class="survey-card" data-id="${s.id}">
      <div class="sc-top">
        <div class="sc-icon-circle ${iconClass}">${icon}</div>
        <div class="sc-head">
          <div class="sc-title">
            ${title}
            <span class="sc-badge st-${status}">${getSurveyStatusLabel(status)}</span>
            ${isSystem ? '<span class="sc-badge st-system">نظامي</span>' : ''}
          </div>
          ${desc ? `<div class="sc-desc">${desc}</div>` : ''}
          ${_formatScheduleInfo(s)}
        </div>
      </div>

      <div class="sc-mini-stats">
        <span class="sc-stat-item">📝 <span class="sc-stat-val" id="sc-q-${s.id}">—</span> سؤال</span>
        <span class="sc-stat-item">💬 <span class="sc-stat-val">${responseCount}</span> إجابة</span>
        <span class="sc-stat-item">🔁 ${getRepeatLabel(s.repeat_type)}</span>
      </div>

      <div>
        <div class="sc-progress-label">نسبة المشاركة: ${progress}%${totalPilgrims ? ` (${responseCount}/${totalPilgrims})` : ''}</div>
        <div class="sc-progress"><div class="sc-progress-fill" style="width:${progress}%"></div></div>
      </div>

      <div class="sc-actions">
        <button class="sc-action" onclick="previewSurvey(${s.id})" title="معاينة">👁️ معاينة</button>
        <button class="sc-action" onclick="openSurveySettings(${s.id})" title="إعدادات">⚙️</button>
        <button class="sc-action" onclick="openQuestionsManager(${s.id})" title="الأسئلة">📝 الأسئلة</button>
        <button class="sc-action ${hasResponses ? '' : 'disabled'}" onclick="${hasResponses ? `openSurveyResults(${s.id})` : `showToast('لا توجد إجابات بعد','info')`}" title="النتائج">📊</button>
        <button class="sc-action more" onclick="openSurveyMoreMenu(event, ${s.id})" title="المزيد">⋮</button>
      </div>
    </div>`;
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function filterSurveys(query) {
  window._surveysSearchQuery = query || '';
  renderSurveysGrid();
}

function updateSurveysBadge() {
  const badge = document.getElementById('surveys-badge');
  if (!badge) return;
  const surveys = window._surveysCache || [];
  const active = surveys.filter(s => s.active).length;
  badge.textContent = active;
  badge.classList.toggle('empty', active === 0);
}

// ===== تحميل عدد الأسئلة لكل استبيان (بشكل بطيء بعد الرسم) =====
async function loadQuestionCountsForCards() {
  const surveys = window._surveysCache || [];
  for (const s of surveys) {
    try {
      const qs = await window.DB.Surveys.getQuestions(s.id);
      const el = document.getElementById('sc-q-' + s.id);
      if (el) el.textContent = qs.length;
    } catch (e) {}
  }
}

// ======================================================================
// ===== نظام الاستبيانات — المرحلة 4: لوحة النتائج =====
// ======================================================================

window._currentResultsSurvey = null;
window._currentResultsMode = 'analysis';
window._currentResultsData = { questions: [], responses: [] };

async function openSurveyResults(id) {
  const survey = (window._surveysCache || []).find(s => s.id === id);
  if (!survey) { showToast('الاستبيان غير موجود', 'error'); return; }

  window._currentResultsSurvey = survey;
  window._currentResultsMode = 'analysis';
  window._currentResultsData = { questions: [], responses: [] };

  // ضمان توفر ALL_DATA (لحساب معدل المشاركة)
  if (typeof ALL_DATA !== 'undefined' && !ALL_DATA.length) {
    try { await loadData(); } catch (e) {}
  }

  // تحديث header فوراً (قبل جلب البيانات)
  document.getElementById('results-emoji').textContent = survey.icon || survey.emoji || '📋';
  document.getElementById('results-survey-title').textContent = survey.title || '—';
  document.getElementById('results-count').textContent = '... جارٍ التحميل';
  document.getElementById('results-participation').textContent = '...';
  document.getElementById('results-avg-rating-wrap').style.display = 'none';
  document.getElementById('results-last-wrap').style.display = 'none';
  _setResultsTab('analysis');
  document.getElementById('results-body').innerHTML = '<div class="results-loading">⏳ جارٍ تحميل النتائج...</div>';
  document.getElementById('survey-results-modal').style.display = 'flex';

  try {
    const [questions, responses] = await Promise.all([
      window.DB.Surveys.getQuestions(id),
      window.DB.Surveys.getResponses(id)
    ]);
    window._currentResultsData = { questions, responses };
    _updateResultsHeader();
    _renderCurrentResultsMode();
  } catch (e) {
    console.error(e);
    document.getElementById('results-body').innerHTML = '<div class="results-empty"><div class="re-ico">⚠️</div><div class="re-title">خطأ في التحميل</div><div class="re-desc">' + (e.message || '') + '</div></div>';
  }
}

function closeSurveyResults() {
  document.getElementById('survey-results-modal').style.display = 'none';
  window._currentResultsSurvey = null;
  window._currentResultsData = { questions: [], responses: [] };
}

function _updateResultsHeader() {
  const { questions, responses } = window._currentResultsData;
  const totalPilgrims = (typeof ALL_DATA !== 'undefined' && ALL_DATA.length) ? ALL_DATA.length : 0;
  const pct = totalPilgrims ? Math.round((responses.length / totalPilgrims) * 100) : 0;

  document.getElementById('results-count').textContent = `${responses.length} إجابة`;
  document.getElementById('results-participation').textContent = totalPilgrims ? `${pct}% مشاركة (${responses.length}/${totalPilgrims})` : `${responses.length} إجابة`;

  // متوسط تقييم (إذا فيه أسئلة rating)
  const ratingQs = questions.filter(q => q.question_type === 'rating');
  if (ratingQs.length && responses.length) {
    let sum = 0, cnt = 0;
    for (const r of responses) {
      if (!r.answers) continue;
      for (const q of ratingQs) {
        const v = Number(r.answers[q.id]);
        if (v >= 1 && v <= 5) { sum += v; cnt++; }
      }
    }
    if (cnt) {
      document.getElementById('results-avg-rating').textContent = (sum / cnt).toFixed(1);
      document.getElementById('results-avg-rating-wrap').style.display = '';
    }
  }

  // آخر إجابة
  if (responses.length) {
    const last = new Date(responses[0].submitted_at);
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('results-last-date').textContent = `${pad(last.getDate())}/${pad(last.getMonth()+1)}/${last.getFullYear()}`;
    document.getElementById('results-last-wrap').style.display = '';
  }
}

function _setResultsTab(mode) {
  document.getElementById('results-tab-analysis').classList.toggle('active', mode === 'analysis');
  document.getElementById('results-tab-individual').classList.toggle('active', mode === 'individual');
}

function switchResultsMode(mode) {
  window._currentResultsMode = mode;
  _setResultsTab(mode);
  _renderCurrentResultsMode();
}

function _renderCurrentResultsMode() {
  const mode = window._currentResultsMode;
  if (mode === 'individual') _renderResultsIndividual();
  else _renderResultsAnalysis();
}

function _renderResultsAnalysis() {
  const { questions, responses } = window._currentResultsData;
  const body = document.getElementById('results-body');
  if (!responses.length) {
    body.innerHTML = '<div class="results-empty"><div class="re-ico">📭</div><div class="re-title">لا توجد إجابات بعد</div><div class="re-desc">ستظهر النتائج عندما يبدأ الحجاج بالإجابة</div></div>';
    return;
  }
  if (!questions.length) {
    body.innerHTML = '<div class="results-empty"><div class="re-ico">📝</div><div class="re-title">لا توجد أسئلة</div></div>';
    return;
  }
  body.innerHTML = questions.map((q, i) => _buildQuestionAnalysisHTML(q, responses, i + 1)).join('');
}

function _buildQuestionAnalysisHTML(q, responses, idx) {
  const type = q.question_type;
  const qText = escapeHTML(q.question_text || '');
  const answers = responses
    .map(r => r.answers ? r.answers[q.id] : null)
    .filter(a => a !== null && a !== undefined && a !== '');

  const typeLabel = { rating:'⭐ تقييم', single:'🔘 اختيار واحد', multiple:'☑️ متعدد', text:'📝 نص حر' }[type] || type;

  let body = '';
  if (!answers.length) {
    body = '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:12px">لم يُجَب بعد</div>';
  } else if (type === 'rating') {
    const nums = answers.map(Number).filter(n => n >= 1 && n <= 5);
    const avg = nums.length ? (nums.reduce((s,n)=>s+n,0) / nums.length) : 0;
    const dist = [0,0,0,0,0];
    nums.forEach(n => { dist[n-1]++; });
    const avgRound = Math.round(avg);
    body = `
      <div class="rating-summary">
        <div class="rating-avg">
          <div class="big-number">${avg.toFixed(1)}</div>
          <div class="stars-display">${'★'.repeat(avgRound)}${'☆'.repeat(5-avgRound)}</div>
          <div class="total-votes">${nums.length} تقييم</div>
        </div>
        <div class="rating-bars">
          ${[5,4,3,2,1].map(star => {
            const cnt = dist[star-1];
            const p = nums.length ? Math.round((cnt/nums.length)*100) : 0;
            return `<div class="rating-bar-row"><div class="rb-label">${star} ★</div><div class="rb-bar"><div class="rb-fill" style="width:${p}%"></div></div><div class="rb-count">${p}% (${cnt})</div></div>`;
          }).join('')}
        </div>
      </div>`;
  } else if (type === 'single') {
    const counts = {};
    answers.forEach(a => { const k = String(a); counts[k] = (counts[k]||0) + 1; });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    body = `<div class="options-analysis">${
      sorted.map(([opt, cnt]) => {
        const p = Math.round((cnt/answers.length)*100);
        return `<div class="option-analysis-row"><div class="oa-label">${escapeHTML(opt)}</div><div class="oa-bar"><div class="oa-fill" style="width:${p}%"></div></div><div class="oa-count">${p}% (${cnt})</div></div>`;
      }).join('')
    }</div>`;
  } else if (type === 'multiple') {
    const counts = {};
    answers.forEach(ans => {
      if (Array.isArray(ans)) ans.forEach(v => { const k = String(v); counts[k] = (counts[k]||0) + 1; });
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    body = `<div class="options-analysis">${
      sorted.map(([opt, cnt]) => {
        const p = Math.round((cnt/answers.length)*100);
        return `<div class="option-analysis-row"><div class="oa-label">${escapeHTML(opt)}</div><div class="oa-bar multi"><div class="oa-fill" style="width:${p}%"></div></div><div class="oa-count">${p}% (${cnt})</div></div>`;
      }).join('')
    }</div>`;
  } else { // text
    const MAX_SHOW = 20;
    const shown = answers.slice(0, MAX_SHOW);
    body = `<div class="text-responses">${
      shown.map(a => `<div class="text-response-item">"${escapeHTML(String(a))}"</div>`).join('')
    }${answers.length > MAX_SHOW ? `<div class="more-responses">+ ${answers.length - MAX_SHOW} إجابة أخرى</div>` : ''}</div>`;
  }

  return `
    <div class="question-analysis">
      <div class="qa-header">
        <div class="qa-number">${idx}</div>
        <div class="qa-title">${qText}</div>
        <div class="qa-type-badge ${type}">${typeLabel}</div>
      </div>
      ${body}
    </div>`;
}

function _renderResultsIndividual() {
  const { questions, responses } = window._currentResultsData;
  const survey = window._currentResultsSurvey || {};
  const body = document.getElementById('results-body');
  if (!responses.length) {
    body.innerHTML = '<div class="results-empty"><div class="re-ico">📭</div><div class="re-title">لا توجد إجابات بعد</div></div>';
    return;
  }
  const isAnon = !!survey.anonymous;
  const pad = n => String(n).padStart(2, '0');

  body.innerHTML = '<div class="individual-responses">' + responses.map(r => {
    const d = new Date(r.submitted_at);
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const name = isAnon ? '👤 حاج (مجهول)' : `👤 ${escapeHTML(r.pilgrim_name || '—')}`;
    const booking = !isAnon && r.pilgrim_booking ? `<div class="ir-booking">حجز: ${escapeHTML(String(r.pilgrim_booking))}</div>` : '';
    const rows = questions.map((q, i) => {
      const ans = r.answers ? r.answers[q.id] : null;
      let disp = '';
      if (ans === null || ans === undefined || ans === '') disp = '<em style="color:#bbb">لم يُجَب</em>';
      else if (q.question_type === 'rating') {
        const n = Number(ans);
        disp = (n >= 1 && n <= 5) ? ('★'.repeat(n) + '☆'.repeat(5-n)) : escapeHTML(String(ans));
      }
      else if (Array.isArray(ans)) disp = ans.map(x => escapeHTML(String(x))).join('، ');
      else disp = escapeHTML(String(ans));
      return `<div class="ir-answer-row"><div class="ir-q">${i+1}. ${escapeHTML(q.question_text || '')}</div><div class="ir-a">${disp}</div></div>`;
    }).join('');
    return `
      <div class="ir-card">
        <div class="ir-header">
          <div class="ir-name">${name}</div>
          ${booking}
          <div class="ir-date">${dateStr}</div>
        </div>
        ${rows}
      </div>`;
  }).join('') + '</div>';
}

async function exportCurrentResults() {
  try {
    const survey = window._currentResultsSurvey;
    const { questions, responses } = window._currentResultsData;
    if (!survey || !responses.length) {
      showToast('لا توجد إجابات للتصدير', 'info');
      return;
    }
    const isAnon = !!survey.anonymous;
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    let csv = '\uFEFF'; // BOM للعربية

    // Headers
    const headers = ['التاريخ', 'الاسم', 'رقم الحجز'];
    questions.forEach((q, i) => headers.push(`س${i+1}: ${q.question_text || ''}`));
    csv += headers.map(esc).join(',') + '\n';

    // Rows
    const pad = n => String(n).padStart(2, '0');
    responses.forEach(r => {
      const d = new Date(r.submitted_at);
      const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const row = [
        dateStr,
        isAnon ? 'مجهول' : (r.pilgrim_name || ''),
        isAnon ? '' : (r.pilgrim_booking || '')
      ];
      questions.forEach(q => {
        const ans = r.answers ? r.answers[q.id] : '';
        let val = '';
        if (ans === null || ans === undefined) val = '';
        else if (Array.isArray(ans)) val = ans.join('، ');
        else val = String(ans);
        row.push(val);
      });
      csv += row.map(esc).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = String(survey.title || 'survey').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
    a.href = url;
    a.download = `${safeName}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('تم تصدير الملف', 'success');
  } catch (e) {
    console.error(e);
    showToast('فشل التصدير: ' + (e.message || e), 'error');
  }
}

async function exportCurrentResultsPDF() {
  try {
    const survey = window._currentResultsSurvey;
    const data = window._currentResultsData;
    if (!survey || !data || !data.responses || !data.responses.length) {
      showToast('لا توجد إجابات للتصدير', 'info');
      return;
    }
    if (typeof html2canvas === 'undefined' || !window.jspdf) {
      showToast('مكتبات PDF لم تُحمّل — أعد التحميل', 'error');
      return;
    }
    const bodyEl = document.getElementById('results-body');
    if (!bodyEl) { showToast('لم يُعثر على محتوى النتائج', 'error'); return; }

    showToast('⏳ جاري تجهيز PDF...', 'info');

    // ===== بناء صفحة الغلاف off-screen =====
    const companyName = (typeof _getCompanyName === 'function' ? _getCompanyName() : '') || 'بوابة الحاج';
    const license     = (typeof _getLicense === 'function' ? _getLicense() : '') || '';
    const logoHTML    = (typeof _buildPrintLogoHTML === 'function')
                        ? _buildPrintLogoHTML(120)
                        : '<div style="font-size:100px;text-align:center">🕋</div>';
    const totalResponses = data.responses.length;
    const totalQuestions = (data.questions || []).length;
    let _ratingSum = 0, _ratingCount = 0;
    (data.responses || []).forEach(r => {
      (data.questions || []).forEach(q => {
        if (q.question_type === 'rating' && r.answers && r.answers[q.id] != null) {
          const v = parseInt(r.answers[q.id]);
          if (!isNaN(v)) { _ratingSum += v; _ratingCount++; }
        }
      });
    });
    const avgRating = _ratingCount > 0 ? (_ratingSum / _ratingCount).toFixed(1) : null;

    // تقييم لكل سؤال (للنتائج الرئيسية والخلاصة)
    const qRatings = [];
    (data.questions || []).forEach(q => {
      if (q.question_type === 'rating') {
        let s = 0, c = 0;
        (data.responses || []).forEach(r => {
          const a = r.answers && r.answers[q.id];
          if (a != null) {
            const v = parseInt(a);
            if (!isNaN(v)) { s += v; c++; }
          }
        });
        if (c > 0) qRatings.push({ q, avg: s / c, count: c });
      }
    });
    const topRated   = [...qRatings].sort((a, b) => b.avg - a.avg).slice(0, 3);
    const worstRated = [...qRatings].filter(x => x.avg < 4).sort((a, b) => a.avg - b.avg).slice(0, 3);

    // نسبة الإكمال
    let _fullyCompleted = 0;
    (data.responses || []).forEach(r => {
      let ans = 0;
      (data.questions || []).forEach(q => {
        const v = r.answers && r.answers[q.id];
        if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) ans++;
      });
      if (ans === (data.questions || []).length && ans > 0) _fullyCompleted++;
    });
    const completionRate = totalResponses > 0 ? Math.round((_fullyCompleted / totalResponses) * 100) : 0;

    // Escape HTML آمن للاستخدام في innerHTML
    const _esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const surveyTitle = survey.title || 'استبيان';
    const today       = new Date();
    const dateStr     = today.toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

    const _statCard = (value, label, gradient) => `
      <div style="background:${gradient};color:#fff;padding:28px 22px;border-radius:16px;min-width:140px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
        <div style="font-size:40px;font-weight:800;line-height:1">${value}</div>
        <div style="font-size:13px;margin-top:10px;opacity:0.92">${label}</div>
      </div>`;

    const coverEl = document.createElement('div');
    coverEl.setAttribute('dir', 'rtl');
    coverEl.style.cssText = 'position:fixed;top:-9999px;left:0;width:800px;height:1120px;background:#fff;padding:70px 60px;font-family:inherit;color:#3d2000;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between';
    coverEl.innerHTML = `
      <div>
        <div style="text-align:center;margin-top:10px">${logoHTML}</div>
        <div style="text-align:center;margin-top:24px;font-size:30px;font-weight:800">${companyName}</div>
        ${license ? `<div style="text-align:center;margin-top:10px;font-size:14px;color:#888">🏅 ترخيص رقم: ${license}</div>` : ''}
        <div style="height:2px;background:linear-gradient(90deg,transparent,#c8971a,transparent);margin:40px 60px"></div>
        <div style="text-align:center;margin-top:30px">
          <div style="font-size:15px;color:#888">تقرير نتائج الاستبيان</div>
          <div style="font-size:30px;font-weight:800;margin-top:14px;line-height:1.5;padding:0 20px">${surveyTitle}</div>
        </div>
        <div style="display:flex;justify-content:center;gap:20px;margin:40px 0">
          ${_statCard(totalResponses, 'عدد المستجيبين', 'linear-gradient(135deg,#b91c1c 0%,#991b1b 100%)')}
          ${_statCard(totalQuestions, 'عدد الأسئلة',     'linear-gradient(135deg,#c8971a 0%,#a67d10 100%)')}
          ${avgRating ? _statCard(avgRating, '⭐ متوسط التقييم', 'linear-gradient(135deg,#059669 0%,#047857 100%)') : ''}
        </div>
        <div style="height:1px;background:#eee;margin:20px 100px"></div>
        <div style="text-align:center;margin-top:18px">
          <div style="font-size:13px;color:#888">تاريخ التقرير</div>
          <div style="font-size:16px;font-weight:700;color:#3d2000;margin-top:6px">${dateStr}</div>
        </div>
      </div>
      <div style="text-align:center;padding-top:24px;border-top:1px solid #eee">
        <div style="font-size:12px;color:#aaa">📋 بوابة الحاج — نظام إدارة الاستبيانات</div>
      </div>
    `;
    document.body.appendChild(coverEl);

    // ===== صفحة 2: النتائج الرئيسية =====
    const _qCard = (rank, question, avg, tone) => {
      const colors = tone === 'good'
        ? { bg:'#f0fdf4', border:'#10b981', rankColor:'#047857', valColor:'#047857' }
        : { bg:'#fef2f2', border:'#ef4444', rankColor:'#991b1b', valColor:'#991b1b' };
      return `
        <div style="display:flex;align-items:center;gap:12px;background:${colors.bg};border-right:4px solid ${colors.border};padding:12px 14px;border-radius:10px;margin-bottom:8px">
          <div style="font-weight:800;color:${colors.rankColor};min-width:22px">${rank}.</div>
          <div style="flex:1;font-size:13px;color:#3d2000;line-height:1.5">${_esc(question)}</div>
          <div style="font-size:17px;font-weight:800;color:${colors.valColor};white-space:nowrap">⭐ ${avg.toFixed(1)}</div>
        </div>`;
    };

    const _kpiCard = (val, label, bg, border, color) => `
      <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:28px;font-weight:800;color:${color};line-height:1">${val}</div>
        <div style="font-size:12px;color:#666;margin-top:6px">${label}</div>
      </div>`;

    const resultsEl = document.createElement('div');
    resultsEl.setAttribute('dir', 'rtl');
    resultsEl.style.cssText = 'position:fixed;top:-9999px;left:0;width:800px;min-height:1120px;background:#fff;padding:60px 50px;font-family:inherit;color:#3d2000;box-sizing:border-box';
    resultsEl.innerHTML = `
      <div style="border-bottom:2px solid #c8971a;padding-bottom:14px;margin-bottom:28px">
        <div style="font-size:12px;color:#999">${_esc(surveyTitle)}</div>
        <div style="font-size:26px;font-weight:800;margin-top:6px">📊 النتائج الرئيسية</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:26px">
        ${_kpiCard(totalResponses, 'عدد المستجيبين', '#fef2f2', '#fecaca', '#991b1b')}
        ${_kpiCard(totalQuestions, 'عدد الأسئلة',   '#fefce8', '#fde68a', '#a67d10')}
        ${avgRating ? _kpiCard('⭐ ' + avgRating, 'متوسط التقييم', '#f0fdf4', '#bbf7d0', '#047857') : ''}
        ${_kpiCard(completionRate + '%', 'نسبة الإكمال',  '#eff6ff', '#bfdbfe', '#1d4ed8')}
      </div>

      ${topRated.length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:15px;font-weight:800;margin-bottom:12px;color:#047857">🏆 أعلى تقييماً</div>
          ${topRated.map((x, i) => _qCard(i + 1, x.q.question_text || '', x.avg, 'good')).join('')}
        </div>
      ` : ''}

      ${worstRated.length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:15px;font-weight:800;margin-bottom:12px;color:#991b1b">📉 بحاجة لتحسين</div>
          ${worstRated.map((x, i) => _qCard(i + 1, x.q.question_text || '', x.avg, 'bad')).join('')}
        </div>
      ` : ''}

      ${qRatings.length === 0 ? `
        <div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:12px;padding:24px;text-align:center;color:#6b7280;font-size:14px">
          لا توجد أسئلة تقييم في هذا الاستبيان لعرض ترتيب الأداء.
        </div>
      ` : ''}
    `;
    document.body.appendChild(resultsEl);

    // ===== الصفحة الأخيرة: الخلاصة والتوصيات =====
    const _recs = [];
    if (avgRating !== null) {
      const a = parseFloat(avgRating);
      if (a >= 4.5)      _recs.push('أداء ممتاز — الحفاظ على مستوى الجودة الحالي ومواصلة قياس رضا المستجيبين دورياً.');
      else if (a >= 4)   _recs.push('أداء جيد جداً — مراجعة النقاط الأقل تقييماً وتعزيزها للوصول للامتياز.');
      else if (a >= 3)   _recs.push('أداء متوسط — يتطلّب مراجعة العمليات وتحسين المحاور الحرجة.');
      else               _recs.push('أداء يحتاج تدخّلاً فورياً — مراجعة شاملة للأسئلة الأقل تقييماً ووضع خطة تصحيحية.');
      if (worstRated.length > 0) {
        const names = worstRated.map(x => '«' + String(x.q.question_text || '').slice(0, 45) + '»').join('، ');
        _recs.push('التركيز بشكل خاص على المحاور التالية: ' + names + '.');
      }
    } else {
      _recs.push('لا توجد أسئلة تقييم لقياس الأداء الكمي — يُنصح بإضافة أسئلة تقييم (1–5) لقياس الرضا في الاستبيانات القادمة.');
    }
    if (completionRate < 80 && totalResponses > 0) {
      _recs.push('نسبة إكمال الاستبيان (' + completionRate + '%) منخفضة — يُنصح بتبسيط الأسئلة أو تقليل عددها لرفع معدّل الإكمال.');
    }
    _recs.push('تكرار الاستبيان دورياً (شهرياً أو بعد كل موسم) لمتابعة التحسّن عبر الزمن.');

    const _sumLines = [
      'أُجري استبيان «' + _esc(surveyTitle) + '» وشارك فيه ' + totalResponses + ' مستجيباً.',
      'اشتمل الاستبيان على ' + totalQuestions + ' ' + (totalQuestions === 1 ? 'سؤال' : 'أسئلة') + ' بنسبة إكمال ' + completionRate + '%.'
    ];
    if (avgRating !== null) _sumLines.push('بلغ متوسط التقييم العام ' + avgRating + ' من 5.');

    const conclusionsEl = document.createElement('div');
    conclusionsEl.setAttribute('dir', 'rtl');
    conclusionsEl.style.cssText = 'position:fixed;top:-9999px;left:0;width:800px;min-height:1120px;background:#fff;padding:60px 50px;font-family:inherit;color:#3d2000;box-sizing:border-box;display:flex;flex-direction:column';
    conclusionsEl.innerHTML = `
      <div style="border-bottom:2px solid #c8971a;padding-bottom:14px;margin-bottom:28px">
        <div style="font-size:12px;color:#999">${_esc(surveyTitle)}</div>
        <div style="font-size:26px;font-weight:800;margin-top:6px">📝 الخلاصة والتوصيات</div>
      </div>

      <div style="background:#fffbf0;border:1px solid #f0e0b0;border-radius:12px;padding:20px;margin-bottom:22px">
        <div style="font-size:15px;font-weight:800;color:#7a4500;margin-bottom:10px">📋 ملخّص النتائج</div>
        ${_sumLines.map(s => '<div style="font-size:14px;line-height:1.9;color:#444;margin-bottom:4px">• ' + s + '</div>').join('')}
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:22px">
        <div style="font-size:15px;font-weight:800;color:#047857;margin-bottom:12px">💡 التوصيات</div>
        ${_recs.map((r, i) => `
          <div style="display:flex;gap:10px;font-size:14px;line-height:1.8;color:#3d2000;margin-bottom:8px">
            <div style="font-weight:800;color:#047857;min-width:18px">${i + 1}.</div>
            <div style="flex:1">${_esc(r)}</div>
          </div>
        `).join('')}
      </div>

      <div style="flex:1"></div>

      <div style="text-align:center;padding-top:24px;border-top:1px solid #eee">
        <div style="font-size:13px;color:#3d2000;font-weight:700">شكراً لكل من شارك في هذا الاستبيان 🙏</div>
        <div style="font-size:11px;color:#aaa;margin-top:6px">📋 بوابة الحاج — نظام إدارة الاستبيانات</div>
      </div>
    `;
    document.body.appendChild(conclusionsEl);

    try {
      const canvasOpts = { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false };
      const coverCanvas      = await html2canvas(coverEl, canvasOpts);
      const resultsCanvas    = await html2canvas(resultsEl, canvasOpts);
      const bodyCanvas       = await html2canvas(bodyEl, Object.assign({}, canvasOpts, {
        windowWidth:  bodyEl.scrollWidth,
        windowHeight: bodyEl.scrollHeight
      }));
      const conclusionsCanvas = await html2canvas(conclusionsEl, canvasOpts);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth  = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const imgWidth = pdfWidth - margin * 2;

      // --- صفحة 1: الغلاف ---
      const coverImg = coverCanvas.toDataURL('image/png');
      const coverH = Math.min((coverCanvas.height * imgWidth) / coverCanvas.width, pdfHeight - margin * 2);
      pdf.addImage(coverImg, 'PNG', margin, margin, imgWidth, coverH);

      // --- صفحة 2: النتائج الرئيسية ---
      pdf.addPage();
      const resultsImg = resultsCanvas.toDataURL('image/png');
      const resultsH = Math.min((resultsCanvas.height * imgWidth) / resultsCanvas.width, pdfHeight - margin * 2);
      pdf.addImage(resultsImg, 'PNG', margin, margin, imgWidth, resultsH);

      // --- صفحات 3+: التحليل التفصيلي ---
      const bodyImg = bodyCanvas.toDataURL('image/png');
      const bodyH = (bodyCanvas.height * imgWidth) / bodyCanvas.width;
      let heightLeft = bodyH;
      let position = margin;
      pdf.addPage();
      pdf.addImage(bodyImg, 'PNG', margin, position, imgWidth, bodyH);
      heightLeft -= (pdfHeight - margin * 2);
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (bodyH - heightLeft);
        pdf.addImage(bodyImg, 'PNG', margin, position, imgWidth, bodyH);
        heightLeft -= (pdfHeight - margin * 2);
      }

      // --- الصفحة الأخيرة: الخلاصة والتوصيات ---
      pdf.addPage();
      const conclusionsImg = conclusionsCanvas.toDataURL('image/png');
      const conclusionsH = Math.min((conclusionsCanvas.height * imgWidth) / conclusionsCanvas.width, pdfHeight - margin * 2);
      pdf.addImage(conclusionsImg, 'PNG', margin, margin, imgWidth, conclusionsH);

      // --- أرقام الصفحات (Latin — آمن عبر jsPDF) ---
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        pdf.text(`${p} / ${totalPages}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
      }

      const safeName = String(survey.title || 'survey').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
      pdf.save(`${safeName}_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('تم تصدير PDF', 'success');
    } finally {
      coverEl.remove();
      resultsEl.remove();
      conclusionsEl.remove();
    }
  } catch (e) {
    console.error(e);
    showToast('فشل التصدير: ' + (e.message || e), 'error');
  }
}

// ======================================================================
// ===== نظام الاستبيانات — المرحلة 2B: نافذة إعدادات الاستبيان =====
// ======================================================================

const EMOJI_PICKER_LIST = ['📋','📝','📊','📈','📉','✅','💬','❓','❗','⭐','🌟','💡','🔔','🎯','📅','🕋','🕌','🏕️','🌙','🌄','🏨','🚌','💉','📞','🎪','🏢','🚸','🩺','🔍','👥'];

window._ssmCurrentId = null;
window._ssmCurrentData = null;
window._ssmModified = false;

// ===== تفعيل/إيقاف تلقائي للاستبيانات المجدولة =====
async function autoManageScheduledSurveys() {
  const surveys = window._surveysCache || [];
  const now = new Date();
  const toDeactivate = [];
  for (const s of surveys) {
    // الاستبيان المفعّل الذي انتهى وقته → إيقاف تلقائي
    if (s.active && s.end_date && new Date(s.end_date) <= now) {
      toDeactivate.push(s);
    }
  }
  for (const s of toDeactivate) {
    try {
      await window.DB.Surveys.update(s.id, { active: false });
      s.active = false;
      showToast(`تم إيقاف استبيان "${s.title}" — انتهت فترة التفعيل`, 'info', 4000);
    } catch (e) {}
  }
}

// ===== فتح نافذة الإعدادات =====
async function openSurveySettings(id) {
  const survey = (window._surveysCache || []).find(s => s.id === id);
  if (!survey) { showToast('لم يُعثر على الاستبيان', 'error'); return; }
  window._ssmCurrentId = id;
  window._ssmCurrentData = { ...survey };
  window._ssmModified = false;

  const container = document.getElementById('ssm-container');
  container.innerHTML = buildSSMHTML(survey);
  document.getElementById('survey-settings-modal').style.display = 'flex';
  switchSurveySettingsTab('general');
  setTimeout(attachSSMListeners, 50);
}

function buildSSMHTML(s) {
  const isSystem = isSystemSurvey(s);
  const iconClass = isSystem ? ('ic-' + s.code) : 'ic-custom';
  return `
    <div class="ssm-header">
      <div class="ssm-icon sc-icon-circle ${iconClass}">${s.icon || '📋'}</div>
      <div class="ssm-title">
        <div>إعدادات الاستبيان</div>
        <div class="ssm-sub">${escapeHTML(s.title)}</div>
      </div>
      <button class="ssm-close" onclick="closeSurveySettings()" title="إغلاق">✕</button>
    </div>
    <div class="ssm-body">
      <div class="ssm-sidebar">
        <button class="ssm-tab-link" data-ssm-tab="general" onclick="switchSurveySettingsTab('general')"><span class="ssm-tab-ico">📝</span> عام</button>
        <button class="ssm-tab-link" data-ssm-tab="schedule" onclick="switchSurveySettingsTab('schedule')"><span class="ssm-tab-ico">📅</span> الجدولة</button>
        <button class="ssm-tab-link" data-ssm-tab="messages" onclick="switchSurveySettingsTab('messages')"><span class="ssm-tab-ico">💬</span> الرسائل</button>
        <button class="ssm-tab-link" data-ssm-tab="advanced" onclick="switchSurveySettingsTab('advanced')"><span class="ssm-tab-ico">⚙️</span> خيارات متقدمة</button>
      </div>
      <div class="ssm-content">
        ${buildSSMPaneGeneral(s, isSystem)}
        ${buildSSMPaneSchedule(s)}
        ${buildSSMPaneMessages(s)}
        ${buildSSMPaneAdvanced(s)}
      </div>
    </div>
    <div class="ssm-footer">
      <span class="ssm-mod-hint" id="ssm-mod-hint"><span class="modified-dot"></span> تعديلات غير محفوظة</span>
      <div class="ssm-btns">
        <button class="ssm-btn secondary" onclick="closeSurveySettings()">إلغاء</button>
        <button class="ssm-btn primary" onclick="saveSurveySettings()">💾 حفظ</button>
      </div>
    </div>`;
}

function buildSSMPaneGeneral(s, isSystem) {
  if (isSystem) {
    return `
      <div class="ssm-pane" data-ssm-pane="general">
        <div class="ssm-system-hint" style="padding:18px 20px">
          <span style="font-size:22px;flex-shrink:0">🔒</span>
          <div>
            <div style="font-weight:800;margin-bottom:6px;font-size:14px">استبيان معياري محمي</div>
            <div style="font-weight:500;line-height:1.7;font-size:12px">
              العنوان والوصف والأيقونة ثابتة من معايير وزارة الحج السعودية — لضمان توحيد التقارير بين شركات الحج.
              <br><br>
              يمكنك تخصيص: <strong>الجدولة، الرسائل، الخيارات المتقدمة</strong> من التبويبات الأخرى.
            </div>
            <button onclick="duplicateFromSettings()" style="margin-top:12px;padding:9px 16px;background:var(--surface);border:1.5px solid var(--gold);border-radius:6px;cursor:pointer;color:var(--gold-dark);font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px;transition:all .15s" onmouseover="this.style.background='var(--gold-light)'" onmouseout="this.style.background='var(--surface)'">
              📋 انسخ هذا الاستبيان لتعديله بحرية
            </button>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="ssm-pane" data-ssm-pane="general">
      <h3>المعلومات الأساسية</h3>
      <div class="ssm-row">
        <label>العنوان</label>
        <input type="text" id="ssm-title" value="${escapeHTML(s.title || '')}">
      </div>
      <div class="ssm-row">
        <label>الوصف</label>
        <textarea id="ssm-description" rows="3">${escapeHTML(s.description || '')}</textarea>
      </div>
      <div class="ssm-row">
        <label>الأيقونة</label>
        ${buildEmojiPickerHTML(s.icon || '📋')}
      </div>
    </div>`;
}

function buildEmojiPickerHTML(selected, prefix) {
  prefix = prefix || 'ssm';
  const cells = EMOJI_PICKER_LIST.map(e =>
    `<div class="emoji-cell${e === selected ? ' selected' : ''}" data-emoji="${e}" onclick="selectEmojiFor('${prefix}','${e}')">${e}</div>`
  ).join('');
  const isCustom = selected && !EMOJI_PICKER_LIST.includes(selected);
  return `
    <div class="emoji-picker">
      <div class="emoji-grid">${cells}</div>
      <div class="emoji-custom">
        <span>أو أدخل emoji مخصّص:</span>
        <input type="text" id="${prefix}-icon-custom" maxlength="4" value="${isCustom ? selected : ''}" oninput="onEmojiCustomInputFor('${prefix}',this.value)">
      </div>
      <input type="hidden" id="${prefix}-icon" value="${selected || '📋'}">
    </div>`;
}

function selectEmojiFor(prefix, e) {
  document.getElementById(prefix + '-icon').value = e;
  const customInput = document.getElementById(prefix + '-icon-custom');
  if (customInput) customInput.value = '';
  // scope to the emoji-picker that contains this prefix's hidden input
  const scope = document.getElementById(prefix + '-icon')?.closest('.emoji-picker');
  const cells = scope ? scope.querySelectorAll('.emoji-cell') : document.querySelectorAll('.emoji-cell');
  cells.forEach(c => c.classList.toggle('selected', c.dataset.emoji === e));
  if (prefix === 'ssm') markSurveyModified();
}

function onEmojiCustomInputFor(prefix, val) {
  if (val) {
    document.getElementById(prefix + '-icon').value = val;
    const scope = document.getElementById(prefix + '-icon')?.closest('.emoji-picker');
    const cells = scope ? scope.querySelectorAll('.emoji-cell') : document.querySelectorAll('.emoji-cell');
    cells.forEach(c => c.classList.remove('selected'));
    if (prefix === 'ssm') markSurveyModified();
  }
}

// Backward-compat wrappers
function selectEmoji(e) { selectEmojiFor('ssm', e); }
function onEmojiCustomInput(val) { onEmojiCustomInputFor('ssm', val); }

function buildSSMPaneSchedule(s) {
  const repeat = s.repeat_type || 'once';
  return `
    <div class="ssm-pane" data-ssm-pane="schedule">
      <h3>حالة التفعيل</h3>
      <div class="activation-box">
        <div class="activation-info">
          <div class="activation-title">تفعيل الاستبيان</div>
          <div class="activation-status" id="ssm-activation-status">${s.active ? '✅ الاستبيان مفعّل حالياً' : '⏸️ الاستبيان متوقف'}</div>
        </div>
        <span class="tgl ${s.active ? 'on' : ''}" onclick="toggleSSMActive(this)">
          <input type="checkbox" ${s.active ? 'checked' : ''} id="ssm-active">
          <span class="tgl-bg"></span><span class="tgl-knob"></span>
        </span>
      </div>

      <h3 style="margin-top:22px">نوع التكرار</h3>
      <div class="radio-cards">
        <div class="radio-card ${repeat === 'once' ? 'selected' : ''}" onclick="selectRepeat('once')" data-repeat="once">
          <div class="rc-ico">1️⃣</div>
          <div class="rc-label">مرة واحدة</div>
          <div class="rc-desc">إجابة واحدة لكل حاج</div>
        </div>
        <div class="radio-card ${repeat === 'daily' ? 'selected' : ''}" onclick="selectRepeat('daily')" data-repeat="daily">
          <div class="rc-ico">📆</div>
          <div class="rc-label">يومي</div>
          <div class="rc-desc">إجابة جديدة كل يوم</div>
        </div>
        <div class="radio-card ${repeat === 'weekly' ? 'selected' : ''}" onclick="selectRepeat('weekly')" data-repeat="weekly">
          <div class="rc-ico">🗓️</div>
          <div class="rc-label">أسبوعي</div>
          <div class="rc-desc">إجابة جديدة كل أسبوع</div>
        </div>
      </div>
      <input type="hidden" id="ssm-repeat-type" value="${repeat}">

      <div id="ssm-schedule-fields">
        <div id="ssm-schedule-disabled-notice" style="display:none;padding:12px 14px;background:#fff3e0;border:1.5px solid #ffb74d;border-radius:8px;color:#e65100;font-size:12px;font-weight:600;margin-top:22px;line-height:1.7">
          ⚠️ الاستبيان متوقف حالياً. فعّل الاستبيان من الأعلى لتتمكن من ضبط الجدولة.
        </div>

        <h3 style="margin-top:22px">فترة التفعيل (تاريخ + ساعة)</h3>

        <div class="ssm-row">
          <label>📅 وقت بداية ظهور الاستبيان</label>
          <div class="datetime-group">
            <input type="date" id="ssm-start-date">
            <input type="time" id="ssm-start-time" value="00:00">
          </div>
          <small class="ssm-hint">اتركه فارغاً لبدء الظهور فوراً عند التفعيل</small>
        </div>

        <div class="ssm-row">
          <label>🏁 وقت نهاية ظهور الاستبيان</label>
          <div class="datetime-group">
            <input type="date" id="ssm-end-date">
            <input type="time" id="ssm-end-time" value="23:59">
          </div>
          <small class="ssm-hint">اتركه فارغاً لعدم وجود انتهاء</small>
        </div>

        <div style="background:#fdf8f0;border:1px solid #f0e0b0;border-radius:8px;padding:12px;margin-top:14px;font-size:12px;color:#6b5a45;line-height:1.6">
          💡 الاستبيان يظهر للحاج فقط في النافذة الزمنية المحددة. قبل وقت البداية أو بعد وقت النهاية، لن يراه الحاج.
        </div>

        <div class="opt-row" style="margin-top:14px">
          <div class="opt-row-text">
            <div class="opt-row-title">تفعيل تلقائي في تاريخ البداية</div>
            <div class="opt-row-desc">يظل الاستبيان غير مرئي للحاج قبل تاريخ البداية حتى لو مفعَّل</div>
          </div>
          <span class="tgl ${s.auto_activate ? 'on' : ''}" onclick="toggleSSMField(this,'ssm-auto-activate')">
            <input type="checkbox" ${s.auto_activate ? 'checked' : ''} id="ssm-auto-activate">
            <span class="tgl-bg"></span><span class="tgl-knob"></span>
          </span>
        </div>
      </div>
    </div>`;
}

function toggleSSMActive(el) {
  const input = document.getElementById('ssm-active');
  input.checked = !input.checked;
  el.classList.toggle('on', input.checked);
  const statusEl = document.getElementById('ssm-activation-status');
  if (statusEl) statusEl.textContent = input.checked ? '✅ الاستبيان مفعّل حالياً' : '⏸️ الاستبيان متوقف';
  _updateScheduleFieldsState(input.checked);
  markSurveyModified();
}

function _updateScheduleFieldsState(isActive) {
  const notice = document.getElementById('ssm-schedule-disabled-notice');
  const fields = ['ssm-start-date','ssm-start-time','ssm-end-date','ssm-end-time','ssm-auto-activate'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isActive;
  });
  // toggle widget للـ auto-activate
  const autoToggle = document.getElementById('ssm-auto-activate')?.closest('.tgl');
  if (autoToggle) {
    autoToggle.style.opacity = isActive ? '1' : '.4';
    autoToggle.style.pointerEvents = isActive ? '' : 'none';
  }
  if (notice) notice.style.display = isActive ? 'none' : 'flex';
}

function toggleSSMField(el, inputId) {
  const input = document.getElementById(inputId);
  input.checked = !input.checked;
  el.classList.toggle('on', input.checked);
  markSurveyModified();
}

function selectRepeat(val) {
  document.getElementById('ssm-repeat-type').value = val;
  document.querySelectorAll('[data-repeat]').forEach(c => c.classList.toggle('selected', c.dataset.repeat === val));
  markSurveyModified();
}

function buildSSMPaneMessages(s) {
  return `
    <div class="ssm-pane" data-ssm-pane="messages">
      <h3>رسائل الاستبيان</h3>
      <div class="ssm-row">
        <label>رسالة الترحيب <span class="ssm-hint">سيشاهدها الحاج قبل بدء الاستبيان</span></label>
        <textarea id="ssm-welcome" rows="3" placeholder="مرحباً بك، نرجو أن تمنحنا دقائق قليلة لتقييم خدماتنا...">${escapeHTML(s.welcome_message || '')}</textarea>
      </div>
      <div class="ssm-row">
        <label>رسالة الشكر <span class="ssm-hint">ستظهر للحاج بعد إرسال إجاباته</span></label>
        <textarea id="ssm-thanks" rows="3" placeholder="شكراً لك على مشاركة رأيك، آراؤك تساعدنا على التحسين...">${escapeHTML(s.thanks_message || '')}</textarea>
      </div>
      <div class="ssm-info-hint">ℹ️ كلا الحقلين اختياري — إذا تُركا فارغَين سيُستخدم النص الافتراضي للنظام</div>
    </div>`;
}

function buildSSMPaneAdvanced(s) {
  const showProgress = s.show_progress !== false;
  return `
    <div class="ssm-pane" data-ssm-pane="advanced">
      <h3>خيارات متقدمة</h3>
      <div class="opt-row">
        <div class="opt-row-text">
          <div class="opt-row-title">إجابات مجهولة</div>
          <div class="opt-row-desc">لا يُحفظ اسم الحاج ولا رقم الحجز مع الإجابة — تقرير مجمّع فقط</div>
        </div>
        <span class="tgl ${s.anonymous ? 'on' : ''}" onclick="toggleSSMField(this,'ssm-anonymous')">
          <input type="checkbox" ${s.anonymous ? 'checked' : ''} id="ssm-anonymous">
          <span class="tgl-bg"></span><span class="tgl-knob"></span>
        </span>
      </div>
      <div class="opt-row">
        <div class="opt-row-text">
          <div class="opt-row-title">إظهار شريط التقدم</div>
          <div class="opt-row-desc">يظهر للحاج مؤشر يوضح موقعه في الاستبيان (السؤال X من Y)</div>
        </div>
        <span class="tgl ${showProgress ? 'on' : ''}" onclick="toggleSSMField(this,'ssm-show-progress')">
          <input type="checkbox" ${showProgress ? 'checked' : ''} id="ssm-show-progress">
          <span class="tgl-bg"></span><span class="tgl-knob"></span>
        </span>
      </div>
      <div class="opt-row">
        <div class="opt-row-text">
          <div class="opt-row-title">السماح بتعديل الإجابة</div>
          <div class="opt-row-desc">يستطيع الحاج الرجوع لاستبيانه وتعديل إجاباته (لا ينطبق على الإجابات المجهولة)</div>
        </div>
        <span class="tgl ${s.allow_edit ? 'on' : ''}" onclick="toggleSSMField(this,'ssm-allow-edit')">
          <input type="checkbox" ${s.allow_edit ? 'checked' : ''} id="ssm-allow-edit">
          <span class="tgl-bg"></span><span class="tgl-knob"></span>
        </span>
      </div>
    </div>`;
}

function switchSurveySettingsTab(tabName) {
  document.querySelectorAll('.ssm-tab-link').forEach(b => b.classList.toggle('active', b.dataset.ssmTab === tabName));
  document.querySelectorAll('.ssm-pane').forEach(p => p.classList.toggle('active', p.dataset.ssmPane === tabName));
}

function markSurveyModified() {
  window._ssmModified = true;
  const hint = document.getElementById('ssm-mod-hint');
  if (hint) hint.classList.add('visible');
}

function attachSSMListeners() {
  document.querySelectorAll('.ssm-content input[type=text], .ssm-content input[type=date], .ssm-content input[type=time], .ssm-content textarea').forEach(el => {
    el.addEventListener('input', markSurveyModified);
    el.addEventListener('change', markSurveyModified);
  });
  // تحميل قيم start_date و end_date (timestamptz) مع فصل التاريخ والوقت
  const s = window._ssmCurrentData || {};
  _loadScheduleFields(s);
  // تطبيق حالة الحقول حسب active
  _updateScheduleFieldsState(!!s.active);
}

function _loadScheduleFields(s) {
  const pad = n => String(n).padStart(2, '0');
  const fillDateTime = (isoStr, dateId, timeId, defaultTime) => {
    const dateEl = document.getElementById(dateId);
    const timeEl = document.getElementById(timeId);
    if (!dateEl || !timeEl) return;
    if (isoStr) {
      const d = new Date(isoStr);
      if (!isNaN(d)) {
        dateEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        timeEl.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return;
      }
    }
    dateEl.value = '';
    timeEl.value = defaultTime;
  };
  fillDateTime(s.start_date, 'ssm-start-date', 'ssm-start-time', '00:00');
  fillDateTime(s.end_date,   'ssm-end-date',   'ssm-end-time',   '23:59');
}

async function closeSurveySettings(force) {
  if (!force && window._ssmModified) {
    const ok = await showConfirm('هناك تعديلات غير محفوظة. هل تريد الإغلاق بدون حفظ؟', 'تأكيد الإغلاق', 'إغلاق بدون حفظ', '#c00', '⚠️');
    if (!ok) return;
  }
  document.getElementById('survey-settings-modal').style.display = 'none';
  window._ssmCurrentId = null;
  window._ssmCurrentData = null;
  window._ssmModified = false;
}

function duplicateFromSettings() {
  const id = window._ssmCurrentId;
  if (!id) return;
  window._ssmModified = false;
  document.getElementById('survey-settings-modal').style.display = 'none';
  const tempId = id;
  window._ssmCurrentId = null;
  window._ssmCurrentData = null;
  setTimeout(() => duplicateSurvey(tempId), 250);
}

// ===== Date Warning Modal =====
// types: 'warning' (أصفر) | 'danger' (أحمر) | 'error' (أحمر قوي، بدون إلغاء افتراضياً)
function showDateWarningModal(opts) {
  return new Promise(resolve => {
    const o = opts || {};
    const type         = o.type || 'warning';
    const defaultIcon  = type === 'error' ? '❌' : type === 'danger' ? '🚨' : '⚠️';
    const title        = o.title || 'تنبيه';
    const description  = o.description || '';
    const details      = o.details || '';
    const note         = o.note || '';
    const confirmLabel = o.confirmLabel || 'متابعة';
    const cancelLabel  = o.cancelLabel || 'إلغاء';
    const showCancel   = (o.showCancel !== undefined) ? o.showCancel : (type !== 'error');

    const overlay = document.createElement('div');
    overlay.className = 'dwm-overlay dwm-' + type;
    overlay.setAttribute('dir', 'rtl');
    overlay.innerHTML = `
      <div class="dwm-container" role="dialog" aria-modal="true">
        <div class="dwm-header">
          <div class="dwm-icon">${defaultIcon}</div>
          <div class="dwm-title">${title}</div>
        </div>
        <div class="dwm-body">
          ${description ? `<div class="dwm-desc">${description}</div>` : ''}
          ${details ? `<div class="dwm-details">${details}</div>` : ''}
          ${note ? `<div class="dwm-note">${note}</div>` : ''}
        </div>
        <div class="dwm-footer">
          ${showCancel ? `<button type="button" class="dwm-btn dwm-btn-cancel">${cancelLabel}</button>` : ''}
          <button type="button" class="dwm-btn dwm-btn-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      document.removeEventListener('keydown', escHandler);
      overlay.remove();
      resolve(result);
    };
    const escHandler = (e) => { if (e.key === 'Escape') close(false); };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('.dwm-btn-confirm').addEventListener('click', () => close(true));
    const cancelBtn = overlay.querySelector('.dwm-btn-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
    setTimeout(() => { const btn = overlay.querySelector('.dwm-btn-confirm'); if (btn) btn.focus(); }, 50);
  });
}

async function saveSurveySettings() {
  const id = window._ssmCurrentId;
  if (!id) return;
  const original = window._ssmCurrentData || {};

  const isSystem = isSystemSurvey(original);

  // دمج التاريخ + الوقت → ISO string (timestamptz)
  const sd = document.getElementById('ssm-start-date').value;
  const st = document.getElementById('ssm-start-time').value || '00:00';
  const start_date = sd ? new Date(`${sd}T${st}:00`).toISOString() : null;
  const ed = document.getElementById('ssm-end-date').value;
  const et = document.getElementById('ssm-end-time').value || '23:59';
  const end_date = ed ? new Date(`${ed}T${et}:00`).toISOString() : null;

  const data = {
    active: document.getElementById('ssm-active').checked,
    repeat_type: document.getElementById('ssm-repeat-type').value,
    start_date: start_date,
    end_date: end_date,
    auto_activate: document.getElementById('ssm-auto-activate').checked,
    welcome_message: document.getElementById('ssm-welcome').value.trim(),
    thanks_message: document.getElementById('ssm-thanks').value.trim(),
    anonymous: document.getElementById('ssm-anonymous').checked,
    show_progress: document.getElementById('ssm-show-progress').checked,
    allow_edit: document.getElementById('ssm-allow-edit').checked
  };

  if (isSystem) {
    // حماية: الحقول غير موجودة في DOM للنظامية — استخدم القيم الأصلية
    data.title = original.title;
    data.description = original.description;
    data.icon = original.icon;
  } else {
    data.title = document.getElementById('ssm-title').value.trim();
    data.description = document.getElementById('ssm-description').value.trim();
    data.icon = document.getElementById('ssm-icon').value.trim() || '📋';
  }

  // Validation: title required
  if (!data.title) {
    showToast('العنوان مطلوب', 'error');
    switchSurveySettingsTab('general');
    return;
  }
  // ===== تنبيهات التواريخ (Modal احترافي بدل confirm/toast) =====
  const _fmtDate = (iso) => { try { return new Date(iso).toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' }); } catch(e){ return String(iso); } };
  const _nowTs = Date.now();

  // 1) خطأ منطقي: النهاية قبل/تساوي البداية (لا يُسمح بالتجاوز)
  if (data.start_date && data.end_date && new Date(data.end_date) <= new Date(data.start_date)) {
    await showDateWarningModal({
      type: 'error',
      title: 'خطأ منطقي في التواريخ',
      description: 'وقت النهاية يجب أن يكون بعد وقت البداية.',
      details: '🟢 البداية: ' + _fmtDate(data.start_date) + '<br>🔴 النهاية: ' + _fmtDate(data.end_date),
      note: 'يُرجى تعديل التواريخ قبل الحفظ.',
      confirmLabel: 'فهمت',
      showCancel: false
    });
    switchSurveySettingsTab('schedule');
    return;
  }

  // 2) تاريخ الانتهاء في الماضي (يُسمح بالتجاوز)
  if (data.end_date && new Date(data.end_date).getTime() < _nowTs) {
    const ok = await showDateWarningModal({
      type: 'danger',
      title: 'تاريخ الانتهاء في الماضي',
      description: 'الاستبيان سيُعتبر منتهياً فور حفظه ولن يظهر للحجاج.',
      details: 'تاريخ الانتهاء المُحدَّد: ' + _fmtDate(data.end_date),
      note: 'هل تريد المتابعة بالحفظ رغم ذلك؟',
      confirmLabel: 'نعم، احفظ',
      cancelLabel: 'رجوع'
    });
    if (!ok) { switchSurveySettingsTab('schedule'); return; }
  }

  // 3) تاريخ البدء في الماضي + التفعيل التلقائي (يُسمح بالتجاوز)
  if (data.start_date && new Date(data.start_date).getTime() < _nowTs && data.auto_activate) {
    const ok = await showDateWarningModal({
      type: 'warning',
      title: 'تاريخ البدء في الماضي',
      description: 'التفعيل التلقائي مُشغَّل والاستبيان سيُفعَّل فوراً عند الحفظ.',
      details: 'تاريخ البدء المُحدَّد: ' + _fmtDate(data.start_date),
      note: 'هل تريد المتابعة؟',
      confirmLabel: 'نعم، تابع',
      cancelLabel: 'رجوع'
    });
    if (!ok) { switchSurveySettingsTab('schedule'); return; }
  }

  // Warning for system survey title change
  if (isSystemSurvey(original) && data.title !== original.title) {
    const ok = await showConfirm('أنت تُغيّر عنوان استبيان نظامي. هل تريد المتابعة؟', 'تنبيه', 'نعم، احفظ', '#c8971a', '⚠️');
    if (!ok) return;
  }

  try {
    await window.DB.Surveys.update(id, data);
    closeSurveySettings(true);
    // إعادة جلب كاملة من DB — يضمن تطبيق auto_activate + عرض الحالة الفعلية
    await renderSurveys();

    // Warning if activated without questions (بعد إعادة الجلب للتأكد من الحالة الفعلية)
    const updated = (window._surveysCache || []).find(s => s.id === id);
    if (updated && updated.active) {
      try {
        const qs = await window.DB.Surveys.getQuestions(id);
        if (!qs.length) {
          showToast('الاستبيان مفعّل لكن بدون أسئلة — الحاج لن يرى شيئاً', 'warning', 6000);
        }
      } catch (e) {}
    }

    showToast('تم حفظ الإعدادات', 'success');
  } catch (e) {
    showToast('خطأ في الحفظ: ' + (e.message || e), 'error');
  }
}

function renderSurveyCard(id) {
  const surveys = window._surveysCache || [];
  const s = surveys.find(x => x.id === id);
  if (!s) return;
  const counts = window._surveysResponseCounts || {};
  const totalPilgrims = (typeof ALL_DATA !== 'undefined' && ALL_DATA.length) ? ALL_DATA.length : 0;
  const grid = document.getElementById('surveys-grid');
  if (!grid) return;
  const existing = grid.querySelector(`.survey-card[data-id="${id}"]`);
  if (!existing) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildSurveyCardHTML(s, counts[s.id] || 0, totalPilgrims);
  existing.replaceWith(tmp.firstElementChild);
  // refresh question count
  window.DB.Surveys.getQuestions(id).then(qs => {
    const el = document.getElementById('sc-q-' + id);
    if (el) el.textContent = qs.length;
  }).catch(() => {});
}

// ======================================================================
// ===== نظام الاستبيانات — المرحلة 2C: إدارة الأسئلة =====
// ======================================================================

const QUESTION_TEMPLATES = {
  rating:  { label:'⭐ تقييم نجوم',               question_text:'ما تقييمك لـ [الخدمة]؟',     question_type:'rating',   options:null, required:true },
  yesno:   { label:'👍 نعم / لا',                   question_text:'سؤال نعم/لا',                question_type:'single',   options:['نعم','لا'], required:true },
  quality: { label:'📊 ممتاز/جيد/متوسط/ضعيف',      question_text:'كيف تقيّم [الخدمة]؟',        question_type:'single',   options:['ممتاز','جيد','متوسط','ضعيف'], required:true },
  open:    { label:'📝 سؤال مفتوح',                question_text:'سؤالك المفتوح هنا',           question_type:'text',     options:null, required:false },
  choice:  { label:'✅ اختيار من قائمة',            question_text:'اختر إجابة واحدة',             question_type:'single',   options:['خيار 1','خيار 2','خيار 3','خيار 4'], required:true },
  multi:   { label:'☑️ اختيار متعدد',               question_text:'يمكنك اختيار أكثر من إجابة',  question_type:'multiple', options:['خيار 1','خيار 2','خيار 3','خيار 4'], required:false }
};

const QUESTION_TYPE_LABELS = {
  rating: '⭐ تقييم نجوم',
  single: '🔘 اختيار واحد',
  multiple: '☑️ اختيار متعدد',
  text: '📝 نص حر'
};

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'السكن','الطعام','النقل','الخدمات','التواصل','التسجيل',
  'الإجراءات','الاستقبال','السلامة','النظافة','المواعيد',
  'الكوادر','التقييم العام','التوصية','الملاحظات'
];

window._qmSurveyId = null;
window._qmSurvey = null;
window._qmQuestions = [];
window._qmEditingId = null;
window._qmEditingType = null;
window._qmEditingOrigType = null;
window._qmFilter = '';
window._qmCategoryFilter = '';
window._qmSortable = null;
window._qmDropdownHandler = null;

async function openQuestionsManager(id) {
  const survey = (window._surveysCache || []).find(s => s.id === id);
  if (!survey) { showToast('لم يُعثر على الاستبيان', 'error'); return; }
  window._qmSurveyId = id;
  window._qmSurvey = survey;
  window._qmFilter = '';
  window._qmCategoryFilter = '';
  window._qmEditingId = null;
  const container = document.getElementById('qm-container');
  container.innerHTML = buildQMHTML(survey);
  document.getElementById('questions-manager-modal').style.display = 'flex';
  await loadQuestions(id);
  window._qmDropdownHandler = (e) => {
    if (!e.target.closest('.qm-dropdown')) {
      document.querySelectorAll('.qm-dropdown-menu').forEach(m => m.style.display = 'none');
    }
  };
  document.addEventListener('click', window._qmDropdownHandler);
}

function closeQuestionsManager() {
  document.getElementById('questions-manager-modal').style.display = 'none';
  if (window._qmSortable) { window._qmSortable.destroy(); window._qmSortable = null; }
  if (window._qmDropdownHandler) {
    document.removeEventListener('click', window._qmDropdownHandler);
    window._qmDropdownHandler = null;
  }
  window._qmSurveyId = null;
  window._qmSurvey = null;
  window._qmQuestions = [];
  window._qmEditingId = null;
  window._qmEditingType = null;
  window._qmEditingOrigType = null;
  window._qmFilter = '';
  window._qmCategoryFilter = '';
}

function buildQMHTML(s) {
  const isSystem = isSystemSurvey(s);
  const iconClass = isSystem ? ('ic-' + s.code) : 'ic-custom';
  const tplButtons = Object.entries(QUESTION_TEMPLATES).map(([k, t]) =>
    `<button onclick="applyTemplate('${k}')"><span>${t.label}</span></button>`
  ).join('');
  return `
    <div class="ssm-header">
      <div class="ssm-icon sc-icon-circle ${iconClass}">${s.icon || '📋'}</div>
      <div class="ssm-title">
        <div>إدارة الأسئلة</div>
        <div class="ssm-sub">${escapeHTML(s.title)} • <span id="qm-count">0</span> سؤال</div>
      </div>
      <button class="ssm-close" onclick="closeQuestionsManager()" title="إغلاق">✕</button>
    </div>
    <div class="qm-toolbar">
      <div class="qm-dropdown">
        <button class="qm-tb-btn primary" onclick="toggleQMMenu('add')">➕ إضافة سؤال ▾</button>
        <div class="qm-dropdown-menu" id="qm-add-menu" style="display:none">
          <button onclick="addQuestionOfType('rating')"><span class="qm-dm-ico">⭐</span><div><div>تقييم نجوم</div><div class="qm-dm-desc">من 1 إلى 5 نجوم</div></div></button>
          <button onclick="addQuestionOfType('single')"><span class="qm-dm-ico">🔘</span><div><div>اختيار واحد</div><div class="qm-dm-desc">الحاج يختار إجابة واحدة فقط</div></div></button>
          <button onclick="addQuestionOfType('multiple')"><span class="qm-dm-ico">☑️</span><div><div>اختيار متعدد</div><div class="qm-dm-desc">الحاج يمكنه اختيار أكثر من إجابة</div></div></button>
          <button onclick="addQuestionOfType('text')"><span class="qm-dm-ico">📝</span><div><div>نص حر</div><div class="qm-dm-desc">الحاج يكتب إجابته بحرية</div></div></button>
        </div>
      </div>
      <div class="qm-dropdown">
        <button class="qm-tb-btn" onclick="toggleQMMenu('tpl')">📋 من قالب جاهز ▾</button>
        <div class="qm-dropdown-menu" id="qm-tpl-menu" style="display:none">${tplButtons}</div>
      </div>
      <input class="qm-search" type="text" placeholder="🔍 بحث في الأسئلة..." oninput="qmFilterChange(this.value)">
      <select class="qm-cat-filter" id="qm-cat-select" onchange="qmCategoryFilterChange(this.value)">
        <option value="">كل الفئات</option>
      </select>
    </div>
    <div class="qm-filter-notice" id="qm-filter-notice">⚠️ الترتيب بالسحب يعمل فقط بدون فلترة</div>
    <div class="qm-body">
      <div class="qm-list-pane">
        <div id="qm-questions-list"></div>
      </div>
      <div class="qm-side-panel" id="qm-side-panel" style="display:none"></div>
    </div>`;
}

async function loadQuestions(id) {
  try {
    const qs = await window.DB.Surveys.getQuestions(id);
    window._qmQuestions = qs;
    renderQuestionsList();
    updateCategoryFilter();
    updateQMCount();
  } catch (e) {
    showToast('خطأ في تحميل الأسئلة: ' + e.message, 'error');
  }
}

function getVisibleQuestions() {
  let list = window._qmQuestions || [];
  const q = (window._qmFilter || '').toLowerCase();
  const cat = window._qmCategoryFilter || '';
  if (q) list = list.filter(x => (x.question_text || '').toLowerCase().includes(q));
  if (cat) list = list.filter(x => (x.category || '') === cat);
  return list;
}

function renderQuestionsList() {
  const listEl = document.getElementById('qm-questions-list');
  if (!listEl) return;
  const visible = getVisibleQuestions();
  if (!visible.length) {
    const hasFilter = !!(window._qmFilter || window._qmCategoryFilter);
    listEl.innerHTML = `
      <div class="qm-empty">
        <div class="qme-ico">${hasFilter ? '🔍' : '📝'}</div>
        <div class="qme-title">${hasFilter ? 'لا توجد نتائج' : 'لا توجد أسئلة بعد'}</div>
        <div class="qme-desc">${hasFilter ? 'جرّب كلمة بحث أخرى أو غيّر الفلتر' : 'ابدأ بإضافة سؤال من الأعلى'}</div>
      </div>`;
    return;
  }
  listEl.innerHTML = visible.map((q, i) => renderQuestionCard(q, i)).join('');
  const noticeEl = document.getElementById('qm-filter-notice');
  const hasFilter = !!(window._qmFilter || window._qmCategoryFilter);
  if (noticeEl) noticeEl.classList.toggle('visible', hasFilter);
  initSortable();
}

function renderQuestionCard(q, i) {
  const typeLabel = QUESTION_TYPE_LABELS[q.question_type] || q.question_type;
  const optsCount = (q.question_type === 'single' || q.question_type === 'multiple') && Array.isArray(q.options) ? q.options.length : 0;
  const hasFilter = !!(window._qmFilter || window._qmCategoryFilter);
  return `
    <div class="qm-question-card" data-id="${q.id}">
      <div class="qm-handle ${hasFilter ? 'disabled' : ''}" title="${hasFilter ? 'السحب غير متاح مع الفلترة' : 'اسحب لإعادة الترتيب'}">⋮⋮</div>
      <div class="qm-q-number">${i + 1}</div>
      <div class="qm-q-body">
        <div class="qm-q-text">${escapeHTML(q.question_text)}</div>
        <div class="qm-q-meta">
          <span class="qm-type-badge type-${q.question_type}">${typeLabel}</span>
          <span class="${q.required ? 'qm-req-badge' : 'qm-opt-badge'}">${q.required ? 'إلزامي' : 'اختياري'}</span>
          ${q.category ? `<span class="qm-cat-badge">${escapeHTML(q.category)}</span>` : ''}
          ${optsCount ? `<span class="qm-opts-count">${optsCount} خيارات</span>` : ''}
        </div>
      </div>
      <div class="qm-q-actions">
        <button onclick="openQuestionEditor(${q.id})" title="تعديل">✏️</button>
        <button class="delete" onclick="deleteQuestionConfirm(${q.id})" title="حذف">🗑️</button>
      </div>
    </div>`;
}

function updateCategoryFilter() {
  const sel = document.getElementById('qm-cat-select');
  if (!sel) return;
  const cats = Array.from(new Set((window._qmQuestions || []).map(q => q.category).filter(Boolean)));
  const current = window._qmCategoryFilter;
  sel.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c =>
    `<option value="${escapeHTML(c)}" ${c === current ? 'selected' : ''}>${escapeHTML(c)}</option>`
  ).join('');
}

function updateQMCount() {
  const el = document.getElementById('qm-count');
  if (el) el.textContent = (window._qmQuestions || []).length;
}

function qmFilterChange(val) {
  window._qmFilter = val || '';
  renderQuestionsList();
}

function qmCategoryFilterChange(val) {
  window._qmCategoryFilter = val || '';
  renderQuestionsList();
}

function toggleQMMenu(which) {
  const menu = document.getElementById(which === 'add' ? 'qm-add-menu' : 'qm-tpl-menu');
  const other = document.getElementById(which === 'add' ? 'qm-tpl-menu' : 'qm-add-menu');
  if (other) other.style.display = 'none';
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function closeQMDropdowns() {
  document.querySelectorAll('.qm-dropdown-menu').forEach(m => m.style.display = 'none');
}

// ===== Editor =====

function addQuestionOfType(type) {
  closeQMDropdowns();
  openQuestionEditor(null, {
    question_text: '',
    question_type: type,
    options: (type === 'single' || type === 'multiple') ? ['', ''] : null,
    required: true,
    category: ''
  });
}

function applyTemplate(tplId) {
  closeQMDropdowns();
  const t = QUESTION_TEMPLATES[tplId];
  if (!t) return;
  openQuestionEditor(null, {
    question_text: t.question_text,
    question_type: t.question_type,
    options: t.options ? [...t.options] : null,
    required: t.required,
    category: ''
  });
}

function openQuestionEditor(id, prefill) {
  const isNew = id === null || id === undefined;
  let data;
  if (isNew) {
    data = prefill || { question_text:'', question_type:'rating', options:null, required:true, category:'' };
    window._qmEditingId = null;
    window._qmEditingOrigType = null;
  } else {
    const q = (window._qmQuestions || []).find(x => x.id === id);
    if (!q) return;
    data = {
      question_text: q.question_text || '',
      question_type: q.question_type || 'rating',
      options: Array.isArray(q.options) ? [...q.options] : null,
      required: q.required,
      category: q.category || ''
    };
    window._qmEditingId = id;
    window._qmEditingOrigType = q.question_type;
  }
  window._qmEditingType = data.question_type;
  const panel = document.getElementById('qm-side-panel');
  panel.innerHTML = buildEditorHTML(isNew, data);
  panel.style.display = 'flex';
  setTimeout(renderQuestionPreview, 10);
}

function buildEditorHTML(isNew, data) {
  const existing = Array.from(new Set((window._qmQuestions || []).map(q => q.category).filter(Boolean)));
  const cats = Array.from(new Set([...existing, ...DEFAULT_CATEGORY_SUGGESTIONS]));
  const needsOptions = data.question_type === 'single' || data.question_type === 'multiple';
  const optsArr = Array.isArray(data.options) && data.options.length ? data.options : ['', ''];
  const isCustomCat = data.category && !cats.includes(data.category);
  const selectedCat = isCustomCat ? '__new__' : (data.category || '');
  return `
    <div class="qm-editor-header">
      <div class="qm-editor-title">${isNew ? '➕ سؤال جديد' : '✏️ تعديل سؤال'}</div>
      <button class="ssm-close" onclick="closeQuestionEditor()">✕</button>
    </div>
    <div class="qm-editor-body">
      <div class="ssm-row">
        <label>نص السؤال <span style="color:#c00">*</span></label>
        <textarea id="qe-text" rows="3" placeholder="اكتب السؤال هنا..." oninput="renderQuestionPreview()">${escapeHTML(data.question_text)}</textarea>
      </div>
      <div class="ssm-row">
        <label>نوع السؤال</label>
        <div class="qe-type-grid">
          <div class="qe-type-card ${data.question_type==='rating'?'selected':''}" data-qt="rating" onclick="switchQEType('rating')"><div class="qetc-ico">⭐</div><div class="qetc-lbl">تقييم نجوم</div></div>
          <div class="qe-type-card ${data.question_type==='single'?'selected':''}" data-qt="single" onclick="switchQEType('single')"><div class="qetc-ico">🔘</div><div class="qetc-lbl">اختيار واحد</div></div>
          <div class="qe-type-card ${data.question_type==='multiple'?'selected':''}" data-qt="multiple" onclick="switchQEType('multiple')"><div class="qetc-ico">☑️</div><div class="qetc-lbl">اختيار متعدد</div></div>
          <div class="qe-type-card ${data.question_type==='text'?'selected':''}" data-qt="text" onclick="switchQEType('text')"><div class="qetc-ico">📝</div><div class="qetc-lbl">نص حر</div></div>
        </div>
      </div>
      <div class="ssm-row" id="qe-options-row" style="${needsOptions?'':'display:none'}">
        <label>الخيارات <span style="color:#c00">*</span> <span class="ssm-hint">الحد الأدنى: خياران</span></label>
        <div class="qm-options-list" id="qe-options-list">
          ${optsArr.map((opt, i) => qmOptionItem(opt, i)).join('')}
        </div>
        <button type="button" class="qm-opt-add" onclick="addOption()">➕ إضافة خيار</button>
      </div>
      <div class="ssm-row">
        <label>الفئة <span style="color:#c00">*</span></label>
        <select id="qe-category-select" onchange="onCategorySelectChange(this.value)">
          <option value="" ${selectedCat === '' ? 'selected' : ''}>— اختر فئة —</option>
          ${cats.map(c => `<option value="${escapeHTML(c)}" ${c === data.category ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}
          <option value="__new__" ${isCustomCat ? 'selected' : ''}>➕ فئة جديدة...</option>
        </select>
        <input type="text" id="qe-category-new" placeholder="اكتب اسم الفئة الجديدة" value="${isCustomCat ? escapeHTML(data.category) : ''}" style="display:${isCustomCat ? '' : 'none'};margin-top:6px">
      </div>
      <div class="opt-row">
        <div class="opt-row-text">
          <div class="opt-row-title">إلزامي</div>
          <div class="opt-row-desc">الحاج لا يستطيع تخطي هذا السؤال</div>
        </div>
        <span class="tgl ${data.required?'on':''}" onclick="toggleSSMField(this,'qe-required')">
          <input type="checkbox" ${data.required?'checked':''} id="qe-required" onchange="renderQuestionPreview()">
          <span class="tgl-bg"></span><span class="tgl-knob"></span>
        </span>
      </div>
      <div class="qm-preview-section">
        <h4>🔍 معاينة حية</h4>
        <div class="qm-preview" id="qe-preview"></div>
      </div>
    </div>
    <div class="qm-editor-footer">
      <button class="ssm-btn secondary" onclick="closeQuestionEditor()">إلغاء</button>
      <button class="ssm-btn primary" onclick="saveQuestion()">💾 حفظ</button>
    </div>`;
}

function normalizeCategory(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/^ال/, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ةه]/g, 'ه')
    .replace(/\s+/g, ' ');
}

function findSimilarCategory(newCat, existingList) {
  const normNew = normalizeCategory(newCat);
  if (!normNew) return null;
  for (const ex of existingList) {
    if (normalizeCategory(ex) === normNew) return { exact: true, match: ex };
  }
  for (const ex of existingList) {
    const normEx = normalizeCategory(ex);
    if (normEx.length < 3 || normNew.length < 3) continue;
    if (Math.abs(normEx.length - normNew.length) > 3) continue;
    if (normEx.includes(normNew) || normNew.includes(normEx)) {
      return { exact: false, match: ex };
    }
  }
  return null;
}

function getAllCategoriesList() {
  const existing = Array.from(new Set((window._qmQuestions || []).map(q => q.category).filter(Boolean)));
  return Array.from(new Set([...existing, ...DEFAULT_CATEGORY_SUGGESTIONS]));
}

function getCurrentCategoryValue() {
  const sel = document.getElementById('qe-category-select')?.value || '';
  if (sel === '__new__') {
    return (document.getElementById('qe-category-new')?.value || '').trim();
  }
  return sel.trim();
}

function onCategorySelectChange(val) {
  const newInput = document.getElementById('qe-category-new');
  if (!newInput) return;
  if (val === '__new__') {
    newInput.style.display = '';
    setTimeout(() => newInput.focus(), 50);
  } else {
    newInput.style.display = 'none';
    newInput.value = '';
  }
}

function qmOptionItem(value, idx) {
  return `<div class="qm-option-item" data-idx="${idx}">
    <input type="text" placeholder="خيار ${idx + 1}" value="${escapeHTML(value || '')}" oninput="renderQuestionPreview()">
    <button class="qm-opt-remove" onclick="removeOption(${idx})" title="حذف">×</button>
  </div>`;
}

function switchQEType(type) {
  window._qmEditingType = type;
  document.querySelectorAll('.qe-type-card').forEach(c => c.classList.toggle('selected', c.dataset.qt === type));
  const needsOpts = type === 'single' || type === 'multiple';
  const optsRow = document.getElementById('qe-options-row');
  if (optsRow) optsRow.style.display = needsOpts ? '' : 'none';
  if (needsOpts) {
    const listEl = document.getElementById('qe-options-list');
    if (listEl && !listEl.children.length) {
      listEl.innerHTML = qmOptionItem('', 0) + qmOptionItem('', 1);
    }
  }
  renderQuestionPreview();
}

function addOption() {
  const listEl = document.getElementById('qe-options-list');
  if (!listEl) return;
  const idx = listEl.children.length;
  listEl.insertAdjacentHTML('beforeend', qmOptionItem('', idx));
  renderQuestionPreview();
}

function removeOption(idx) {
  const listEl = document.getElementById('qe-options-list');
  if (!listEl) return;
  const children = Array.from(listEl.children);
  if (children.length <= 2) {
    showToast('الحد الأدنى خياران', 'warning');
    return;
  }
  const item = children[idx];
  if (item) item.remove();
  Array.from(listEl.children).forEach((el, i) => {
    el.dataset.idx = i;
    const btn = el.querySelector('.qm-opt-remove');
    if (btn) btn.setAttribute('onclick', `removeOption(${i})`);
    const inp = el.querySelector('input');
    if (inp) inp.placeholder = `خيار ${i + 1}`;
  });
  renderQuestionPreview();
}

function getCurrentEditorOptions() {
  const inputs = document.querySelectorAll('#qe-options-list input');
  return Array.from(inputs).map(i => i.value);
}

function renderQuestionPreview() {
  const previewEl = document.getElementById('qe-preview');
  if (!previewEl) return;
  const rawText = (document.getElementById('qe-text')?.value || '').trim();
  const text = rawText || 'اكتب نص السؤال...';
  const type = window._qmEditingType;
  const required = document.getElementById('qe-required')?.checked;
  const opts = getCurrentEditorOptions().filter(o => o.trim());

  let inputHTML = '';
  if (type === 'rating') {
    inputHTML = '<div class="qm-preview-stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>';
  } else if (type === 'single') {
    inputHTML = opts.length
      ? opts.map(o => `<label class="qm-preview-opt"><input type="radio" disabled> ${escapeHTML(o)}</label>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted)">— أضف خيارات —</div>';
  } else if (type === 'multiple') {
    inputHTML = opts.length
      ? opts.map(o => `<label class="qm-preview-opt"><input type="checkbox" disabled> ${escapeHTML(o)}</label>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted)">— أضف خيارات —</div>';
  } else if (type === 'text') {
    inputHTML = '<textarea class="qm-preview-text-area" placeholder="إجابة الحاج..." disabled></textarea>';
  }

  previewEl.innerHTML = `
    <div class="qm-preview-q">${escapeHTML(text)}${required ? '<span class="qm-req-star">*</span>' : ''}</div>
    ${inputHTML}`;
}

function closeQuestionEditor() {
  const panel = document.getElementById('qm-side-panel');
  if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  window._qmEditingId = null;
  window._qmEditingType = null;
  window._qmEditingOrigType = null;
}

async function saveQuestion() {
  const text = (document.getElementById('qe-text')?.value || '').trim();
  const type = window._qmEditingType;
  const required = document.getElementById('qe-required')?.checked;
  let category = getCurrentCategoryValue();

  if (!text) { showToast('نص السؤال مطلوب', 'error'); return; }
  if (!type) { showToast('اختر نوع السؤال', 'error'); return; }
  if (!category) { showToast('الفئة مطلوبة', 'error'); return; }

  let options = null;
  if (type === 'single' || type === 'multiple') {
    options = getCurrentEditorOptions().map(o => o.trim()).filter(Boolean);
    if (options.length < 2) { showToast('يجب توفير خيارين على الأقل', 'error'); return; }
  }

  // فحص تكرار الفئات الجديدة
  const selVal = document.getElementById('qe-category-select')?.value;
  if (selVal === '__new__') {
    const match = findSimilarCategory(category, getAllCategoriesList());
    if (match) {
      if (match.exact) {
        showToast(`هذه الفئة موجودة بالاسم "${match.match}" — سيتم استخدامها`, 'warning');
        category = match.match;
      } else {
        const ok = await showConfirm(
          `هل تقصد "${match.match}"؟ اضغط "نعم" لاستخدامها أو "إلغاء" لإضافة "${category}" كفئة جديدة.`,
          'فئة مشابهة موجودة', 'نعم، استخدم الموجودة', '#c8971a', '💡'
        );
        if (ok) category = match.match;
      }
    }
  }

  const editingId = window._qmEditingId;
  const isEditing = editingId !== null;

  if (isEditing && window._qmEditingOrigType && type !== window._qmEditingOrigType) {
    try {
      const count = await countAnswersForQuestion(window._qmSurveyId, editingId);
      if (count > 0) {
        const ok = await showConfirm(
          `هذا السؤال لديه ${count} إجابة مسجلة. تغيير نوعه قد يجعل الإجابات السابقة غير قابلة للقراءة بشكل صحيح. هل أنت متأكد من المتابعة؟`,
          'تحذير', 'نعم، تابع', '#c8971a', '⚠️'
        );
        if (!ok) return;
      }
    } catch (e) {}
  }

  const payload = {
    question_text: text,
    question_type: type,
    options: options,
    required: !!required,
    category: category || null
  };

  try {
    if (isEditing) {
      await window.DB.Surveys.updateQuestion(editingId, payload);
      const idx = (window._qmQuestions || []).findIndex(x => x.id === editingId);
      if (idx !== -1) window._qmQuestions[idx] = { ...window._qmQuestions[idx], ...payload };
    } else {
      const maxOrder = (window._qmQuestions || []).reduce((m, q) => Math.max(m, q.display_order || 0), 0);
      payload.display_order = maxOrder + 1;
      const newQ = await window.DB.Surveys.addQuestion(window._qmSurveyId, payload);
      window._qmQuestions.push(newQ);
    }
    renderQuestionsList();
    updateCategoryFilter();
    updateQMCount();
    refreshSurveyCardCount(window._qmSurveyId);
    showToast(isEditing ? 'تم حفظ التعديلات ✅' : 'تمت إضافة السؤال ✅', 'success');
    closeQuestionEditor();
  } catch (e) {
    showToast('خطأ في الحفظ: ' + (e.message || e), 'error');
  }
}

async function deleteQuestionConfirm(id) {
  const ok = await showConfirm('هل تريد حذف هذا السؤال؟ لا يمكن التراجع.', 'تأكيد الحذف', 'نعم، احذف', '#c00', '🗑️');
  if (!ok) return;
  try {
    await window.DB.Surveys.deleteQuestion(id);
    window._qmQuestions = (window._qmQuestions || []).filter(x => x.id !== id);
    renderQuestionsList();
    updateCategoryFilter();
    updateQMCount();
    refreshSurveyCardCount(window._qmSurveyId);
    showToast('تم الحذف ✓', 'success');
    if (window._qmEditingId === id) closeQuestionEditor();
  } catch (e) {
    showToast('خطأ في الحذف: ' + (e.message || e), 'error');
  }
}

function initSortable() {
  const listEl = document.getElementById('qm-questions-list');
  if (window._qmSortable) { window._qmSortable.destroy(); window._qmSortable = null; }
  if (!listEl) return;
  const hasFilter = !!(window._qmFilter || window._qmCategoryFilter);
  if (hasFilter) return;
  if (typeof Sortable === 'undefined') return;
  window._qmSortable = Sortable.create(listEl, {
    handle: '.qm-handle',
    animation: 150,
    ghostClass: 'qm-ghost',
    onEnd: reorderQuestions
  });
}

async function reorderQuestions() {
  const listEl = document.getElementById('qm-questions-list');
  if (!listEl) return;
  const cards = Array.from(listEl.querySelectorAll('.qm-question-card'));
  const updates = [];
  cards.forEach((card, index) => {
    const id = parseInt(card.dataset.id);
    const q = (window._qmQuestions || []).find(x => x.id === id);
    if (q && q.display_order !== index + 1) {
      q.display_order = index + 1;
      updates.push(window.DB.Surveys.updateQuestion(id, { display_order: index + 1 }));
    }
  });
  (window._qmQuestions || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  cards.forEach((card, index) => {
    const numEl = card.querySelector('.qm-q-number');
    if (numEl) numEl.textContent = index + 1;
  });
  if (updates.length) {
    try {
      await Promise.all(updates);
      showToast('تم إعادة الترتيب ✓', 'success', 2000);
    } catch (e) {
      showToast('خطأ في حفظ الترتيب', 'error');
      loadQuestions(window._qmSurveyId);
    }
  }
}

async function countAnswersForQuestion(surveyId, questionId) {
  try {
    const responses = await window.DB.Surveys.getResponses(surveyId);
    return responses.filter(r => r.answers && r.answers[questionId] !== undefined && r.answers[questionId] !== null && r.answers[questionId] !== '').length;
  } catch (e) { return 0; }
}

function refreshSurveyCardCount(surveyId) {
  const el = document.getElementById('sc-q-' + surveyId);
  if (el) el.textContent = (window._qmQuestions || []).length;
}

// ======================================================================
// ===== نظام الاستبيانات — المرحلة 2D: إنشاء/معاينة/نسخ/حذف/استيراد/تصدير =====
// ======================================================================

function generateCustomCode() {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function stripIds(obj, keys) {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

// ===== Create Survey =====
function openCreateSurvey() {
  const defaultData = { title:'', description:'', icon:'📋', repeat_type:'once' };
  const container = document.getElementById('cs-container');
  container.innerHTML = `
    <div class="cs-header">
      <div class="cs-title">➕ إنشاء استبيان جديد</div>
      <button class="ssm-close" onclick="closeCreateSurvey()">✕</button>
    </div>
    <div class="cs-body">
      <div class="ssm-row">
        <label>العنوان <span style="color:#c00">*</span></label>
        <input type="text" id="cs-title" placeholder="مثال: تقييم الخدمات الإضافية">
      </div>
      <div class="ssm-row">
        <label>الوصف</label>
        <textarea id="cs-description" rows="2" placeholder="وصف مختصر للاستبيان (اختياري)"></textarea>
      </div>
      <div class="ssm-row">
        <label>الأيقونة</label>
        ${buildEmojiPickerHTML('📋', 'cs')}
      </div>
      <div class="ssm-row">
        <label>نوع التكرار</label>
        <div class="radio-cards" id="cs-repeat-cards">
          <div class="radio-card selected" onclick="csSelectRepeat('once')" data-cs-repeat="once">
            <div class="rc-ico">1️⃣</div><div class="rc-label">مرة واحدة</div><div class="rc-desc">إجابة واحدة لكل حاج</div>
          </div>
          <div class="radio-card" onclick="csSelectRepeat('daily')" data-cs-repeat="daily">
            <div class="rc-ico">📆</div><div class="rc-label">يومي</div><div class="rc-desc">إجابة جديدة كل يوم</div>
          </div>
          <div class="radio-card" onclick="csSelectRepeat('weekly')" data-cs-repeat="weekly">
            <div class="rc-ico">🗓️</div><div class="rc-label">أسبوعي</div><div class="rc-desc">إجابة جديدة كل أسبوع</div>
          </div>
        </div>
        <input type="hidden" id="cs-repeat-type" value="once">
      </div>
    </div>
    <div class="cs-footer">
      <button class="ssm-btn secondary" onclick="closeCreateSurvey()">إلغاء</button>
      <button class="ssm-btn primary" onclick="saveNewSurvey()">✨ إنشاء</button>
    </div>`;
  document.getElementById('create-survey-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('cs-title')?.focus(), 50);
}

function closeCreateSurvey() {
  document.getElementById('create-survey-modal').style.display = 'none';
}

function csSelectRepeat(val) {
  document.getElementById('cs-repeat-type').value = val;
  document.querySelectorAll('[data-cs-repeat]').forEach(c => c.classList.toggle('selected', c.dataset.csRepeat === val));
}

async function saveNewSurvey() {
  const title = document.getElementById('cs-title').value.trim();
  if (!title) { showToast('العنوان مطلوب', 'error'); return; }
  const data = {
    code: generateCustomCode(),
    title,
    description: document.getElementById('cs-description').value.trim(),
    icon: document.getElementById('cs-icon').value.trim() || '📋',
    repeat_type: document.getElementById('cs-repeat-type').value,
    active: false,
    display_order: (window._surveysCache || []).length + 10
  };
  try {
    const created = await window.DB.Surveys.create(data);
    closeCreateSurvey();
    // إعادة جلب كاملة من DB — يضمن ظهور كل الحقول (emoji، حالات، إلخ) فوراً
    await renderSurveys();
    showToast('تم إنشاء الاستبيان', 'success');
    const addQs = await showConfirm('هل تريد إضافة أسئلة الآن؟', 'استبيان جديد', 'نعم، إضافة أسئلة', '#c8971a', '📝');
    if (addQs) openQuestionsManager(created.id);
  } catch (e) {
    showToast('خطأ في الإنشاء: ' + (e.message || e), 'error');
  }
}

// ===== Duplicate Survey =====
window._dupSurveyId = null;

function duplicateSurvey(id) {
  closeSurveyMoreMenu();
  const s = (window._surveysCache || []).find(x => x.id === id);
  if (!s) return;
  window._dupSurveyId = id;
  const container = document.getElementById('dup-container');
  container.innerHTML = `
    <div class="cs-header">
      <div class="cs-title">📋 نسخ استبيان</div>
      <button class="ssm-close" onclick="closeDupModal()">✕</button>
    </div>
    <div class="cs-body">
      <div class="ssm-row">
        <label>عنوان النسخة الجديدة</label>
        <input type="text" id="dup-title" value="نسخة من ${escapeHTML(s.title)}">
      </div>
      <div style="padding:10px 14px;background:#eaf4ff;border:1.5px solid #b4d7f5;border-radius:var(--radius-sm);font-size:11px;color:#1a5fa8;margin-top:10px">ℹ️ سيتم نسخ جميع الأسئلة. النسخة ستكون غير مفعّلة افتراضياً.</div>
    </div>
    <div class="cs-footer">
      <button class="ssm-btn secondary" onclick="closeDupModal()">إلغاء</button>
      <button class="ssm-btn primary" onclick="confirmDuplicate()">📋 نسخ</button>
    </div>`;
  document.getElementById('dup-survey-modal').style.display = 'flex';
  setTimeout(() => {
    const el = document.getElementById('dup-title');
    if (el) { el.focus(); el.select(); }
  }, 50);
}

function closeDupModal() {
  document.getElementById('dup-survey-modal').style.display = 'none';
  window._dupSurveyId = null;
}

async function confirmDuplicate() {
  const id = window._dupSurveyId;
  const newTitle = document.getElementById('dup-title').value.trim();
  if (!newTitle) { showToast('العنوان مطلوب', 'error'); return; }
  const orig = (window._surveysCache || []).find(x => x.id === id);
  if (!orig) return;
  try {
    const newData = stripIds(orig, ['id', 'created_at', 'updated_at']);
    newData.title = newTitle;
    newData.code = generateCustomCode();
    newData.active = false;
    const created = await window.DB.Surveys.create(newData);
    const origQs = await window.DB.Surveys.getQuestions(id);
    for (const q of origQs) {
      const newQ = stripIds(q, ['id', 'survey_id']);
      await window.DB.Surveys.addQuestion(created.id, newQ);
    }
    closeDupModal();
    await renderSurveys();
    showToast('تم النسخ', 'success');
  } catch (e) {
    showToast('خطأ في النسخ: ' + (e.message || e), 'error');
  }
}

// ===== Delete Survey =====
async function deleteSurvey(id) {
  closeSurveyMoreMenu();
  const s = (window._surveysCache || []).find(x => x.id === id);
  if (!s) return;
  if (isSystemSurvey(s)) {
    showToast('لا يمكن حذف الاستبيانات النظامية', 'error');
    return;
  }
  const ok = await showConfirm(
    `سيتم حذف الاستبيان "${s.title}" وكل أسئلته وإجاباته نهائياً. هل أنت متأكد؟`,
    'تأكيد الحذف', 'نعم، احذف نهائياً', '#c00', '⚠️'
  );
  if (!ok) return;
  try {
    await window.DB.Surveys.delete(id);
    await renderSurveys();
    showToast('تم الحذف ✓', 'success');
  } catch (e) {
    showToast('خطأ في الحذف: ' + (e.message || e), 'error');
  }
}

// ===== Export JSON =====
async function exportSurveyJSON(id) {
  closeSurveyMoreMenu();
  const s = (window._surveysCache || []).find(x => x.id === id);
  if (!s) return;
  try {
    const questions = await window.DB.Surveys.getQuestions(id);
    const data = {
      meta: { version: '1.0', exported_at: new Date().toISOString() },
      survey: stripIds(s, ['id', 'created_at', 'updated_at']),
      questions: questions.map(q => stripIds(q, ['id', 'survey_id']))
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_${s.code}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('تم التصدير ✓', 'success');
  } catch (e) {
    showToast('خطأ في التصدير: ' + (e.message || e), 'error');
  }
}

// ===== Import JSON =====
window._impSurveyData = null;

function importSurveyJSON() {
  window._impSurveyData = null;
  const container = document.getElementById('imp-container');
  container.innerHTML = `
    <div class="cs-header">
      <div class="cs-title">📥 استيراد استبيان من JSON</div>
      <button class="ssm-close" onclick="closeImportSurvey()">✕</button>
    </div>
    <div class="cs-body">
      <label class="drop-zone" id="imp-drop-zone"
             ondragover="event.preventDefault();this.classList.add('hover')"
             ondragleave="this.classList.remove('hover')"
             ondrop="event.preventDefault();this.classList.remove('hover');onImportFileChosen(event.dataTransfer.files[0])">
        <input type="file" accept=".json,application/json" style="display:none" onchange="onImportFileChosen(this.files[0])">
        <div class="dz-icon">📥</div>
        <div class="dz-primary">اسحب ملف JSON هنا أو انقر للاختيار</div>
        <div class="dz-sub">ملف صادر من "تصدير JSON"</div>
      </label>
      <div id="imp-preview" style="margin-top:14px"></div>
    </div>
    <div class="cs-footer">
      <button class="ssm-btn secondary" onclick="closeImportSurvey()">إلغاء</button>
      <button class="ssm-btn primary" id="imp-confirm-btn" onclick="confirmImport()" disabled style="opacity:.5;cursor:not-allowed">📥 استيراد</button>
    </div>`;
  document.getElementById('import-survey-modal').style.display = 'flex';
}

function closeImportSurvey() {
  document.getElementById('import-survey-modal').style.display = 'none';
  window._impSurveyData = null;
}

function onImportFileChosen(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.survey || !data.survey.title || !Array.isArray(data.questions)) {
        throw new Error('الملف غير صالح — يجب أن يحوي survey.title و questions (مصفوفة)');
      }
      window._impSurveyData = data;
      const preview = document.getElementById('imp-preview');
      preview.innerHTML = `
        <div style="padding:14px 16px;background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--radius-sm)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700">✅ الملف جاهز للاستيراد</div>
          <div style="font-size:15px;font-weight:800;color:var(--text-primary)">${escapeHTML(data.survey.icon || '📋')} ${escapeHTML(data.survey.title)}</div>
          ${data.survey.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.6">${escapeHTML(data.survey.description)}</div>` : ''}
          <div style="font-size:12px;color:var(--gold-dark);margin-top:10px;font-weight:700">📝 ${data.questions.length} سؤال</div>
        </div>`;
      const btn = document.getElementById('imp-confirm-btn');
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = 'pointer';
    } catch (err) {
      showToast('خطأ في قراءة الملف: ' + err.message, 'error', 6000);
    }
  };
  reader.readAsText(file);
}

async function confirmImport() {
  const data = window._impSurveyData;
  if (!data) return;
  try {
    const surveyData = stripIds(data.survey, ['id', 'created_at', 'updated_at']);
    surveyData.code = generateCustomCode();
    surveyData.active = false;
    surveyData.display_order = (window._surveysCache || []).length + 10;
    const newSurvey = await window.DB.Surveys.create(surveyData);
    for (const q of data.questions) {
      const qData = stripIds(q, ['id', 'survey_id']);
      await window.DB.Surveys.addQuestion(newSurvey.id, qData);
    }
    closeImportSurvey();
    await renderSurveys();
    showToast('تم الاستيراد', 'success');
  } catch (e) {
    showToast('خطأ في الاستيراد: ' + (e.message || e), 'error');
  }
}

// ===== More Menu (floating) =====
window._moreMenuHandler = null;

function openSurveyMoreMenu(ev, id) {
  ev.stopPropagation();
  closeSurveyMoreMenu();
  const survey = (window._surveysCache || []).find(s => s.id === id);
  const isSystem = isSystemSurvey(survey);
  const btn = ev.currentTarget || ev.target.closest('button');
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'survey-more-menu';
  menu.id = 'survey-more-menu';
  // position: under the button; right-aligned in RTL
  const isRtl = document.body.classList.contains('rtl') || document.dir === 'rtl';
  if (isRtl) {
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
  } else {
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  }
  const devMode = isDeveloperMode();
  menu.innerHTML = `
    <button onclick="duplicateSurvey(${id})">📋 نسخ الاستبيان</button>
    ${devMode ? `<button onclick="exportSurveyJSON(${id})">📤 تصدير JSON</button>` : ''}
    ${devMode && !isSystem ? `<button class="danger" onclick="deleteSurvey(${id})">🗑️ حذف</button>` : ''}`;
  document.body.appendChild(menu);
  window._moreMenuHandler = (e) => {
    if (!menu.contains(e.target)) closeSurveyMoreMenu();
  };
  setTimeout(() => document.addEventListener('click', window._moreMenuHandler), 10);
}

function closeSurveyMoreMenu() {
  const menu = document.getElementById('survey-more-menu');
  if (menu) menu.remove();
  if (window._moreMenuHandler) {
    document.removeEventListener('click', window._moreMenuHandler);
    window._moreMenuHandler = null;
  }
}

// ===== Preview Survey =====
window._prvSurvey = null;
window._prvQuestions = [];

async function previewSurvey(id) {
  const survey = (window._surveysCache || []).find(s => s.id === id);
  if (!survey) { showToast('لم يُعثر على الاستبيان', 'error'); return; }
  try {
    const questions = await window.DB.Surveys.getQuestions(id);
    window._prvSurvey = survey;
    window._prvQuestions = questions;
    const container = document.getElementById('prv-container');
    container.innerHTML = buildPreviewHTML(survey, questions);
    document.getElementById('preview-survey-modal').style.display = 'flex';
  } catch (e) {
    showToast('خطأ في التحميل: ' + (e.message || e), 'error');
  }
}

function buildPreviewHTML(s, questions) {
  const isSystem = isSystemSurvey(s);
  const iconClass = isSystem ? ('ic-' + s.code) : 'ic-custom';
  const qsHTML = questions.length
    ? questions.map((q, i) => buildPreviewQuestionHTML(q, i + 1)).join('')
    : '<div style="padding:40px;text-align:center;color:var(--text-muted)">لا توجد أسئلة في هذا الاستبيان بعد.</div>';
  return `
    <div class="prv-header">
      <div class="prv-icon sc-icon-circle ${iconClass}">${s.icon || '📋'}</div>
      <div class="prv-title">
        <div>${escapeHTML(s.title)} <span class="prv-pbadge">معاينة</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHTML(s.description || '')}</div>
      </div>
      <button class="ssm-close" onclick="closePreviewSurvey()">✕</button>
    </div>
    <div class="prv-body">
      ${s.welcome_message ? `<div class="prv-welcome">${escapeHTML(s.welcome_message)}</div>` : ''}
      ${s.show_progress !== false && questions.length ? `
        <div class="prv-progress-wrap">
          <div class="prv-progress-label">السؤال 0 من ${questions.length}</div>
          <div class="prv-progress"><div class="prv-progress-fill" style="width:0%"></div></div>
        </div>` : ''}
      ${qsHTML}
    </div>
    <div class="prv-footer">
      <button class="ssm-btn secondary" onclick="closePreviewSurvey()">إغلاق</button>
      <button class="ssm-btn primary" onclick="submitPreview()">📤 إرسال (تجربة)</button>
    </div>`;
}

function buildPreviewQuestionHTML(q, num) {
  const reqStar = q.required ? '<span class="prv-req-star">*</span>' : '';
  const catBadge = q.category ? `<span class="prv-q-cat">${escapeHTML(q.category)}</span>` : '';
  let input = '';
  if (q.question_type === 'rating') {
    input = `<div class="prv-stars" data-prv-stars="${q.id}">
      ${[1,2,3,4,5].map(i => `<span class="prv-star" onclick="prvSetStars(${q.id},${i})">★</span>`).join('')}
    </div>`;
  } else if (q.question_type === 'single') {
    const opts = Array.isArray(q.options) ? q.options : [];
    input = `<div class="prv-opts">${opts.map(o => `<label><input type="radio" name="prv-q-${q.id}" onchange="updatePrvProgress()"> ${escapeHTML(o)}</label>`).join('')}</div>`;
  } else if (q.question_type === 'multiple') {
    const opts = Array.isArray(q.options) ? q.options : [];
    input = `<div class="prv-opts">${opts.map(o => `<label><input type="checkbox" onchange="updatePrvProgress()"> ${escapeHTML(o)}</label>`).join('')}</div>`;
  } else if (q.question_type === 'text') {
    input = `<textarea class="prv-textarea" placeholder="اكتب إجابتك هنا..." oninput="updatePrvProgress()"></textarea>`;
  }
  return `
    <div class="prv-question">
      <div class="prv-q-text"><span class="prv-q-num">${num}</span>${escapeHTML(q.question_text)}${reqStar}${catBadge}</div>
      ${input}
    </div>`;
}

function prvSetStars(qid, rating) {
  const container = document.querySelector(`[data-prv-stars="${qid}"]`);
  if (!container) return;
  Array.from(container.children).forEach((star, i) => {
    star.classList.toggle('active', i < rating);
  });
  updatePrvProgress();
}

function updatePrvProgress() {
  const qs = window._prvQuestions || [];
  if (!qs.length) return;
  let answered = 0;
  for (const q of qs) {
    if (q.question_type === 'rating') {
      const cont = document.querySelector(`[data-prv-stars="${q.id}"]`);
      if (cont && cont.querySelector('.prv-star.active')) answered++;
    } else if (q.question_type === 'single') {
      if (document.querySelector(`input[name="prv-q-${q.id}"]:checked`)) answered++;
    } else if (q.question_type === 'multiple') {
      // find any checkbox in that question
      const qEl = document.querySelectorAll('.prv-question')[qs.indexOf(q)];
      if (qEl && qEl.querySelector('input[type=checkbox]:checked')) answered++;
    } else if (q.question_type === 'text') {
      const qEl = document.querySelectorAll('.prv-question')[qs.indexOf(q)];
      if (qEl && qEl.querySelector('textarea')?.value?.trim()) answered++;
    }
  }
  const pct = Math.round((answered / qs.length) * 100);
  const fill = document.querySelector('.prv-progress-fill');
  const label = document.querySelector('.prv-progress-label');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `السؤال ${answered} من ${qs.length}`;
}

function closePreviewSurvey() {
  document.getElementById('preview-survey-modal').style.display = 'none';
  window._prvSurvey = null;
  window._prvQuestions = [];
}

function submitPreview() {
  const s = window._prvSurvey;
  const msg = (s && s.thanks_message && s.thanks_message.trim()) || 'شكراً لك على مشاركتك في الاستبيان 🙏';
  showToast(msg, 'success', 5000);
  closePreviewSurvey();
}