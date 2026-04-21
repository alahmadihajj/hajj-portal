// ═══════════════════════════════════════════════════════════════════════
// Pilgrim Portal Config Module — v11.5 Phase 5c/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Assembly Points: _apFetch, getAssemblyPoints, formatDateAr, formatTimeAr,
//                      generateAssemblyMsg, showAssemblyMsg, copyAssemblyMsg,
//                      renderAssembly, openAssemblyModal, updateAssemblyCount,
//                      saveAssembly, deleteAssembly
//   - Portal tabs + visibility: switchPT, syncPPColor, uploadPortalImage,
//                                loadPilgrimPortalSettings, savePilgrimPortalSettings,
//                                loadVisibilitySettings, renderToggles, toggleSection,
//                                saveVisibilitySettings
//
// Dependencies (globals):
//   - ui-helpers.js:    showToast, showConfirm
//   - admin.html:       SUPABASE_URL, SUPABASE_KEY, ALL_DATA, openModal, closeModals
//   - supabase.js:      window.DB.Settings.*
// ═══════════════════════════════════════════════════════════════════════


// ─────────── Assembly Points (was admin.html L3715-3954) ───────────
// ===== نقاط التجمع =====
async function _apFetch(method, body, id) {
  const _url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://txdvqedfhzwgejbtplyr.supabase.co');
  const _key = (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '');
  const base = _url + '/rest/v1/assembly_points';
  const url = method==='GET' ? base+'?order=id' : base+(id?'?id=eq.'+id:'');
  const headers = { 'apikey':_key, 'Authorization':'Bearer '+_key, 'Content-Type':'application/json', 'Prefer':'return=representation' };
  const res = await fetch(url, { method, headers, ...(body?{body:JSON.stringify(body)}:{}) });
  if(!res.ok) { const e=await res.json().catch(()=>({message:res.statusText})); throw new Error(e.message||res.statusText); }
  return method==='DELETE'?null:res.json();
}

async function getAssemblyPoints() {
  try { return await _apFetch('GET')||[]; } catch(e) { console.error(e); return []; }
}


function formatDateAr(dateStr) {
  if(!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA-u-ca-islamic', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
  } catch(e) { return dateStr; }
}

function formatTimeAr(t) {
  if(!t) return '—';
  const [h,m] = t.split(':');
  const hr = parseInt(h);
  const period = hr < 12 ? 'صباحاً' : 'مساءً';
  const hr12 = hr===0?12:hr>12?hr-12:hr;
  return hr12 + ':' + m + ' ' + period;
}

function generateAssemblyMsg(p) {
  const supName = (window._supervisors||[]).find(s=>s.username===p.supervisor_username)?.name || p.supervisor_username || '—';
  const supPhone = (window._supervisors||[]).find(s=>s.username===p.supervisor_username)?.phone || '';
  const waPhone = supPhone.startsWith('0') ? '966'+supPhone.slice(1) : supPhone;
  const companyName = _getCompanyName();
  const lines = [
    'ترحب بكم ' + companyName + ' ونفيدكم بأن نقطة التجمع في مدينة ' + (p.city||'') + ' بتاريخ ' + formatDateAr(p.assembly_date) + ' حسب الرؤيا من الساعة ' + formatTimeAr(p.time_from) + ' إلى ' + formatTimeAr(p.time_to) + ' في ' + (p.location_name||'') + '.',
    p.maps_link ? 'إحداثيات الموقع على الرابط التالي :\u200f\n' + p.maps_link : '',
    'وللاستفسارات والطلبات يمكنكم ارسالها للمشرف العام بمدينة ' + (p.city||'') + ' الاستاذ / ' + supName + ' عبر الواتساب أب عبر الرابط التالي:',
    waPhone ? 'https://wa.me/' + waPhone : ''
  ];
  return lines.filter(Boolean).join('\n\n');
}

async function showAssemblyMsg(id) {
  const all = await getAssemblyPoints();
  const p = all.find(x=>x.id===id);
  if(!p) return;
  window._supervisors = await getSysUsers();
  const msg = generateAssemblyMsg(p);
  openModal(`
    <h3 class="modal-title">📢 رسالة إعلام الحجاج — ${p.city||''}</h3>
    <textarea id="assembly-msg-text" style="width:100%;height:260px;padding:12px;border:1.5px solid #ddd;border-radius:10px;font-size:13px;font-family:inherit;line-height:1.8;resize:vertical">${msg}</textarea>
    <div class="modal-btns" style="margin-top:14px">
      <button class="btn-save" onclick="copyAssemblyMsg()" style="background:#1a7a1a">📋 نسخ الرسالة</button>
      <button class="btn-cancel" onclick="closeModals()">إغلاق</button>
    </div>`);
}

