// ═══════════════════════════════════════════════════════════════════════
// Supervisor Module — v11.5 Phase 2/5
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - State: _supPilgrims, _supAction, _supSettings, _sigPilgrimId, _sigType, _supActiveFilter, _supHistState
//   - Core: loadSupervisorPanel, renderSupActionBtns, updateSupStats, renderSupTable
//   - Actions: openSupAction, closeSupModal, supModalSearch, supRegister
//   - Signature: initSigCanvas, openSigModal, closeSigModal, clearSigCanvas, confirmSignature
//   - Quick action: openQuickAction
//   - Logout: supervisorLogout
//   - Bulk: _updateSupBulkBar, _toggleSupCheckAll, _clearSupBulkSelection, _selectUnregistered, _supBulkAction
//   - History (v18.0a): openSupHistory, closeSupHistory, _updateSupHistTabs, _loadSupHistory, _buildSupHistCard
//   - Bulk nusuk receipt: openSupBulkAck
//
// Dependencies (globals):
//   - ui-helpers.js: showToast, showActionModal, showConfirm
//   - audit.js:     _recordAudit, _buildFieldChanges, _buildPilgrimLabel, _maskSigInChanges, _esc
//   - admin.html:   _formatTimeAgo, _currentUser, _devSettings, _sessionId, window.DB, HTML elements
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// v20.3 Phase 2: استلام بطاقات نسك دفعة واحدة — جدول تفصيلي + استبعاد فردي
// ═══════════════════════════════════════════════════════════════════════
window._sigBulkExcluded = null; // Set<id>
window._sigBulkReady    = [];   // cached ready pilgrims for re-render

function openSupBulkAck() {
  const ready = window._supPilgrims.filter(p=>p.nusuk_card_status==='موجودة لدى الإدارة');
  if(!ready.length) { showToast('لا توجد بطاقات جاهزة للاستلام', 'warning'); return; }

  const dev = window._devSettings||{};
  const companyName = dev.companyName||'';
  const license = dev.license?` — ${dev.license}`:'';
  const user = window._currentUser||{};
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic');
  const timeStr = now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});

  // Reset state
  window._sigBulkExcluded = new Set();
  window._sigBulkReady    = ready;
  window._sigType         = 'bulk_nusuk';

  document.getElementById('sig-modal-title').textContent = '🪪 إقرار استلام بطاقات نسك — دفعة واحدة';
  const searchHtml = ready.length > 10
    ? `<input id="sup-bulk-search" type="text" placeholder="🔍 بحث بالاسم أو رقم الهوية..." oninput="_filterSupBulkTable()" style="width:100%;padding:8px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:12px;font-family:inherit;margin-bottom:8px;direction:rtl">`
    : '';

  document.getElementById('sig-pilgrim-name').innerHTML = `
    <div style="text-align:right;direction:rtl">
      <div style="background:#fff8e1;border-radius:8px;padding:10px 12px;font-size:11.5px;line-height:1.8;margin-bottom:10px">
        <strong>الحملة:</strong> ${_esc(companyName+license)}<br>
        <strong>المشرف:</strong> ${_esc(user.name||user.username||'—')} &nbsp;•&nbsp; <strong>الحافلة:</strong> ${_esc(String(user.group_num||'—'))}<br>
        <strong>التاريخ:</strong> ${_esc(dateStr)} &nbsp;•&nbsp; <strong>الوقت:</strong> ${_esc(timeStr)}
      </div>
      ${searchHtml}
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:8px;max-height:220px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead style="background:#f5f5f5;position:sticky;top:0;z-index:1">
            <tr>
              <th style="padding:7px 4px;font-weight:700;color:#7a4500;width:30px;border-bottom:1px solid #e0e0e0">#</th>
              <th style="padding:7px 8px;font-weight:700;color:#7a4500;text-align:right;border-bottom:1px solid #e0e0e0">اسم الحاج</th>
              <th style="padding:7px 8px;font-weight:700;color:#7a4500;width:92px;text-align:center;border-bottom:1px solid #e0e0e0;direction:ltr">الهوية</th>
              <th style="padding:7px 4px;font-weight:700;color:#c00;width:40px;text-align:center;border-bottom:1px solid #e0e0e0" title="استبعاد">—</th>
            </tr>
          </thead>
          <tbody id="sup-bulk-tbody"></tbody>
        </table>
      </div>
      <div id="sup-bulk-counter" style="background:#fff3e0;border:1px solid #c8971a;border-radius:8px;padding:8px 12px;font-size:12px;color:#7a4500;text-align:center;font-weight:700;margin-bottom:8px"></div>
      <div style="font-size:11px;color:#666;text-align:center;line-height:1.6;margin-bottom:4px">
        <em>أقر بأنني استلمت البطاقات المذكورة أعلاه لتوزيعها على الحجاج حسب الكشوفات المعتمدة.</em>
      </div>
    </div>`;
  _renderSupBulkTable();
  clearSigCanvas();
  document.getElementById('sig-modal').style.display = 'flex';
}

