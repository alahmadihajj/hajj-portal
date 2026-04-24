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
  const ready = window._supPilgrims.filter(p=>p.nusuk_card_status==='لدى الإدارة');
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

  document.getElementById('sig-modal-title').textContent = '';  // إخلاء header المودال
  const searchHtml = ready.length > 10
    ? `<input id="sup-bulk-search" type="text" placeholder="🔍 بحث بالاسم أو رقم الهوية..." oninput="_filterSupBulkTable()" style="width:100%;padding:8px 10px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:12px;font-family:inherit;margin-bottom:8px;direction:rtl">`
    : '';

  document.getElementById('sig-pilgrim-name').innerHTML = `
    <div style="text-align:right;direction:rtl">
      <div style="text-align:center;padding:14px 10px 10px;border-bottom:2px solid #c8971a;margin-bottom:14px">
        ${(typeof _buildPrintLogoHTML === 'function') ? _buildPrintLogoHTML(60) : ((window._devSettings?.logo) ? `<img src="${window._devSettings.logo}" alt="شعار" style="max-width:70px;max-height:70px;object-fit:contain;margin-bottom:6px">` : '')}
        <div style="font-size:15px;font-weight:800;color:#3d2000;margin-top:4px">${(window._devSettings?.companyName) || 'شركة الحج'}</div>
        ${(window._devSettings?.license) ? `<div style="font-size:11px;color:#888;margin-top:2px">رقم الترخيص: ${window._devSettings.license}</div>` : ''}
      </div>
      <div style="text-align:center;padding:10px;margin-bottom:14px">
        <div style="font-size:16px;font-weight:800;color:#3d2000">🪪 إقرار استلام بطاقات نسك — دفعة واحدة</div>
      </div>
      <div style="background:#fff8e1;border-radius:8px;padding:10px 12px;font-size:11.5px;line-height:1.8;margin-bottom:10px">
        <strong>الحملة:</strong> ${_esc(companyName+license)}<br>
        <strong>المشرف:</strong> ${_esc(user.name||user.username||'—')} &nbsp;•&nbsp; <strong>الحافلة:</strong> ${_esc(String(user.group_num||'—'))}<br>
        <strong>التاريخ:</strong> ${_esc(dateStr)} &nbsp;•&nbsp; <strong>الوقت:</strong> ${_esc(timeStr)}
      </div>
      ${searchHtml}
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:8px;max-height:220px;overflow-y:auto">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%">
          <table style="width:100%;min-width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap">
            <thead style="background:#3d2000;position:sticky;top:0;z-index:1">
              <tr>
                <th style="padding:7px 4px;font-weight:700;color:#fff;width:30px;border-bottom:1px solid #555">#</th>
                <th style="padding:7px 8px;font-weight:700;color:#fff;text-align:right;border-bottom:1px solid #555">اسم الحاج</th>
                <th style="padding:7px 8px;font-weight:700;color:#fff;width:92px;text-align:center;border-bottom:1px solid #555;direction:ltr">الهوية</th>
                <th style="padding:7px 4px;font-weight:700;color:#fff;width:50px;text-align:center;border-bottom:1px solid #555;background:#c00" title="استبعاد حاج من الدفعة">حذف</th>
              </tr>
            </thead>
            <tbody id="sup-bulk-tbody"></tbody>
          </table>
        </div>
      </div>
      <div id="sup-bulk-counter" style="background:#fff3e0;border:1px solid #c8971a;border-radius:8px;padding:8px 12px;font-size:12px;color:#7a4500;text-align:center;font-weight:700;margin-bottom:8px"></div>
      <div style="background:#fff8e8;border:1.5px solid #c8971a;border-radius:10px;padding:12px 14px;margin-bottom:10px;direction:rtl">
        <div style="font-weight:700;color:#3d2000;margin-bottom:10px;font-size:13px;display:flex;align-items:center;gap:6px">
          📜 التعهّدات (يرجى القراءة قبل التوقيع):
        </div>

        <div style="margin:8px 0 12px;padding:6px 10px;background:#fff;border:1px dashed #c8971a;border-radius:6px;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="sup-ack-check-all" onchange="_toggleAllSupAckPledges(this)" style="width:18px;height:18px;cursor:pointer;accent-color:#7a4500">
          <label for="sup-ack-check-all" style="font-size:12px;color:#7a4500;font-weight:700;cursor:pointer">✅ تحديد الكل</label>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-1" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-1" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>1.</strong> المحافظة على البطاقات وعدم تسليمها لأي شخص غير صاحبها.
            </label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-2" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-2" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>2.</strong> التحقق من هوية كل حاج قبل التسليم وأخذ توقيعه على الإقرار الخاص به.
            </label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-3" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-3" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>3.</strong> الالتزام بالتعليمات والإرشادات المتعلقة بتوزيع البطاقات.
            </label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-4" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-4" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>4.</strong> إبلاغ الحملة فوراً في حال فقدان أي بطاقة أو وجود أي مشكلة.
            </label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-5" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-5" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>5.</strong> إعادة البطاقات غير المسلّمة إلى الإدارة بعد انتهاء الرحلة.
            </label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px;background:#fff;border-radius:6px">
            <input type="checkbox" class="sup-ack-pledge" id="sup-pledge-6" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;accent-color:#7a4500">
            <label for="sup-pledge-6" style="font-size:12px;color:#3d2000;cursor:pointer;line-height:1.5">
              <strong>6.</strong> أتحمل كامل المسؤولية في حال الإهمال أو إساءة الاستخدام.
            </label>
          </div>
        </div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;background:#fffbf0;border:1.5px solid #e0d5c5;border-radius:8px;padding:8px 10px;font-size:11px;color:#3d2000;direction:rtl;cursor:pointer;margin-bottom:4px">
        <input type="checkbox" id="sup-bulk-ack-print" checked style="width:16px;height:16px;accent-color:#7a4500;cursor:pointer">
        <span>🖨️ فتح صفحة الإقرار الرسمي للطباعة بعد التأكيد</span>
      </label>
    </div>`;
  _renderSupBulkTable();
  clearSigCanvas();
  const modal = document.getElementById('sig-modal');
  if(modal){
    modal.classList.add('is-open');
    modal.style.display = 'flex';
  }
}

