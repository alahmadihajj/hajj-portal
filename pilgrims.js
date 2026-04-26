// ═══════════════════════════════════════════════════════════════════════
// Pilgrims UI Module — v11.5 Phase 4b/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Bulk UI triggers: toggleAllData, updateDataBulkBar, clearDataSelection, applyDataBulk,
//                       toggleAllBG, updateBGBulkBar, applyBGBulk
//   - Ungrouped: _returnFromUG, showUngroupedPilgrims, _renderUngroupedModal, _renderUGTable, saveUGRow
//   - Pilgrim Assign Modal: openPilgrimAssign, savePilgrimAssign
//   - Booking Group + Quick Edit: _ensureBgEscHandler, _openQEFromBG, _returnToBookingGroupFromQE,
//                                  closeBookingGroup, showBookingGroup,
//                                  closeQuickEdit, openPilgrimQuickEdit, qeBeds, saveQuickEdit
//
// Dependencies (globals):
//   - ui-helpers.js:    showToast, showConfirm, showActionModal
//   - audit.js:         _recordAudit, _buildPilgrimLabel, _buildFieldChanges
//   - bulk-pipeline.js: _executeBulkPipeline, _applyBedAssignment, _checkSingleMoveSplit,
//                       _checkBookingIntegrity, _filterAuditSyncArtifacts, _buildCampSelectOptions,
//                       _refreshCampsCache, _normalizeBedId, _genderOf, _campMatchesGenderGlobal,
//                       _fieldChanged, _summarizeUpdates, _syncSupervisorForBus
//   - admin.html:       _filterPilgrimsByQuery, _buildPilgrimCard, _buildFiltersBar, _getLogo,
//                       ALL_DATA, loadData, openModal, closeModals, render, getCamps, getGroups, getBuses
//   - supabase.js:      window.DB.Pilgrims.*, window.DB.SysUsers.*
// ═══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────
// Block 1 — Bulk UI triggers (data tab + Booking Group)
// (was admin.html L3950-4104)
// ─────────────────────────────────────────────

// ===== إجراء جماعي في بيانات الحجاج =====
function toggleAllData(cb) {
  document.querySelectorAll('.data-row-check').forEach(c => c.checked = cb.checked);
  updateDataBulkBar();
}

function updateDataBulkBar() {
  const checks = document.querySelectorAll('.data-row-check:checked');
  const bar = document.getElementById('data-bulk-bar');
  const count = document.getElementById('data-selected-count');
  const all = document.getElementById('data-check-all');
  const total = document.querySelectorAll('.data-row-check').length;
  if(bar) bar.style.display = checks.length ? 'flex' : 'none';
  if(count) count.textContent = `تم تحديد ${checks.length} حاج`;
  if(all) all.indeterminate = checks.length > 0 && checks.length < total;
  if(all) all.checked = checks.length === total && total > 0;
}

function clearDataSelection() {
  document.querySelectorAll('.data-row-check').forEach(c => c.checked = false);
  const all = document.getElementById('data-check-all');
  if(all) { all.checked = false; all.indeterminate = false; }
  updateDataBulkBar();
}

/**
 * Helper مشترك: يبني خيارات قيمة الحقل في أي bulk bar.
 * يدعم static (ثلاثة حقول) + dynamic (حافلة/فوج) + async (مخيم منى/عرفات).
 * يُستدعى من updateDataBulkOptions و updateBGBulkOptions.
 */
function _buildBulkValueOptions(field, valSel){
  if(!valSel) return;
  const staticOpts = {
    bus_status: ['ركب', 'لم يركب'],
    camp_status: ['حضر', 'لم يصل'],
    // v22.6: الحالات التي تتطلّب توقيعاً مُستبعَدة — تُضبط فقط عبر إقرار المشرف/الحاج
    nusuk_card_status: ['لم تطبع','في الطباعة','لدى الإدارة']
  };
  if(staticOpts[field]){
    valSel.innerHTML = '<option value="">— اختر القيمة —</option>' +
      staticOpts[field].map(v=>`<option value="${v}">${v}</option>`).join('');
    valSel.disabled = false;
  } else if(field === 'bus_num'){
    // v22.5.1: استبعاد '-' والقيم الفارغة
    const buses = [...new Set(ALL_DATA.map(p=>p['رقم الحافلة الخاصة بك']).filter(b => b && String(b).trim() && String(b).trim() !== '-'))].sort((a,b)=>Number(a)-Number(b));
    valSel.innerHTML = '<option value="">— اختر الحافلة —</option>' +
      buses.map(b=>`<option value="${b}">حافلة ${b}</option>`).join('');
    valSel.disabled = false;
  } else if(field === 'group_num'){
    const groups = [...new Set(ALL_DATA.map(p=>p['رقم فوج التفويج الخاص بك']).filter(Boolean))].sort();
    valSel.innerHTML = '<option value="">— اختر الفوج —</option>' +
      groups.map(g=>`<option value="${g}">فوج ${g}</option>`).join('');
    valSel.disabled = false;
  } else if(field === 'mina_camp' || field === 'arafat_camp'){
    const loc = field === 'mina_camp' ? 'منى' : 'عرفات';
    const fk  = field === 'mina_camp' ? 'mina_camp' : 'arafat_camp';
    const bk  = field === 'mina_camp' ? 'mina_bed' : 'arafat_bed';
    valSel.innerHTML = '<option value="">— جاري التحميل —</option>';
    valSel.disabled = false;
    window.DB.Camps.getAll().then(allCamps => {
      const locCamps = allCamps.filter(c=>c.location===loc);
      valSel.innerHTML = '<option value="">— اختر مخيم '+loc+' —</option>' +
        _buildCampSelectOptions(locCamps, fk, bk);
    }).catch(()=>{
      const camps = [...new Set(ALL_DATA.map(p=>p[fk]).filter(Boolean))].sort();
      valSel.innerHTML = '<option value="">— اختر مخيم '+loc+' —</option>' +
        camps.map(c=>`<option value="${c}">${c}</option>`).join('');
    });
  } else {
    valSel.innerHTML = '<option value="">—</option>';
    valSel.disabled = true;
  }
}
// ===== v11.5 Phase 3b Bulk Pipeline extracted → bulk-pipeline.js =====

async function applyDataBulk(){
  const field = document.getElementById('data-bulk-field').value;
  const value = document.getElementById('data-bulk-value').value;
  if(!field || !value){ showToast('اختر الحقل والقيمة أولاً', 'warning'); return; }

  // v22.6: دفاع عميق — الحالات التي تتطلّب توقيعاً لا تُضبط من bulk admin مباشرة
  if(field === 'nusuk_card_status' && (value === 'لدى المشرف' || value === 'مسلّمة للحاج')){
    showToast('⚠️ هذه الحالة تُضبط تلقائياً عند توقيع المشرف/الحاج — استخدم "لدى الإدارة" ثم دع المشرف يوقّع الإقرار', 'warning');
    return;
  }

  const ids = [...document.querySelectorAll('.data-row-check:checked')].map(c=>parseInt(c.dataset.id));
  if(!ids.length) return;
  const result = await _executeBulkPipeline(ids, field, value, { source:'data' });
  if(result.success){
    clearDataSelection();
    render();
  }
}

// ===== Bulk actions لنافذة الحجاج المرتبطين (Booking Group) =====
function toggleAllBG(cb){
  document.querySelectorAll('.bg-row-check').forEach(c => c.checked = cb.checked);
  updateBGBulkBar();
}

function updateBGBulkBar(){
  const checks = document.querySelectorAll('.bg-row-check:checked');
  const bar    = document.getElementById('bg-bulk-bar');
  const count  = document.getElementById('bg-selected-count');
  const all    = document.getElementById('bg-check-all');
  const total  = document.querySelectorAll('.bg-row-check').length;
  if(bar)   bar.style.display = checks.length ? 'flex' : 'none';
  if(count) count.textContent = `تم تحديد ${checks.length} حاج`;
  if(all){
    all.indeterminate = checks.length > 0 && checks.length < total;
    all.checked       = checks.length === total && total > 0;
  }
}

/**
 * توسيع التحديد ليشمل كل أفراد مجموعات الحجز للحجاج المحدَّدين.
 * @param {'data'|'bg'} scope
 */
function _expandBulkSelection(scope){
  const sel = scope === 'data' ? '.data-row-check' : '.bg-row-check';
  const currentIds = [...document.querySelectorAll(sel+':checked')].map(c => parseInt(c.dataset.id));
  if(!currentIds.length){ showToast('لا يوجد تحديد حالياً', 'warning'); return; }
  const allMates = new Set(currentIds.map(String));
  currentIds.forEach(id => {
    _getBookingMates(id).forEach(m => allMates.add(String(m['_supabase_id'])));
  });
  document.querySelectorAll(sel).forEach(cb => {
    if(allMates.has(String(cb.dataset.id))) cb.checked = true;
  });
  (scope === 'data' ? updateDataBulkBar : updateBGBulkBar)();
  const added = allMates.size - currentIds.length;
  showToast(added > 0 ? `أُضيف ${added} حاج من مجموعات الحجز` : 'كل أفراد المجموعات مُحدَّدون مسبقاً', 'info');
}

function clearBGSelection(){
  document.querySelectorAll('.bg-row-check').forEach(c => c.checked = false);
  const all = document.getElementById('bg-check-all');
  if(all){ all.checked = false; all.indeterminate = false; }
  updateBGBulkBar();
}

function updateBGBulkOptions(){
  const field  = document.getElementById('bg-bulk-field').value;
  const valSel = document.getElementById('bg-bulk-value');
  _buildBulkValueOptions(field, valSel);
}

async function applyBGBulk(){
  const field = document.getElementById('bg-bulk-field').value;
  const value = document.getElementById('bg-bulk-value').value;
  if(!field || !value){ showToast('اختر الحقل والقيمة أولاً', 'warning'); return; }
  const ids = [...document.querySelectorAll('.bg-row-check:checked')].map(c=>parseInt(c.dataset.id));
  if(!ids.length) return;
  const result = await _executeBulkPipeline(ids, field, value, { source:'bg' });
  if(result.success){
    // إعادة رسم النافذة بالبيانات الجديدة (openModal يكتب innerHTML فقط — لا يُغلق overlay)
    const bn  = window._currentBookingGroupNum;
    const aid = window._currentBookingClickedId;
    const ctx = window._currentBookingCtx || 'main';
    if(bn || aid) showBookingGroup(bn, aid, ctx);
  }
}

// ─────────────────────────────────────────────
// Block 2 — Ungrouped Pilgrims
// (was admin.html L4425-4610)
// ─────────────────────────────────────────────

// ===== الحجاج الغير مفوجين =====
window._ugSearch = ''; window._ugModified = new Set();


function _returnFromUG() {
  if(window._ugFromGP) {
    window._ugFromGP = false;
    const groupNum = window._gpCurrentGroup;
    const groupName = window._gpCurrentName||groupOrdinalName(groupNum);
    if(groupNum) { _renderGroupPilgrimsModal(groupNum, groupName); return; }
  }
  closeModals();
}

async function showUngroupedPilgrims() {
  const groups = await getGroups();
  window._systemGroupNums = new Set(groups.map(g=>String(g.num)));
  window._gpGroups = groups;
  window._ugModified = new Set();
  window._ugSearch = '';
  _renderUngroupedModal();
}

