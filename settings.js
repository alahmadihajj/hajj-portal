// ═══════════════════════════════════════════════════════════════════════
// Admin Settings Module — v11.5 Phase 5b/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Theme: syncColorInput, applyThemePreview, applyPreset, applyThemeToPage,
//            shadeColor, saveTheme, resetTheme, loadSavedTheme, _syncThemeInputs
//   - switchCfg dispatcher
//   - Content: initContentEditors, loadContentSettings, normalizePhone,
//              normalizeWhatsApp, saveContentSettings
//   - Dev: showDevBtnIfSuperAdmin, loadDevSettings, _applyDevLogo, previewDevLogo,
//          previewStamp, saveDevSettings
//   - General: openGroupCfgModal, loadGeneralSettings, updateBraceletToggle,
//              saveBraceletSetting, saveGeneralSettings
//
// Dependencies (globals):
//   - ui-helpers.js: showToast
//   - admin.html:    _applyCompanyName, _getCompanyName, window._devSettings, window._currentUser
//   - supabase.js:   window.DB.Settings.*
//   - CDN:           Quill, DOMPurify
// ═══════════════════════════════════════════════════════════════════════


// ===== نظام تخصيص الثيم =====
const THEME_PRESETS = {
  hajj:   {brown:'#3d2000', mid:'#7a4500', gold:'#c8971a', surface:'#f3ede4'},
  rose:   {brown:'#6a1a2a', mid:'#c03a5a', gold:'#e87a9a', surface:'#fdf0f3'},
  blue:   {brown:'#1a3a6a', mid:'#1a5fa8', gold:'#3a8fd0', surface:'#eef4fc'},
  green:  {brown:'#1a4a1a', mid:'#2a7a2a', gold:'#5ab85a', surface:'#eef8ee'},
  dark:   {brown:'#111111', mid:'#2a2a2a', gold:'#c8971a', surface:'#1a1a1a'},
  purple: {brown:'#3a1a6a', mid:'#6a3aaa', gold:'#aa6aff', surface:'#f0eafc'},
};

function syncColorInput(colorId, textId) {
  const txt = document.getElementById(textId)?.value||'';
  if(/^#[0-9a-fA-F]{6}$/.test(txt)) {
    const el = document.getElementById(colorId);
    if(el) el.value = txt;
    applyThemePreview();
  }
}

function applyThemePreview() {
  const brown   = document.getElementById('tc-brown')?.value  || '#3d2000';
  const mid     = document.getElementById('tc-mid')?.value    || '#7a4500';
  const gold    = document.getElementById('tc-gold')?.value   || '#c8971a';
  const surface = document.getElementById('tc-surface')?.value|| '#f3ede4';
  // تحديث labels
  ['brown','mid','gold','surface'].forEach(k=>{
    const el = document.getElementById('lbl-'+k);
    const v = {brown,mid,gold,surface}[k];
    if(el) el.textContent = v;
    const txt = document.getElementById('tc-'+k+'-txt');
    if(txt) txt.value = v;
  });
  // تحديث swatches
  ['brown','mid','gold','surface'].forEach(k=>{
    const sw = document.getElementById('swatch-'+k);
    const txt = document.getElementById('tc-'+k+'-txt');
    const v = {brown,mid,gold,surface}[k];
    if(sw) sw.style.background = v;
    if(txt) txt.textContent = v;
  });
  // معاينة مباشرة
  const ph = document.getElementById('prev-header');
  const pt = document.getElementById('prev-thead');
  const pb = document.getElementById('prev-btn');
  const pp = document.getElementById('prev-page-btn');
  const ps = document.getElementById('prev-stats');
  const pg = document.getElementById('prev-gold-stat');
  if(ph) ph.style.background = `linear-gradient(135deg,${brown},${mid},${gold})`;
  if(pt) [...pt.children].forEach(d=>d.style.background=`linear-gradient(180deg,${brown}cc,${brown})`);
  if(pb) pb.style.background = `linear-gradient(135deg,${gold},${mid})`;
  if(pp) pp.style.background = `linear-gradient(135deg,${brown},${mid})`;
  if(ps) ps.style.background = surface;
  if(pg) { pg.style.borderTopColor=gold; pg.querySelector('div').style.color=gold; }
}

