// ═══════════════════════════════════════════════════════════════════════
// Excel Import Module — v11.5 Phase 4a/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Constants: COLUMN_MAP, MANUAL_FIELDS, DB_FIELDS
//   - State: window._importData, _importUnknownCols, _importSkipCols, _importAddCols
//   - Functions: analyzeImportFile, markColSkip, markColAdd, analyzeChanges, executeImport, resetImport
//
// Dependencies (globals):
//   - ui-helpers.js: showToast, showConfirm
//   - admin.html:    loadData, loadSavedTheme
//   - supabase.js:   window.DB.Pilgrims.insert/update
//   - CDN:           XLSX (sheet-to-json)
// ═══════════════════════════════════════════════════════════════════════

// ===== استيراد بيانات المنصة =====

// خريطة الأعمدة: Excel → Supabase
const COLUMN_MAP = {
  'رقم الحجز':               'booking_num',
  'رقم الهوية':              'id_num',
  'رقم الجوال':              'mobile',
  'المدينة':                 'city',
  'رقم المخيم':              'camp_num',
  'نوع الحاج':               'pilgrim_type',
  'اسم الحاج':               'name',
  'الجنس':                   'gender',
  'تاريخ الميلاد':           'birth_date',
  'الجنسية':                 'nationality',
  'نوع الباقة':              'package_type',
  'اسم النمط':               'pattern_name',
  'نوع المواصلات':            'transport_type',
  'رقم الترخيص':             'license_num',
  'اسم الشركه':              'company_name',
  'الحجز عن طريق':           'booking_via',
  'تاريخ الحجز':             'booking_date',
  'حالة الحجز':              'booking_status',
  'آلية الدفع':              'payment_method',
  'حالة الدفع':              'payment_status',
  'حالة التصريح':            'permit_status',
  'حالة تسليم البطاقة':      'card_status',
  'حالة الإركاب':            'bus_status',
  'حالة الحضور في المخيم':   'camp_status'
};

// الحقول اليدوية التي لا تُلمس عند الاستيراد
const MANUAL_FIELDS = ['mina_camp','mina_bed','mina_seat','arafat_camp','arafat_bed','arafat_seat','group_num','bus_num','supervisor_name','supervisor_phone','nusuk_card_status','nusuk_card_sig','nusuk_card_time','bracelet_sig','bracelet_time'];

const DB_FIELDS = new Set([
  'booking_num','id_num','name','gender','nationality','mobile','city',
  'camp_num','pattern_name','transport_type','booking_status','payment_status',
  'permit_status','card_status','bus_status','camp_status',
  'mina_camp','mina_bed','mina_seat','arafat_camp','arafat_bed','arafat_seat',
  'group_num','bus_num','supervisor_name','supervisor_phone',
  'nusuk_card_status','nusuk_card_sig','nusuk_card_time','bracelet_sig','bracelet_time',
  'change_log'
]);

window._importData = null;
window._importUnknownCols = [];
window._importSkipCols = new Set();
window._importAddCols = new Set();

async function analyzeImportFile(input) {
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  document.getElementById('import-filename').textContent = '📄 ' + file.name;

  // قراءة Excel
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

  if(!rows.length){ showToast('الملف فارغ', 'error'); return; }

  const excelCols = Object.keys(rows[0]);
  const known = [], unknown = [];

  excelCols.forEach(col => {
    if(COLUMN_MAP[col]) known.push(col);
    else unknown.push(col);
  });

  window._importUnknownCols = unknown;
  window._importSkipCols = new Set();
  window._importAddCols = new Set();

  // عرض تحليل الأعمدة
  let colHtml = '<div style="display:flex;flex-direction:column;gap:6px">';
  colHtml += '<div style="color:#1a7a1a;font-size:13px">✅ أعمدة معروفة (' + known.length + '): ' + known.join('، ') + '</div>';
  if(unknown.length) {
    colHtml += '<div style="color:#c07000;font-size:13px;margin-top:6px">⚠️ أعمدة جديدة غير معروفة (' + unknown.length + '):</div>';
    unknown.forEach((col,ci) => {
      window['_importCol_'+ci] = col;
      colHtml += '<div style="display:flex;align-items:center;gap:10px;background:#fffbf0;padding:8px 12px;border-radius:8px;border:1px solid #f0e8d0">' +
        '<span style="flex:1;font-size:13px;color:#7a4500">📌 ' + col + '</span>' +
        '<button onclick="markColSkip(this,window._importCol_' + ci + ')" style="padding:5px 12px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">تجاهل</button>' +
        '<button onclick="markColAdd(this,window._importCol_' + ci + ')" style="padding:5px 12px;background:#1a5fa8;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit">إضافة للنظام</button>' +
        '</div>';
    });
  }
  colHtml += '</div>';
  document.getElementById('import-columns-body').innerHTML = colHtml;
  document.getElementById('import-columns-result').style.display = 'block';

  // تحليل التغييرات مقارنةً بقاعدة البيانات
  await analyzeChanges(rows);
}

function markColSkip(btn, col) {
  window._importSkipCols.add(col);
  btn.parentElement.style.opacity = '0.4';
  btn.parentElement.style.pointerEvents = 'none';
}

