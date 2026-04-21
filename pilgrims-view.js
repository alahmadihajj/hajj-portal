// ═══════════════════════════════════════════════════════════════════════
// Pilgrims View Module — v11.5 Phase 4c/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Camp View tracking + helpers + column sort + link pilgrim (Block A)
//   - filterCampView + Unassigned flow + saveUnassignedPilgrim + printUnassignedReport (Block B)
//   - UA modification tracking (Block C)
//   - General helpers: getRelatedPilgrims, isRelated, _sortCamps, _campOptionLabel, _buildCampSelect
//
// Dependencies (globals):
//   - ui-helpers.js:    showToast, showConfirm, showActionModal
//   - audit.js:         _recordAudit, _buildPilgrimLabel, _buildFieldChanges
//   - bulk-pipeline.js: _applyBedAssignment, _normalizeBedId, _fieldChanged, _summarizeUpdates,
//                       _filterAuditSyncArtifacts, _executeBulkPipeline, _genderOf
//   - pilgrims.js:      showBookingGroup, openPilgrimQuickEdit, openPilgrimAssign
//   - admin.html:       ALL_DATA, loadData, render, getCamps/Groups/Buses, openModal, closeModals
//   - housing.js:       showCampPilgrims, renderCamps
//   - supabase.js:      window.DB.Pilgrims.*
// ═══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────
// Block A — CV tracking + Column sort + Link pilgrim + misc
// (was admin.html L5890-6169)
// ─────────────────────────────────────────────
// ===== نظام تتبع التعديلات غير المحفوظة =====
window._modifiedRows = new Set();

function markRowModified(pilgrimId) {
  if(!window._modifiedRows) window._modifiedRows = new Set();
  window._modifiedRows.add(String(pilgrimId));
  const row = document.getElementById('camp-row-'+pilgrimId);
  if(row) row.classList.add('row-modified');
}


function toggleCVAll(checked) {
  document.querySelectorAll('.cv-chk').forEach(cb=>cb.checked=checked);
  updateCVSelCount();
}
function updateCVSelCount() {
  const n = document.querySelectorAll('.cv-chk:checked').length;
  const el = document.getElementById('cv-sel-count');
  if(el) el.textContent = n>0 ? 'محدد: '+n : '';
}
function checkCVBulkCamp() {
  const campNum = document.getElementById('cv-bulk-camp')?.value;
  const infoEl = document.getElementById('cv-bulk-camp-info');
  if(!infoEl||!campNum) { if(infoEl) infoEl.textContent=''; return; }
  const { fieldKey, bedKey, locCamps } = window._campViewData;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) return;
  const cap = parseInt(camp.capacity)||0;
  const occupied = ALL_DATA.filter(p=>p[fieldKey]===campNum && p[bedKey]).length;
  const available = cap - occupied;
  if(available > 0) {
    infoEl.innerHTML = '<strong style="font-size:13px">الطاقة: '+cap+' | مُسكَّن: '+occupied+' | <span style=\"color:#1a7a1a;font-size:14px;font-weight:800\">متاح: '+available+'</span></strong>';
  } else {
    infoEl.innerHTML = '<strong style="font-size:13px;background:#fde8e8;color:#c00;padding:3px 10px;border-radius:8px;border:1.5px solid #f5c6c6">⛔ المخيم ممتلئ — السعة: '+cap+'</strong>';
  }
}
async function applyCVBulk() {
  const selected = [...document.querySelectorAll('.cv-chk:checked')].map(cb=>cb.dataset.id);
  const campNum = document.getElementById('cv-bulk-camp')?.value;
  if(!selected.length) return showToast('حدد حاجاً واحداً على الأقل','warning');
  if(!campNum) return showToast('اختر رقم المخيم','warning');
  const { fieldKey, bedKey, locCamps, location } = window._campViewData;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) return showToast('المخيم غير موجود','error');
  const cap = parseInt(camp.capacity)||0;
  const bookedBeds = ALL_DATA.filter(p=>p[fieldKey]===campNum && p[bedKey]).map(p=>p[bedKey]);
  const availBeds = [];
  for(let i=1;i<=cap;i++){
    const v=campNum+'-'+i;
    if(!bookedBeds.includes(v)) availBeds.push(v);
  }
  if(selected.length > availBeds.length) {
    return showToast('الأسرة المتاحة في المخيم '+campNum+' هي '+availBeds.length+' فقط — حددت '+selected.length+' حاج','warning');
  }
  // فحص الجنس
  let genderWarning = false;
  for(const pid of selected){
    const p = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pid));
    if(!p||!camp.camp_type) continue;
    const g = p['الجنس']||'';
    const isFemale = g==='أنثى'||g==='أنثي'||g==='female'||g==='انثى';
    if(camp.camp_type==='نساء'&&!isFemale){ genderWarning=true; break; }
    if(camp.camp_type==='رجال'&&isFemale){ genderWarning=true; break; }
  }
  if(genderWarning) {
    showToast('⛔ لا يمكن التسكين — بعض الحجاج لا يتطابق جنسهم مع نوع المخيم', 'error', 4000);
    return;
  }
  const ok = await showConfirm('نقل '+selected.length+' حاج إلى المخيم '+campNum+' بالترتيب التلقائي؟','نقل جماعي','نعم، نفّذ','#c8971a','⚡');
  if(!ok) return;
  const fieldKeyMap = fieldKey==='mina_camp' ? {camp:'mina_camp',bed:'mina_bed',seat:'mina_seat'} : {camp:'arafat_camp',bed:'arafat_bed',seat:'arafat_seat'};
  let done=0;
  for(let i=0;i<selected.length;i++){
    const pid=selected[i]; const bed=availBeds[i];
    try{
      const updates={};
      updates[fieldKeyMap.camp]=campNum;
      updates[fieldKeyMap.bed]=bed;
      updates[fieldKeyMap.seat]=bed;
      await window.DB.Pilgrims.update(parseInt(pid),updates);
      const idx=ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
      if(idx>=0){ ALL_DATA[idx][fieldKey]=campNum; ALL_DATA[idx][bedKey]=bed; }
      done++;
    }catch(e){ console.error(e); }
  }
  showToast('تم نقل '+done+' حاج إلى المخيم '+campNum,'success');
  renderCamps();
  showCampPilgrims(campNum, location);
}


// ===== ترتيب الأعمدة في النوافذ =====
window._cvSort = {col:null, dir:1};
window._gpSort = {col:null, dir:1};
window._ugSort = {col:null, dir:1};

function _thSort(id, label, sortState, prefix) {
  const isActive = sortState && sortState.col===id;
  const arrow = isActive ? (sortState.dir===1 ? ' ▲' : ' ▼') : ' ⇅';
  const p = prefix || (sortState===window._cvSort?'cv':sortState===window._uaSort?'ua':'gp');
  const activeBg = 'background:rgba(200,151,26,.55);border-bottom:2px solid #c8971a;';
  const hoverBg = 'rgba(255,255,255,.13)';
  return `<th style="padding:9px 10px;cursor:pointer;user-select:none;white-space:nowrap;position:relative;${isActive?activeBg:''}"
    onclick="_doSort('${id}','${p}')">
    ${label}<span style="font-size:10px;opacity:${isActive?1:.45};font-weight:${isActive?700:400};margin-right:3px">${arrow}</span>
    <div style="position:absolute;left:0;top:20%;height:60%;width:3px;cursor:col-resize;border-radius:2px;background:rgba(255,255,255,.25)" onmousedown="event.stopPropagation();initColResize(event,this.parentElement)"></div>
  </th>`;
}

function _doSort(col, prefix) {
  if(prefix==='ua') {
    if(!window._uaSort) window._uaSort={col:null,dir:1};
    if(window._uaSort.col===col) window._uaSort.dir*=-1; else {window._uaSort.col=col; window._uaSort.dir=1;}
    window._uaSortCol = col;
    window._uaSortDir = window._uaSort.dir===1?'asc':'desc';
    renderUATable();
    _refreshUAHeader();
    return;
  }
  if(prefix==='ug') {
    if(!window._ugSort) window._ugSort={col:null,dir:1};
    if(window._ugSort.col===col) window._ugSort.dir*=-1; else {window._ugSort.col=col; window._ugSort.dir=1;}
    _renderUGTable(); _refreshUGHeader(); return;
  }
  if(prefix==='bp') {
    if(!window._busSort) window._busSort={col:null,dir:1};
    if(window._busSort.col===col) window._busSort.dir*=-1; else {window._busSort.col=col; window._busSort.dir=1;}
    _renderBPTable(); return;
  }
  if(prefix==='main') {
    doSort(col); return;
  }
  const state = prefix==='cv' ? window._cvSort : window._gpSort;
  if(state.col===col) state.dir*=-1; else {state.col=col; state.dir=1;}
  if(prefix==='cv') filterCampView();
  else _renderGPTable();
}