// v23.0-pre-oo: تحديد/إلغاء كل بنود إقرار المشرف
function _toggleAllSupAckPledges(checkAllEl){
  const allChecked = checkAllEl.checked;
  document.querySelectorAll('.sup-ack-pledge').forEach(cb => {
    cb.checked = allChecked;
  });
}
window._toggleAllSupAckPledges = _toggleAllSupAckPledges;

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
    // v22.7: String(p.id) للتوافق — Set يحوي نصوصاً (من onclick template)، p.id رقم من DB
    const isExcl = excluded.has(String(p.id));
    return `<tr style="border-bottom:1px solid #f5f5f5;${isExcl?'background:#fafafa;opacity:0.55':''}">
      <td style="padding:7px 4px;text-align:center;color:#999;font-size:11px">${i+1}</td>
      <td style="padding:7px 8px;font-weight:600;color:${isExcl?'#999':'#333'};${isExcl?'text-decoration:line-through':''}">${_esc(p.name||'—')}</td>
      <td style="padding:7px 8px;text-align:center;color:#666;font-size:11px;direction:ltr;${isExcl?'text-decoration:line-through':''}">${_esc(p.id_num||'—')}</td>
      <td style="padding:7px 4px;text-align:center;width:50px">
        ${isExcl
          ? `<button onclick="_toggleSupBulkExcluded('${p.id}')" title="إعادة إضافة" style="background:#1a7a1a;color:#fff;border:none;border-radius:6px;width:36px;height:30px;cursor:pointer;font-size:14px;font-family:inherit;line-height:1">↩</button>`
          : `<button onclick="_toggleSupBulkExcluded('${p.id}')" title="استبعاد من الدفعة" style="background:#c00;color:#fff;border:none;border-radius:6px;width:36px;height:30px;cursor:pointer;font-size:16px;font-family:inherit;line-height:1;font-weight:700;box-shadow:0 1px 3px rgba(204,0,0,0.3)">✕</button>`}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#888;font-size:12px">لا توجد نتائج مطابقة</td></tr>`;

  _updateSupBulkCounter();
}

