// ═══════════════════════════════════════════════════════════════════════
// Dashboard Module — v19.0
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - State: window._dashCharts
//   - Main: renderDashboard
//   - Subrenderers: _renderDashKPI, _renderDashCharts, _renderDashAlerts,
//                   _renderDashActivity, _renderDashQuickActions
//
// Dependencies (globals):
//   - Chart (from CDN)
//   - ALL_DATA, window._campsCache
//   - window.DB.Audit.getAll
//   - switchTab, showHousingSection, switchCfg
//   - _formatTimeAgo, _esc
// ═══════════════════════════════════════════════════════════════════════

window._dashCharts = {};

async function renderDashboard(){
  try {
    _renderDashKPI();
    _renderDashCharts();
    _renderDashAlerts();
    _renderDashQuickActions();
    await _renderDashActivity();
  } catch(e){ console.error('[dashboard]', e); }
}

function _renderDashKPI(){
  const grid = document.getElementById('dash-kpi-grid');
  if(!grid) return;
  const total = (window.ALL_DATA||[]).length;
  if(!total){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">لا توجد بيانات حجاج بعد</div>';
    return;
  }
  const confirmed    = ALL_DATA.filter(p => p['حالة الحجز'] === 'مؤكد').length;
  const paid         = ALL_DATA.filter(p => p['حالة الدفع'] === 'مدفوع').length;
  const minaHoused   = ALL_DATA.filter(p => p.mina_camp && p.mina_bed).length;
  const arafatHoused = ALL_DATA.filter(p => p.arafat_camp && p.arafat_bed).length;
  const boarded      = ALL_DATA.filter(p => p['حالة الإركاب'] === 'ركب').length;
  const kpis = [
    { icon:'👥', label:'إجمالي الحجاج',  value:total,         max:total, color:'#7a4500' },
    { icon:'✅', label:'حجوزات مؤكّدة', value:confirmed,     max:total, color:'#2e7d32' },
    { icon:'💰', label:'مدفوعات',        value:paid,          max:total, color:'#c8971a' },
    { icon:'🏕️', label:'تسكين منى',     value:minaHoused,    max:total, color:'#1a5fa8' },
    { icon:'🏕️', label:'تسكين عرفات',  value:arafatHoused,  max:total, color:'#7a4500' },
    { icon:'🚌', label:'إركاب',          value:boarded,       max:total, color:'#1a7a1a' }
  ];
  const progressColor = pct => pct < 30 ? '#c00' : (pct < 80 ? '#c07000' : '#2e7d32');
  grid.innerHTML = kpis.map(k => {
    const pct = k.max > 0 ? Math.round((k.value / k.max) * 100) : 0;
    return `<div class="dash-kpi-card" style="border-right-color:${k.color}">
      <div class="dash-kpi-header">
        <div class="dash-kpi-icon">${k.icon}</div>
        <div style="font-size:11px;color:#999;font-weight:600">${pct}%</div>
      </div>
      <div class="dash-kpi-value">${k.value.toLocaleString('ar-EG')}</div>
      <div class="dash-kpi-label">${k.label}</div>
      <div class="dash-kpi-progress"><div class="dash-kpi-progress-bar" style="width:${pct}%;background:${progressColor(pct)}"></div></div>
    </div>`;
  }).join('');
}

