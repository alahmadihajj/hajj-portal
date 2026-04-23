// ═══════════════════════════════════════════════════════════════════════
// Audit Log Module — v17.0 → v17.4
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Core helpers: _recordAudit, _buildFieldChanges, _filterAuditSyncArtifacts
//   - Masking: _maskSensitiveInChanges, _maskSensitiveSnapshot, _maskSigInChanges
//   - Entity label builders: _buildPilgrimLabel, _buildCampLabel, _buildGroupLabel, _buildBusLabel, _buildUserLabel
//   - Constants: SIG_FIELDS, SIG_FIELDS_NO_UNDO, SENSITIVE_FIELD_MASKS,
//                AUDIT_ACTION_STYLES, AUDIT_ENTITY_LABELS, HIDDEN_AUDIT_FIELDS, AUDIT_SOURCE_LABELS
//   - UI: renderAuditLog, _buildAuditCard, _expandAuditCard, _renderEntitySnapshot,
//         _renderAuditStats, _populateAuditUserFilter, _groupAuditByDate,
//         applyAuditFilters, clearAuditFilters, _renderAuditPagination, _auditGoToPage
//   - Export: exportAuditCSV
//   - Undo: _undoPilgrimEntry, _undoAuditEntry, _invertFieldChanges, _detectUndoConflicts
//   - Permissions: _canSeeAllAudit, _canUndoAudit
//   - Utilities: _esc, _auditRelativeTime, _auditFormatFullTime, _auditFieldLabel, _auditFormatValue
//
// Dependencies (globals): window.DB, ALL_DATA, window._currentUser, window._sessionId,
//                         window._campsCache, SUPER_ADMIN, showToast, showActionModal,
//                         loadData, renderAuditLog (self-reference)
// ═══════════════════════════════════════════════════════════════════════

// ===== v17.0 Phase 1: Audit Log Helpers =====

/**
 * v20.0: يُحدِّد ما إذا كان المستخدم الحالي هو السوبر أدمن المبرمج (المطوّر الأساسي).
 * المصدر: SYSTEM_CONFIG.superAdmin.username (config.js) — fallback للـ hardcoded.
 */
function _isDevUser(){
  const u = window._currentUser && window._currentUser.username;
  const devId = (typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG.superAdmin && SYSTEM_CONFIG.superAdmin.username) || '1057653261';
  return !!(u && String(u) === String(devId));
}

/**
 * يُسجّل حدثاً في audit_log — fire-and-forget.
 * فشل التسجيل لا يُوقف الحفظ (.catch يطبع فقط).
 * يُضيف تلقائياً: user_*, session_id, reversible, metadata.user_agent.
 * v20.0: يضيف metadata.is_dev + metadata.dev_hidden لو المستخدم = المطوّر (تسجيل سري).
 * @param {Object} entry — {action_type, entity_type, entity_id, entity_label, field_changes?, bulk_ids?, bulk_count?, metadata?}
 */
function _recordAudit(entry){
  const u = window._currentUser;
  if(!u) return; // حماية: لا تسجيل بدون مستخدم مسجّل

  // v17.0.1: guard دفاعي — لا تسجّل update بدون تغييرات فعلية
  if(entry.action_type === 'update' && !entry.field_changes) return;

  // v20.0: حقن علامة المطوّر — التسجيل يستمر، UI يُخفيه افتراضياً
  if(_isDevUser()){
    entry.metadata = entry.metadata || {};
    entry.metadata.is_dev     = true;
    entry.metadata.dev_hidden = true;
  }

  // v17.3: reversible قواعد — update/bulk_update قابلة؛ create/delete/undo غير قابلة
  const reversible = (entry.action_type === 'update' || entry.action_type === 'bulk_update');
  const metadata = Object.assign({
    source: (entry.metadata && entry.metadata.source) || 'unknown',
    user_agent: (navigator.userAgent || '').substring(0, 200)
  }, entry.metadata || {});

  // v17.3: قناع مركزي للحقول الحساسة (sig + password)
  let field_changes = entry.field_changes;
  if(field_changes && typeof field_changes === 'object'){
    field_changes = _maskSensitiveInChanges(field_changes);
    // قناع nested في _created/_deleted snapshots
    if(field_changes._created && field_changes._created.after){
      field_changes = Object.assign({}, field_changes, {
        _created: { before: null, after: _maskSensitiveSnapshot(field_changes._created.after) }
      });
    }
    if(field_changes._deleted && field_changes._deleted.before){
      field_changes = Object.assign({}, field_changes, {
        _deleted: { before: _maskSensitiveSnapshot(field_changes._deleted.before), after: null }
      });
    }
  }

  const payload = Object.assign({
    user_id:     u.username || null, // TEXT في schema (ليس u.id)
    user_name:   u.name || u.username || '—',
    user_role:   u.role || 'unknown',
    session_id:  window._sessionId || null,
    reversible
  }, entry, { metadata, field_changes });

  // fire-and-forget — لا await (حتى لا يعطّل UX عند بطء الشبكة)
  window.DB.Audit.log(payload).catch(e => console.error('[audit]', e));
}

/**
 * يُقارن snapshot قبل/بعد ويُرجع {field:{before,after}} للحقول المتغيّرة فقط.
 * @returns {Object|null} null إذا لم يتغيّر شيء.
 */
function _buildFieldChanges(before, after){
  const changes = {};
  const keys = new Set([...Object.keys(before||{}), ...Object.keys(after||{})]);
  keys.forEach(k => {
    const b = before?.[k] ?? null;
    const a = after?.[k]  ?? null;
    if(String(b) !== String(a)) changes[k] = { before: b, after: a };
  });
  return Object.keys(changes).length ? changes : null;
}

/**
 * يُرجع label للحاج: "اسم الحاج (رقم الهوية)" مع fallback.
 */
function _buildPilgrimLabel(pilgrim){
  if(!pilgrim) return '—';
  const name = pilgrim['اسم الحاج'] || pilgrim.name   || '—';
  const idn  = pilgrim['رقم الهوية'] || pilgrim.id_num || '—';
  return name + ' (' + idn + ')';
}

/**
 * v17.0.1: يُنظّف updates من "shadow seat sync" قبل توليد audit changes.
 * المنطق: إذا seat في updates لكن bed المقابل ليس فيها → seat مُزامَن تلقائياً
 * من _applyBedAssignment، وليس تغييراً من المستخدم → احذفه من نسخة الـ audit.
 * لا يلمس DB — يُستخدم فقط قبل _buildFieldChanges.
 */