function applyPreset(name) {
  const p = THEME_PRESETS[name];
  if(!p) return;
  ['brown','mid','gold','surface'].forEach(k=>{
    const el = document.getElementById('tc-'+k);
    const txt = document.getElementById('tc-'+k+'-txt');
    if(el) el.value = p[k];
    if(txt) txt.value = p[k];
  });
  applyThemePreview();
}

function applyThemeToPage(t) {
  const r = document.documentElement.style;
  // CSS Variables — تطبيق على كل ما يستخدم var()
  r.setProperty('--brown', t.brown);
  r.setProperty('--brown-mid', t.mid);
  r.setProperty('--gold', t.gold);
  r.setProperty('--gold-dark', shadeColor(t.gold,-20));
  r.setProperty('--gold-light', shadeColor(t.gold,30));
  r.setProperty('--surface-3', t.surface);
  r.setProperty('--surface-2', shadeColor(t.surface,3));

  const G = (sel) => [...document.querySelectorAll(sel)];

  // Header
  G('.header').forEach(el=>el.style.background=`linear-gradient(135deg,${t.brown},${t.mid},${t.gold})`);

  // Nav tabs active border
  G('.nav-tabs button').forEach(btn=>{
    if(btn.style.color===t.gold||btn.style.borderBottomColor===t.gold||btn.style.color==='rgb(184, 134, 11)'||btn.style.borderBottomColor!=='transparent'){
      btn.style.color=t.gold; btn.style.borderBottomColor=t.gold;
    }
  });

  // Table headers (th)
  G('th').forEach(th=>{ th.style.background=`linear-gradient(180deg,${shadeColor(t.brown,10)},${t.brown})`; });

  // Pagination active button
  G('.pagination button.active').forEach(btn=>{
    btn.style.background=`linear-gradient(135deg,${t.brown},${t.mid})`;
    btn.style.borderColor=t.brown;
  });

  // Buttons with class btn-save
  G('.btn-save').forEach(btn=>{ btn.style.background=`linear-gradient(135deg,${t.brown},${t.mid})`; });

  // Buttons with class btn-add-item
  G('.btn-add-item').forEach(btn=>{ btn.style.background=t.mid; btn.style.borderColor=t.mid; });

  // Tab buttons bar (hs-btn active)
  // hs-btn handled by CSS class
  G('.hs-btn').forEach(btn=>{ btn.style.background=''; btn.style.borderColor=''; btn.style.color=''; });

  // Filters reset buttons
  G('.filters .reset').forEach(btn=>{ btn.style.background=`linear-gradient(135deg,${t.gold},${shadeColor(t.gold,-15)})`; });

  // Stat cards top border
  G('.stat.total').forEach(el=>el.style.setProperty('--_c',t.brown));

  // Cfg section buttons (active)
  G('[id^="cfg-"][id$="-btn"]').forEach(btn=>{
    if(btn.style.background&&btn.style.background!=='rgb(255, 255, 255)'&&!btn.style.display.includes('none')){
      const active = btn.style.fontWeight==='700'||btn.style.fontWeight==='bold';
      if(active){ btn.style.background=t.gold; btn.style.borderColor=t.gold; }
    }
  });

  // Page background
  const tabData = document.getElementById('tab-data');
  if(tabData) tabData.style.background=t.surface;

  // === CSS ديناميكي شامل يغطي كل النوافذ ورؤوس الجداول ===
  const styleTag = document.getElementById('dynamic-theme-style');
  if(styleTag) {
    const mid2 = shadeColor(t.brown, 12);
    styleTag.textContent = `
      /* Header */
      .header { background: linear-gradient(135deg,${t.brown},${t.mid},${t.gold}) !important; }

      /* جميع رؤوس الجداول — كل النوافذ */
      th {
        background: linear-gradient(180deg,${mid2},${t.brown}) !important;
        border-bottom: 2px solid ${t.gold} !important;
      }

      /* رؤوس النوافذ (modal headers) */
      [style*="background:linear-gradient(135deg,#3d2000"],
      [style*="background:linear-gradient(135deg,#b8860b"],
      [style*="background:linear-gradient(135deg,#1a3a6a"],
      [style*="background:linear-gradient(135deg,#7a4500"],
      [style*="background:linear-gradient(135deg,#e6820a"],
      [style*="background:linear-gradient(135deg,#3d2000,#7a4500)"] {
        background: linear-gradient(135deg,${t.brown},${t.mid}) !important;
      }

      /* رؤوس الأفواج */
      [style*="background:linear-gradient(135deg,#3d2000,#7a4500,#c8971a"],
      [style*="background:linear-gradient(135deg,#b8860b,#c8971a"] {
        background: linear-gradient(135deg,${t.brown},${t.mid},${t.gold}) !important;
      }

      /* أزرار الحفظ والإجراءات */
      .btn-save, [class~="btn-save"] {
        background: linear-gradient(135deg,${t.brown},${t.mid}) !important;
      }
      .btn-add-item {
        background: ${t.mid} !important;
        border-color: ${t.mid} !important;
      }
      .filters .reset {
        background: linear-gradient(135deg,${t.gold},${shadeColor(t.gold,-15)}) !important;
      }

      /* الترقيم النشط */
      .pagination button.active {
        background: linear-gradient(135deg,${t.brown},${t.mid}) !important;
        border-color: ${t.brown} !important;
      }

      /* شريط التبويبات */
      #tab-data { background: ${t.surface} !important; }

      /* hs-btn النشط */
      .hs-btn.hs-active {
        background: linear-gradient(135deg,${t.brown},${t.gold}) !important;
        border-color: ${t.gold} !important;
        color: #fff !important;
      }

      /* أزرار التبويبات النشطة */
      .nav-tabs button[style*="color: rgb(184"] ,
      .nav-tabs button[style*="color: ${t.gold}"] {
        color: ${t.gold} !important;
        border-bottom-color: ${t.gold} !important;
      }

      /* أزرار cfg النشطة - فقط cfg وليس tab */
      [id^="cfg-"][id$="-btn"][style*="font-weight: 700"]:not([style*="display: none"]) {
        background: ${t.gold} !important;
        border-color: ${t.gold} !important;
      }
      /* أزرار التبويب - خلفية شفافة دائماً */
      [id^="tab-"][id$="-btn"] {
        background: none !important;
      }
    `;
  }

  // إعادة بناء الجدول والترقيم
  if(typeof buildThead==='function') buildThead();
  if(typeof render==='function') render();
}

