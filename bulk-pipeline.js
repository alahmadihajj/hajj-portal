// ═══════════════════════════════════════════════════════════════════════
// Bulk Pipeline + Assignment Helpers + Tests — v11.5 Phase 3b/5
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Bulk Pipeline: _applyBulkFieldToMemory, _bulkFieldLabel, _getFieldValueForPreview,
//                    _showBulkPreview, _executeBulkPipeline (9 خطوات), _undoLastBulk
//   - Bed/Seat: _normalizeBedId, _normBedForSave, _applyBedAssignment, _fieldChanged,
//               _bulkSnapshotKeys, _summarizeUpdates
//   - Gender + Booking: _genderOf, _campMatchesGenderGlobal, _getBookingMates, _groupByBooking
//   - Assignment: _sortPilgrimsForAssignment, _getAvailableBedsInCamp, _autoAssignBedsSequential
//   - Checks: _checkBulkCapacity, _checkBulkGender, _checkBookingIntegrity, _checkSingleMoveSplit (v10.6)
//   - Supervisor sync: _syncSupervisorForBus, _syncSupervisorForGroup
//   - Cache: _refreshCampsCache
//   - UI helper: _buildCampSelectOptions (v16.3)
//   - Tests: _testAssignmentHelpers, _testBulkPipeline, _testNormalizer
//
// Dependencies (globals):
//   - ui-helpers.js: showToast, showActionModal, showConfirm
//   - audit.js:      _recordAudit, _buildPilgrimLabel, _buildFieldChanges, _filterAuditSyncArtifacts
//   - admin.html:    ALL_DATA, getRelatedPilgrims, _sortCamps, openModal, closeModals,
//                    window.DB.*, window._campsCache
// ═══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────
// Block 1 — Bulk Pipeline (applyBulkFieldToMemory → undoLastBulk)
// (was admin.html L4020-4570)
// ─────────────────────────────────────────────

/**
 * Helper مشترك: يحدّث سجل ALL_DATA للمفاتيح العربية بعد bulk update.
 * يُستدعى من applyDataBulk و applyBGBulk.
 */
function _applyBulkFieldToMemory(r, field, value){
  if(!r) return;
  if(field === 'bus_status')              r['حالة الإركاب']             = value;
  else if(field === 'camp_status')        r['حالة الحضور في المخيم']     = value;
  else if(field === 'bus_num')            r['رقم الحافلة الخاصة بك']    = value;
  else if(field === 'group_num')          r['رقم فوج التفويج الخاص بك'] = value;
  else if(field === 'nusuk_card_status')  r['حالة بطاقة نسك']            = value;
  else if(field === 'mina_camp')          r['mina_camp']                  = value;
  else if(field === 'arafat_camp')        r['arafat_camp']                = value;
}

// تسمية عربية للحقل — تُستخدم في Preview Modal
function _bulkFieldLabel(field){
  const map = {
    bus_status:'حالة الإركاب', camp_status:'حالة الحضور',
    bus_num:'رقم الحافلة', group_num:'رقم الفوج',
    nusuk_card_status:'حالة بطاقة نسك',
    mina_camp:'مخيم منى', arafat_camp:'مخيم عرفات'
  };
  return map[field] || field;
}

// قراءة القيمة الحالية للحقل من سجل حاج — تُستخدم في Preview
function _getFieldValueForPreview(p, field){
  if(!p) return '';
  const map = {
    mina_camp: p.mina_camp, arafat_camp: p.arafat_camp,
    bus_num: p['رقم الحافلة الخاصة بك'], group_num: p['رقم فوج التفويج الخاص بك'],
    bus_status: p['حالة الإركاب'], camp_status: p['حالة الحضور في المخيم'],
    nusuk_card_status: p['حالة بطاقة نسك']
  };
  return map[field] || '';
}

/**
 * Modal Preview قبل bulk apply. يعرض جدول قبل/بعد responsive.
 * @param {Array<number>} ids
 * @param {string} field
 * @param {string} value
 * @param {Map<id,bedKey>|null} assignments — للـ camp fields
 * @returns {Promise<boolean>} true إذا المستخدم ضغط "تأكيد"
 */
