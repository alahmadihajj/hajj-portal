// ═══════════════════════════════════════════════════════════════════════
// Nusuk Cards Admin Module — v11.5 Phase 5c/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - initNusukBusFilter, filterNusuk, renderNusukTable, viewPilgrimAck
//   - Bulk: toggleAllNusuk, updateNusukBulkBar, clearNusukSelection, applyBulkNusuk
//   - Quick: quickNusukUpdate, exportNusukReport
//
// Dependencies (globals):
//   - ui-helpers.js:    showToast, showConfirm
//   - admin.html:       ALL_DATA, openModal, closeModals, _getLogo
//   - supabase.js:      window.DB.Pilgrims.*
// ═══════════════════════════════════════════════════════════════════════

// v23.0-pre-x: حقن CSS للإحصائيات التفاعلية
(function injectNusukStatsStyles(){
  if(document.getElementById('nusuk-stats-styles')) return;
  const style = document.createElement('style');
  style.id = 'nusuk-stats-styles';
  style.textContent = `
  .nusuk-stat-card {
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .nusuk-stat-card:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 10px 28px rgba(0,0,0,0.14), 0 4px 10px rgba(0,0,0,0.08) !important;
    z-index: 2;
  }
  .nusuk-stat-card:active {
    transform: translateY(-2px) scale(1.01);
    transition: all 0.1s ease;
  }
  .nusuk-stat-card.is-active {
    background: linear-gradient(135deg, #fff 0%, #fffbf0 100%) !important;
    box-shadow: 0 6px 18px rgba(200,151,26,0.25), inset 0 0 0 1px rgba(200,151,26,0.15) !important;
    animation: nusukActivePulse 2s ease-in-out infinite;
  }
  @keyframes nusukActivePulse {
    0%, 100% { box-shadow: 0 6px 18px rgba(200,151,26,0.25), inset 0 0 0 1px rgba(200,151,26,0.15); }
    50%      { box-shadow: 0 8px 22px rgba(200,151,26,0.4),  inset 0 0 0 2px rgba(200,151,26,0.3);  }
  }
  .nusuk-stat-icon {
    font-size: 22px;
    margin-bottom: 4px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    display: inline-block;
  }
  .nusuk-stat-card:hover .nusuk-stat-icon {
    transform: scale(1.25) rotate(-5deg);
  }
  .nusuk-stat-number {
    display: inline-block;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
    transition: color 0.3s ease;
  }
  .nusuk-stat-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(0,0,0,0.06);
    color: #555;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    transition: all 0.25s ease;
  }
  .nusuk-stat-card:hover .nusuk-stat-badge {
    background: rgba(200,151,26,0.15);
    color: #7a4500;
    transform: scale(1.1);
  }
  .nusuk-stat-card.is-active .nusuk-stat-badge {
    background: #c8971a;
    color: #fff;
    box-shadow: 0 2px 6px rgba(200,151,26,0.4);
  }
  .nusuk-stat-progress-bar {
    position: absolute;
    bottom: 0;
    right: 0;
    height: 3px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  .nusuk-stat-progress-bar::after {
    content: '';
    position: absolute;
    top: 0; left: -50%;
    width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    animation: nusukShimmer 2.5s infinite;
  }
  @keyframes nusukShimmer {
    0%   { left: -50%; }
    100% { left: 100%; }
  }
  .nusuk-stat-card:hover .nusuk-stat-progress-bar {
    height: 5px;
  }
  .nusuk-stat-label {
    font-size: 11px;
    font-weight: 600;
    margin-top: 2px;
    line-height: 1.3;
  }
    /* Grid Container للـ stats */
    #nusuk-stats {
      display: grid !important;
      grid-template-columns: repeat(6, 1fr) !important;
      gap: 10px !important;
      margin-bottom: 16px;
    }

    /* Tablet: 3 بطاقات */
    @media (max-width: 900px) {
      #nusuk-stats {
        grid-template-columns: repeat(3, 1fr) !important;
      }
      .nusuk-stat-card {
        min-height: 110px !important;
        padding: 12px 8px !important;
      }
      .nusuk-stat-number {
        font-size: 24px !important;
      }
      .nusuk-stat-icon {
        font-size: 20px !important;
      }
    }

    /* Mobile: 2 بطاقات */
    @media (max-width: 600px) {
      #nusuk-stats {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 8px !important;
      }
      .nusuk-stat-card {
        min-height: 100px !important;
        padding: 10px 6px !important;
        border-radius: 10px !important;
      }
      .nusuk-stat-number {
        font-size: 22px !important;
      }
      .nusuk-stat-icon {
        font-size: 18px !important;
      }
      .nusuk-stat-label {
        font-size: 10px !important;
      }
      .nusuk-stat-badge {
        font-size: 8px !important;
        padding: 1px 5px !important;
      }
    }

    /* Mobile صغير جداً */
    @media (max-width: 380px) {
      #nusuk-stats {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 6px !important;
      }
      .nusuk-stat-card {
        min-height: 90px !important;
        padding: 8px 4px !important;
      }
      .nusuk-stat-number {
        font-size: 20px !important;
      }
    }

    /* Flash عند تغيّر الرقم */
    @keyframes nusukNumberFlashUp {
      0%   { color: inherit; transform: scale(1); }
      30%  { color: #1a7a1a; transform: scale(1.25); text-shadow: 0 0 12px rgba(26,122,26,0.4); }
      100% { color: inherit; transform: scale(1); }
    }
    @keyframes nusukNumberFlashDown {
      0%   { color: inherit; transform: scale(1); }
      30%  { color: #c00; transform: scale(0.85); text-shadow: 0 0 12px rgba(192,0,0,0.4); }
      100% { color: inherit; transform: scale(1); }
    }
    .nusuk-stat-number.flash-up   { animation: nusukNumberFlashUp 0.8s ease-out; }
    .nusuk-stat-number.flash-down { animation: nusukNumberFlashDown 0.8s ease-out; }
`;
  document.head.appendChild(style);
})();

// ===== بطاقات نسك =====
window._nusukFilter = '';
const NUSUK_STATUSES = ['لم تطبع','في الطباعة','لدى الإدارة','لدى المشرف','مسلّمة للحاج'];
const NUSUK_COLORS  = ['#888','#1a5fa8','#c8971a','#7a4500','#1a7a1a'];
const NUSUK_BG      = ['#f5f5f5','#e8f0fd','#fff3e0','#fdf0e0','#e8f8e8'];

// v23.0-pre-z: قواعد التسلسل الصارم
function _getAllowedNextStatuses(currentStatus){
  // superadmin يرى كل الخيارات
  if(_isSuperAdmin()) return NUSUK_STATUSES.slice();

  // خيارات التسلسل الأمامي فقط
  const allowed = [currentStatus]; // الحالة الحالية دائماً مرئية (محدّدة)

  switch(currentStatus){
    case 'لم تطبع':
      allowed.push('في الطباعة', 'لدى الإدارة');
      break;
    case 'في الطباعة':
      allowed.push('لدى الإدارة');
      break;
    case 'لدى الإدارة':
      break;
    case 'لدى المشرف':
      allowed.push('مسلّمة للحاج');
      break;
    case 'مسلّمة للحاج':
      break;
  }
  return allowed;
}