function _renderUngroupedModal() {
  const allUG = ALL_DATA.filter(p=>!_hasGroup(p));
  const grpOpts=(window._gpGroups||[]).sort((a,b)=>Number(a.num)-Number(b.num))
    .map(g=>`<option value="${g.num}">${g.num} — ${g.name||groupOrdinalName(g.num)}</option>`).join('');
  const filtersBar = _buildFiltersBar(allUG, 'ug', '_renderUGTable()');
  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <h3 style="font-size:18px;font-weight:800;color:#3d2000;margin:0">⚠️ الغير مفوجين — <span id="ug-count">${allUG.length}</span> حاج</h3>
      <button onclick="closeUGModal()" style="padding:7px 14px;background:#f5f5f5;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">✕ إغلاق</button>
    </div>
    ${filtersBar}
    <!-- شريط التحديد الجماعي -->
    <div style="display:flex;gap:8px;align-items:center;background:#fff8e8;border:1.5px solid #f0e0b0;border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:600;color:#7a4500;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="ug-check-all" onchange="toggleUGAll(this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
        تحديد الكل
      </label>
      <span id="ug-selected-count" style="font-size:12px;color:#888"></span>
      <div style="display:flex;gap:6px;align-items:center;margin-right:auto">
        <select id="ug-bulk-group" style="padding:6px 10px;border:1.5px solid #ddd;border-radius:7px;font-size:12px;font-family:inherit">
          <option value="">— الفوج المستهدف —</option>
          ${grpOpts}
        </select>
        <button onclick="applyUGBulk()" style="padding:6px 14px;background:#c8971a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">⚡ تنفيذ جماعي</button>
      </div>
    </div>
    <div class="modal-table-wrap" style="max-height:50vh">
      <table style="font-size:13px;min-width:800px">
      <colgroup><col style="width:40px"><col style="width:35px"><col style="width:155px"><col style="width:110px"><col style="width:100px"><col style="width:90px"><col style="width:80px"><col style="width:90px"><col style="width:90px"><col style="width:120px"><col style="width:60px"></colgroup>
        <thead>
          <tr id="ug-thead-row" style="background:linear-gradient(135deg,#7a4500,#c8971a);color:#fff;position:sticky;top:0">
            <th style="padding:9px 8px">☑</th>
            <th style="padding:9px 8px">#</th>
            ${[['name','الاسم'],['id','الهوية'],['phone','الجوال'],['nat','الجنسية'],['city','المدينة'],['status','حالة الحجز'],['bus','الحافلة']].map(([id,lbl])=>_thSort(id,lbl,window._ugSort||{col:null,dir:1},'ug')).join('')}
            <th style="padding:9px 8px">الفوج</th>
            <th style="padding:9px 8px">حفظ</th>
          </tr>
        </thead>
        <tbody id="ug-tbody"></tbody>
      </table>
    </div>`);
  setTimeout(()=>{
    const box=document.querySelector('.modal-box');
    if(box){box.style.maxWidth='96vw';box.style.width='96vw';box.style.maxHeight='92vh';}
    window._ugAllData = allUG;
    _renderUGTable();
  },50);
}

function _renderUGTable() {
  let pilgrims = ALL_DATA.filter(p=>!_hasGroup(p));
  pilgrims = _applyModalFilters(pilgrims, 'ug');
  // ترتيب موحد
  const _ugFieldMap = {name:'اسم الحاج',id:'رقم الهوية',phone:'رقم الجوال',nat:'الجنسية',city:'المدينة',status:'حالة الحجز',bus:'رقم الحافلة الخاصة بك'};
  const {col:ugCol, dir:ugDir} = window._ugSort||{};
  if(ugCol && _ugFieldMap[ugCol]) {
    pilgrims = [...pilgrims].sort((a,b)=>
      String(a[_ugFieldMap[ugCol]]||'').localeCompare(String(b[_ugFieldMap[ugCol]]||''),'ar',{numeric:true})*ugDir
    );
  }
  setTimeout(_refreshUGHeader, 0);
  const el=document.getElementById('ug-count');
  if(el) el.textContent=pilgrims.length;
  const tbody=document.getElementById('ug-tbody');
  if(!tbody) return;
  if(!pilgrims.length){tbody.innerHTML=`<tr><td colspan="11" style="text-align:center;padding:30px;color:#1a7a1a;font-weight:600">✅ لا توجد نتائج مطابقة</td></tr>`;return;}
  const grpOpts=(window._gpGroups||[]).sort((a,b)=>Number(a.num)-Number(b.num))
    .map(g=>`<option value="${g.num}">${g.num} — ${g.name||groupOrdinalName(g.num)}</option>`).join('');
  tbody.innerHTML=pilgrims.map((p,i)=>{
    const isMod=window._ugModified.has(String(p['_supabase_id']));
    const rel=isRelated(p);
    const rowBg=isMod?'#fffbe6':rel?'#f0f0f0':'#fff';
    const rowBorder=rel?'border-right:3px solid #c00;border-left:3px solid #c00;':'';
    return `<tr style="background:${rowBg};border-bottom:1px solid #eee;${rowBorder}" id="ug-row-${p['_supabase_id']}"
      data-bn="${p['رقم الحجز']||''}" data-pid="${p['_supabase_id']}" ondblclick="showBookingGroup(this.dataset.bn,this.dataset.pid,'ug')">
      <td style="padding:8px;text-align:center">
        <input type="checkbox" class="ug-chk" data-id="${p['_supabase_id']}" onchange="updateUGSelectedCount()" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
      </td>
      <td style="padding:8px;text-align:center;color:#aaa">${i+1}</td>
      <td style="padding:8px;font-weight:700;color:#3d2000;white-space:nowrap">${p['اسم الحاج']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['رقم الهوية']||'—'}</td>
      <td style="padding:8px;text-align:center;direction:ltr">${p['رقم الجوال']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['الجنسية']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['المدينة']||'—'}</td>
      <td style="padding:8px;text-align:center;${rel?'color:#c00;font-weight:700':''}">${p['حالة الحجز']||'—'}</td>
      <td style="padding:8px;text-align:center;font-weight:700">${p['رقم الحافلة الخاصة بك']||'—'}</td>
      <td style="padding:8px;text-align:center">
        <select id="ug-sel-${p['_supabase_id']}" onchange="onUGGroupChange('${p['_supabase_id']}',this.value)"
          style="padding:5px 8px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit">
          <option value="">— اختر —</option>
          ${grpOpts}
        </select>
      </td>
      <td style="padding:8px;text-align:center">
        <button id="ug-save-${p['_supabase_id']}" onclick="saveUGRow('${p['_supabase_id']}')"
          style="padding:5px 10px;background:#c8971a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;display:${isMod?'':'none'}">💾</button>
      </td>
    </tr>`;
  }).join('');
}

function onUGGroupChange(pid,val){window._ugModified.add(String(pid));const b=document.getElementById('ug-save-'+pid);if(b)b.style.display='';}
function toggleUGAll(checked){document.querySelectorAll('.ug-chk:not(:disabled)').forEach(cb=>cb.checked=checked);updateUGSelectedCount();}
function updateUGSelectedCount(){const n=document.querySelectorAll('.ug-chk:checked').length;const el=document.getElementById('ug-selected-count');if(el)el.textContent=n>0?'محدد: '+n:'';}

async function applyUGBulk() {
  const selected=[...document.querySelectorAll('.ug-chk:checked')].map(cb=>cb.dataset.id);
  const newGroup=document.getElementById('ug-bulk-group')?.value;
  if(!selected.length) return showToast('حدد حاجاً واحداً على الأقل','warning');
  if(!newGroup) return showToast('اختر الفوج المستهدف','warning');
  const grp=(window._gpGroups||[]).find(g=>String(g.num)===String(newGroup));
  if(grp&&grp.max_capacity){
    const cur=ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(newGroup)).length;
    if(cur+selected.length>parseInt(grp.max_capacity)) return showToast('الفوج '+newGroup+' لا يتسع لـ'+selected.length+' إضافيين (المتاح: '+(parseInt(grp.max_capacity)-cur)+')','warning');
  }
  const ok=await showConfirm('نقل '+selected.length+' حاج للفوج '+newGroup+'؟','تنفيذ جماعي','نعم، نفّذ','#c8971a','⚡');
  if(!ok) return;
  let done=0;
  for(const pid of selected){
    try{
      await window.DB.Pilgrims.update(parseInt(pid),{group_num:newGroup});
      const idx=ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
      if(idx>=0){ALL_DATA[idx]['رقم فوج التفويج الخاص بك']=newGroup;}
      done++;
    }catch(e){}
  }
  showToast('تم تفويج '+done+' حاج','success');
  renderGroups();
  _renderUGTable();
}

async function saveUGRow(pid) {
  const sel=document.getElementById('ug-sel-'+pid);
  if(!sel||!sel.value) return showToast('اختر الفوج أولاً','warning');
  const newGroupNum=sel.value;
  const grp=(window._gpGroups||[]).find(g=>String(g.num)===String(newGroupNum));
  if(grp&&grp.max_capacity){
    const cur=ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(newGroupNum)).length;
    if(cur>=parseInt(grp.max_capacity)) return showToast('الفوج '+newGroupNum+' وصل طاقته القصوى ('+grp.max_capacity+')','warning');
  }
  try {
    await window.DB.Pilgrims.update(parseInt(pid),{group_num:newGroupNum});
    const idx=ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
    if(idx>=0){ALL_DATA[idx]['رقم فوج التفويج الخاص بك']=newGroupNum;}
    window._ugModified.delete(String(pid));
    _renderUGTable();
    renderGroups();
    showToast('تم التفويج','success');
  } catch(e){showToast('خطأ: '+e.message,'error');}
}

async function closeUGModal() {
  if(window._ugModified&&window._ugModified.size>0){
    const ok=await showConfirm('يوجد '+window._ugModified.size+' تعديل لم يُحفظ. هل تريد الخروج؟','تعديلات غير محفوظة','نعم، اخرج','#c00','⚠️');
    if(!ok) return;
  }
  window._ugModified=new Set();
  _returnFromUG();
}




// ─────────────────────────────────────────────
// Block 3 — Pilgrim Assign Modal (openPilgrimAssign + savePilgrimAssign)
// (was admin.html L6225-6833)
// ─────────────────────────────────────────────
async function openPilgrimAssign(pilgrimId) {
  // تحميل الأفواج والحافلات والمخيمات
  const [groups, buses, camps, sysusers] = await Promise.all([
    window.DB.Groups.getAll(),
    window.DB.Buses.getAll(),
    window.DB.Camps.getAll(),
    window.DB.SysUsers.getAll()
  ]);
  window._campsCache = camps; // تغذية cache لاستخدامه في helpers v15.4
  
  // إيجاد بيانات الحاج الحالية
  const pilgrim = ALL_DATA.find(r => String(r['_supabase_id']) === String(pilgrimId)) || {};
  
  const minaCamps = camps.filter(c => c.location === 'منى');
  const arafatCamps = camps.filter(c => c.location === 'عرفات');

  // حساب الأسرة المحجوزة (مع تطبيع الصيغة)
  const bookedMinaBeds = ALL_DATA
    .filter(p => p['mina_camp'] && p['mina_bed'] && String(p['_supabase_id']) !== String(pilgrimId))
    .map(p => _normalizeBedId(p['mina_bed'], p['mina_camp']));
  const bookedArafatBeds = ALL_DATA
    .filter(p => p['arafat_camp'] && p['arafat_bed'] && String(p['_supabase_id']) !== String(pilgrimId))
    .map(p => _normalizeBedId(p['arafat_bed'], p['arafat_camp']));

  // دالة لبناء خيارات الأسرة
  function buildBedOptions(camp, bookedBeds, selectedBed) {
    if(!camp) return '';
    const campNum = camp.camp_num || camp.name;
    const capacity = parseInt(camp.capacity) || 0;
    const selNorm = _normalizeBedId(selectedBed, campNum);
    let opts = '<option value="">اختر السرير</option>';
    for(let i = 1; i <= capacity; i++) {
      const bedKey = campNum + '-' + i;
      const bedVal = campNum + '-' + i;
      const isBooked = bookedBeds.includes(bedKey);
      const isSelected = bedVal === selNorm;
      if(!isBooked || isSelected) {
        opts += `<option value="${bedVal}" ${isSelected?'selected':''}>${bedVal}</option>`;
      }
    }
    return opts;
  }

  const currentMinaCamp = minaCamps.find(c => (c.camp_num||c.name) === pilgrim['mina_camp']);
  const currentArafatCamp = arafatCamps.find(c => (c.camp_num||c.name) === pilgrim['arafat_camp']);


  openModal(`
    <h3 class="modal-title">✏️ تسكين الحاج: ${pilgrim['اسم الحاج']||''}</h3>
    <div style="background:#fffbf0;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;color:#666">
      🪪 ${pilgrim['رقم الهوية']||''} &nbsp;|&nbsp; 📋 ${pilgrim['رقم الحجز']||''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row">
        <label>🏕️ مخيم منى</label>
        <select id="pa-mina-camp" onchange="updateMinaBeds()">
          <option value="">اختر المخيم</option>
          ${_buildCampSelectOptions(minaCamps, 'mina_camp', 'mina_bed', { capFormat:'short', selected: pilgrim['mina_camp'] })}
        </select>
      </div>
      <div class="form-row">
        <label>🛏️ رقم السرير في منى</label>
        <select id="pa-mina-bed">
          ${buildBedOptions(currentMinaCamp, bookedMinaBeds, pilgrim['mina_bed'])}
        </select>
      </div>
      <div class="form-row">
        <label>🌄 مخيم عرفات</label>
        <select id="pa-arafat-camp" onchange="updateArafatBeds()">
          <option value="">اختر المخيم</option>
          ${_buildCampSelectOptions(arafatCamps, 'arafat_camp', 'arafat_bed', { capFormat:'short', selected: pilgrim['arafat_camp'] })}
        </select>
      </div>
      <div class="form-row">
        <label>🛏️ رقم السرير في عرفات</label>
        <select id="pa-arafat-bed">
          ${buildBedOptions(currentArafatCamp, bookedArafatBeds, pilgrim['arafat_bed'])}
        </select>
      </div>
      <div class="form-row">
        <label>👥 الفوج</label>
        <select id="pa-group">
          <option value="">اختر الفوج</option>
          ${groups.map(g=>`<option value="${g.num}" ${pilgrim['رقم فوج التفويج الخاص بك']===g.num?'selected':''}>فوج ${g.num} — ${g.name||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>🚌 الحافلة</label>
        <select id="pa-bus" onchange="onBusChange()">
          <option value="">اختر الحافلة</option>
          ${buses.map(b=>`<option value="${b.num}" ${pilgrim['رقم الحافلة الخاصة بك']===b.num?'selected':''}>حافلة ${b.num} — ${b.driver||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>👤 اسم المشرف <span class="locked-ic" title="لا يمكن التعديل من هنا">🔒</span></label>
        <input type="text" id="pa-supervisor-name" class="readonly-field" value="${pilgrim['اسم المشرف الخاص بالحاج']||''}" placeholder="يُعبّأ تلقائياً عند اختيار الحافلة" readonly title="لا يمكن التعديل من هنا — يُحدَّث من الفوج/الحافلة">
      </div>
      <div class="form-row">
        <label>📱 جوال المشرف <span class="locked-ic" title="لا يمكن التعديل من هنا">🔒</span></label>
        <input type="text" id="pa-supervisor-phone" class="readonly-field" value="${pilgrim['رقم جوال المشرف']||''}" placeholder="يُعبّأ تلقائياً" readonly title="لا يمكن التعديل من هنا — يُحدَّث من الفوج/الحافلة">
      </div>
    </div>
    <div class="modal-btns" style="margin-top:16px">
      <button class="btn-save" onclick="savePilgrimAssign(${pilgrimId})">💾 حفظ التسكين</button>
      <button class="btn-cancel" onclick="cancelAssignModal(${pilgrimId})">إلغاء</button>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
    <div style="background:#fffbf0;border-radius:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:10px">🪪 حالة بطاقة نسك</div>
      ${(() => {
        const currentStatus = pilgrim['حالة بطاقة نسك']||'لم تطبع';
        const time = pilgrim['نسك_time']||'—';
        const hasPilgrimAck = !!pilgrim['نسك_sig'];
        const hasSupAck = (currentStatus === 'لدى المشرف') || (currentStatus === 'مسلّمة للحاج');

        // ألوان الحالة
        const statusColors = {
          'لم تطبع':      {color:'#888',  bg:'#f5f5f5'},
          'في الطباعة':   {color:'#1a5fa8',bg:'#e8f0fd'},
          'لدى الإدارة':  {color:'#c8971a',bg:'#fff3e0'},
          'لدى المشرف':   {color:'#7a4500',bg:'#fdf0e0'},
          'مسلّمة للحاج': {color:'#1a7a1a',bg:'#e8f8e8'}
        };
        const sc = statusColors[currentStatus] || statusColors['لم تطبع'];

        const icons = {
          'لم تطبع':'⬜','في الطباعة':'🔄','لدى الإدارة':'📦',
          'لدى المشرف':'👤','مسلّمة للحاج':'✅'
        };

        // أزرار عرض الإقرارات
        const btnSupAck = hasSupAck
          ? `<button onclick="openSupAck('${pilgrim['_supabase_id']}', ${JSON.stringify(pilgrim).replace(/"/g, '&quot;')})" style="padding:10px 14px;background:#6b4a28;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600" title="عرض إقرار المشرف">📋 عرض إقرار المشرف</button>`
          : '';
        const btnView = hasPilgrimAck
          ? `<button onclick="openPilgrimAck('${pilgrim['_supabase_id']}', ${JSON.stringify(pilgrim).replace(/"/g, '&quot;')})" style="padding:10px 14px;background:#1a5fa8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600" title="عرض إقرار الحاج">📄 عرض إقرار الحاج</button>`
          : '';

        const actionsRow = (btnSupAck || btnView)
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${btnSupAck}${btnView}</div>`
          : '';

        return `
          <div style="background:${sc.bg};border:1px solid ${sc.color}33;border-radius:10px;padding:12px;margin-top:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:11px;color:#666;margin-bottom:4px">الحالة الحالية:</div>
                <span style="background:${sc.color};color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700">${icons[currentStatus]||''} ${currentStatus}</span>
              </div>
              <div style="text-align:left">
                <div style="font-size:11px;color:#666;margin-bottom:4px">وقت التسليم:</div>
                <div style="font-size:12px;color:${sc.color};font-weight:600">📅 ${time}</div>
              </div>
            </div>
            ${actionsRow}
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed ${sc.color}44;font-size:11px;color:#888;display:flex;align-items:center;gap:6px">
              <span>ℹ️</span>
              <span>للتعديل على حالة البطاقة، يُرجى الانتقال لقسم "بطاقات نسك"</span>
            </div>
          </div>
        `;
      })()}
    </div>`);

  // حفظ البيانات للتحديث عند تغيير المخيم
  window._assignData = { camps, bookedMinaBeds, bookedArafatBeds, pilgrimId, sysusers };
  window._assignOriginal = {
    mina_camp: pilgrim['mina_camp']||'',
    mina_bed: pilgrim['mina_bed']||'',
    arafat_camp: pilgrim['arafat_camp']||'',
    arafat_bed: pilgrim['arafat_bed']||'',
    group_num: pilgrim['رقم فوج التفويج الخاص بك']||'',
    bus_num: pilgrim['رقم الحافلة الخاصة بك']||'',
    supervisor_name: pilgrim['اسم المشرف الخاص بالحاج']||'',
    supervisor_phone: pilgrim['رقم جوال المشرف']||''
  };
}


function onBusChange() {
  const busNum = document.getElementById('pa-bus').value;
  if(!busNum) return;
  const { sysusers } = window._assignData || {};
  if(!sysusers) return;
  const supervisor = sysusers.find(u => u.role === 'supervisor' && String(u.group_num) === String(busNum));
  if(supervisor) {
    const n = document.getElementById('pa-supervisor-name');
    const p = document.getElementById('pa-supervisor-phone');
    if(n) n.value = supervisor.name || '';
    if(p) p.value = supervisor.phone || '';
  }
}

async function cancelAssignModal(pilgrimId) {
  const orig = window._assignOriginal;
  if(!orig) { closeModals(); return; }
  const cur = {
    mina_camp:  document.getElementById('pa-mina-camp')?.value||'',
    mina_bed:   document.getElementById('pa-mina-bed')?.value||'',
    arafat_camp:document.getElementById('pa-arafat-camp')?.value||'',
    arafat_bed: document.getElementById('pa-arafat-bed')?.value||'',
    group_num:  document.getElementById('pa-group')?.value||'',
    bus_num:    document.getElementById('pa-bus')?.value||'',
    supervisor_name:  document.getElementById('pa-supervisor-name')?.value.trim()||'',
    supervisor_phone: document.getElementById('pa-supervisor-phone')?.value.trim()||''
  };
  const hasChange = Object.keys(orig).some(k => cur[k] !== orig[k]);
  if(!hasChange) { closeModals(); return; }
  const save = await showConfirm('يوجد تعديلات لم تُحفظ بعد. هل تريد حفظها؟','تعديلات غير محفوظة','💾 حفظ','#1a7a1a','⚠️');
  if(save===null) return;
  if(save) await savePilgrimAssign(pilgrimId);
  else closeModals();
}

function updateMinaBeds() {
  const campNum = document.getElementById('pa-mina-camp').value;
  const { camps, bookedMinaBeds, pilgrimId } = window._assignData;
  const camp = camps.find(c => (c.camp_num||c.name) === campNum);
  const bedSel = document.getElementById('pa-mina-bed');
  const campSel = document.getElementById('pa-mina-camp');
  if(!camp) { bedSel.innerHTML = '<option value="">اختر المخيم أولاً</option>'; return; }

  // التحقق من الجنس
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  if(pilgrim && camp.camp_type) {
    const g = pilgrim['الجنس']||'';
    const isFemale = g==='أنثى'||g==='أنثي'||g==='female'||g==='انثى';
    if(camp.camp_type==='نساء' && !isFemale) {
      campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للنساء — الحاج من الذكور', 'error');
    }
    if(camp.camp_type==='رجال' && isFemale) {
      campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للرجال — الحاجة من الإناث', 'error');
    }
  }

  // التحقق من السعة
  const cap = parseInt(camp.capacity)||0;
  if(cap > 0 && bookedMinaBeds.filter(b=>b.startsWith(campNum+'-')).length >= cap) {
    campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
    return showToast('مخيم منى ' + campNum + ' ممتلئ', 'error');
  }

  const campId = camp.camp_num||camp.name;
  let opts = '<option value="">اختر السرير</option>';
  for(let i=1; i<=cap; i++) {
    const key = campId+'-'+i;
    if(!bookedMinaBeds.includes(key)) opts += `<option value="${key}">${key}</option>`;
  }
  bedSel.innerHTML = opts;
}

function updateArafatBeds() {
  const campNum = document.getElementById('pa-arafat-camp').value;
  const { camps, bookedArafatBeds, pilgrimId } = window._assignData;
  const camp = camps.find(c => (c.camp_num||c.name) === campNum);
  const bedSel = document.getElementById('pa-arafat-bed');
  const campSel = document.getElementById('pa-arafat-camp');
  if(!camp) { bedSel.innerHTML = '<option value="">اختر المخيم أولاً</option>'; return; }

  // التحقق من الجنس
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  if(pilgrim && camp.camp_type) {
    const g = pilgrim['الجنس']||'';
    const isFemale = g==='أنثى'||g==='أنثي'||g==='female'||g==='انثى';
    if(camp.camp_type==='نساء' && !isFemale) {
      campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للنساء — الحاج من الذكور', 'error');
    }
    if(camp.camp_type==='رجال' && isFemale) {
      campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      return showToast('مخيم ' + campNum + ' مخصص للرجال — الحاجة من الإناث', 'error');
    }
  }

  // التحقق من السعة
  const cap = parseInt(camp.capacity)||0;
  if(cap > 0 && bookedArafatBeds.filter(b=>b.startsWith(campNum+'-')).length >= cap) {
    campSel.value=''; bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
    return showToast('مخيم عرفات ' + campNum + ' ممتلئ', 'error');
  }

  const campId = camp.camp_num||camp.name;
  let opts = '<option value="">اختر السرير</option>';
  for(let i=1; i<=cap; i++) {
    const key = campId+'-'+i;
    if(!bookedArafatBeds.includes(key)) opts += `<option value="${key}">${key}</option>`;
  }
  bedSel.innerHTML = opts;
}


async function saveNusukStatus(pilgrimId) {
  const status = document.getElementById('pa-nusuk-status').value;
  const pilgrim = ALL_DATA.find(r=>String(r['_supabase_id'])===String(pilgrimId))||{};
  const currentStatus = pilgrim['حالة بطاقة نسك']||'لم تطبع';

  // v20.2: فحص القفل — superadmin يتجاوز مع bypass_lock
  const bypassLock = _isNusukLocked(pilgrim) && status !== currentStatus && _isSuperAdmin();
  if(_isNusukLocked(pilgrim) && status !== currentStatus && !_isSuperAdmin()){
    showToast('🔒 البطاقة موقَّعة — استخدم 🔓 فتح القفل', 'warning');
    const sel = document.getElementById('pa-nusuk-status');
    if(sel) sel.value = currentStatus;
    return;
  }

  // إذا تغيرت الحالة إلى "لدى المشرف" → فتح إقرار المشرف
  if(status === 'لدى المشرف') {
    closeModals();
    openSupAck(pilgrimId, pilgrim);
    return;
  }

  // إذا تغيرت إلى "مسلّمة للحاج" → فتح إقرار الحاج
  if(status === 'مسلّمة للحاج') {
    closeModals();
    openPilgrimAck(pilgrimId, pilgrim);
    return;
  }

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), { nusuk_card_status: status });
    const r = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
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

    showToast(bypassLock ? '⚡ تم التعديل (تجاوز قفل — superadmin)' : 'تم تحديث حالة البطاقة', 'success');
    closeModals(); render();
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════
// v20.2 Phase 1: إعادة فتح بطاقة نسك (Reopen Flow)
// ═══════════════════════════════════════════════════════════════════════
const NUSUK_REOPEN_REASONS = [
  { key:'damage',  label:'🔧 تلف البطاقة',              target:'لدى المشرف',   hint:'البطاقة تالفة — المشرف يُرجعها للإدارة لطلب بديل' },
  { key:'lost',    label:'❌ فقدان البطاقة',            target:'لدى المشرف',   hint:'البطاقة مفقودة — المشرف يُرجعها للإدارة لطلب بديل' },
  { key:'wrong',   label:'⚠️ خطأ في التسليم لحاج خاطئ', target:'لدى المشرف',   hint:'البطاقة سليمة — إعادة تسليم لحاج صحيح' },
  { key:'correct', label:'✏️ تصحيح بيانات الحاج',       target:'لدى المشرف',   hint:'البطاقة سليمة — تحديث إجراء إداري' },
  { key:'other',   label:'💬 سبب آخر',                  target:'لدى المشرف',   hint:'تفاصيل إلزامية (≥10 حرف)' }
];

const NUSUK_REOPEN_REASONS_FROM_SUPERVISOR = [
  { key:'refuse',       label:'🚫 رفض المشرف استلام البطاقة',     target:'لدى الإدارة', hint:'المشرف يرفض استلام البطاقة' },
  { key:'replacement',  label:'🔄 مشرف بديل',                    target:'لدى الإدارة', hint:'تغيير إداري في المشرف' },
  { key:'dist_error',   label:'⚠️ خطأ في التوزيع',              target:'لدى الإدارة', hint:'خطأ في توزيع البطاقة للمشرف' },
  { key:'not_received', label:'📦 لم تصل البطاقة بشكل فعلي',     target:'لدى الإدارة', hint:'البطاقة لم تصل المشرف ميدانياً' },
  { key:'other_sup',    label:'💬 سبب آخر',                     target:'لدى الإدارة', hint:'تفاصيل إلزامية (≥10 حرف)' }
];

function openNusukReopenModal(pilgrimId){
  // v23.0-pre-mmm: دعم بوابة المشرف
  let pilgrim = (typeof ALL_DATA !== 'undefined' ? ALL_DATA : []).find(r=>String(r['_supabase_id'])===String(pilgrimId));

  if(!pilgrim && window._supPilgrims){
    const supP = window._supPilgrims.find(p => String(p.id) === String(pilgrimId));
    if(supP){
      pilgrim = {
        '_supabase_id': supP.id,
        'اسم الحاج': supP.name || '—',
        'رقم الهوية': supP.id_num || '—',
        'حالة بطاقة نسك': supP.nusuk_card_status || 'لدى المشرف',
        'نسك_time': supP.nusuk_card_time || '—'
      };
    }
  }

  if(!pilgrim) { showToast('لم يُعثر على بيانات الحاج', 'error'); return; }

  const currentStatus = pilgrim['حالة بطاقة نسك']||'—';
  const sigTime = pilgrim['نسك_time']||'—';

  const reasons = currentStatus === 'لدى المشرف'
    ? NUSUK_REOPEN_REASONS_FROM_SUPERVISOR
    : NUSUK_REOPEN_REASONS;

  const reasonsHtml = reasons.map((r,i) => `
    <label data-reason-row="${i}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${i===0?'#c8971a':'#e0e0e0'};background:${i===0?'#fff3e0':'#fff'};border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all 0.15s" onclick="_selectReopenReason(${i})">
      <input type="radio" name="reopen-reason" value="${r.key}" ${i===0?'checked':''} style="width:18px;height:18px;accent-color:#c00;cursor:pointer">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:#333">${r.label}</div>
        <div style="font-size:11px;color:#888;margin-top:3px">→ الحالة الجديدة: <strong style="color:#7a4500">${r.target}</strong> &nbsp;•&nbsp; ${r.hint}</div>
      </div>
    </label>
  `).join('');

  openModal(`
    <h3 class="modal-title" style="color:#c00">🔓 فتح قفل بطاقة نسك</h3>
    <div style="background:#fff3e0;border:1px solid #c8971a;border-radius:10px;padding:12px;font-size:12px;line-height:1.9;color:#7a4500;margin-bottom:14px;direction:rtl">
      <strong>الحاج:</strong> ${_esc(pilgrim['اسم الحاج']||'—')}<br>
      <strong>رقم الهوية:</strong> ${_esc(pilgrim['رقم الهوية']||'—')}<br>
      <strong>الحالة الحالية:</strong> ${_esc(currentStatus)}<br>
      <strong>التوقيع مسجَّل:</strong> ${_esc(sigTime)}<br>
      <em style="color:#c00;display:block;margin-top:6px">⚠️ سيتم حذف التوقيع ووقت التسليم، وتحديث الحالة حسب السبب المختار.</em>
    </div>
    <div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:8px">اختر سبب إعادة الفتح:</div>
    <div id="reopen-reasons">${reasonsHtml}</div>
    <div style="margin-top:12px">
      <label style="font-size:12px;font-weight:700;color:#3d2000;display:block">تفاصيل إضافية <span id="reopen-required" style="color:#c00;display:none;font-weight:400">(إلزامي ≥10 حرف)</span></label>
      <textarea id="reopen-details" placeholder="اكتب تفاصيل السبب..." style="width:100%;min-height:70px;padding:10px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;margin-top:6px;direction:rtl;resize:vertical" oninput="_checkReopenDetails()"></textarea>
    </div>
    <div class="modal-btns" style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button onclick="confirmNusukReopen(${pilgrimId})" id="reopen-confirm-btn" style="padding:11px;background:#c00;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🔓 تأكيد فتح القفل</button>
      <button onclick="closeModals()" style="padding:11px;background:#f5f5f5;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">إلغاء</button>
    </div>
  `);
}

function _selectReopenReason(idx){
  document.querySelectorAll('[data-reason-row]').forEach(el => {
    el.style.background = '#fff';
    el.style.borderColor = '#e0e0e0';
  });
  const row = document.querySelector('[data-reason-row="'+idx+'"]');
  if(row){ row.style.background='#fff3e0'; row.style.borderColor='#c8971a'; }
  const radio = row && row.querySelector('input');
  if(radio) radio.checked = true;
  _checkReopenDetails();
}

function _checkReopenDetails(){
  const reason = document.querySelector('input[name="reopen-reason"]:checked')?.value;
  const details = (document.getElementById('reopen-details')?.value || '').trim();
  const hint = document.getElementById('reopen-required');
  const btn = document.getElementById('reopen-confirm-btn');
  if(!hint || !btn) return;
  if(reason === 'other' || reason === 'other_sup'){
    hint.style.display = 'inline';
    const ok = details.length >= 10;
    hint.style.color = ok ? '#1a7a1a' : '#c00';
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
  } else {
    hint.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

async function confirmNusukReopen(pilgrimId){
  const reasonKey = document.querySelector('input[name="reopen-reason"]:checked')?.value;
  const details = (document.getElementById('reopen-details')?.value || '').trim();
  const pilgrim_ = ALL_DATA.find(r=>String(r['_supabase_id'])===String(pilgrimId))||{};
  const currentStatus_ = pilgrim_['حالة بطاقة نسك']||'';
  const isFromSupervisor = currentStatus_ === 'لدى المشرف';
  const reasonsList = isFromSupervisor ? NUSUK_REOPEN_REASONS_FROM_SUPERVISOR : NUSUK_REOPEN_REASONS;
  const reasonDef = reasonsList.find(r=>r.key===reasonKey);
  if(!reasonDef){ showToast('اختر سبباً', 'warning'); return; }
  if((reasonKey === 'other' || reasonKey === 'other_sup') && details.length < 10){
    showToast('تفاصيل "سبب آخر" إلزامية (≥10 حرف)', 'warning');
    return;
  }

  const pilgrim = ALL_DATA.find(r=>String(r['_supabase_id'])===String(pilgrimId))||{};
  const oldStatus = pilgrim['حالة بطاقة نسك']||null;
  const oldSig    = pilgrim['نسك_sig']||null;
  const oldTime   = pilgrim['نسك_time']||null;

  // v23.0-pre-i: منطق الحفظ يعتمد على الحالة الحالية
  const updates = { nusuk_card_status: reasonDef.target };
  const fieldChanges = {
    nusuk_card_status: { before: oldStatus, after: reasonDef.target }
  };
  const oldSupSig = pilgrim['نسك_supervisor_sig']||null;
  const oldSupTime = pilgrim['نسك_supervisor_time']||null;
  const oldSupAck  = pilgrim['نسك_supervisor_ack_id']||null;

  if (isFromSupervisor) {
    updates.nusuk_supervisor_sig = null;
    updates.nusuk_supervisor_time = null;
    updates.nusuk_supervisor_ack_id = null;
    fieldChanges.nusuk_supervisor_sig    = { before: oldSupSig,  after: null };
    fieldChanges.nusuk_supervisor_time   = { before: oldSupTime, after: null };
    fieldChanges.nusuk_supervisor_ack_id = { before: oldSupAck,  after: null };
  } else {
    updates.nusuk_card_sig = null;
    updates.nusuk_card_time = null;
    fieldChanges.nusuk_card_sig  = { before: oldSig,  after: null };
    fieldChanges.nusuk_card_time = { before: oldTime, after: null };
  }

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    pilgrim['حالة بطاقة نسك'] = reasonDef.target;
    if (isFromSupervisor) {
      pilgrim['نسك_supervisor_sig'] = '';
      pilgrim['نسك_supervisor_time'] = '';
      pilgrim['نسك_supervisor_ack_id'] = '';
    } else {
      pilgrim['نسك_sig']  = '';
      pilgrim['نسك_time'] = '';
    }

    const auditSource = isFromSupervisor
      ? 'admin_nusuk_reopen_from_supervisor'
      : 'admin_nusuk_reopen_from_pilgrim';

    _recordAudit({
      action_type:  'update',
      entity_type:  'pilgrim',
      entity_id:    String(pilgrimId),
      entity_label: _buildPilgrimLabel(pilgrim),
      field_changes: fieldChanges,
      metadata: {
        source:         auditSource,
        reason_key:     reasonKey,
        reason_label:   reasonDef.label,
        reason_details: details || null,
        old_status:     oldStatus
      }
    });

    closeModals();
    showToast(`✅ تم فتح القفل — الحالة الآن: ${reasonDef.target}`, 'success');
    render();

    // v23.0-pre-mmm: تحديث بوابة المشرف إن كانت مفتوحة
    if(window._currentUser?.role === 'supervisor' && typeof loadSupervisorPanel === 'function'){
      setTimeout(() => loadSupervisorPanel(window._currentUser), 500);
    }
  } catch(e){ showToast('خطأ: '+e.message, 'error'); }
}

// ===== إقرار المشرف =====
function openSupAck(pilgrimId, pilgrim) {
  const dev = window._devSettings || {};
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic');
  openModal(`
    <h3 class="modal-title">📋 إقرار تسليم بطاقة نسك للمشرف</h3>
    <div style="background:#fff8e1;border-radius:10px;padding:14px;font-size:13px;line-height:1.8;color:#333;margin-bottom:16px;direction:rtl">
      <strong>إقرار تسليم بطاقة نسك للمشرف</strong><br><br>
      اسم الحملة / الشركة: <strong>${dev.companyName||''}</strong><br>
      اسم الحاج: <strong>${pilgrim['اسم الحاج']||'—'}</strong><br>
      رقم الهوية: <strong>${pilgrim['رقم الهوية']||'—'}</strong><br>
      رقم الحافلة: <strong>${pilgrim['رقم الحافلة الخاصة بك']||'—'}</strong><br>
      تاريخ الاستلام: <strong>${dateStr}</strong><br><br>
      <em>أقر بأنني استلمت بطاقة نسك الخاصة بالحاج المذكور وسأسلّمها له بعد التحقق من هويته وأخذ توقيعه.</em>
    </div>
    <div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:8px">✍️ توقيع المشرف</div>
    <div style="border:2px dashed #c8971a;border-radius:10px;overflow:hidden;background:#fafafa;margin-bottom:10px">
      <canvas id="sup-ack-canvas" width="420" height="150" style="width:100%;display:block;touch-action:none;cursor:crosshair"></canvas>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button onclick="clearCanvas('sup-ack-canvas')" style="padding:10px;background:#f5f5f5;border:none;border-radius:8px;cursor:pointer;font-family:inherit">🗑️ مسح</button>
      <button onclick="confirmSupAck(${pilgrimId})" style="padding:10px;background:#7a4500;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit">✅ تأكيد الاستلام</button>
    </div>
    <button onclick="closeModals()" style="margin-top:8px;width:100%;padding:8px;background:#fff;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-family:inherit;color:#888;font-size:13px">إلغاء</button>
  `);
  setTimeout(() => initAckCanvas('sup-ack-canvas'), 100);
}

async function confirmSupAck(pilgrimId) {
  const canvas = document.getElementById('sup-ack-canvas');
  if(!canvas || isCanvasBlank(canvas)) { showToast('يرجى التوقيع أولاً', 'warning'); return; }
  const sig = canvas.toDataURL('image/png', 0.7);
  const now = new Date().toLocaleString('ar-SA');

  // v20.1: snapshot قبل التحديث (لـ audit)
  const r = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  const before = {
    nusuk_card_status: r ? (r['حالة بطاقة نسك'] ?? null) : null,
    nusuk_card_sig:    r ? (r['نسك_sig']        ?? null) : null,
    nusuk_card_time:   r ? (r['نسك_time']       ?? null) : null
  };
  const updates = { nusuk_card_status: 'لدى المشرف', nusuk_card_sig: sig, nusuk_card_time: now };

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    if(r) {
      r['حالة بطاقة نسك'] = 'لدى المشرف';
      r['نسك_sig']        = sig;
      r['نسك_time']       = now;
    }

    // v20.1: audit (sig مقنّع تلقائياً عبر _maskSensitiveInChanges في _recordAudit)
    // v20.2: bypass_lock عند تجاوز superadmin لقفل 'مسلّمة للحاج'
    const changes = _buildFieldChanges(before, updates);
    if(changes){
      const meta = { source: 'admin_nusuk_supervisor_receive' };
      if(_isSuperAdmin() && before.nusuk_card_sig && before.nusuk_card_status === 'مسلّمة للحاج'){
        meta.bypass_lock = true;
      }
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(r),
        field_changes: changes,
        metadata: meta
      });
    }

    showToast('تم تسجيل استلام المشرف', 'success');
    closeModals(); render();
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

// ===== إقرار الحاج =====
function openPilgrimAck(pilgrimId, pilgrim) {
  const dev = window._devSettings || {};
  const companyName = dev.companyName||'';
  const license = dev.license || '';
  const stamp = dev.stamp || '';
  const repName = dev.rep_name || '';   // v22.5
  const repSig  = dev.rep_sig  || '';   // v22.5
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic');
  const timeStr = now.toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'});
  const name  = pilgrim['اسم الحاج']||'—';
  const idNum = pilgrim['رقم الهوية']||'—';
  const phone = pilgrim['رقم الجوال']||'—';

  // v22.2: تصميم رسمي — شعار + ترخيص + 4 تعهّدات مرقّمة + ختم + التوقيع
  openModal(`
    <style>#modal-overlay .modal-box{max-width:560px}</style>
    <div style="border-bottom:3px solid #3d2000;padding-bottom:12px;margin-bottom:14px;text-align:center">
      <div style="margin-bottom:6px">${_buildPrintLogoHTML(55)}</div>
      <div style="font-size:14px;font-weight:800;color:#3d2000">${_esc(companyName||'—')}</div>
      ${license?`<div style="font-size:11px;color:#777;margin-top:2px">رقم الترخيص: ${_esc(license)}</div>`:''}
      <div style="font-size:15px;font-weight:700;color:#7a4500;margin-top:10px">📋 تعهد استلام بطاقة نسك</div>
    </div>

    <div style="background:#fffbf0;border:1px solid #e0d5c5;border-radius:10px;padding:12px 14px;font-size:12px;line-height:2;color:#333;margin-bottom:12px;direction:rtl">
      <strong>الحاج/ـة:</strong> ${_esc(name)}<br>
      <strong>🪪 رقم الهوية/الإقامة:</strong> <span style="direction:ltr">${_esc(idNum)}</span><br>
      <strong>📱 رقم الجوال:</strong> <span style="direction:ltr">${_esc(phone)}</span><br>
      <strong>📅 التاريخ:</strong> ${_esc(dateStr)} &nbsp;•&nbsp; <strong>🕒 الوقت:</strong> ${_esc(timeStr)}
    </div>

    <div style="font-size:12px;color:#333;margin-bottom:10px;direction:rtl;line-height:1.9">
      أقر أنا المذكور/ـة أعلاه بأنني استلمت بطاقة "نسك" الخاصة بي من <strong>${_esc(companyName||'الشركة')}</strong>، وأتعهد بما يلي:
    </div>

    <div style="background:#fff;border:1.5px solid #e0d5c5;border-radius:10px;padding:10px 14px;margin-bottom:10px;direction:rtl">
      <div style="margin:0 0 8px;padding:6px 10px;background:#fffbf0;border:1px dashed #c8971a;border-radius:6px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="pilgrim-ack-check-all" onchange="_toggleAllPilgrimAckPledges(this)" style="width:18px;height:18px;cursor:pointer;accent-color:#1a7a1a">
        <label for="pilgrim-ack-check-all" style="font-size:12px;color:#7a4500;font-weight:700;cursor:pointer">✅ تحديد الكل (جميع البنود)</label>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="ack1" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">1.</strong> المحافظة على بطاقة نسك وعدم فقدانها أو إتلافها.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="ack2" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">2.</strong> إبراز البطاقة عند الطلب في جميع مراحل التنقل وأداء المناسك.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="ack3" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">3.</strong> الالتزام بالتعليمات والإرشادات المرتبطة باستخدام البطاقة.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:0;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="ack4" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">4.</strong> إبلاغ الحملة فوراً في حال فقدان البطاقة أو وجود أي مشكلة.</span>
      </label>
    </div>

    <div style="font-size:11px;color:#666;direction:rtl;margin-bottom:12px;line-height:1.7;text-align:center;font-style:italic">
      وأتحمل كامل المسؤولية في حال الإهمال أو إساءة الاستخدام.
    </div>

    ${(repName || repSig || stamp) ? `
    <div style="text-align:center;padding:14px;border:1.5px dashed #c8971a;border-radius:10px;background:#fdfbf5;margin-bottom:14px">
      <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600">ممثل الشركة</div>
      ${repName ? `<div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:10px">${_esc(repName)}</div>` : ''}
      <div style="display:flex;gap:16px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
        ${repSig ? `<div style="text-align:center">
          <img src="${_esc(repSig)}" alt="توقيع الممثل" style="max-width:120px;max-height:60px;object-fit:contain;border:1px solid #eee;border-radius:4px;background:#fff">
          <div style="font-size:10px;color:#aaa;margin-top:4px">التوقيع</div>
        </div>` : ''}
        ${stamp ? `<div style="text-align:center">
          <img src="${_esc(stamp)}" alt="الختم" style="max-width:70px;max-height:70px;object-fit:contain">
          <div style="font-size:10px;color:#aaa;margin-top:4px">الختم</div>
        </div>` : ''}
      </div>
    </div>
    ` : ''}

    <div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:6px;direction:rtl">✍️ توقيع الحاج</div>
    <div style="border:2px dashed #c8971a;border-radius:10px;overflow:hidden;background:#fafafa;margin-bottom:10px">
      <canvas id="pilgrim-ack-canvas" width="420" height="150" style="width:100%;display:block;touch-action:none;cursor:crosshair"></canvas>
    </div>

    <label style="display:flex;gap:8px;align-items:center;background:#fffbf0;border:1.5px solid #e0d5c5;border-radius:8px;padding:10px 12px;font-size:12px;color:#3d2000;margin-bottom:10px;direction:rtl;cursor:pointer">
      <input type="checkbox" id="pilgrim-ack-print" checked style="width:16px;height:16px;accent-color:#7a4500;cursor:pointer">
      <span>🖨️ فتح صفحة طباعة للإقرار بعد الحفظ (يمكن حفظها كـ PDF)</span>
    </label>

    <!-- v23.0-pre-jjj: تخطيط محسّن للأزرار -->
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
      <!-- السطر 1: زر التأكيد (عريض وبارز) -->
      <button onclick="confirmPilgrimAck(${pilgrimId})"
        style="width:100%;padding:14px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(46,125,50,0.3);transition:all 0.2s">
        ✅ تأكيد الاستلام
      </button>

      <!-- السطر 2: زر المسح + زر الإلغاء (نصف/نصف) -->
      <div style="display:flex;gap:8px">
        <button onclick="clearCanvas('pilgrim-ack-canvas')"
          style="flex:1;padding:11px;background:#f5f5f5;color:#555;border:1.5px solid #ddd;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s">
          🗑️ مسح التوقيع
        </button>
        <button onclick="closeModals()"
          style="flex:1;padding:11px;background:#fff;color:#c00;border:1.5px solid #c00;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s">
          ❌ إلغاء
        </button>
      </div>
    </div>
  `);
  setTimeout(() => initAckCanvas('pilgrim-ack-canvas'), 100);
}

function openPilgrimBraceletAck(pilgrimId, pilgrim) {
  const dev = window._devSettings || {};
  const companyName = dev.companyName||'';
  const license = dev.license || '';
  const stamp = dev.stamp || '';
  const repName = dev.rep_name || '';   // v22.5
  const repSig  = dev.rep_sig  || '';   // v22.5
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic');
  const timeStr = now.toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'});
  const name  = pilgrim['اسم الحاج']||'—';
  const idNum = pilgrim['رقم الهوية']||'—';
  const phone = pilgrim['رقم الجوال']||'—';

  // v22.2: تصميم رسمي — شعار + ترخيص + 4 تعهّدات مرقّمة + ختم + التوقيع
  openModal(`
    <style>#modal-overlay .modal-box{max-width:560px}</style>
    <div style="border-bottom:3px solid #3d2000;padding-bottom:12px;margin-bottom:14px;text-align:center">
      <div style="margin-bottom:6px">${_buildPrintLogoHTML(55)}</div>
      <div style="font-size:14px;font-weight:800;color:#3d2000">${_esc(companyName||'—')}</div>
      ${license?`<div style="font-size:11px;color:#777;margin-top:2px">رقم الترخيص: ${_esc(license)}</div>`:''}
      <div style="font-size:15px;font-weight:700;color:#7a4500;margin-top:10px">📋 تعهد استلام أسوارة القطار</div>
    </div>

    <div style="background:#fffbf0;border:1px solid #e0d5c5;border-radius:10px;padding:12px 14px;font-size:12px;line-height:2;color:#333;margin-bottom:12px;direction:rtl">
      <strong>الحاج/ـة:</strong> ${_esc(name)}<br>
      <strong>🪪 رقم الهوية/الإقامة:</strong> <span style="direction:ltr">${_esc(idNum)}</span><br>
      <strong>📱 رقم الجوال:</strong> <span style="direction:ltr">${_esc(phone)}</span><br>
      <strong>📅 التاريخ:</strong> ${_esc(dateStr)} &nbsp;•&nbsp; <strong>🕒 الوقت:</strong> ${_esc(timeStr)}
    </div>

    <div style="font-size:12px;color:#333;margin-bottom:10px;direction:rtl;line-height:1.9">
      أقر أنا المذكور/ـة أعلاه بأنني استلمت أسوارة "القطار" الخاصة بي من <strong>${_esc(companyName||'الشركة')}</strong>، وأتعهد بما يلي:
    </div>

    <div style="background:#fff;border:1.5px solid #e0d5c5;border-radius:10px;padding:10px 14px;margin-bottom:10px;direction:rtl">
      <div style="margin:0 0 8px;padding:6px 10px;background:#fffbf0;border:1px dashed #c8971a;border-radius:6px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="pilgrim-bracelet-ack-check-all" onchange="_toggleAllPilgrimBraceletAckPledges(this)" style="width:18px;height:18px;cursor:pointer;accent-color:#1a7a1a">
        <label for="pilgrim-bracelet-ack-check-all" style="font-size:12px;color:#7a4500;font-weight:700;cursor:pointer">✅ تحديد الكل (جميع البنود)</label>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="bracelet-ack1" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">1.</strong> المحافظة على أسوارة القطار وعدم فقدانها أو إتلافها.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="bracelet-ack2" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">2.</strong> إبراز الأسوارة عند الطلب في جميع مراحل التنقل وأداء المناسك.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="bracelet-ack3" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">3.</strong> الالتزام بالتعليمات والإرشادات المرتبطة باستخدام الأسوارة.</span>
      </label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:0;font-size:12px;line-height:1.9;cursor:pointer">
        <input type="checkbox" id="bracelet-ack4" style="margin-top:4px;width:16px;height:16px;accent-color:#1a7a1a;cursor:pointer">
        <span><strong style="color:#7a4500">4.</strong> إبلاغ الحملة فوراً في حال فقدان الأسوارة أو وجود أي مشكلة.</span>
      </label>
    </div>

    <div style="font-size:11px;color:#666;direction:rtl;margin-bottom:12px;line-height:1.7;text-align:center;font-style:italic">
      وأتحمل كامل المسؤولية في حال الإهمال أو إساءة الاستخدام.
    </div>

    ${(repName || repSig || stamp) ? `
    <div style="text-align:center;padding:14px;border:1.5px dashed #c8971a;border-radius:10px;background:#fdfbf5;margin-bottom:14px">
      <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:600">ممثل الشركة</div>
      ${repName ? `<div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:10px">${_esc(repName)}</div>` : ''}
      <div style="display:flex;gap:16px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
        ${repSig ? `<div style="text-align:center">
          <img src="${_esc(repSig)}" alt="توقيع الممثل" style="max-width:120px;max-height:60px;object-fit:contain;border:1px solid #eee;border-radius:4px;background:#fff">
          <div style="font-size:10px;color:#aaa;margin-top:4px">التوقيع</div>
        </div>` : ''}
        ${stamp ? `<div style="text-align:center">
          <img src="${_esc(stamp)}" alt="الختم" style="max-width:70px;max-height:70px;object-fit:contain">
          <div style="font-size:10px;color:#aaa;margin-top:4px">الختم</div>
        </div>` : ''}
      </div>
    </div>
    ` : ''}

    <div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:6px;direction:rtl">✍️ توقيع الحاج</div>
    <div style="border:2px dashed #c8971a;border-radius:10px;overflow:hidden;background:#fafafa;margin-bottom:10px">
      <canvas id="pilgrim-bracelet-ack-canvas" width="420" height="150" style="width:100%;display:block;touch-action:none;cursor:crosshair"></canvas>
    </div>

    <label style="display:flex;gap:8px;align-items:center;background:#fffbf0;border:1.5px solid #e0d5c5;border-radius:8px;padding:10px 12px;font-size:12px;color:#3d2000;margin-bottom:10px;direction:rtl;cursor:pointer">
      <input type="checkbox" id="pilgrim-bracelet-ack-print" checked style="width:16px;height:16px;accent-color:#7a4500;cursor:pointer">
      <span>🖨️ فتح صفحة طباعة للإقرار بعد الحفظ (يمكن حفظها كـ PDF)</span>
    </label>

    <!-- v23.0-pre-jjj: تخطيط محسّن للأزرار -->
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
      <!-- السطر 1: زر التأكيد (عريض وبارز) -->
      <button onclick="confirmPilgrimBraceletAck(${pilgrimId})"
        style="width:100%;padding:14px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(46,125,50,0.3);transition:all 0.2s">
        ✅ تأكيد الاستلام
      </button>

      <!-- السطر 2: زر المسح + زر الإلغاء (نصف/نصف) -->
      <div style="display:flex;gap:8px">
        <button onclick="clearCanvas('pilgrim-bracelet-ack-canvas')"
          style="flex:1;padding:11px;background:#f5f5f5;color:#555;border:1.5px solid #ddd;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s">
          🗑️ مسح التوقيع
        </button>
        <button onclick="closeModals()"
          style="flex:1;padding:11px;background:#fff;color:#c00;border:1.5px solid #c00;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s">
          ❌ إلغاء
        </button>
      </div>
    </div>
  `);
  setTimeout(() => initAckCanvas('pilgrim-bracelet-ack-canvas'), 100);
}

// v23.0-pre-ccc: تصدير openPilgrimAck للاستخدام من supervisor.js
window.openPilgrimAck = openPilgrimAck;
window.openPilgrimBraceletAck = openPilgrimBraceletAck;

// إضافة دوال أخرى إن وُجدت (اختياري)
if(typeof confirmPilgrimAck === 'function') window.confirmPilgrimAck = confirmPilgrimAck;
if(typeof confirmPilgrimBraceletAck === 'function') window.confirmPilgrimBraceletAck = confirmPilgrimBraceletAck;

// v23.0-pre-oo: تحديد/إلغاء كل بنود إقرار الحاج
function _toggleAllPilgrimAckPledges(checkAllEl){
  const allChecked = checkAllEl.checked;
  // ابحث عن كل checkboxes داخل نافذة الإقرار (ليس زر "تحديد الكل" نفسه)
  const pledgeIds = ['ack1', 'ack2', 'ack3', 'ack4'];
  pledgeIds.forEach(id => {
    const cb = document.getElementById(id);
    if(cb) cb.checked = allChecked;
  });
}
window._toggleAllPilgrimAckPledges = _toggleAllPilgrimAckPledges;

// v23.0-pre-oo: تحديد/إلغاء كل بنود إقرار الأسوارة
function _toggleAllPilgrimBraceletAckPledges(checkAllEl){
  const allChecked = checkAllEl.checked;
  // ابحث عن كل checkboxes داخل نافذة الإقرار (ليس زر "تحديد الكل" نفسه)
  const pledgeIds = ['bracelet-ack1', 'bracelet-ack2', 'bracelet-ack3', 'bracelet-ack4'];
  pledgeIds.forEach(id => {
    const cb = document.getElementById(id);
    if(cb) cb.checked = allChecked;
  });
}
window._toggleAllPilgrimBraceletAckPledges = _toggleAllPilgrimBraceletAckPledges;

async function confirmPilgrimAck(pilgrimId) {
  const checks = ['ack1','ack2','ack3','ack4'];
  const allChecked = checks.every(id => document.getElementById(id)?.checked);
  if(!allChecked) { showToast('يرجى الموافقة على جميع البنود أولاً', 'warning'); return; }
  const canvas = document.getElementById('pilgrim-ack-canvas');
  if(!canvas || isCanvasBlank(canvas)) { showToast('يرجى التوقيع أولاً', 'warning'); return; }
  // v20.4: قراءة تفضيل الطباعة (مُفعَّل افتراضياً)
  const shouldPrint = !!document.getElementById('pilgrim-ack-print')?.checked;
  const sig = canvas.toDataURL('image/png', 0.7);
  const now = new Date().toLocaleString('ar-SA');

  // v22.1: قفل التسليم الصارم — يجب استلام المشرف البطاقة قبل تسليمها للحاج
  const pilgrimRef = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  const pilgrimStatus_1130 = pilgrimRef?.['حالة بطاقة نسك'] || pilgrimRef?.nusuk_card_status || '';
  if(pilgrimStatus_1130 === 'لدى الإدارة' && !_isSuperAdmin()){
    showToast('🔒 يجب استلام البطاقة من الإدارة (عبر المشرف) أولاً', 'error');
    return;
  }

  // v20.1: snapshot قبل التحديث (لـ audit)
  const r = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  const before = {
    nusuk_card_status: r ? (r['حالة بطاقة نسك'] ?? null) : null,
    nusuk_card_sig:    r ? (r['نسك_sig']        ?? null) : null,
    nusuk_card_time:   r ? (r['نسك_time']       ?? null) : null
  };
  const updates = { nusuk_card_status: 'مسلّمة للحاج', nusuk_card_sig: sig, nusuk_card_time: now };

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    if(r) {
      r['حالة بطاقة نسك'] = 'مسلّمة للحاج';
      r['نسك_sig']        = sig;
      r['نسك_time']       = now;
    }

    // v20.1: audit (sig مقنّع تلقائياً عبر _maskSensitiveInChanges في _recordAudit)
    // v20.2: bypass_lock عند تجاوز superadmin لقفل 'مسلّمة للحاج' (إعادة توقيع)
    // v22.1: bypass_no_supervisor_ack عند تجاوز superadmin لقفل التسليم قبل المشرف
    const changes = _buildFieldChanges(before, updates);
    if(changes){
      const meta = { source: 'admin_nusuk_pilgrim_receive' };
      if(_isSuperAdmin() && before.nusuk_card_sig && before.nusuk_card_status === 'مسلّمة للحاج'){
        meta.bypass_lock = true;
      }
      if(_isSuperAdmin() && pilgrimStatus_1130 === 'لدى الإدارة') meta.bypass_no_supervisor_ack = true;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(r),
        field_changes: changes,
        metadata: meta
      });
    }

    showToast('تم تسجيل استلام الحاج', 'success');
    closeModals(); render();

    // v23.0-pre-hhh: تحديث بوابة المشرف + نافذة القائمة بعد التوقيع
    setTimeout(() => {
      // 1. تحديث بيانات المشرف إن كان مسجّلاً دخولاً
      if(window._currentUser?.role === 'supervisor'){
        if(typeof loadSupervisorPanel === 'function'){
          console.log('[pilgrim-ack] Refreshing supervisor panel after signature');
          loadSupervisorPanel(window._currentUser);
        }
      }

      // 2. إعادة رسم أي قائمة مفتوحة (modal handover list)
      if(typeof window.refreshNusukHandoverList === 'function'){
        window.refreshNusukHandoverList();
      }
      if(typeof window.refreshBraceletHandoverList === 'function'){
        window.refreshBraceletHandoverList();
      }
    }, 500);

    // v20.4: فتح صفحة الإقرار للطباعة/Save as PDF (اختياري، مُفعَّل افتراضياً)
    if(shouldPrint && typeof viewPilgrimAck === 'function'){
      setTimeout(() => viewPilgrimAck(pilgrimId), 200);
    }
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function confirmPilgrimBraceletAck(pilgrimId) {
  const checks = ['bracelet-ack1','bracelet-ack2','bracelet-ack3','bracelet-ack4'];
  const allChecked = checks.every(id => document.getElementById(id)?.checked);
  if(!allChecked) { showToast('يرجى الموافقة على جميع البنود أولاً', 'warning'); return; }
  const canvas = document.getElementById('pilgrim-bracelet-ack-canvas');
  if(!canvas || isCanvasBlank(canvas)) { showToast('يرجى التوقيع أولاً', 'warning'); return; }
  // v20.4: قراءة تفضيل الطباعة (مُفعَّل افتراضياً)
  const shouldPrint = !!document.getElementById('pilgrim-bracelet-ack-print')?.checked;
  const sig = canvas.toDataURL('image/png', 0.7);
  const now = new Date().toLocaleString('ar-SA');

  // v22.1: قفل التسليم الصارم — يجب استلام المشرف الأسوارة قبل تسليمها للحاج
  const pilgrimRef = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  const pilgrimStatus = pilgrimRef?.['حالة أسوارة القطار'] || pilgrimRef?.bracelet_card_status || '';
  if(pilgrimStatus === 'لدى الإدارة' && !_isSuperAdmin()){
    showToast('🔒 يجب استلام الأسوارة من الإدارة (عبر المشرف) أولاً', 'error');
    return;
  }

  // v20.1: snapshot قبل التحديث (لـ audit)
  const r = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pilgrimId));
  const before = {
    bracelet_card_status: r ? (r['حالة أسوارة القطار'] ?? null) : null,
    bracelet_sig:         r ? (r['أسوارة_sig']      ?? null) : null,
    bracelet_time:        r ? (r['أسوارة_time']     ?? null) : null
  };
  const updates = { bracelet_card_status: 'مسلّمة للحاج', bracelet_sig: sig, bracelet_time: now };

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    if(r) {
      r['حالة أسوارة القطار'] = 'مسلّمة للحاج';
      r['أسوارة_sig']        = sig;
      r['أسوارة_time']       = now;
    }

    // v20.1: audit (sig مقنّع تلقائياً عبر _maskSensitiveInChanges في _recordAudit)
    // v20.2: bypass_lock عند تجاوز superadmin لقفل 'مسلّمة للحاج' (إعادة توقيع)
    // v22.1: bypass_no_supervisor_ack عند تجاوز superadmin لقفل التسليم قبل المشرف
    const changes = _buildFieldChanges(before, updates);
    if(changes){
      const meta = { source: 'admin_bracelet_pilgrim_receive' };
      if(_isSuperAdmin() && before.bracelet_sig && before.bracelet_card_status === 'مسلّمة للحاج'){
        meta.bypass_lock = true;
      }
      if(_isSuperAdmin() && pilgrimStatus === 'لدى الإدارة') meta.bypass_no_supervisor_ack = true;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(r),
        field_changes: changes,
        metadata: meta
      });
    }

    showToast('تم تسجيل استلام الحاج للأسوارة', 'success');
    closeModals(); render();

    // v23.0-pre-hhh: تحديث بوابة المشرف + نافذة القائمة بعد التوقيع
    setTimeout(() => {
      // 1. تحديث بيانات المشرف إن كان مسجّلاً دخولاً
      if(window._currentUser?.role === 'supervisor'){
        if(typeof loadSupervisorPanel === 'function'){
          console.log('[pilgrim-ack] Refreshing supervisor panel after bracelet signature');
          loadSupervisorPanel(window._currentUser);
        }
      }

      // 2. إعادة رسم أي قائمة مفتوحة (modal handover list)
      if(typeof window.refreshNusukHandoverList === 'function'){
        window.refreshNusukHandoverList();
      }
      if(typeof window.refreshBraceletHandoverList === 'function'){
        window.refreshBraceletHandoverList();
      }
    }, 500);

    // v20.4: فتح صفحة الإقرار للطباعة/Save as PDF (اختياري، مُفعَّل افتراضياً)
    if(shouldPrint && typeof viewPilgrimBraceletAck === 'function'){
      setTimeout(() => viewPilgrimBraceletAck(pilgrimId), 200);
    }
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

// ===== مساعد التوقيع =====
function initAckCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if(!canvas || canvas._init) return;
  canvas._init = true;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  let drawing = false, lx=0, ly=0;
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width/r.width, sy = canvas.height/r.height;
    const src = e.touches?e.touches[0]:e;
    return [(src.clientX-r.left)*sx, (src.clientY-r.top)*sy];
  };
  canvas.onmousedown = e=>{drawing=true;[lx,ly]=pos(e);};
  canvas.onmousemove = e=>{if(!drawing)return;const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();[lx,ly]=[x,y];};
  canvas.onmouseup = ()=>drawing=false;
  canvas.ontouchstart = e=>{e.preventDefault();drawing=true;[lx,ly]=pos(e);};
  canvas.ontouchmove = e=>{e.preventDefault();if(!drawing)return;const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();[lx,ly]=[x,y];};
  canvas.ontouchend = ()=>drawing=false;
}