function _filterAuditSyncArtifacts(updates){
  const out = Object.assign({}, updates);
  ['mina','arafat'].forEach(loc => {
    const bedKey  = loc + '_bed';
    const seatKey = loc + '_seat';
    if(Object.prototype.hasOwnProperty.call(out, seatKey)
      && !Object.prototype.hasOwnProperty.call(out, bedKey)){
      delete out[seatKey];
    }
  });
  return out;
}

/**
 * v17.2: يقنّع حقول التوقيع في field_changes (بعد _buildFieldChanges).
 * DB يحفظ الـ URL الكامل — audit فقط يعرض "[توقيع مسجّل]".
 */
// v22.0: إضافة nusuk_supervisor_sig — توقيع استلام المشرف من الإدارة (منفصل عن توقيع الحاج)
const SIG_FIELDS = ['nusuk_card_sig','nusuk_supervisor_sig','bracelet_sig'];
// v17.2.1: حقول لا تُستعاد عند undo (التوقيع ثابت في السجلات الأصلية — time فقط يُستعاد)
const SIG_FIELDS_NO_UNDO = new Set(['nusuk_card_sig','nusuk_supervisor_sig','bracelet_sig']);

// v17.3 + v22.0: خريطة الحقول الحساسة + قيمة القناع
const SENSITIVE_FIELD_MASKS = {
  nusuk_card_sig:       '[توقيع مسجّل]',
  nusuk_supervisor_sig: '[توقيع مسجّل]',
  bracelet_sig:         '[توقيع مسجّل]',
  password:             '[كلمة مرور مُعدَّلة]',
  password_hash:        '[كلمة مرور مُعدَّلة]'
};

/**
 * v17.3: قناع الحقول الحساسة في field_changes (idempotent).
 * DB يحفظ القيم الكاملة — audit يعرض قناعاً فقط.
 */
function _maskSensitiveInChanges(changes){
  if(!changes) return changes;
  const out = {};
  Object.keys(changes).forEach(k => {
    const mask = SENSITIVE_FIELD_MASKS[k];
    if(mask && changes[k] && changes[k].after){
      out[k] = {
        before: changes[k].before ? mask : null,
        after:  mask
      };
      if(changes[k].note) out[k].note = changes[k].note;
    } else {
      out[k] = changes[k];
    }
  });
  return out;
}

/**
 * v17.3: قناع snapshot كامل (للـ _created/_deleted). يُزيل الحقول الحساسة.
 */
function _maskSensitiveSnapshot(obj){
  if(!obj || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).forEach(k => {
    const mask = SENSITIVE_FIELD_MASKS[k];
    if(mask && obj[k]){ out[k] = mask; }
    else { out[k] = obj[k]; }
  });
  return out;
}

// Backward compatibility alias (v17.2 callers)
function _maskSigInChanges(changes){ return _maskSensitiveInChanges(changes); }

// v17.3: helpers تسميات الكيانات الإدارية
function _buildCampLabel(camp){
  if(!camp) return '—';
  const num  = camp.camp_num || camp.name || '?';
  const type = camp.camp_type || 'رجال';
  const loc  = camp.location || 'منى';
  return 'مخيم ' + num + ' — ' + type + ' (' + loc + ')';
}
function _buildGroupLabel(group){
  if(!group) return '—';
  const num  = group.num || group.group_num || '?';
  const name = group.name ? ' — ' + group.name : '';
  return 'فوج ' + num + name;
}
function _buildBusLabel(bus){
  if(!bus) return '—';
  const num   = bus.num || bus.bus_num || '?';
  const plate = bus.plate ? ' — ' + bus.plate : '';
  return 'حافلة ' + num + plate;
}
function _buildUserLabel(user){
  if(!user) return '—';
  const name     = user.name || '—';
  const username = user.username || '—';
  const role     = user.role || 'viewer';
  return name + ' (' + username + ') — ' + role;
}

// ═══════════════════════════════════════════════════════════════════════
// ===== v17.1: واجهة سجل العمليات (Audit Log UI) =====
// ═══════════════════════════════════════════════════════════════════════

window._auditState = {
  page: 1,
  pageSize: 50,
  total: 0,
  data: [],
  filters: {},
  loading: false,
  expanded: new Set()
};

// ─────── أنماط action_type ───────
const AUDIT_ACTION_STYLES = {
  update:      { icon:'🔄', label:'تحديث',        color:'#1a7a1a', bg:'rgba(46,125,50,0.10)' },
  bulk_update: { icon:'⚡', label:'تحديث جماعي',  color:'#b8860b', bg:'rgba(184,134,11,0.12)' },
  undo:        { icon:'↶',  label:'تراجع',         color:'#7a3fa8', bg:'rgba(122,63,168,0.12)' },
  insert:      { icon:'➕', label:'إنشاء',         color:'#1a5fa8', bg:'rgba(26,95,168,0.12)' },
  delete:      { icon:'🗑️', label:'حذف',           color:'#c00',    bg:'rgba(204,0,0,0.10)' }
};

const AUDIT_ENTITY_LABELS = {
  pilgrim:'حاج', camp:'مخيم', group:'فوج', bus:'حافلة',
  sysuser:'مستخدم نظام', survey:'استبيان', announcement:'تعميم', staff:'موظف'
};

// v17.1.1: حقول نُخفيها من UI فقط (DB + Undo يظلان كاملَين) — seat = نسخة من bed
const HIDDEN_AUDIT_FIELDS = new Set(['mina_seat','arafat_seat']);

// v17.2 + v17.3: تسميات المصادر — تُستخدم في ملخّص البطاقة + CSV export
// v20.1/v20.2: إضافة مصادر نسك الإدارية (bulk/receive/reopen)
const AUDIT_SOURCE_LABELS = {
  supervisor_bus:                   'تسجيل إركاب 🚌',
  supervisor_camp:                  'تسجيل وصول المخيم 🏕️',
  supervisor_nusuk:                 'تسليم بطاقة نسك 🪪',
  supervisor_bracelet:              'تسليم أسوارة 🚆',
  supervisor_bulk_receive:          'استلام جماعي 📦',
  admin_camps:                      'إدارة المخيمات 🏕️',
  admin_groups:                     'إدارة الأفواج 👥',
  admin_buses:                      'إدارة الحافلات 🚌',
  admin_users:                      'إدارة المستخدمين 👤',
  admin_nusuk_bulk:                 'تحديث جماعي نسك 📦',
  admin_nusuk_supervisor_receive:   'استلام مشرف للبطاقة 👤',
  admin_nusuk_pilgrim_receive:      'تسليم بطاقة للحاج 🪪',
  admin_nusuk_reopen:                    'فتح قفل بطاقة نسك 🔓',
  admin_nusuk_reopen_from_pilgrim:       'فتح قفل بطاقة نسك (من الحاج) 🔓',
  admin_nusuk_reopen_from_supervisor:    'فتح قفل بطاقة نسك (من المشرف) 🔓'
};