window._nusukPrevCounts = window._nusukPrevCounts || {};

// ═══════════════════════════════════════════════════════════════════════
// v20.2 Phase 1: قواعد حماية البطاقات الموقَّعة
// ═══════════════════════════════════════════════════════════════════════
// يدعم ALL_DATA shape (Arabic keys) + supervisor shape (English keys)
function _isNusukLocked(pilgrim){
  if(!pilgrim) return false;
  return !!(pilgrim['نسك_sig'] || pilgrim.nusuk_card_sig);
}
function _isSuperAdmin(){
  return !!(window._currentUser && window._currentUser.role === 'superadmin');
}
function _canReopenNusuk(){
  const r = window._currentUser && window._currentUser.role;
  return r === 'admin' || r === 'superadmin';
}
// v22.1: قفل التسليم — هل استلم المشرف البطاقة من الإدارة؟
function _hasSupervisorAck(pilgrim){
  if(!pilgrim) return false;
  return !!(pilgrim['نسك_supervisor_sig'] || pilgrim.nusuk_supervisor_sig);
}

function openSupervisorAckFor(pilgrimSupabaseId) {
  const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(pilgrimSupabaseId));
  if (!p || !_hasSupervisorAck(p)) {
    return showToast('لا يوجد إقرار مشرف موقّع', 'warning');
  }
  const ackId = p['نسك_supervisor_ack_id'];
  if (!ackId) {
    return showToast('معرّف الإقرار غير متوفر', 'warning');
  }
  openBulkAckReceipt({ ackId });
}

function initNusukBusFilter() {
  const sel = document.getElementById('nusuk-bus-filter');
  if(!sel) return;
  // v22.5.2: حفظ القيمة المختارة قبل إعادة البناء (renderNusukTable يستدعي هذه الدالة ثم يقرأ .value)
  const currentValue = sel.value;
  // v22.5.1: استبعاد '-' والقيم الفارغة + ترتيب رقمي صحيح
  const buses = [...new Set(
    ALL_DATA.map(p => p['رقم الحافلة الخاصة بك'])
      .filter(b => b && String(b).trim() && String(b).trim() !== '-')
  )].sort((a, b) => Number(a) - Number(b));
  const newHTML = '<option value="">🚌 كل الحافلات</option>' +
    buses.map(b => `<option value="${b}">حافلة ${b}</option>`).join('');
  // v22.5.2: rebuild فقط عند التغيير + استعادة القيمة المختارة
  if(sel.innerHTML !== newHTML){
    sel.innerHTML = newHTML;
    if(currentValue && buses.map(String).includes(String(currentValue))){
      sel.value = currentValue;
    }
  }
}

function filterNusuk(status) {
  window._nusukFilter = status;
  let activeChip = null;
  ['','لم تطبع','في الطباعة','لدى الإدارة','لدى المشرف','مسلّمة للحاج'].forEach((s,i) => {
    const ids = ['nusuk-f-all','nusuk-f-1','nusuk-f-2','nusuk-f-3','nusuk-f-4','nusuk-f-5'];
    const btn = document.getElementById(ids[i]);
    if(btn){
      const isActive = s===status;
      btn.classList.toggle('hs-active', isActive);
      if(isActive) activeChip = btn;
    }
  });

  // v23.0-pre-ee: تمرير chip المحدَّد ليظهر للمستخدم
  if(activeChip){
    setTimeout(() => {
      activeChip.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }, 50);
  }
  renderNusukTable(status);
}

// v23.0-pre-x: Counter animation للأرقام
function _animateNumber(el, targetValue, duration){
  if(!el) return;
  duration = duration || 800;
  const startValue = 0;
  const startTime = performance.now();

  function easeOutQuart(t){ return 1 - Math.pow(1 - t, 4); }

  function step(now){
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuart(progress);
    const current = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = current;
    if(progress < 1) requestAnimationFrame(step);
    else el.textContent = targetValue;
  }
  requestAnimationFrame(step);
}

// أيقونات الحالات
const NUSUK_ICONS = {
  'الإجمالي':     '👥',
  'لم تطبع':      '📭',
  'في الطباعة':   '🖨️',
  'لدى الإدارة':  '🏢',
  'لدى المشرف':   '👤',
  'مسلّمة للحاج': '✅'
};

// v23.0-pre-nn: مؤشّر "آخر تحديث"
window._nusukLastUpdate = Date.now();
let _nusukUpdateInterval = null;

function _formatRelativeTime(timestamp){
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if(diff < 5)    return 'الآن';
  if(diff < 60)   return `قبل ${diff} ثانية`;
  if(diff < 120)  return 'قبل دقيقة';
  if(diff < 3600) return `قبل ${Math.floor(diff/60)} دقيقة`;
  if(diff < 7200) return 'قبل ساعة';
  if(diff < 86400)return `قبل ${Math.floor(diff/3600)} ساعة`;
  return `قبل ${Math.floor(diff/86400)} يوم`;
}

function _updateNusukLastUpdateText(){
  const el = document.getElementById('nusuk-last-update-text');
  if(!el) return;
  el.textContent = _formatRelativeTime(window._nusukLastUpdate);
}

function _startNusukLastUpdateTimer(){
  if(_nusukUpdateInterval) clearInterval(_nusukUpdateInterval);
  _updateNusukLastUpdateText();
  _nusukUpdateInterval = setInterval(_updateNusukLastUpdateText, 10000); // كل 10 ثوانٍ
}

function markNusukUpdated(){
  window._nusukLastUpdate = Date.now();
  _updateNusukLastUpdateText();
  // flash اللون الأخضر للتأكيد البصري
  const el = document.getElementById('nusuk-last-update');
  if(el){
    el.style.transition = 'color 0.3s';
    el.style.color = '#1a7a1a';
    setTimeout(() => { el.style.color = ''; }, 800);
  }
}

// استدعاء التايمر عند تحميل الصفحة
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _startNusukLastUpdateTimer);
} else {
  _startNusukLastUpdateTimer();
}

// تصدير للنافذة
window.markNusukUpdated = markNusukUpdated;