function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#',''),16);
  const r = Math.min(255,Math.max(0,((num>>16)&0xFF)+Math.round(2.55*pct)));
  const g = Math.min(255,Math.max(0,((num>>8)&0xFF)+Math.round(2.55*pct)));
  const b = Math.min(255,Math.max(0,(num&0xFF)+Math.round(2.55*pct)));
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

async function saveTheme() {
  const theme = {
    brown:   document.getElementById('tc-brown')?.value   || '#3d2000',
    mid:     document.getElementById('tc-mid')?.value     || '#7a4500',
    gold:    document.getElementById('tc-gold')?.value    || '#c8971a',
    surface: document.getElementById('tc-surface')?.value || '#f3ede4',
  };
  try {
    const themeStr = JSON.stringify(theme);
    // حفظ محلي
    localStorage.setItem('hajj_theme', themeStr);
    // حفظ في قاعدة البيانات مرتبط بالمستخدم
    const user = window._currentUser;
    if(user && user.id && window.DB?.SysUsers?.update) {
      await window.DB.SysUsers.update(user.id, { theme: themeStr });
      user.theme = themeStr; // تحديث الذاكرة
    }
    applyThemeToPage(theme);
    showToast('تم حفظ الثيم لحسابك','success');
  } catch(e) { showToast('خطأ في الحفظ: '+e.message,'error'); }
}