function _refreshUGHeader() {
  const th = document.getElementById('ug-thead-row');
  if(!th) return;
  if(!window._ugSort) window._ugSort={col:null,dir:1};
  th.innerHTML = '<th style="padding:9px 8px">☑</th><th style="padding:9px 8px">#</th>'
    +[['name','الاسم'],['id','الهوية'],['phone','الجوال'],['nat','الجنسية'],['city','المدينة'],['status','حالة الحجز'],['bus','الحافلة']].map(([id,lbl])=>_thSort(id,lbl,window._ugSort,'ug')).join('')
    +'<th style="padding:9px 8px">الفوج</th><th style="padding:9px 8px">حفظ</th>';
}

function _refreshGPHeader() {
  const th = document.getElementById('gp-thead-row');
  if(!th) return;
  if(!window._gpSort) window._gpSort={col:null,dir:1};
  th.innerHTML = '<th style="padding:9px 8px;text-align:center">☑</th><th style="padding:9px 8px;text-align:center">#</th>'
    +[['name','الاسم'],['id','الهوية'],['phone','الجوال'],['nat','الجنسية'],['city','المدينة'],['status','حالة الحجز']].map(([id,lbl])=>_thSort(id,lbl,window._gpSort,'gp')).join('')
    +'<th style="padding:9px 8px">تغيير الفوج</th><th style="padding:9px 8px">حفظ</th>';
}

function _refreshUAHeader() {
  const th = document.getElementById('ua-thead-row');
  if(!th) return;
  if(!window._uaSort) window._uaSort={col:null,dir:1};
  th.innerHTML = '<th style="padding:9px 8px;text-align:center">☑</th><th style="padding:9px 8px">#</th>'
    +[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['booking','رقم الحجز'],['city','المدينة']].map(([id,lbl])=>_thSort(id,lbl,window._uaSort,'ua')).join('')
    +'<th style="padding:9px 8px">المخيم</th><th style="padding:9px 8px">السرير</th><th style="padding:9px 8px">حفظ</th>';
}

function _sortRows(rows, col, dir, fieldMap) {
  if(!col) return rows;
  return [...rows].sort((a,b)=>{
    const av = String(a.cells[fieldMap[col]]?.textContent||'');
    const bv = String(b.cells[fieldMap[col]]?.textContent||'');
    return av.localeCompare(bv,'ar',{numeric:true})*dir;
  });
}

// تغيير حجم الأعمدة
function initColResize(e, th) {
  e.preventDefault();
  const startX = e.clientX;
  const startW = th.offsetWidth;
  function onMove(e2) { th.style.width = Math.max(50, startW + e2.clientX - startX) + 'px'; th.style.minWidth = th.style.width; }
  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}



async function openLinkPilgrim(anchorId, bookingNum) {
  const area = document.getElementById('link-pilgrim-area');
  if(!area) return;
  area.innerHTML = `
    <div style="background:#f5f8ff;border:1.5px solid #b0c8f0;border-radius:10px;padding:12px;margin-top:10px">
      <div style="font-size:13px;font-weight:700;color:#1a5fa8;margin-bottom:8px">🔍 ابحث عن الحاج لربطه</div>
      <div style="display:flex;gap:8px">
        <input id="link-search-input" type="text" placeholder="اسم الحاج أو رقم الهوية أو رقم الحجز..."
          oninput="searchLinkPilgrim('${anchorId}')"
          style="flex:1;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
        <button onclick="document.getElementById('link-pilgrim-area').innerHTML=''" 
          style="padding:8px 12px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-size:12px">✕</button>
      </div>
      <div id="link-search-results" style="margin-top:8px;max-height:180px;overflow-y:auto"></div>
    </div>`;
  window._linkAnchorId = anchorId;
  window._linkBookingNum = bookingNum;
  setTimeout(()=>document.getElementById('link-search-input')?.focus(), 50);
}

function searchLinkPilgrim(anchorId) {
  const q = document.getElementById('link-search-input')?.value.trim().toLowerCase()||'';
  const resultsEl = document.getElementById('link-search-results');
  if(!resultsEl) return;
  if(q.length < 2) { resultsEl.innerHTML=''; return; }
  const results = _filterPilgrimsByQuery(q, { excludeIds: [anchorId], limit: 8 });
  if(!results.length){
    resultsEl.innerHTML = '<div class="plc-empty">لا توجد نتائج</div>';
    return;
  }
  resultsEl.innerHTML = results.map(p => _buildPilgrimCard(p, {
    showFields: ['id', 'booking'],
    action: {
      label: '🔗 ربط',
      onclick: `linkPilgrim('${anchorId}','${p['_supabase_id']}')`,
      color: 'info',
      ariaLabel: 'ربط ' + (p['اسم الحاج']||'الحاج') + ' بالحجز'
    }
  })).join('');
}

async function linkPilgrim(anchorId, targetId) {
  const anchor = ALL_DATA.find(p=>String(p['_supabase_id'])===String(anchorId));
  const target = ALL_DATA.find(p=>String(p['_supabase_id'])===String(targetId));
  if(!anchor||!target) return;
  // استخدم رقم الحجز الأول كـ booking_ref أو أنشئ واحداً جديداً
  const ref = anchor['booking_ref'] || anchor['رقم الحجز'] || String(Date.now());
  try {
    // ربط الاثنين بنفس booking_ref
    const updates = { booking_ref: ref };
    await window.DB.Pilgrims.update(parseInt(anchorId), updates);
    await window.DB.Pilgrims.update(parseInt(targetId), updates);
    // تحديث الذاكرة
    [anchorId, targetId].forEach(id => {
      const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(id));
      if(idx>=0) ALL_DATA[idx]['booking_ref'] = ref;
    });
    showToast('تم ربط الحجاج','success');
    // تحديث النافذة
    showBookingGroup(anchor['رقم الحجز']||'', anchorId, window._bookingCtx);
  } catch(e){ showToast('خطأ: '+e.message,'error'); }
}

async function unlinkPilgrim(targetId, bookingNum, anchorId) {
  const ok = await showConfirm('هل تريد فك ربط هذا الحاج من المجموعة؟','فك الربط','نعم، افصله','#c00','🔓');
  if(!ok) return;
  try {
    await window.DB.Pilgrims.update(parseInt(targetId), { booking_ref: null });
    const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(targetId));
    if(idx>=0) ALL_DATA[idx]['booking_ref'] = '';
    showToast('تم فك الربط','success');
    showBookingGroup(bookingNum, anchorId, window._bookingCtx);
  } catch(e){ showToast('خطأ: '+e.message,'error'); }
}

function handleModalOutsideClick(){
  const box = document.getElementById('modal-content');
  if(box && box.classList.contains('booking-group')){
    closeBookingGroup();
    return;
  }
  if(window._quickEditOpenedFrom === 'booking-group'){
    closeQuickEdit();
    return;
  }
  if(window._uaModifiedRows && window._uaModifiedRows.size > 0){
    closeUAModal();
  } else {
    closeModals();
  }
}