// ─────── صلاحيات ───────
function _canSeeAllAudit(){
  const r = window._currentUser?.role;
  return r === 'superadmin' || r === 'admin' || r === 'viewer';
}
function _canUndoAudit(){
  const r = window._currentUser?.role;
  return r === 'superadmin' || r === 'admin';
}

// ─────── Helpers ───────
function _esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _auditRelativeTime(ts){
  if(!ts) return '—';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if(diff < 5)    return 'الآن';
  if(diff < 60)   return 'قبل ' + diff + ' ثانية';
  if(diff < 3600) return 'قبل ' + Math.floor(diff/60) + ' دقيقة';
  if(diff < 86400) return 'قبل ' + Math.floor(diff/3600) + ' ساعة';
  if(diff < 604800) return 'قبل ' + Math.floor(diff/86400) + ' يوم';
  return new Date(ts).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' });
}
function _auditFormatFullTime(ts){
  if(!ts) return '—';
  try {
    return new Date(ts).toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' });
  } catch(_) { return String(ts); }
}
function _auditFieldLabel(f){
  const map = {
    bus_status:'حالة الإركاب', camp_status:'حالة الحضور',
    bus_num:'رقم الحافلة', group_num:'رقم الفوج',
    nusuk_card_status:'حالة بطاقة نسك',
    nusuk_card_sig:'توقيع الحاج (نسك)', nusuk_card_time:'وقت تسليم الحاج',
    nusuk_supervisor_sig:'توقيع المشرف (نسك)', nusuk_supervisor_time:'وقت استلام المشرف',
    nusuk_supervisor_ack_id:'معرّف إقرار المشرف',
    mina_camp:'مخيم منى', mina_bed:'سرير منى', mina_seat:'مقعد منى',
    arafat_camp:'مخيم عرفات', arafat_bed:'سرير عرفات', arafat_seat:'مقعد عرفات',
    supervisor_name:'اسم المشرف', supervisor_phone:'جوال المشرف',
    id_num:'رقم الهوية'
  };
  return map[f] || f;
}
function _auditFormatValue(v){
  if(v === null || v === undefined || v === '') return '<em style="color:#999">فارغ</em>';
  return _esc(v);
}

// ─────── Stats ───────
async function _renderAuditStats(){
  const el = document.getElementById('audit-stats');
  if(!el) return;
  try {
    const s = await window.DB.Audit.getStats();
    const card = (label, value, color) =>
      `<div style="background:#fff;border:1px solid ${color};border-radius:10px;padding:12px 14px">
         <div style="font-size:22px;font-weight:800;color:${color}">${value.toLocaleString('ar-EG')}</div>
         <div style="font-size:12px;color:#666;margin-top:3px">${label}</div>
       </div>`;
    el.innerHTML =
      card('📊 اليوم',         s.today,   '#1a5fa8') +
      card('🔄 تحديث اليوم',   s.updates, '#1a7a1a') +
      card('⚡ bulk اليوم',    s.bulks,   '#b8860b') +
      card('↶ مُرتجَع',        s.undones, '#7a3fa8');
  } catch(e){
    el.innerHTML = '<div style="color:#c00;font-size:12px">تعذّر جلب الإحصائيات: '+_esc(e.message)+'</div>';
  }
}

// ─────── قائمة المستخدمين للفلتر ───────
async function _populateAuditUserFilter(){
  const sel = document.getElementById('audit-f-user');
  if(!sel || sel.options.length > 1) return; // محمّل مسبقاً
  try {
    const users = await window.DB.SysUsers.getAll();
    const opts = [{username: SUPER_ADMIN.username, name: SUPER_ADMIN.name}, ...users];
    const seen = new Set();
    opts.forEach(u => {
      if(!u.username || seen.has(u.username)) return;
      seen.add(u.username);
      const o = document.createElement('option');
      o.value = u.username;
      o.textContent = (u.name || u.username) + (u.role ? ' ('+u.role+')' : '');
      sel.appendChild(o);
    });
  } catch(_){}
}