function clearCanvas(canvasId) {
  const c = document.getElementById(canvasId);
  if(c) c.getContext('2d').clearRect(0,0,c.width,c.height);
}

function isCanvasBlank(canvas) {
  const blank = document.createElement('canvas');
  blank.width=canvas.width; blank.height=canvas.height;
  return canvas.toDataURL()===blank.toDataURL();
}

async function savePilgrimAssign(pilgrimId) {
  const minaCampVal = document.getElementById('pa-mina-camp').value;
  const minaBedVal = document.getElementById('pa-mina-bed').value;
  const arafatCampVal = document.getElementById('pa-arafat-camp').value;
  const arafatBedVal = document.getElementById('pa-arafat-bed').value;

  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  await _refreshCampsCache();
  const camps = window._campsCache;
  const g = _genderOf(pilgrim);

  // قاعدة 1 (Gender) — error صلب عبر showActionModal
  for(const [loc, val, locAr] of [['mina', minaCampVal, 'منى'], ['arafat', arafatCampVal, 'عرفات']]){
    if(!val) continue;
    const camp = camps.find(c => (c.camp_num || c.name) === val);
    if(camp && camp.camp_type && !_campMatchesGenderGlobal(camp.camp_type, g)){
      await showActionModal({
        type:'error',
        title:'جنس غير مطابق — لا يمكن التسكين',
        description:'لا يمكن تسكين هذا الحاج في مخيم مخصَّص للجنس الآخر — قاعدة شرعية صلبة.',
        items:[
          { icon:'👤', label:'اسم الحاج:',      value:(pilgrim&&pilgrim['اسم الحاج'])||'—' },
          { icon:'🏕️', label:'المخيم المطلوب:', value: val + ' (مخصَّص للـ' + camp.camp_type + ')' },
          { icon:'📍', label:'الموقع:',         value: locAr }
        ],
        actions:[{label:'فهمت', value:null, variant:'primary', color:'danger'}]
      });
      return;
    }
  }

  // قاعدة 2 (Capacity) — toast بسيط (السلوك الحالي، مقبول للـ single-save)
  if(minaCampVal){
    const minaCamp = camps.find(c=>(c.camp_num||c.name)===minaCampVal);
    const cap = parseInt(minaCamp?.capacity)||0;
    const occupied = ALL_DATA.filter(p=>p['mina_camp']===minaCampVal && String(p['_supabase_id'])!==String(pilgrimId) && p['mina_bed']).length;
    if(cap > 0 && occupied >= cap) return showToast('مخيم منى ' + minaCampVal + ' ممتلئ — السعة: ' + cap + ' | المُسكَّنون: ' + occupied, 'error');
  }
  if(arafatCampVal){
    const arafatCamp = camps.find(c=>(c.camp_num||c.name)===arafatCampVal);
    const cap = parseInt(arafatCamp?.capacity)||0;
    const occupied = ALL_DATA.filter(p=>p['arafat_camp']===arafatCampVal && String(p['_supabase_id'])!==String(pilgrimId) && p['arafat_bed']).length;
    if(cap > 0 && occupied >= cap) return showToast('مخيم عرفات ' + arafatCampVal + ' ممتلئ — السعة: ' + cap + ' | المُسكَّنون: ' + occupied, 'error');
  }

  // Validation: camp و bed يجب أن يكونا متزامنَين في كل موقع
  const minaCampSet2   = !!(minaCampVal   && String(minaCampVal).trim());
  const minaBedSet2    = !!(minaBedVal    && String(minaBedVal).trim());
  const arafatCampSet2 = !!(arafatCampVal && String(arafatCampVal).trim());
  const arafatBedSet2  = !!(arafatBedVal  && String(arafatBedVal).trim());
  if(minaCampSet2 !== minaBedSet2){
    return showToast(minaCampSet2
      ? 'يرجى اختيار السرير في مخيم منى'
      : 'يرجى اختيار مخيم منى قبل السرير', 'warning');
  }
  if(arafatCampSet2 !== arafatBedSet2){
    return showToast(arafatCampSet2
      ? 'يرجى اختيار السرير في مخيم عرفات'
      : 'يرجى اختيار مخيم عرفات قبل السرير', 'warning');
  }

  // قاعدة 8 (Booking Split) — تحذير إذا نقل هذا الحاج يفصله عن مجموعته
  for(const [loc, val, locAr] of [['mina', minaCampVal, 'منى'], ['arafat', arafatCampVal, 'عرفات']]){
    if(!val) continue;
    const origCamp = pilgrim?.[loc==='mina'?'mina_camp':'arafat_camp'] || '';
    if(val === origCamp) continue; // لم يتغيّر
    const check = _checkSingleMoveSplit(pilgrimId, val, loc);
    if(check.willSplit){
      const campsList = {};
      check.inOtherCamps.forEach(m => {
        const c = m[loc==='mina'?'mina_camp':'arafat_camp'];
        campsList[c] = (campsList[c]||0) + 1;
      });
      const inCampsSummary = Object.entries(campsList).map(([c,n]) => n+' في '+c).join('، ');
      const decision = await showActionModal({
        type:'warning',
        title:'تفكيك مجموعة الحجز',
        description:'الحاج '+(pilgrim['اسم الحاج']||'')+' ينتمي لحجز يحتوي '+check.groupSize+' أشخاص. نقله لوحده سيفصله عن مجموعته.',
        items:[
          { icon:'📋', label:'رقم الحجز:',           value: check.bookingKey },
          { icon:'👥', label:'إجمالي المجموعة:',    value: check.groupSize + ' شخص' },
          { icon:'🏕️', label:'الأعضاء الآخرون:',    value: inCampsSummary ? ('موزَّعون: ' + inCampsSummary) : 'لا مواقع محدَّدة' },
          { icon:'❓', label:'غير مُسكَّنين:',       value: check.unassigned.length + ' شخص' },
          { icon:'➡️', label:'وجهة النقل:',          value: 'مخيم ' + val + ' (' + locAr + ')' }
        ],
        actions:[
          { label:'متابعة الفصل', value:'split', emoji:'⚠️', variant:'primary', color:'warning' },
          { label:'إلغاء',         value:null,    emoji:'❌', variant:'cancel' }
        ]
      });
      if(decision !== 'split') return;
    }
  }

  // تزامن supervisor من رقم الحافلة (قد يكون تغيّر عبر onBusChange أو تلقائياً)
  const busValForSync = document.getElementById('pa-bus').value;
  if(busValForSync && _fieldChanged(pilgrim?.['رقم الحافلة الخاصة بك'], busValForSync)){
    try {
      const sysusers = (window._sysusersCache)||(await window.DB.SysUsers.getAll());
      window._sysusersCache = sysusers;
      const sync = _syncSupervisorForBus(busValForSync, sysusers);
      if(sync){
        const nEl = document.getElementById('pa-supervisor-name');
        const pEl = document.getElementById('pa-supervisor-phone');
        if(nEl) nEl.value = sync.supervisor_name;
        if(pEl) pEl.value = sync.supervisor_phone;
      }
    } catch(_){}
  }

  // 1) Snapshot قبل أي تعديل + بناء candidate بلا mutation
  const idx = ALL_DATA.findIndex(r => String(r['_supabase_id']) === String(pilgrimId));
  const pilgrimRec = idx >= 0 ? ALL_DATA[idx] : null;
  const supervisorName  = document.getElementById('pa-supervisor-name')?.value.trim()  || '';
  const supervisorPhone = document.getElementById('pa-supervisor-phone')?.value.trim() || '';
  const candidate = {
    group_num: document.getElementById('pa-group').value,
    bus_num:   document.getElementById('pa-bus').value,
  };
  _applyBedAssignment(candidate, null, 'mina',   minaCampVal,   minaBedVal);
  _applyBedAssignment(candidate, null, 'arafat', arafatCampVal, arafatBedVal);

  // Cross-camp guard: تغيير مخيم + سرير فارغ → فرض null صريح (يمسح bed+seat القديمَين)
  const origMinaCamp2   = pilgrimRec?.mina_camp   || null;
  const origArafatCamp2 = pilgrimRec?.arafat_camp || null;
  if(minaCampVal !== null && minaCampVal !== origMinaCamp2 && !minaBedVal){
    candidate.mina_bed = null;  candidate.mina_seat = null;
  }
  if(arafatCampVal !== null && arafatCampVal !== origArafatCamp2 && !arafatBedVal){
    candidate.arafat_bed = null; candidate.arafat_seat = null;
  }

  const before = pilgrimRec ? {
    mina_camp:   pilgrimRec.mina_camp,   mina_bed:   pilgrimRec.mina_bed,   mina_seat:   pilgrimRec.mina_seat,
    arafat_camp: pilgrimRec.arafat_camp, arafat_bed: pilgrimRec.arafat_bed, arafat_seat: pilgrimRec.arafat_seat,
    group_num: pilgrimRec['رقم فوج التفويج الخاص بك'],
    bus_num:   pilgrimRec['رقم الحافلة الخاصة بك']
  } : {};
  const updates = {};
  Object.keys(candidate).forEach(k => {
    if(_fieldChanged(before[k], candidate[k])) updates[k] = candidate[k];
  });
  // المشرف دائماً يُكتب (readonly في UI لكن يتزامن تلقائياً من الحافلة)
  updates.supervisor_name  = supervisorName;
  updates.supervisor_phone = supervisorPhone;
  console.log(`[savePilgrimAssign] ${Object.keys(updates).length - 2}/${Object.keys(candidate).length} حقول سرير/تسكين تغيّرت (+ المشرف دائماً)`);

  // 2) إذا لا شيء تغيّر سوى المشرف بقيم مطابقة: تخطّى DB
  const supUnchanged = !_fieldChanged(pilgrimRec?.['اسم المشرف الخاص بالحاج'], supervisorName)
                    && !_fieldChanged(pilgrimRec?.['رقم جوال المشرف'],         supervisorPhone);
  const nothingChanged = Object.keys(updates).length === 2 && supUnchanged;
  if(nothingChanged){
    showToast('لا يوجد ما يُحفظ', 'info');
    closeModals();
    return;
  }

  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    // v17.0: audit (لا نسجّل supervisor إذا لم يتغيّر فعلاً) — v17.0.1: فلترة shadow seat sync
    const beforeForAudit = Object.assign({}, before, {
      supervisor_name:  pilgrimRec?.['اسم المشرف الخاص بالحاج'],
      supervisor_phone: pilgrimRec?.['رقم جوال المشرف']
    });
    const changes = _buildFieldChanges(beforeForAudit, _filterAuditSyncArtifacts(updates));
    if(changes){
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pilgrimId),
        entity_label: _buildPilgrimLabel(pilgrimRec),
        field_changes: changes,
        metadata: { source: 'assign_modal' }
      });
    }
    // 3) تحديث الذاكرة المحلية من updates فقط
    if(pilgrimRec){
      Object.keys(updates).forEach(k => {
        if(k === 'group_num')         pilgrimRec['رقم فوج التفويج الخاص بك'] = updates[k];
        else if(k === 'bus_num')      pilgrimRec['رقم الحافلة الخاصة بك']    = updates[k];
        else if(k === 'supervisor_name')  pilgrimRec['اسم المشرف الخاص بالحاج'] = updates[k];
        else if(k === 'supervisor_phone') pilgrimRec['رقم جوال المشرف']         = updates[k];
        else pilgrimRec[k] = updates[k];
      });
    }
    closeModals();
    // استثنِ supervisor من الملخص إذا لم يتغيّر فعلاً
    const excludeFromSummary = supUnchanged ? ['supervisor_name','supervisor_phone'] : [];
    const summary = _summarizeUpdates(updates, excludeFromSummary);
    showToast(summary ? 'تم تحديث: ' + summary : 'تم الحفظ', 'success');
    // تحديث عرض المخيمات تلقائياً
    renderCamps();
  } catch(e) {
    showToast('خطأ في الحفظ: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// Block 4 — Booking Group + Quick Edit (_ensureBgEscHandler → saveQuickEdit)
// (was admin.html L7117-7691)
// ─────────────────────────────────────────────
function _ensureBgEscHandler(){
  if(window._bgEscInit) return;
  window._bgEscInit = true;
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    const modal = document.getElementById('modal-overlay');
    if(!modal || modal.style.display === 'none') return;
    if(window._quickEditOpenedFrom === 'booking-group'){
      e.preventDefault();
      closeQuickEdit();
      return;
    }
    const box = document.getElementById('modal-content');
    if(!box || !box.classList.contains('booking-group')) return;
    e.preventDefault();
    closeBookingGroup();
  });
}