// ─────────────────────────────────────────────
// Block B — filterCampView + UA Flow + saveUnassignedPilgrim + printUnassignedReport
// (was admin.html L6173-7101)
// ─────────────────────────────────────────────
function filterCampView() {
  const q = (document.getElementById('cv-search')?.value||'').trim().toLowerCase();
  const city = document.getElementById('cv-f-city')?.value||'';
  const nat = document.getElementById('cv-f-nat')?.value||'';
  const gender = document.getElementById('cv-f-gender')?.value||'';
  const bus = document.getElementById('cv-f-bus')?.value||'';
  const { fieldKey, bedKey, campNum } = window._campViewData||{};
  const {col, dir} = window._cvSort;
  const _cvFieldMap = {name:'اسم الحاج',id:'رقم الهوية',nat:'الجنسية',gender:'الجنس',phone:'رقم الجوال',booking:'رقم الحجز',city:'المدينة',camp:fieldKey,bed:bedKey};
  const sortKey = _cvFieldMap[col]||col;

  // بناء قائمة الحجاج من ALL_DATA مباشرة
  let pilgrims = ALL_DATA.filter(p => p[fieldKey]===campNum);

  // فلترة
  pilgrims = pilgrims.filter(p => {
    if(q && ![(p['اسم الحاج']||''),(p['رقم الهوية']||''),(p['رقم الجوال']||'')].some(v=>v.toLowerCase().includes(q))) return false;
    if(city && p['المدينة']!==city) return false;
    if(nat && p['الجنسية']!==nat) return false;
    if(gender && p['الجنس']!==gender) return false;
    if(bus && String(p['رقم الحافلة الخاصة بك'])!==String(bus)) return false;
    return true;
  });

  // ترتيب من ALL_DATA مباشرة (لا يعتمد على نص الخلايا)
  if(sortKey) {
    pilgrims = [...pilgrims].sort((a,b)=>
      String(a[sortKey]||'').localeCompare(String(b[sortKey]||''),'ar',{numeric:true}) * dir
    );
  }

  // إظهار/إخفاء الصفوف حسب الترتيب الجديد
  const tbody = document.getElementById('cv-tbody');
  let rows = [...document.querySelectorAll('[id^="camp-row-"]')];
  rows.forEach(r=>r.style.display='none');

  if(tbody) {
    pilgrims.forEach(p => {
      const row = document.getElementById('camp-row-'+p['_supabase_id']);
      if(row) { row.style.display=''; tbody.appendChild(row); }
    });
  } else {
    // fallback: show by filter only
    rows.forEach(row => {
      const pid = row.id.replace('camp-row-','');
      const p = pilgrims.find(x=>String(x['_supabase_id'])===String(pid));
      row.style.display = p ? '' : 'none';
    });
  }

  // تحديث رأس الترتيب
  const thead = document.getElementById('cv-thead-row');
  if(thead) thead.innerHTML = '<th style="padding:9px 8px;text-align:center">☑</th><th style="padding:9px 8px">#</th>'
    +[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['booking','رقم الحجز'],['city','المدينة'],['camp','رقم المخيم'],['bed','رقم السرير']].map(([id,lbl])=>_thSort(id,lbl,window._cvSort,'cv')).join('')
    +'<th style="padding:9px 8px">إجراء</th>';

  const el = document.getElementById('camp-view-count');
  if(el) el.textContent = pilgrims.length + ' حاج';
}

async function closeCampModal() {
  const canClose = await checkUnsavedChanges();
  if(canClose !== null) {
    window._modifiedRows.clear();
    closeModals();
  }
}


async function checkUnsavedChanges() {
  if(!window._modifiedRows || window._modifiedRows.size === 0) return true;
  
  return new Promise(resolve => {
    const count = window._modifiedRows.size;
    // نافذة تنبيه مخصصة
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:440px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="font-size:44px;margin-bottom:12px">⚠️</div>
        <div style="font-size:17px;font-weight:700;color:#3d2000;margin-bottom:8px">تعديلات غير محفوظة</div>
        <div style="font-size:14px;color:#666;margin-bottom:24px;line-height:1.6">
          هناك <strong>${count}</strong> تعديلات تم إدخالها. هل تريد حفظ الكل؟
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button id="unsaved-yes" style="padding:12px 24px;background:#1a7a1a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">✅ نعم — حفظ الكل</button>
          <button id="unsaved-no" style="padding:12px 24px;background:#c00;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">❌ لا — تجاهل</button>
          <button id="unsaved-cancel" style="padding:12px 24px;background:#f5f5f5;color:#555;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">↩️ رجوع</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    document.getElementById('unsaved-cancel').onclick = () => { overlay.remove(); resolve(null); };
    
    document.getElementById('unsaved-no').onclick = () => {
      overlay.remove();
      // تأكيد ثانٍ
      showConfirm('هل أنت متأكد من تجاهل جميع التعديلات؟ لن يتم حفظ أي تغيير.', 'تأكيد التجاهل', 'نعم، تجاهل', '#c00', '⚠️').then(confirmed => {
        if(confirmed) { window._modifiedRows.clear(); resolve(true); }
        else resolve(null);
      });
    };
    
    document.getElementById('unsaved-yes').onclick = () => {
      overlay.remove();
      showConfirm('هل أنت متأكد من حفظ جميع التعديلات؟', 'تأكيد الحفظ', 'نعم، حفظ الكل', '#1a7a1a', '💾').then(async confirmed => {
        if(confirmed) {
          await saveAllModifiedRows();
          resolve(true);
        } else resolve(null);
      });
    };
  });
}

async function saveAllModifiedRows() {
  const ids = [...window._modifiedRows];
  const { fieldKey, bedKey, location } = window._campViewData || {};
  let saved = 0;
  for(const pilgrimId of ids) {
    const campSel = document.getElementById('camp-sel-'+pilgrimId);
    const bedSel = document.getElementById('bed-sel-'+pilgrimId);
    if(!campSel || !bedSel) continue;
    const campVal = campSel.value;
    const bedVal = bedSel.value;
    if(!bedVal) continue;
    const updates = {};
    if(fieldKey) updates[fieldKey] = campVal;
    if(bedKey) updates[bedKey] = bedVal;
    if(location==='منى') updates.mina_seat = bedVal;
    else if(location==='عرفات') updates.arafat_seat = bedVal;
    try {
      await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
      const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pilgrimId));
      if(idx>=0 && fieldKey) { ALL_DATA[idx][fieldKey]=campVal; ALL_DATA[idx][bedKey]=bedVal; }
      saved++;
    } catch(e) { console.error('Save error:', e); }
  }
  window._modifiedRows.clear();
  showToast('تم حفظ ' + saved + ' تعديل بنجاح', 'success');
  renderCamps();
}


// ===== تسكين من نافذة الغير مسكنين =====
async function openPilgrimAssignFromUnassigned(pilgrimId, location) {
  window._afterAssignLocation = location;
  await openPilgrimAssign(pilgrimId);
  // Override save button behavior
  const origSave = window.savePilgrimAssign;
  window._origSavePilgrimAssign = origSave;
}

// ===== الحجاج الغير مُسكَّنين =====
window._uaSortCol = null;
window._uaSortDir = 'asc';
window._uaSearch  = '';


function openUnassignedFromCamp(location) {
  window._uaFromCamp = true; // جاء من نافذة المخيم
  showUnassignedPilgrims(location);
}


function _returnFromUA() {
  if(window._uaFromCamp) {
    window._uaFromCamp = false;
    const { campNum, location } = window._campViewData||{};
    if(campNum && location) { showCampPilgrims(campNum, location); return; }
  }
  closeModals();
}