// ─────── الدالة الرئيسية ───────
async function renderAuditLog(){
  const results = document.getElementById('audit-results');
  const pag     = document.getElementById('audit-pagination');
  if(!results) return;

  // صلاحيات
  if(!_canSeeAllAudit() && window._currentUser?.role !== 'supervisor'){
    results.innerHTML = '<div style="padding:40px;text-align:center;color:#c00">ليس لديك صلاحية لعرض سجل العمليات.</div>';
    if(pag) pag.innerHTML = '';
    return;
  }

  results.innerHTML = '<div style="padding:40px;text-align:center;color:#888"><div style="font-size:32px">⏳</div><div style="margin-top:8px">جاري تحميل السجل...</div></div>';
  window._auditState.loading = true;

  await _populateAuditUserFilter();
  _renderAuditStats();

  // supervisor: يرى عملياته فقط
  const filters = Object.assign({}, window._auditState.filters, {
    page: window._auditState.page,
    pageSize: window._auditState.pageSize
  });
  if(window._currentUser?.role === 'supervisor'){
    filters.user_id = window._currentUser.username;
  }
  // v20.0: إخفاء عمليات المطوّر افتراضياً (إلا لو toggle مفعّل من المطوّر)
  if(!window._showDevAudit){
    filters.exclude_dev = true;
  }

  try {
    const res = await window.DB.Audit.getAll(filters);
    window._auditState.data     = res.data;
    window._auditState.total    = res.total;
    window._auditState.loading  = false;

    // v20.0: badge 🔓 إذا وضع المطوّر مفعّل (حصراً للمطوّر)
    const statsEl = document.getElementById('audit-stats');
    if(statsEl){
      const existingBadge = document.getElementById('dev-audit-badge');
      if(existingBadge) existingBadge.remove();
      if(window._showDevAudit && _isDevUser()){
        const badge = document.createElement('div');
        badge.id = 'dev-audit-badge';
        badge.style.cssText = 'background:#c00;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:10px;text-align:center';
        badge.textContent = '🔓 وضع المطوّر مفعّل — عمليات المطوّر ظاهرة';
        statsEl.parentNode.insertBefore(badge, statsEl);
      }
    }

    if(!res.data.length){
      results.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:#888;background:#fff;border:1px dashed #ddd;border-radius:12px">
          <div style="font-size:48px">📭</div>
          <div style="margin-top:12px;font-size:16px;font-weight:600">لا توجد عمليات مطابقة</div>
          <div style="margin-top:6px;font-size:13px">جرّب تخفيف الفلاتر أو توسيع النطاق الزمني.</div>
          <button onclick="clearAuditFilters()" style="margin-top:14px;background:var(--gold,#b8860b);color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-family:inherit">مسح الفلاتر</button>
        </div>`;
      if(pag) pag.innerHTML = '';
      return;
    }

    // تجميع زمني
    const groups = _groupAuditByDate(res.data);
    let html = '';
    Object.keys(groups).forEach(label => {
      html += `<div style="margin:18px 0 10px;font-weight:700;color:#555;font-size:13px;border-bottom:1px solid #eee;padding-bottom:6px">───── ${_esc(label)} (${groups[label].length}) ─────</div>`;
      groups[label].forEach(entry => { html += _buildAuditCard(entry); });
    });
    results.innerHTML = html;
    _renderAuditPagination();
  } catch(e){
    console.error('[renderAuditLog]', e);
    results.innerHTML = '<div style="padding:40px;text-align:center;color:#c00">خطأ في تحميل السجل: '+_esc(e.message)+'</div>';
    if(pag) pag.innerHTML = '';
    window._auditState.loading = false;
  }
}

// ─────── تجميع زمني ───────
function _groupAuditByDate(entries){
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  const groups = { 'اليوم':[], 'أمس':[], 'هذا الأسبوع':[], 'أقدم':[] };
  entries.forEach(e => {
    const t = new Date(e.timestamp);
    if(t >= today)          groups['اليوم'].push(e);
    else if(t >= yesterday) groups['أمس'].push(e);
    else if(t >= weekAgo)   groups['هذا الأسبوع'].push(e);
    else                    groups['أقدم'].push(e);
  });
  // احذف الفارغة
  Object.keys(groups).forEach(k => { if(!groups[k].length) delete groups[k]; });
  return groups;
}

// ─────── بطاقة واحدة ───────
function _buildAuditCard(entry){
  const style = AUDIT_ACTION_STYLES[entry.action_type] || { icon:'•', label:entry.action_type, color:'#888', bg:'#f5f5f5' };
  const entityLbl = AUDIT_ENTITY_LABELS[entry.entity_type] || entry.entity_type;
  const isExpanded = window._auditState.expanded.has(entry.id);
  // v17.3: استبعاد create/delete/undo من undo (كلها !reversible أصلاً، تأكيد إضافي)
  const canUndo = _canUndoAudit() && entry.reversible && !entry.undone
                  && !['undo','create','delete'].includes(entry.action_type);

  // ملخص التغييرات (أبرزها) — v17.1.1: استبعاد الحقول المخفية + v17.3: _created/_deleted
  let summary = '';
  if(entry.field_changes && typeof entry.field_changes === 'object'){
    if(entry.field_changes._created){
      summary = '<span style="color:#1a7a1a">🆕 عنصر جديد</span>';
    } else if(entry.field_changes._deleted){
      summary = '<span style="color:#c00">🗑️ تم حذف العنصر</span>';
    } else {
      const keys = Object.keys(entry.field_changes).filter(k => !HIDDEN_AUDIT_FIELDS.has(k));
      const first = keys.slice(0, 2).map(k => {
        const fc = entry.field_changes[k];
        if(fc && fc.note === 'bulk') return _auditFieldLabel(k) + ': ← ' + _auditFormatValue(fc.after);
        return _auditFieldLabel(k) + ': ' + _auditFormatValue(fc.before) + ' ← ' + _auditFormatValue(fc.after);
      }).join(' • ');
      summary = first + (keys.length > 2 ? ' <span style="color:#999">(+' + (keys.length - 2) + ')</span>' : '');
    }
  }

  // شريط "مُرتجَع"
  const undoneBadge = entry.undone
    ? `<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-right:6px">✓ مُرتجَع</span>`
    : '';

  // عنوان — v17.2/v17.3: إذا المصدر supervisor_*/admin_* نستخدم تسمية مخصّصة
  const src = entry.metadata?.source || '';
  const srcLbl = AUDIT_SOURCE_LABELS[src];
  let title;
  if(entry.action_type === 'create'){
    title = `➕ إنشاء — ${_esc(entry.entity_label || '—')}`;
  } else if(entry.action_type === 'delete'){
    title = `🗑️ حذف — ${_esc(entry.entity_label || '—')}`;
  } else if(entry.action_type === 'bulk_update'){
    title = srcLbl
      ? `${srcLbl} — تحديث جماعي لـ ${entry.bulk_count || '—'} حاج`
      : `⚡ تحديث جماعي — ${entry.bulk_count || '—'} حاج`;
  } else if(entry.action_type === 'undo'){
    title = `↶ تراجع — ${_esc(entry.entity_label || '—')}`;
  } else if(srcLbl){
    title = `${srcLbl} — ${_esc(entry.entity_label || '—')}`;
  } else {
    title = `${style.icon} ${style.label} — ${_esc(entry.entity_label || '—')}`;
  }
  // v17.2: badge خاص لإجراءات المشرف
  const supervisorBadge = src.startsWith('supervisor_')
    ? `<span style="background:var(--brown,#7a4500);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-right:6px">👨‍💼 مشرف</span>`
    : '';

  return `
    <article role="article" style="background:#fff;border:1px solid var(--border,#f0e8d0);border-left:4px solid ${style.color};border-radius:10px;padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="font-weight:700;color:#3d2000;font-size:14px">${undoneBadge}${supervisorBadge}${title}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">
            👤 ${_esc(entry.user_name || '—')}
            <span style="color:#ccc">•</span>
            <span style="background:${style.bg};color:${style.color};padding:1px 7px;border-radius:8px;font-size:11px;font-weight:600">${_esc(entityLbl)}</span>
            <span style="color:#ccc">•</span>
            ⏰ <span title="${_esc(_auditFormatFullTime(entry.timestamp))}">${_esc(_auditRelativeTime(entry.timestamp))}</span>
          </div>
          ${summary ? `<div style="font-size:13px;color:#444;margin-top:8px;line-height:1.6">📝 ${summary}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="_expandAuditCard(${entry.id})" aria-expanded="${isExpanded}"
                  style="background:#fff;border:1px solid #ddd;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">
            ${isExpanded ? '▲ إخفاء' : '▼ تفاصيل'}
          </button>
          ${canUndo ? `<button onclick="_undoAuditEntry(${entry.id})" style="background:#fff3e0;border:1px solid #ff9800;color:#b35900;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">↶ تراجع</button>` : ''}
        </div>
      </div>
      <div id="audit-details-${entry.id}" style="display:${isExpanded ? 'block' : 'none'};margin-top:12px;padding-top:12px;border-top:1px dashed #eee"></div>
    </article>`;
}

// v17.3: عرض snapshot كامل لعنصر (create/delete) كجدول key/value
const _SNAPSHOT_EXCLUDE = new Set(['id','created_at','updated_at']);
function _renderEntitySnapshot(title, obj, color){
  if(!obj || typeof obj !== 'object') return '';
  const keys = Object.keys(obj).filter(k => !_SNAPSHOT_EXCLUDE.has(k));
  let html = `<div style="font-size:13px;font-weight:700;color:${color};margin-bottom:6px">${title}:</div>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px">`;
  keys.forEach(k => {
    const v = obj[k];
    const label = _auditFieldLabel(k);
    html += `<tr>
      <td style="padding:6px 8px;border:1px solid #eee;font-weight:600;width:40%;background:#faf7ee">${_esc(label)}</td>
      <td style="padding:6px 8px;border:1px solid #eee">${_auditFormatValue(v)}</td>
    </tr>`;
  });
  html += `</table>`;
  return html;
}

// ─────── Expand / Collapse تفاصيل ───────
async function _expandAuditCard(id){
  const container = document.getElementById('audit-details-'+id);
  if(!container) return;
  const entry = window._auditState.data.find(e => e.id === id);
  if(!entry) return;

  // toggle
  if(window._auditState.expanded.has(id)){
    window._auditState.expanded.delete(id);
    container.style.display = 'none';
    const btn = container.previousElementSibling?.querySelector('button[aria-expanded]');
    if(btn){ btn.setAttribute('aria-expanded','false'); btn.innerHTML = '▼ تفاصيل'; }
    return;
  }
  window._auditState.expanded.add(id);
  container.style.display = 'block';
  const btn = container.previousElementSibling?.querySelector('button[aria-expanded]');
  if(btn){ btn.setAttribute('aria-expanded','true'); btn.innerHTML = '▲ إخفاء'; }

  // جدول التغييرات — v17.1.1: استبعاد المخفية + v17.3: _created/_deleted
  let html = '';
  if(entry.field_changes && Object.keys(entry.field_changes).length){
    // v17.3: create / delete — snapshot كامل
    if(entry.field_changes._created && entry.field_changes._created.after){
      html += _renderEntitySnapshot('🆕 بيانات العنصر الجديد', entry.field_changes._created.after, '#1a7a1a');
    } else if(entry.field_changes._deleted && entry.field_changes._deleted.before){
      html += _renderEntitySnapshot('🗑️ بيانات العنصر قبل الحذف', entry.field_changes._deleted.before, '#c00');
    } else {
      const visibleKeys = Object.keys(entry.field_changes).filter(k => !HIDDEN_AUDIT_FIELDS.has(k));
      if(visibleKeys.length){
        html += `<div style="font-size:13px;font-weight:700;color:#555;margin-bottom:6px">📝 التغييرات:</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px">
          <thead><tr style="background:#faf7ee">
            <th style="text-align:right;padding:6px 8px;border:1px solid #eee">الحقل</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #eee">قبل</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #eee">بعد</th>
          </tr></thead><tbody>`;
        visibleKeys.forEach(k => {
          const fc = entry.field_changes[k];
          const note = fc.note ? ` <span style="color:#999;font-size:11px">(${_esc(fc.note)})</span>` : '';
          html += `<tr>
            <td style="padding:6px 8px;border:1px solid #eee;font-weight:600">${_esc(_auditFieldLabel(k))}${note}</td>
            <td style="padding:6px 8px;border:1px solid #eee;color:#c00">${_auditFormatValue(fc.before)}</td>
            <td style="padding:6px 8px;border:1px solid #eee;color:#1a7a1a">${_auditFormatValue(fc.after)}</td>
          </tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<div style="color:#888;font-size:12px;font-style:italic;padding:8px 0">تغييرات نظامية داخلية فقط.</div>`;
      }
    }
  }

  // bulk IDs → أسماء الحجاج
  if((entry.action_type === 'bulk_update' || entry.action_type === 'undo') && Array.isArray(entry.bulk_ids) && entry.bulk_ids.length){
    const count = entry.bulk_ids.length;
    const ids = entry.bulk_ids.slice(0, 10);
    let namesHtml = ids.map(pid => {
      const p = (window.ALL_DATA || []).find(r => String(r['_supabase_id']) === String(pid));
      const label = p ? _buildPilgrimLabel(p) : ('#' + pid);
      return `<li style="padding:3px 0">${_esc(label)}</li>`;
    }).join('');
    if(count > 10) namesHtml += `<li style="padding:3px 0;color:#999">... و ${count - 10} آخرين</li>`;
    html += `<div style="font-size:13px;font-weight:700;color:#555;margin:10px 0 6px">👥 الحجاج المتأثّرون (${count}):</div>
             <ul style="margin:0;padding-right:20px;font-size:13px">${namesHtml}</ul>`;
  }

  // metadata
  const md = entry.metadata || {};
  const metaParts = [];
  if(md.source)        metaParts.push(`📂 <strong>المصدر:</strong> ${_esc(md.source)}`);
  if(md.bulk_session)  metaParts.push(`🔗 <strong>جلسة bulk:</strong> ${_esc(String(md.bulk_session).slice(0,8))}...`);
  if(entry.session_id) metaParts.push(`🆔 <strong>جلسة:</strong> ${_esc(String(entry.session_id).slice(0,8))}...`);
  if(entry.undone)     metaParts.push(`✓ <strong>مُرتجَع بواسطة:</strong> ${_esc(entry.undone_by || '—')} في ${_esc(_auditFormatFullTime(entry.undone_at))}`);
  if(metaParts.length){
    html += `<div style="background:#faf7ee;border-radius:6px;padding:8px 12px;font-size:12px;color:#555;line-height:1.8;margin-top:8px">${metaParts.join('<br>')}</div>`;
  }

  container.innerHTML = html || '<div style="color:#999;font-size:12px">لا تفاصيل إضافية.</div>';
}

// ─────── Filters ───────
function applyAuditFilters(){
  const search = document.getElementById('audit-search')?.value.trim() || '';
  const action = document.getElementById('audit-f-action')?.value || '';
  const entity = document.getElementById('audit-f-entity')?.value || '';
  const user   = document.getElementById('audit-f-user')?.value || '';
  const from   = document.getElementById('audit-f-from')?.value || '';
  const to     = document.getElementById('audit-f-to')?.value || '';

  const filters = {};
  if(search)   filters.search = search;
  if(action)   filters.action_type = action;
  if(entity)   filters.entity_type = entity;
  if(user)     filters.user_id = user;
  if(from)     filters.dateFrom = new Date(from + 'T00:00:00').toISOString();
  if(to){
    const toEnd = new Date(to + 'T00:00:00');
    toEnd.setDate(toEnd.getDate() + 1);
    filters.dateTo = toEnd.toISOString();
  }

  window._auditState.filters = filters;
  window._auditState.page = 1;
  window._auditState.expanded.clear();
  renderAuditLog();
}

function clearAuditFilters(){
  ['audit-search','audit-f-action','audit-f-entity','audit-f-user','audit-f-from','audit-f-to'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  window._auditState.filters = {};
  window._auditState.page = 1;
  window._auditState.expanded.clear();
  renderAuditLog();
}

// ─────── Pagination ───────
function _renderAuditPagination(){
  const el = document.getElementById('audit-pagination');
  if(!el) return;
  const { page, pageSize, total } = window._auditState;
  const pages = Math.ceil(total / pageSize);
  if(pages <= 1){
    el.innerHTML = `<div style="color:#888;font-size:13px">عرض ${total.toLocaleString('ar-EG')} ${total===1?'عملية':'عمليات'}</div>`;
    return;
  }
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const btn = (label, targetPage, active) => {
    const style = active
      ? 'background:var(--gold,#b8860b);color:#fff;border:none;'
      : 'background:#fff;color:#555;border:1px solid #ddd;';
    return `<button onclick="_auditGoToPage(${targetPage})" style="${style}min-width:36px;padding:7px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">${label}</button>`;
  };
  const ellipsis = () => '<span style="padding:0 6px;color:#999">…</span>';

  // عدد معقول من الأزرار: الأولى، الحالية ± 2، الأخيرة
  const show = new Set([1, pages, page, page-1, page+1, page-2, page+2]);
  const validPages = [...show].filter(p => p >= 1 && p <= pages).sort((a,b)=>a-b);

  let btnsHtml = '';
  btnsHtml += `<button onclick="_auditGoToPage(${page-1})" ${page<=1?'disabled':''} style="background:#fff;color:#555;border:1px solid #ddd;padding:7px 12px;border-radius:6px;cursor:${page<=1?'not-allowed':'pointer'};opacity:${page<=1?'0.4':'1'};font-family:inherit;font-size:13px">← السابق</button>`;

  let prev = 0;
  validPages.forEach(p => {
    if(p - prev > 1) btnsHtml += ellipsis();
    btnsHtml += btn(p.toLocaleString('ar-EG'), p, p === page);
    prev = p;
  });

  btnsHtml += `<button onclick="_auditGoToPage(${page+1})" ${page>=pages?'disabled':''} style="background:#fff;color:#555;border:1px solid #ddd;padding:7px 12px;border-radius:6px;cursor:${page>=pages?'not-allowed':'pointer'};opacity:${page>=pages?'0.4':'1'};font-family:inherit;font-size:13px">التالي →</button>`;

  el.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">${btnsHtml}</div>
    <div style="width:100%;text-align:center;color:#888;font-size:12px;margin-top:8px">
      عرض ${from.toLocaleString('ar-EG')}-${to.toLocaleString('ar-EG')} من ${total.toLocaleString('ar-EG')}
    </div>`;
}
function _auditGoToPage(p){
  const pages = Math.ceil(window._auditState.total / window._auditState.pageSize);
  if(p < 1 || p > pages) return;
  window._auditState.page = p;
  window._auditState.expanded.clear();
  renderAuditLog();
}

// ─────── تصدير CSV ───────
async function exportAuditCSV(){
  if(!window._auditState || window._auditState.loading) return showToast('جاري التحميل، انتظر...', 'warning');
  if(!window._auditState.total) return showToast('لا توجد بيانات للتصدير', 'warning');

  showToast('⏳ جاري إعداد الملف...', 'info');
  try {
    // اجلب كل النتائج بالفلاتر الحالية (بدون pagination)
    const filters = Object.assign({}, window._auditState.filters, { page: 1, pageSize: 10000 });
    if(window._currentUser?.role === 'supervisor') filters.user_id = window._currentUser.username;
    const res = await window.DB.Audit.getAll(filters);
    const rows = res.data || [];
    if(!rows.length){ showToast('لا توجد نتائج', 'warning'); return; }

    const esc = v => {
      const s = v == null ? '' : String(v);
      return /["\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['التاريخ والوقت','المستخدم','الدور','النوع','الكيان','التسمية','ملخّص التغييرات','المصدر','مُرتجَع'];
    const lines = [header.map(esc).join(',')];
    rows.forEach(e => {
      let summary = '';
      if(e.field_changes){
        // v17.1.1: استبعاد الحقول المخفية من الملخّص
        summary = Object.keys(e.field_changes)
          .filter(k => !HIDDEN_AUDIT_FIELDS.has(k))
          .map(k => {
            const fc = e.field_changes[k];
            return _auditFieldLabel(k) + ': ' + (fc.before == null ? '—' : fc.before) + ' ← ' + (fc.after == null ? '—' : fc.after);
          }).join(' | ');
      }
      const src = e.metadata?.source || '';
      const opLabel = AUDIT_SOURCE_LABELS[src] || (AUDIT_ACTION_STYLES[e.action_type]?.label) || e.action_type;
      lines.push([
        _auditFormatFullTime(e.timestamp),
        e.user_name || e.user_id || '—',
        e.user_role || '—',
        opLabel,
        AUDIT_ENTITY_LABELS[e.entity_type] || e.entity_type,
        e.entity_label || '—',
        summary,
        src || '—',
        e.undone ? 'نعم' : 'لا'
      ].map(esc).join(','));
    });

    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'audit_log_' + ts + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ تم تصدير ' + rows.length + ' عملية', 'success');
  } catch(e){
    console.error('[exportAuditCSV]', e);
    showToast('❌ فشل التصدير: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ===== منطق التراجع الممتد (Extended Undo) =====
// ═══════════════════════════════════════════════════════════════════════

/**
 * يعكس field_changes: before ↔ after
 */
function _invertFieldChanges(fc){
  if(!fc || typeof fc !== 'object') return null;
  const out = {};
  Object.keys(fc).forEach(k => {
    out[k] = { before: fc[k].after, after: fc[k].before };
    if(fc[k].note) out[k].note = fc[k].note;
  });
  return out;
}

/**
 * يُقارن القيم الحالية لحاج مع "after" المتوقّع من field_changes.
 * يُرجع مصفوفة تعارضات (field, current, expected).
 */
function _detectUndoConflicts(current, fieldChanges){
  if(!current || !fieldChanges) return [];
  const conflicts = [];
  Object.keys(fieldChanges).forEach(k => {
    if(SIG_FIELDS_NO_UNDO.has(k)) return; // v17.2.1: التوقيع لا يُستعاد → لا نفحصه
    const expected = fieldChanges[k].after;
    const cur = current[k];
    const normExp = (expected == null ? '' : String(expected).trim());
    const normCur = (cur == null ? '' : String(cur).trim());
    if(normExp !== normCur){
      conflicts.push({ field: k, current: cur, expected: expected });
    }
  });
  return conflicts;
}

/**
 * استعادة حاج واحد (pilgrim_id) من field_changes.
 * @returns {Promise<{ok:boolean, error?:string, conflict?:boolean}>}
 */
async function _undoPilgrimEntry(pilgrimId, fieldChanges, allowForce){
  try {
    const currentArr = await window.DB.Pilgrims.getAll();
    const current = currentArr.find(p => String(p.id) === String(pilgrimId));
    if(!current) return { ok:false, error:'لم يُعثر على الحاج' };
    const conflicts = _detectUndoConflicts(current, fieldChanges);
    if(conflicts.length && !allowForce){
      return { ok:false, conflict:true, conflicts };
    }
    // v17.2.1: استبعاد حقول التوقيع (تبقى في DB كسجلّ رسمي)
    let hadSig = false;
    const updates = {};
    Object.keys(fieldChanges).forEach(k => {
      if(SIG_FIELDS_NO_UNDO.has(k)){ hadSig = true; return; }
      updates[k] = fieldChanges[k].before;
    });
    if(Object.keys(updates).length === 0){
      // كل التغييرات كانت حقول sig — لا شيء يُستعاد
      return { ok:true, hadSig, noop:true };
    }
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    return { ok:true, hadSig };
  } catch(e){
    return { ok:false, error: e.message };
  }
}

/**
 * الدالة الرئيسية للتراجع — تدعم update فردي و bulk_update.
 */
async function _undoAuditEntry(id){
  if(!_canUndoAudit()) return showToast('ليس لديك صلاحية التراجع', 'warning');
  window._lastBulkSnapshot = null; // لا تعارض مع toast v16.2

  const entry = await window.DB.Audit.getById(id);
  if(!entry)         return showToast('لم يُعثر على السجل', 'error');
  if(entry.undone)   return showToast('سبق التراجع عن هذه العملية', 'warning');
  if(!entry.reversible) return showToast('هذه العملية غير قابلة للتراجع', 'warning');

  // ───── bulk_update ─────
  if(entry.action_type === 'bulk_update'){
    const bulkSess = entry.metadata?.bulk_session;
    if(!bulkSess){
      return showToast('السجل الجماعي لا يحوي bulk_session — استخدم الصفوف الفردية', 'warning', 6000);
    }
    const related = await window.DB.Audit.getBulkRelated(bulkSess);
    if(!related.length){
      return showToast('لم يُعثر على صفوف فردية مرتبطة', 'error');
    }
    const active = related.filter(r => !r.undone);
    if(!active.length){
      return showToast('كل الصفوف الفردية مُرتجَعة مسبقاً', 'warning');
    }

    // فحص التعارضات
    const allPilgrims = await window.DB.Pilgrims.getAll();
    const conflicted = [], consistent = [];
    active.forEach(r => {
      const p = allPilgrims.find(x => String(x.id) === String(r.entity_id));
      if(!p){ conflicted.push({ entry:r, reason:'not_found' }); return; }
      const c = _detectUndoConflicts(p, r.field_changes);
      if(c.length) conflicted.push({ entry:r, pilgrim:p, conflicts:c });
      else consistent.push({ entry:r, pilgrim:p });
    });

    // تأكيد + خيارات
    const title = 'تأكيد التراجع الجماعي';
    const description = conflicted.length
      ? `سيتم التراجع عن ${active.length} حاج — منهم ${conflicted.length} تم تعديل بياناتهم بعد العملية (تعارض).`
      : `سيتم التراجع عن ${active.length} حاج من التحديث الجماعي. القيم الحالية متّسقة مع السجل.`;
    const items = conflicted.slice(0, 5).map(c => ({
      icon:'⚠️',
      label: _buildPilgrimLabel(c.pilgrim || { id_num: c.entry.entity_id }),
      value: c.reason === 'not_found' ? 'غير موجود' : (c.conflicts.length + ' حقل متعارض')
    }));
    if(conflicted.length > 5) items.push({ icon:'…', label:'وآخرون:', value:(conflicted.length-5) + ' حاج' });

    const actions = [];
    if(consistent.length) actions.push({ label:'تراجع المتّسقين فقط ('+consistent.length+')', value:'consistent', emoji:'✓', variant:'primary', color:'success' });
    actions.push({ label:'تراجع بالقوة للكل ('+active.length+')', value:'force', emoji:'⚠️', variant:'secondary', color:'warning' });
    actions.push({ label:'إلغاء', value:null, variant:'cancel' });

    const decision = await showActionModal({
      type: conflicted.length ? 'warning' : 'info',
      title,
      description,
      items: items.length ? items : undefined,
      actions
    });
    if(!decision) return;

    const toProcess = decision === 'force' ? active : consistent.map(c => c.entry);
    if(!toProcess.length){ showToast('لا يوجد ما يُعاد', 'warning'); return; }

    if(toProcess.length > 10) showToast(`⏳ جاري التراجع عن ${toProcess.length} حاج...`, 'info');

    let ok = 0, fail = 0, sigPreserved = 0;
    const doneIds = [];
    for(const r of toProcess){
      const res = await _undoPilgrimEntry(r.entity_id, r.field_changes, true);
      if(res.ok){
        ok++;
        if(res.hadSig) sigPreserved++;
        doneIds.push(r.entity_id);
        try { await window.DB.Audit.markUndone(r.id, window._currentUser.username); } catch(_){}
      } else {
        fail++;
        console.error('[undo]', r.entity_id, res.error);
      }
    }
    // علّم الصف الجماعي مُرتجَعاً (حتى لو جزئي)
    try { await window.DB.Audit.markUndone(entry.id, window._currentUser.username); } catch(_){}

    // سجّل audit جديد من نوع undo
    _recordAudit({
      action_type: 'undo',
      entity_type: 'pilgrim',
      entity_id:   null,
      entity_label: `تراجع جماعي: ${ok} حاج — ${_auditFieldLabel(entry.metadata?.bulk_target_field || '—')}`,
      field_changes: _invertFieldChanges(entry.field_changes),
      bulk_ids: doneIds,
      bulk_count: ok,
      metadata: {
        source: 'audit_ui',
        bulk_session: bulkSess,
        undone_log_id: entry.id,
        force: decision === 'force',
        failed_count: fail,
        sig_preserved_count: sigPreserved
      }
    });

    const sigNote = sigPreserved ? ` — التوقيع محفوظ لـ ${sigPreserved} حاج` : '';
    showToast(fail === 0
      ? `✅ تم التراجع عن ${ok} حاج${sigNote}`
      : `⚠️ نجح ${ok}، فشل ${fail} — راجع console${sigNote}`, fail === 0 ? 'success' : 'warning', 6000);
    await loadData(); // تحديث ALL_DATA
    renderAuditLog();
    return;
  }

  // ───── update فردي ─────
  if(entry.action_type === 'update' && entry.entity_type === 'pilgrim'){
    const allPilgrims = await window.DB.Pilgrims.getAll();
    const current = allPilgrims.find(p => String(p.id) === String(entry.entity_id));
    if(!current){
      return showToast('الحاج غير موجود في DB', 'error');
    }
    const conflicts = _detectUndoConflicts(current, entry.field_changes);

    let force = false;
    const items = [
      { icon:'👤', label:'الحاج:', value: _buildPilgrimLabel(current) },
      { icon:'👨‍💼', label:'نفّذها:', value: entry.user_name || '—' },
      { icon:'⏰', label:'منذ:',    value: _auditRelativeTime(entry.timestamp) }
    ];
    if(conflicts.length){
      conflicts.slice(0, 5).forEach(c => items.push({
        icon:'⚠️',
        label: _auditFieldLabel(c.field) + ':',
        value: 'متوقّع "' + (c.expected == null ? 'فارغ' : c.expected) + '" • حالي "' + (c.current == null ? 'فارغ' : c.current) + '"'
      }));
    }
    const decision = await showActionModal({
      type: conflicts.length ? 'warning' : 'info',
      title: conflicts.length ? 'تعارض بيانات' : 'تأكيد التراجع',
      description: conflicts.length
        ? 'تم تعديل هذا السجل بعد العملية. هل تريد التراجع بالقوة؟'
        : 'سيُستعاد السجل إلى حالته قبل هذه العملية.',
      items,
      actions: conflicts.length
        ? [{label:'تراجع بالقوة', value:'force', emoji:'⚠️', variant:'primary', color:'warning'},{label:'إلغاء', value:null, variant:'cancel'}]
        : [{label:'تأكيد التراجع', value:'ok', emoji:'↶', variant:'primary', color:'success'},{label:'إلغاء', value:null, variant:'cancel'}]
    });
    if(!decision) return;
    force = decision === 'force';

    const res = await _undoPilgrimEntry(entry.entity_id, entry.field_changes, force);
    if(!res.ok){
      return showToast('فشل التراجع: ' + (res.error || 'خطأ غير محدّد'), 'error');
    }

    try { await window.DB.Audit.markUndone(entry.id, window._currentUser.username); } catch(_){}

    _recordAudit({
      action_type: 'undo',
      entity_type: entry.entity_type,
      entity_id:   entry.entity_id,
      entity_label: entry.entity_label,
      field_changes: _invertFieldChanges(entry.field_changes),
      metadata: {
        source: 'audit_ui',
        undone_log_id: entry.id,
        force,
        sig_preserved: !!res.hadSig
      }
    });

    // v17.2.1: toast خاص إذا فيه sig محفوظ
    if(res.hadSig){
      showToast('تم التراجع — التوقيع محفوظ في السجلات الأصلية', 'info', 5000);
    } else {
      showToast('✅ تم التراجع بنجاح', 'success');
    }
    await loadData();
    renderAuditLog();
    return;
  }

  // ───── undo على undo (re-apply) أو أنواع أخرى ─────
  return showToast('هذا النوع غير مدعوم للتراجع حالياً', 'warning');
}

// ═══════════════════════════════════════════════════════════════════════
// ===== v20.0: Keyboard toggle — Ctrl+Shift+D للمطوّر فقط =====
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if(!(e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd'))) return;
  if(!_isDevUser()) return; // حماية: فقط المطوّر
  e.preventDefault();
  window._showDevAudit = !window._showDevAudit;
  const msg = window._showDevAudit
    ? '🔓 وضع المطوّر: عمليات المطوّر ظاهرة'
    : '🔒 وضع المطوّر: عمليات المطوّر مخفيّة';
  if(typeof showToast === 'function') showToast(msg, 'info', 3000);
  // إعادة رسم Audit tab لو مفتوح
  const auditPanel = document.getElementById('tab-audit');
  if(auditPanel && auditPanel.style.display !== 'none' && typeof renderAuditLog === 'function'){
    renderAuditLog();
  }
  // إعادة رسم Dashboard activity لو الـ tab مفتوح
  const dashPanel = document.getElementById('tab-dashboard');
  if(dashPanel && dashPanel.style.display !== 'none' && typeof _renderDashActivity === 'function'){
    _renderDashActivity();
  }
});