async function resetTheme() {
  applyPreset('hajj');
  const def = THEME_PRESETS.hajj;
  localStorage.removeItem('hajj_theme');
  // حذف من قاعدة البيانات
  const user = window._currentUser;
  if(user && user.id && window.DB?.SysUsers?.update) {
    try { await window.DB.SysUsers.update(user.id, { theme: null }); user.theme=null; } catch(e){}
  }
  applyThemeToPage(def);
  showToast('تم إعادة الثيم للافتراضي','success');
}

function loadSavedTheme() {
  try {
    // أولوية: بيانات المستخدم من قاعدة البيانات
    const user = window._currentUser;
    const fromDB = user?.theme ? user.theme : null;
    const fromLocal = localStorage.getItem('hajj_theme');
    const saved = fromDB || fromLocal;
    if(saved) {
      const t = JSON.parse(saved);
      // تحديث localStorage بأحدث نسخة
      if(fromDB) localStorage.setItem('hajj_theme', fromDB);
      applyThemeToPage(t);
      _syncThemeInputs(t);
    }
  } catch(e){}
}

function _syncThemeInputs(t) {
  ['brown','mid','gold','surface'].forEach(k=>{
    const el  = document.getElementById('tc-'+k);
    const sw  = document.getElementById('swatch-'+k);
    const txt = document.getElementById('tc-'+k+'-txt');
    if(el  && t[k]) el.value = t[k];
    if(sw  && t[k]) sw.style.background = t[k];
    if(txt && t[k]) txt.textContent = t[k];
  });
}

function switchCfg(section) {
  ['pilgrim','content','theme','general','dev','import'].forEach(s => {
    const panel = document.getElementById('cfg-'+s);
    const btn = document.getElementById('cfg-'+s+'-btn');
    if(panel) panel.style.display = s===section ? 'block' : 'none';
    if(btn && btn.style.display!=='none') {
      const active = s===section, isRed = s==='dev', isBlue = s==='import';
      const activeColor = isRed?'#c00':isBlue?'#1a5fa8':'#b8860b';
      const inactiveColor = isRed?'#c00':isBlue?'#1a5fa8':'#555';
      btn.style.background = active ? activeColor : '#fff';
      btn.style.color = active ? '#fff' : inactiveColor;
      btn.style.borderColor = active ? activeColor : '#ddd';
      btn.style.fontWeight = active ? '700' : '600';
    }
  });
  if(section==='general') loadGeneralSettings();
  if(section==='dev') loadDevSettings();
  if(section==='theme') applyThemePreview();
  if(section==='content') loadContentSettings();
}

// ===== محررات محتويات البوابة =====
const _quillEditors = {};

function initContentEditors() {
  if(Object.keys(_quillEditors).length || typeof Quill === 'undefined') return;
  const toolbar = [
    [{ 'header': [1, 2, 3, false] }],
    ['bold','italic','underline','strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link','clean']
  ];
  ['vaccines','sheikh','company','whatsapp'].forEach(k => {
    const target = document.getElementById('editor-'+k);
    if(!target) return;
    _quillEditors[k] = new Quill(target, {
      theme:'snow',
      modules:{ toolbar },
      placeholder:'اكتب المحتوى هنا...'
    });
  });
}

async function loadContentSettings() {
  initContentEditors();
  try {
    const keys = {
      vaccines_content:'vaccines', sheikh_content:'sheikh',
      company_content:'company',   whatsapp_content:'whatsapp'
    };
    for(const [dbKey, edKey] of Object.entries(keys)) {
      const v = await window.DB.Settings.get(dbKey);
      if(v && _quillEditors[edKey]) _quillEditors[edKey].root.innerHTML = v;
    }
    const sheikhs = await window.DB.Settings.get('sheikhs_list');
    if(Array.isArray(sheikhs)) {
      sheikhs.slice(0, 3).forEach((s, i) => {
        const idx = i + 1;
        const nameEl = document.getElementById('sheikh'+idx+'-name');
        const phoneEl = document.getElementById('sheikh'+idx+'-phone');
        const waEl = document.getElementById('sheikh'+idx+'-whatsapp');
        if(nameEl && s?.name) nameEl.value = s.name;
        if(phoneEl && s?.phone) phoneEl.value = s.phone;
        if(waEl && s?.whatsapp) waEl.value = s.whatsapp;
      });
    }
    const wn = await window.DB.Settings.get('whatsapp_number');
    if(wn) document.getElementById('cfg-whatsapp-number').value = wn;
  } catch(e){}
}