function showUnassignedPilgrims(location) {
  const fieldKey = location === 'منى' ? 'mina_camp' : location === 'عرفات' ? 'arafat_camp' : null;
  const bedKey   = location === 'منى' ? 'mina_bed'  : location === 'عرفات' ? 'arafat_bed'  : null;

  let unassigned;
  if(location === 'مزدلفة') {
    unassigned = ALL_DATA.filter(p => !_hasGroup(p));
  } else {
    unassigned = ALL_DATA.filter(p => !p[fieldKey] || p[fieldKey] === '');
  }

  const locLabel = location === 'منى' ? '🏕️ منى' : location === 'عرفات' ? '🌄 عرفات' : '🌙 مزدلفة';

  getCamps().then(camps => {
    window._campsCache = camps; // تغذية cache لـ helpers v15.4
    const locCamps = camps.filter(c => c.location === location);
    window._unassignedData = { fieldKey, bedKey, camps, locCamps, location, pilgrims: unassigned };
    window._uaModifiedRows = new Set();
    window._uaSort = {col:null, dir:1};
    window._uaSortCol = null;
    window._uaSortDir = 'asc';
    window._uaSearch = ''; window._uaCity = ''; window._uaNat = ''; window._uaGender = ''; window._uaBus = '';
  ['ua-f-city','ua-f-nat','ua-f-gender','ua-f-bus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    window._uaCity = ''; window._uaNat = ''; window._uaBus = '';

    openModal(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="font-size:18px;font-weight:700;color:#3d2000;margin:0">${locLabel} — الغير مُسكَّنين (<span id="ua-count">${unassigned.length}</span>)</h3>
        <div style="display:flex;gap:8px">
          <button onclick="printUnassignedReport('${location}')" style="padding:8px 14px;background:#1a5fa8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">🖨️ طباعة</button>
          <button onclick="closeUAModal()" style="padding:8px 14px;background:#f5f5f5;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">✕ إغلاق</button>
        </div>
      </div>
      ${!unassigned.length
        ? '<div style="text-align:center;padding:40px;color:#1a7a1a;font-size:16px;font-weight:600">✅ جميع الحجاج مُسكَّنون في ' + location + '</div>'
        : `<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
            <input id="ua-search-input" type="text" placeholder="🔍 بحث بالاسم أو الهوية أو الجوال..." oninput="filterUATable()" style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;outline:none">
            <select id="ua-f-city" onchange="filterUATable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
              <option value="">🏙️ كل المدن</option>
              ${[...new Set(unassigned.map(p=>p['المدينة']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
            </select>
            <select id="ua-f-nat" onchange="filterUATable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
              <option value="">🌍 كل الجنسيات</option>
              ${[...new Set(unassigned.map(p=>p['الجنسية']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
            </select>
            <select id="ua-f-gender" onchange="filterUATable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
              <option value="">⚧ كل الجنسين</option>
              ${[...new Set(unassigned.map(p=>p['الجنس']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
            </select>
            <select id="ua-f-bus" onchange="filterUATable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
              <option value="">🚌 كل الحافلات</option>
              ${[...new Set(unassigned.map(p=>p['رقم الحافلة الخاصة بك']).filter(Boolean))].sort((a,b)=>Number(a)-Number(b)).map(v=>`<option value="${v}">حافلة ${v}</option>`).join('')}
            </select>
            <button onclick="resetUATable()" style="padding:7px 12px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;white-space:nowrap">↺</button>
          </div>
          <div style="background:#fff8e1;border:1.5px solid #f0e0b0;border-radius:10px;padding:8px 14px;margin-bottom:10px;font-size:13px;color:#7a4500">
            ⚠️ يوجد <strong>${unassigned.length}</strong> حاج لم يتم تسكينهم في ${location} بعد
          </div>
          <!-- شريط التنفيذ الجماعي -->
          <div style="display:flex;gap:8px;align-items:center;background:#fff8e8;border:1.5px solid #f0e0b0;border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">
            <label style="font-size:13px;font-weight:600;color:#7a4500;display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="ua-check-all" onchange="toggleUAAll(this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
              تحديد الكل
            </label>
            <span id="ua-sel-count" style="font-size:12px;color:#888"></span>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:auto">
              <select id="ua-bulk-camp" onchange="checkUABulkCamp()" style="padding:6px 10px;border:1.5px solid #ddd;border-radius:7px;font-size:12px;font-family:inherit">
                <option value="">— اختر المخيم —</option>
                ${_buildCampSelectOptions(locCamps, fieldKey, bedKey)}
              </select>
              <span id="ua-bulk-camp-info" style="font-size:11px;color:#888"></span>
              <button onclick="applyUABulk()" style="padding:6px 14px;background:#c8971a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">⚡ تسكين جماعي</button>
            </div>
          </div>
          <div class="modal-table-wrap" style="max-height:50vh">
            <table id="ua-table" style="font-size:13px;min-width:850px">
            <colgroup><col style="width:40px"><col style="width:35px"><col style="width:160px"><col style="width:120px"><col style="width:90px"><col style="width:50px"><col style="width:110px"><col style="width:100px"><col style="width:80px"><col style="width:90px"><col style="width:80px"><col style="width:70px"></colgroup>
              <thead style="position:sticky;top:0;z-index:1">
                <tr id="ua-thead-row" style="background:linear-gradient(135deg,#b8860b,#c8971a);color:#fff">
                  <th style="padding:9px 8px;text-align:center">☑</th>
                  <th style="padding:9px 8px">#</th>
                  ${[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['booking','رقم الحجز'],['city','المدينة']].map(([id,lbl])=>_thSort(id,lbl,window._uaSort||{col:null,dir:1},'ua')).join('')}
                  <th style="padding:9px 8px">المخيم</th>
                  <th style="padding:9px 8px">السرير</th>
                  <th style="padding:9px 8px">حفظ</th>
                </tr>
              </thead>
              <tbody id="ua-tbody"></tbody>
            </table>
          </div>`}
    `);

    setTimeout(() => {
      const box = document.querySelector('.modal-box');
      if(box) { box.style.maxWidth='95vw'; box.style.width='95vw'; box.style.maxHeight='90vh'; }
      if(unassigned.length) renderUATable();
    }, 50);
  });
}


function toggleUAAll(checked) {
  document.querySelectorAll('.ua-bulk-chk').forEach(cb=>cb.checked=checked);
  updateUASelCount();
}
function updateUASelCount() {
  const n = document.querySelectorAll('.ua-bulk-chk:checked').length;
  const el = document.getElementById('ua-sel-count');
  if(el) el.textContent = n>0 ? 'محدد: '+n : '';
}
function checkUABulkCamp() {
  const campNum = document.getElementById('ua-bulk-camp')?.value;
  const infoEl = document.getElementById('ua-bulk-camp-info');
  if(!infoEl||!campNum) { if(infoEl) infoEl.textContent=''; return; }
  const { fieldKey, bedKey, locCamps } = window._unassignedData;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) return;
  const cap = parseInt(camp.capacity)||0;
  const occupied = ALL_DATA.filter(p=>p[fieldKey]===campNum && p[bedKey]).length;
  const available = cap - occupied;
  if(available > 0) {
    infoEl.innerHTML = '<strong style="font-size:13px">الطاقة: '+cap+' | مُسكَّن: '+occupied+' | <span style=\"color:#1a7a1a;font-size:14px;font-weight:800\">متاح: '+available+'</span></strong>';
  } else {
    infoEl.innerHTML = '<strong style="font-size:13px;background:#fde8e8;color:#c00;padding:3px 10px;border-radius:8px;border:1.5px solid #f5c6c6">⛔ المخيم ممتلئ — السعة: '+cap+'</strong>';
  }
}
async function applyUABulk() {
  const selected = [...document.querySelectorAll('.ua-bulk-chk:checked')].map(cb=>cb.dataset.id);
  const campNum = document.getElementById('ua-bulk-camp')?.value;
  if(!selected.length) return showToast('حدد حاجاً واحداً على الأقل','warning');
  if(!campNum) return showToast('اختر رقم المخيم','warning');
  const { fieldKey, bedKey, locCamps, location } = window._unassignedData;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) return showToast('المخيم غير موجود','error');
  const cap = parseInt(camp.capacity)||0;
  // الأسرة المحجوزة
  const bookedBeds = ALL_DATA.filter(p=>p[fieldKey]===campNum && p[bedKey]).map(p=>p[bedKey]);
  // الأسرة المتاحة بالترتيب
  const availBeds = [];
  for(let i=1;i<=cap;i++){
    const v=campNum+'-'+i;
    if(!bookedBeds.includes(v)) availBeds.push(v);
  }
  if(selected.length > availBeds.length) {
    return showToast('الأسرة المتاحة في المخيم '+campNum+' هي '+availBeds.length+' فقط — حددت '+selected.length+' حاج','warning');
  }
  // فحص الحجاج المحددين هل سُكِّنوا مسبقاً؟
  const alreadyAssigned = selected.filter(pid=>{
    const p = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pid));
    return p && p[fieldKey] && p[fieldKey]!=='';
  });
  if(alreadyAssigned.length) {
    const ok = await showConfirm(alreadyAssigned.length+' حاج لديهم تسكين مسبق — هل تريد تغيير تسكينهم؟','تنبيه','نعم، غيّر','#c8971a','⚠️');
    if(!ok) return;
  }
  // فحص الجنس
  let genderWarning = false;
  for(const pid of selected){
    const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pid));
    if(!pilgrim||!camp.camp_type) continue;
    const g = pilgrim['الجنس']||'';
    const isFemale = g==='أنثى'||g==='أنثي'||g==='female'||g==='انثى';
    if(camp.camp_type==='نساء'&&!isFemale){ genderWarning=true; break; }
    if(camp.camp_type==='رجال'&&isFemale){ genderWarning=true; break; }
  }
  if(genderWarning) {
    const ok = await showConfirm('بعض الحجاج المحددين لا يتطابق جنسهم مع نوع المخيم. هل تريد الاستمرار؟','تحذير الجنس','نعم','#c00','⚠️');
    if(!ok) return;
  }
  const ok = await showConfirm('تسكين '+selected.length+' حاج في المخيم '+campNum+' تلقائياً بالترتيب؟','تسكين جماعي','نعم، نفّذ','#c8971a','⚡');
  if(!ok) return;
  let done=0;
  const fieldKeyMap = fieldKey==='mina_camp' ? {camp:'mina_camp',bed:'mina_bed',seat:'mina_seat'} : {camp:'arafat_camp',bed:'arafat_bed',seat:'arafat_seat'};
  for(let i=0;i<selected.length;i++){
    const pid=selected[i]; const bed=availBeds[i];
    try{
      const updates={};
      updates[fieldKeyMap.camp]=campNum;
      updates[fieldKeyMap.bed]=bed;
      updates[fieldKeyMap.seat]=bed;
      await window.DB.Pilgrims.update(parseInt(pid),updates);
      const idx=ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
      if(idx>=0){
        ALL_DATA[idx][fieldKey]=campNum;
        ALL_DATA[idx][bedKey]=bed;
        ALL_DATA[idx]['__saved']=true;
      }
      done++;
    }catch(e){ console.error(e); }
  }
  showToast('تم تسكين '+done+' حاج في المخيم '+campNum,'success');
  renderCamps();
  renderUATable();
  checkUABulkCamp();
}


function _campOptionLabel(camp, fieldKey, bedKey) {
  const cNum = camp.camp_num||camp.name;
  const cap = parseInt(camp.capacity)||0;
  const occupied = fieldKey ? ALL_DATA.filter(p=>p[fieldKey]===cNum&&(bedKey?p[bedKey]:true)).length : 0;
  const avail = cap - occupied;
  const typeIcon = camp.camp_type==='رجال'?'👨':'نساء'===camp.camp_type?'👩':'';
  const availTxt = avail<=0 ? ' ⛔ ممتلئ' : ' — متاح: '+avail;
  return `${typeIcon?typeIcon+' ':''}${cNum}${availTxt} / ${cap}`;
}


// جلب كل الحجاج المرتبطين بحاج معين (رقم حجز مشترك أو booking_ref مشترك)
function getRelatedPilgrims(p) {
  const bn = p['رقم الحجز']||'';
  const ref = p['booking_ref']||'';
  return ALL_DATA.filter(x => {
    if(String(x['_supabase_id'])===String(p['_supabase_id'])) return false; // استثن نفسه
    const xbn = x['رقم الحجز']||'';
    const xref = x['booking_ref']||'';
    if(bn && xbn === bn) return true;        // نفس رقم الحجز
    if(ref && xref === ref) return true;     // نفس booking_ref
    if(bn && xref === bn) return true;       // booking_ref يساوي رقم الحجز
    if(ref && xbn === ref) return true;
    return false;
  });
}

function isRelated(p) {
  const bn = p['رقم الحجز']||'';
  const ref = p['booking_ref']||'';
  return ALL_DATA.some(x => {
    if(String(x['_supabase_id'])===String(p['_supabase_id'])) return false;
    const xbn = x['رقم الحجز']||'';
    const xref = x['booking_ref']||'';
    return (bn && xbn===bn)||(ref && xref===ref)||(bn && xref===bn)||(ref && xbn===ref);
  });
}

function _sortCamps(camps) {
  // المخيمات بدون نوع تُعامل كـ رجال
  return [...camps].sort((a,b) => {
    const aType = a.camp_type||'رجال';
    const bType = b.camp_type||'رجال';
    if(aType==='رجال' && bType!=='رجال') return -1;
    if(bType==='رجال' && aType!=='رجال') return 1;
    return String(a.camp_num||a.name).localeCompare(String(b.camp_num||b.name), undefined, {numeric:true});
  });
}

/**
 * Helper مركزي لبناء <option>s لـ <select> مخيم (v16.3).
 * يُستخدم في 6 شاشات: cv-bulk, ua-bulk, data-bulk, assign modal (mina+arafat), per-row.
 * @param {Array<Object>} locCamps — قائمة مخيمات موقع واحد
 * @param {string} fieldKey — مفتاح المخيم في ALL_DATA (mina_camp/arafat_camp)
 * @param {string} bedKey   — مفتاح السرير في ALL_DATA (mina_bed/arafat_bed)
 * @param {Object} [opts]
 * @param {'full'|'short'} [opts.capFormat='full'] — 'full'="— متاح: X / Y"، 'short'="— متاح X"
 * @param {string} [opts.selected] — القيمة المختارة (لـ assign modal + per-row)
 * @param {string} [opts.excludePilgrimId] — يستثني هذا الحاج من حساب الإشغال + يسمح ببقائه في مخيمه الحالي حتى لو مُمتلئ
 * @returns {string} HTML للـ <option>s مع <optgroup> حسب الجنس
 */
// ===== v11.5 Phase 3b _buildCampSelectOptions extracted → bulk-pipeline.js =====

function _buildCampSelect(camps, selectedVal, fieldKey, bedKey, extraStyle) {
  const sorted = _sortCamps(camps);
  const style = extraStyle||'padding:9px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;width:100%';
  let opts = '<option value="">— اختر المخيم —</option>';
  let lastType = null;
  sorted.forEach(camp => {
    const t = camp.camp_type||'';
    if(t !== lastType) {
      const groupLabel = (t===''||t==='رجال')?'👨 رجال':t==='نساء'?'👩 نساء':'👨 رجال';
      opts += `<optgroup label="${groupLabel}">`;
      lastType = t;
    }
    const cNum = camp.camp_num||camp.name;
    const label = _campOptionLabel(camp, fieldKey, bedKey);
    const cap = parseInt(camp.capacity)||0;
    const occupied = fieldKey ? ALL_DATA.filter(p=>p[fieldKey]===cNum&&(bedKey?p[bedKey]:true)).length : 0;
    const isFull = cap>0 && occupied>=cap;
    opts += `<option value="${cNum}" ${selectedVal===cNum?'selected':''} ${isFull?'disabled':''} style="${isFull?'color:#ccc':''}">${label}</option>`;
  });
  return `<select style="${style}" onchange="this.dispatchEvent(new Event('change',{bubbles:true}))">${opts}</select>`;
}

function buildUACampOptions(locCamps, selectedCamp) {
  const { fieldKey, bedKey } = window._unassignedData||{};
  const sorted = _sortCamps(locCamps);
  let opts = '<option value="">اختر</option>';
  let lastType = null;
  sorted.forEach(camp => {
    const t = camp.camp_type||'';
    if(t !== lastType) {
      if(lastType!==null) opts += '</optgroup>';
      opts += `<optgroup label="${(t===''||t==='رجال')?'👨 رجال':t==='نساء'?'👩 نساء':'👨 رجال'}">`;
      lastType = t;
    }
    const cNum = camp.camp_num||camp.name;
    const cap = parseInt(camp.capacity)||0;
    // عدد المسكّنين في DB
    const inDB = fieldKey ? ALL_DATA.filter(p=>p[fieldKey]===cNum&&(bedKey?p[bedKey]:true)).length : 0;
    // عدد المختارين في النافذة حالياً (لم يُحفظوا بعد)
    let inModal = 0;
    document.querySelectorAll('[id^="ua-camp-"]').forEach(sel => {
      if(sel.value === cNum) inModal++;
    });
    const occupied = inDB + inModal;
    const avail = cap - occupied;
    const isFull = cap>0 && avail<=0;
    opts += `<option value="${cNum}" ${selectedCamp===cNum?'selected':''} ${isFull&&selectedCamp!==cNum?'disabled':''} style="${isFull&&selectedCamp!==cNum?'color:#bbb':''}">‎${cNum}${isFull?' ⛔ ممتلئ':' — متاح: '+avail}</option>`;
  });
  if(lastType!==null) opts += '</optgroup>';
  return opts;
}

function buildUABedOptions(campNum, currentBed, pilgrimId) {
  const { fieldKey, bedKey, locCamps } = window._unassignedData;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) return '<option value="">اختر المخيم أولاً</option>';
  const cap = parseInt(camp.capacity)||0;
  // الأسرة المحجوزة من DB (بعد التطبيع)
  const bookedInDB = ALL_DATA
    .filter(p=>p[fieldKey]===campNum && String(p['_supabase_id'])!==String(pilgrimId) && p[bedKey])
    .map(p => _normalizeBedId(p[bedKey], campNum));
  // الأسرة المختارة حالياً في النافذة من حجاج آخرين (بعد التطبيع)
  const selectedInModal = [];
  document.querySelectorAll('[id^="ua-bed-"]').forEach(sel => {
    const pid = sel.id.replace('ua-bed-','');
    if(String(pid)!==String(pilgrimId) && sel.value) {
      const campSel = document.getElementById('ua-camp-'+pid);
      if(campSel && campSel.value === campNum) selectedInModal.push(_normalizeBedId(sel.value, campNum));
    }
  });
  const allBooked = new Set([...bookedInDB, ...selectedInModal]);
  const curNorm = _normalizeBedId(currentBed, campNum);
  let opts = '<option value="">اختر السرير</option>';
  for(let i=1;i<=cap;i++){
    const v=campNum+'-'+i;
    if(v===curNorm){ opts+=`<option value="${v}" selected>${v}</option>`; continue; }
    if(!allBooked.has(v)) opts+=`<option value="${v}">${v}</option>`;
  }
  return opts;
}

function renderUATable() {
  const { fieldKey, bedKey, locCamps, pilgrims } = window._unassignedData;
  const search = (window._uaSearch||'').trim().toLowerCase();
  const sortCol = window._uaSortCol;
  const sortDir = window._uaSortDir;

  const uaCity=window._uaCity||''; const uaNat=window._uaNat||''; const uaBus=window._uaBus||''; const uaGender=window._uaGender||'';
  let list = pilgrims.filter(p => {
    if(p['__saved']) return false;
    if(search && ![p['اسم الحاج'],p['رقم الهوية'],p['الجنسية'],p['الجنس'],p['رقم الجوال'],p['رقم الحجز'],p['المدينة']].some(v=>(v||'').toLowerCase().includes(search))) return false;
    if(uaCity && p['المدينة']!==uaCity) return false;
    if(uaNat && p['الجنسية']!==uaNat) return false;
    if(uaGender && p['الجنس']!==uaGender) return false;
    if(uaBus && String(p['رقم الحافلة الخاصة بك'])!==String(uaBus)) return false;
    return true;
  });

  const _uaFieldMap = {name:'اسم الحاج',id:'رقم الهوية',nat:'الجنسية',gender:'الجنس',phone:'رقم الجوال',booking:'رقم الحجز',city:'المدينة'};
  const _uaSortKey = _uaFieldMap[sortCol]||sortCol;
  if(_uaSortKey) {
    list = [...list].sort((a,b) => {
      const av = (a[_uaSortKey]||'').toString();
      const bv = (b[_uaSortKey]||'').toString();
      return sortDir==='asc' ? av.localeCompare(bv,'ar',{numeric:true}) : bv.localeCompare(av,'ar',{numeric:true});
    });
  }

  const tbody = document.getElementById('ua-tbody');
  const countEl = document.getElementById('ua-count');
  if(!tbody) return;

  if(countEl) countEl.textContent = list.length;

  tbody.innerHTML = list.map((p, i) => {
    const currentCamp = p[fieldKey]||'';
    const currentBed  = p[bedKey]||'';
    const savedRow = document.getElementById('unassigned-row-'+p['_supabase_id']);
    const isSaved = savedRow && savedRow.style.opacity === '0.3';
    const modified = window._uaModifiedRows && window._uaModifiedRows.has(String(p['_supabase_id']));
    const rel = isRelated(p);
    const rowBg = isSaved?'#e8f8e8':modified?'#fffbe6':rel?'#f0f0f0':'#fff';
    const rowBorder = rel?'border-right:3px solid #c00;border-left:3px solid #c00;':'';
    return '<tr style="background:'+rowBg+';border-bottom:1px solid #eee;'+rowBorder+(isSaved?'opacity:0.4;pointer-events:none;':'')+'" id="unassigned-row-'+p['_supabase_id']+'" data-bn="'+(p['رقم الحجز']||'')+'" data-pid="'+p['_supabase_id']+'" ondblclick="showBookingGroup(this.dataset.bn,this.dataset.pid,\'ua\')">'
      +'<td style="padding:8px;text-align:center"><input type="checkbox" class="ua-bulk-chk" data-id="'+p['_supabase_id']+'" onchange="updateUASelCount()" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a"'+(isSaved?' disabled':'')+'/></td>'
      +'<td style="padding:8px 10px;color:#888">'+(i+1)+'</td>'
      +'<td style="padding:8px 10px;font-weight:700;color:#3d2000;min-width:130px">'+( p['اسم الحاج']||'—')+'</td>'
      +'<td style="padding:8px 10px">'+(p['رقم الهوية']||'—')+'</td>'
      +'<td style="padding:8px 10px">'+(p['الجنسية']||'—')+'</td>'
      +'<td style="padding:8px 10px">'+(p['الجنس']||'—')+'</td>'
      +'<td style="padding:8px 10px;direction:ltr">'+(p['رقم الجوال']||'—')+'</td>'
      +'<td style="padding:8px 10px;font-weight:700;color:'+(rel?'#c00':'inherit')+'">'+(p['رقم الحجز']||'—')+'</td>'
      +'<td style="padding:8px 10px">'+(p['المدينة']||'—')+'</td>'
      +'<td style="padding:8px 6px"><select id="ua-camp-'+p['_supabase_id']+'" onchange="updateUABeds('+p['_supabase_id']+');markUARowModified('+p['_supabase_id']+')" style="padding:4px 6px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit;min-width:80px"><option value="">اختر</option>'+buildUACampOptions(locCamps,currentCamp)+'</select></td>'
      +'<td style="padding:8px 6px"><select id="ua-bed-'+p['_supabase_id']+'" onchange="markUARowModified('+p['_supabase_id']+')" style="padding:4px 6px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit;min-width:80px">'+buildUABedOptions(currentCamp,currentBed,p['_supabase_id'])+'</select></td>'
      +'<td style="padding:8px 6px;white-space:nowrap"><button onclick="saveUnassignedPilgrim('+p['_supabase_id']+')" style="padding:5px 10px;background:#1a7a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit">💾 حفظ</button></td>'
      +'</tr>';
  }).join('');
}

function sortUATable(col) {
  if(window._uaSortCol === col) {
    window._uaSortDir = window._uaSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    window._uaSortCol = col;
    window._uaSortDir = 'asc';
  }
  // تحديث أيقونات الترتيب
  document.querySelectorAll('[id^="ua-th-"]').forEach(th => {
    const span = th.querySelector('span');
    if(span) span.textContent = ' ⇅';
  });
  const activeTh = document.getElementById('ua-th-'+col);
  if(activeTh) {
    const span = activeTh.querySelector('span');
    if(span) span.textContent = window._uaSortDir === 'asc' ? ' ▲' : ' ▼';
  }
  renderUATable();
}

function filterUATable() {
  const input = document.getElementById('ua-search-input');
  window._uaSearch = input ? input.value : '';
  window._uaCity = document.getElementById('ua-f-city')?.value||'';
  window._uaNat = document.getElementById('ua-f-nat')?.value||'';
  window._uaGender = document.getElementById('ua-f-gender')?.value||'';
  window._uaBus = document.getElementById('ua-f-bus')?.value||'';
  renderUATable();
}

function resetUATable() {
  window._uaSortCol = null;
  window._uaSortDir = 'asc';
  window._uaSearch = ''; window._uaCity = ''; window._uaNat = ''; window._uaGender = ''; window._uaBus = '';
  ['ua-f-city','ua-f-nat','ua-f-gender','ua-f-bus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const input = document.getElementById('ua-search-input');
  if(input) input.value = '';
  document.querySelectorAll('[id^="ua-th-"]').forEach(th => {
    const span = th.querySelector('span');
    if(span) span.textContent = ' ⇅';
  });
  renderUATable();
}

function updateUABeds(pilgrimId) {
  const { fieldKey, bedKey, locCamps } = window._unassignedData;
  const campSel = document.getElementById('ua-camp-'+pilgrimId);
  const bedSel = document.getElementById('ua-bed-'+pilgrimId);
  if(!campSel||!bedSel) return;
  const campNum = campSel.value;
  const camp = locCamps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp) { bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>'; return; }

  // التحقق من الجنس
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  if(pilgrim && camp.camp_type) {
    const g = pilgrim['الجنس']||'';
    const isFemale = g==='أنثى'||g==='أنثي'||g==='female'||g==='انثى';
    if(camp.camp_type==='نساء' && !isFemale) {
      campSel.value='';
      bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للنساء — الحاج من الذكور', 'error');
    }
    if(camp.camp_type==='رجال' && isFemale) {
      campSel.value='';
      bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للرجال — الحاجة من الإناث', 'error');
    }
  }

  // التحقق من السعة
  const cap = parseInt(camp.capacity)||0;
  const bookedInDB = ALL_DATA.filter(p=>p[fieldKey]===campNum && String(p['_supabase_id'])!=String(pilgrimId) && p[bedKey]).map(p=>p[bedKey]);
  const selectedInModal = [];
  document.querySelectorAll('[id^="ua-bed-"]').forEach(sel => {
    const pid = sel.id.replace('ua-bed-','');
    if(pid !== String(pilgrimId) && sel.value) {
      const campOfOther = document.getElementById('ua-camp-'+pid);
      if(campOfOther && campOfOther.value === campNum) selectedInModal.push(sel.value);
    }
  });
  const allBooked = [...new Set([...bookedInDB, ...selectedInModal])];

  if(cap > 0 && allBooked.length >= cap) {
    campSel.value='';
    bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
    return showToast('مخيم ' + campNum + ' ممتلئ — السعة: ' + cap + ' | المُسكَّنون: ' + allBooked.length, 'error');
  }

  // بناء قائمة الأسرة المتاحة
  let opts = '<option value="">اختر السرير</option>';
  for(let i=1;i<=cap;i++){
    const v=campNum+'-'+i;
    if(!allBooked.includes(v)) opts+=`<option value="${v}">${v}</option>`;
  }
  bedSel.innerHTML = opts;
}

async function saveUnassignedPilgrim(pilgrimId) {
  const { fieldKey, bedKey, camps, location } = window._unassignedData;
  const campVal = document.getElementById('ua-camp-'+pilgrimId).value;
  const bedVal = document.getElementById('ua-bed-'+pilgrimId).value;
  if(!campVal) return showToast('اختر رقم المخيم', 'warning');
  if(!bedVal) return showToast('اختر رقم السرير', 'warning');

  // التحقق من السعة
  const campObj = camps.find(c=>(c.camp_num||c.name)===campVal);
  if(campObj) {
    const cap = parseInt(campObj.capacity)||0;
    const occupied = ALL_DATA.filter(p => p[fieldKey]===campVal && String(p['_supabase_id'])!==String(pilgrimId) && p[bedKey]).length;
    if(occupied >= cap) return showToast('المخيم ' + campVal + ' ممتلئ — السعة: ' + cap + ' | المُسكَّنون: ' + occupied, 'error');
  }

  // قاعدة 1 (Gender) — error صلب عبر showActionModal
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  if(pilgrim) {
    const camp = camps.find(c=>(c.camp_num||c.name)===campVal);
    const g = _genderOf(pilgrim);
    if(camp && camp.camp_type && !_campMatchesGenderGlobal(camp.camp_type, g)){
      await showActionModal({
        type:'error',
        title:'جنس غير مطابق — لا يمكن التسكين',
        description:'لا يمكن تسكين هذا الحاج في مخيم مخصَّص للجنس الآخر — قاعدة شرعية صلبة.',
        items:[
          { icon:'👤', label:'اسم الحاج:',      value: pilgrim['اسم الحاج']||'—' },
          { icon:'🏕️', label:'المخيم المطلوب:', value: campVal + ' (مخصَّص للـ' + camp.camp_type + ')' },
          { icon:'📍', label:'الموقع:',         value: location }
        ],
        actions:[{label:'فهمت', value:null, variant:'primary', color:'danger'}]
      });
      return;
    }
  }

  // قاعدة 8 (Booking Split) — تحذير إذا المجموعة في مخيم مختلف
  const loc2 = location === 'منى' ? 'mina' : location === 'عرفات' ? 'arafat' : null;
  if(loc2){
    const check = _checkSingleMoveSplit(pilgrimId, campVal, loc2);
    if(check.willSplit){
      const campsList = {};
      check.inOtherCamps.forEach(m => {
        const c = m[fieldKey];
        campsList[c] = (campsList[c]||0) + 1;
      });
      const inCampsSummary = Object.entries(campsList).map(([c,n]) => n+' في '+c).join('، ');
      const decision = await showActionModal({
        type:'warning',
        title:'تفكيك مجموعة الحجز',
        description:'الحاج '+(pilgrim?.['اسم الحاج']||'')+' ينتمي لحجز يحتوي '+check.groupSize+' أشخاص. بعض أفراد المجموعة في مخيم مختلف، وتسكينه هنا سيفصله عنهم.',
        items:[
          { icon:'📋', label:'رقم الحجز:',           value: check.bookingKey },
          { icon:'👥', label:'إجمالي المجموعة:',    value: check.groupSize + ' شخص' },
          { icon:'🏕️', label:'الأعضاء الآخرون:',    value: inCampsSummary ? ('موزَّعون: ' + inCampsSummary) : 'لا مواقع محدَّدة' },
          { icon:'❓', label:'غير مُسكَّنين:',       value: check.unassigned.length + ' شخص' },
          { icon:'➡️', label:'وجهة التسكين:',        value: 'مخيم ' + campVal + ' (' + location + ')' }
        ],
        actions:[
          { label:'متابعة الفصل', value:'split', emoji:'⚠️', variant:'primary', color:'warning' },
          { label:'إلغاء',         value:null,    emoji:'❌', variant:'cancel' }
        ]
      });
      if(decision !== 'split') return;
    }
  }

  // 1) بناء candidate دون mutation ثم مقارنة بالأصل
  const idx = ALL_DATA.findIndex(p => String(p['_supabase_id']) === String(pilgrimId));
  const pilgrimRec = idx >= 0 ? ALL_DATA[idx] : null;
  const loc = location === 'منى' ? 'mina' : 'arafat';
  const seatKey = loc + '_seat';
  const candidate = {};
  _applyBedAssignment(candidate, null, loc, campVal, bedVal);

  const before = pilgrimRec ? {
    [fieldKey]: pilgrimRec[fieldKey],
    [bedKey]:   pilgrimRec[bedKey],
    [seatKey]:  pilgrimRec[seatKey]
  } : {};
  const updates = {};
  Object.keys(candidate).forEach(k => {
    if(_fieldChanged(before[k], candidate[k])) updates[k] = candidate[k];
  });
  console.log(`[saveUnassignedPilgrim] ${Object.keys(updates).length}/${Object.keys(candidate).length} حقول تغيّرت`);

  if(Object.keys(updates).length === 0){
    showToast('لا يوجد ما يُحفظ', 'info');
    return;
  }

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    // v17.0: audit (v17.0.1: فلترة shadow seat sync)
    const changes = _buildFieldChanges(before, _filterAuditSyncArtifacts(updates));
    if(changes){
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(pilgrimRec),
        field_changes: changes,
        metadata: { source: 'unassigned_view' }
      });
    }
    // إزالة الصف من قائمة التعديلات غير المحفوظة
    if(window._uaModifiedRows) window._uaModifiedRows.delete(String(pilgrimId));
    // تحديث ALL_DATA وقائمة الموقع من updates (قيم مُطبَّعة)
    if(pilgrimRec) Object.keys(updates).forEach(k => { pilgrimRec[k] = updates[k]; });
    const saved = window._unassignedData.pilgrims.find(p=>String(p['_supabase_id'])===String(pilgrimId));
    if(saved){
      Object.keys(updates).forEach(k => { saved[k] = updates[k]; });
      saved['__saved'] = true;
    }
    const summary = _summarizeUpdates(updates);
    showToast(summary ? 'تم تحديث: ' + summary : 'تم التسكين', 'success');
    // تحديث الصف نفسه مباشرة
    const row = document.getElementById('unassigned-row-'+pilgrimId);
    if(row) {
      row.style.background = '#e8f8e8';
      row.style.opacity = '0.45';
      row.style.pointerEvents = 'none';
      const savBtn = row.querySelector('button');
      if(savBtn) savBtn.innerHTML = '✅ تم';
    }
    // تحديث منسدلات المخيم للصفوف الأخرى
    const { locCamps } = window._unassignedData;
    document.querySelectorAll('[id^="ua-camp-"]').forEach(sel => {
      const pid = sel.id.replace('ua-camp-','');
      if(String(pid)===String(pilgrimId)) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر</option>'+buildUACampOptions(locCamps, cur);
    });
    // تحديث الأسرة المتاحة للحجاج الآخرين في نفس النافذة
    refreshOtherBedSelects(pilgrimId, campVal, bedVal);
    // تحديث المخيمات في الخلفية
    renderCamps();
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

function refreshOtherBedSelects(savedPilgrimId, savedCamp, savedBed) {
  const { fieldKey, bedKey, locCamps } = window._unassignedData || {};
  if(!fieldKey) return;
  // ابحث عن كل قوائم الأسرة في النافذة وأزل السرير المحجوز
  document.querySelectorAll('[id^="ua-bed-"]').forEach(bedSel => {
    const pid = bedSel.id.replace('ua-bed-', '');
    if(pid === String(savedPilgrimId)) return;
    const campSel = document.getElementById('ua-camp-'+pid);
    if(!campSel || campSel.value !== savedCamp) return;
    // أزل السرير المحجوز من القائمة
    Array.from(bedSel.options).forEach(opt => {
      if(opt.value === savedBed) opt.remove();
    });
  });
}

function printUnassignedReport(location) {
  const { fieldKey, bedKey, pilgrims } = window._unassignedData || {};
  const locLabel = location === 'منى' ? 'منى' : location === 'عرفات' ? 'عرفات' : 'مزدلفة';
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'});

  // استخدام نفس الفلترة والترتيب الحالي في النافذة
  const search = (window._uaSearch||'').trim().toLowerCase();
  const sortCol = window._uaSortCol;
  const sortDir = window._uaSortDir;

  let list = (pilgrims||[]).filter(p => {
    if(p['__saved']) return false;
    if(!search) return true;
    return [p['اسم الحاج'],p['رقم الهوية'],p['الجنسية'],p['الجنس'],p['رقم الجوال'],p['رقم الحجز'],p['المدينة']]
      .some(v => (v||'').toLowerCase().includes(search));
  });

  const _uaFieldMap = {name:'اسم الحاج',id:'رقم الهوية',nat:'الجنسية',gender:'الجنس',phone:'رقم الجوال',booking:'رقم الحجز',city:'المدينة'};
  const _uaSortKey = _uaFieldMap[sortCol]||sortCol;
  if(_uaSortKey) {
    list = [...list].sort((a,b) => {
      const av = (a[_uaSortKey]||'').toString();
      const bv = (b[_uaSortKey]||'').toString();
      return sortDir==='asc' ? av.localeCompare(bv,'ar',{numeric:true}) : bv.localeCompare(av,'ar',{numeric:true});
    });
  }

  const printWin = window.open('', '_blank');
  printWin.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>​</title>
<style>
  @page{margin:5mm 10mm 10mm 10mm;size:A4 landscape}
  body{font-family:Arial,sans-serif;font-size:11px;margin:0;direction:rtl;color:#222}
  .header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;border-bottom:3px solid #b8860b;padding:4mm 8mm;background:#fff}
  .header-right{text-align:right}
  .header-center{text-align:center}
  .header-left{text-align:right;margin:0 auto;width:fit-content}
  .name{font-size:14px;font-weight:bold;color:#3d2000}
  .sub{font-size:11px;color:#555;margin-top:1px}
  .content{padding:3mm 8mm 8mm}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  thead{display:table-header-group}
  th{background:#d0d0d0;color:#333;padding:3px 6px;text-align:center;font-size:11px;border:1px solid #ccc;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{padding:3px 6px;border:1px solid #e0d0b0;font-size:10px;text-align:center}
  tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer{display:flex;justify-content:space-between;margin-top:8px;border-top:2px solid #b8860b;padding-top:6px;font-size:11px;font-weight:bold;color:#3d2000}
</style>
</head>
<body>
<table style="width:100%;border-collapse:collapse">
  <thead style="display:table-header-group">
    <tr><td colspan="10" style="padding-bottom:4mm">
    <div class="header">
  <div class="header-right">
    <div class="name">${window._devSettings?.companyName||''}</div>
    <div class="sub">الحجاج الغير مُسكَّنين — مشعر ${locLabel}</div>
  </div>
  <div class="header-center">
    ${_buildPrintLogoHTML(75)}
    <div style="font-size:15px;font-weight:bold;color:#3d2000;margin-top:4px">بيان الحجاج الغير مُسكَّنين — مشعر ${locLabel}</div>
  </div>
  <div class="header-left">
    <div class="sub">التاريخ: ${today}</div>
    <div class="sub">وقت الطباعة: ${timeStr}</div>
    <div class="sub">عدد الحجاج: <strong>${list.length}</strong></div>
  </div>
</div>
    </td></tr>
    <tr>
      <th>#</th><th>اسم الحاج</th><th>رقم الهوية</th><th>الجنسية</th><th>الجنس</th><th>رقم الجوال</th><th>رقم الحجز</th><th>المدينة</th><th>رقم المخيم</th><th>رقم السرير</th>
    </tr>
  </thead>
  <tbody>
    ${list.map((p,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${p['اسم الحاج']||'—'}</strong></td>
      <td>${p['رقم الهوية']||'—'}</td>
      <td>${p['الجنسية']||'—'}</td>
      <td>${p['الجنس']||'—'}</td>
      <td>${p['رقم الجوال']||'—'}</td>
      <td>${p['رقم الحجز']||'—'}</td>
      <td>${p['المدينة']||'—'}</td>
      <td style="color:#c00">${fieldKey?(p[fieldKey]||'غير مُسكَّن'):'—'}</td>
      <td style="color:#c00">${bedKey?(p[bedKey]||'—'):'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">
  <div>المشعر: ${locLabel}</div>
  <div>إجمالي الغير مُسكَّنين: ${list.length} حاج</div>
  <div>صفحة 1 من 1</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  printWin.document.close();
}

// ─────────────────────────────────────────────
// Block C — UA mod tracking
// (was admin.html L7104-7185)
// ─────────────────────────────────────────────
// ===== تتبع تعديلات نافذة الغير مُسكَّنين =====
window._uaModifiedRows = new Set();

function markUARowModified(pilgrimId) {
  if(!window._uaModifiedRows) window._uaModifiedRows = new Set();
  window._uaModifiedRows.add(String(pilgrimId));
  const row = document.getElementById('unassigned-row-'+pilgrimId);
  if(row) row.style.borderRight = '3px solid #c8971a';
}

async function closeUAModal() {
  if(!window._uaModifiedRows || window._uaModifiedRows.size === 0) {
    _returnFromUA(); return;
  }
  const count = window._uaModifiedRows.size;
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:440px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="font-size:44px;margin-bottom:12px">⚠️</div>
        <div style="font-size:17px;font-weight:700;color:#3d2000;margin-bottom:8px">تعديلات غير محفوظة</div>
        <div style="font-size:14px;color:#666;margin-bottom:24px;line-height:1.6">
          هناك <strong>${count}</strong> تعديلات تم إدخالها ولم يتم حفظها.<br>هل تريد حفظ الكل؟
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button id="ua-unsaved-yes" style="padding:12px 24px;background:#1a7a1a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">✅ نعم — حفظ الكل</button>
          <button id="ua-unsaved-no" style="padding:12px 24px;background:#c00;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">❌ لا — تجاهل</button>
          <button id="ua-unsaved-cancel" style="padding:12px 24px;background:#f5f5f5;color:#555;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">↩️ رجوع</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('ua-unsaved-cancel').onclick = () => { overlay.remove(); resolve(null); };

    document.getElementById('ua-unsaved-no').onclick = () => {
      overlay.remove();
      showConfirm('هل أنت متأكد من تجاهل جميع التعديلات؟', 'تأكيد التجاهل', 'نعم، تجاهل', '#c00', '⚠️').then(confirmed => {
        if(confirmed) { window._uaModifiedRows.clear(); _returnFromUA(); resolve(true); }
        else resolve(null);
      });
    };

    document.getElementById('ua-unsaved-yes').onclick = () => {
      overlay.remove();
      showConfirm('هل أنت متأكد من حفظ جميع التعديلات؟', 'تأكيد الحفظ', 'نعم، حفظ الكل', '#1a7a1a', '💾').then(async confirmed => {
        if(confirmed) {
          await saveAllUAModifiedRows();
          resolve(true);
        } else resolve(null);
      });
    };
  });
}

async function saveAllUAModifiedRows() {
  const ids = [...window._uaModifiedRows];
  const { fieldKey, bedKey, location } = window._unassignedData || {};
  let saved = 0;
  for(const pilgrimId of ids) {
    const campSel = document.getElementById('ua-camp-'+pilgrimId);
    const bedSel = document.getElementById('ua-bed-'+pilgrimId);
    if(!campSel || !bedSel || !campSel.value || !bedSel.value) continue;
    const updates = {};
    updates[fieldKey] = campSel.value;
    updates[bedKey] = bedSel.value;
    if(location==='منى') updates.mina_seat = bedSel.value;
    else if(location==='عرفات') updates.arafat_seat = bedSel.value;
    try {
      await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
      const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pilgrimId));
      if(idx>=0) { ALL_DATA[idx][fieldKey]=campSel.value; ALL_DATA[idx][bedKey]=bedSel.value; }
      const row = document.getElementById('unassigned-row-'+pilgrimId);
      if(row) { row.style.opacity='0.3'; row.style.pointerEvents='none'; row.style.background='#e8f8e8'; }
      saved++;
    } catch(e) { console.error('UA Save error:', e); }
  }
  window._uaModifiedRows.clear();
  showToast('تم حفظ ' + saved + ' تسكين بنجاح', 'success');
  renderCamps();
  closeModals();
}