function _openQEFromBG(pid, bookingNum, anchorId){
  window._quickEditOpenedFrom = 'booking-group';
  window._bookingGroupContext = {
    bookingNum: bookingNum||'',
    anchorId: anchorId||pid,
    ctx: window._bookingCtx||'camp'
  };
  _ensureBgEscHandler();
  openPilgrimQuickEdit(pid);
}

function _returnToBookingGroupFromQE(){
  const saved = window._bookingGroupContext || {};
  const bn  = saved.bookingNum || window._qeData?.bookingNum || '';
  const aid = saved.anchorId   || window._qeData?.pid;
  const ctx = saved.ctx        || window._bookingCtx || 'camp';
  window._quickEditOpenedFrom = null;
  showBookingGroup(bn, aid, ctx);
}

function closeBookingGroup() {
  const box = document.getElementById('modal-content');
  if(box) box.classList.remove('booking-group');
  window._quickEditOpenedFrom = null;
  const ctx = window._bookingCtx||'camp';
  if(ctx === 'ua') {
    const { location } = window._unassignedData||{};
    if(location) showUnassignedPilgrims(location); else closeModals();
  } else if(ctx === 'gp') {
    const groupNum = window._gpCurrentGroup;
    const groupName = window._gpCurrentName||groupOrdinalName(groupNum);
    if(groupNum) _renderGroupPilgrimsModal(groupNum, groupName); else closeModals();
  } else if(ctx === 'ug') {
    _renderUngroupedModal();
  } else if(ctx === 'bp') {
    const busNum = window._busCurrent?.num;
    if(busNum) _renderBusPilgrimsModal(busNum); else closeModals();
  } else if(ctx === 'main') {
    closeModals(); // يغلق فقط ويعود للجدول الرئيسي
  } else {
    const { campNum, location } = window._campViewData||{};
    if(campNum && location) showCampPilgrims(campNum, location); else closeModals();
  }
}