// v23.0-pre-ll: Skeleton loader أثناء تحميل البيانات
function renderNusukSkeleton(){
  const tbody = document.getElementById('nusuk-tbody');
  if(!tbody) return;

  const rows = Array.from({length:5}, () => `
    <tr class="nusuk-skeleton-row">
      <td><div class="nusuk-skeleton" style="width:16px;height:16px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:20px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:160px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:100px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:100px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:60px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:100px;height:22px;border-radius:11px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:80px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:140px;height:30px"></div></td>
      <td><div class="nusuk-skeleton nusuk-skeleton-bar" style="width:90px;height:32px"></div></td>
    </tr>
  `).join('');
  tbody.innerHTML = rows;

  // Mobile cards skeleton
  const mc = document.getElementById('nusuk-mobile-cards');
  if(mc){
    mc.innerHTML = Array.from({length:3}, () => `
      <div style="background:#fff;border:1px solid #e0d5c5;border-radius:12px;padding:14px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
        <div class="nusuk-skeleton" style="width:70%;height:16px;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <div class="nusuk-skeleton" style="width:90px;height:14px"></div>
          <div class="nusuk-skeleton" style="width:110px;height:14px"></div>
          <div class="nusuk-skeleton" style="width:60px;height:14px"></div>
        </div>
        <div class="nusuk-skeleton" style="width:120px;height:24px;border-radius:12px"></div>
      </div>
    `).join('');
  }
}

// تصديرها للنافذة
window.renderNusukSkeleton = renderNusukSkeleton;