function _renderDashCharts(){
  if(typeof Chart === 'undefined'){ console.warn('[dashboard] Chart.js not loaded'); return; }
  Object.values(window._dashCharts).forEach(c => { try { c.destroy(); } catch(_){} });
  window._dashCharts = {};

  // 1) Nationality Pie — top 5 + أخرى
  const natCounts = {};
  (ALL_DATA||[]).forEach(p => {
    const n = p['الجنسية'] || 'غير محدّد';
    natCounts[n] = (natCounts[n] || 0) + 1;
  });
  const natEntries = Object.entries(natCounts).sort((a,b) => b[1]-a[1]);
  const top5 = natEntries.slice(0,5);
  const others = natEntries.slice(5).reduce((s, x) => s + x[1], 0);
  if(others > 0) top5.push(['أخرى', others]);
  const natCanvas = document.getElementById('dash-chart-nationality');
  if(natCanvas && top5.length){
    window._dashCharts.nationality = new Chart(natCanvas, {
      type: 'pie',
      data: { labels: top5.map(x=>x[0]), datasets: [{ data: top5.map(x=>x[1]), backgroundColor: ['#c8971a','#7a4500','#1a5fa8','#2e7d32','#c07000','#999'] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{ size:11 } } } } }
    });
  }

  // 2) Booking Status Bar
  const bookingStatuses = ['مؤكد','ملغي','معلق','مكتمل'];
  const bookingCounts = bookingStatuses.map(s => (ALL_DATA||[]).filter(p => p['حالة الحجز']===s).length);
  const bookingCanvas = document.getElementById('dash-chart-booking');
  if(bookingCanvas){
    window._dashCharts.booking = new Chart(bookingCanvas, {
      type: 'bar',
      data: { labels: bookingStatuses, datasets: [{ data: bookingCounts, backgroundColor: ['#2e7d32','#c00','#c07000','#1a5fa8'] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
    });
  }

  // 3) Pilgrim Type Doughnut
  const typeCounts = {};
  (ALL_DATA||[]).forEach(p => {
    const t = p['نوع الحاج'] || 'غير محدّد';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeCanvas = document.getElementById('dash-chart-type');
  if(typeCanvas && Object.keys(typeCounts).length){
    window._dashCharts.type = new Chart(typeCanvas, {
      type: 'doughnut',
      data: { labels: Object.keys(typeCounts), datasets: [{ data: Object.values(typeCounts), backgroundColor: ['#c8971a','#1a5fa8','#2e7d32','#7a4500','#c07000','#7a3fa8'] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{ size:11 } } } } }
    });
  }

  // 4) Camps Occupancy — horizontal bar
  const campOcc = {};
  (ALL_DATA||[]).forEach(p => {
    if(p.mina_camp){
      if(!campOcc[p.mina_camp]) campOcc[p.mina_camp] = { occupied:0, capacity:0 };
      campOcc[p.mina_camp].occupied++;
    }
  });
  if(window._campsCache){
    window._campsCache.forEach(c => {
      const num = c.camp_num || c.name;
      if(campOcc[num]) campOcc[num].capacity = parseInt(c.capacity) || 0;
    });
  }
  const top10 = Object.entries(campOcc)
    .map(([num,d]) => ({ num, occupied:d.occupied, capacity:d.capacity, pct: d.capacity>0 ? (d.occupied/d.capacity)*100 : 0 }))
    .sort((a,b) => b.pct - a.pct).slice(0,10);
  const campsCanvas = document.getElementById('dash-chart-camps');
  if(campsCanvas && top10.length){
    window._dashCharts.camps = new Chart(campsCanvas, {
      type: 'bar',
      data: { labels: top10.map(c => 'مخيم ' + c.num), datasets: [{
        label: 'الإشغال (%)', data: top10.map(c => Math.round(c.pct)),
        backgroundColor: top10.map(c => c.pct >= 95 ? '#c00' : (c.pct >= 75 ? '#c07000' : '#2e7d32'))
      }] },
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, max:100 } } }
    });
  }
}

