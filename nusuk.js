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

// ===== بطاقات نسك =====
window._nusukFilter = '';
const NUSUK_STATUSES = ['لم تطبع','في الطباعة','موجودة لدى الإدارة','موجودة لدى المشرف','مسلّمة للحاج'];
const NUSUK_COLORS  = ['#888','#1a5fa8','#c8971a','#7a4500','#1a7a1a'];
const NUSUK_BG      = ['#f5f5f5','#e8f0fd','#fff3e0','#fdf0e0','#e8f8e8'];

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

function initNusukBusFilter() {
  const sel = document.getElementById('nusuk-bus-filter');
  if(!sel) return;
  const buses = [...new Set(ALL_DATA.map(p=>p['رقم الحافلة الخاصة بك']).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">🚌 كل الحافلات</option>' + buses.map(b=>`<option value="${b}">حافلة ${b}</option>`).join('');
}

function filterNusuk(status) {
  window._nusukFilter = status;
  ['','لم تطبع','في الطباعة','موجودة لدى الإدارة','موجودة لدى المشرف','مسلّمة للحاج'].forEach((s,i) => {
    const ids = ['nusuk-f-all','nusuk-f-1','nusuk-f-2','nusuk-f-3','nusuk-f-4','nusuk-f-5'];
    const btn = document.getElementById(ids[i]);
    if(btn) btn.classList.toggle('hs-active', s===status);
  });
  renderNusukTable(status);
}

function renderNusukTable(filter) {
  initNusukBusFilter();
  const search = (document.getElementById('nusuk-search')?.value||'').toLowerCase();
  const busFilter = document.getElementById('nusuk-bus-filter')?.value||'';

  // إحصائيات
  const statsEl = document.getElementById('nusuk-stats');
  if(statsEl) {
    const total = ALL_DATA.length;
    statsEl.innerHTML = `<div onclick="filterNusuk('')" style="background:#fff;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer;border:2px solid ${!filter?'#c8971a':'#eee'}">
        <div style="font-size:22px;font-weight:700;color:#3d2000">${total}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">الإجمالي</div>
      </div>` +
      NUSUK_STATUSES.map((s,i) => {
        const count = ALL_DATA.filter(p=>(p['حالة بطاقة نسك']||'لم تطبع')===s).length;
        const pct = total ? Math.round(count/total*100) : 0;
        const active = filter===s;
        return `<div onclick="filterNusuk('${s}')" style="background:#fff;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer;border:2px solid ${active?NUSUK_COLORS[i]:'#eee'}">
          <div style="font-size:22px;font-weight:700;color:${NUSUK_COLORS[i]}">${count}</div>
          <div style="font-size:10px;color:#888;margin-top:2px;word-break:break-all">${s}</div>
          <div style="font-size:10px;color:#bbb;margin-top:1px">${pct}%</div>
        </div>`;
      }).join('');
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

  if(!list.length) { tbody.innerHTML=''; if(empty) empty.style.display='block'; return; }
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
        <select onchange="quickNusukUpdate('${p['_supabase_id']}',this.value,this)" style="padding:6px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:11px;font-family:inherit;background:#fff;cursor:pointer">
          ${NUSUK_STATUSES.map(s=>`<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="padding:10px 14px;text-align:center">
        ${p['نسك_sig'] ? `<button onclick="viewPilgrimAck('${p['_supabase_id']}')" style="background:#1a5fa8;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit">📄 عرض</button>` : '<span style="color:#ccc;font-size:11px">—</span>'}
      </td>
    </tr>`;
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
    <div></div>
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
    <div class="sig-box">
      <label>ممثل الشركة والختم الرسمي</label>
      ${stamp?'<img class="stamp" src="'+stamp+'" alt="ختم الشركة" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto">'  :'<div style="height:80px;border:1px dashed #ccc;border-radius:6px"></div>'}
      <div style="margin-top:6px;font-size:12px">${companyName}</div>
    </div>
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
      if(!_hasSupervisorAck(r)){ noSupAckSkipped.push(id); return false; }
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

  // v20.2: فحص القفل — superadmin يتجاوز مع bypass_lock في audit
  const bypassLock = _isNusukLocked(pilgrim) && status !== currentStatus && _isSuperAdmin();
  if(_isNusukLocked(pilgrim) && status !== currentStatus && !_isSuperAdmin()){
    if(selectEl) selectEl.value = currentStatus;
    showToast('🔒 البطاقة موقَّعة — استخدم 🔓 فتح القفل من Quick Edit', 'warning');
    return;
  }

  if(status==='موجودة لدى المشرف'||status==='مسلّمة للحاج') {
    if(status==='موجودة لدى المشرف') { openSupAck(pilgrimId, pilgrim); return; }
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

function exportNusukReport() {
  const w = window.open('','_blank');
  const dev = window._devSettings||{};
  const logo = _getLogo();
  const companyName = dev.companyName||'';
  const license = dev.license||'';
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
  const rows = ALL_DATA.map((p,i) => {
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
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير بطاقات نسك</title>
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
            <div style="font-size:14px;font-weight:bold;color:#3d2000;margin-top:4px">تقرير بطاقات نسك</div>
          </div>
          <div style="text-align:right;width:fit-content;margin:0 auto">
            <div class="dt-sub">التاريخ: ${today}</div>
            <div class="dt-sub">وقت الطباعة: ${timeStr}</div>
            <div class="dt-sub">عدد الحجاج: <strong>${ALL_DATA.length}</strong></div>
          </div>
        </div>
      </td></tr>
      <tr><th>#</th><th>اسم الحاج</th><th>رقم الهوية</th><th>رقم الجوال</th><th>الحافلة</th><th>حالة البطاقة</th><th>وقت التسليم</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}