function copyAssemblyMsg() {
  const txt = document.getElementById('assembly-msg-text');
  txt.select();
  document.execCommand('copy');
  showToast('تم نسخ الرسالة', 'success');
}

async function renderAssembly() {
  const points = await getAssemblyPoints();
  const el = document.getElementById('assembly-list');
  // بناء lookup لأسماء المشرفين
  const sups = await getSysUsers();
  window._assemblySups = {};
  sups.forEach(s => { window._assemblySups[s.username] = s.name||s.username; });
  if(!points.length) {
    el.innerHTML = '<p style="color:#888;text-align:center;padding:40px">لا توجد نقاط تجمع بعد.</p>';
    return;
  }
  const statusColor = { 'نشطة': '#1a7a1a', 'مغلقة': '#c00' };
  const statusBg = { 'نشطة': '#e8f8e8', 'مغلقة': '#fde8e8' };
  el.innerHTML = points.map(p => `
    <div style="background:#fff;border:1.5px solid #e0d5c5;border-radius:14px;padding:18px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:16px;font-weight:800;color:#3d2000">📍 ${p.location_name||'—'}</span>
            <span style="background:${statusBg[p.status]||'#f5f5f5'};color:${statusColor[p.status]||'#666'};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${p.status||'نشطة'}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:#555">
            <span>🏙️ <strong>${p.city||'—'}</strong></span>
            <span>📅 ${formatDateAr(p.assembly_date)}</span>
            <span>🕐 ${formatTimeAr(p.time_from)} — ${formatTimeAr(p.time_to)}</span>
            <span>👤 ${window._assemblySups&&window._assemblySups[p.supervisor_username]||p.supervisor_username||'—'}</span>
            <span>👥 ${p.capacity||'0'} حاج</span>
          </div>
          ${p.maps_link?`<a href="${p.maps_link}" target="_blank" style="display:inline-block;margin-top:8px;font-size:12px;color:#1a5fa8;text-decoration:none">🗺️ فتح الموقع على الخريطة</a>`:''}
          ${p.notes?`<div style="margin-top:8px;font-size:12px;color:#888;background:#fffbf0;padding:8px 12px;border-radius:8px">📝 ${p.notes}</div>`:''}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
          <button onclick="showAssemblyMsg(${p.id})" style="padding:7px 14px;background:#e8f0fd;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#1a5fa8">📢 رسالة</button>
          <button onclick="openAssemblyModal(${p.id})" style="padding:7px 14px;background:#f0e8d0;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#7a4500">✏️ تعديل</button>
          <button onclick="deleteAssembly(${p.id})" style="padding:7px 14px;background:#fde8e8;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#c00">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

async function openAssemblyModal(id) {
  let p = {};
  if(id) {
    const all = await getAssemblyPoints();
    p = all.find(x=>x.id===id)||{};
  }
  // جلب المشرفين وحساب حجاج المدينة
  const supervisors = (await getSysUsers()).filter(u=>u.role==='supervisor');
  const cities = [...new Set(ALL_DATA.map(r=>r['المدينة']).filter(Boolean))].sort();
  const cityOpts = cities.map(c=>`<option value="${c}" ${p.city===c?'selected':''}>${c}</option>`).join('');
  const supOpts = supervisors.map(s=>`<option value="${s.username}" ${p.supervisor_username===s.username?'selected':''}>${s.name||s.username}${s.city?' — '+s.city:''}</option>`).join('');

  openModal(`
    <h3 class="modal-title">📍 ${id?'تعديل':'إضافة'} نقطة تجمع</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row" style="grid-column:1/-1">
        <label>🏙️ المدينة</label>
        <select id="ap-city" onchange="updateAssemblyCount()">
          <option value="">اختر المدينة</option>
          ${cityOpts}
        </select>
        <div id="ap-city-count" style="font-size:12px;color:#1a5fa8;margin-top:4px"></div>
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>📌 اسم الموقع</label>
        <input type="text" id="ap-name" value="${p.location_name||''}" placeholder="مثال: ساحة المسجد الكبير">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>🗺️ رابط الموقع على الخريطة</label>
        <input type="text" id="ap-link" value="${p.maps_link||''}" placeholder="https://maps.google.com/...">
      </div>
      <div class="form-row">
        <label>📅 تاريخ التجمع (هجري)</label>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="ap-date-day" style="flex:1;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="">اليوم</option>
            ${Array.from({length:30},(_,i)=>i+1).map(d=>`<option value="${String(d).padStart(2,'0')}" ${(p.assembly_date||'').split('-')[2]===String(d).padStart(2,'0')?'selected':''}>${d}</option>`).join('')}
          </select>
          <select id="ap-date-month" style="flex:1.5;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="">الشهر</option>
            ${['محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الثانية','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'].map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${(p.assembly_date||'').split('-')[1]===String(i+1).padStart(2,'0')?'selected':''}>${m}</option>`).join('')}
          </select>
          <select id="ap-date-year" style="flex:1.2;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="">السنة</option>
            ${Array.from({length:10},(_,i)=>1446+i).map(y=>`<option value="${y}" ${(p.assembly_date||'').split('-')[0]===String(y)?'selected':''}>${y} هـ</option>`).join('')}
          </select>
        </div>
        <input type="hidden" id="ap-date">
      </div>
      <div class="form-row">
        <label>👤 المشرف</label>
        <select id="ap-supervisor">
          <option value="">اختر المشرف</option>
          ${supOpts}
        </select>
      </div>
      <div class="form-row">
        <label>🕐 وقت التجمع من</label>
        <input type="time" id="ap-from" value="${p.time_from||''}">
      </div>
      <div class="form-row">
        <label>🕑 وقت التجمع إلى</label>
        <input type="time" id="ap-to" value="${p.time_to||''}">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>حالة النقطة</label>
        <select id="ap-status">
          <option value="نشطة" ${(p.status||'نشطة')==='نشطة'?'selected':''}>✅ نشطة</option>
          <option value="مغلقة" ${p.status==='مغلقة'?'selected':''}>🔴 مغلقة</option>
        </select>
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>📝 معلومات إضافية</label>
        <textarea id="ap-notes" rows="3" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical">${p.notes||''}</textarea>
      </div>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveAssembly(${id||0})">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);

  if(p.city) setTimeout(updateAssemblyCount, 100);
}

function updateAssemblyCount() {
  const city = document.getElementById('ap-city')?.value;
  const el = document.getElementById('ap-city-count');
  if(!el) return;
  if(!city) { el.textContent = ''; return; }
  const count = ALL_DATA.filter(r=>r['المدينة']===city).length;
  el.textContent = '👥 عدد حجاج هذه المدينة: ' + count + ' حاج';
}

async function saveAssembly(id) {
  const obj = {
    city: document.getElementById('ap-city').value,
    location_name: document.getElementById('ap-name').value.trim(),
    maps_link: document.getElementById('ap-link').value.trim(),
    assembly_date: (()=>{
      const y=document.getElementById('ap-date-year').value;
      const m=document.getElementById('ap-date-month').value;
      const d=document.getElementById('ap-date-day').value;
      return (y&&m&&d) ? y+'-'+m+'-'+d : '';
    })(),
    time_from: document.getElementById('ap-from').value,
    time_to: document.getElementById('ap-to').value,
    supervisor_username: document.getElementById('ap-supervisor').value,
    status: document.getElementById('ap-status').value,
    notes: document.getElementById('ap-notes').value.trim(),
    capacity: ALL_DATA.filter(r=>r['المدينة']===document.getElementById('ap-city').value).length
  };
  if(!obj.location_name) return showToast('أدخل اسم الموقع', 'warning');
  if(!obj.city) return showToast('اختر المدينة', 'warning');
  try {
    if(id) { await _apFetch('PATCH', obj, id); }
    else { await _apFetch('POST', obj); }
    closeModals(); renderAssembly(); showToast('تم الحفظ بنجاح', 'success');
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function deleteAssembly(id) {
  const ok = await showConfirm('هل تريد حذف نقطة التجمع؟', 'حذف', 'نعم، احذف', '#c00', '🗑️');
  if(!ok) return;
  try {
    await _apFetch('DELETE', null, id);
    renderAssembly(); showToast('تم الحذف','success');
  } catch(e) { showToast('خطأ: '+e.message,'error'); }
}

// ─────────── Pilgrim Portal tabs + visibility (was admin.html L4556-4745) ───────────
// ===== تبويبات بوابة الحاج =====
const PORTAL_SETTINGS_KEY = 'hajj_portal_settings';

function switchPT(tab) {
  ['identity','content','sections','contact'].forEach(t => {
    const el = document.getElementById('pt-'+t);
    const btn = document.getElementById('pt-'+t+'-btn');
    if(el) el.style.display = t===tab ? '' : 'none';
    if(btn) { btn.classList.toggle('pt-active', t===tab); }
  });
  if(tab==='sections') renderToggles();
}

function syncPPColor(colorId, txtId) {
  const el = document.getElementById(colorId);
  const txt = document.getElementById(txtId);
  if(txt && /^#[0-9a-fA-F]{6}$/.test(txt.value)) { if(el) el.value = txt.value; }
  if(el) { const ti = document.getElementById(txtId); if(ti) ti.value = el.value; }
}


// ===== ضغط وتحميل صورة البوابة =====
function uploadPortalImage(input, type) {
  const file = input.files[0];
  if(!file) return;
  const maxW = 200;  // شعار صغير وواضح
  const maxH = 200;
  const quality = 0.80;
  const nameEl = document.getElementById('pp-'+type+'-name');
  const previewEl = document.getElementById('pp-'+type+'-preview');
  const hiddenEl = document.getElementById('pp-'+type);
  if(nameEl) nameEl.textContent = '⏳ جاري الضغط...';

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // حساب الأبعاد مع الحفاظ على النسبة
      let w = img.width, h = img.height;
      if(w > maxW) { h = Math.round(h*maxW/w); w = maxW; }
      if(h > maxH) { w = Math.round(w*maxH/h); h = maxH; }
      // ضغط عبر Canvas
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      // تحديث الـ preview
      if(previewEl) {
        previewEl.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:contain">`;
      }
      // حفظ Base64 في الـ hidden input
      if(hiddenEl) hiddenEl.value = compressed;
      // تحديث الاسم مع حجم الملف
      const kb = Math.round(compressed.length * 0.75 / 1024);
      if(nameEl) nameEl.textContent = `✅ ${file.name} — ${kb} KB بعد الضغط`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function loadPilgrimPortalSettings() {
  try {
    const saved = window.DB ? await window.DB.Settings.get(PORTAL_SETTINGS_KEY) : null;
    if(!saved) return;
    const fields = ['welcome','color1','color2','greeting','btn-label','tagline','mina_url','muzdalifah_url','arafat_url'];
    fields.forEach(k => {
      const el = document.getElementById('pp-'+k);
      if(el && saved[k]) el.value = saved[k];
    });
    // تحميل الصور من مفاتيح منفصلة
    for(const type of ['logo','bg']) {
      try {
        const imgSaved = await window.DB.Settings.get('hajj_portal_'+type);
        if(imgSaved?.data) {
          const hiddenEl = document.getElementById('pp-'+type);
          if(hiddenEl) hiddenEl.value = imgSaved.data;
          const previewEl = document.getElementById('pp-'+type+'-preview');
          if(previewEl) previewEl.innerHTML = `<img src="${imgSaved.data}" style="width:100%;height:100%;object-fit:contain">`;
          const nameEl = document.getElementById('pp-'+type+'-name');
          if(nameEl) nameEl.textContent = '✅ صورة محفوظة';
        }
      } catch(e){}
    }
    // ألوان
    ['color1','color2'].forEach(k => {
      const el = document.getElementById('pp-'+k);
      const txt = document.getElementById('pp-'+k+'-txt');
      if(el && saved[k]) el.value = saved[k];
      if(txt && saved[k]) txt.value = saved[k];
    });
  } catch(e){}
}

async function savePilgrimPortalSettings() {
  // الحقول النصية (بدون الصور)
  const fields = ['welcome','color1','color2','greeting','btn-label','tagline','mina_url','muzdalifah_url','arafat_url'];
  const data = {};
  fields.forEach(k => { const el = document.getElementById('pp-'+k); if(el) data[k] = el.value; });
  data._sections = currentSettings;
  try {
    // حفظ الإعدادات النصية
    await window.DB.Settings.set(PORTAL_SETTINGS_KEY, data);
    // حفظ الصور بمفاتيح منفصلة (Base64 كبير)
    const logoVal = document.getElementById('pp-logo')?.value;
    const bgVal   = document.getElementById('pp-bg')?.value;
    if(logoVal) await window.DB.Settings.set('hajj_portal_logo', { data: logoVal });
    if(bgVal)   await window.DB.Settings.set('hajj_portal_bg',   { data: bgVal   });
    await saveVisibilitySettings();
    const msg = document.getElementById('settings-msg');
    if(msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none', 3000); }
    showToast('تم حفظ إعدادات البوابة','success');
  } catch(e) { showToast('خطأ في الحفظ: '+e.message,'error'); }
}

const SECTIONS_KEY = 'haj_sections_visibility';

const SECTIONS_CONFIG = [
  { id:'sec-personal',            label:'👤 المعلومات الشخصية',           default:true },
  { id:'sec-status',              label:'📋 حالة الحجز والخدمات',         default:true },
  { id:'sec-timeline',            label:'🗓️ الخط الزمني',                 default:true },
  { id:'announcements-section',   label:'📢 التعاميم والتعليمات',         default:true },
  { id:'sec-maps',                label:'📍 مواقع الحملة (الرئيسي)',      default:true },
  { id:'sec-maps-mina',           label:'   └ زر منى',                    default:true },
  { id:'sec-maps-muzdalifah',     label:'   └ زر مزدلفة',                 default:true },
  { id:'sec-maps-arafat',         label:'   └ زر عرفات',                  default:true },
  { id:'sec-seats',               label:'📍 مواقع جلوسك (الرئيسي)',       default:true },
  { id:'sec-seats-mina',          label:'   └ بطاقة منى',                 default:true },
  { id:'sec-seats-muzdalifah',    label:'   └ بطاقة مزدلفة',              default:true },
  { id:'sec-seats-arafat',        label:'   └ بطاقة عرفات',               default:true },
  { id:'sec-transport',           label:'🚌 الفوج والحافلة (الرئيسي)',    default:true },
  { id:'sec-transport-fawj',      label:'   └ مربع رقم الفوج',            default:true },
  { id:'sec-transport-bus',       label:'   └ مربع رقم الحافلة',          default:true },
  { id:'sec-supervisor',          label:'👤 المشرف الخاص بالحاج',         default:true },
  { id:'sec-vaccines',            label:'💉 التطعيمات',                   default:true },
  { id:'sec-sheikh',              label:'🕋 الدعاة والفتوى',              default:true },
  { id:'sec-company',             label:'🏢 معلومات الشركة',              default:true },
  { id:'sec-survey',              label:'⭐ الاستبيان',                   default:true },
  { id:'sec-whatsapp',            label:'📞 التواصل والاستفسارات',        default:true },
];

let currentSettings = {};

async function loadVisibilitySettings() {
  try {
    if(window.DB) {
      const val = await window.DB.Settings.get(SECTIONS_KEY);
      if(val) currentSettings = val;
    }
  } catch(e) {}
  renderToggles();
}

function renderToggles() {
  const container = document.getElementById('sections-toggles');
  if (!container) return;
  container.innerHTML = SECTIONS_CONFIG.map(sec => {
    const isOn = currentSettings[sec.id] !== false;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1.5px solid ${isOn ? '#c8971a' : '#e0e0e0'};border-radius:12px;padding:14px 18px;transition:border-color .2s" id="toggle-row-${sec.id}">
        <span style="font-size:15px;font-weight:600;color:#333">${sec.label}</span>
        <label style="position:relative;display:inline-block;width:52px;height:28px;cursor:pointer">
          <input type="checkbox" ${isOn ? 'checked' : ''} onchange="toggleSection('${sec.id}', this.checked)" style="opacity:0;width:0;height:0;position:absolute">
          <span style="position:absolute;inset:0;background:${isOn ? '#c8971a' : '#ccc'};border-radius:28px;transition:background .3s" id="toggle-bg-${sec.id}"></span>
          <span style="position:absolute;top:3px;${isOn ? 'right:3px' : 'left:3px'};width:22px;height:22px;background:#fff;border-radius:50%;transition:all .3s;box-shadow:0 1px 4px rgba(0,0,0,.2)" id="toggle-knob-${sec.id}"></span>
        </label>
      </div>`;
  }).join('');
}

function toggleSection(id, isOn) {
  currentSettings[id] = isOn;
  const bg = document.getElementById('toggle-bg-' + id);
  const knob = document.getElementById('toggle-knob-' + id);
  const row = document.getElementById('toggle-row-' + id);
  if (bg) bg.style.background = isOn ? '#c8971a' : '#ccc';
  if (knob) { knob.style.right = isOn ? '3px' : ''; knob.style.left = isOn ? '' : '3px'; }
  if (row) row.style.borderColor = isOn ? '#c8971a' : '#e0e0e0';
}

async function saveVisibilitySettings() {
  try {
    await window.DB.Settings.set(SECTIONS_KEY, currentSettings);
    const msg = document.getElementById('settings-msg');
    if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
  } catch(e) {
    showToast('حدث خطأ في الحفظ', 'error');
  }
}