function showBookingGroup(bookingNum, clickedId, ctx) {
  window._bookingCtx = ctx||'camp';
  // حفظ السياق لإعادة الرسم بعد bulk update
  window._currentBookingGroupNum  = bookingNum;
  window._currentBookingClickedId = clickedId;
  window._currentBookingCtx       = ctx || 'main';
  if(!bookingNum && !clickedId) return;
  const anchor = ALL_DATA.find(p=>String(p['_supabase_id'])===String(clickedId)) || ALL_DATA.find(p=>p['رقم الحجز']===bookingNum);
  if(!anchor) return;
  const group = [anchor, ...getRelatedPilgrims(anchor)];
  if(!group.length) return;

  const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bnSafe  = esc(bookingNum||'');
  const aidSafe = esc(clickedId||'');
  const anchorId = esc(anchor['_supabase_id']);

  const rows = group.map(p => {
    const isMe = String(p['_supabase_id'])===String(clickedId);
    const pid  = esc(p['_supabase_id']);
    const minaBed = p['mina_bed'] ? ('-'+esc((p['mina_bed']+'').split('-')[1]||'')) : '';
    const arafatBed = p['arafat_bed'] ? ('-'+esc((p['arafat_bed']+'').split('-')[1]||'')) : '';
    return `<tr class="${isMe?'bg-row-me':''}">
      <td class="bg-check-col"><input type="checkbox" class="bg-row-check" data-id="${pid}" onchange="updateBGBulkBar()" onclick="event.stopPropagation()" aria-label="تحديد الحاج"></td>
      <td class="bg-name-cell" onclick="_openQEFromBG('${pid}','${bnSafe}','${aidSafe}')">
        ${isMe?'<span class="bg-me-dot" aria-hidden="true"></span>':''}
        <span class="bg-name-text">${esc(p['اسم الحاج']||'—')}</span>
      </td>
      <td>${esc(p['رقم الهوية']||'—')}</td>
      <td class="bg-booking-cell">${esc(p['رقم الحجز']||'—')}</td>
      <td>${p['mina_camp']?`<span class="bg-chip bg-chip-mina">${esc(p['mina_camp'])}${minaBed}</span>`:'<span class="bg-dash">—</span>'}</td>
      <td>${p['arafat_camp']?`<span class="bg-chip bg-chip-arafat">${esc(p['arafat_camp'])}${arafatBed}</span>`:'<span class="bg-dash">—</span>'}</td>
      <td>${p['رقم فوج التفويج الخاص بك']?`<span class="bg-chip bg-chip-group">${esc(p['رقم فوج التفويج الخاص بك'])}</span>`:'<span class="bg-dash">—</span>'}</td>
      <td>${p['رقم الحافلة الخاصة بك']?`<span class="bg-chip bg-chip-bus">${esc(p['رقم الحافلة الخاصة بك'])}</span>`:'<span class="bg-dash">—</span>'}</td>
      <td>${p['booking_ref']&&!isMe?`<button class="bg-unlink-btn" onclick="unlinkPilgrim('${pid}','${bnSafe}','${aidSafe}')">🔓 فك</button>`:''}</td>
    </tr>`;
  }).join('');

  const cards = group.map(p => {
    const isMe = String(p['_supabase_id'])===String(clickedId);
    const pid  = esc(p['_supabase_id']);
    return `<div class="bg-card ${isMe?'bg-card-me':''}">
      <input type="checkbox" class="bg-card-check bg-row-check" data-id="${pid}" onchange="updateBGBulkBar()" onclick="event.stopPropagation()" aria-label="تحديد الحاج">
      <div class="bg-card-header">
        <div class="bg-card-name" onclick="_openQEFromBG('${pid}','${bnSafe}','${aidSafe}')">${esc(p['اسم الحاج']||'—')}</div>
        ${isMe?'<span class="bg-card-badge">📍 المحدّد</span>':''}
      </div>
      <div class="bg-card-meta">
        <span>🪪 <strong>${esc(p['رقم الهوية']||'—')}</strong></span>
        <span>📋 <strong>${esc(p['رقم الحجز']||'—')}</strong></span>
      </div>
      <div class="bg-card-chips">
        ${p['mina_camp']?`<span class="bg-chip bg-chip-mina">🏕️ ${esc(p['mina_camp'])}</span>`:''}
        ${p['arafat_camp']?`<span class="bg-chip bg-chip-arafat">🌄 ${esc(p['arafat_camp'])}</span>`:''}
        ${p['رقم فوج التفويج الخاص بك']?`<span class="bg-chip bg-chip-group">👥 ${esc(p['رقم فوج التفويج الخاص بك'])}</span>`:''}
        ${p['رقم الحافلة الخاصة بك']?`<span class="bg-chip bg-chip-bus">🚌 ${esc(p['رقم الحافلة الخاصة بك'])}</span>`:''}
      </div>
      ${p['booking_ref']&&!isMe?`<div class="bg-card-actions"><button class="bg-card-unlink" onclick="unlinkPilgrim('${pid}','${bnSafe}','${aidSafe}')">🔓 إلغاء الربط</button></div>`:''}
    </div>`;
  }).join('');

  // Bulk bar HTML (مشترك Desktop + Mobile) — يظهر فقط عند التحديد
  const bulkBarHtml = `
    <div id="bg-bulk-bar" class="bg-bulk-bar" style="display:none">
      <span id="bg-selected-count" class="bg-bulk-count"></span>
      <select id="bg-bulk-field" class="bg-bulk-select" onchange="updateBGBulkOptions()" aria-label="الحقل">
        <option value="">— اختر الحقل —</option>
        <option value="bus_status">🚌 حالة الإركاب</option>
        <option value="camp_status">🏕️ حالة الوصول للمخيم</option>
        <option value="bus_num">🚌 رقم الحافلة</option>
        <option value="group_num">👥 رقم الفوج</option>
        <option value="nusuk_card_status">🪪 حالة بطاقة نسك</option>
        <option value="mina_camp">🏕️ مخيم منى</option>
        <option value="arafat_camp">🌄 مخيم عرفات</option>
      </select>
      <select id="bg-bulk-value" class="bg-bulk-select" aria-label="القيمة">
        <option value="">— اختر القيمة —</option>
      </select>
      <button class="bg-bulk-expand" onclick="_expandBulkSelection('bg')" title="يُضيف كل أفراد مجموعات الحجز">🔄 توسيع</button>
      <button class="bg-bulk-apply" onclick="applyBGBulk()">تطبيق</button>
      <button class="bg-bulk-cancel" onclick="clearBGSelection()">إلغاء</button>
    </div>`;

  openModal(`
    <div class="bg-header">
      <div class="bg-header-info">
        <div class="bg-title">🔗 الحجاج المرتبطين</div>
        <div class="bg-subtitle">رقم الحجز: <strong>${bnSafe||'—'}</strong> • ${group.length} أشخاص</div>
      </div>
      <button class="bg-close-x" onclick="closeBookingGroup()" aria-label="إغلاق">✕</button>
    </div>
    <div class="bg-body">
      ${bulkBarHtml}
      <div class="bg-mobile-select-all">
        <button class="bg-select-all-btn" onclick="_toggleAllBGMobile()" id="bg-select-all-btn">☐ تحديد الكل</button>
      </div>
      <div class="bg-desktop-table">
        <table class="bg-table">
          <thead>
            <tr>
              <th class="bg-check-col"><input type="checkbox" id="bg-check-all" onclick="toggleAllBG(this)" aria-label="تحديد الكل"></th>
              <th class="bg-th-name">الاسم</th>
              <th>رقم الهوية</th>
              <th>رقم الحجز</th>
              <th>🏕️ منى</th>
              <th>🌄 عرفات</th>
              <th>👥 الفوج</th>
              <th>🚌 الحافلة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="bg-mobile-cards">${cards}</div>
      <div class="bg-hint">الصف المميز بإطار ذهبي = الحاج الذي نقرت عليه</div>
      <div id="link-pilgrim-area"></div>
    </div>
    <div class="bg-footer">
      <button class="bg-link-btn" onclick="openLinkPilgrim('${anchorId}','${bnSafe}')">🔗 ربط حاج آخر</button>
      <button class="bg-close-btn" onclick="closeBookingGroup()">إغلاق</button>
    </div>
  `);

  const box = document.getElementById('modal-content');
  if(box) box.classList.add('booking-group');
  _ensureBgEscHandler();
}