function _toggleSupBulkExcluded(id) {
  const excluded = window._sigBulkExcluded;
  if(!excluded) return;
  // v22.7: توحيد على String لتجنّب عدم تطابق 5 !== "5"
  const key = String(id);
  if(excluded.has(key)) excluded.delete(key);
  else                  excluded.add(key);
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
  // v23.0-pre-ww: تنظيف دفاعي - ضمان عدم وجود نافذة معلّقة
  try {
    // إعادة تعيين حالة التوقيع
    window._sigPilgrimId = null;
    window._sigType = '';
    window._sigBulkReady = [];
    window._sigBulkExcluded = null;

    // إغلاق أي نافذة توقيع مفتوحة
    document.querySelectorAll('.modal-overlay, #sig-modal').forEach(m => {
      if(m){
        m.classList.remove('is-open');
        m.style.display = 'none';
      }
    });

    // مسح أي canvas توقيع سابق
    const sigCanvas = document.getElementById('sig-canvas');
    if(sigCanvas){
      const ctx = sigCanvas.getContext('2d');
      if(ctx) ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }

    console.log('[loadSupervisorPanel] Defensive cleanup done');
  } catch(e){
    console.warn('[loadSupervisorPanel] cleanup failed:', e);
  }

  document.getElementById('sup-name').textContent = user.name||user.username;
  document.getElementById('sup-bus').textContent = '🚌 حافلة رقم: ' + (user.group_num||'—');

  // v22.8: تحميل dev_settings (لم يكن محمَّلاً للمشرف — loadData يُستدعى للأدمن فقط)
  // هذا ضروري لظهور الشعار + الختم + ممثل الشركة في الإقرار الرسمي
  try {
    const devVal = await window.DB.Settings.get('dev_settings');
    if(devVal) window._devSettings = devVal;
  } catch(e) { console.warn('[sup] dev_settings load failed', e); }

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
  const hasNusuk = window._supPilgrims.some(p=>['لدى الإدارة','لدى المشرف','مسلّمة للحاج'].includes(p.nusuk_card_status));
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
  const readyPilgrims   = window._supPilgrims.filter(p=>p.nusuk_card_status==='لدى الإدارة');
  const hasNusukReady   = readyPilgrims.length > 0;
  const hasNusukWithSup = window._supPilgrims.some(p=>p.nusuk_card_status==='لدى المشرف');
  const readyCount      = readyPilgrims.length;
  // v23.0-pre-iii: حساب الحجاج الذين لم يستلموا بطاقات نسك بعد
  const unsignedCount   = window._supPilgrims.filter(p=>p.nusuk_card_status==='لدى المشرف').length;
  const hasBracelet     = window._supSettings.braceletAvailable;
  // v23.0-pre-nnn: أعداد للأزرار الأخرى
  const unboardedCount = window._supPilgrims.filter(p => p.bus_status !== 'ركب').length;
  const notArrivedCount = window._supPilgrims.filter(p => p.camp_status !== 'حضر').length;
  const noBraceletCount = window._supPilgrims.filter(p => !p.bracelet_time).length;
  const cols = 2 + (hasNusukWithSup?1:0) + (hasNusukReady?1:0) + (hasBracelet?1:0);
  container.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  container.innerHTML = `
    <button onclick="openSupAction('bus')" style="position:relative;background:#1a7a1a;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🚌 إركاب${unboardedCount > 0 ? `<span class="sup-badge-new" aria-label="${unboardedCount} حاج لم يركب بعد">${unboardedCount}</span>` : ''}</button>
    <button onclick="openSupAction('camp')" style="position:relative;background:#1a5fa8;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🏕️ وصول المخيم${notArrivedCount > 0 ? `<span class="sup-badge-new" aria-label="${notArrivedCount} حاج لم يصل بعد">${notArrivedCount}</span>` : ''}</button>
    ${hasNusukWithSup?`<button onclick="openSupAction('nusuk')" style="position:relative;background:#7a4500;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🪪 بطاقة نسك${unsignedCount > 0 ? `<span class="sup-badge-new" aria-label="${unsignedCount} حاج لم يستلم بعد">${unsignedCount}</span>` : ''}</button>`:''}
    ${hasNusukReady?`<button onclick="openSupBulkAck()" style="position:relative;background:#c8971a;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">📦 استلام دفعة<span class="sup-badge-new" aria-label="${readyCount} بطاقة جاهزة">${readyCount}</span></button>`:''}
    ${hasBracelet?`<button onclick="openSupAction('bracelet')" style="position:relative;background:#444;color:#fff;border:none;border-radius:12px;padding:14px 8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🚆 أسوارة${noBraceletCount > 0 ? `<span class="sup-badge-new" aria-label="${noBraceletCount} حاج لم يستلم أسوارة بعد">${noBraceletCount}</span>` : ''}</button>`:''}
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
  // v20.3: أي نشاط نسك يُظهر العمود (يشمل 'لدى الإدارة' أيضاً)
  const hasNusuk = window._supPilgrims.some(p=>['لدى الإدارة','لدى المشرف','مسلّمة للحاج'].includes(p.nusuk_card_status));
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
  const cardsWrap = document.getElementById('sup-cards-wrap');
  if(!list.length){
    tbody.innerHTML='';
    if(cardsWrap) cardsWrap.innerHTML = '';
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
    const nusukReady = p.nusuk_card_status==='لدى المشرف';
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

  // v22.10: رسم بطاقات المشرف (للجوال)
  _renderSupCards(list, hasNusuk, hasBracelet);

  _countSupFilters();
  _updateSupBulkBar();
}

// v22.10: بطاقات المشرف للجوال — نفس نمط .item-card
function _renderSupCards(list, hasNusuk, hasBracelet){
  const wrap = document.getElementById('sup-cards-wrap');
  if(!wrap) return;
  wrap.innerHTML = list.map(p => {
    const boarded        = p.bus_status === 'ركب';
    const arrived        = p.camp_status === 'حضر';
    const nusukDelivered = p.nusuk_card_status === 'مسلّمة للحاج';
    const nusukReady     = p.nusuk_card_status === 'لدى المشرف';
    const nusukAtAdmin   = p.nusuk_card_status === 'لدى الإدارة';
    const braceletDone   = !!p.bracelet_time;

    const chip = (bg, color, text) =>
      `<span style="background:${bg};color:${color};padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap">${text}</span>`;

    const busChip = boarded
      ? chip('#e8f8e8','#1a7a1a','🚌 ركب')
      : chip('#fde8e8','#c00','🚌 لم يركب');
    const campChip = arrived
      ? chip('#e8f0fd','#1a5fa8','🏕️ حضر')
      : chip('#fde8e8','#c00','🏕️ لم يصل');

    let nusukChip = '';
    if(hasNusuk){
      if(nusukDelivered)    nusukChip = chip('#fff3e0','#7a4500','🪪 مسلّمة');
      else if(nusukReady)   nusukChip = chip('#fdf5e8','#c07000','🪪 جاهزة');
      else if(nusukAtAdmin) nusukChip = chip('#f0f8ff','#1a5fa8','🪪 بالإدارة');
      else                  nusukChip = chip('#f5f5f5','#888','🪪 —');
    }

    const braceletChip = hasBracelet
      ? (braceletDone ? chip('#e8f8e8','#1a7a1a','🚆 مسلّمة') : chip('#f5f5f5','#888','🚆 —'))
      : '';

    // v22.11: inline defensive — min-width:0 + flex-direction:row + word-wrap
    return `<div class="item-card" style="flex-direction:row !important;align-items:flex-start">
      <div class="item-card-body" style="min-width:0;flex:1 1 auto">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <input type="checkbox" class="sup-row-check" data-id="${p.id}" onchange="_updateSupBulkBar()" style="width:18px;height:18px;cursor:pointer;accent-color:#c8971a;flex-shrink:0">
          <div class="item-card-title" style="margin:0;word-wrap:break-word;overflow-wrap:break-word;min-width:0">${_esc(p.name||'—')}</div>
        </div>
        <div class="item-card-sub" style="direction:ltr;text-align:right">🪪 ${_esc(p.id_num||'—')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${busChip}${campChip}${nusukChip}${braceletChip}
        </div>
      </div>
      <div class="item-card-actions" style="flex-shrink:0;width:auto">
        <button class="btn-edit" onclick="openQuickAction('${p.id}')" title="تسجيل / تعديل">✏️</button>
      </div>
    </div>`;
  }).join('');
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

// v23.0-pre-hhh: تحديث قائمة تسليم بطاقة نسك
window.refreshNusukHandoverList = function(){
  const modal = document.getElementById('sup-modal');
  if(!modal || modal.style.display === 'none') return;

  // تحقّق أن هذه نافذة "تسليم بطاقة نسك"
  const title = document.getElementById('sup-modal-title')?.textContent || '';
  if(!title.includes('تسليم بطاقة نسك')) return;

  console.log('[refreshNusukHandoverList] Refreshing nusuk handover list...');

  // أعد تحميل بيانات المشرف أولاً
  if(window._currentUser && typeof loadSupervisorPanel === 'function'){
    loadSupervisorPanel(window._currentUser).then(() => {
      // بعد تحديث البيانات، أعد رسم القائمة
      if(typeof supModalSearch === 'function'){
        supModalSearch();
        console.log('[refreshNusukHandoverList] List refreshed');
      }
    });
  } else {
    // fallback: أعد رسم القائمة مباشرة
    if(typeof supModalSearch === 'function'){
      supModalSearch();
      console.log('[refreshNusukHandoverList] List refreshed (fallback)');
    }
  }
};

function supModalSearch() {
  const q = document.getElementById('sup-modal-search').value.toLowerCase();
  const action = window._supAction;
  let list = _filterPilgrimsByQuery(q, { source: window._supPilgrims, limit: 500 });

  // فلترة حسب النوع
  if(action==='nusuk') list = list.filter(p=>p.nusuk_card_status==='لدى المشرف'||p.nusuk_card_status==='مسلّمة للحاج');

  const el = document.getElementById('sup-modal-results');
  if(!list.length){ el.innerHTML = '<div class="plc-empty">لا يوجد نتائج</div>'; return; }

  // v23.0-pre-iii: ترتيب الحجاج - غير المستلمين أولاً
  const sortedList = list.slice().sort((a, b) => {
    const aStatus = a.nusuk_card_status || '';
    const bStatus = b.nusuk_card_status || '';

    // الأولوية: لدى المشرف (لم يستلم) يأتي أولاً
    const aUnsigned = aStatus === 'لدى المشرف' ? 0 : 1;
    const bUnsigned = bStatus === 'لدى المشرف' ? 0 : 1;

    if(aUnsigned !== bUnsigned) return aUnsigned - bUnsigned;

    // ضمن نفس المجموعة، رتّب بالاسم
    return (a.name || '').localeCompare(b.name || '', 'ar');
  });

  el.innerHTML = sortedList.map(p => {
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

  // v20.4: فحص عزل دفاعي — التحقق من أن الحاج من حافلة المشرف
  const user = window._currentUser;
  const supBus = user && user.group_num != null ? String(user.group_num) : null;
  const pBus = p && p.bus_num != null ? String(p.bus_num) : null;
  if(supBus && pBus !== supBus){
    console.warn('[isolation] openSigModal blocked — pilgrim', pilgrimId, 'bus:', pBus, '!= supervisor bus:', supBus);
    showToast('🔒 خطأ عزل: هذا الحاج ليس من حافلتك', 'error');
    return;
  }

  // v23.0-pre-ddd: تسليم بطاقة نسك - تحويل بيانات الحاج من صيغة إنجليزية إلى عربية ثم استدعاء openPilgrimAck
  if(type === 'nusuk' || type === 'بطاقة نسك'){
    // ابحث في _supPilgrims (قائمة المشرف)
    const supPilgrim = (window._supPilgrims || []).find(p =>
      String(p.id) === String(pilgrimId)
    );

    // أو في ALL_DATA (إن كانت متاحة)
    const adminPilgrim = (typeof ALL_DATA !== 'undefined' ? ALL_DATA : []).find(p =>
      String(p['_supabase_id']) === String(pilgrimId)
    );

    // استخدم adminPilgrim إن وُجد (بالصيغة العربية جاهزة)
    // أو حوّل supPilgrim إلى صيغة عربية
    let pilgrim = adminPilgrim;

    if(!pilgrim && supPilgrim){
      // تحويل الصيغة الإنجليزية إلى عربية لتوافق openPilgrimAck
      pilgrim = {
        '_supabase_id': supPilgrim.id,
        'اسم الحاج': supPilgrim.name || '—',
        'رقم الهوية': supPilgrim.id_num || '—',
        'رقم الجوال': supPilgrim.phone || '',
        'رقم الحافلة الخاصة بك': supPilgrim.bus_num || supPilgrim.group_num || '',
        'حالة بطاقة نسك': supPilgrim.nusuk_card_status || 'لدى المشرف',
        'نسك_time': supPilgrim.nusuk_card_time || '',
        'نسك_sig': supPilgrim.nusuk_card_sig || null,
        'رقم الحجز': supPilgrim.booking_num || '',
        'الجنسية': supPilgrim.nationality || '',
        'الجنس': supPilgrim.gender || '',
        'المدينة': supPilgrim.city || ''
      };
    }

    if(pilgrim && typeof window.openPilgrimAck === 'function'){
      console.log('[openSigModal] استخدام openPilgrimAck لإقرار الحاج');
      console.log('[DEBUG] Before openPilgrimAck call');
      setTimeout(() => {
        const modal = document.querySelector('.modal-overlay.is-open, .ack-modal, #pilgrim-ack-modal');
        console.log('[DEBUG] Modal after 100ms:', modal);
        if(modal){
          const rect = modal.getBoundingClientRect();
          const cs = getComputedStyle(modal);
          console.log('[DEBUG] Position:', rect);
          console.log('[DEBUG] Display:', cs.display, 'Visibility:', cs.visibility, 'Opacity:', cs.opacity, 'Z-index:', cs.zIndex);
          console.log('[DEBUG] Dimensions:', rect.width, 'x', rect.height);
        }
      }, 100);
      window.openPilgrimAck(pilgrimId, pilgrim);

      setTimeout(() => {
        const overlay = document.getElementById('modal-overlay');
        if(!overlay) { console.error('NO OVERLAY'); return; }

        console.log('=== COMPLETE DIAGNOSTIC ===');

        // 1. الخصائص المحسوبة
        const cs = getComputedStyle(overlay);
        console.log('1. Computed:', {
          display: cs.display,
          position: cs.position,
          visibility: cs.visibility,
          opacity: cs.opacity,
          transform: cs.transform,
          clip: cs.clip,
          clipPath: cs.clipPath,
          width: cs.width,
          height: cs.height,
          top: cs.top,
          left: cs.left
        });

        // 2. Body و parent
        console.log('2. Parent:', overlay.parentElement?.tagName, overlay.parentElement?.id);
        console.log('3. Body display:', getComputedStyle(document.body).display);
        console.log('4. Body overflow:', getComputedStyle(document.body).overflow);

        // 3. offsetWidth/Height (مختلف عن getBoundingClientRect)
        console.log('5. offsetWidth x offsetHeight:', overlay.offsetWidth, 'x', overlay.offsetHeight);
        console.log('6. clientWidth x clientHeight:', overlay.clientWidth, 'x', overlay.clientHeight);
        console.log('7. scrollWidth x scrollHeight:', overlay.scrollWidth, 'x', overlay.scrollHeight);

        // 4. جرّب append إلى body من جديد
        console.log('8. Re-appending to body...');
        document.body.appendChild(overlay);

        // 5. بعد append
        setTimeout(() => {
          console.log('9. After re-append:', overlay.getBoundingClientRect());
          console.log('10. offsetWidth now:', overlay.offsetWidth);
        }, 50);

      }, 100);

      setTimeout(() => {
        const existingOverlay = document.getElementById('modal-overlay');
        if(!existingOverlay || existingOverlay.offsetWidth > 0) return;

        console.log('[Fix] Moving modal to body and resetting styles');

        // استخرج المحتوى
        const content = existingOverlay.innerHTML;

        // أنشئ nav جديد تماماً
        const newOverlay = document.createElement('div');
        newOverlay.id = 'modal-overlay-fixed';
        newOverlay.innerHTML = content;
        newOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 999999;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          overflow-y: auto;
          box-sizing: border-box;
        `;

        // أضف onclick للإغلاق
        newOverlay.onclick = (e) => {
          if(e.target === newOverlay){
            newOverlay.remove();
            existingOverlay.classList.remove('is-open');
            existingOverlay.style.display = 'none';
          }
        };

        // أخفِ القديم وأضف الجديد
        existingOverlay.style.display = 'none';
        existingOverlay.classList.remove('is-open');
        document.body.appendChild(newOverlay);

        // نمّط الصندوق الداخلي
        const box = newOverlay.querySelector('#modal-content, .modal-box');
        if(box){
          box.style.cssText = `
            width: auto;
            max-width: 560px;
            max-height: 90vh;
            margin: auto;
            padding: 20px;
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            overflow-y: auto;
            box-sizing: border-box;
          `;

          if(window.innerWidth <= 768){
            box.style.maxWidth = '95%';
            box.style.width = '95%';
            box.style.padding = '14px';
          }
        }

        console.log('[Fix] New modal created and appended');
        console.log('[Fix] Dimensions:', newOverlay.getBoundingClientRect());
      }, 150);

      return;
    }

    // fallback: لم توجد الدالة أو الحاج
    console.warn('[openSigModal] openPilgrimAck not available or pilgrim not found, using fallback');
  }

  // ... باقي الكود القديم للأسوارة وغيرها
  const titles = { nusuk:'🪪 تسليم بطاقة نسك', bracelet:'🚆 تسليم أسوارة القطار' };
  document.getElementById('sig-modal-title').textContent = titles[type]||'';
  document.getElementById('sig-pilgrim-name').textContent = (p?.name||'—') + ' — ' + (p?.id_num||'—');
  clearSigCanvas();
  const modal = document.getElementById('sig-modal');
  if(modal){
    modal.classList.add('is-open');
    modal.style.display = 'flex';
  }
  closeSupModal();
}

function closeSigModal() {
  const modal = document.getElementById('sig-modal');
  if(modal){
    modal.classList.remove('is-open');
    modal.style.display = 'none';
  }
}

function clearSigCanvas() {
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function confirmSignature() {
  // v23.0-pre-oo: التحقق من الموافقة على جميع التعهدات
  if(window._sigType === 'bulk_nusuk') {
    const allPledges = document.querySelectorAll('.sup-ack-pledge');
    const checked = document.querySelectorAll('.sup-ack-pledge:checked');
    if(allPledges.length > 0 && checked.length !== allPledges.length){
      showToast('⚠️ يرجى الموافقة على جميع التعهدات قبل التوقيع', 'warning');
      return;
    }
  }

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
    // v20.4.1: استخدام window.DB.Storage بدل window.supabase.storage (الأخير = factory lib، ليس client)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.7));
    const fileName = `${type}_${id}_${Date.now()}.png`;
    await window.DB.Storage.uploadSignature(fileName, blob);
    const sigUrl = window.DB.Storage.getSignaturePublicUrl(fileName);
    if(!sigUrl) throw new Error('تعذّر الحصول على رابط التوقيع');

    // حفظ في Supabase
    let updates = {};
    if(type==='nusuk') { updates = { nusuk_card_status: 'مسلّمة للحاج', nusuk_card_sig: sigUrl, nusuk_card_time: timeStr }; }
    else if(type==='bracelet') { updates = { bracelet_sig: sigUrl, bracelet_time: timeStr }; }
    else if(type==='bulk_nusuk') {
      // v20.3: استخراج ids من ready - excluded (بدل _sigBulkIds الثابتة)
      // v22.7: مقارنة String لأن Set يحوي نصوصاً
      const ready    = window._sigBulkReady || [];
      const excluded = window._sigBulkExcluded || new Set();
      let ids = ready.filter(p => !excluded.has(String(p.id))).map(p => p.id);
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

      // v22.0: UUID يُولَّد أولاً ويُخزَّن في nusuk_supervisor_ack_id (لربط جميع بطاقات الدفعة بنفس الإقرار)
      const bulkSessionId = (crypto.randomUUID && crypto.randomUUID())
        || ('bulk-' + Date.now() + '-' + Math.random().toString(36).substring(2,10));

      // v22.0: snapshot قبل التحديث — حقول المشرف المنفصلة
      const beforeMap = new Map();
      ids.forEach(bid => {
        const bp = window._supPilgrims.find(x=>String(x.id)===String(bid));
        beforeMap.set(String(bid), {
          nusuk_card_status:       bp ? (bp.nusuk_card_status       ?? null) : null,
          nusuk_supervisor_sig:    bp ? (bp.nusuk_supervisor_sig    ?? null) : null,
          nusuk_supervisor_time:   bp ? (bp.nusuk_supervisor_time   ?? null) : null,
          nusuk_supervisor_ack_id: bp ? (bp.nusuk_supervisor_ack_id ?? null) : null
        });
      });
      // v22.0: استلام المشرف يكتب في nusuk_supervisor_* (منفصل عن nusuk_card_* الذي يحتفظ بتوقيع الحاج)
      const bulkUpdates = {
        nusuk_card_status:       'لدى المشرف',
        nusuk_supervisor_sig:    sigUrl,
        nusuk_supervisor_time:   timeStr,
        nusuk_supervisor_ack_id: bulkSessionId,
        nusuk_supervisor_name:    user.name || user.username || '',
        nusuk_supervisor_id_num:  user.id_num || '',
        nusuk_supervisor_user_id: String(user.id || '')
      };
      await Promise.all(ids.map(bid => window.DB.Pilgrims.update(parseInt(bid), bulkUpdates)));
      ids.forEach(bid => {
        const bp = window._supPilgrims.find(x=>String(x.id)===String(bid));
        if(bp){
          bp.nusuk_card_status       = 'لدى المشرف';
          bp.nusuk_supervisor_sig    = sigUrl;
          bp.nusuk_supervisor_time   = timeStr;
          bp.nusuk_supervisor_ack_id = bulkSessionId;
          bp.nusuk_supervisor_name    = user.name || user.username || '';
          bp.nusuk_supervisor_id_num  = user.id_num || '';
          bp.nusuk_supervisor_user_id = String(user.id || '');
        }
      });

      // v17.2: audit — N صفوف فردية + 1 صف جماعي + bulk_session
      // v20.3: bus_num + إحصائيات الاستبعاد
      // v22.0: bulkSessionId نُوِّلد أعلاه
      const bulkMeta = {
        source: 'supervisor_bulk_receive',
        bulk_session: bulkSessionId,
        bulk_target_field: 'nusuk_card_status',
        bulk_target_value: 'لدى المشرف',
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
        field_changes: {
          nusuk_card_status:       { before: null, after: 'لدى المشرف', note: 'bulk' },
          nusuk_supervisor_sig:    { before: null, after: sigUrl,               note: 'bulk' },
          nusuk_supervisor_ack_id: { before: null, after: bulkSessionId,        note: 'bulk' }
        },
        bulk_ids:   ids,
        bulk_count: ids.length,
        metadata: bulkMeta
      });

      // v22.1: قراءة تفضيل الطباعة قبل إغلاق الـ modal (العنصر يُحذف مع الإغلاق)
      const shouldPrintAck = !!document.getElementById('sup-bulk-ack-print')?.checked;
      const ackPilgrimsSnapshot = ids.map(bid => window._supPilgrims.find(x=>String(x.id)===String(bid))).filter(Boolean);

      closeSigModal();
      const exclMsg = excluded.size ? ` • استبعاد يدوي: ${excluded.size}` : '';
      const isoMsg  = isolationSkipped.length ? ` • عزل تلقائي: ${isolationSkipped.length}` : '';
      showToast(`✅ تم تسجيل استلام ${ids.length} بطاقة${exclMsg}${isoMsg}`, isolationSkipped.length ? 'warning' : 'success');
      // v20.3: تنظيف state
      window._sigBulkReady = [];
      window._sigBulkExcluded = null;
      updateSupStats(); renderSupTable(); renderSupActionBtns();

      // v22.1: فتح الإقرار الرسمي للطباعة (إذا المستخدم لم يلغِ الخيار)
      if(shouldPrintAck && typeof openBulkAckReceipt === 'function'){
        setTimeout(() => openBulkAckReceipt({
          ackId: bulkSessionId,
          pilgrims: ackPilgrimsSnapshot,
          supervisor: user,
          sigUrl,
          timeStr
        }), 200);
      }
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

    // v22.1: قفل التسليم — تسليم نسك للحاج يتطلب استلام المشرف أولاً (superadmin يتجاوز)
    const isSuper = window._currentUser && window._currentUser.role === 'superadmin';
    const pilgrimCardStatus = p?.nusuk_card_status || p?.['حالة بطاقة نسك'] || '';
    if(type === 'nusuk' && pilgrimCardStatus === 'لدى الإدارة' && !isSuper){
      showToast('🔒 لم تستلم هذه البطاقة من الإدارة بعد — استخدم 📦 استلام دفعة', 'error');
      return;
    }

    // v17.2: snapshot لقيم الحقول المُحدَّثة (single nusuk / bracelet)
    const auditKeys = Object.keys(updates);
    const before = {};
    auditKeys.forEach(k => { before[k] = p ? (p[k] ?? null) : null; });

    await window.DB.Pilgrims.update(parseInt(id), updates);
    if(p) Object.assign(p, updates);

    // v17.2: audit (مع قناع التوقيع)
    // v22.1: bypass_no_supervisor_ack إذا تجاوز superadmin قفل التسليم
    const changes = _maskSigInChanges(_buildFieldChanges(before, updates));
    if(changes){
      const meta = { source: type==='nusuk' ? 'supervisor_nusuk' : 'supervisor_bracelet' };
      if(isSuper && pilgrimCardStatus === 'لدى الإدارة') meta.bypass_no_supervisor_ack = true;
      _recordAudit({
        action_type:  'update',
        entity_type:  'pilgrim',
        entity_id:    String(id),
        entity_label: _buildPilgrimLabel(p),
        field_changes: changes,
        metadata: meta
      });
    }

    closeSigModal();
    showToast('تم تسجيل الاستلام بالتوقيع', 'success');
    // v20.4.2: refresh كامل للـ UI بعد DB update — KPIs + جدول + أزرار + modal (دفاعي)
    updateSupStats();
    renderSupTable();
    renderSupActionBtns();
    const supModal = document.getElementById('sup-modal');
    if(supModal && supModal.style.display === 'flex' && typeof supModalSearch === 'function'){
      supModalSearch();
    }
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

// ═══════════════════════════════════════════════════════════════════════
// v22.1: إقرار المشرف الرسمي — نافذة طباعة/PDF
// ═══════════════════════════════════════════════════════════════════════
// opts:
//   - ackId (string) — مطلوب
//   - pilgrims (Array) — اختياري؛ إن لم يوجد يُجلب من DB بحسب ack_id
//   - supervisor (Object) — اختياري؛ افتراضي _currentUser
//   - sigUrl, timeStr — اختياري؛ يُقرأ من أول حاج في الإقرار
// ═══════════════════════════════════════════════════════════════════════
async function openBulkAckReceipt(opts){
  opts = opts || {};
  let { ackId, pilgrims, supervisor, sigUrl, timeStr } = opts;
  if(!ackId) { showToast('معرّف الإقرار غير صالح', 'error'); return; }

  // جلب من DB إذا البيانات غير مُمرَّرة (عرض تاريخي)
  if(!pilgrims || !pilgrims.length){
    try {
      const all = await window.DB.Pilgrims.getAll();
      pilgrims = all.filter(p => String(p.nusuk_supervisor_ack_id||'') === String(ackId));
    } catch(e){ showToast('فشل جلب البيانات: '+(e.message||''), 'error'); return; }
    if(!pilgrims.length){ showToast('لا يوجد حجاج بهذا الإقرار', 'warning'); return; }
    sigUrl  = sigUrl  || pilgrims[0].nusuk_supervisor_sig  || '';
    timeStr = timeStr || pilgrims[0].nusuk_supervisor_time || '';
  }

  // v23.0-pre-p: نقرأ معلومات المشرف من pilgrim نفسه (محفوظة وقت التوقيع)
  if(!supervisor && pilgrims[0]){
    const p0 = pilgrims[0];
    if(p0.nusuk_supervisor_name || p0.nusuk_supervisor_id_num){
      supervisor = {
        name:   p0.nusuk_supervisor_name,
        id_num: p0.nusuk_supervisor_id_num,
        id:     p0.nusuk_supervisor_user_id
      };
    }
  }
  // fallback للبيانات القديمة (قبل v23.0-pre-p)
  if(!supervisor) supervisor = window._currentUser || {};
  if((!supervisor.name || !supervisor.id_num) && pilgrims[0] && pilgrims[0].bus_num != null){
    try {
      const users = await window.DB.SysUsers.getAll();
      const sup = users.find(u => u.role === 'supervisor' && String(u.group_num) === String(pilgrims[0].bus_num));
      if(sup){ supervisor = Object.assign({}, sup, supervisor); }
    } catch(_){}
  }

  const dev = window._devSettings || {};
  const companyName = dev.companyName || '';
  const license = dev.license || '';
  const stamp = dev.stamp || '';
  const logo  = dev.logo  || '';        // v22.7: شعار الشركة المرفوع (بدلاً من Kaaba fallback)
  const repName = dev.rep_name || '';   // v22.5
  const repSig  = dev.rep_sig  || '';   // v22.5
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic');
  const timeDisplay = timeStr || now.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });

  const printDate = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'2-digit', day:'2-digit' });
  const printTime = new Date().toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit', hour12:true });

  const supName  = supervisor.name || supervisor.username || '—';
  const supIdNum = supervisor.id_num || '—';
  const supBus   = supervisor.group_num || (pilgrims[0] && pilgrims[0].bus_num) || '—';

  const rows = pilgrims.map((p,i) => `
    <tr>
      <td style="padding:4px;text-align:center;font-size:10px">${i+1}</td>
      <td style="padding:4px;text-align:right;font-size:10px">${esc(p.name||'—')}</td>
      <td style="padding:4px;text-align:center;font-size:10px;direction:ltr">${esc(p.id_num||'—')}</td>
      <td style="padding:4px;text-align:center;font-size:10px;direction:ltr">${esc(p.booking_num||'—')}</td>
      <td style="padding:4px;text-align:center;font-size:10px">${esc(p.gender||'—')}</td>
      <td style="padding:4px;text-align:center;font-size:10px">${esc(p.city||'—')}</td>
      <td style="padding:4px;text-align:center;font-size:10px">${esc(p.bus_num||'—')}</td>
    </tr>`).join('');

  const w = window.open('', '_blank');
  if(!w){ showToast('المتصفح حجب النافذة — فعّل النوافذ المنبثقة', 'warning'); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <title>إقرار استلام بطاقات نسك — ${esc(String(ackId).substring(0,8))}</title>
  <style>
    @page{size:A4 portrait;margin:8mm 10mm}
    @media print { body{margin:0;padding:0;max-width:none!important} .no-print{display:none} }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{font-family:Arial,sans-serif;direction:rtl;padding:20px;font-size:12px;color:#222;max-width:800px;margin:0 auto;background:#f5f5f5;min-height:100vh}
    /* v22.8: responsive للشاشات الصغيرة */
    @media screen and (max-width:820px){
      body{padding:10px;font-size:11px}
      .header{grid-template-columns:1fr!important;gap:8px;text-align:center}
      .header>div:first-child,.header>div:last-child{display:none}
      table.pilgrims{font-size:10px!important}
      table.pilgrims th,table.pilgrims td{padding:4px 4px!important}
      .sig-section{grid-template-columns:1fr!important;gap:14px!important}
    }
    .header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:3px solid #3d2000;padding-bottom:12px;margin-bottom:14px}
    .co-name{font-size:15px;font-weight:bold;color:#3d2000}
    .co-sub{font-size:11px;color:#555}
    .doc-title{font-size:15px;font-weight:bold;color:#3d2000;margin-top:4px}
    .info-box{background:#fffbf0;border:1px solid #e0d0b0;border-radius:8px;padding:10px 14px;margin-bottom:14px;line-height:1.9;font-size:12px}
    table.pilgrims{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px}
    table.pilgrims thead{background:#f5ead0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    table.pilgrims th{padding:6px 8px;text-align:center;border:1px solid #d5c098;font-weight:bold;color:#3d2000}
    table.pilgrims td{padding:5px 8px;border:1px solid #e0d0b0;text-align:center}
    table.pilgrims tbody tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pledge{background:#fff;border:1px solid #eee;border-radius:8px;padding:12px 14px;margin-bottom:14px;line-height:2;font-size:12px}
    .pledge ol{margin:6px 20px 0 0;padding:0}
    .pledge li{margin-bottom:4px}
    .sig-section{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:16px;border-top:1px solid #eee;padding-top:14px}
    .sig-box{text-align:center}
    .sig-box label{font-size:12px;color:#666;display:block;margin-bottom:8px;font-weight:bold}
    .sig-img{max-width:180px;max-height:80px;object-fit:contain;border:1px solid #ddd;border-radius:6px;background:#fafafa}
    .stamp{max-width:90px;max-height:90px;object-fit:contain;display:block;margin:0 auto}
    .sig-placeholder{width:180px;height:80px;border:1px dashed #ccc;border-radius:6px;margin:0 auto}
    .footer{text-align:center;font-size:10px;color:#999;margin-top:14px;border-top:1px solid #f0f0f0;padding-top:8px}
  </style></head><body>
  <div class="header">
    <div style="text-align:right">
      <div class="co-name">${esc(companyName)}</div>
      ${license?`<div class="co-sub">رقم الترخيص: ${esc(license)}</div>`:''}
    </div>
    <div style="text-align:center">
      ${logo
        ? `<img src="${esc(logo)}" alt="شعار" style="height:60px;max-width:150px;object-fit:contain;display:block;margin:0 auto 4px">`
        : ''}
      <div class="doc-title">إقرار استلام بطاقات نسك</div>
    </div>
    <div style="text-align:left;font-size:10px;color:#555;line-height:1.8;justify-self:end;direction:ltr">
      <div style="white-space:nowrap">📅 <strong>التاريخ:</strong> ${printDate}</div>
      <div style="white-space:nowrap">🕐 <strong>الوقت:</strong> ${printTime}</div>
      <div style="white-space:nowrap">📄 <strong>الصفحات:</strong> 1 من 1</div>
    </div>
  </div>
  <div class="info-box">
    <strong>اسم المشرف:</strong> ${esc(supName)} &nbsp;|&nbsp;
    <strong>🪪 رقم الهوية:</strong> <span style="direction:ltr">${esc(supIdNum)}</span><br>
    <strong>🚌 الحافلة:</strong> ${esc(String(supBus))} &nbsp;|&nbsp;
    <strong>عدد البطاقات:</strong> ${pilgrims.length}<br>
    <strong>📅 التاريخ:</strong> ${esc(dateStr)} &nbsp;|&nbsp;
    <strong>🕒 الوقت:</strong> ${esc(timeDisplay)}<br>
    <strong>معرّف الإقرار:</strong> <span style="direction:ltr;color:#888;font-size:10px">${esc(ackId)}</span>
  </div>
  <table class="pilgrims">
    <thead>
      <tr>
        <th style="width:28px;padding:5px;background:#f5ead0;font-size:10px">#</th>
        <th style="padding:5px;background:#f5ead0;font-size:10px;text-align:right">اسم الحاج</th>
        <th style="width:90px;padding:5px;background:#f5ead0;font-size:10px">رقم الهوية</th>
        <th style="width:75px;padding:5px;background:#f5ead0;font-size:10px">رقم الحجز</th>
        <th style="width:45px;padding:5px;background:#f5ead0;font-size:10px">الجنس</th>
        <th style="width:70px;padding:5px;background:#f5ead0;font-size:10px">المدينة</th>
        <th style="width:50px;padding:5px;background:#f5ead0;font-size:10px">الحافلة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="pledge">
    أقر أنا المشرف المذكور أعلاه بأنني استلمت من <strong>${esc(companyName)}</strong> عدد <strong>${pilgrims.length}</strong> بطاقة "نسك" للحجاج المذكورة أسماؤهم أعلاه وأتعهد بما يلي:
    <ol>
      <li>المحافظة على البطاقات وعدم تسليمها لأي شخص غير صاحبها.</li>
      <li>التحقق من هوية كل حاج قبل التسليم وأخذ توقيعه على الإقرار الخاص به.</li>
      <li>الالتزام بالتعليمات والإرشادات المتعلقة بتوزيع البطاقات.</li>
      <li>إبلاغ الحملة فوراً في حال فقدان أي بطاقة أو وجود أي مشكلة.</li>
      <li>إعادة البطاقات غير المُسلَّمة إلى الإدارة بعد انتهاء الرحلة.</li>
      <li>أتحمل كامل المسؤولية في حال الإهمال أو إساءة الاستخدام.</li>
    </ol>
  </div>
  <div class="sig-section">
    <div class="sig-box">
      <label>توقيع المشرف</label>
      ${sigUrl?`<img class="sig-img" src="${esc(sigUrl)}" alt="توقيع المشرف">`:'<div class="sig-placeholder"></div>'}
      <div style="margin-top:6px;font-size:12px;font-weight:600">${esc(supName)}</div>
    </div>
    ${(repName || repSig || stamp) ? `
    <div class="sig-box">
      <label>ممثل الشركة</label>
      ${repName?`<div style="font-size:13px;font-weight:700;color:#3d2000;margin-bottom:8px">${esc(repName)}</div>`:''}
      <div style="display:flex;gap:14px;justify-content:center;align-items:flex-start">
        ${repSig?`<div style="text-align:center">
          <img src="${esc(repSig)}" alt="توقيع الممثل" style="max-width:120px;max-height:60px;object-fit:contain;border:1px solid #eee;border-radius:4px;background:#fafafa">
          <div style="font-size:10px;color:#888;margin-top:3px">التوقيع</div>
        </div>`:''}
        ${stamp?`<div style="text-align:center">
          <img src="${esc(stamp)}" alt="ختم" style="max-width:70px;max-height:70px;object-fit:contain">
          <div style="font-size:10px;color:#888;margin-top:3px">الختم</div>
        </div>`:''}
      </div>
      <div style="margin-top:8px;font-size:11px;color:#666">${esc(companyName)}</div>
    </div>
    ` : `
    <div class="sig-box">
      <label>ممثل الشركة والختم الرسمي</label>
      <div class="sig-placeholder"></div>
      <div style="margin-top:6px;font-size:12px;font-weight:600">${esc(companyName)}</div>
    </div>
    `}
  </div>
  <div class="footer">
    تم إنشاء هذا الإقرار إلكترونياً &nbsp;•&nbsp; معرّف: <span style="direction:ltr">${esc(ackId)}</span>
  </div>
  <div class="no-print" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 30px;background:#3d2000;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:Arial,sans-serif">🖨️ طباعة / حفظ PDF</button>
  </div>
  </body></html>`);
  w.document.close();
}