function markColAdd(btn, col) {
  window._importSkipCols.delete(col);
  window._importAddCols.add(col);
  btn.style.background = '#1a7a1a';
  btn.style.pointerEvents = 'none';
  btn.textContent = '✅ ستُضاف';
}

async function analyzeChanges(rows) {
  showToast('⏳ جاري تحليل التغييرات...', 'info');
  const existingMap = {};
  ALL_DATA.forEach(p => { if(p['رقم الهوية']) existingMap[String(p['رقم الهوية'])] = p; });
  const newOnes = [], cancelled = [], updated = [], unchanged = [];

  rows.forEach(row => {
    const idNum = String(row['رقم الهوية']||'').trim();
    if(!idNum) return;
    const ex = existingMap[idNum];
    if(!ex) { newOnes.push(row); return; }
    const wasActive = (ex['حالة الحجز']||'') !== 'ملغي';
    const nowCancelled = (row['حالة الحجز']||'') === 'ملغي';
    if(wasActive && nowCancelled) {
      cancelled.push({row, existing:ex, hasHousing: ex['mina_camp']||ex['arafat_camp']});
    } else {
      const changedFields = {};
      Object.entries(COLUMN_MAP).forEach(([ar,en]) => {
        if(MANUAL_FIELDS.includes(en)||!DB_FIELDS.has(en)) return;
        const nv = String(row[ar]||'').trim(), ov = String(ex[ar]||ex[en]||'').trim();
        if(nv !== ov) changedFields[en] = {oldVal:ov, newVal:nv, label:ar};
      });
      if(Object.keys(changedFields).length) updated.push({row, existing:ex, changedFields});
      else unchanged.push(row);
    }
  });

  // تصنيف التحديثات
  const permitChanged = [], paidNow = [];
  updated.forEach(({row,existing:ex,changedFields}) => {
    if(changedFields['permit_status']) permitChanged.push({row, old:changedFields['permit_status'].oldVal, new:changedFields['permit_status'].newVal});
    if(changedFields['payment_status'] && changedFields['payment_status'].newVal==='مدفوع') paidNow.push(row);
  });

  window._importData = {rows, newOnes, cancelled, updated, unchanged};

  // إحصائيات
  document.getElementById('import-stats').innerHTML =
    '<div style="background:#e8f8e8;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:22px;font-weight:800;color:#1a7a1a">'+newOnes.length+'</div><div style="font-size:12px;color:#1a7a1a">➕ حجاج جدد</div></div>'+
    '<div style="background:#fde8e8;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:22px;font-weight:800;color:#c00">'+cancelled.length+'</div><div style="font-size:12px;color:#c00">❌ ملغيون</div></div>'+
    '<div style="background:#e8fdf0;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0a6e3a">'+permitChanged.length+'</div><div style="font-size:12px;color:#0a6e3a">📋 تغيّرت التصاريح</div></div>'+
    '<div style="background:#fff8e8;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:22px;font-weight:800;color:#c07000">'+paidNow.length+'</div><div style="font-size:12px;color:#c07000">💰 أتموا الدفع</div></div>';

  function mkSection(color,bg,title,items){
    if(!items.length) return '';
    return '<div style="background:'+bg+';border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="color:'+color+';font-weight:700;margin-bottom:8px">'+title+' ('+items.length+')</div>'+items.join('')+'</div>';
  }

  let detailHtml = '';
  detailHtml += mkSection('#1a7a1a','#f0fff4','➕ حجاج جدد', newOnes.map(r=>'<div style="padding:2px 0;color:#333">• <strong>'+(r['اسم الحاج']||'—')+'</strong> — حجز: '+(r['رقم الحجز']||'—')+'</div>'));
  detailHtml += mkSection('#c00','#fff5f5','❌ ملغيون', cancelled.map(({row,hasHousing})=>'<div style="padding:2px 0;color:#333">• <strong>'+(row['اسم الحاج']||'—')+'</strong> — حجز: '+(row['رقم الحجز']||'—')+(hasHousing?' <span style="background:#fde8e8;color:#c00;padding:1px 6px;border-radius:6px;font-size:11px">⚠️ لديه تسكين</span>':'')+'</div>'));
  detailHtml += mkSection('#0a6e3a','#f0fff8','📋 تغيّرت حالة التصريح', permitChanged.map(({row,old:o,new:n})=>'<div style="padding:2px 0;color:#333">• <strong>'+(row['اسم الحاج']||'—')+'</strong> <span style="color:#999;font-size:11px">'+o+' → '+n+'</span></div>'));
  detailHtml += mkSection('#c07000','#fffbf0','💰 أتموا الدفع', paidNow.map(r=>'<div style="padding:2px 0;color:#333">• <strong>'+(r['اسم الحاج']||'—')+'</strong> — حجز: '+(r['رقم الحجز']||'—')+'</div>'));
  if(!detailHtml) detailHtml = '<div style="color:#666;text-align:center;padding:20px">✅ لا توجد تغييرات — البيانات محدثة</div>';

  document.getElementById('import-changes-body').innerHTML = detailHtml;
  document.getElementById('import-changes-result').style.display = 'block';
  document.getElementById('import-actions').style.display = 'flex';
}