// زر "تحديد الكل / إلغاء الكل" المستقل للجوال
function _toggleAllBGMobile(){
  const btn = document.getElementById('bg-select-all-btn');
  const boxes = document.querySelectorAll('.bg-row-check');
  const anyUnchecked = [...boxes].some(c => !c.checked);
  boxes.forEach(c => c.checked = anyUnchecked);
  if(btn) btn.textContent = anyUnchecked ? '☑ إلغاء التحديد' : '☐ تحديد الكل';
  updateBGBulkBar();
}



function closeQuickEdit() {
  if(window._quickEditOpenedFrom === 'booking-group'){
    _returnToBookingGroupFromQE();
    return;
  }
  const bookingNum = window._qeData?.bookingNum;
  const pid = window._qeData?.pid;
  const ctx = window._bookingCtx||'camp';
  if(ctx==='main') { closeModals(); return; }
  if(bookingNum || pid) showBookingGroup(bookingNum, pid, ctx);
  else closeModals();
}


async function openPilgrimQuickEdit(pid) {
  const p = ALL_DATA.find(x=>String(x['_supabase_id'])===String(pid));
  if(!p) return;
  const [camps, groups, buses] = await Promise.all([getCamps(), getGroups(), getBuses()]);
  window._campsCache = camps; // تغذية cache لـ helpers v15.4
  const location = window._campViewData?.location||'منى';
  const minaCamps = camps.filter(c=>c.location==='منى');
  const arafatCamps = camps.filter(c=>c.location==='عرفات');
  const fieldKey = 'mina_camp', bedKey = 'mina_bed';

  const _g = String(p['الجنس']||'').trim().toLowerCase();
  const _isFemale = ['أنثى','أنثي','انثى','انثي','female','f'].includes(_g);
  const _isMale   = ['ذكر','male','m'].includes(_g);
  const _campMatchesGender = (ct)=>{
    if(!ct) return true;
    if(_isFemale) return ct==='نساء';
    if(_isMale)   return ct==='رجال';
    return true;
  };
  function campOpts(campList, selected, fk, bk) {
    const visible = campList.filter(c => _campMatchesGender(c.camp_type) || ((c.camp_num||c.name)===selected));
    const sorted = _sortCamps(visible);
    let html='<option value="">— اختر —</option>';
    sorted.forEach(camp=>{
      const cNum=camp.camp_num||camp.name;
      const cap=parseInt(camp.capacity)||0;
      const occ=ALL_DATA.filter(x=>x[fk]===cNum&&x[bk]).length;
      const full=cap>0&&occ>=cap&&selected!==cNum;
      html+=`<option value="${cNum}" ${selected===cNum?'selected':''} ${full?'disabled':''}>${cNum}${full?' ⛔':' — '+(cap-occ)}</option>`;
    });
    return html;
  }
  function bedOpts(campNum, selected, fk, bk) {
    if(!campNum) return '<option value="">اختر المخيم أولاً</option>';
    const camp = camps.find(c=>(c.camp_num||c.name)===campNum);
    if(!camp) return '<option value="">—</option>';
    const cap = parseInt(camp.capacity)||0;
    // حماية cross-camp: لا تُطبِّع "selected" إلا إذا ينتمي لنفس المخيم المطلوب
    // (دفاع عميق — الفتح الابتدائي آمن لكن مبدأ الاتساق يستدعي نفس الحماية)
    const originalCamp = p ? (p[fk]||'') : '';
    const selNorm = (originalCamp && originalCamp === campNum)
      ? _normalizeBedId(selected, campNum)
      : '';
    const bookedSet = new Set(
      ALL_DATA
        .filter(x => x[fk]===campNum && x[bk] && String(x['_supabase_id'])!==String(pid))
        .map(x => _normalizeBedId(x[bk], campNum))
    );
    const opts = [];
    let availCount = 0;
    for(let i=1;i<=cap;i++){
      const v = campNum+'-'+i;
      const isCurrent = (v===selNorm);
      if(!bookedSet.has(v) || isCurrent){
        opts.push(`<option value="${v}" ${isCurrent?'selected':''}>${v}</option>`);
        if(!bookedSet.has(v)) availCount++;
      }
    }
    if(availCount===0 && !selNorm) return '<option value="">لا توجد أسرّة متاحة</option>';
    return '<option value="">— اختر —</option>' + opts.join('');
  }

  const grpOpts = '<option value="">— اختر —</option>' + groups.sort((a,b)=>Number(a.num)-Number(b.num)).map(g=>`<option value="${g.num}" ${String(p['رقم فوج التفويج الخاص بك'])===String(g.num)?'selected':''}>${g.num} — ${g.name||groupOrdinalName(g.num)}</option>`).join('');
  const busOpts = '<option value="">— اختر —</option>' + buses.sort((a,b)=>Number(a.num)-Number(b.num)).map(b=>`<option value="${b.num}" ${String(p['رقم الحافلة الخاصة بك'])===String(b.num)?'selected':''}>${b.num} ${b.plate?'('+b.plate+')':''}</option>`).join('');

  openModal(`
    <div style="background:linear-gradient(135deg,#3d2000,#7a4500);border-radius:12px;padding:12px 18px;margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;color:#fff">👤 ${p['اسم الحاج']||'—'}</div>
      <div style="font-size:12px;color:#f0d8a0;margin-top:3px">🪪 ${p['رقم الهوية']||'—'} &nbsp;•&nbsp; 📋 ${p['رقم الحجز']||'—'} &nbsp;•&nbsp; ${p['الجنسية']||'—'}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="form-row">
        <label>🏕️ مخيم منى</label>
        <select id="qe-mina-camp" onchange="qeBeds('mina')" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${campOpts(minaCamps, p['mina_camp'],'mina_camp','mina_bed')}
        </select>
      </div>
      <div class="form-row">
        <label>🛏️ سرير منى</label>
        <select id="qe-mina-bed" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${bedOpts(p['mina_camp'],p['mina_bed'],'mina_camp','mina_bed')}
        </select>
      </div>
      <div class="form-row">
        <label>🌄 مخيم عرفات</label>
        <select id="qe-arafat-camp" onchange="qeBeds('arafat')" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${campOpts(arafatCamps, p['arafat_camp'],'arafat_camp','arafat_bed')}
        </select>
      </div>
      <div class="form-row">
        <label>🛏️ سرير عرفات</label>
        <select id="qe-arafat-bed" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${bedOpts(p['arafat_camp'],p['arafat_bed'],'arafat_camp','arafat_bed')}
        </select>
      </div>
      <div class="form-row">
        <label>👥 الفوج</label>
        <select id="qe-group" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${grpOpts}
        </select>
      </div>
      <div class="form-row">
        <label>🚌 الحافلة</label>
        <select id="qe-bus" style="padding:9px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;width:100%">
          ${busOpts}
        </select>
      </div>
    </div>
    <div class="modal-btns" style="margin-top:16px">
      <button class="btn-save" onclick="saveQuickEdit('${pid}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeQuickEdit()">إلغاء</button>
    </div>`);
  window._qeData = { pid, camps, minaCamps, arafatCamps, bookingNum: p['رقم الحجز']||'', pilgrim: p };
}