function _renderDashAlerts(){
  const list = document.getElementById('dash-alerts-list');
  if(!list) return;
  const alerts = [];
  const all = window.ALL_DATA || [];

  const noMina = all.filter(p => !p.mina_camp).length;
  if(noMina > 0) alerts.push({ priority:'high', icon:'🔴', text: noMina + ' حاج بدون مخيم منى', onclick:()=>switchTab('data') });

  const noArafat = all.filter(p => !p.arafat_camp).length;
  if(noArafat > 0) alerts.push({ priority:'high', icon:'🔴', text: noArafat + ' حاج بدون مخيم عرفات', onclick:()=>switchTab('data') });

  const unpaid = all.filter(p => p['حالة الدفع'] === 'غير مدفوع').length;
  if(unpaid > 0) alerts.push({ priority:'medium', icon:'🟡', text: unpaid + ' حاج لم يسدّد', onclick:()=>switchTab('data') });

  let crowdedCamps = 0;
  if(window._campsCache){
    const campOcc = {};
    all.forEach(p => { if(p.mina_camp) campOcc[p.mina_camp] = (campOcc[p.mina_camp]||0) + 1; });
    window._campsCache.forEach(c => {
      const num = c.camp_num || c.name;
      const cap = parseInt(c.capacity) || 0;
      const occ = campOcc[num] || 0;
      if(cap > 0 && occ/cap >= 0.95) crowdedCamps++;
    });
  }
  if(crowdedCamps > 0) alerts.push({
    priority:'medium', icon:'🟡', text: crowdedCamps + ' مخيم مكتظّ (>95%)',
    onclick:()=>{ switchTab('housing'); setTimeout(()=>showHousingSection('camps'), 150); }
  });

  const notBoarded = all.filter(p => p['حالة الإركاب'] !== 'ركب').length;
  if(notBoarded > 0 && all.length > 0) alerts.push({ priority:'low', icon:'🔵', text: notBoarded + ' حاج لم يركب', onclick:()=>switchTab('data') });

  const noNusuk = all.filter(p => {
    const s = p['حالة بطاقة نسك'];
    return s !== 'مسلّمة للحاج' && s !== 'مسلمة';
  }).length;
  if(noNusuk > 0 && all.length > 0) alerts.push({ priority:'low', icon:'🔵', text: noNusuk + ' حاج لم يستلم بطاقة نسك', onclick:()=>switchTab('data') });

  const order = { high:0, medium:1, low:2 };
  alerts.sort((a,b) => order[a.priority] - order[b.priority]);

  if(!alerts.length){
    list.innerHTML = '<div class="dash-alert-empty">✨ كل شيء بخير!</div>';
    return;
  }
  list.innerHTML = alerts.map((a,i) => `<div class="dash-alert-item dash-alert-${a.priority}" data-idx="${i}">
    <span class="dash-alert-icon">${a.icon}</span>
    <span class="dash-alert-text">${a.text}</span>
    <button class="dash-alert-action">عرض ←</button>
  </div>`).join('');
  list.querySelectorAll('.dash-alert-item').forEach((el,i) => {
    el.addEventListener('click', () => { if(alerts[i].onclick) alerts[i].onclick(); });
  });
}

async function _renderDashActivity(){
  const list = document.getElementById('dash-activity-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">⏳ جاري التحميل...</div>';
  try {
    const result = await window.DB.Audit.getAll({ pageSize: 10, page: 1 });
    const activities = result.data || [];
    if(!activities.length){ list.innerHTML = '<div class="dash-alert-empty">لا توجد عمليات بعد</div>'; return; }
    const iconMap = { update:'🔄', create:'➕', delete:'🗑️', bulk_update:'⚡', bulk_delete:'🗑️', undo:'↶' };
    list.innerHTML = activities.map(entry => {
      const time = (typeof _formatTimeAgo === 'function')
        ? _formatTimeAgo(new Date(entry.timestamp).getTime())
        : new Date(entry.timestamp).toLocaleString('ar-EG');
      const icon = iconMap[entry.action_type] || '📝';
      const user = entry.user_name || entry.user_id || '—';
      const label = entry.entity_label || (entry.bulk_count ? (entry.bulk_count + ' عنصر') : '—');
      return `<div class="dash-activity-item">
        <span class="dash-activity-icon">${icon}</span>
        <div class="dash-activity-content">
          <div class="dash-activity-text"><b>${_esc(user)}</b> — ${_esc(label)}</div>
          <div class="dash-activity-time">${_esc(time)}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e){
    console.error('[dash-activity]', e);
    list.innerHTML = '<div class="dash-alert-empty">❌ تعذّر تحميل النشاطات</div>';
  }
}

function _renderDashQuickActions(){
  const container = document.getElementById('dash-quick-actions');
  if(!container) return;
  const actions = [
    { icon:'📥', label:'استيراد Excel',        onclick: "switchTab('settings');setTimeout(function(){if(typeof switchCfg==='function')switchCfg('import')},150)" },
    { icon:'🏕️', label:'إدارة المخيمات',      onclick: "switchTab('housing');setTimeout(function(){if(typeof showHousingSection==='function')showHousingSection('camps')},150)" },
    { icon:'👤', label:'إدارة المستخدمين',   onclick: "switchTab('users')" },
    { icon:'📢', label:'نشر تعميم',            onclick: "switchTab('ann')" },
    { icon:'📜', label:'سجل العمليات',        onclick: "switchTab('audit')" }
  ];
  container.innerHTML = actions.map(a => `<button class="dash-quick-btn" onclick="${a.onclick}">
    <span class="dash-quick-btn-icon">${a.icon}</span>
    <span class="dash-quick-btn-label">${a.label}</span>
  </button>`).join('');
}