// ===== دوال تطبيع الأرقام السعودية =====
function normalizePhone(input) {
  if(!input) return null;
  let s = String(input).trim().replace(/[\s\-()]/g, '');
  if(s.startsWith('+')) s = s.slice(1);
  if(s.startsWith('00')) s = s.slice(2);
  s = s.replace(/\D/g, '');
  if(s.startsWith('966')) s = s.slice(3);
  if(s.startsWith('5') && s.length === 9) s = '0' + s;
  return /^05\d{8}$/.test(s) ? s : null;
}

function normalizeWhatsApp(input) {
  if(!input) return null;
  let s = String(input).trim().replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if(s.startsWith('00')) s = s.slice(2);
  s = s.replace(/\D/g, '');
  if(s.startsWith('05') && s.length === 10) s = '966' + s.slice(1);
  else if(s.startsWith('5') && s.length === 9) s = '966' + s;
  return /^9665\d{8}$/.test(s) ? s : null;
}

async function saveContentSettings() {
  // ===== تحقق مسبق من الأرقام قبل أي حفظ =====
  const sheikhs = [];
  for(let i = 1; i <= 3; i++) {
    const name = document.getElementById('sheikh'+i+'-name').value.trim();
    if(!name) continue;
    const rawPhone = document.getElementById('sheikh'+i+'-phone').value.trim();
    const rawWa = document.getElementById('sheikh'+i+'-whatsapp').value.trim();
    let phone = '', whatsapp = '';
    if(rawPhone) {
      phone = normalizePhone(rawPhone);
      if(!phone) {
        showToast(`رقم هاتف غير صحيح للداعية "${name}" — يجب أن يكون بصيغة 05XXXXXXXX`, 'error');
        return;
      }
    }
    if(rawWa) {
      whatsapp = normalizeWhatsApp(rawWa);
      if(!whatsapp) {
        showToast(`رقم واتساب غير صحيح للداعية "${name}" — يجب أن يبدأ بـ 9665`, 'error');
        return;
      }
    }
    sheikhs.push({ name, phone, whatsapp });
  }
  const rawWn = document.getElementById('cfg-whatsapp-number').value.trim();
  let wn = '';
  if(rawWn) {
    wn = normalizeWhatsApp(rawWn);
    if(!wn) {
      showToast('رقم واتساب الاستفسارات غير صحيح — يجب أن يبدأ بـ 9665', 'error');
      return;
    }
  }

  // ===== كل الأرقام صحيحة — نبدأ الحفظ =====
  try {
    const sanitize = (html) => (window.DOMPurify ? DOMPurify.sanitize(html, {
      ALLOWED_TAGS:['p','br','strong','em','u','s','ol','ul','li','a','span','div','h1','h2','h3','blockquote','hr','img'],
      ALLOWED_ATTR:['href','target','rel','class','style','src','alt']
    }) : html);
    for(const k of ['vaccines','sheikh','company','whatsapp']) {
      if(!_quillEditors[k]) continue;
      const clean = sanitize(_quillEditors[k].root.innerHTML);
      await window.DB.Settings.set(k+'_content', clean);
    }
    await window.DB.Settings.set('sheikhs_list', sheikhs);
    try { await window.DB.Settings.delete('sheikh_whatsapp'); } catch(e){}
    await window.DB.Settings.set('whatsapp_number', wn);
    const msg = document.getElementById('content-msg');
    if(msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none', 3000); }
    showToast('تم حفظ المحتويات','success');
  } catch(e) { showToast('خطأ في الحفظ: '+e.message,'error'); }
}

// ===== إعدادات المبرمج =====
window._devSettings = {};

function showDevBtnIfSuperAdmin() {
  const user = window._currentUser;
  if(user && user.role==='superadmin') {
    const btn = document.getElementById('cfg-dev-btn');
    if(btn) btn.style.display = 'inline-block';
    const ibtn = document.getElementById('cfg-import-btn');
    if(ibtn) ibtn.style.display = 'inline-block';
  }
}

async function loadDevSettings() {
  try {
    const devVal = await window.DB.Settings.get('dev_settings');
    if(devVal) {
      const d = devVal;
      window._devSettings = d;
      if(document.getElementById('dev-company-name')) document.getElementById('dev-company-name').value = d.companyName||'';
      if(document.getElementById('dev-license')) document.getElementById('dev-license').value = d.license||'';
      if(document.getElementById('dev-season')) document.getElementById('dev-season').value = d.season||'';
      if(d.logo) {
        const lp = document.getElementById('dev-logo-preview');
        const lc = document.getElementById('dev-logo-current');
        if(lp) { lp.src=d.logo; lp.style.display='block'; }
        if(lc) lc.textContent = '✅ يوجد شعار محفوظ';
        _applyDevLogo(d.logo);
      }
      if(d.stamp) {
        const p = document.getElementById('dev-stamp-preview');
        const c = document.getElementById('dev-stamp-current');
        if(p) { p.src=d.stamp; p.style.display='block'; }
        if(c) c.textContent = '✅ يوجد ختم محفوظ';
      }
      // v22.5: ممثل الشركة
      const rn = document.getElementById('dev-rep-name');
      if(rn) rn.value = d.rep_name || '';
      if(d.rep_sig) {
        const rp = document.getElementById('dev-rep-sig-preview');
        const rc = document.getElementById('dev-rep-sig-current');
        if(rp) { rp.src = d.rep_sig; rp.style.display = 'block'; }
        if(rc) rc.textContent = '✅ يوجد توقيع محفوظ';
      }
    }
  } catch(e) { console.error(e); }
}

function _applyDevLogo() {
  // يعيد بناء كل containers الشعار — يعرض الشعار المرفوع أو الافتراضي 🕋
  const containers = [
    { id: 'login-logo-container', size: 80, style: 'box-shadow:0 4px 12px rgba(0,0,0,.15)' },
    { id: 'admin-logo-container', size: 44, style: '' },
    { id: 'sup-logo-container',   size: 44, style: '' }
  ];
  containers.forEach(c => {
    const el = document.getElementById(c.id);
    if (el) el.innerHTML = _buildLogoHTML(c.size, { style: c.style });
  });
}

function previewDevLogo(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 200;
      let w=img.width, h=img.height;
      if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const compressed = canvas.toDataURL('image/png',0.8);
      const lp = document.getElementById('dev-logo-preview');
      if(lp) { lp.src=compressed; lp.style.display='block'; }
      input._compressedData = compressed;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewStamp(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 200;
      let w = img.width, h = img.height;
      if(w > MAX || h > MAX) {
        if(w > h) { h = Math.round(h * MAX/w); w = MAX; }
        else { w = Math.round(w * MAX/h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/png', 0.8);
      const preview = document.getElementById('dev-stamp-preview');
      if(preview) { preview.src = compressed; preview.style.display = 'block'; }
      // حفظ النسخة المضغوطة مؤقتاً
      input._compressedData = compressed;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// v22.5: معاينة توقيع ممثل الشركة (نمط previewStamp — base64 compressed MAX 200px)
function previewRepSig(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 200;
      let w = img.width, h = img.height;
      if(w > MAX || h > MAX) {
        if(w > h) { h = Math.round(h * MAX/w); w = MAX; }
        else { w = Math.round(w * MAX/h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/png', 0.8);
      const preview = document.getElementById('dev-rep-sig-preview');
      if(preview) { preview.src = compressed; preview.style.display = 'block'; }
      input._compressedData = compressed;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveDevSettings() {
  const companyName = document.getElementById('dev-company-name').value.trim();
  const license = document.getElementById('dev-license').value.trim();
  const season = document.getElementById('dev-season').value.trim();

  // الختم
  const stampFile = document.getElementById('dev-stamp-file').files[0];
  let stamp = window._devSettings.stamp||'';
  if(stampFile) {
    stamp = stampFile._compressedData || await new Promise(res => {
      const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(stampFile);
    });
  }

  // الشعار
  const logoFile = document.getElementById('dev-logo-file').files[0];
  let logo = window._devSettings.logo||'';
  if(logoFile) logo = logoFile._compressedData || await new Promise(res => {
    const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(logoFile);
  });

  // v22.5: ممثل الشركة
  const rep_name = (document.getElementById('dev-rep-name')?.value || '').trim();
  const repSigFile = document.getElementById('dev-rep-sig-file')?.files?.[0];
  let rep_sig = window._devSettings.rep_sig || '';
  if(repSigFile) rep_sig = repSigFile._compressedData || await new Promise(res => {
    const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(repSigFile);
  });

  const settings = { companyName, license, season, stamp, logo, rep_name, rep_sig };
  try {
    await window.DB.Settings.set('dev_settings', settings);
    window._devSettings = settings;
    // تطبيق الشعار واسم الشركة فوراً
    _applyDevLogo();
    _applyCompanyName(companyName);
    showToast('تم حفظ إعدادات النظام', 'success');
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}


async function openGroupCfgModal(id) {
  let g = {};
  if(id) { const groups = await getGroups(); g = groups.find(x=>x.id===id)||{}; }
  const _mt = id ? 'تعديل' : 'إضافة';
  const buses = await getBuses();
  const busOptions = buses.map(b=>`<option value="${b.num||''}" ${g.camp===b.num?'selected':''}>${b.num||''} — ${b.plate||''}</option>`).join('');
  openModal(`
    <h3 class="modal-title">👥 ${_mt} مجموعة</h3>
    <div class="form-row"><label>رقم المجموعة</label><input type="text" id="gcfg-num" value="${g.num||''}" placeholder="1"></div>
    <div class="form-row"><label>اسم المجموعة</label><input type="text" id="gcfg-name" value="${g.name||''}" placeholder="مجموعة الرحمة"></div>
    <div class="form-row"><label>المشرف المسؤول</label><input type="text" id="gcfg-supervisor" value="${g.supervisor||''}" placeholder="اسم المشرف"></div>
    <div class="form-row"><label>رقم الحافلة</label>
      <select id="gcfg-bus">
        <option value="">اختر الحافلة</option>
        ${busOptions}
      </select>
    </div>
    <div class="form-row"><label>ملاحظات</label><textarea id="gcfg-notes" rows="2">${g.notes||''}</textarea></div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveGroupCfg('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

// ===== v11.5 Phase 3a deleteGroupCfg extracted → housing.js =====

async function loadGeneralSettings() {
  try {
    if(!window.DB) return;
    const val = await window.DB.Settings.get('general_settings');
    if(val) {
      const s = val;
      if(document.getElementById('cfg-season')) document.getElementById('cfg-season').value = s.season||'';
      if(document.getElementById('cfg-phone')) document.getElementById('cfg-phone').value = s.phone||'';
    }
    // تحميل إعداد الأسوارة
    const brVal = await window.DB.Settings.get('bracelet_available');
    const brOn = brVal === 'true';
    const cb = document.getElementById('cfg-bracelet');
    if(cb) cb.checked = brOn;
    updateBraceletToggle(brOn);
  } catch(e) {}
}

function updateBraceletToggle(on) {
  const track = document.getElementById('cfg-bracelet-track');
  const knob = document.getElementById('cfg-bracelet-knob');
  if(track) track.style.background = on ? '#c8971a' : '#ccc';
  if(knob) knob.style.left = on ? '27px' : '3px';
}

async function saveBraceletSetting(val) {
  updateBraceletToggle(val);
  try {
    await window.DB.Settings.set('bracelet_available', val.toString());
    showToast(val ? '✅ أسوارة القطار مفعّلة' : '❌ أسوارة القطار موقوفة', 'success');
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function saveGeneralSettings() {
  const s = { season: document.getElementById('cfg-season').value.trim(), phone: document.getElementById('cfg-phone').value.trim() };
  try {
    await window.DB.Settings.set('general_settings', s);
    showToast('تم حفظ الإعدادات العامة', 'success');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
}