// ===== v11.5 Phase 3b Assignment Helpers + Tests extracted → bulk-pipeline.js =====

function qeBeds(loc) {
  const fk = loc==='mina'?'mina_camp':'arafat_camp';
  const bk = loc==='mina'?'mina_bed':'arafat_bed';
  const campSel = document.getElementById('qe-'+loc+'-camp');
  const bedSel  = document.getElementById('qe-'+loc+'-bed');
  if(!campSel||!bedSel) return;
  const campNum = campSel.value;
  const { camps, pid, pilgrim } = window._qeData||{};
  if(!campNum){
    bedSel.innerHTML = '<option value="">اختر المخيم أولاً</option>';
    bedSel.disabled = true;
    return;
  }
  if(!camps) return;
  const camp = camps.find(c=>(c.camp_num||c.name)===campNum);
  if(!camp){
    bedSel.innerHTML = '<option value="">اختر المخيم أولاً</option>';
    bedSel.disabled = true;
    return;
  }
  // التحقق من الجنس
  if(pilgrim && camp.camp_type){
    const g = String(pilgrim['الجنس']||'').trim().toLowerCase();
    const isFemale = ['أنثى','أنثي','انثى','انثي','female','f'].includes(g);
    const isMale   = ['ذكر','male','m'].includes(g);
    const mismatch = (camp.camp_type==='نساء' && !isFemale) || (camp.camp_type==='رجال' && !isMale);
    if(mismatch){
      campSel.value='';
      bedSel.innerHTML='<option value="">اختر المخيم أولاً</option>';
      bedSel.disabled = true;
      if(typeof showToast==='function') showToast('مخيم '+campNum+' مخصص لـ '+camp.camp_type+' — الجنس غير مطابق','error');
      return;
    }
  }
  const cap = parseInt(camp.capacity)||0;
  // حماية cross-camp: السرير "الحالي" صالح فقط إذا كان المخيم المختار = مخيم الحاج الأصلي
  // بدون هذا الفحص، _normalizeBedId("A-5","B") يُرجع "B-5" زائفاً ويَتدخّل في القائمة الجديدة
  const originalCamp   = pilgrim ? (pilgrim[fk]||'') : '';
  const currentBedRaw  = pilgrim ? (pilgrim[bk]||'') : '';
  const currentBedNorm = (originalCamp && originalCamp === campNum)
    ? _normalizeBedId(currentBedRaw, campNum)
    : '';
  const bookedSet = new Set(
    ALL_DATA
      .filter(x => x[fk]===campNum && x[bk] && String(x['_supabase_id'])!==String(pid))
      .map(x => _normalizeBedId(x[bk], campNum))
  );
  let html = '<option value="">— اختر —</option>';
  let availCount = 0;
  for(let i=1;i<=cap;i++){
    const v = campNum+'-'+i;
    const isCurrent = (v===currentBedNorm);
    if(!bookedSet.has(v) || isCurrent){
      html += `<option value="${v}" ${isCurrent?'selected':''}>${v}</option>`;
      if(!bookedSet.has(v)) availCount++;
    }
  }
  if(availCount===0 && !currentBedNorm){
    html = '<option value="">لا توجد أسرّة متاحة</option>';
    bedSel.disabled = true;
    if(typeof showToast==='function') showToast('مخيم '+campNum+' ممتلئ','error');
  } else {
    bedSel.disabled = false;
  }
  bedSel.innerHTML = html;
}