async function executeImport() {
  if(!window._importData) return;
  const {rows, newOnes, cancelled, updated} = window._importData;
  // تحقق من الأعمدة غير المحددة
  const undecided = (window._importUnknownCols||[]).filter(c => !window._importSkipCols.has(c) && !window._importAddCols.has(c));
  if(undecided.length) {
    const addThem = await showConfirm('يوجد ' + undecided.length + ' عمود جديد لم تحدد خياره:\n' + undecided.map(c=>'• '+c).join('\n') + '\n\nهل تريد إضافتها للنظام أم تجاهلها؟','أعمدة غير محددة','إضافة للنظام','#1a5fa8','⚠️');
    if(addThem===null) return;
    if(addThem) undecided.forEach(c=>window._importAddCols.add(c));
    else undecided.forEach(c=>window._importSkipCols.add(c));
  }

  const confirmed = await showConfirm(
    'سيتم تحديث ' + (newOnes.length+cancelled.length+updated.length) + ' سجل في قاعدة البيانات. هل تريد المتابعة؟',
    'تأكيد الاستيراد', 'نعم، استيراد', '#1a5fa8', '📥'
  );
  if(!confirmed) return;

  document.getElementById('import-execute-btn').disabled = true;
  document.getElementById('import-progress').style.display = 'block';

  const total = newOnes.length + updated.length + cancelled.length;
  let done = 0;

  const updateProgress = (msg) => {
    done++;
    const pct = Math.round(done/total*100);
    document.getElementById('import-progress-bar').style.width = pct + '%';
    document.getElementById('import-progress-text').textContent = msg + ' (' + done + '/' + total + ')';
  };

  // الأعمدة الجديدة التي تحتاج إضافة
  const colsToAdd = window._importUnknownCols.filter(c => !window._importSkipCols.has(c));

  try {
    // إضافة حجاج جدد
    for(const row of newOnes) {
      const rec = {};
      Object.entries(COLUMN_MAP).forEach(([ar,en]) => { if(row[ar]!==undefined) rec[en] = String(row[ar]).trim(); });
      colsToAdd.forEach(col => { rec[col.split(' ').join('_')] = String(row[col]||'').trim(); });
      await window.DB.Pilgrims.insert(rec);
      updateProgress('إضافة: ' + (row['اسم الحاج']||''));
    }

    // تحديث الملغيين
    for(const {row, existing} of cancelled) {
      const id = existing['_supabase_id'];
      await window.DB.Pilgrims.update(id, {booking_status:'ملغي'});
      updateProgress('إلغاء: ' + (row['اسم الحاج']||''));
    }

    // تحديث المتغيرين — فقط الحقول التي تغيّرت
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-SA') + ' ' + now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
    const FIELD_LABELS = {booking_status:'حالة الحجز',payment_status:'حالة الدفع',permit_status:'حالة التصريح',bus_status:'حالة الإركاب',camp_status:'حالة الحضور',card_status:'حالة البطاقة'};
    for(const {row, existing} of updated) {
      const id = existing['_supabase_id'];
      if(!id) continue;
      // بناء الحقول المتغيرة فقط
      const rec = {};
      const logLines = [];
      Object.entries(COLUMN_MAP).forEach(([ar,en]) => {
        if(MANUAL_FIELDS.includes(en) || !DB_FIELDS.has(en)) return;
        const newVal = String(row[ar]||'').trim();
        const oldVal = String(existing[ar]||existing[en]||'').trim();
        if(newVal !== oldVal) {
          rec[en] = newVal;
          const label = FIELD_LABELS[en] || ar;
          logLines.push('[' + dateStr + '] ' + label + ': ' + (oldVal||'فارغ') + ' → ' + newVal);
        }
      });
      if(!Object.keys(rec).length) continue;
      // إضافة سجل التغيير
      const prevLog = existing['change_log'] || '';
      rec['change_log'] = (prevLog ? prevLog + '\n' : '') + logLines.join('\n');
      await window.DB.Pilgrims.update(id, rec);
      updateProgress('تحديث: ' + (row['اسم الحاج']||''));
    }

    showToast('تم الاستيراد بنجاح — ' + total + ' سجل', 'success');
    await loadData();
  loadSavedTheme(); // بعد تحميل بيانات المستخدم
    resetImport();
  } catch(e) {
    showToast('خطأ: ' + e.message, 'error');
    document.getElementById('import-execute-btn').disabled = false;
  }
}

function resetImport() {
  window._importData = null;
  window._importUnknownCols = [];
  window._importSkipCols = new Set();
  document.getElementById('import-file').value = '';
  document.getElementById('import-filename').textContent = '';
  document.getElementById('import-columns-result').style.display = 'none';
  document.getElementById('import-changes-result').style.display = 'none';
  document.getElementById('import-actions').style.display = 'none';
  document.getElementById('import-progress').style.display = 'none';
  document.getElementById('import-progress-bar').style.width = '0%';
  document.getElementById('import-execute-btn').disabled = false;
}