function renderNusukTable(filter) {
  initNusukBusFilter();
  const search = (document.getElementById('nusuk-search')?.value||'').toLowerCase();
  const busFilter = document.getElementById('nusuk-bus-filter')?.value||'';

  // إحصائيات
  const statsEl = document.getElementById('nusuk-stats');
  if(statsEl) {
    const total = ALL_DATA.length;
    const statuses = [{key:'__total__', label:'الإجمالي', color:'#3d2000', count:total}];
    NUSUK_STATUSES.forEach((s,i) => {
      const count = ALL_DATA.filter(p=>(p['حالة بطاقة نسك']||'لم تطبع')===s).length;
      statuses.push({key:s, label:s, color:NUSUK_COLORS[i], count:count});
    });

    statsEl.innerHTML = statuses.map(st => {
      const pct = total ? Math.round(st.count/total*100) : 0;
      const active = (st.key === '__total__' && !filter) || (st.key === filter);
      const borderColor = active ? (st.key === '__total__' ? '#c8971a' : st.color) : '#eee';
      const onClick = st.key === '__total__' ? "filterNusuk('')" : `filterNusuk('${st.key}')`;
      return `<div class="nusuk-stat-card ${active ? 'is-active' : ''}" onclick="${onClick}" style="background:#fff;border-radius:14px;padding:14px 10px;box-shadow:0 2px 8px rgba(0,0,0,.06);border:2px solid ${borderColor}">
        <span class="nusuk-stat-badge">${pct}%</span>
        <div class="nusuk-stat-icon">${NUSUK_ICONS[st.label]||'📄'}</div>
        <div class="nusuk-stat-number" data-key="${st.key}" style="font-size:28px;font-weight:800;color:${st.color}">${st.count}</div>
        <div class="nusuk-stat-label" style="color:${st.color}">${st.label}</div>
        <div class="nusuk-stat-progress-bar" style="width:${pct}%;background:${st.color}"></div>
      </div>`;
    }).join('');

    // Flash animation فقط للأرقام التي تغيّرت
    requestAnimationFrame(() => {
      statsEl.querySelectorAll('.nusuk-stat-number').forEach(el => {
        const key = el.dataset.key;
        const newVal = parseInt(el.textContent) || 0;
        const oldVal = window._nusukPrevCounts[key];
        if(oldVal !== undefined && oldVal !== newVal){
          const flashClass = newVal > oldVal ? 'flash-up' : 'flash-down';
          el.classList.remove('flash-up', 'flash-down');
          void el.offsetWidth; // إجبار reflow
          el.classList.add(flashClass);
          setTimeout(() => el.classList.remove(flashClass), 900);
        }
        window._nusukPrevCounts[key] = newVal;
      });
    });
  }

  // تصفية
  let list = ALL_DATA.filter(p => {
    const matchFilter = !filter || (p['حالة بطاقة نسك']||'لم تطبع') === filter;
    const matchSearch = !search || (p['اسم الحاج']||'').toLowerCase().includes(search) || (p['رقم الهوية']||'').includes(search);
    const matchBus = !busFilter || String(p['رقم الحافلة الخاصة بك']||'') === String(busFilter);
    return matchFilter && matchSearch && matchBus;
  });

  const countEl = document.getElementById('nusuk-count');
  if(countEl) countEl.textContent = `عرض ${list.length} من أصل ${ALL_DATA.length} حاج`;

  const tbody = document.getElementById('nusuk-tbody');
  const empty = document.getElementById('nusuk-empty');
  if(!tbody) return;

  if(!list.length) {
    tbody.innerHTML='';
    // رسالة ديناميكية حسب الفلتر
    const emptyMessages = {
      '':              { icon:'👥', title:'لا يوجد حجاج',       hint:'لم يتم إضافة أي حاج للنظام بعد' },
      'لم تطبع':        { icon:'✨', title:'ممتاز! كل البطاقات تمت طباعتها', hint:'لا يوجد حجاج بدون طباعة' },
      'في الطباعة':     { icon:'📭', title:'لا يوجد بطاقات قيد الطباعة',    hint:'يمكنك تحويل حجاج من "لم تطبع"' },
      'لدى الإدارة':    { icon:'📦', title:'لا يوجد بطاقات لدى الإدارة',    hint:'البطاقات المطبوعة تنتظر الاستلام' },
      'لدى المشرف':     { icon:'👤', title:'لا يوجد بطاقات لدى المشرف',     hint:'يستلم المشرف البطاقات من الإدارة' },
      'مسلّمة للحاج':   { icon:'🎯', title:'لم يتم تسليم أي بطاقة بعد',     hint:'المشرفون يسلّمون البطاقات للحجاج' }
    };
    const currentFilter = window._nusukFilter || '';
    const msg = emptyMessages[currentFilter] || emptyMessages[''];

    // تحقّق من فلاتر أخرى (بحث أو حافلة)
    const hasSearchOrBusFilter = (document.getElementById('nusuk-search')?.value||'').trim() || (document.getElementById('nusuk-bus-filter')?.value||'');
    const emptyHTML = hasSearchOrBusFilter
      ? `<tr><td colspan="10" style="padding:40px 20px;text-align:center">
          <div style="font-size:48px;margin-bottom:10px">🔍</div>
          <div style="font-size:16px;font-weight:700;color:#3d2000;margin-bottom:6px">لا توجد نتائج مطابقة</div>
          <div style="font-size:13px;color:#888;margin-bottom:16px">جرّب تعديل الفلاتر أو البحث</div>
          <button onclick="document.getElementById('nusuk-search').value='';document.getElementById('nusuk-bus-filter').value='';renderNusukTable(window._nusukFilter)" style="background:#c8971a;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer;font-family:inherit">🔄 مسح الفلاتر</button>
        </td></tr>`
      : `<tr><td colspan="10" style="padding:40px 20px;text-align:center">
          <div style="font-size:48px;margin-bottom:10px">${msg.icon}</div>
          <div style="font-size:16px;font-weight:700;color:#3d2000;margin-bottom:6px">${msg.title}</div>
          <div style="font-size:13px;color:#888">${msg.hint}</div>
        </td></tr>`;
    tbody.innerHTML = emptyHTML;

    // تطبيق نفس المنطق على bg_mobile_cards
    if(typeof _renderNusukMobileCards === 'function'){
      const mc = document.getElementById('nusuk-mobile-cards');
      if(mc){
        const mobileHTML = hasSearchOrBusFilter
          ? `<div style="padding:40px 20px;text-align:center;background:#fff;border-radius:12px;border:1px dashed #e0d5c5">
              <div style="font-size:48px;margin-bottom:10px">🔍</div>
              <div style="font-size:16px;font-weight:700;color:#3d2000;margin-bottom:6px">لا توجد نتائج</div>
              <div style="font-size:13px;color:#888;margin-bottom:14px">جرّب تعديل الفلاتر</div>
              <button onclick="document.getElementById('nusuk-search').value='';document.getElementById('nusuk-bus-filter').value='';renderNusukTable(window._nusukFilter)" style="background:#c8971a;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;cursor:pointer">🔄 مسح الفلاتر</button>
            </div>`
          : `<div style="padding:40px 20px;text-align:center;background:#fff;border-radius:12px;border:1px dashed #e0d5c5">
              <div style="font-size:48px;margin-bottom:10px">${msg.icon}</div>
              <div style="font-size:16px;font-weight:700;color:#3d2000;margin-bottom:6px">${msg.title}</div>
              <div style="font-size:13px;color:#888">${msg.hint}</div>
            </div>`;
        mc.innerHTML = mobileHTML;
      }
    }

    if(empty) empty.style.display='none'; // أخفِ empty القديم (استبدلناه بـ tbody HTML)
    return;
  }
  if(empty) empty.style.display='none';

  tbody.innerHTML = list.map((p,i) => {
    const status = p['حالة بطاقة نسك']||'لم تطبع';
    const si = NUSUK_STATUSES.indexOf(status);
    const color = NUSUK_COLORS[si]||'#888';
    const bg = NUSUK_BG[si]||'#f5f5f5';
    return `<tr style="border-bottom:1px solid #f5ead0;${i%2===0?'':'background:#fffbf0'}">
      <td style="padding:10px;text-align:center">
        <input type="checkbox" class="nusuk-row-check" data-id="${p['_supabase_id']}" onchange="updateNusukBulkBar()" style="cursor:pointer;width:15px;height:15px">
      </td>
      <td style="padding:10px 14px;text-align:center;color:#bbb;font-size:12px">${i+1}</td>
      <td style="padding:10px 14px;font-weight:600;color:#222">${p['اسم الحاج']||'—'}</td>
      <td style="padding:10px 14px;text-align:center;font-size:12px;color:#555;direction:ltr">${p['رقم الهوية']||'—'}</td>
      <td style="padding:10px 14px;text-align:center;font-size:12px;color:#555">${p['رقم الجوال']||'—'}</td>
      <td style="padding:10px 14px;text-align:center;font-size:12px"><span style="background:#f0e8d0;color:#7a4500;padding:3px 10px;border-radius:20px;font-size:11px">🚌 ${p['رقم الحافلة الخاصة بك']||'—'}</span></td>
      <td style="padding:10px 14px;text-align:center">
        <span style="background:${bg};color:${color};padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">${status}</span>
      </td>
      <td style="padding:10px 14px;text-align:center;font-size:11px;color:#aaa">${p['نسك_time']||'—'}</td>
      <td style="padding:10px 14px;text-align:center">
        ${(() => {
          const isLocked = status === 'مسلّمة للحاج';
          if(isLocked){
            return `<button onclick="showToast('🔒 البطاقة مسلّمة للحاج ومقفلة — استخدم 🔓 للرجوع', 'warning')" style="padding:6px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:11px;font-family:inherit;background:#f5ead0;color:#888;cursor:not-allowed;width:100%;text-align:right">🔒 ${status}</button>`;
          }
          const allowed = _getAllowedNextStatuses(status);
          return `<select onchange="quickNusukUpdate('${p['_supabase_id']}',this.value,this)" style="padding:6px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:11px;font-family:inherit;background:#fff;cursor:pointer">
            ${NUSUK_STATUSES.map(s => {
              const isAllowed = allowed.includes(s);
              if(!isAllowed && s !== status) return '';
              const selected = s===status ? 'selected' : '';
              return `<option value="${s}" ${selected}>${s}</option>`;
            }).join('')}
          </select>`;
        })()}
      </td>
      <td style="padding:10px 14px;text-align:center">
        ${(() => {
          const hasPilgrimAck = !!p['نسك_sig'];
          const canReopen = _canReopenNusuk() && ((p['حالة بطاقة نسك'] || '').includes('مسلّمة') || (p['حالة بطاقة نسك'] || '').includes('لدى المشرف'));
          const hasSupAck = (p['حالة بطاقة نسك'] || '').includes('لدى المشرف') || (p['حالة بطاقة نسك'] || '').includes('مسلّمة');

          // v23.0-pre-kk: أزرار موحّدة الحجم مع style ثابت
          const NUSUK_BTN_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;color:#fff;border:none;border-radius:8px;padding:0;font-size:14px;cursor:pointer;font-family:inherit;margin:0 3px;vertical-align:middle';

          const btnView = hasPilgrimAck
            ? `<button onclick="viewPilgrimAck('${p['_supabase_id']}')" title="عرض إقرار الحاج" style="${NUSUK_BTN_STYLE};background:#1a5fa8">📄</button>`
            : '';
          const btnReopen = canReopen
            ? `<button onclick="openNusukReopenModal('${p['_supabase_id']}')" title="إعادة فتح البطاقة" style="${NUSUK_BTN_STYLE};background:#c07000">🔓</button>`
            : '';
          const btnSupAck = hasSupAck
            ? `<button onclick="openSupervisorAckFor('${p['_supabase_id']}')" title="إقرار استلام المشرف" style="${NUSUK_BTN_STYLE};background:#6b4a28">📋</button>`
            : '';

          const anyButton = btnSupAck + btnView + btnReopen;
          return anyButton || '<span style="color:#ccc;font-size:11px">—</span>';
        })()}
      </td>
    </tr>`;
  }).join('');

  // تشغيل رسم البطاقات للجوال
  _renderNusukMobileCards(list);
}