async function saveQuickEdit(pid) {
  const minaCamp     = document.getElementById('qe-mina-camp')?.value   || null;
  const minaBedRaw   = document.getElementById('qe-mina-bed')?.value    || null;
  const arafatCamp   = document.getElementById('qe-arafat-camp')?.value || null;
  const arafatBedRaw = document.getElementById('qe-arafat-bed')?.value  || null;
  const groupNum     = document.getElementById('qe-group')?.value       || null;
  const busNum       = document.getElementById('qe-bus')?.value         || null;

  // Validation: camp و bed يجب أن يكونا متزامنَين (كلاهما موجود أو كلاهما فارغ)
  const minaCampSet   = !!(minaCamp   && String(minaCamp).trim());
  const minaBedSet    = !!(minaBedRaw && String(minaBedRaw).trim());
  const arafatCampSet = !!(arafatCamp   && String(arafatCamp).trim());
  const arafatBedSet  = !!(arafatBedRaw && String(arafatBedRaw).trim());
  if(minaCampSet !== minaBedSet){
    return showToast(minaCampSet
      ? 'يرجى اختيار السرير في مخيم منى'
      : 'يرجى اختيار مخيم منى قبل السرير', 'warning');
  }
  if(arafatCampSet !== arafatBedSet){
    return showToast(arafatCampSet
      ? 'يرجى اختيار السرير في مخيم عرفات'
      : 'يرجى اختيار مخيم عرفات قبل السرير', 'warning');
  }

  const idx = ALL_DATA.findIndex(p => String(p['_supabase_id']) === String(pid));
  const pilgrim = idx >= 0 ? ALL_DATA[idx] : null;

  // قاعدة 1 (Gender) — error صلب
  await _refreshCampsCache();
  const qeCamps = window._campsCache;
  const qeG = _genderOf(pilgrim);
  for(const [loc, val, locAr] of [['mina', minaCamp, 'منى'], ['arafat', arafatCamp, 'عرفات']]){
    if(!val) continue;
    const camp = qeCamps.find(c => (c.camp_num || c.name) === val);
    if(camp && camp.camp_type && !_campMatchesGenderGlobal(camp.camp_type, qeG)){
      await showActionModal({
        type:'error',
        title:'جنس غير مطابق — لا يمكن التسكين',
        description:'لا يمكن تسكين هذا الحاج في مخيم مخصَّص للجنس الآخر — قاعدة شرعية صلبة.',
        items:[
          { icon:'👤', label:'اسم الحاج:',      value:(pilgrim&&pilgrim['اسم الحاج'])||'—' },
          { icon:'🏕️', label:'المخيم المطلوب:', value: val + ' (مخصَّص للـ' + camp.camp_type + ')' },
          { icon:'📍', label:'الموقع:',         value: locAr }
        ],
        actions:[{label:'فهمت', value:null, variant:'primary', color:'danger'}]
      });
      return;
    }
  }

  // قاعدة 8 (Booking Split) — تحذير إذا المخيم الجديد يفصل الحاج عن مجموعته
  for(const [loc, val, locAr] of [['mina', minaCamp, 'منى'], ['arafat', arafatCamp, 'عرفات']]){
    if(!val) continue;
    const origCamp = pilgrim?.[loc==='mina'?'mina_camp':'arafat_camp'] || '';
    if(val === origCamp) continue;
    const check = _checkSingleMoveSplit(pid, val, loc);
    if(check.willSplit){
      const campsList = {};
      check.inOtherCamps.forEach(m => {
        const c = m[loc==='mina'?'mina_camp':'arafat_camp'];
        campsList[c] = (campsList[c]||0) + 1;
      });
      const inCampsSummary = Object.entries(campsList).map(([c,n]) => n+' في '+c).join('، ');
      const decision = await showActionModal({
        type:'warning',
        title:'تفكيك مجموعة الحجز',
        description:'الحاج '+(pilgrim['اسم الحاج']||'')+' ينتمي لحجز يحتوي '+check.groupSize+' أشخاص. نقله لوحده سيفصله عن مجموعته.',
        items:[
          { icon:'📋', label:'رقم الحجز:',           value: check.bookingKey },
          { icon:'👥', label:'إجمالي المجموعة:',    value: check.groupSize + ' شخص' },
          { icon:'🏕️', label:'الأعضاء الآخرون:',    value: inCampsSummary ? ('موزَّعون: ' + inCampsSummary) : 'لا مواقع محدَّدة' },
          { icon:'❓', label:'غير مُسكَّنين:',       value: check.unassigned.length + ' شخص' },
          { icon:'➡️', label:'وجهة النقل:',          value: 'مخيم ' + val + ' (' + locAr + ')' }
        ],
        actions:[
          { label:'متابعة الفصل', value:'split', emoji:'⚠️', variant:'primary', color:'warning' },
          { label:'إلغاء',         value:null,    emoji:'❌', variant:'cancel' }
        ]
      });
      if(decision !== 'split') return;
    }
  }

  // 1) بناء القيم المُرشّحة دون mutation للذاكرة (pilgrim=null في helper)
  const candidate = {};
  _applyBedAssignment(candidate, null, 'mina',   minaCamp,   minaBedRaw);
  _applyBedAssignment(candidate, null, 'arafat', arafatCamp, arafatBedRaw);

  // Cross-camp guard: تغيير مخيم + سرير فارغ → فرض null صريح (يمسح bed+seat القديمَين)
  const originalMinaCamp   = pilgrim?.mina_camp   || null;
  const originalArafatCamp = pilgrim?.arafat_camp || null;
  if(minaCamp !== null && minaCamp !== originalMinaCamp && !minaBedRaw){
    candidate.mina_bed = null;  candidate.mina_seat = null;
  }
  if(arafatCamp !== null && arafatCamp !== originalArafatCamp && !arafatBedRaw){
    candidate.arafat_bed = null; candidate.arafat_seat = null;
  }

  if(groupNum !== null) candidate.group_num = groupNum || null;
  if(busNum   !== null) candidate.bus_num   = busNum   || null;

  // تزامن supervisor تلقائياً عند تغيير الحافلة (صامت — المستخدم لا يرى الحقول في QE)
  if(busNum && _fieldChanged(pilgrim?.['رقم الحافلة الخاصة بك'], busNum)){
    try {
      const sysusers = (window._sysusersCache)||(await window.DB.SysUsers.getAll());
      window._sysusersCache = sysusers;
      const sync = _syncSupervisorForBus(busNum, sysusers);
      if(sync){
        candidate.supervisor_name  = sync.supervisor_name;
        candidate.supervisor_phone = sync.supervisor_phone;
      }
    } catch(_){}
  }

  // 2) مقارنة بالقيم الأصلية وبناء patch
  const before = pilgrim ? {
    mina_camp:   pilgrim.mina_camp,   mina_bed:   pilgrim.mina_bed,   mina_seat:   pilgrim.mina_seat,
    arafat_camp: pilgrim.arafat_camp, arafat_bed: pilgrim.arafat_bed, arafat_seat: pilgrim.arafat_seat,
    group_num: pilgrim['رقم فوج التفويج الخاص بك'],
    bus_num:   pilgrim['رقم الحافلة الخاصة بك'],
    supervisor_name:  pilgrim['اسم المشرف الخاص بالحاج'],
    supervisor_phone: pilgrim['رقم جوال المشرف']
  } : {};
  const updates = {};
  Object.keys(candidate).forEach(k => {
    if(_fieldChanged(before[k], candidate[k])) updates[k] = candidate[k];
  });
  console.log(`[saveQuickEdit] ${Object.keys(updates).length}/${Object.keys(candidate).length} حقول تغيّرت`);

  // 3) إذا لا تغييرات: توست ثم عودة دون استدعاء DB
  if(Object.keys(updates).length === 0){
    showToast('لا يوجد ما يُحفظ', 'info');
    if(window._quickEditOpenedFrom === 'booking-group'){ _returnToBookingGroupFromQE(); return; }
    const bookingNum = window._qeData?.bookingNum;
    const qectx = window._bookingCtx || 'camp';
    if(bookingNum || pid) showBookingGroup(bookingNum, pid, qectx); else closeModals();
    return;
  }

  // 4) الحفظ + تحديث الذاكرة من updates
  try {
    await window.DB.Pilgrims.update(parseInt(pid), updates);
    // v17.0: audit (v17.0.1: فلترة shadow seat sync)
    const changes = _buildFieldChanges(before, _filterAuditSyncArtifacts(updates));
    if(changes){
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pid),
        entity_label: _buildPilgrimLabel(pilgrim),
        field_changes: changes,
        metadata: { source: 'quick_edit' }
      });
    }
    if(pilgrim){
      Object.keys(updates).forEach(k => {
        if(k === 'group_num')              pilgrim['رقم فوج التفويج الخاص بك'] = updates[k];
        else if(k === 'bus_num')           pilgrim['رقم الحافلة الخاصة بك']    = updates[k];
        else if(k === 'supervisor_name')   pilgrim['اسم المشرف الخاص بالحاج'] = updates[k];
        else if(k === 'supervisor_phone')  pilgrim['رقم جوال المشرف']          = updates[k];
        else                               pilgrim[k] = updates[k];
      });
    }
    const summary = _summarizeUpdates(updates);
    showToast(summary ? 'تم تحديث: ' + summary : 'تم الحفظ', 'success');
    renderCamps();
    if(window._quickEditOpenedFrom === 'booking-group'){ _returnToBookingGroupFromQE(); return; }
    const bookingNum = window._qeData?.bookingNum;
    const qectx = window._bookingCtx || 'camp';
    if(bookingNum || pid) showBookingGroup(bookingNum, pid, qectx); else closeModals();
  } catch(e){ showToast('خطأ: '+e.message,'error'); }
}

// v23.0-pre-mmm: تصدير دوال إعادة فتح نسك للمشرف
window.openNusukReopenModal = openNusukReopenModal;
window._selectReopenReason = _selectReopenReason;
window._checkReopenDetails = _checkReopenDetails;
window.confirmNusukReopen = confirmNusukReopen;