function _renderSupBulkTable() {
  const ready    = window._sigBulkReady || [];
  const excluded = window._sigBulkExcluded || new Set();
  const q = (document.getElementById('sup-bulk-search')?.value||'').toLowerCase().trim();
  const tbody = document.getElementById('sup-bulk-tbody');
  if(!tbody) return;

  const filtered = q
    ? ready.filter(p => (p.name||'').toLowerCase().includes(q) || (p.id_num||'').includes(q))
    : ready;

  tbody.innerHTML = filtered.map((p,i) => {
    const isExcl = excluded.has(p.id);
    return `<tr style="border-bottom:1px solid #f5f5f5;${isExcl?'background:#fafafa;opacity:0.55':''}">
      <td style="padding:7px 4px;text-align:center;color:#999;font-size:11px">${i+1}</td>
      <td style="padding:7px 8px;font-weight:600;color:${isExcl?'#999':'#333'};${isExcl?'text-decoration:line-through':''}">${_esc(p.name||'—')}</td>
      <td style="padding:7px 8px;text-align:center;color:#666;font-size:11px;direction:ltr;${isExcl?'text-decoration:line-through':''}">${_esc(p.id_num||'—')}</td>
      <td style="padding:7px 4px;text-align:center">
        ${isExcl
          ? `<button onclick="_toggleSupBulkExcluded('${p.id}')" title="إعادة" style="background:#1a7a1a;color:#fff;border:none;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:13px;font-family:inherit;line-height:1">↩</button>`
          : `<button onclick="_toggleSupBulkExcluded('${p.id}')" title="استبعاد" style="background:#fde8e8;color:#c00;border:1.5px solid #c00;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:14px;font-family:inherit;line-height:1;font-weight:700">✕</button>`}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#888;font-size:12px">لا توجد نتائج مطابقة</td></tr>`;

  _updateSupBulkCounter();
}

function _toggleSupBulkExcluded(id) {
  const excluded = window._sigBulkExcluded;
  if(!excluded) return;
  if(excluded.has(id)) excluded.delete(id);
  else                 excluded.add(id);
  _renderSupBulkTable();
}

function _filterSupBulkTable() {
  _renderSupBulkTable();
}

function _updateSupBulkCounter() {
  const ready    = window._sigBulkReady || [];
  const excluded = window._sigBulkExcluded || new Set();
  const included = ready.length - excluded.size;
  const counter  = document.getElementById('sup-bulk-counter');
  if(!counter) return;

  if(included === 0){
    counter.style.background = '#fde8e8';
    counter.style.borderColor = '#c00';
    counter.style.color = '#c00';
    counter.innerHTML = `⚠️ يجب اختيار بطاقة واحدة على الأقل`;
  } else {
    counter.style.background = '#fff3e0';
    counter.style.borderColor = '#c8971a';
    counter.style.color = '#7a4500';
    counter.innerHTML = `✓ سيتم توقيع <strong>${included}</strong> بطاقة${excluded.size?` &nbsp;•&nbsp; مستبعدة: <strong>${excluded.size}</strong>`:''}`;
  }
}


// ===== واجهة مشرف المجموعة =====
window._supPilgrims = [];
window._supAction = '';
window._supSettings = { nusukAvailable: false, braceletAvailable: false };
window._sigPilgrimId = null;
window._sigType = '';

async function loadSupervisorPanel(user) {
  document.getElementById('sup-name').textContent = user.name||user.username;
  document.getElementById('sup-bus').textContent = '🚌 حافلة رقم: ' + (user.group_num||'—');

  _applyDevLogo();
  _applyCompanyName(_getCompanyName());

  // جلب إعدادات الأسوارة من settings
  try {
    const brVal = await window.DB.Settings.get('bracelet_available');
    window._supSettings.braceletAvailable = brVal === 'true';
  } catch(e) {}

  // جلب حجاج الحافلة
  try {
    const all = await window.DB.Pilgrims.getAll();
    window._supPilgrims = all.filter(p => p.bus_num === user.group_num);
  } catch(e) { window._supPilgrims = []; }

  // إعداد أزرار العمليات
  renderSupActionBtns();
  // v20.3: إظهار/إخفاء أعمدة الجدول — أي نشاط نسك يُظهر العمود
  const hasNusuk = window._supPilgrims.some(p=>['موجودة لدى الإدارة','موجودة لدى المشرف','مسلّمة للحاج'].includes(p.nusuk_card_status));
  if(document.getElementById('sup-th-nusuk')) document.getElementById('sup-th-nusuk').style.display = hasNusuk?'':'none';
  if(document.getElementById('sup-th-bracelet')) document.getElementById('sup-th-bracelet').style.display = window._supSettings.braceletAvailable?'':'none';

  updateSupStats();
  renderSupTable();
  initSigCanvas();
}

function renderSupActionBtns() {
  const container = document.getElementById('sup-action-btns');
  if(!container) return;
  // v20.3: فصل منطقي — استلام من الإدارة (📦) مقابل تسليم للحاج (🪪)
  const readyPilgrims   = window._supPilgrims.filter(p=>p.nusuk_card_status==='موجودة لدى الإدارة');
  const hasNusukReady   = readyPilgrims.length > 0;
  const hasNusukWithSup = window._supPilgrims.some(p=>p.nusuk_card_status==='موجودة لدى المشرف');
  const readyCount      = readyPilgrims.length;
  const hasBracelet     = window._supSettings.braceletAvailable;
  const cols = 2 + (hasNusukWithSup?1:0) + (hasNusukReady?1:0) + (hasBracelet?1:0);
  container.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  container.innerHTML = `
    <button onclick="openSupAction('bus')" style="background:#1a7a1a;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🚌 إركاب</button>
    <button onclick="openSupAction('camp')" style="background:#1a5fa8;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🏕️ وصول المخيم</button>
    ${hasNusukWithSup?`<button onclick="openSupAction('nusuk')" style="background:#7a4500;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🪪 بطاقة نسك</button>`:''}
    ${hasNusukReady?`<button onclick="openSupBulkAck()" style="position:relative;background:#c8971a;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📦 استلام دفعة<span class="sup-badge-new" aria-label="${readyCount} بطاقة جاهزة">${readyCount}</span></button>`:''}
    ${hasBracelet?`<button onclick="openSupAction('bracelet')" style="background:#444;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🚆 أسوارة</button>`:''}
  `;
}

function updateSupStats() {
  const p = window._supPilgrims;
  if(document.getElementById('sup-total')) document.getElementById('sup-total').textContent = p.length;
  if(document.getElementById('sup-boarded')) document.getElementById('sup-boarded').textContent = p.filter(x=>x.bus_status==='ركب').length;
  if(document.getElementById('sup-arrived')) document.getElementById('sup-arrived').textContent = p.filter(x=>x.camp_status==='حضر').length;
  if(document.getElementById('sup-nusuk')) document.getElementById('sup-nusuk').textContent = p.filter(x=>x.nusuk_card_status==='مسلّمة للحاج').length;
  if(document.getElementById('sup-bracelet')) document.getElementById('sup-bracelet').textContent = p.filter(x=>x.bracelet_time).length;
}

function renderSupTable() {
  const q = (document.getElementById('sup-search')?.value||'').toLowerCase();
  // v20.3: أي نشاط نسك يُظهر العمود (يشمل 'موجودة لدى الإدارة' أيضاً)
  const hasNusuk = window._supPilgrims.some(p=>['موجودة لدى الإدارة','موجودة لدى المشرف','مسلّمة للحاج'].includes(p.nusuk_card_status));
  const hasBracelet = window._supSettings.braceletAvailable;

  // v18.0b: إظهار/إخفاء الفلاتر الشرطية
  const nChip = document.querySelector('.sup-filter-nusuk');
  const bChip = document.querySelector('.sup-filter-bracelet');
  if(nChip) nChip.style.display = hasNusuk    ? 'flex' : 'none';
  if(bChip) bChip.style.display = hasBracelet ? 'flex' : 'none';

  // v18.0b: فلترة بالبحث + الفلتر النشط
  let list = window._supPilgrims.filter(p=>!q||(p.name||'').toLowerCase().includes(q)||(p.id_num||'').includes(q));
  const f = window._supActiveFilter;
  if(f){
    list = list.filter(p => {
      if(f === 'unboarded')    return p.bus_status  !== 'ركب';
      if(f === 'not_arrived')  return p.camp_status !== 'حضر';
      if(f === 'no_nusuk')     return p.nusuk_card_status !== 'مسلّمة للحاج';
      if(f === 'no_bracelet')  return !p.bracelet_time;
      return true;
    });
  }

  const tbody = document.getElementById('sup-tbody');
  const empty = document.getElementById('sup-empty');
  if(!list.length){
    tbody.innerHTML='';
    empty.style.display='block';
    empty.textContent = f ? '📭 لا يوجد حجاج مطابقون للفلتر' : 'لا يوجد حجاج في هذه الحافلة';
    _countSupFilters();
    return;
  }
  empty.style.display='none';
  tbody.innerHTML = list.map(p => {
    const boarded = p.bus_status==='ركب';
    const arrived = p.camp_status==='حضر';
    const nusukDelivered = p.nusuk_card_status==='مسلّمة للحاج';
    const nusukReady = p.nusuk_card_status==='موجودة لدى المشرف';
    const braceletDone = !!p.bracelet_time;
    return `<tr style="border-bottom:1px solid #f0e8d0">
      <td style="padding:8px 4px;text-align:center"><input type="checkbox" class="sup-row-check" data-id="${p.id}" onchange="_updateSupBulkBar()" style="width:18px;height:18px;cursor:pointer;accent-color:#c8971a"></td>
      <td style="padding:8px;font-size:12px;font-weight:600">${p.name||'—'}<br><span style="font-size:10px;color:#999;font-weight:400">${p.id_num||''}</span></td>
      <td style="padding:8px;text-align:center"><span style="background:${boarded?'#e8f8e8':'#fde8e8'};color:${boarded?'#1a7a1a':'#c00'};padding:3px 8px;border-radius:20px;font-size:11px">${boarded?'✅':'⏳'}</span></td>
      <td style="padding:8px;text-align:center"><span style="background:${arrived?'#e8f0fd':'#fde8e8'};color:${arrived?'#1a5fa8':'#c00'};padding:3px 8px;border-radius:20px;font-size:11px">${arrived?'✅':'⏳'}</span></td>
      ${hasNusuk?`<td style="padding:8px;text-align:center"><span style="background:${nusukDelivered?'#fff3e0':'#fde8e8'};color:${nusukDelivered?'#7a4500':'#c00'};padding:3px 8px;border-radius:20px;font-size:11px">${nusukDelivered?'✅':nusukReady?'⏳':'—'}</span></td>`:''}
      ${hasBracelet?`<td style="padding:8px;text-align:center"><span style="background:${braceletDone?'#f0f0f0':'#fde8e8'};color:${braceletDone?'#333':'#c00'};padding:3px 8px;border-radius:20px;font-size:11px">${braceletDone?'✅':'⏳'}</span></td>`:''}
      <td style="padding:8px;text-align:center">
        <button onclick="openQuickAction('${p.id}')" style="background:#c8971a;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit">✏️</button>
      </td>
    </tr>`;
  }).join('');

  _countSupFilters();
  _updateSupBulkBar();
}

// v18.0b: حساب counter لكل فلتر (يُستدعى بعد كل renderSupTable)
function _countSupFilters(){
  const p = window._supPilgrims || [];
  const counts = {
    unboarded:   p.filter(x => x.bus_status  !== 'ركب').length,
    not_arrived: p.filter(x => x.camp_status !== 'حضر').length,
    no_nusuk:    p.filter(x => x.nusuk_card_status !== 'مسلّمة للحاج').length,
    no_bracelet: p.filter(x => !x.bracelet_time).length
  };
  document.querySelectorAll('.sup-filter-chip').forEach(btn => {
    const f = btn.dataset.filter;
    const c = btn.querySelector('.sup-filter-count');
    if(c) c.textContent = counts[f] != null ? counts[f] : 0;
  });
}

function openSupAction(action) {
  window._supAction = action;
  const titles = { bus:'🚌 تسجيل إركاب الحافلة', camp:'🏕️ تسجيل وصول المخيم', nusuk:'🪪 تسليم بطاقة نسك', bracelet:'🚆 تسليم أسوارة القطار' };
  document.getElementById('sup-modal-title').textContent = titles[action]||'';
  document.getElementById('sup-modal-search').value = '';
  const modal = document.getElementById('sup-modal');
  modal.style.display = 'flex';
  supModalSearch();
}

function closeSupModal() { document.getElementById('sup-modal').style.display = 'none'; }

function supModalSearch() {
  const q = document.getElementById('sup-modal-search').value.toLowerCase();
  const action = window._supAction;
  let list = _filterPilgrimsByQuery(q, { source: window._supPilgrims, limit: 500 });

  // فلترة حسب النوع
  if(action==='nusuk') list = list.filter(p=>p.nusuk_card_status==='موجودة لدى المشرف'||p.nusuk_card_status==='مسلّمة للحاج');

  const el = document.getElementById('sup-modal-results');
  if(!list.length){ el.innerHTML = '<div class="plc-empty">لا يوجد نتائج</div>'; return; }

  el.innerHTML = list.map(p => {
    let done, label, color;
    if(action==='bus'){        done=p.bus_status==='ركب';              label=done?'✅ ركب':'🚌 تسجيل إركاب';   color=done?'#888':'#1a7a1a'; }
    else if(action==='camp'){  done=p.camp_status==='حضر';             label=done?'✅ حضر':'🏕️ تسجيل وصول';   color=done?'#888':'#1a5fa8'; }
    else if(action==='nusuk'){ done=p.nusuk_card_status==='مسلّمة للحاج'; label=done?'✅ مُسلَّمة':'🪪 تسليم + توقيع'; color=done?'#888':'#7a4500'; }
    else if(action==='bracelet'){ done=!!p.bracelet_time;              label=done?'✅ مُسلَّمة':'🚆 تسليم + توقيع'; color=done?'#888':'#444'; }
    const needsSig = (action==='nusuk'||action==='bracelet') && !done;
    return _buildPilgrimCard(p, {
      showFields: ['id'],
      size: 'compact',
      divider: true,
      action: {
        label,
        onclick: needsSig ? `openSigModal('${p.id}','${action}')` : `supRegister('${p.id}','${action}')`,
        color,
        disabled: done,
        ariaLabel: label + ' — ' + (p.name||'الحاج')
      }
    });
  }).join('');
}

async function supRegister(id, action) {
  const field = action==='bus'?'bus_status':action==='camp'?'camp_status':null;
  const value = action==='bus'?'ركب':action==='camp'?'حضر':null;
  if(!field) return;
  const p = window._supPilgrims.find(x=>String(x.id)===String(id));
  const before = { [field]: p ? (p[field] ?? null) : null };
  try {
    await window.DB.Pilgrims.update(parseInt(id), {[field]:value});
    if(p) p[field]=value;
    // v17.2: audit
    const changes = _buildFieldChanges(before, { [field]: value });
    if(changes){
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(id),
        entity_label: _buildPilgrimLabel(p),
        field_changes: changes,
        metadata: { source: 'supervisor_' + action }
      });
    }
    showToast('تم التسجيل', 'success');
    updateSupStats(); renderSupTable(); supModalSearch();
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

// ===== التوقيع =====
function initSigCanvas() {
  const canvas = document.getElementById('sig-canvas');
  if(!canvas || canvas._sigInit) return;
  canvas._sigInit = true;
  let drawing = false, lastX=0, lastY=0;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';

  const getPos = e => {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return [(src.clientX - r.left)*scaleX, (src.clientY - r.top)*scaleY];
  };

  canvas.addEventListener('mousedown', e=>{drawing=true;[lastX,lastY]=getPos(e);});
  canvas.addEventListener('mousemove', e=>{if(!drawing)return;const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();[lastX,lastY]=[x,y];});
  canvas.addEventListener('mouseup', ()=>drawing=false);
  canvas.addEventListener('touchstart', e=>{e.preventDefault();drawing=true;[lastX,lastY]=getPos(e);},{passive:false});
  canvas.addEventListener('touchmove', e=>{e.preventDefault();if(!drawing)return;const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();[lastX,lastY]=[x,y];},{passive:false});
  canvas.addEventListener('touchend', ()=>drawing=false);
}

function openSigModal(pilgrimId, type) {
  window._sigPilgrimId = pilgrimId;
  window._sigType = type;
  const p = window._supPilgrims.find(x=>String(x.id)===String(pilgrimId));
  const titles = { nusuk:'🪪 تسليم بطاقة نسك', bracelet:'🚆 تسليم أسوارة القطار' };
  document.getElementById('sig-modal-title').textContent = titles[type]||'';
  document.getElementById('sig-pilgrim-name').textContent = (p?.name||'—') + ' — ' + (p?.id_num||'—');
  clearSigCanvas();
  document.getElementById('sig-modal').style.display = 'flex';
  closeSupModal();
}

function closeSigModal() { document.getElementById('sig-modal').style.display = 'none'; }

function clearSigCanvas() {
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function confirmSignature() {
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  const blank = document.createElement('canvas');
  blank.width = canvas.width; blank.height = canvas.height;
  if(canvas.toDataURL() === blank.toDataURL()) {
    showToast('يرجى التوقيع أولاً', 'warning'); return;
  }

  const id = window._sigPilgrimId;
  const type = window._sigType;
  const p = window._supPilgrims.find(x=>String(x.id)===String(id));
  const now = new Date();
  const timeStr = now.toLocaleString('ar-SA');
  const user = window._currentUser;

  try {
    // رفع التوقيع إلى Supabase Storage
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.7));
    const fileName = `${type}_${id}_${Date.now()}.png`;
    const { data, error } = await window.supabase.storage.from('signatures').upload(fileName, blob, { upsert: true });
    if(error) throw error;
    const { data: urlData } = window.supabase.storage.from('signatures').getPublicUrl(fileName);
    const sigUrl = urlData.publicUrl;

    // حفظ في Supabase
    let updates = {};
    if(type==='nusuk') { updates = { nusuk_card_status: 'مسلّمة للحاج', nusuk_card_sig: sigUrl, nusuk_card_time: timeStr }; }
    else if(type==='bracelet') { updates = { bracelet_sig: sigUrl, bracelet_time: timeStr }; }
    else if(type==='bulk_nusuk') {
      // v20.3: استخراج ids من ready - excluded (بدل _sigBulkIds الثابتة)
      const ready    = window._sigBulkReady || [];
      const excluded = window._sigBulkExcluded || new Set();
      let ids = ready.filter(p => !excluded.has(p.id)).map(p => p.id);
      if(!ids.length) { showToast('⚠️ يجب اختيار بطاقة واحدة على الأقل', 'warning'); return; }

      // v20.4: فحص عزل دفاعي — استبعاد أي حاج لا ينتمي لحافلة المشرف
      const supBus = user && user.group_num != null ? String(user.group_num) : null;
      const isolationSkipped = [];
      if(supBus){
        ids = ids.filter(bid => {
          const bp = window._supPilgrims.find(x=>String(x.id)===String(bid));
          const bpBus = bp && bp.bus_num != null ? String(bp.bus_num) : null;
          if(bpBus !== supBus){
            isolationSkipped.push(String(bid));
            console.warn('[isolation] pilgrim', bid, 'bus:', bpBus, '!= supervisor bus:', supBus);
            return false;
          }
          return true;
        });
      }
      if(!ids.length){
        showToast('🔒 خطأ عزل: لا يوجد حاج من حافلتك في الدفعة', 'error');
        return;
      }

      // v17.2: snapshot قبل التحديث لكل حاج
      const beforeMap = new Map();
      ids.forEach(bid => {
        const bp = window._supPilgrims.find(x=>String(x.id)===String(bid));
        beforeMap.set(String(bid), {
          nusuk_card_status: bp ? (bp.nusuk_card_status ?? null) : null,
          nusuk_card_sig:    bp ? (bp.nusuk_card_sig    ?? null) : null,
          nusuk_card_time:   bp ? (bp.nusuk_card_time   ?? null) : null
        });
      });
      const bulkUpdates = { nusuk_card_status: 'موجودة لدى المشرف', nusuk_card_sig: sigUrl, nusuk_card_time: timeStr };
      await Promise.all(ids.map(bid => window.DB.Pilgrims.update(parseInt(bid), bulkUpdates)));
      ids.forEach(bid => { const bp=window._supPilgrims.find(x=>String(x.id)===String(bid)); if(bp){bp.nusuk_card_status='موجودة لدى المشرف';bp.nusuk_card_sig=sigUrl;bp.nusuk_card_time=timeStr;} });

      // v17.2: audit — N صفوف فردية + 1 صف جماعي + bulk_session
      // v20.3: bus_num + إحصائيات الاستبعاد
      const bulkSessionId = (crypto.randomUUID && crypto.randomUUID())
        || ('bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2,10));
      const bulkMeta = {
        source: 'supervisor_bulk_receive',
        bulk_session: bulkSessionId,
        bulk_target_field: 'nusuk_card_status',
        bulk_target_value: 'موجودة لدى المشرف',
        bulk_total_count: ids.length,
        bus_num: user && user.group_num != null ? String(user.group_num) : null,
        total_included: ids.length
      };
      if(excluded.size > 0){
        bulkMeta.total_excluded    = excluded.size;
        bulkMeta.excluded_pilgrims = [...excluded].map(String);
      }
      if(isolationSkipped.length > 0){
        bulkMeta.isolation_skipped   = true;
        bulkMeta.isolation_mismatch  = isolationSkipped;
      }
      ids.forEach(bid => {
        const bp = window._supPilgrims.find(x=>String(x.id)===String(bid));
        const bBefore = beforeMap.get(String(bid)) || {};
        const changes = _maskSigInChanges(_buildFieldChanges(bBefore, bulkUpdates));
        if(!changes) return;
        _recordAudit({
          action_type:  'update',
          entity_type:  'pilgrim',
          entity_id:    String(bid),
          entity_label: _buildPilgrimLabel(bp),
          field_changes: changes,
          metadata: bulkMeta
        });
      });
      _recordAudit({
        action_type:  'bulk_update',
        entity_type:  'pilgrim',
        entity_id:    null,
        entity_label: 'استلام جماعي: ' + ids.length + ' بطاقة نسك',
        field_changes: { nusuk_card_status: { before: null, after: 'موجودة لدى المشرف', note: 'bulk' } },
        bulk_ids:   ids,
        bulk_count: ids.length,
        metadata: bulkMeta
      });

      closeSigModal();
      const exclMsg = excluded.size ? ` • استبعاد يدوي: ${excluded.size}` : '';
      const isoMsg  = isolationSkipped.length ? ` • عزل تلقائي: ${isolationSkipped.length}` : '';
      showToast(`✅ تم تسجيل استلام ${ids.length} بطاقة${exclMsg}${isoMsg}`, isolationSkipped.length ? 'warning' : 'success');
      // v20.3: تنظيف state
      window._sigBulkReady = [];
      window._sigBulkExcluded = null;
      updateSupStats(); renderSupTable(); renderSupActionBtns();
      return;
    }

    // v20.4: فحص عزل دفاعي — single sig (nusuk / bracelet)
    const supBus = user && user.group_num != null ? String(user.group_num) : null;
    const pBus   = p && p.bus_num != null ? String(p.bus_num) : null;
    if(supBus && pBus !== supBus){
      console.warn('[isolation] single sig blocked — pilgrim', id, 'bus:', pBus, '!= supervisor bus:', supBus);
      showToast('🔒 خطأ عزل: هذا الحاج ليس من حافلتك', 'error');
      return;
    }

    // v17.2: snapshot لقيم الحقول المُحدَّثة (single nusuk / bracelet)
    const auditKeys = Object.keys(updates);
    const before = {};
    auditKeys.forEach(k => { before[k] = p ? (p[k] ?? null) : null; });

    await window.DB.Pilgrims.update(parseInt(id), updates);
    if(p) Object.assign(p, updates);

    // v17.2: audit (مع قناع التوقيع)
    const changes = _maskSigInChanges(_buildFieldChanges(before, updates));
    if(changes){
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(id),
        entity_label: _buildPilgrimLabel(p),
        field_changes: changes,
        metadata: { source: type==='nusuk' ? 'supervisor_nusuk' : 'supervisor_bracelet' }
      });
    }

    closeSigModal();
    showToast('تم تسجيل الاستلام بالتوقيع', 'success');
    updateSupStats(); renderSupTable();
  } catch(e) { showToast('خطأ في الحفظ: '+e.message, 'error'); }
}

function openQuickAction(id) {
  const p = window._supPilgrims.find(x=>String(x.id)===String(id));
  if(!p) return;
  document.getElementById('sup-modal-search').value = p.name||'';
  openSupAction('bus');
}

function supervisorLogout() {
  document.getElementById('supervisor-panel').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  window._supPilgrims = [];
  window._currentUser = null;
}

// ═══════════════════════════════════════════════════════════════════════
// ===== v18.0c: تسجيل جماعي من الجدول =====
// ═══════════════════════════════════════════════════════════════════════

function _updateSupBulkBar(){
  const checked = document.querySelectorAll('.sup-row-check:checked');
  const bar = document.getElementById('sup-bulk-bar');
  const countEl = document.getElementById('sup-bulk-count');
  if(countEl) countEl.textContent = checked.length;
  if(bar) bar.style.display = checked.length > 0 ? 'block' : 'none';
  const all = document.querySelectorAll('.sup-row-check');
  const allEl = document.getElementById('sup-check-all');
  if(allEl && all.length > 0){
    allEl.checked = checked.length === all.length;
    allEl.indeterminate = checked.length > 0 && checked.length < all.length;
  } else if(allEl){
    allEl.checked = false; allEl.indeterminate = false;
  }
}

function _toggleSupCheckAll(checked){
  document.querySelectorAll('.sup-row-check').forEach(cb => { cb.checked = checked; });
  _updateSupBulkBar();
}

function _clearSupBulkSelection(){
  document.querySelectorAll('.sup-row-check').forEach(cb => cb.checked = false);
  const allEl = document.getElementById('sup-check-all');
  if(allEl){ allEl.checked = false; allEl.indeterminate = false; }
  _updateSupBulkBar();
}

function _selectUnregistered(action){
  _clearSupBulkSelection();
  document.querySelectorAll('.sup-row-check').forEach(cb => {
    const pid = cb.dataset.id;
    const p = (window._supPilgrims || []).find(x => String(x.id) === String(pid));
    if(!p) return;
    let shouldSelect = false;
    if(action === 'bus')       shouldSelect = p.bus_status  !== 'ركب';
    else if(action === 'camp') shouldSelect = p.camp_status !== 'حضر';
    if(shouldSelect) cb.checked = true;
  });
  _updateSupBulkBar();
}

async function _supBulkAction(action){
  const checked = [...document.querySelectorAll('.sup-row-check:checked')].map(cb => cb.dataset.id);
  if(!checked.length){ showToast('حدّد حاجاً واحداً على الأقل', 'warning'); return; }

  const labels = {
    bus:  { icon:'🚌', action:'تسجيل إركاب', value:'ركب', field:'bus_status' },
    camp: { icon:'🏕️', action:'تسجيل وصول', value:'حضر', field:'camp_status' }
  };
  const L = labels[action];
  if(!L) return;

  const confirmed = await showConfirm(
    `سيتم ${L.action} لـ ${checked.length} حاج.`,
    `${L.icon} تأكيد العملية`,
    'نعم، نفّذ',
    '#c8971a',
    L.icon
  );
  if(!confirmed) return;

  showToast(`جاري ${L.action}...`, 'info');

  const bulkSession = (crypto.randomUUID && crypto.randomUUID())
    || ('bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2,10));

  let ok = 0, fail = 0;
  for(const pid of checked){
    const p = (window._supPilgrims || []).find(x => String(x.id) === String(pid));
    const before = { [L.field]: p ? (p[L.field] ?? null) : null };
    const updates = { [L.field]: L.value };
    try {
      await window.DB.Pilgrims.update(parseInt(pid), updates);
      if(p) p[L.field] = L.value;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(pid),
        entity_label: _buildPilgrimLabel(p || { name: '—', id_num: pid }),
        field_changes: _buildFieldChanges(before, updates),
        metadata: {
          source: 'supervisor_' + action,
          bulk_session: bulkSession,
          bulk_target_field: L.field,
          bulk_target_value: L.value,
          bulk_total_count: checked.length,
          ui_path: 'supervisor_table_bulk'
        }
      });
      ok++;
    } catch(e){
      fail++;
      console.error('[sup-bulk]', 'pilgrim_id:'+pid, 'error:'+e.message);
    }
  }

  // صف ملخّص جماعي (لو نجح واحد على الأقل)
  if(ok > 0){
    _recordAudit({
      action_type:  'bulk_update',
      entity_type:  'pilgrim',
      entity_id:    null,
      entity_label: `${L.icon} ${L.action} جماعي — ${ok} حاج`,
      field_changes: { [L.field]: { before: null, after: L.value, note: 'bulk' } },
      bulk_ids:   checked,
      bulk_count: ok,
      metadata: {
        source: 'supervisor_' + action,
        bulk_session: bulkSession,
        bulk_target_field: L.field,
        bulk_target_value: L.value,
        bulk_total_count: ok,
        ui_path: 'supervisor_table_bulk'
      }
    });
  }

  _clearSupBulkSelection();
  renderSupTable();
  updateSupStats();

  if(fail === 0) showToast(`تم ${L.action} بنجاح لـ ${ok} حاج`, 'success');
  else           showToast(`نجح ${ok} • فشل ${fail} (راجع console)`, 'warning');
}

// ═══════════════════════════════════════════════════════════════════════
// ===== v18.0b: فلاتر ذكية (state + event listener) =====
// ═══════════════════════════════════════════════════════════════════════

window._supActiveFilter = null;

document.addEventListener('click', (e) => {
  const chip = e.target && e.target.closest ? e.target.closest('.sup-filter-chip') : null;
  if(!chip) return;
  const filter = chip.dataset.filter;
  if(!filter) return;
  if(window._supActiveFilter === filter){
    window._supActiveFilter = null;
    chip.classList.remove('sup-filter-active');
  } else {
    document.querySelectorAll('.sup-filter-chip').forEach(b => b.classList.remove('sup-filter-active'));
    chip.classList.add('sup-filter-active');
    window._supActiveFilter = filter;
  }
  if(typeof renderSupTable === 'function') renderSupTable();
});

// ═══════════════════════════════════════════════════════════════════════
// ===== v18.0a: تاريخ عمليات المشرف (Supervisor History) =====
// ═══════════════════════════════════════════════════════════════════════

window._supHistState = { period: 'today', data: [] };

async function openSupHistory(){
  document.getElementById('sup-history-modal').style.display = 'flex';
  window._supHistState.period = 'today';
  _updateSupHistTabs();
  await _loadSupHistory();
}

function closeSupHistory(){
  document.getElementById('sup-history-modal').style.display = 'none';
}

function _updateSupHistTabs(){
  document.querySelectorAll('.sup-hist-tab').forEach(btn => {
    if(btn.dataset.period === window._supHistState.period) btn.classList.add('sup-hist-tab-active');
    else btn.classList.remove('sup-hist-tab-active');
  });
}

async function _loadSupHistory(){
  const username = window._currentUser?.username;
  if(!username){
    document.getElementById('sup-hist-results').innerHTML = '<div style="text-align:center;padding:40px;color:#c00">لا يمكن تحديد المستخدم</div>';
    return;
  }

  const loading = document.getElementById('sup-hist-loading');
  const results = document.getElementById('sup-hist-results');
  const empty   = document.getElementById('sup-hist-empty');
  const counter = document.getElementById('sup-hist-counter');

  loading.style.display = 'block';
  results.innerHTML = '';
  empty.style.display = 'none';
  counter.textContent = '';

  try {
    const filters = { user_id: username, pageSize: 100, page: 1 };
    const now = new Date();
    if(window._supHistState.period === 'today'){
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      filters.dateFrom = todayStart.toISOString();
    } else if(window._supHistState.period === 'yesterday'){
      const yest = new Date(); yest.setDate(yest.getDate() - 1); yest.setHours(0,0,0,0);
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      filters.dateFrom = yest.toISOString();
      filters.dateTo   = todayStart.toISOString();
    } else if(window._supHistState.period === 'week'){
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0);
      filters.dateFrom = weekAgo.toISOString();
    }
    // 'all' → بدون نطاق

    const result = await window.DB.Audit.getAll(filters);
    const data = result.data || [];
    window._supHistState.data = data;

    loading.style.display = 'none';
    counter.textContent = data.length + ' عملية';

    if(!data.length){
      empty.style.display = 'block';
      return;
    }
    results.innerHTML = data.map(_buildSupHistCard).join('');
  } catch(e){
    console.error('[sup-history]', e);
    loading.style.display = 'none';
    results.innerHTML = '<div style="text-align:center;padding:40px;color:#c00">❌ خطأ في التحميل: '+((e&&e.message)||'')+'</div>';
  }
}

function _buildSupHistCard(entry){
  const source = (entry.metadata && entry.metadata.source) || 'unknown';
  const labels = {
    supervisor_bus:          { icon:'🚌', label:'إركاب',              color:'#1a7a1a' },
    supervisor_camp:         { icon:'🏕️', label:'وصول مخيم',          color:'#1a5fa8' },
    supervisor_nusuk:        { icon:'🪪', label:'تسليم بطاقة نسك',    color:'#7a4500' },
    supervisor_bracelet:     { icon:'🚆', label:'تسليم أسوارة',       color:'#444'    },
    supervisor_bulk_receive: { icon:'📦', label:'استلام جماعي',        color:'#c8971a' }
  };
  const s = labels[source] || { icon:'📝', label:'عملية', color:'#888' };
  const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
  const time = _formatTimeAgo(ts);
  const entityLabel = entry.entity_label || (entry.bulk_count ? (entry.bulk_count + ' حاج') : '—');

  return '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:12px;margin-bottom:8px;border-right:4px solid ' + s.color + '">'
       +   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
       +     '<div style="font-weight:700;color:' + s.color + ';font-size:14px">' + s.icon + ' ' + s.label + '</div>'
       +     '<div style="font-size:11px;color:#888">' + _esc(time) + '</div>'
       +   '</div>'
       +   '<div style="font-size:13px;color:#333">' + _esc(entityLabel) + '</div>'
       + '</div>';
}

// v18.0a: event delegation للـ tabs
document.addEventListener('click', (e) => {
  const t = e.target;
  if(t && t.classList && t.classList.contains('sup-hist-tab')){
    const period = t.dataset.period;
    if(period && period !== window._supHistState.period){
      window._supHistState.period = period;
      _updateSupHistTabs();
      _loadSupHistory();
    }
  }
});