// v23.0-pre-y: رسم بطاقات نسك للجوال
function _renderNusukMobileCards(list){
  const mc = document.getElementById('nusuk-mobile-cards');
  if(!mc) return;
  const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // استخدم دوال تنسيق الأرقام من admin.html إن وُجدت
  const telFn = (typeof _telNumber === 'function') ? _telNumber : (n => String(n||'').replace(/[^\d+]/g,''));
  const waFn  = (typeof _waNumber  === 'function') ? _waNumber  : (n => String(n||'').replace(/\D/g,''));

  if(!list.length){ mc.innerHTML=''; return; }

  mc.innerHTML = list.map((p,i) => {
    const pid = p['_supabase_id'];
    const name = esc(p['اسم الحاج']||'—');
    const idnum = esc(p['رقم الهوية']||'—');
    const phoneRaw = p['رقم الجوال']||'';
    const phone = esc(phoneRaw||'—');
    const telHref = telFn(phoneRaw);
    const waHref = waFn(phoneRaw);
    const bus = esc(p['رقم الحافلة الخاصة بك']||'—');
    const status = p['حالة بطاقة نسك']||'لم تطبع';
    const si = NUSUK_STATUSES.indexOf(status);
    const color = NUSUK_COLORS[si]||'#888';
    const bg = NUSUK_BG[si]||'#f5f5f5';
    const time = p['نسك_time']||'—';

    const hasPilgrimAck = !!p['نسك_sig'];
    const canReopen = _canReopenNusuk() && ((p['حالة بطاقة نسك'] || '').includes('مسلّمة') || (p['حالة بطاقة نسك'] || '').includes('لدى المشرف'));
    const hasSupAck = (p['حالة بطاقة نسك'] || '').includes('لدى المشرف') || (p['حالة بطاقة نسك'] || '').includes('مسلّمة');

    const btnView = hasPilgrimAck
      ? `<button onclick="viewPilgrimAck('${pid}')" style="background:#1a5fa8;color:#fff" title="إقرار الحاج">📄</button>`
      : '';
    const btnReopen = canReopen
      ? `<button onclick="openNusukReopenModal('${pid}')" style="background:#c07000;color:#fff" title="إعادة فتح">🔓</button>`
      : '';
    const btnSupAck = hasSupAck
      ? `<button onclick="openSupervisorAckFor('${pid}')" style="background:#6b4a28;color:#fff" title="إقرار المشرف">📋</button>`
      : '';
    const anyButton = btnSupAck + btnView + btnReopen;

    // زر الواتساب + رابط الاتصال (مشابه لـ pilgrim-card)
    const phoneCell = phoneRaw ? `
      <span class="pc-phone">
        📞 <a href="tel:${telHref}" class="pc-tel" onclick="event.stopPropagation()">${phone}</a>
        ${waHref ? `<a href="https://wa.me/${waHref}" target="_blank" rel="noopener" class="pc-wa" onclick="event.stopPropagation()" aria-label="واتساب">💬</a>` : ''}
      </span>
    ` : '<span>📞 —</span>';

    return `<div class="nusuk-card">
      <input type="checkbox" class="nusuk-row-check nusuk-card-check" data-id="${pid}" onchange="updateNusukBulkBar()">
      <div class="nusuk-card-header">
        <div>
          <div class="nusuk-card-name">${i+1}. ${name}</div>
        </div>
      </div>
      <div class="pc-row" style="margin-bottom:10px">
        <span>🪪 <strong>${idnum}</strong></span>
        ${phoneCell}
        <span>🚌 <strong>حافلة ${bus}</strong></span>
      </div>
      <div class="nusuk-card-meta-row">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:#666">حالة البطاقة:</span>
          <span class="nusuk-card-status-badge" style="background:${bg};color:${color}">${status}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:#888">تاريخ التسليم:</span>
          <span class="nusuk-card-date-badge">📅 ${time}</span>
        </div>
      </div>
      <div class="nusuk-card-actions">
        ${(() => {
          const isLocked = status === 'مسلّمة للحاج';
          if(isLocked){
            return `<button onclick="showToast('🔒 البطاقة مسلّمة للحاج ومقفلة — استخدم 🔓 للرجوع', 'warning')" style="padding:6px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:11px;font-family:inherit;background:#f5ead0;color:#888;cursor:not-allowed;width:100%;text-align:right">🔒 ${status}</button>`;
          }
          const allowed = _getAllowedNextStatuses(status);
          return `<select onchange="quickNusukUpdate('${pid}',this.value,this)">
            ${NUSUK_STATUSES.map(s => {
              const isAllowed = allowed.includes(s);
              if(!isAllowed && s !== status) return '';
              const selected = s===status ? 'selected' : '';
              return `<option value="${s}" ${selected}>${s}</option>`;
            }).join('')}
          </select>`;
        })()}
        ${anyButton || '<span style="color:#ccc;font-size:11px;padding:8px">—</span>'}
      </div>
    </div>`;
  }).join('');
}