function _showBulkPreview(ids, field, value, assignments){
  // في DEV tests: auto-approve flag يتخطّى الـ modal
  if(window._bulkPipelineAutoApprove) return Promise.resolve(true);

  return new Promise(resolve => {
    const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const isCamp = field === 'mina_camp' || field === 'arafat_camp';
    const fieldLbl = _bulkFieldLabel(field);

    const rows = (ids||[]).map(id => {
      const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(id));
      if(!p) return null;
      const before = _getFieldValueForPreview(p, field);
      const after  = value;
      const bedAfter = (isCamp && assignments) ? (assignments.get(id) || '—') : null;
      return {
        id, name: p['اسم الحاج']||'—',
        bookingNum: p['رقم الحجز']||'—',
        before, after, bedAfter,
        changed: _fieldChanged(before, after)
      };
    }).filter(Boolean);

    const changedCount = rows.filter(r => r.changed).length;
    const unchangedCount = rows.length - changedCount;

    const rowHTML = (r) => {
      return `<tr class="bp-row ${r.changed?'bp-changed':'bp-unchanged'}" data-name="${esc(r.name.toLowerCase())}" data-booking="${esc(r.bookingNum)}">
        ${isCamp?`<td class="bp-booking">${esc(r.bookingNum)}</td>`:''}
        <td class="bp-name">${esc(r.name)}</td>
        <td class="bp-before">${esc(r.before||'—')}</td>
        <td class="bp-after">${esc(r.after)}</td>
        ${isCamp?`<td class="bp-bed">${esc(r.bedAfter||'—')}</td>`:''}
      </tr>`;
    };
    const cardHTML = (r) => `<div class="bp-card ${r.changed?'bp-changed':'bp-unchanged'}" data-name="${esc(r.name.toLowerCase())}" data-booking="${esc(r.bookingNum)}">
      <div class="bp-card-name">${esc(r.name)}</div>
      ${isCamp?`<div class="bp-card-row"><span class="bp-lbl">رقم الحجز:</span><span class="bp-val">${esc(r.bookingNum)}</span></div>`:''}
      <div class="bp-card-row"><span class="bp-lbl">${esc(fieldLbl)} — قبل:</span><span class="bp-val">${esc(r.before||'—')}</span></div>
      <div class="bp-card-row"><span class="bp-lbl">${esc(fieldLbl)} — بعد:</span><span class="bp-val bp-val-after">${esc(r.after)}</span></div>
      ${isCamp?`<div class="bp-card-row"><span class="bp-lbl">السرير:</span><span class="bp-val bp-val-bed">${esc(r.bedAfter||'—')}</span></div>`:''}
    </div>`;

    const overlay = document.createElement('div');
    overlay.className = 'am-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-live','assertive');
    overlay.innerHTML = `
      <div class="am-box am-box-bulk" tabindex="-1">
        <button class="am-close" aria-label="إغلاق" type="button">✕</button>
        <div class="am-icon am-icon-info">👁️</div>
        <h3 class="am-title">مراجعة التحديث قبل التطبيق</h3>
        <p class="am-desc">
          <span class="bp-stat bp-stat-changed">${changedCount}</span> سيتغيّر •
          <span class="bp-stat bp-stat-unchanged">${unchangedCount}</span> بدون تغيير
          (الحقل: <strong>${esc(fieldLbl)}</strong> ← <strong>${esc(value)}</strong>)
        </p>
        <div class="bp-search">
          <input type="text" id="bp-search-input" placeholder="🔍 بحث بالاسم أو رقم الحجز..." aria-label="بحث">
        </div>
        <div class="bp-table-wrap">
          <table class="bp-table">
            <thead>
              <tr>
                ${isCamp?'<th>رقم الحجز</th>':''}
                <th>الاسم</th>
                <th>${esc(fieldLbl)} — قبل</th>
                <th>${esc(fieldLbl)} — بعد</th>
                ${isCamp?'<th>السرير المقترح</th>':''}
              </tr>
            </thead>
            <tbody id="bp-tbody">${rows.map(rowHTML).join('')}</tbody>
          </table>
          <div class="bp-cards" id="bp-cards">${rows.map(cardHTML).join('')}</div>
        </div>
        <div class="bp-empty" id="bp-empty" hidden>لا نتائج مطابقة</div>
        <div class="am-actions">
          <button class="am-btn am-btn-primary" data-val="confirm" type="button">✅ تأكيد التطبيق على ${rows.length} حاج</button>
          <button class="am-btn am-btn-cancel"  data-val="cancel"  type="button">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (val) => {
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('am-leaving');
      setTimeout(() => { overlay.remove(); resolve(val === 'confirm'); }, 180);
    };
    const onKey = (e) => {
      if(e.key === 'Escape'){ e.preventDefault(); close('cancel'); }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => { if(e.target === overlay) close('cancel'); });
    overlay.querySelector('.am-close').addEventListener('click', () => close('cancel'));
    overlay.querySelectorAll('.am-btn').forEach(btn => {
      btn.addEventListener('click', () => close(btn.dataset.val));
    });
    // فلترة live
    const searchEl = overlay.querySelector('#bp-search-input');
    const emptyEl  = overlay.querySelector('#bp-empty');
    const tableEls = overlay.querySelectorAll('#bp-tbody .bp-row');
    const cardEls  = overlay.querySelectorAll('#bp-cards .bp-card');
    searchEl.addEventListener('input', () => {
      const q = String(searchEl.value||'').trim().toLowerCase();
      let visible = 0;
      const check = el => {
        const n = el.dataset.name || '';
        const b = el.dataset.booking || '';
        const match = !q || n.includes(q) || b.includes(q);
        el.style.display = match ? '' : 'none';
        if(match) visible++;
      };
      tableEls.forEach(check);
      cardEls.forEach(check);
      if(emptyEl) emptyEl.hidden = visible > 0;
    });
    setTimeout(() => overlay.querySelector('.am-btn-primary')?.focus(), 30);
  });
}

function updateDataBulkOptions(){
  const field  = document.getElementById('data-bulk-field').value;
  const valSel = document.getElementById('data-bulk-value');
  _buildBulkValueOptions(field, valSel);
}

/**
 * Pipeline موحّد لـ Bulk: 9 خطوات (pre-filter → gender → capacity → split → preview → auto-assign → supervisor → DB → feedback).
 * يُستدعى من applyDataBulk و applyBGBulk.
 * @param {Array<number>} ids
 * @param {string} field
 * @param {string} value
 * @param {Object} context — { source: 'data'|'bg', _iterCount?: number }
 * @returns {Promise<{success:boolean, updated:number, failed:number, skipReason?:string}>}
 */
async function _executeBulkPipeline(ids, field, value, context){
  context = context || { source:'data' };
  if(!context._iterCount) context._iterCount = 0;
  if(!ids || !ids.length) return { success:false, skipReason:'empty_ids' };
  // v17.0: bulk session UUID يربط كل صفوف الـ audit الفردية + الصف الجماعي
  if(!context._bulkSessionId){
    context._bulkSessionId = (crypto.randomUUID && crypto.randomUUID())
      || ('bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2,10));
  }

  // 1) Pre-filter — نوع الحقل
  const isCamp  = field === 'mina_camp' || field === 'arafat_camp';
  const isBus   = field === 'bus_num';
  const isGroup = field === 'group_num';
  const loc = isCamp ? (field === 'mina_camp' ? 'mina' : 'arafat') : null;
  let camp = null;
  if(isCamp){
    await _refreshCampsCache();
    camp = (window._campsCache||[]).find(c => (c.camp_num||c.name) === value);
    if(!camp){ showToast('المخيم غير موجود', 'error'); return { success:false, skipReason:'camp_not_found' }; }
  }
  let workingIds = ids.slice();

  // 2) Gender check (camp فقط)
  if(isCamp){
    const gCheck = _checkBulkGender(workingIds, camp);
    if(!gCheck.ok){
      const matching = workingIds.length - gCheck.mismatches.length;
      const items = gCheck.mismatches.slice(0,5).map(m => ({
        icon: m.gender==='ذكر'?'👨':'👩',
        label: m.name,
        value: 'الجنس: ' + m.gender
      }));
      if(gCheck.mismatches.length > 5) items.push({ icon:'…', label:'وآخرون:', value:(gCheck.mismatches.length-5)+' حاج إضافي' });
      const actions = [];
      if(matching > 0) actions.push({ label:`تطبيق على المتوافقين (${matching})`, value:'filter', emoji:'✅', variant:'primary' });
      actions.push({ label:'إلغاء', value:null, variant:'cancel' });
      const decision = await showActionModal({
        type:'warning',
        title:'الجنس لا يتطابق مع نوع المخيم',
        description:`المخيم ${value} مخصَّص للـ${camp.camp_type}. من بين الحجاج المحدَّدين، ${gCheck.mismatches.length} من الجنس الآخر ولا يمكن تسكينهم هنا.`,
        items, actions
      });
      if(decision !== 'filter') return { success:false, skipReason:'gender_abort' };
      const ex = new Set(gCheck.mismatches.map(m => String(m.id)));
      workingIds = workingIds.filter(id => !ex.has(String(id)));
      if(!workingIds.length){ showToast('لا حجاج متوافقين', 'warning'); return { success:false, skipReason:'no_matching_gender' }; }
    }
  }

  // 3) Capacity check (camp فقط)
  if(isCamp){
    const cCheck = _checkBulkCapacity(workingIds, value, loc);
    if(!cCheck.ok){
      const decision = await showActionModal({
        type:'warning',
        title:'السعة لا تكفي',
        description:`المخيم ${value} سعته ${cCheck.capacity} سرير، المتاح حالياً ${cCheck.available} فقط. اخترت ${cCheck.needed} حاج، وهذا يزيد ${cCheck.needed - cCheck.available} عن المتاح.`,
        items:[
          { icon:'🏕️', label:'السعة الكلية:',   value:cCheck.capacity+' سرير' },
          { icon:'🛏️', label:'المحجوز حالياً:', value:(cCheck.capacity - cCheck.available)+' سرير' },
          { icon:'✓',   label:'المتاح:',         value:cCheck.available+' سرير' },
          { icon:'👥',  label:'المطلوب:',        value:cCheck.needed+' حاج' },
          { icon:'⚠️',  label:'النقص:',          value:(cCheck.needed - cCheck.available)+' سرير' }
        ],
        actions:[
          { label:`تطبيق على ${cCheck.available} فقط`, value:'reduce', emoji:'📉', variant:'primary', color:'warning' },
          { label:'إلغاء واختيار مخيم آخر',              value:null,    variant:'cancel' }
        ]
      });
      if(decision !== 'reduce') return { success:false, skipReason:'capacity_abort' };
      workingIds = _sortPilgrimsForAssignment(workingIds).slice(0, cCheck.available);
    }
  }

  // 4) Booking integrity check (camp فقط حالياً)
  if(isCamp){
    const fk = loc === 'mina' ? 'mina_camp' : 'arafat_camp';
    const biCheck = _checkBookingIntegrity(workingIds, { targetField: fk, targetValue: value });
    if(!biCheck.ok){
      const items = biCheck.splits.slice(0,5).map(s => ({
        icon:'📋',
        label:'الحجز رقم ' + s.bookingKey,
        value:'يحتوي ' + s.totalCount + ' شخص، تم اختيار ' + s.selectedCount + ' منهم — سيبقى ' + s.missingIds.length + ' خارج المجموعة'
      }));
      if(biCheck.splits.length > 5) items.push({ icon:'…', label:'ومجموعات أخرى:', value:(biCheck.splits.length-5)+' حجز إضافي' });
      const decision = await showActionModal({
        type:'warning',
        title:'تفكيك مجموعات حجز',
        description:`سيتأثر بهذا التحديد ${biCheck.splits.length} مجموعة حجز. الأفراد المحدَّدون سيُنقَلون للمخيم الجديد، وباقي مجموعاتهم سيبقون في مكانهم.`,
        items,
        actions:[
          { label:'توسيع التحديد تلقائياً', value:'expand', emoji:'🔄', variant:'primary', color:'success' },
          { label:'متابعة مع التفكيك',      value:'split',  emoji:'⚠️', variant:'secondary', color:'warning' },
          { label:'إلغاء',                   value:null,     variant:'cancel' }
        ]
      });
      if(decision === null) return { success:false, skipReason:'split_abort' };
      if(decision === 'expand'){
        context._iterCount++;
        if(context._iterCount > 3){
          showToast('توقّفت إعادة التوسيع — تحديد غير متسق', 'error');
          return { success:false, skipReason:'iter_limit' };
        }
        const allSet = new Set(workingIds.map(String));
        biCheck.splits.forEach(s => s.missingIds.forEach(id => allSet.add(String(id))));
        const expanded = [...allSet].map(Number);
        return _executeBulkPipeline(expanded, field, value, context);
      }
      // 'split' → continue
    }
  }

  // 5-6) Auto-assign أسرّة متتالية (camp فقط)
  let assignments = null;
  if(isCamp){
    const sorted = _sortPilgrimsForAssignment(workingIds);
    const r = _autoAssignBedsSequential(value, loc, sorted);
    if(r.shortage > 0){
      showToast(`تعذّر تسكين ${r.shortage} حاج — أسرّة غير كافية`, 'error');
      return { success:false, skipReason:'assignment_shortage' };
    }
    assignments = r.assignments;
    workingIds  = sorted;
    if(r.nonContiguous){
      showToast('تم التسكين بأسرّة غير متجاورة — يُستحسن اختيار مخيم آخر', 'warning', 6000);
    }
  }

  // 5) Preview UI
  const approved = await _showBulkPreview(workingIds, field, value, assignments);
  if(!approved) return { success:false, skipReason:'preview_cancel' };

  // 7) Supervisor sync (bus/group فقط)
  let supervisorData = null;
  if((isBus || isGroup) && value){
    try {
      const sysusers = window._sysusersCache || (await window.DB.SysUsers.getAll());
      window._sysusersCache = sysusers;
      supervisorData = isBus
        ? _syncSupervisorForBus(value, sysusers)
        : _syncSupervisorForGroup(value, sysusers);
    } catch(_){}
  }

  // 8) Apply to DB — مع snapshot للـ undo
  let ok = 0, fail = 0;
  const successSnapshots = [];
  const snapKeys = _bulkSnapshotKeys(field, isCamp, !!supervisorData);
  if(isCamp && assignments){
    // حلقة فردية (كل حاج بسرير مختلف) مع _applyBedAssignment
    showToast(`جاري تسكين ${workingIds.length} حاج`, 'info');
    for(const id of workingIds){
      const pilgrimRec = ALL_DATA.find(p => String(p['_supabase_id']) === String(id));
      // التقاط snapshot قبل DB update
      const before = {};
      snapKeys.forEach(k => { before[k] = pilgrimRec ? (pilgrimRec[k] ?? null) : null; });
      try {
        const bedKey = assignments.get(id);
        const updates = {};
        _applyBedAssignment(updates, pilgrimRec, loc, value, bedKey);
        await window.DB.Pilgrims.update(parseInt(id), updates);
        successSnapshots.push({ id, before, name: pilgrimRec?.['اسم الحاج']||'—' });
        ok++;
      } catch(e){
        fail++;
        console.error('[bulk] FAILED', 'pilgrim_id:'+id, 'name:'+(pilgrimRec?.['اسم الحاج']||'—'), 'error:'+e.message);
      }
    }
  } else {
    // bulkUpdate موحّد
    const baseUpdates = { [field]: value };
    if(supervisorData){
      baseUpdates.supervisor_name  = supervisorData.supervisor_name;
      baseUpdates.supervisor_phone = supervisorData.supervisor_phone;
    }
    // التقاط snapshot قبل DB + memory update
    workingIds.forEach(id => {
      const r = ALL_DATA.find(p => String(p['_supabase_id']) === String(id));
      const before = {};
      snapKeys.forEach(k => { before[k] = r ? (r[k] ?? null) : null; });
      successSnapshots.push({ id, before, name: r?.['اسم الحاج']||'—' });
    });
    try {
      await window.DB.Pilgrims.bulkUpdate(workingIds, baseUpdates);
      workingIds.forEach(id => {
        const r = ALL_DATA.find(p => String(p['_supabase_id']) === String(id));
        _applyBulkFieldToMemory(r, field, value);
        if(supervisorData && r){
          r['اسم المشرف الخاص بالحاج'] = supervisorData.supervisor_name;
          r['رقم جوال المشرف']          = supervisorData.supervisor_phone;
        }
      });
      ok = workingIds.length;
    } catch(e){
      fail = workingIds.length;
      successSnapshots.length = 0; // فشل كامل → لا snapshots
      console.error('[bulk] bulkUpdate FAILED', 'error:'+e.message);
    }
  }

  // 9) Feedback + حفظ snapshot للـ undo (10 ثوانٍ من toast + 15 ثانية من snapshot)
  if(fail === 0 && ok > 0){
    // v17.0: audit — N صفوف فردية + 1 صف ملخّص
    const bulkSrc    = context.source === 'bg' ? 'bulk_bg' : 'bulk_data';
    const bulkSessId = context._bulkSessionId;
    const fieldLbl   = _bulkFieldLabel(field);
    const bulkMeta = {
      source: bulkSrc,
      bulk_session: bulkSessId,
      bulk_target_field: field,
      bulk_target_value: value,
      bulk_total_count: ok
    };
    // صفوف فردية — كل حاج له update خاص (field_changes دقيقة حسب snapshot)
    successSnapshots.forEach(snap => {
      const rec = ALL_DATA.find(p => String(p['_supabase_id']) === String(snap.id));
      // after = {field: value} أو — في حالة camp — نعيد بناء بعد الـ memory update
      let after;
      if(isCamp){
        after = {};
        snapKeys.forEach(k => { after[k] = rec ? (rec[k] ?? null) : null; });
      } else {
        after = Object.assign({ [field]: value }, supervisorData || {});
      }
      // v17.0.1: فلترة shadow seat sync
      const changes = _buildFieldChanges(snap.before, _filterAuditSyncArtifacts(after));
      if(!changes) return;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(snap.id),
        entity_label: _buildPilgrimLabel(rec) !== '—' ? _buildPilgrimLabel(rec) : (snap.name || '—'),
        field_changes: changes,
        metadata: bulkMeta
      });
    });
    // صف ملخّص جماعي
    _recordAudit({
      action_type:  'bulk_update',
      entity_type:  'pilgrim',
      entity_id:    null,
      entity_label: 'تحديث جماعي: ' + ok + ' حاج — ' + fieldLbl + ': ' + (value == null ? '—' : value),
      field_changes: { [field]: { before: null, after: value, note: 'bulk' } },
      bulk_ids:   successSnapshots.map(s => s.id),
      bulk_count: ok,
      metadata: bulkMeta
    });

    const snapTime = Date.now();
    window._lastBulkSnapshot = {
      timestamp: snapTime,
      field, value,
      context: context.source,
      snapshots: successSnapshots,
      count: ok
    };
    // تنظيف تلقائي بعد 15s (مع فحص timestamp لمنع مسح snapshot جديد بالخطأ)
    setTimeout(() => {
      if(window._lastBulkSnapshot && window._lastBulkSnapshot.timestamp === snapTime){
        window._lastBulkSnapshot = null;
      }
    }, 15000);
    showToast(`تم تحديث ${ok} حاج بنجاح`, 'success', 10000, {
      action: { label: '↶ تراجع', handler: () => _undoLastBulk() }
    });
  } else if(ok > 0){
    // فشل جزئي → لا undo (snapshot غير متّسق)
    showToast(`نجح ${ok}، وفشل ${fail} — راجع console. (التراجع غير متاح عند الفشل الجزئي)`, 'warning', 7000);
  } else {
    showToast('فشل التحديث', 'error');
  }
  return { success: ok > 0, updated: ok, failed: fail };
}

/**
 * استعادة آخر bulk — snapshot لمدة 15 ثانية (10s في toast + 5s buffer).
 * يحمي من double-booking: إذا السرير المُسجَّل محجوز الآن لحاج آخر → يُمسح بدلاً من الاستعادة.
 * @returns {Promise<void>}
 */
async function _undoLastBulk(){
  const snap = window._lastBulkSnapshot;
  if(!snap){ showToast('لا توجد عملية للتراجع عنها', 'warning'); return; }

  // تأكيد للعمليات الكبيرة (≥10)
  if(snap.count >= 10){
    const confirmed = await showActionModal({
      type: 'warning',
      title: 'تأكيد التراجع',
      description: `سيتم استعادة البيانات السابقة لـ ${snap.count} حاج.`,
      items: [
        { icon:'📋', label:'الحقل المُعاد:', value: (FIELD_LABELS[snap.field] || snap.field) },
        { icon:'📅', label:'وقت التنفيذ:',   value: _formatTimeAgo(snap.timestamp) },
        { icon:'👥', label:'عدد الحجاج:',    value: snap.count + ' حاج' }
      ],
      actions: [
        { label:'تأكيد التراجع', value:'undo', emoji:'↶', variant:'primary', color:'warning' },
        { label:'إلغاء',          value:null,   variant:'cancel' }
      ]
    });
    if(confirmed !== 'undo') return;
  }

  showToast('جاري التراجع...', 'info', 3000);
  let ok = 0, fail = 0;
  const conflicts = []; // double-booking على mina_bed/arafat_bed

  for(const s of snap.snapshots){
    try {
      // حماية double-booking: إذا السرير محجوز الآن لحاج آخر → مسح بدل الاستعادة
      const restoreData = { ...s.before };
      ['mina', 'arafat'].forEach(lc => {
        const bedKey = lc + '_bed';
        const seatKey = lc + '_seat';
        const campKey = lc + '_camp';
        if(restoreData[bedKey] && restoreData[campKey]){
          const conflict = ALL_DATA.find(p =>
            String(p['_supabase_id']) !== String(s.id) &&
            p[campKey] === restoreData[campKey] &&
            p[bedKey] &&
            _normalizeBedId(p[bedKey], restoreData[campKey]) === _normalizeBedId(restoreData[bedKey], restoreData[campKey])
          );
          if(conflict){
            conflicts.push({ id: s.id, name: s.name, bed: restoreData[bedKey] });
            restoreData[bedKey]  = null;
            restoreData[seatKey] = null;
          }
        }
      });
      await window.DB.Pilgrims.update(parseInt(s.id), restoreData);
      const r = ALL_DATA.find(p => String(p['_supabase_id']) === String(s.id));
      if(r){
        Object.keys(restoreData).forEach(k => {
          r[k] = restoreData[k];
          const arKey = REVERSE_FIELD_MAP[k];
          if(arKey) r[arKey] = restoreData[k];
        });
      }
      ok++;
    } catch(e){
      fail++;
      console.error('[undo] FAILED', 'pilgrim_id:'+s.id, 'name:'+s.name, 'error:'+e.message);
    }
  }

  window._lastBulkSnapshot = null; // منع undo مزدوج

  // إعادة عرض الواجهة حسب السياق
  if(snap.context === 'bg'){
    const bn  = window._currentBookingGroupNum;
    const aid = window._currentBookingClickedId;
    const ctx = window._currentBookingCtx || 'main';
    if(bn || aid) showBookingGroup(bn, aid, ctx);
  } else {
    if(typeof render === 'function') render();
  }

  // Feedback — مع تنبيه double-booking إن وُجد
  if(conflicts.length > 0){
    const names = conflicts.slice(0, 3).map(c => c.name).join('، ');
    const more = conflicts.length > 3 ? ` وآخرون (${conflicts.length - 3})` : '';
    showToast(`تم التراجع جزئياً — ${conflicts.length} سرير محجوز لحاج آخر، تم مسحه (${names}${more})`, 'warning', 8000);
  } else if(fail === 0){
    showToast(`تم التراجع بنجاح — استعادة ${ok} حاج`, 'success');
  } else {
    showToast(`تراجع جزئي — نجح ${ok}، وفشل ${fail}`, 'warning', 6000);
  }
}

// ─────────────────────────────────────────────
// Block 2 — Assignment Helpers + Tests (normalizeBedId → testNormalizer)
// (was admin.html L8269-9141)
// ─────────────────────────────────────────────
function _normalizeBedId(raw, campNum){
  if(!raw) return '';
  const clean = String(raw).trim().replace(/\s+/g,'');
  if(!campNum) return clean;
  const cn = String(campNum);
  const re = new RegExp('^'+cn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[-_]?(\\d+)$');
  const m1 = clean.match(re);
  if(m1) return cn+'-'+parseInt(m1[1],10);
  if(/^\d+$/.test(clean)) return cn+'-'+parseInt(clean,10);
  const m2 = clean.match(/(\d+)$/);
  if(m2) return cn+'-'+parseInt(m2[1],10);
  return clean;
}
window._normalizeBedId = _normalizeBedId;

// Helper للحفظ: يُطبِّع ويسجّل تحذيراً عند التغيير، ويُعيد null للقيم الفارغة
function _normBedForSave(raw, campNum){
  if(raw === null || raw === undefined || raw === '') return null;
  if(!campNum) return raw || null;
  const normalized = _normalizeBedId(raw, campNum);
  const original = String(raw).trim();
  if(normalized && original !== normalized){
    try { console.warn('[bed normalized]', { original, normalized, campNum }); } catch(_){}
  }
  return normalized || null;
}

/**
 * يُطبِّق تسكين موقع واحد (منى أو عرفات) على كائن updates + سجل الذاكرة.
 * يضمن مزامنة _camp + _bed + _seat + التطبيع في مكان واحد.
 * يتجاوز الحقول التي تكون null/undefined (لا تُكتب في updates).
 *
 * @param {Object} updates — كائن التحديثات المُرسل لـ DB (mutation)
 * @param {Object|null} pilgrimRecord — سجل ALL_DATA (اختياري، mutation)
 * @param {'mina'|'arafat'} loc
 * @param {string|null|undefined} campVal — قيمة جديدة للمخيم، أو null/undefined لتخطّي
 * @param {string|null|undefined} bedRaw — قيمة جديدة للسرير قبل التطبيع
 * @returns {{bedNorm: string|null|undefined}}
 */
function _applyBedAssignment(updates, pilgrimRecord, loc, campVal, bedRaw){
  const campKey = loc==='mina' ? 'mina_camp' : 'arafat_camp';
  const bedKey  = loc==='mina' ? 'mina_bed'  : 'arafat_bed';
  const seatKey = loc==='mina' ? 'mina_seat' : 'arafat_seat';
  const effectiveCamp = (campVal !== null && campVal !== undefined) ? campVal : (pilgrimRecord ? pilgrimRecord[campKey] : null);
  let bedNorm;
  if(bedRaw !== null && bedRaw !== undefined){
    bedNorm = _normBedForSave(bedRaw, effectiveCamp);
  }
  if(campVal !== null && campVal !== undefined){
    updates[campKey] = campVal || null;
    if(pilgrimRecord) pilgrimRecord[campKey] = campVal || null;
  }
  if(bedNorm !== undefined){
    updates[bedKey]  = bedNorm;
    updates[seatKey] = bedNorm;
    if(pilgrimRecord){
      pilgrimRecord[bedKey]  = bedNorm;
      pilgrimRecord[seatKey] = bedNorm;
    }
  }
  return { bedNorm };
}

/**
 * مقارنة موحّدة لاكتشاف التغيير الفعلي:
 * null/undefined/فراغ/whitespace-only → تُعامل كمتساوية
 * @returns {boolean} true فقط إذا تغيّرت القيمة فعلاً
 */
function _fieldChanged(before, after){
  const norm = v => (v === null || v === undefined) ? '' : String(v).trim();
  return norm(before) !== norm(after);
}

// خريطة أسماء الحقول لملخّص التوست — حقول متعدّدة تُدمج في فئة واحدة (Set يمنع التكرار)
const FIELD_LABELS = {
  mina_camp:   'مخيم منى',   mina_bed:   'مخيم منى',   mina_seat:   'مخيم منى',
  arafat_camp: 'مخيم عرفات', arafat_bed: 'مخيم عرفات', arafat_seat: 'مخيم عرفات',
  group_num:        'الفوج',
  bus_num:          'الحافلة',
  supervisor_name:  'المشرف',
  supervisor_phone: 'المشرف'
};

// ===== v17.x Audit Log extracted → audit.js =====

// Mapping من مفاتيح DB الإنجليزية إلى المفاتيح العربية في ALL_DATA.
// يُستخدم في استعادة snapshot (undo) لضمان اتساق DB + الذاكرة.
// الحقول غير المذكورة (مثل mina_camp) تستخدم نفس المفتاح في الذاكرة.
const REVERSE_FIELD_MAP = {
  bus_num:            'رقم الحافلة الخاصة بك',
  group_num:          'رقم فوج التفويج الخاص بك',
  supervisor_name:    'اسم المشرف الخاص بالحاج',
  supervisor_phone:   'رقم جوال المشرف',
  bus_status:         'حالة الإركاب',
  camp_status:        'حالة الحضور في المخيم',
  nusuk_card_status:  'حالة بطاقة نسك'
};

/**
 * يُعيد نصاً عربياً يصف الفرق الزمني بين timestamp والآن.
 * يُستخدم في modal تأكيد undo.
 */
function _formatTimeAgo(timestamp){
  const diff = Math.floor((Date.now() - (timestamp||0)) / 1000);
  if(diff < 5)    return 'الآن';
  if(diff < 60)   return 'قبل ' + diff + ' ثانية';
  if(diff < 3600) return 'قبل ' + Math.floor(diff/60) + ' دقيقة';
  return 'قبل ' + Math.floor(diff/3600) + ' ساعة';
}

/**
 * يُعيد قائمة الحقول التي يجب حفظها في snapshot قبل bulk update.
 * @param {string} field — الحقل المستهدف
 * @param {boolean} isCamp — هل هو camp bulk (يتطلّب حفظ bed+seat)
 * @param {boolean} hasSupervisor — هل supervisor يُحدَّث (bus/group bulk)
 */
function _bulkSnapshotKeys(field, isCamp, hasSupervisor){
  if(isCamp){
    const loc = field === 'mina_camp' ? 'mina' : 'arafat';
    return [loc+'_camp', loc+'_bed', loc+'_seat'];
  }
  if(hasSupervisor) return [field, 'supervisor_name', 'supervisor_phone'];
  return [field];
}

/**
 * يبني ملخّصاً نصياً للحقول المُحدَّثة لعرضه في toast النجاح.
 * @param {Object} updates — كائن التحديثات المُرسل لـ DB
 * @param {Array<string>} [excludeKeys] — مفاتيح تُستثنى (مثل supervisor إذا لم يتغيّر فعلاً)
 * @returns {string} نص عربي مفصول بفاصلة (أو '' إذا فارغ)
 */
function _summarizeUpdates(updates, excludeKeys){
  const ex = new Set(excludeKeys || []);
  const labels = new Set();
  Object.keys(updates || {}).forEach(k => {
    if(ex.has(k)) return;
    const label = FIELD_LABELS[k];
    if(label) labels.add(label);
  });
  return [...labels].join('، ');
}

// =====================================================================
// v15.4 — Validation Helpers لنظام التسكين الموحّد
// تُستخدم في v15.5 (single-save) و v16.0 (bulk paths). هنا فقط التعريف.
// =====================================================================

/**
 * جنس الحاج بصيغة موحّدة.
 * @returns {'M'|'F'|null}
 */
/**
 * v16.4 — بطاقة حاج موحّدة لقوائم البحث (searchLinkPilgrim + supModalSearch).
 * يدعم المفاتيح العربية (ALL_DATA) والإنجليزية (supervisor context).
 *
 * @param {Object} pilgrim
 * @param {Object} [opts]
 * @param {Array<string>} [opts.showFields=['id','booking']] — 'id','booking','phone','gender','nationality'
 * @param {Object} [opts.action] — { label, onclick, color, disabled, ariaLabel }
 *   color: 'info'|'success'|'warning'|'danger'|'brand' أو hex مباشر (مثل '#888')
 * @param {'compact'|'standard'} [opts.size='standard']
 * @param {boolean} [opts.divider=false] — بدل border كامل → border-bottom فقط
 * @param {Array<{label,color}>} [opts.badges]
 * @returns {string} HTML
 */
function _buildPilgrimCard(pilgrim, opts){
  opts = opts || {};
  const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Normalization — يقبل كلا نمطَي المفاتيح
  const name    = pilgrim['اسم الحاج'] ?? pilgrim.name ?? '—';
  const id      = pilgrim['رقم الهوية'] ?? pilgrim.id_num ?? '';
  const booking = pilgrim['رقم الحجز'] ?? pilgrim.booking_num ?? '';
  const phone   = pilgrim['رقم الجوال'] ?? pilgrim.mobile ?? '';
  const nat     = pilgrim['الجنسية'] ?? pilgrim.nationality ?? '';
  const fields = opts.showFields || ['id','booking'];
  const parts = [];
  if(fields.includes('id') && id)           parts.push('🪪 ' + esc(id));
  if(fields.includes('booking') && booking) parts.push('📋 ' + esc(booking));
  if(fields.includes('phone') && phone)     parts.push('📞 ' + esc(phone));
  if(fields.includes('gender')){
    const g = _genderOf(pilgrim);
    if(g) parts.push((g==='F'?'👩':'👨') + ' ' + (g==='F'?'أنثى':'ذكر'));
  }
  if(fields.includes('nationality') && nat) parts.push('🌍 ' + esc(nat));
  const subLine = parts.join(' &nbsp;•&nbsp; ');
  // Badges
  const badgesHtml = Array.isArray(opts.badges) && opts.badges.length
    ? '<span class="plc-badges">' + opts.badges.map(b =>
        `<span class="plc-badge" style="background:${esc(b.color || 'var(--gold, #c8971a)')}">${esc(b.label)}</span>`
      ).join('') + '</span>'
    : '';
  // Action button
  const a = opts.action || {};
  const colorMap = {
    info:'#1a5fa8', success:'#2e7d32', warning:'#c07000',
    danger:'#c00', brand:'var(--brown, #3d2000)'
  };
  const btnBg = colorMap[a.color] || a.color || 'var(--brown, #3d2000)';
  const disabled = a.disabled ? 'disabled' : '';
  const aria = esc(a.ariaLabel || a.label || '');
  const actionHtml = a.label
    ? `<button class="plc-action" onclick="${esc(a.onclick||'')}" style="background:${btnBg}" ${disabled} aria-label="${aria}" type="button">${esc(a.label)}</button>`
    : '';
  const cls = 'plc' + (opts.size === 'compact' ? ' plc-compact' : '') + (opts.divider ? ' plc-divider' : '');
  return `<div class="${cls}" role="listitem">
    <div class="plc-info">
      <div class="plc-name">${esc(name)}${badgesHtml}</div>
      ${subLine?`<div class="plc-sub">${subLine}</div>`:''}
    </div>
    ${actionHtml}
  </div>`;
}

/**
 * فلتر بحث موحّد لقوائم الحجاج.
 * @param {string} query
 * @param {Object} [opts]
 * @param {Array<Object>} [opts.source=ALL_DATA]
 * @param {Array<string|number>} [opts.excludeIds=[]]
 * @param {number} [opts.limit=50]
 * @returns {Array<Object>}
 */
function _filterPilgrimsByQuery(query, opts){
  opts = opts || {};
  const q = String(query||'').trim().toLowerCase();
  const source = opts.source || ALL_DATA;
  const exclude = new Set((opts.excludeIds || []).map(x => String(x)));
  const limit = typeof opts.limit === 'number' ? opts.limit : 50;
  const out = [];
  for(const p of source){
    const pid = String(p['_supabase_id'] ?? p.id ?? '');
    if(exclude.has(pid)) continue;
    if(q){
      const name    = String(p['اسم الحاج'] ?? p.name ?? '').toLowerCase();
      const id      = String(p['رقم الهوية'] ?? p.id_num ?? '');
      const booking = String(p['رقم الحجز'] ?? p.booking_num ?? '');
      const phone   = String(p['رقم الجوال'] ?? p.mobile ?? '');
      if(!name.includes(q) && !id.includes(q) && !booking.includes(q) && !phone.includes(q)) continue;
    }
    out.push(p);
    if(out.length >= limit) break;
  }
  return out;
}

function _genderOf(p){
  // v16.4: يدعم المفتاح العربي (ALL_DATA) والإنجليزي (supervisor context)
  const g = String((p?.['الجنس'] ?? p?.gender) || '').trim().toLowerCase();
  if(!g) return null;
  if(['أنثى','أنثي','انثى','انثي','female','f'].includes(g)) return 'F';
  if(['ذكر','male','m'].includes(g)) return 'M';
  return null;
}

/**
 * فحص تطابق جنس الحاج مع نوع المخيم.
 * مخيم بلا camp_type → يقبل الجميع.
 * @returns {boolean}
 */
function _campMatchesGenderGlobal(campType, pilgrimGender){
  if(!campType) return true;
  if(!pilgrimGender) return true; // نقبل عند غياب البيانات
  if(campType === 'نساء') return pilgrimGender === 'F';
  if(campType === 'رجال') return pilgrimGender === 'M';
  return true;
}

/**
 * جميع الحجاج في نفس الحجز (بما فيهم الحاج نفسه).
 * wrapper فوق getRelatedPilgrims لتضمين الأصل.
 * @returns {Array<Object>}
 */
function _getBookingMates(pilgrimId){
  const me = ALL_DATA.find(p => String(p['_supabase_id']) === String(pilgrimId));
  if(!me) return [];
  return [me, ...getRelatedPilgrims(me)];
}

/**
 * يجمع مصفوفة pilgrimIds في Map حسب رقم الحجز (أو booking_ref).
 * @returns {Map<string, Array<Object>>}  // bookingKey → pilgrim objects
 */
function _groupByBooking(ids){
  const map = new Map();
  (ids || []).forEach(id => {
    const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(id));
    if(!p) return;
    const key = String(p['booking_ref'] || p['رقم الحجز'] || id);
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return map;
}

/**
 * فرز قائمة pilgrimIds للتسكين: booking_ref → gender (M→F) → الاسم.
 * @returns {Array<number>} ids بعد الفرز
 */
function _sortPilgrimsForAssignment(ids){
  const list = (ids || []).map(id => ALL_DATA.find(p => String(p['_supabase_id']) === String(id))).filter(Boolean);
  list.sort((a, b) => {
    const ka = String(a['booking_ref'] || a['رقم الحجز'] || '');
    const kb = String(b['booking_ref'] || b['رقم الحجز'] || '');
    if(ka !== kb) return ka.localeCompare(kb, 'ar', { numeric: true });
    const ga = _genderOf(a) || 'Z';
    const gb = _genderOf(b) || 'Z';
    if(ga !== gb) return ga === 'M' ? -1 : 1; // ذكور أولاً
    return String(a['اسم الحاج']||'').localeCompare(String(b['اسم الحاج']||''), 'ar');
  });
  return list.map(p => p['_supabase_id']);
}

/**
 * الأسرّة المتاحة في مخيم معيّن، مرتّبة تصاعدياً.
 * ⚠️ يقرأ camps من window._campsCache — يجب تعبئتها قبل الاستدعاء:
 *    window._campsCache = await getCamps();  (سيُضاف في v15.5)
 * @param {string} campNum
 * @param {'mina'|'arafat'} loc
 * @param {Array<number>} [excludeIds] — حجاج يُهمَل شغلهم للسرير (للـ bulk self-exclusion)
 * @returns {Array<{num: number, key: string}>}
 */
function _getAvailableBedsInCamp(campNum, loc, excludeIds){
  const fk  = loc === 'mina' ? 'mina_camp' : 'arafat_camp';
  const bk  = loc === 'mina' ? 'mina_bed'  : 'arafat_bed';
  const ex  = new Set((excludeIds || []).map(String));
  const camps = window._campsCache || [];
  const camp = camps.find(c => (c.camp_num || c.name) === campNum);
  const cap = parseInt(camp?.capacity) || 0;
  const booked = new Set();
  ALL_DATA.forEach(x => {
    if(x[fk] !== campNum || !x[bk]) return;
    if(ex.has(String(x['_supabase_id']))) return;
    booked.add(_normalizeBedId(x[bk], campNum));
  });
  const out = [];
  for(let i = 1; i <= cap; i++){
    const key = campNum + '-' + i;
    if(!booked.has(key)) out.push({ num: i, key });
  }
  return out;
}

/**
 * توزيع أسرّة متتالية لمجموعة حجاج مرتّبة.
 * يحاول إعطاء أسرّة متتالية لنفس الحجز.
 * @param {string} campNum
 * @param {'mina'|'arafat'} loc
 * @param {Array<number>} orderedIds — ids مرتّبة بالفعل (استخدم _sortPilgrimsForAssignment)
 * @returns {{assignments: Map<id, bedKey>, nonContiguous: boolean, shortage: number}}
 */
function _autoAssignBedsSequential(campNum, loc, orderedIds){
  const fk = loc === 'mina' ? 'mina_camp' : 'arafat_camp';
  const bk = loc === 'mina' ? 'mina_bed'  : 'arafat_bed';
  const assignments = new Map();
  const total = orderedIds.length;
  let nonContiguous = false;
  // الخيار B: احتفظ بالأسرّة الصالحة للحجاج الموجودين أصلاً في نفس المخيم
  const keepIds = new Set();
  orderedIds.forEach(id => {
    const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(id));
    if(p && p[fk] === campNum && p[bk]){
      assignments.set(id, _normalizeBedId(p[bk], campNum));
      keepIds.add(String(id));
    }
  });
  const keptBeds = new Set([...assignments.values()]);
  const needAssign = orderedIds.filter(id => !keepIds.has(String(id)));
  // Pool: أسرّة متاحة استثناء كل المحدَّدين، ثم إزالة الأسرّة المحتفظ بها
  const available = _getAvailableBedsInCamp(campNum, loc, orderedIds)
    .filter(b => !keptBeds.has(b.key));
  // محاولة: ابحث عن نافذة متتالية بحجم كل مجموعة حجز (فقط للذين يحتاجون تعيين)
  const byBooking = _groupByBooking(needAssign);
  let bedsUsed = new Set();
  byBooking.forEach((pilgrims) => {
    const needed = pilgrims.length;
    // ابحث عن نافذة متتالية من `needed` أسرّة متاحة وغير مستخدمة
    let windowStart = -1;
    for(let i = 0; i <= available.length - needed; i++){
      let ok = true;
      for(let j = 0; j < needed; j++){
        const a = available[i + j];
        if(!a || bedsUsed.has(a.key)) { ok = false; break; }
        if(j > 0 && a.num !== available[i + j - 1].num + 1) { ok = false; break; }
      }
      if(ok){ windowStart = i; break; }
    }
    if(windowStart >= 0){
      pilgrims.forEach((p, idx) => {
        const bed = available[windowStart + idx];
        assignments.set(p['_supabase_id'], bed.key);
        bedsUsed.add(bed.key);
      });
    } else {
      // لا يوجد نافذة متتالية — أعطِ أي أسرّة متاحة (fallback الخيار C)
      nonContiguous = true;
      const remaining = available.filter(a => !bedsUsed.has(a.key));
      pilgrims.forEach((p, idx) => {
        const bed = remaining[idx];
        if(bed){
          assignments.set(p['_supabase_id'], bed.key);
          bedsUsed.add(bed.key);
        }
      });
    }
  });
  const shortage = total - assignments.size;
  return { assignments, nonContiguous, shortage };
}

/**
 * فحص سعة المخيم لقائمة حجاج (يراعي الذين هم أصلاً في المخيم نفسه).
 * @returns {{ok: boolean, needed: number, available: number, capacity: number}}
 */
function _checkBulkCapacity(ids, campNum, loc){
  const available = _getAvailableBedsInCamp(campNum, loc, ids);
  const camps = window._campsCache || [];
  const camp = camps.find(c => (c.camp_num || c.name) === campNum);
  const capacity = parseInt(camp?.capacity) || 0;
  return { ok: available.length >= ids.length, needed: ids.length, available: available.length, capacity };
}

/**
 * فحص الجنس: هل كل المحدَّدين يتوافقون مع نوع المخيم؟
 * @returns {{ok: boolean, mismatches: Array<{id, name, gender}>}}
 */
function _checkBulkGender(ids, camp){
  const campType = camp?.camp_type || '';
  if(!campType) return { ok: true, mismatches: [] };
  const mismatches = [];
  (ids || []).forEach(id => {
    const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(id));
    if(!p) return;
    const g = _genderOf(p);
    if(!_campMatchesGenderGlobal(campType, g)){
      mismatches.push({ id, name: p['اسم الحاج']||'—', gender: g==='M'?'ذكر':g==='F'?'أنثى':'—' });
    }
  });
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * فحص تفكيك الحجز: هل التحديد يفكّك مجموعات حجز؟
 * @param {Array<number>} ids
 * @param {Object} [opts]
 * @param {string} [opts.targetField] — حقل المخيم المستهدف (مثل 'mina_camp'). عند تحديده:
 *   إذا كل الأعضاء المفقودين في نفس المخيم المستهدف فعلاً → تخطّى (توحيد إيجابي، ليس تفكيكاً)
 * @param {string} [opts.targetValue] — قيمة المخيم المستهدف
 * @returns {{ok: boolean, splits: Array<{bookingKey, selectedCount, totalCount, missingIds, missingDetails}>}}
 */
function _checkBookingIntegrity(ids, opts){
  const selectedSet = new Set((ids || []).map(String));
  const seen = new Set();
  const splits = [];
  const targetField = opts && opts.targetField;
  const targetValue = opts && opts.targetValue;
  (ids || []).forEach(id => {
    const p = ALL_DATA.find(x => String(x['_supabase_id']) === String(id));
    if(!p) return;
    const key = String(p['booking_ref'] || p['رقم الحجز'] || '');
    if(!key || seen.has(key)) return;
    seen.add(key);
    const mates = _getBookingMates(id); // يشمل نفسه
    if(mates.length <= 1) return; // حاج وحده — لا مجموعة
    const missing = mates.filter(m => !selectedSet.has(String(m['_supabase_id'])));
    if(missing.length === 0) return;
    // توحيد إيجابي: إذا كل الأعضاء المفقودين (غير المُحدَّدين) أصلاً في المخيم المستهدف → لا تفكيك
    if(targetField && targetValue){
      const allAtTarget = missing.every(m => m[targetField] === targetValue);
      if(allAtTarget) return; // توحيد، لا تحذير
    }
    splits.push({
      bookingKey: key,
      selectedCount: mates.length - missing.length,
      totalCount: mates.length,
      missingIds: missing.map(m => m['_supabase_id']),
      missingDetails: missing.map(m => ({
        id: m['_supabase_id'],
        name: m['اسم الحاج']||'—',
        currentCamp: m['mina_camp'] || m['arafat_camp'] || 'غير مُسكَّن'
      }))
    });
  });
  return { ok: splits.length === 0, splits };
}

/**
 * تزامن بيانات المشرف من sys_users حسب رقم الحافلة.
 * @param {string|number} busNum
 * @param {Array<Object>} sysusers — من DB.SysUsers.getAll (cache خارجي أفضل)
 * @returns {{supervisor_name: string, supervisor_phone: string}|null}
 */
function _syncSupervisorForBus(busNum, sysusers){
  if(!busNum || !Array.isArray(sysusers)) return null;
  const sup = sysusers.find(u => u.role === 'supervisor' && String(u.group_num) === String(busNum));
  if(!sup) return null;
  return { supervisor_name: sup.name || '', supervisor_phone: sup.phone || '' };
}

/**
 * تزامن بيانات المشرف من sys_users حسب رقم الفوج.
 * في النظام الحالي group_num في sys_users يُمثّل الحافلة — نفس منطق _syncSupervisorForBus.
 * يُبقَى منفصلاً ليكون قابلاً للتخصيص مستقبلاً.
 */
function _syncSupervisorForGroup(groupNum, sysusers){
  return _syncSupervisorForBus(groupNum, sysusers);
}

/**
 * يُعبّئ window._campsCache من DB. يُستدعى قبل استخدام helpers v15.4 في نوافذ الحفظ.
 * Invalidation: يُستدعى تلقائياً من renderCamps بعد save/delete.
 * @returns {Promise<Array>}
 */
async function _refreshCampsCache(){
  try { window._campsCache = await getCamps(); }
  catch(e){ window._campsCache = []; }
  return window._campsCache;
}

/**
 * للاستخدام في سياق single-save: هل نقل هذا الحاج إلى مخيم جديد يُفكّك مجموعته؟
 * فحص ذكي:
 *  - إذا المخيم الجديد = مخيم معظم المجموعة → لا تفكيك (توحيد إيجابي)
 *  - إذا المخيم الجديد مختلف والأعضاء الآخرون في مخيم واحد → تفكيك
 * @param {number|string} pilgrimId — الحاج الذي يُنقَل
 * @param {string} newCamp — المخيم الجديد
 * @param {'mina'|'arafat'} loc
 * @returns {{willSplit: boolean, groupSize: number, inOldCamp: Array, inOtherCamps: Array, unassigned: Array, bookingKey: string}}
 */
function _checkSingleMoveSplit(pilgrimId, newCamp, loc){
  const campField = loc === 'mina' ? 'mina_camp' : 'arafat_camp';
  const me = ALL_DATA.find(p => String(p['_supabase_id']) === String(pilgrimId));
  if(!me) return { willSplit: false, groupSize: 0, inOldCamp: [], inOtherCamps: [], unassigned: [], bookingKey: '' };
  const newC = String(newCamp||'').trim();
  // v10.6: نقل لنفس المخيم الحالي = no-op → لا تفكيك (بغضّ النظر عن حالة الزملاء)
  const myCurrentCamp = String(me[campField]||'').trim();
  if(myCurrentCamp === newC){
    return {
      willSplit: false,
      groupSize: _getBookingMates(pilgrimId).length,
      inOldCamp: [], inOtherCamps: [], unassigned: [],
      bookingKey: String(me['booking_ref']||me['رقم الحجز']||'')
    };
  }
  const mates = _getBookingMates(pilgrimId).filter(m => String(m['_supabase_id']) !== String(pilgrimId));
  if(!mates.length) return { willSplit: false, groupSize: 1, inOldCamp: [], inOtherCamps: [], unassigned: [], bookingKey: String(me['booking_ref']||me['رقم الحجز']||'') };
  const inNewCamp  = mates.filter(m => String(m[campField]||'').trim() === newC);
  const unassigned = mates.filter(m => !String(m[campField]||'').trim());
  const inOtherCamps = mates.filter(m => {
    const c = String(m[campField]||'').trim();
    return c && c !== newC;
  });
  // التفكيك يحدث فقط إذا كان في مخيمات أخرى أعضاء — بغضّ النظر عن غير المُسكَّنين
  const willSplit = inOtherCamps.length > 0;
  return {
    willSplit,
    groupSize: mates.length + 1,
    inOldCamp: inOtherCamps,  // الأعضاء في مخيمات أخرى (سيبقون منفصلين عن الحاج المنقول)
    inOtherCamps,
    unassigned,
    bookingKey: String(me['booking_ref']||me['رقم الحجز']||'')
  };
}

// أداة اختبار regression للـ Assignment helpers — يُشغَّل تلقائياً في DEV بعد _testNormalizer
window._testAssignmentHelpers = function(){
  const STYLE = {
    title:   'background:linear-gradient(135deg,#3d2000,#c8971a);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:bold',
    pass:    'color:#2e7d32;font-weight:600',
    fail:    'color:#c00;font-weight:bold',
    okSum:   'background:#2e7d32;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold',
    failSum: 'background:#c00;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold'
  };
  // حفظ الحالة الحقيقية واستبدالها بـ mock
  const origData  = ALL_DATA.slice();
  const origCache = window._campsCache;
  ALL_DATA.length = 0;
  [
    {_supabase_id:1, 'اسم الحاج':'أحمد', 'الجنس':'ذكر',  'رقم الحجز':'B1', booking_ref:'B1', mina_camp:'C1', mina_bed:'C1-1'},
    {_supabase_id:2, 'اسم الحاج':'سالم', 'الجنس':'ذكر',  'رقم الحجز':'B1', booking_ref:'B1', mina_camp:'C1', mina_bed:'C1-2'},
    {_supabase_id:3, 'اسم الحاج':'ليلى', 'الجنس':'أنثى', 'رقم الحجز':'B1', booking_ref:'B1', mina_camp:'C2', mina_bed:'C2-1'},
    {_supabase_id:4, 'اسم الحاج':'محمد', 'الجنس':'male','رقم الحجز':'B2', booking_ref:'B2'},
    {_supabase_id:5, 'اسم الحاج':'سارة', 'الجنس':'F',    'رقم الحجز':'B2', booking_ref:'B2'},
    {_supabase_id:6, 'اسم الحاج':'خالد', 'الجنس':'ذكر',  'رقم الحجز':'B3', booking_ref:'B3'},
    // أسرّة مشغولة في C3 لاختبار السعة الممتلئة
    {_supabase_id:100, 'الجنس':'ذكر', mina_camp:'C3', mina_bed:'C3-1'},
    {_supabase_id:101, 'الجنس':'ذكر', mina_camp:'C3', mina_bed:'C3-2'},
    {_supabase_id:102, 'الجنس':'ذكر', mina_camp:'C3', mina_bed:'C3-3'}
  ].forEach(p => ALL_DATA.push(p));
  window._campsCache = [
    { camp_num:'C1', capacity:10, camp_type:'رجال', location:'منى' },
    { camp_num:'C2', capacity:5,  camp_type:'نساء', location:'منى' },
    { camp_num:'C3', capacity:3,  camp_type:'رجال', location:'منى' }
  ];

  const cases = [
    { name:'genderOf ذكر→M',                     run:()=>_genderOf({'الجنس':'ذكر'}) === 'M' },
    { name:'genderOf أنثى→F',                    run:()=>_genderOf({'الجنس':'أنثى'}) === 'F' },
    { name:'genderOf female→F',                  run:()=>_genderOf({'الجنس':'female'}) === 'F' },
    { name:'genderOf فارغ→null',                 run:()=>_genderOf({'الجنس':''}) === null },
    { name:'campMatchesGender M/رجال→قبول',      run:()=>_campMatchesGenderGlobal('رجال','M') === true },
    { name:'campMatchesGender F/رجال→رفض',       run:()=>_campMatchesGenderGlobal('رجال','F') === false },
    { name:'campMatchesGender untyped→قبول',    run:()=>_campMatchesGenderGlobal('','M') === true },
    { name:'getBookingMates B1→3 أفراد',         run:()=>_getBookingMates(1).length === 3 },
    { name:'getBookingMates B3→1 فقط (وحيد)',    run:()=>_getBookingMates(6).length === 1 },
    { name:'groupByBooking [1,3,4]→2 مجموعات',   run:()=>_groupByBooking([1,3,4]).size === 2 },
    { name:'sortPilgrimsForAssignment: أنثى في النهاية', run:()=>{
        const sorted = _sortPilgrimsForAssignment([3,2,1]);
        return sorted[sorted.length-1] === 3;
      }},
    { name:'checkBulkGender: ذكر+أنثى في مخيم نساء→mismatch 1', run:()=>{
        const c2 = window._campsCache.find(c=>c.camp_num==='C2');
        const r = _checkBulkGender([1,3], c2);
        return r.ok === false && r.mismatches.length === 1;
      }},
    { name:'checkBulkCapacity: C1 سعة 10→ok',    run:()=>{
        const r = _checkBulkCapacity([1,2,3,4,5], 'C1', 'mina');
        return r.ok === true && r.capacity === 10;
      }},
    { name:'checkBulkCapacity: C3 ممتلئ→fail',   run:()=>{
        const r = _checkBulkCapacity([4,5], 'C3', 'mina');
        return r.ok === false && r.available === 0;
      }},
    { name:'getAvailableBedsInCamp: C3 ممتلئ→0', run:()=>_getAvailableBedsInCamp('C3','mina').length === 0 },
    { name:'getAvailableBedsInCamp: C1 فارغ→10', run:()=>{
        // C1 مشغول من 1 و 2. لو لم نستثنهم → 8، لو استثنيناهم → 10
        const all  = _getAvailableBedsInCamp('C1','mina');          // 8 متاحة
        const self = _getAvailableBedsInCamp('C1','mina',[1,2]);     // 10 متاحة
        return all.length === 8 && self.length === 10;
      }},
    { name:'autoAssign متتالي: حجز من 2 في C1',  run:()=>{
        const r = _autoAssignBedsSequential('C1', 'mina', [4,5]);
        return r.assignments.size === 2 && r.nonContiguous === false;
      }},
    { name:'checkBookingIntegrity: كامل→ok',     run:()=>{
        const r = _checkBookingIntegrity([1,2,3]);
        return r.ok === true;
      }},
    { name:'checkBookingIntegrity: ناقص→split',  run:()=>{
        const r = _checkBookingIntegrity([1,2]);
        return r.ok === false && r.splits.length === 1 && r.splits[0].selectedCount === 2;
      }},
    { name:'checkSingleMoveSplit: نقل لمخيم نفس المجموعة→لا تفكيك', run:()=>{
        // الحاج 1 في C1 مع 2. ننقله إلى C1 (نفسه) → لا تفكيك
        const r = _checkSingleMoveSplit(1, 'C1', 'mina');
        return r.willSplit === false;
      }},
    { name:'checkSingleMoveSplit: نقل بعيد→تفكيك', run:()=>{
        // الحاج 1 في C1 مع 2، 3 في C2. ننقل 1 إلى C3 → تفكيك (2 في C1، 3 في C2)
        const r = _checkSingleMoveSplit(1, 'C3', 'mina');
        return r.willSplit === true && r.inOtherCamps.length === 2;
      }},
    { name:'checkSingleMoveSplit: حاج وحيد→لا تفكيك', run:()=>{
        const r = _checkSingleMoveSplit(6, 'C1', 'mina');
        return r.willSplit === false && r.groupSize === 1;
      }}
  ];

  console.log('%c🧪 اختبار Assignment Helpers', STYLE.title);
  let pass = 0, fail = 0;
  const failures = [];
  cases.forEach((c, i) => {
    try {
      const ok = c.run();
      if(ok){ pass++; console.log('%c✅ ['+(i+1)+'] '+c.name, STYLE.pass); }
      else  { fail++; failures.push({idx:i+1, name:c.name, error:'returned false'}); console.log('%c❌ ['+(i+1)+'] '+c.name, STYLE.fail); }
    } catch(e){
      fail++; failures.push({idx:i+1, name:c.name, error:e.message});
      console.log('%c❌ ['+(i+1)+'] '+c.name+': '+e.message, STYLE.fail);
    }
  });

  // استعادة البيانات الأصلية
  ALL_DATA.length = 0;
  origData.forEach(p => ALL_DATA.push(p));
  window._campsCache = origCache;

  const msg = fail === 0 ? '🎉 كل اختبارات Assignment helpers نجحت ('+pass+'/'+cases.length+')'
                          : '⚠️ فشل '+fail+' من '+cases.length+' اختبار';
  console.log('%c'+msg, fail === 0 ? STYLE.okSum : STYLE.failSum);
  if(failures.length) console.table(failures);
  return { pass, fail, total: cases.length, failures };
};

/**
 * ⚠️  لا تُشغَّل تلقائياً — تستدعي _executeBulkPipeline الحقيقية التي تُصدر showToast وتُلوِّث UI.
 * Integration test للاستخدام اليدوي من console فقط.
 * للتشغيل: _testBulkPipeline()
 *
 * يستخدم _bulkPipelineAutoApprove = true لتخطّي Preview modals، لكن toasts تظهر فعلياً.
 */
window._testBulkPipeline = async function(){
  // تحذير runtime إذا لوحة الأدمن ظاهرة — toasts ستُلوِّث UI المستخدم
  const adminEl = document.getElementById('admin-panel');
  if(adminEl && adminEl.style.display !== 'none'){
    console.warn('⚠️ _testBulkPipeline سيُطلق toasts حقيقية — تأكد من عدم ظهورها للمستخدم قبل المتابعة');
  }
  const STYLE = {
    title:   'background:linear-gradient(135deg,#3d2000,#c8971a);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:bold',
    pass:    'color:#2e7d32;font-weight:600',
    fail:    'color:#c00;font-weight:bold',
    okSum:   'background:#2e7d32;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold',
    failSum: 'background:#c00;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold'
  };
  // إعداد بيانات mock
  const origData  = ALL_DATA.slice();
  const origCache = window._campsCache;
  const origApprove = window._bulkPipelineAutoApprove;
  ALL_DATA.length = 0;
  [
    {_supabase_id:1, 'اسم الحاج':'أحمد', 'الجنس':'ذكر',  'رقم الحجز':'B1', booking_ref:'B1', mina_camp:'C1', mina_bed:'C1-1'},
    {_supabase_id:2, 'اسم الحاج':'سالم', 'الجنس':'ذكر',  'رقم الحجز':'B1', booking_ref:'B1', mina_camp:'C1', mina_bed:'C1-2'},
    {_supabase_id:3, 'اسم الحاج':'ليلى', 'الجنس':'أنثى', 'رقم الحجز':'B1', booking_ref:'B1'},
    {_supabase_id:4, 'اسم الحاج':'محمد', 'الجنس':'ذكر',  'رقم الحجز':'B2', booking_ref:'B2'},
    {_supabase_id:5, 'اسم الحاج':'سارة', 'الجنس':'أنثى', 'رقم الحجز':'B2', booking_ref:'B2'},
    {_supabase_id:6, 'اسم الحاج':'خالد', 'الجنس':'ذكر',  'رقم الحجز':'B3', booking_ref:'B3'}
  ].forEach(p => ALL_DATA.push(p));
  window._campsCache = [
    { camp_num:'C1', capacity:10, camp_type:'رجال', location:'منى' },
    { camp_num:'C2', capacity:5,  camp_type:'نساء', location:'منى' },
    { camp_num:'C3', capacity:3,  camp_type:'رجال', location:'منى' }
  ];

  const cases = [
    { name:'_groupByBooking لـ 2 حجز مختلف', run:async ()=>{
        return _groupByBooking([1,4]).size === 2;
      }},
    { name:'_sortPilgrimsForAssignment ذكور قبل إناث', run:async ()=>{
        const s = _sortPilgrimsForAssignment([3,2,1]);
        return s[s.length-1] === 3;
      }},
    { name:'_checkBulkGender: ذكور+إناث في نساء', run:async ()=>{
        const c2 = window._campsCache.find(c=>c.camp_num==='C2');
        return _checkBulkGender([1,3], c2).mismatches.length === 1;
      }},
    { name:'_checkBulkCapacity: 3 في C3 ممتلئ', run:async ()=>{
        // C3 فارغ في mock data الحالي — نُضيف شاغلين مؤقتاً
        ALL_DATA.push({_supabase_id:101, mina_camp:'C3', mina_bed:'C3-1'});
        ALL_DATA.push({_supabase_id:102, mina_camp:'C3', mina_bed:'C3-2'});
        ALL_DATA.push({_supabase_id:103, mina_camp:'C3', mina_bed:'C3-3'});
        const r = _checkBulkCapacity([4,5], 'C3', 'mina');
        ALL_DATA.splice(-3, 3); // cleanup
        return r.ok === false && r.available === 0;
      }},
    { name:'_checkBookingIntegrity: ناقص→split', run:async ()=>{
        return _checkBookingIntegrity([1,2]).splits.length === 1;
      }},
    { name:'_checkBookingIntegrity: توحيد إيجابي (targetField)', run:async ()=>{
        // الأعضاء غير المحدَّدين في C1، والهدف C1 → لا تفكيك
        const r = _checkBookingIntegrity([1], { targetField:'mina_camp', targetValue:'C1' });
        return r.ok === true;
      }},
    { name:'_autoAssignBedsSequential متتالي', run:async ()=>{
        const r = _autoAssignBedsSequential('C1', 'mina', [4,5]);
        return r.nonContiguous === false && r.assignments.size === 2;
      }},
    { name:'_autoAssignBedsSequential keep existing (B)', run:async ()=>{
        // 1 و 2 في C1 أصلاً بسرير صالح
        const r = _autoAssignBedsSequential('C1', 'mina', [1,2,4]);
        return r.assignments.get(1) === 'C1-1' && r.assignments.get(2) === 'C1-2';
      }},
    { name:'_expandBulkSelection helper المنطقي', run:async ()=>{
        // محاكاة: mates للـ id=1 يشمل 1,2,3
        return _getBookingMates(1).length === 3;
      }},
    { name:'Pipeline non-camp field (skip validations)', run:async ()=>{
        window._bulkPipelineAutoApprove = true;
        // mock DB.Pilgrims.bulkUpdate
        const origUpdate = window.DB?.Pilgrims?.bulkUpdate;
        if(window.DB?.Pilgrims) window.DB.Pilgrims.bulkUpdate = async () => true;
        const r = await _executeBulkPipeline([1,2,3], 'bus_status', 'ركب', { source:'test' });
        if(window.DB?.Pilgrims && origUpdate) window.DB.Pilgrims.bulkUpdate = origUpdate;
        return r.success === true && r.updated === 3;
      }},
    { name:'Pipeline gender filter → matching only', run:async ()=>{
        window._bulkPipelineAutoApprove = true;
        // نحتاج تدخّل في showActionModal — لا نختبر هنا، نفحص helper مباشرة
        const c2 = window._campsCache.find(c=>c.camp_num==='C2');
        const gc = _checkBulkGender([1,3], c2);
        return gc.mismatches.length === 1 && gc.mismatches[0].id === 1;
      }},
    { name:'Non-existent camp → early abort', run:async ()=>{
        window._bulkPipelineAutoApprove = true;
        const r = await _executeBulkPipeline([1], 'mina_camp', 'CX_NONEXISTENT', { source:'test' });
        return r.success === false && r.skipReason === 'camp_not_found';
      }},
    { name:'Empty ids → early abort', run:async ()=>{
        const r = await _executeBulkPipeline([], 'mina_camp', 'C1', { source:'test' });
        return r.success === false && r.skipReason === 'empty_ids';
      }},
    { name:'_getFieldValueForPreview يُرجع القيمة الصحيحة', run:async ()=>{
        const p = ALL_DATA.find(x => x._supabase_id === 1);
        return _getFieldValueForPreview(p, 'mina_camp') === 'C1';
      }},
    { name:'_bulkFieldLabel يُرجع تسمية عربية', run:async ()=>{
        return _bulkFieldLabel('mina_camp') === 'مخيم منى' && _bulkFieldLabel('bus_num') === 'رقم الحافلة';
      }}
  ];

  console.log('%c🧪 اختبار Bulk Pipeline', STYLE.title);
  let pass = 0, fail = 0;
  const failures = [];
  for(let i = 0; i < cases.length; i++){
    const c = cases[i];
    try {
      const ok = await c.run();
      if(ok){ pass++; console.log('%c✅ ['+(i+1)+'] '+c.name, STYLE.pass); }
      else  { fail++; failures.push({idx:i+1, name:c.name, error:'returned false'}); console.log('%c❌ ['+(i+1)+'] '+c.name, STYLE.fail); }
    } catch(e){
      fail++; failures.push({idx:i+1, name:c.name, error:e.message});
      console.log('%c❌ ['+(i+1)+'] '+c.name+': '+e.message, STYLE.fail);
    }
  }

  // استعادة
  ALL_DATA.length = 0;
  origData.forEach(p => ALL_DATA.push(p));
  window._campsCache = origCache;
  window._bulkPipelineAutoApprove = origApprove;

  const msg = fail === 0 ? '🎉 كل اختبارات Bulk Pipeline نجحت ('+pass+'/'+cases.length+')'
                          : '⚠️ فشل '+fail+' من '+cases.length+' اختبار';
  console.log('%c'+msg, fail === 0 ? STYLE.okSum : STYLE.failSum);
  if(failures.length) console.table(failures);
  return { pass, fail, total: cases.length, failures };
};

// أداة اختبار regression لـ _normalizeBedId — شغّلها في console: _testNormalizer()
window._testNormalizer = function(){
  const STYLE = {
    title:   'background:linear-gradient(135deg,#3d2000,#c8971a);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:bold',
    pass:    'color:#2e7d32;font-weight:600',
    fail:    'color:#c00;font-weight:bold',
    summary: 'padding:8px 16px;border-radius:6px;font-size:13px;font-weight:bold',
    okSum:   'background:#2e7d32;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:bold',
    failSum: 'background:#c00;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:bold'
  };
  const cases = [
    ['1',        '101',  '101-1',  'رقم مفرد'],
    ['01',       '101',  '101-1',  'رقم بصفر قائد'],
    ['101-1',    '101',  '101-1',  'صيغة كاملة صحيحة'],
    ['101-01',   '101',  '101-1',  'كاملة مع صفر قائد'],
    ['101 - 1',  '101',  '101-1',  'مسافات داخلية'],
    ['101_1',    '101',  '101-1',  'underscore'],
    ['101_01',   '101',  '101-1',  'underscore + صفر قائد'],
    ['',         '101',  '',       'نص فارغ'],
    [null,       '101',  '',       'null'],
    [undefined,  '101',  '',       'undefined'],
    ['  42  ',   '101',  '101-42', 'مسافات محيطة'],
    ['101.5',    '101',  '101-5',  'نقطة عشرية'],
    ['5',        'A-10', 'A-10-5', 'مخيم بحرف وشرطة'],
    // ⚠️ حالات cross-camp — توثّق السلوك الحالي (ليست bug في _normalizeBedId نفسها)
    // الحماية الصحيحة في موقع الاستخدام: قارن pilgrim[camp_field] === campNum قبل التطبيع
    // راجع qeBeds/bedOpts في openPilgrimQuickEdit — v15.2
    ['A-5',      'B',    'B-5',    '⚠️ cross-camp: سرير من A يُطبَّع ضد B (سلوك خطر — حُمي في موقع الاستخدام)'],
    ['101-3',    '202',  '202-3',  '⚠️ cross-camp: سرير من 101 يُطبَّع ضد 202 (نفس التحذير)']
  ];
  console.log('%c🧪 اختبار _normalizeBedId', STYLE.title);
  let pass = 0, fail = 0;
  const failures = [];
  cases.forEach(([raw, camp, expected, desc], i) => {
    const got = window._normalizeBedId(raw, camp);
    const ok = got === expected;
    if(ok){ pass++; console.log(`%c✅ [${i+1}] ${desc}`, STYLE.pass, { raw, camp, got }); }
    else  { fail++; failures.push({ idx: i+1, desc, raw, camp, expected, got });
            console.log(`%c❌ [${i+1}] ${desc}`, STYLE.fail, { raw, camp, expected, got }); }
  });
  const msg = fail === 0
    ? `🎉 كل الاختبارات نجحت (${pass}/${cases.length})`
    : `⚠️ فشل ${fail} من ${cases.length}`;
  console.log(`%c${msg}`, fail === 0 ? STYLE.okSum : STYLE.failSum);
  if(failures.length) console.table(failures);
  return { pass, fail, total: cases.length, failures };
};

// ─────────────────────────────────────────────
// Block 3 — _buildCampSelectOptions (v16.3)
// (was admin.html L9815-9853)
// ─────────────────────────────────────────────
function _buildCampSelectOptions(locCamps, fieldKey, bedKey, opts){
  opts = opts || {};
  const capFormat = opts.capFormat || 'full';
  const selected  = opts.selected;
  const excludeId = opts.excludePilgrimId;
  const sorted = _sortCamps(locCamps || []);
  let html = '';
  let lastType = null;
  sorted.forEach(camp => {
    const t = camp.camp_type || '';
    if(t !== lastType){
      if(lastType !== null) html += '</optgroup>';
      const label = (t === '' || t === 'رجال') ? '👨 رجال'
                  : t === 'نساء' ? '👩 نساء' : '👨 رجال';
      html += `<optgroup label="${label}">`;
      lastType = t;
    }
    const cNum = camp.camp_num || camp.name;
    const cap  = parseInt(camp.capacity) || 0;
    const occ  = ALL_DATA.filter(p => {
      if(p[fieldKey] !== cNum || !p[bedKey]) return false;
      if(excludeId && String(p['_supabase_id']) === String(excludeId)) return false;
      return true;
    }).length;
    const av = cap - occ;
    // ممتلئ يُعطَّل — إلا إذا كان المخيم الحالي للحاج (يُسمح ببقائه)
    let full = cap > 0 && av <= 0;
    if(full && selected === cNum) full = false;
    const style    = full ? 'color:#bbb' : '';
    const disabled = full ? 'disabled' : '';
    const sel      = (selected === cNum) ? 'selected' : '';
    const suffix   = full
      ? '⛔ ممتلئ'
      : (capFormat === 'short' ? `— متاح ${av}` : `— متاح: ${av} / ${cap}`);
    html += `<option value="${cNum}" ${sel} ${disabled} style="${style}">‎${cNum} ${suffix}</option>`;
  });
  if(lastType !== null) html += '</optgroup>';
  return html;
}