function viewPilgrimAck(pilgrimId) {
  const p = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  if(!p || !p['نسك_sig']) return showToast('لا يوجد إقرار محفوظ', 'warning');
  const dev = window._devSettings||{};
  const companyName = dev.companyName||'';
  const license = dev.license||'';
  const logo = _getLogo();
  const stamp = dev.stamp||'';

  const repName = dev.rep_name || '';
  const repSig  = dev.rep_sig  || '';

  const printDate = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'2-digit', day:'2-digit' });
  const printTime = new Date().toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit', hour12:true });

  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
  <title>إقرار استلام بطاقة نسك</title>
  <style>
    @media print { body{margin:0} .no-print{display:none} }
    body{font-family:'Arial',sans-serif;direction:rtl;padding:30px;font-size:13px;color:#222;max-width:700px;margin:0 auto}
    .header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:3px solid #3d2000;padding-bottom:14px;margin-bottom:20px}
    .header-center{text-align:center}
    .header h2{color:#3d2000;font-size:17px;margin:6px 0}
    .header p{color:#666;font-size:12px;margin:2px 0}
    .info-box{background:#fffbf0;border:1px solid #e0d0b0;border-radius:8px;padding:14px;margin-bottom:16px;line-height:2}
    .pledge{margin-bottom:16px;line-height:2.2}
    .pledge li{margin-bottom:4px}
    .sig-section{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:20px;border-top:1px solid #eee;padding-top:16px}
    .sig-box{text-align:center}
    .sig-box label{font-size:12px;color:#666;display:block;margin-bottom:8px}
    .sig-img{width:180px;height:80px;object-fit:contain;border:1px solid #ddd;border-radius:6px}
    .stamp{width:80px;height:80px;object-fit:contain;margin:0 auto;display:block}
    .footer{text-align:center;font-size:11px;color:#aaa;margin-top:20px}
  </style></head><body>
  <div class="header">
    <div style="text-align:right">
      <div style="font-size:15px;font-weight:bold;color:#3d2000">${companyName}</div>
      ${license?`<div style="font-size:11px;color:#555">رقم الترخيص: ${license}</div>`:''}
    </div>
    <div class="header-center">
      ${_buildPrintLogoHTML(65)}
      <div style="font-size:15px;font-weight:bold;color:#3d2000;margin-top:4px">تعهد استلام بطاقة نسك</div>
    </div>
    <div style="text-align:left;font-size:10px;color:#555;line-height:1.8;justify-self:end;direction:ltr">
      <div style="white-space:nowrap">📅 <strong>التاريخ:</strong> ${printDate}</div>
      <div style="white-space:nowrap">🕐 <strong>الوقت:</strong> ${printTime}</div>
      <div style="white-space:nowrap">📄 <strong>الصفحات:</strong> 1 من 1</div>
    </div>
  </div>
  <div class="info-box">
    <strong>اسم الحاج / ـة:</strong> ${p['اسم الحاج']||'—'}<br>
    <strong>رقم الهوية / الإقامة:</strong> ${p['رقم الهوية']||'—'}<br>
    <strong>رقم الجوال:</strong> ${p['رقم الجوال']||'—'}<br>
    <strong>رقم الحافلة:</strong> ${p['رقم الحافلة الخاصة بك']||'—'}<br>
    <strong>تاريخ التسليم:</strong> ${p['نسك_time']||'—'}
  </div>
  <div class="pledge">
    <p>أقر أنا المذكور أعلاه بأنني استلمت بطاقة "نسك" الخاصة بي من <strong>${companyName}</strong>، وأتعهد بما يلي:</p>
    <ol>
      <li>المحافظة على بطاقة نسك وعدم فقدانها أو إتلافها.</li>
      <li>إبراز البطاقة عند الطلب في جميع مراحل التنقل وأداء المناسك.</li>
      <li>الالتزام بالتعليمات والإرشادات المرتبطة باستخدام البطاقة.</li>
      <li>إبلاغ الحملة فوراً في حال فقدان البطاقة أو وجود أي مشكلة.</li>
    </ol>
    <p>وأتحمل كامل المسؤولية في حال الإهمال أو إساءة الاستخدام.</p>
  </div>
  <div class="sig-section">
    <div class="sig-box">
      <label>توقيع الحاج</label>
      <img class="sig-img" src="${p['نسك_sig']||''}" alt="توقيع الحاج">
      <div style="margin-top:6px;font-size:12px">${p['اسم الحاج']||''}</div>
    </div>
    ${(repName || repSig || stamp) ? `
    <div class="sig-box">
      <label>ممثل الشركة</label>
      ${repName?`<div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:8px">${repName}</div>`:''}
      <div style="display:flex;gap:14px;justify-content:center;align-items:flex-start">
        ${repSig?`<div style="text-align:center">
          <img src="${repSig}" alt="توقيع الممثل" style="max-width:120px;max-height:60px;object-fit:contain;border:1px solid #eee;border-radius:4px;background:#fafafa">
          <div style="font-size:10px;color:#888;margin-top:3px">التوقيع</div>
        </div>`:''}
        ${stamp?`<div style="text-align:center">
          <img src="${stamp}" alt="ختم" style="max-width:70px;max-height:70px;object-fit:contain">
          <div style="font-size:10px;color:#888;margin-top:3px">الختم</div>
        </div>`:''}
      </div>
      <div style="margin-top:8px;font-size:11px;color:#666">${companyName}</div>
    </div>
    ` : `
    <div class="sig-box">
      <label>ممثل الشركة والختم الرسمي</label>
      <div style="height:80px;border:1px dashed #ccc;border-radius:6px"></div>
      <div style="margin-top:6px;font-size:12px;font-weight:600">${companyName}</div>
    </div>
    `}
  </div>
  <div class="footer">تم إنشاء هذا الإقرار إلكترونياً — ${p['نسك_time']||''}</div>
  <div class="no-print" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 30px;background:#3d2000;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">🖨️ طباعة</button>
  </div>
  </body></html>`);
  w.document.close();
}



// ===== v11.5 Phase 2/5 openSupBulkAck extracted → supervisor.js =====

function toggleAllNusuk(cb) {
  document.querySelectorAll('.nusuk-row-check').forEach(c => c.checked = cb.checked);
  updateNusukBulkBar();
}

function updateNusukBulkBar() {
  const checks = document.querySelectorAll('.nusuk-row-check:checked');
  const bar = document.getElementById('nusuk-bulk-bar');
  const count = document.getElementById('nusuk-selected-count');
  const all = document.getElementById('nusuk-check-all');
  const total = document.querySelectorAll('.nusuk-row-check').length;
  if(bar) bar.style.display = checks.length ? 'flex' : 'none';
  if(count) count.textContent = `تم تحديد ${checks.length} حاج`;
  if(all) all.indeterminate = checks.length > 0 && checks.length < total;
  if(all) all.checked = checks.length === total && total > 0;
}

function clearNusukSelection() {
  document.querySelectorAll('.nusuk-row-check').forEach(c => c.checked = false);
  const all = document.getElementById('nusuk-check-all');
  if(all) { all.checked = false; all.indeterminate = false; }
  updateNusukBulkBar();
}

async function applyBulkNusuk() {
  const status = document.getElementById('nusuk-bulk-status').value;
  if(!status) { showToast('اختر الحالة الجديدة أولاً', 'warning'); return; }

  // v23.0-pre-mm: تأكيد قبل التحديث الجماعي
  const checkedCount = document.querySelectorAll('.nusuk-row-check:checked').length;
  if(checkedCount === 0){
    showToast('⚠️ لم يتم تحديد أي حاج', 'warning');
    return;
  }

  const msg = `سيتم تحديث ${checkedCount} حاج إلى حالة "${status}"\n\nهل أنت متأكد؟`;
  const confirmed = (typeof showConfirm === 'function')
    ? await showConfirm(msg, 'تأكيد التحديث الجماعي', 'نعم، تحديث', '#c8971a', '⚠️')
    : confirm(msg);

  if(!confirmed) return;

  // v22.6: دفاع عميق — الحالات التي تتطلّب توقيعاً لا تُضبط من bulk admin مباشرة
  if(status === 'لدى المشرف' || status === 'مسلّمة للحاج'){
    showToast('⚠️ هذه الحالة تُضبط تلقائياً عند توقيع المشرف/الحاج — استخدم "لدى الإدارة" ثم دع المشرف يوقّع الإقرار', 'warning');
    return;
  }

  const allIds = [...document.querySelectorAll('.nusuk-row-check:checked')].map(c=>c.dataset.id);
  if(!allIds.length) return;

  // v20.2: فلترة المقفولة (superadmin يتجاوز)
  const isSuper = _isSuperAdmin();
  const lockedSkipped = [];
  let ids = allIds.filter(id => {
    const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
    const current = r?.['حالة بطاقة نسك'] || 'لم تطبع';
    const locked = _isNusukLocked(r) && current !== status;
    if(locked && !isSuper){ lockedSkipped.push(id); return false; }
    return true;
  });

  if(!ids.length){
    showToast(`🔒 جميع المحدَّدين (${lockedSkipped.length}) موقَّعون — استخدم 🔓 فتح القفل للتعديل`, 'warning');
    return;
  }

  // v22.1: قفل التسليم الصارم — 'مسلّمة للحاج' يتطلب توقيع المشرف (superadmin يتجاوز)
  const noSupAckSkipped = [];
  if(status === 'مسلّمة للحاج' && !isSuper){
    ids = ids.filter(id => {
      const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
      if((r?.['حالة بطاقة نسك'] || r?.nusuk_card_status || '') === 'لدى الإدارة'){ noSupAckSkipped.push(id); return false; }
      return true;
    });
    if(!ids.length){
      showToast(`🔒 جميع المحدَّدين (${noSupAckSkipped.length}) بلا استلام مشرف — يجب استلامها عبر المشرف أولاً`, 'warning');
      return;
    }
  }

  // v20.1: snapshot قبل التحديث لكل حاج (لـ audit)
  const beforeMap = new Map();
  ids.forEach(id => {
    const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
    beforeMap.set(String(id), { nusuk_card_status: r ? (r['حالة بطاقة نسك'] ?? null) : null });
  });

  try {
    await Promise.all(ids.map(id => window.DB.Pilgrims.update(parseInt(id), { nusuk_card_status: status })));
    ids.forEach(id => {
      const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
      if(r) r['حالة بطاقة نسك'] = status;
    });

    // v20.1: audit — N فردية + 1 ملخّص bulk
    const bulkSessionId = (crypto.randomUUID && crypto.randomUUID())
      || ('bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2,10));
    const bulkMeta = {
      source: 'admin_nusuk_bulk',
      bulk_session: bulkSessionId,
      bulk_target_field: 'nusuk_card_status',
      bulk_target_value: status,
      bulk_total_count: ids.length
    };
    if(isSuper && lockedSkipped.length === 0 && allIds.some(id => {
      const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
      return _isNusukLocked(r);
    })) bulkMeta.bypass_lock = true;
    ids.forEach(id => {
      const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(id));
      const changes = _buildFieldChanges(beforeMap.get(String(id)) || {}, { nusuk_card_status: status });
      if(!changes) return;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(id),
        entity_label: _buildPilgrimLabel(r),
        field_changes: changes,
        metadata: bulkMeta
      });
    });
    _recordAudit({
      action_type:  'bulk_update',
      entity_type:  'pilgrim',
      entity_id:    null,
      entity_label: `تحديث جماعي نسك: ${ids.length} حاج → ${status}`,
      field_changes: { nusuk_card_status: { before: null, after: status, note: 'bulk' } },
      bulk_ids:   ids,
      bulk_count: ids.length,
      metadata: bulkMeta
    });

    const skipMsg   = lockedSkipped.length   ? ` • تخطٍّ موقَّع: ${lockedSkipped.length}` : '';
    const noAckMsg  = noSupAckSkipped.length ? ` • بلا استلام مشرف: ${noSupAckSkipped.length}` : '';
    const totalSkip = lockedSkipped.length + noSupAckSkipped.length;
    showToast(`✅ تم تحديث ${ids.length} حاج${skipMsg}${noAckMsg}`, totalSkip ? 'warning' : 'success');
    clearNusukSelection();
    renderNusukTable(window._nusukFilter);
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function quickNusukUpdate(pilgrimId, status, selectEl) {
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId))||{};
  const currentStatus = pilgrim['حالة بطاقة نسك']||'لم تطبع';

  if(currentStatus === 'مسلّمة للحاج'){
    if(selectEl) selectEl.value = currentStatus;
    showToast('🔒 البطاقة مسلّمة للحاج ومقفلة — استخدم 🔓 للرجوع', 'warning');
    return;
  }

  // v23.0-pre-z: حماية التسلسل الصارم
  if(!_isSuperAdmin()){
    const allowed = _getAllowedNextStatuses(currentStatus);
    if(!allowed.includes(status)){
      if(selectEl) selectEl.value = currentStatus;
      showToast('⛔ لا يمكن القفز لهذه الحالة — استخدم المسار التسلسلي أو 🔓 للرجوع', 'warning');
      return;
    }
  }

  // v20.2: فحص القفل — superadmin يتجاوز مع bypass_lock في audit
  const bypassLock = _isNusukLocked(pilgrim) && status !== currentStatus && _isSuperAdmin();
  if(_isNusukLocked(pilgrim) && status !== currentStatus && !_isSuperAdmin()){
    if(selectEl) selectEl.value = currentStatus;
    showToast('🔒 البطاقة موقَّعة — استخدم 🔓 فتح القفل من Quick Edit', 'warning');
    return;
  }

  // v23.2.3: حظر التحديد اليدوي للحالات التي تتطلّب توقيع
  if (status === 'لدى المشرف' || status === 'مسلّمة للحاج') {
    if (selectEl) selectEl.value = currentStatus;
    showToast('⚠️ هذه الحالة تتطلّب توقيع - تتم عبر بوابة المشرف فقط', 'warning');
    return;
  }

  if(status==='لدى المشرف'||status==='مسلّمة للحاج') {
    // v23.0-pre-aa: حفظ الحالة الأصلية ليرجع إليها select إذا ألغى المستخدم
    if(selectEl){
      selectEl._originalStatus = currentStatus;
      // مراقبة: إذا خرج المستخدم بدون تحديث DB، أرجع القيمة
      const rollbackOnCancel = () => {
        setTimeout(() => {
          // تحقّق من الحالة الفعلية في ALL_DATA
          const fresh = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
          const actualStatus = (fresh && fresh['حالة بطاقة نسك']) || currentStatus;
          if(selectEl && selectEl.value !== actualStatus){
            selectEl.value = actualStatus;
          }
        }, 300);
      };

      // استخدام closeModals hook
      window._onModalClose = rollbackOnCancel;
      // auto-cleanup بعد 5 دقائق
      setTimeout(() => {
        if(window._onModalClose === rollbackOnCancel) window._onModalClose = null;
      }, 300000);
    }

    if(status==='لدى المشرف') { openSupAck(pilgrimId, pilgrim); return; }
    if(status==='مسلّمة للحاج') { openPilgrimAck(pilgrimId, pilgrim); return; }
  }
  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), { nusuk_card_status: status });
    const r = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
    if(r) r['حالة بطاقة نسك'] = status;

    // v20.2: audit — يشمل bypass_lock للـ superadmin
    const changes = _buildFieldChanges({ nusuk_card_status: currentStatus }, { nusuk_card_status: status });
    if(changes){
      const meta = { source: 'admin_nusuk_quick' };
      if(bypassLock) meta.bypass_lock = true;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(r),
        field_changes: changes,
        metadata: meta
      });
    }

    showToast(bypassLock ? '⚡ تم التعديل (تجاوز قفل — superadmin)' : 'تم تحديث الحالة', 'success');
    renderNusukTable(window._nusukFilter);
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function exportNusukReport() {
  // v23.0-pre-ff: فلترة + عنوان ديناميكي + توقيع اختياري
  const dev = window._devSettings||{};
  const companyName = dev.companyName||'';
  const license = dev.license||'';
  const repName = dev.rep_name||'';
  const repSig  = dev.rep_sig||'';
  const stamp   = dev.stamp||'';

  // خريطة عناوين التقارير حسب الفلتر
  const REPORT_TITLES = {
    '':              'بيان بأسماء الحجاج لبطاقات نسك',
    'لم تطبع':        'بيان بأسماء الحجاج الذين لم تُطبع بطاقات نسك لهم',
    'في الطباعة':     'بيان بأسماء الحجاج الذين بطاقاتهم قيد الطباعة',
    'لدى الإدارة':    'بيان بأسماء الحجاج الذين بطاقات نسك لديهم بالإدارة',
    'لدى المشرف':     'بيان بأسماء الحجاج الذين بطاقاتهم لدى المشرف',
    'مسلّمة للحاج':   'بيان بأسماء الحجاج الذين تم تسليم بطاقات نسك لهم'
  };

  // تطبيق نفس منطق الفلترة من renderNusukTable
  const currentFilter = window._nusukFilter || '';
  const search = (document.getElementById('nusuk-search')?.value||'').toLowerCase();
  const busFilter = document.getElementById('nusuk-bus-filter')?.value||'';

  const filteredList = ALL_DATA.filter(p => {
    const matchFilter = !currentFilter || (p['حالة بطاقة نسك']||'لم تطبع') === currentFilter;
    const matchSearch = !search || (p['اسم الحاج']||'').toLowerCase().includes(search) || (p['رقم الهوية']||'').includes(search);
    const matchBus = !busFilter || String(p['رقم الحافلة الخاصة بك']||'') === String(busFilter);
    return matchFilter && matchSearch && matchBus;
  });

  if(!filteredList.length){
    if(typeof showToast === 'function'){
      showToast('⚠️ لا توجد بيانات للطباعة بالفلترة الحالية', 'warning');
    } else {
      alert('لا توجد بيانات للطباعة بالفلترة الحالية');
    }
    return;
  }

  const reportTitle = REPORT_TITLES[currentFilter] || REPORT_TITLES[''];

  // سؤال المستخدم عن إضافة التوقيع/الختم
  const addSignature = await showConfirm(
    'هل ترغب في إضافة اسم ممثل الشركة والتوقيع والختم أسفل التقرير؟',
    '🖋️ إضافة التوقيع والختم',
    'نعم، أضف',
    '#c8971a',
    '🖋️'
  );

  // بناء التقرير
  const w = window.open('','_blank');
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});

  const rows = filteredList.map((p,i) => {
    const s = p['حالة بطاقة نسك']||'لم تطبع';
    const si = NUSUK_STATUSES.indexOf(s);
    return `<tr>
      <td>${i+1}</td><td style="text-align:right;font-weight:600">${p['اسم الحاج']||'—'}</td>
      <td>${p['رقم الهوية']||'—'}</td>
      <td>${p['رقم الجوال']||'—'}</td>
      <td>${p['رقم الحافلة الخاصة بك']||'—'}</td>
      <td style="color:${NUSUK_COLORS[si]||'#888'};font-weight:600">${s}</td>
      <td>${p['نسك_time']||'—'}</td>
    </tr>`;
  }).join('');

  // قسم التوقيع (اختياري)
  const signatureSection = addSignature ? `
    <div style="margin-top:18mm;padding-top:6mm;border-top:2px solid #b8860b;page-break-inside:avoid;display:flex;justify-content:flex-end;direction:rtl">
      <div style="text-align:center;min-width:220px">
        <div style="font-size:13px;font-weight:bold;color:#3d2000;margin-bottom:2mm">${companyName}</div>
        ${license?`<div style="font-size:11px;color:#555;margin-bottom:3mm">رقم الترخيص: ${license}</div>`:''}
        ${repName?`<div style="font-size:12px;font-weight:700;color:#3d2000;margin-bottom:4mm">ممثل الشركة: ${repName}</div>`:''}
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:10mm;margin-top:3mm">
          <div style="text-align:center">
            ${repSig?`<img src="${repSig}" alt="توقيع" style="max-width:140px;max-height:60px;object-fit:contain;border:1px solid #eee;border-radius:4px;padding:3px;background:#fafafa">`:'<div style="height:60px;width:140px;border:1px dashed #ccc;border-radius:4px"></div>'}
            <div style="font-size:10px;color:#666;margin-top:2mm">التوقيع</div>
          </div>
          <div style="text-align:center">
            ${stamp?`<img src="${stamp}" alt="ختم" style="max-width:75px;max-height:75px;object-fit:contain">`:'<div style="height:75px;width:75px;border:1px dashed #ccc;border-radius:4px"></div>'}
            <div style="font-size:10px;color:#666;margin-top:2mm">الختم الرسمي</div>
          </div>
        </div>
      </div>
    </div>
  ` : '';

  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${reportTitle}</title>
  <style>
    @page{size:A4 landscape;margin:8mm 10mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#222;margin:0}
    .hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:3px solid #b8860b;padding-bottom:4mm;margin-bottom:3mm}
    .co-name{font-size:15px;font-weight:bold;color:#3d2000}
    .co-sub{font-size:11px;color:#555;margin-top:2px}
    .dt-sub{font-size:11px;color:#3d2000;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    thead{display:table-header-group}
    th{background:#d0d0d0;color:#333;padding:3px 6px;text-align:center;font-size:11px;border:1px solid #ccc;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    td{padding:3px 6px;border:1px solid #e0d0b0;font-size:10px;text-align:center}
    tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body>
  <table style="width:100%;border-collapse:collapse">
    <thead style="display:table-header-group">
      <tr><td colspan="7" style="padding-bottom:4mm;border-bottom:3px solid #b8860b;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div class="hdr">
          <div style="text-align:right">
            <div class="co-name">${companyName}</div>
            ${license?`<div class="co-sub">رقم الترخيص: ${license}</div>`:''}
          </div>
          <div style="text-align:center">
            ${_buildPrintLogoHTML(60)}
            <div style="font-size:14px;font-weight:bold;color:#3d2000;margin-top:4px">📋 ${reportTitle}</div>
          </div>
          <div style="text-align:right;width:fit-content;margin:0 auto">
            <div class="dt-sub">التاريخ: ${today}</div>
            <div class="dt-sub">وقت الطباعة: ${timeStr}</div>
            <div class="dt-sub">عدد الحجاج: <strong>${filteredList.length}</strong></div>
          </div>
        </div>
      </td></tr>
      <tr><th>#</th><th>اسم الحاج</th><th>رقم الهوية</th><th>رقم الجوال</th><th>الحافلة</th><th>حالة البطاقة</th><th>وقت التسليم</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${signatureSection}
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}

// v23.0-pre-mmm: تصدير دالة فحص صلاحية إعادة فتح نسك للمشرف
window._canReopenNusuk = _canReopenNusuk;

