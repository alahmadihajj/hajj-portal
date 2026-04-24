// ═══════════════════════════════════════════════════════════════════════
// Housing Module — v11.5 Phase 3a/5
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Dispatcher: showHousingSection, renderHousingSection, currentHousingSection
//   - Camps CRUD: getCamps, saveCampsData, renderCamps, openCampModal, saveCamp, deleteCamp
//   - Groups CRUD: getGroups, saveGroupsData, groupOrdinalName, _hasGroup, renderGroups, openGroupModal, saveGroup, deleteGroup
//   - Group pilgrims modal: showGroupPilgrims, _renderGroupPilgrimsModal, printGroupPilgrims, openUngroupedFromGroup (+ helpers)
//   - Buses CRUD: getBuses, saveBusesData, renderBuses, openBusModal, saveBus, deleteBus, showBusPilgrims, printBusesReport
//   - Cfg: deleteGroupCfg
//
// Dependencies (globals):
//   - ui-helpers.js: showToast, showConfirm
//   - audit.js:      _recordAudit, _buildCampLabel, _buildGroupLabel, _buildBusLabel, _buildFieldChanges
//   - admin.html:    _buildPilgrimCard, _filterPilgrimsByQuery, _getLogo, _buildFiltersBar, openModal, closeModals,
//                    _devSettings, _currentUser, ALL_DATA, _systemGroupNums,
//                    renderAssembly, renderSysUsers, renderRequests, renderNusukTable (via dispatcher),
//                    showUngroupedPilgrims (ungrouped section stays in admin.html)
//   - supabase.js:   window.DB.{Camps,Groups,Buses}.*
// ═══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────
// Block 1 — Housing Dispatcher (was admin.html L3704-3727)
// ─────────────────────────────────────────────
let currentHousingSection = 'camps';

function showHousingSection(sec) {
  ['camps','groups','buses','assembly','nusuk','sysusers','requests'].forEach(s => {
    const el = document.getElementById('hs-' + s);
    const btn = document.getElementById('hs-' + s + '-btn');
    if(el) el.style.display = s === sec ? '' : 'none';
    if(btn) { btn.classList.toggle('hs-active', s === sec); btn.style.background=''; btn.style.borderColor=''; btn.style.color=''; }
  });
  currentHousingSection = sec;
  renderHousingSection();

  // v23.0-pre-dd: تمرير تلقائي للتبويب النشط على الجوال
  setTimeout(() => {
    const activeTab = document.querySelector('div:has(> #hs-camps-btn) > .hs-active');
    if(activeTab && window.innerWidth <= 768){
      activeTab.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    }
  }, 50);
}

function renderHousingSection() {
  switch(currentHousingSection) {
    case 'camps': renderCamps(); break;
    case 'groups': renderGroups(); break;
    case 'buses': renderBuses(); break;
    case 'assembly': renderAssembly(); break;
    case 'sysusers': renderSysUsers(); break;
    case 'requests': renderRequests(); break;
    case 'nusuk': renderNusukTable(window._nusukFilter||''); break;
  }
}

// ─────────────────────────────────────────────
// Block 2 — Camps CRUD (was admin.html L4989-5628)
// ─────────────────────────────────────────────
// ===== مخيمات =====
async function getCamps() {
  try { return window.DB ? await window.DB.Camps.getAll() : []; } catch(e) { return []; }
}
async function saveCampsData(data) { /* Supabase يتولى الحفظ مباشرة */ }


async function renderCamps() {
  const camps = await getCamps();
  window._campsCache = camps; // invalidation: بعد save/delete، renderCamps يعيد التعبئة
  const el = document.getElementById('camps-list');
  if(!camps.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:30px">لا توجد مخيمات بعد. أضف مخيماً جديداً.</p>'; return; }

  const locations = ['منى', 'عرفات', 'مزدلفة'];
  const locIcons = {'منى':'🏕️', 'عرفات':'🌄', 'مزدلفة':'🌙'};
  const genders = ['رجال', 'نساء'];
  const genderColors = {
    'رجال': {bg:'#e8f0fd', color:'#1a5fa8', border:'#b0c8f0'},
    'نساء': {bg:'#fde8f0', color:'#c0006a', border:'#f0b0d0'}
  };

  function getCampAssigned(c, loc) {
    const cNum = c.camp_num||c.name;
    if(loc==='منى') return ALL_DATA.filter(p=>p['mina_camp']===cNum).length;
    if(loc==='عرفات') return ALL_DATA.filter(p=>p['arafat_camp']===cNum).length;
    return 0;
  }

  let html = '';
  locations.forEach(loc => {
    const locCamps = camps.filter(c => c.location === loc);
    if(!locCamps.length) return;

    html += `<div style="margin-bottom:32px">
      <h2 style="font-size:18px;font-weight:700;color:#3d2000;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e0d5c5">${locIcons[loc]} مخيمات ${loc}</h2>`;

    genders.forEach(gender => {
      const gc = locCamps.filter(c => (c.camp_type||'رجال') === gender);
      if(!gc.length) return;
      const gCol = genderColors[gender];
      const totalBeds = gc.reduce((s,c)=>s+(parseInt(c.capacity)||0),0);
      const assigned = gc.reduce((s,c)=>s+getCampAssigned(c,loc),0);
      const avail = totalBeds - assigned;

      html += `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:${gCol.bg};color:${gCol.color};padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;border:1.5px solid ${gCol.border}">${gender==='رجال'?'👨':'👩'} ${gender}</span>
            <span style="font-size:13px;color:#888">${gc.length} مخيم</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span style="background:#f5f5f5;color:#555;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600">🛏️ ${totalBeds} سرير</span>
            <span style="background:#e8f8e8;color:#1a7a1a;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600">✅ ${assigned} مُسكَّن</span>
            <span style="background:#fde8e8;color:#c00;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600">🔓 ${avail} متاح</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
          ${gc.map(c => {
            const cNum = c.camp_num||c.name;
            const asgn = getCampAssigned(c, loc);
            const cap = parseInt(c.capacity)||0;
            const pct = cap ? Math.round(asgn/cap*100) : 0;
            const barColor = pct>=90?'#c00':pct>=60?'#c8971a':'#1a7a1a';
            return `
            <div
              onclick="showCampPilgrims('${cNum}','${loc}')"
              style="background:#fff;border:2px solid ${gCol.border};border-radius:12px;padding:14px;cursor:pointer;transition:all 0.2s;position:relative"
              onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.12)';this.style.transform='translateY(-2px)';this.style.borderColor='${gCol.color}'"
              onmouseout="this.style.boxShadow='none';this.style.transform='none';this.style.borderColor='${gCol.border}'">
              <div style="position:absolute;top:8px;left:8px;background:#3d2000;color:#fff;border-radius:6px;padding:2px 6px;font-size:10px">👆 انقر للتفاصيل</div>
              <div style="font-size:17px;font-weight:700;color:#3d2000;margin-bottom:6px;margin-top:12px">مخيم ${cNum}</div>
              <div style="font-size:12px;color:#888;margin-bottom:8px">🛏️ ${asgn}/${cap} سرير</div>
              <div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden;margin-bottom:10px">
                <div style="background:${barColor};height:100%;width:${pct}%;transition:width 0.3s"></div>
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="event.stopPropagation();openCampModal('${c.id}')" class="btn-edit" style="flex:1;font-size:11px;padding:5px">✏️ تعديل</button>
                <button onclick="event.stopPropagation();deleteCamp('${c.id}')" class="btn-delete" style="font-size:11px;padding:5px 8px">🗑️</button>
              </div>
            </div>`;
          }).join('')}

        </div>
      </div>`;
    });

    html += '</div>';
  });
  el.innerHTML = html || '<p style="color:#888;text-align:center;padding:30px">لا توجد مخيمات بعد.</p>';
}

async function showCampPilgrims(campNum, location) {
  const fieldKey = location === 'منى' ? 'mina_camp' : 'arafat_camp';
  const bedKey = location === 'منى' ? 'mina_bed' : 'arafat_bed';
  const campFieldKey = fieldKey;
  const pilgrims = ALL_DATA.filter(p => p[fieldKey] === campNum);
  
  // تحميل المخيمات للقوائم المنسدلة
  const camps = await getCamps();
  const locCamps = camps.filter(c => c.location === location);
  
  // بناء خيارات الأسرة المتاحة لكل مخيم
  function campBedOptions(c, currentPilgrimId, currentBed) {
    const cNum = c.camp_num||c.name;
    const cap = parseInt(c.capacity)||0;
    const booked = ALL_DATA.filter(p => p[fieldKey]===cNum && p['_supabase_id']!=currentPilgrimId && p[bedKey]).map(p=>p[bedKey]);
    let opts = '<option value="">اختر السرير</option>';
    for(let i=1;i<=cap;i++){
      const v=cNum+'-'+i;
      const isBooked = booked.includes(v);
      const isSelected = v===currentBed;
      if(isBooked && !isSelected) continue;
      opts+=`<option value="${v}" ${isSelected?'selected':''}>${v}</option>`;
    }
    return opts;
  }

  const modalEl = document.getElementById('modal-overlay') || document.querySelector('.modal-overlay');
  
  const content = `
    <!-- معلومات المخيم -->
    ${(()=>{
      const campInfo = camps.find(ci=>(ci.camp_num||ci.name)===campNum)||{};
      const campCap = parseInt(campInfo.capacity)||0;
      const campAvail = Math.max(0, campCap - pilgrims.length);
      const isFull = campCap>0 && campAvail===0;
      return '<div style="background:linear-gradient(135deg,#3d2000,#7a4500);border-radius:12px;padding:10px 16px;margin-bottom:10px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
        +'<div><div style="font-size:18px;font-weight:800">⛺ مخيم '+campNum+' — '+location+'</div>'
        +'<div style="font-size:12px;color:#f0d8a0;margin-top:2px">تم تسكين: <strong style="color:#fff">'+pilgrims.length+'</strong> &nbsp;|&nbsp; المتاح الآن: <strong style="color:'+(isFull?'#f88':'#7ff')+'">'+campAvail+'</strong>'+(campCap>0?' / '+campCap:'')+'</div></div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
        +'<button data-camp="'+campNum+'" data-loc="'+location+'" onclick="printCampReport(this.dataset.camp,this.dataset.loc)" style="padding:7px 14px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">🖨️ طباعة</button>'
        +'<button data-loc="'+location+'" onclick="openUnassignedFromCamp(this.dataset.loc)" style="padding:7px 14px;background:#c8971a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">👥 الغير مُسكَّنين</button>'
        +'<button onclick="closeCampModal()" style="padding:7px 14px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600">✕ إغلاق</button>'
        +'</div></div>';
    })()}
    <span id="camp-view-count" style="display:none">${pilgrims.length}</span>
    ${!pilgrims.length ? '<div style="text-align:center;padding:40px;color:#aaa;font-size:15px">لا يوجد حجاج مُسكَّنون في هذا المخيم بعد</div>' : `
    <!-- فلاتر البحث -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <input id="cv-search" type="text" placeholder="🔍 بحث بالاسم أو الهوية أو الجوال..." oninput="filterCampView()"
        style="flex:1;min-width:180px;padding:7px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
      <select id="cv-f-city" onchange="filterCampView()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">🏙️ كل المدن</option>
        ${[...new Set(pilgrims.map(p=>p['المدينة']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <select id="cv-f-nat" onchange="filterCampView()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">🌍 كل الجنسيات</option>
        ${[...new Set(pilgrims.map(p=>p['الجنسية']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <select id="cv-f-gender" onchange="filterCampView()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">⚧ كل الجنسين</option>
        ${[...new Set(pilgrims.map(p=>p['الجنس']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <select id="cv-f-bus" onchange="filterCampView()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">🚌 كل الحافلات</option>
        ${[...new Set(pilgrims.map(p=>p['رقم الحافلة الخاصة بك']).filter(b => b && String(b).trim() && String(b).trim() !== '-'))].sort((a,b)=>Number(a)-Number(b)).map(v=>`<option value="${v}">حافلة ${v}</option>`).join('')}
      </select>
      <button onclick="document.getElementById('cv-search').value='';['cv-f-city','cv-f-nat','cv-f-gender','cv-f-bus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});filterCampView()"
        style="padding:7px 12px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">↺</button>
    </div>
    <!-- شريط التحديد الجماعي -->
    <div style="display:flex;gap:8px;align-items:center;background:#fff8e8;border:1.5px solid #f0e0b0;border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:600;color:#7a4500;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="cv-check-all" onchange="toggleCVAll(this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
        تحديد الكل
      </label>
      <span id="cv-sel-count" style="font-size:12px;color:#888"></span>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:auto">
        <select id="cv-bulk-camp" onchange="checkCVBulkCamp()" style="padding:6px 10px;border:1.5px solid #ddd;border-radius:7px;font-size:12px;font-family:inherit">
          <option value="">— اختر المخيم —</option>
          ${_buildCampSelectOptions(locCamps, fieldKey, bedKey)}
        </select>
        <span id="cv-bulk-camp-info" style="font-size:11px;color:#888"></span>
        <button onclick="applyCVBulk()" style="padding:6px 14px;background:#c8971a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">⚡ نقل جماعي</button>
      </div>
    </div>
    <div class="modal-table-wrap" style="max-height:50vh">
      <table style="font-size:13px;min-width:800px">
      <colgroup><col style="width:40px"><col style="width:35px"><col style="width:155px"><col style="width:110px"><col style="width:100px"><col style="width:90px"><col style="width:80px"><col style="width:90px"><col style="width:120px"><col style="width:60px"></colgroup>
        <thead style="position:sticky;top:0;z-index:1">
          <tr id="cv-thead-row" style="background:linear-gradient(135deg,#b8860b,#c8971a);color:#fff">
            <th style="padding:9px 8px;text-align:center">☑</th>
            <th style="padding:9px 8px">#</th>
            ${[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['booking','رقم الحجز'],['city','المدينة'],['camp','رقم المخيم'],['bed','رقم السرير']].map(([id,lbl])=>_thSort(id,lbl,window._cvSort,'cv')).join('')}
            <th style="padding:9px 8px">إجراء</th>
          </tr>
        </thead>
        <tbody id="cv-tbody">
          ${(()=>{
            const sorted=[...pilgrims].sort((a,b)=>{const an=parseInt((a[bedKey]||'').split('-')[1])||0;const bn=parseInt((b[bedKey]||'').split('-')[1])||0;return an-bn;});
            return sorted.map((p,i)=>{
            const isDup=isRelated(p);
            return `
          <tr style="background:${isDup?'#f0f0f0':i%2===0?'#fff':'#f9f9f9'};border-bottom:1px solid #eee;${isDup?'border-right:3px solid #c00;border-left:3px solid #c00;':''}cursor:pointer" id="camp-row-${p['_supabase_id']}" ondblclick="showBookingGroup('${p['رقم الحجز']||''}','${p['_supabase_id']}')">
            <td style="padding:8px;text-align:center"><input type="checkbox" class="cv-chk" data-id="${p['_supabase_id']}" onchange="updateCVSelCount()" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a"></td>
            <td style="padding:8px 10px;color:#888">${i+1}</td>
            <td style="padding:8px 10px;font-weight:600;min-width:140px">${p['اسم الحاج']||'—'}</td>
            <td style="padding:8px 10px">${p['رقم الهوية']||'—'}</td>
            <td style="padding:8px 10px">${p['الجنسية']||'—'}</td>
            <td style="padding:8px 10px">${p['الجنس']||'—'}</td>
            <td style="padding:8px 10px">${p['رقم الجوال']||'—'}</td>
            <td style="padding:8px 10px;${isDup?'color:#c00;font-weight:700':i%2===0?'color:#333':'color:#333'}">${p['رقم الحجز']||'—'}</td>
            <td style="padding:8px 10px">${p['المدينة']||'—'}</td>
            <td style="padding:8px 10px">
              <select id="camp-sel-${p['_supabase_id']}" onchange="updateBedOptions(${p['_supabase_id']},'${location}');markRowModified(${p['_supabase_id']})" style="padding:4px 6px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit">
                ${_buildCampSelectOptions(locCamps, fieldKey, bedKey, { capFormat:'short', selected: p[fieldKey], excludePilgrimId: p['_supabase_id'] })}
              </select>
            </td>
            <td style="padding:8px 10px">
              <select id="bed-sel-${p['_supabase_id']}" onchange="markRowModified(${p['_supabase_id']})" style="padding:4px 6px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit">
                ${campBedOptions(locCamps.find(c=>(c.camp_num||c.name)===p[fieldKey])||locCamps[0], p['_supabase_id'], p[bedKey])}
              </select>
            </td>
            <td style="padding:8px 10px;white-space:nowrap">
              <button onclick="saveCampAssign(${p['_supabase_id']},'${location}')" style="padding:4px 8px;background:#1a7a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;margin-left:4px">💾</button>
              <button onclick="removeCampAssign(${p['_supabase_id']},'${location}')" style="padding:4px 8px;background:#c00;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit">🗑️</button>
            </td>
          </tr>`;}).join('');
          })()}
        </tbody>
      </table>
    </div>`}`;

  // فتح نافذة كبيرة
  const overlay = document.getElementById('modal-overlay') || (() => {
    const d = document.createElement('div');
    d.id='modal-overlay';
    document.body.appendChild(d);
    return d;
  })();
  
  const existingModal = document.querySelector('#modal-overlay .modal-box') || document.querySelector('.modal-overlay .modal-box');
  
  openModal(content);
  
  // تكبير النافذة
  setTimeout(() => {
    const box = document.querySelector('.modal-box') || document.querySelector('[class*="modal"]');
    if(box) { box.style.maxWidth='95vw'; box.style.width='95vw'; box.style.maxHeight='90vh'; }
  }, 50);
  
  // إعادة تهيئة التعديلات غير المحفوظة
  window._modifiedRows = new Set();
  
  // حفظ البيانات للتحديث
  window._cvSort = {col:null, dir:1};
  window._campViewData = { camps, locCamps, location, campNum, fieldKey, bedKey };
}

function updateBedOptions(pilgrimId, location) {
  const { locCamps, bedKey, fieldKey } = window._campViewData;
  const campSel = document.getElementById('camp-sel-'+pilgrimId);
  const bedSel = document.getElementById('bed-sel-'+pilgrimId);
  if(!campSel||!bedSel) return;
  const selectedCamp = locCamps.find(c=>(c.camp_num||c.name)===campSel.value);
  if(!selectedCamp) return;
  const cap = parseInt(selectedCamp.capacity)||0;
  const cNum = selectedCamp.camp_num||selectedCamp.name;
  const booked = ALL_DATA.filter(p=>p[fieldKey]===cNum && p['_supabase_id']!=pilgrimId && p[bedKey]).map(p=>p[bedKey]);
  let opts = '<option value="">اختر السرير</option>';
  for(let i=1;i<=cap;i++){
    const v=cNum+'-'+i;
    if(!booked.includes(v)) opts+=`<option value="${v}">${v}</option>`;
  }
  bedSel.innerHTML = opts;
}

async function saveCampAssign(pilgrimId, location) {
  const { fieldKey, bedKey, camps } = window._campViewData;
  const campVal = document.getElementById('camp-sel-'+pilgrimId).value;
  const bedVal = document.getElementById('bed-sel-'+pilgrimId).value;
  if(!bedVal) return showToast('اختر رقم السرير أولاً', 'warning');

  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  const camp    = camps ? camps.find(c=>(c.camp_num||c.name)===campVal) : null;
  const loc     = location === 'منى' ? 'mina' : 'arafat';

  // قاعدة 3 (Double-booking) — مقارنة بعد تطبيع لتجنّب صيغ مختلفة
  const normBed = _normalizeBedId(bedVal, campVal);
  const duplicate = ALL_DATA.find(p =>
    String(p['_supabase_id']) !== String(pilgrimId) &&
    p[fieldKey] === campVal &&
    p[bedKey] &&
    _normalizeBedId(p[bedKey], campVal) === normBed
  );
  if(duplicate) return showToast('السرير محجوز للحاج: ' + (duplicate['اسم الحاج']||''), 'error', 6000);

  // قاعدة 1 (Gender) — error صلب عبر showActionModal
  if(pilgrim && camp && camp.camp_type && !_campMatchesGenderGlobal(camp.camp_type, _genderOf(pilgrim))){
    await showActionModal({
      type:'error',
      title:'جنس غير مطابق — لا يمكن التسكين',
      description:'قاعدة شرعية صلبة: لا يُسكَّن حاج في مخيم من جنس مختلف.',
      items:[
        { icon:'👤', label:'اسم الحاج:',      value: pilgrim['اسم الحاج']||'—' },
        { icon:'🏕️', label:'المخيم المطلوب:', value: campVal + ' (مخصَّص للـ' + camp.camp_type + ')' },
        { icon:'📍', label:'الموقع:',         value: location }
      ],
      actions:[{label:'فهمت', value:null, variant:'primary', color:'danger'}]
    });
    return;
  }

  // قاعدة 2 (Capacity) — toast
  const cap = parseInt(camp?.capacity)||0;
  const occupied = ALL_DATA.filter(p=>p[fieldKey]===campVal && String(p['_supabase_id'])!==String(pilgrimId) && p[bedKey]).length;
  if(cap > 0 && occupied >= cap) return showToast('المخيم ' + campVal + ' ممتلئ — السعة: ' + cap, 'error');

  // قاعدة 8 (Booking Split) — تحذير إذا النقل يفصل الحاج عن مجموعته
  const splitCheck = _checkSingleMoveSplit(pilgrimId, campVal, loc);
  if(splitCheck.willSplit){
    const campsList = {};
    splitCheck.inOtherCamps.forEach(m => {
      const c = m[fieldKey];
      campsList[c] = (campsList[c]||0) + 1;
    });
    const inCampsSummary = Object.entries(campsList).map(([c,n]) => n+' في '+c).join('، ');
    const decision = await showActionModal({
      type:'warning',
      title:'تفكيك مجموعة الحجز',
      description:'الحاج '+(pilgrim?.['اسم الحاج']||'')+' ينتمي لحجز يحتوي '+splitCheck.groupSize+' أشخاص. نقله لوحده سيفصله عن مجموعته.',
      items:[
        { icon:'📋', label:'رقم الحجز:',           value: splitCheck.bookingKey },
        { icon:'👥', label:'إجمالي المجموعة:',    value: splitCheck.groupSize + ' شخص' },
        { icon:'🏕️', label:'الأعضاء الآخرون:',    value: inCampsSummary ? ('موزَّعون: ' + inCampsSummary) : 'لا مواقع محدَّدة' },
        { icon:'❓', label:'غير مُسكَّنين:',       value: splitCheck.unassigned.length + ' شخص' },
        { icon:'➡️', label:'وجهة النقل:',          value: 'مخيم ' + campVal + ' (' + location + ')' }
      ],
      actions:[
        { label:'متابعة الفصل', value:'split', emoji:'⚠️', variant:'primary', color:'warning' },
        { label:'إلغاء',         value:null,    emoji:'❌', variant:'cancel' }
      ]
    });
    if(decision !== 'split') return;
  }

  // قواعد 4 + 5 (bed/seat sync + normalization) عبر helper موحّد
  const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pilgrimId));
  const pilgrimRec = idx >= 0 ? ALL_DATA[idx] : null;
  const updates = {};
  _applyBedAssignment(updates, pilgrimRec, loc, campVal, bedVal);

  // v17.0: snapshot قبل التحديث (للـ audit)
  const seatKeyCA = loc + '_seat';
  const before = pilgrimRec ? {
    [fieldKey]: pilgrimRec[fieldKey] ?? null,
    [bedKey]:   pilgrimRec[bedKey]   ?? null,
    [seatKeyCA]: pilgrimRec[seatKeyCA] ?? null
  } : {};

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
        metadata: { source: 'camp_view_per_row' }
      });
    }
    const row = document.getElementById('camp-row-'+pilgrimId);
    if(row) { row.style.background='#e8f8e8'; setTimeout(()=>row.style.background='',2000); }
    showToast('تم حفظ التسكين بنجاح', 'success');
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

async function removeCampAssign(pilgrimId, location) {
  const pilgrim = ALL_DATA.find(p=>String(p['_supabase_id'])===String(pilgrimId));
  const name = pilgrim ? pilgrim['اسم الحاج'] : '';
  const confirmed = await showConfirm(
    'هل أنت متأكد من إلغاء تسكين الحاج: ' + name + '؟ سيتم إزالة بيانات التسكين نهائياً.',
    'إلغاء التسكين',
    'نعم، إلغاء التسكين',
    '#c00',
    '🗑️'
  );
  if(!confirmed) return;
  const { fieldKey, bedKey } = window._campViewData;
  const updates = {};
  updates[fieldKey] = null;
  updates[bedKey] = null;
  if(location==='منى') { updates.mina_seat=null; }
  else { updates.arafat_seat=null; }
  try {
    await window.DB.Pilgrims.update(parseInt(pilgrimId), updates);
    const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pilgrimId));
    if(idx>=0) { ALL_DATA[idx][fieldKey]=''; ALL_DATA[idx][bedKey]=''; }
    document.getElementById('camp-row-'+pilgrimId).style.opacity='0.3';
    setTimeout(()=>{ showCampPilgrims(window._campViewData.campNum, location); },500);
  } catch(e) { showToast('خطأ: '+e.message, 'error'); }
}

function _getLogo() {
  return (window._devSettings && window._devSettings.logo) ? window._devSettings.logo : '';
}

function _buildLogoHTML(size, options) {
  size = size || 44;
  options = options || {};
  const extraStyle = options.style || '';
  const logo = _getLogo();
  if (logo) {
    return `<img src="${logo}" alt="شعار الشركة" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.1);padding:3px;${extraStyle}">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#3d2000,#7a4500,#c8971a);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size * 0.55)}px;${extraStyle}">🕋</div>`;
}

function _buildPrintLogoHTML(size) {
  size = size || 60;
  const logo = _getLogo();
  if (logo) {
    return `<img src="${logo}" alt="شعار الشركة" style="height:${size}px;width:auto;object-fit:contain;display:block;margin:0 auto">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#3d2000,#7a4500,#c8971a);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size * 0.55)}px;margin:0 auto">🕋</div>`;
}

function _getCompanyName() {
  if(window._devSettings && window._devSettings.companyName) return window._devSettings.companyName;
  return '';
}

function _getLicense() {
  return (window._devSettings && window._devSettings.license) ? window._devSettings.license : '';
}

function _applyCompanyName(name) {
  const displayName = (name && String(name).trim()) || 'شركة الحج';
  const license = _getLicense();

  const applyTo = (el) => {
    if (!el) return;
    el.innerHTML = '';
    const nameDiv = document.createElement('div');
    nameDiv.textContent = displayName;
    el.appendChild(nameDiv);
    if (license) {
      const licDiv = document.createElement('div');
      licDiv.textContent = 'ترخيص رقم: ' + license;
      licDiv.style.fontSize = '0.75em';
      licDiv.style.fontWeight = '500';
      licDiv.style.opacity = '0.85';
      licDiv.style.marginTop = '2px';
      el.appendChild(licDiv);
    }
  };

  const ids = ['admin-company-h1','sup-company-name','login-company-name','gate-company'];
  ids.forEach(id => applyTo(document.getElementById(id)));
  document.querySelectorAll('.company-name-header').forEach(applyTo);
}

function printCampReport(campNum, location) {
  const fieldKey = location === 'منى' ? 'mina_camp' : 'arafat_camp';
  const bedKey = location === 'منى' ? 'mina_bed' : 'arafat_bed';
  const pilgrims = ALL_DATA.filter(p => p[fieldKey] === campNum);
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'});

  window._campViewData = window._campViewData || {};
  const camps = window._campViewData.camps || [];
  const camp = camps.find(c=>(c.camp_num||c.name)===campNum);
  const campType = camp ? (camp.camp_type||'رجال') : 'رجال';
  const logoSrc = _getLogo();

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
  .badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:bold;background:${campType==='نساء'?'#fde8f0':'#e8f0fd'};color:${campType==='نساء'?'#c0006a':'#1a5fa8'}}
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
    <div class="sub">تسكين مشعر ${location}</div>
  </div>
  <div class="header-center">
    ${_buildPrintLogoHTML(75)}
    <div style="font-size:15px;font-weight:bold;color:#3d2000;margin-top:4px">بيان بأسماء الحجاج — مشعر ${location}</div>
  </div>
  <div class="header-left">
    <div class="sub">مخيم رقم: <strong>${campNum}</strong></div>
    <div class="sub">النوع: <span class="badge">${campType==='نساء'?'👩':'👨'} ${campType}</span></div>
    <div class="sub">التاريخ: ${today}</div>
    <div class="sub">وقت الطباعة: ${timeStr}</div>
    <div class="sub">عدد الحجاج: <strong>${pilgrims.length}</strong></div>
  </div>
</div>
    </td></tr>
    <tr>
      <th>#</th>
      <th>اسم الحاج</th>
      <th>رقم الهوية</th>
      <th>الجنسية</th>
      <th>الجنس</th>
      <th>رقم الجوال</th>
      <th>رقم الحجز</th>
      <th>المدينة</th>
      <th>رقم المخيم</th>
      <th>رقم السرير</th>
    </tr>
  </thead>
  <tbody>
    ${pilgrims.map((p,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${p['اسم الحاج']||'—'}</strong></td>
      <td>${p['رقم الهوية']||'—'}</td>
      <td>${p['الجنسية']||'—'}</td>
      <td>${p['الجنس']||'—'}</td>
      <td>${p['رقم الجوال']||'—'}</td>
      <td>${p['رقم الحجز']||'—'}</td>
      <td>${p['المدينة']||'—'}</td>
      <td>${campNum}</td>
      <td><strong>${p[bedKey]||'—'}</strong></td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">
  <div>رقم المخيم: ${campNum} | ${campType}</div>
  <div>إجمالي الحجاج: ${pilgrims.length} حاج</div>
  <div>صفحة 1 من 1</div>
</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  printWin.document.close();
}

async function openCampModal(id) {
  let camp = {};
  const allCamps = await getCamps();
  if(id) { camp = allCamps.find(c=>c.id==id)||{}; }
  const loc = camp.location||'';
  const typ = camp.notes&&camp.notes.includes('نساء') ? 'نساء' : (camp.notes&&camp.notes.includes('رجال') ? 'رجال' : (camp.camp_type||''));
  openModal(`
    <h3 class="modal-title">🏕️ ${id?'تعديل':'إضافة'} مخيم</h3>
    <div class="form-row"><label>📍 الموقع</label>
      <select id="m-camp-location" style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit">
        <option value="">اختر الموقع</option>
        <option value="منى" ${loc==='منى'?'selected':''}>🏕️ منى</option>
        <option value="عرفات" ${loc==='عرفات'?'selected':''}>🌄 عرفات</option>
        <option value="مزدلفة" ${loc==='مزدلفة'?'selected':''}>🌙 مزدلفة</option>
      </select>
    </div>
    <div class="form-row"><label>🔢 رقم المخيم</label><input type="text" id="m-camp-num" value="${camp.camp_num||camp.name||''}" placeholder="101"></div>
    <div class="form-row"><label>👥 نوع المخيم (الجنس)</label>
      <select id="m-camp-type" style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit">
        <option value="رجال" ${typ==='رجال'||!typ?'selected':''}>👨 رجال</option>
        <option value="نساء" ${typ==='نساء'?'selected':''}>👩 نساء</option>
      </select>
    </div>
    <div class="form-row"><label>🛏️ الطاقة الاستيعابية (عدد الأسرة)</label><input type="number" id="m-camp-capacity" value="${camp.capacity||''}" placeholder="100"></div>
    <div class="form-row"><label>📝 ملاحظات</label><textarea id="m-camp-notes" rows="2">${camp.notes||''}</textarea></div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveCamp('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

async function saveCamp(id) {
  const location = document.getElementById('m-camp-location').value.trim();
  if(!location) return showToast('اختر الموقع أولاً', 'warning');
  const campNum = document.getElementById('m-camp-num').value.trim();
  if(!campNum) return showToast('أدخل رقم المخيم', 'warning');
  const campType = document.getElementById('m-camp-type').value;
  // التحقق من عدم تكرار رقم المخيم في نفس الموقع
  const allCamps = await getCamps();
  const duplicate = allCamps.find(c => (c.camp_num||c.name) === campNum && c.location === location && c.id != id);
  if(duplicate) return showToast('رقم المخيم ' + campNum + ' موجود مسبقاً في موقع ' + location, 'warning');
  const obj = { camp_num: campNum, name: campNum, location, camp_type: campType, capacity: document.getElementById('m-camp-capacity').value.trim(), notes: document.getElementById('m-camp-notes').value.trim() };
  // v17.3: snapshot قبل update
  const before = id ? allCamps.find(c => c.id == id) : null;
  try {
    if(id) { await window.DB.Camps.update(parseInt(id), obj); }
    else { await window.DB.Camps.insert(obj); }
    closeModals(); renderCamps();
    // v17.3: audit
    _recordAudit({
      action_type:  id ? 'update' : 'create',
      entity_type:  'camp',
      entity_id:    String(id || obj.camp_num),
      entity_label: _buildCampLabel(obj),
      field_changes: id
        ? _buildFieldChanges(before || {}, obj)
        : { _created: { before: null, after: obj } },
      metadata: { source: 'admin_camps' }
    });
  } catch(e) { showToast('خطأ في الحفظ: ' + e.message, 'error'); }
}

async function deleteCamp(id) {
  const _ck1 = await showConfirm('هل تريد حذف هذا المخيم؟','حذف مخيم','نعم، احذف','#c00','🗑️'); if(!_ck1) return;
  const camps = await getCamps();
  const camp = camps.find(c=>c.id==id);
  if(!camp) return;
  const cNum = camp.camp_num||camp.name;
  const loc = camp.location;
  const hasPilgrims = ALL_DATA.some(p => p['mina_camp']===cNum || p['arafat_camp']===cNum);
  if(hasPilgrims) return showToast('لا يمكن حذف مخيم يوجد به حجاج مُسكَّنون. أزل التسكين أولاً.', 'error', 6000);
  await window.DB.Camps.delete(parseInt(id));
  showToast('تم حذف المخيم بنجاح', 'success');
  renderCamps();
  // v17.3: audit
  _recordAudit({
    action_type:  'delete',
    entity_type:  'camp',
    entity_id:    String(id),
    entity_label: _buildCampLabel(camp),
    field_changes: { _deleted: { before: camp, after: null } },
    metadata: { source: 'admin_camps' }
  });
}

// ─────────────────────────────────────────────
// Block 3 — Groups CRUD (was admin.html L5630-5802)
// ─────────────────────────────────────────────
// ===== أفواج =====
async function getGroups() { try { return window.DB ? await window.DB.Groups.getAll() : []; } catch(e) { return []; } }
async function saveGroupsData(d) { }


function groupOrdinalName(num) {
  const n = parseInt(num);
  const names = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر',
    'الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون'];
  return names[n] ? 'الفوج ' + names[n] : 'الفوج ' + n;
}


function _hasGroup(p) {
  const v = p['رقم فوج التفويج الخاص بك'];
  if(v === null || v === undefined || v === '' || v === '0' || v === 0 || v === 'null' || v === 'undefined') return false;
  // تحقق أن الفوج موجود فعلاً في النظام
  if(window._systemGroupNums && window._systemGroupNums.size > 0) {
    return window._systemGroupNums.has(String(v));
  }
  return true;
}

async function _loadSystemGroups() {
  const groups = await getGroups();
  window._systemGroupNums = new Set(groups.map(g=>String(g.num)));
}

async function renderGroups() {
  const [groups, sysusers] = await Promise.all([getGroups(), getSysUsers()]);
  const el = document.getElementById('groups-list');
  if(!groups.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:40px;color:#aaa">لا توجد أفواج بعد.</p>'; return; }
  groups.sort((a,b)=>Number(a.num)-Number(b.num));
  const supMap = {};
  sysusers.filter(u=>u.role==='supervisor').forEach(s=>{ supMap[s.username]=s; });
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">` +
    groups.map(g => {
      const sup = supMap[g.supervisor] || {};
      const pilgrimsInGroup = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(g.num));
      const count = pilgrimsInGroup.length;
      const max = parseInt(g.max_capacity)||0;
      const pct = max ? Math.min(100,Math.round(count/max*100)) : 0;
      const barColor = pct>=100?'#c00':pct>=80?'#c8971a':'#1a7a1a';
      return `
      <div style="background:#fff;border:1.5px solid #e8ddd0;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer;transition:box-shadow .2s;position:relative"
        onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,.12)'"
        onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'"
        onclick="showGroupPilgrims('${g.num}','${(g.name||groupOrdinalName(g.num)).replace(/'/g,'\'')}')">
        <!-- رأس البطاقة -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:22px;font-weight:800;color:#3d2000">${g.num}</div>
            <div style="font-size:14px;font-weight:700;color:#7a4500;margin-top:2px">${g.name||groupOrdinalName(g.num)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="event.stopPropagation();openGroupModal('${g.id}')" style="padding:5px 10px;background:#f0e8d0;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:#7a4500">✏️</button>
            <button onclick="event.stopPropagation();deleteGroup('${g.id}')" style="padding:5px 10px;background:#fde8e8;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:#c00">🗑️</button>
          </div>
        </div>
        <!-- معلومات المشرف -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;background:#fdf8f0;border-radius:8px;padding:8px 10px">
          <span style="font-size:20px">👤</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#3d2000">${sup.name||g.supervisor||'—'}</div>
            ${sup.phone?`<div style="font-size:11px;color:#888">📱 ${sup.phone}</div>`:''}
            ${g.role?`<div style="font-size:11px;color:#7a4500;font-weight:600">${g.role}</div>`:''}
          </div>
        </div>
        <!-- شريط الطاقة -->
        ${max?`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:4px">
            <span>👥 عدد الحجاج</span>
            <span style="font-weight:700;color:${barColor}">${count} / ${max}</span>
          </div>
          <div style="background:#f0e8d8;border-radius:20px;height:8px;overflow:hidden">
            <div style="background:${barColor};height:100%;width:${pct}%;transition:width .3s;border-radius:20px"></div>
          </div>
        </div>`:`
        <div style="font-size:12px;color:#888;margin-bottom:10px">👥 ${count} حاج مرتبط</div>`}
        ${g.notes?`<div style="font-size:11px;color:#aaa;border-top:1px solid #f0e8d8;padding-top:8px;margin-top:4px">📝 ${g.notes}</div>`:''}
        <div style="text-align:left;font-size:11px;color:#c8971a;margin-top:8px">اضغط لعرض الحجاج ◀</div>
      </div>`;
    }).join('') + '</div>';
}

async function openGroupModal(id) {
  let g = {};
  if(id) { const groups = await getGroups(); g = groups.find(x=>String(x.id)===String(id))||{}; }
  const supervisors = (await getSysUsers()).filter(u=>u.role==='supervisor');
  const supOpts = '<option value="">اختر المشرف</option>' + supervisors.map(s=>`<option value="${s.username}" ${g.supervisor===s.username?'selected':''}>${s.name||s.username}</option>`).join('');
  openModal(`
    <h3 class="modal-title">👥 ${id?'تعديل':'إضافة'} فوج</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row">
        <label>رقم الفوج <span style="color:#c00">*</span></label>
        <input type="number" id="m-g-num" value="${g.num||''}" placeholder="1" min="1"
          oninput="document.getElementById('m-g-name').value=groupOrdinalName(this.value)">
        <div style="font-size:11px;color:#999;margin-top:3px">أرقام فقط</div>
      </div>
      <div class="form-row">
        <label>اسم الفوج <span style="font-size:11px;color:#999">(تلقائي)</span></label>
        <input type="text" id="m-g-name" value="${g.name||groupOrdinalName(g.num)}" readonly style="background:#f5f5f5;color:#888;cursor:not-allowed">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>👤 المشرف (قائد الفوج) <span style="color:#c00">*</span></label>
        <select id="m-g-supervisor">${supOpts}</select>
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>مسئولية المشرف <span style="color:#c00">*</span></label>
        <select id="m-g-role" style="padding:10px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;width:100%">
          <option value="">اختر المسئولية</option>
          ${['قائد الفوج','مساعد قائد الفوج'].map(r=>`<option value="${r}" ${g.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>👥 الطاقة الاستيعابية للفوج <span style="color:#c00">*</span></label>
        <input type="number" id="m-g-capacity" value="${g.max_capacity||''}" placeholder="50" min="1">
        <div style="font-size:11px;color:#999;margin-top:3px">الحد الأقصى لعدد الحجاج</div>
      </div>
      <div class="form-row">
        <label>📝 ملاحظات</label>
        <textarea id="m-g-notes" rows="2" style="width:100%;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical">${g.notes||''}</textarea>
      </div>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveGroup('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

async function saveGroup(id) {
  const num = document.getElementById('m-g-num').value.trim();
  if(!num||parseInt(num)<1) return showToast('أدخل رقم الفوج', 'warning');
  const supervisor = document.getElementById('m-g-supervisor').value;
  if(!supervisor) return showToast('اختر المشرف', 'warning');
  const role = document.getElementById('m-g-role').value;
  if(!role) return showToast('اختر مسئولية المشرف', 'warning');
  const capacity = document.getElementById('m-g-capacity').value.trim();
  if(!capacity||parseInt(capacity)<1) return showToast('أدخل الطاقة الاستيعابية', 'warning');
  // التحقق من عدم تجاوز الطاقة
  if(capacity) {
    const currentCount = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(num)).length;
    if(currentCount > parseInt(capacity)) return showToast('عدد الحجاج الحالي ('+currentCount+') يتجاوز الطاقة المدخلة', 'warning');
  }
  const obj = {
    num,
    name: document.getElementById('m-g-name').value.trim() || groupOrdinalName(num),
    supervisor,
    role: document.getElementById('m-g-role').value,
    max_capacity: capacity ? parseInt(capacity) : null,
    notes: document.getElementById('m-g-notes').value.trim()
  };
  // v17.3: snapshot قبل update
  const allGroups = await getGroups();
  const before = id ? allGroups.find(g => g.id == id) : null;
  try {
    if(id) { await window.DB.Groups.update(parseInt(id), obj); }
    else { await window.DB.Groups.insert(obj); }
    closeModals(); renderGroups(); showToast('تم الحفظ بنجاح', 'success');
    // v17.3: audit
    _recordAudit({
      action_type:  id ? 'update' : 'create',
      entity_type:  'group',
      entity_id:    String(id || obj.num),
      entity_label: _buildGroupLabel(obj),
      field_changes: id
        ? _buildFieldChanges(before || {}, obj)
        : { _created: { before: null, after: obj } },
      metadata: { source: 'admin_groups', ui_path: 'groups_view' }
    });
  } catch(e) { showToast('خطأ في الحفظ: ' + e.message, 'error'); }
}

// ─────────────────────────────────────────────
// Block 4 — نافذة حجاج الفوج (was admin.html L5805-6118)
// ─────────────────────────────────────────────
// ===== نافذة حجاج الفوج =====
window._gpSearch = ''; window._gpModified = new Set();

async function showGroupPilgrims(groupNum, groupName) {
  const groups = await getGroups();
  window._gpGroups = groups;
  window._systemGroupNums = new Set(groups.map(g=>String(g.num)));
  window._gpCurrentGroup = groupNum;
  window._gpCurrentName = groupName;
  window._gpModified = new Set();
  window._gpSearch = '';
  _renderGroupPilgrimsModal(groupNum, groupName);
}


function _buildFilterOpts(data, field, label, id, val) {
  const vals = [...new Set(data.map(p=>p[field]).filter(Boolean))].sort();
  return `<select id="${id}" onchange="${val}" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit;min-width:100px">
    <option value="">${label}</option>
    ${vals.map(v=>`<option value="${v}">${v}</option>`).join('')}
  </select>`;
}

function _applyModalFilters(data, type) {
  const prefix = type;
  const q = (document.getElementById(prefix+'-search')?.value||'').trim().toLowerCase();
  const city = document.getElementById(prefix+'-f-city')?.value||'';
  const nat = document.getElementById(prefix+'-f-nat')?.value||'';
  const gender = document.getElementById(prefix+'-f-gender')?.value||'';
  const bus = document.getElementById(prefix+'-f-bus')?.value||'';
  return data.filter(p=>{
    if(q && !(
      (p['اسم الحاج']||'').toLowerCase().includes(q)||
      (p['رقم الهوية']||'').includes(q)||
      (p['رقم الجوال']||'').includes(q)||
      (p['الجنسية']||'').toLowerCase().includes(q)
    )) return false;
    if(city && p['المدينة']!==city) return false;
    if(nat && p['الجنسية']!==nat) return false;
    if(gender && p['الجنس']!==gender) return false;
    if(bus && String(p['رقم الحافلة الخاصة بك'])!==String(bus)) return false;
    return true;
  });
}

function _buildFiltersBar(data, prefix, onchange) {
  const cities = [...new Set(data.map(p=>p['المدينة']).filter(Boolean))].sort();
  const nats = [...new Set(data.map(p=>p['الجنسية']).filter(Boolean))].sort();
  const genders = [...new Set(data.map(p=>p['الجنس']).filter(Boolean))].sort();
  const buses = [...new Set(data.map(p=>p['رقم الحافلة الخاصة بك']).filter(b => b && String(b).trim() && String(b).trim() !== '-'))].sort((a,b)=>Number(a)-Number(b));
  const sel = v => `style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit"`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
    <input id="${prefix}-search" type="text" placeholder="🔍 بحث بالاسم أو الهوية أو الجوال..."
      oninput="${onchange}" style="flex:1;min-width:180px;padding:7px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
    <select id="${prefix}-f-city" onchange="${onchange}" ${sel()}>
      <option value="">🏙️ كل المدن</option>
      ${cities.map(v=>`<option value="${v}">${v}</option>`).join('')}
    </select>
    <select id="${prefix}-f-nat" onchange="${onchange}" ${sel()}>
      <option value="">🌍 كل الجنسيات</option>
      ${nats.map(v=>`<option value="${v}">${v}</option>`).join('')}
    </select>
    <select id="${prefix}-f-gender" onchange="${onchange}" ${sel()}>
      <option value="">⚧ كل الجنسين</option>
      ${genders.map(v=>`<option value="${v}">${v==='ذكر'||v==='رجل'||v==='male'||v==='Male'?'👨 '+v:'👩 '+v}</option>`).join('')}
    </select>
    <select id="${prefix}-f-bus" onchange="${onchange}" ${sel()}>
      <option value="">🚌 كل الحافلات</option>
      ${buses.map(v=>`<option value="${v}">حافلة ${v}</option>`).join('')}
    </select>
    <button onclick="document.getElementById('${prefix}-search').value='';['f-city','f-nat','f-gender','f-bus'].forEach(f=>{const el=document.getElementById('${prefix}-'+f);if(el)el.value='';});${onchange}" 
      style="padding:7px 12px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">↺</button>
  </div>`;
}

function _renderGroupPilgrimsModal(groupNum, groupName) {
  const allInGroup = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(groupNum));
  const unGrouped = ALL_DATA.filter(p=>!_hasGroup(p));
  const grpOpts = (window._gpGroups||[]).sort((a,b)=>Number(a.num)-Number(b.num))
    .map(g=>`<option value="${g.num}">${g.num} — ${g.name||groupOrdinalName(g.num)}</option>`).join('');
  const filtersBar = _buildFiltersBar(allInGroup, 'gp', '_renderGPTable()');

  openModal(`
    <div style="background:linear-gradient(135deg,#3d2000,#7a4500);border-radius:12px;padding:12px 18px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#fff">👥 ${groupName}</div>
        <div style="font-size:12px;color:#f0d8a0;margin-top:3px">
          عدد الحجاج: <strong style="color:#fff" id="gp-count">${allInGroup.length}</strong>
          ${(window._gpGroups||[]).find(g=>String(g.num)===String(groupNum))?.max_capacity ? ' | الطاقة: <strong style="color:#fff">'+((window._gpGroups||[]).find(g=>String(g.num)===String(groupNum))?.max_capacity||'')+'</strong>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="printGroupPilgrims('${groupNum}','${groupName}')" style="padding:7px 14px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">🖨️ طباعة</button>
        <button onclick="openUngroupedFromGroup()" style="padding:7px 14px;background:#c8971a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">⚠️ غير مفوجين (${unGrouped.length})</button>
        <button onclick="closeGPModal()" style="padding:7px 14px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">✕ إغلاق</button>
      </div>
    </div>
    ${filtersBar}
    <!-- شريط التحديد الجماعي -->
    <div style="display:flex;gap:8px;align-items:center;background:#fff8e8;border:1.5px solid #f0e0b0;border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:600;color:#7a4500;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="gp-check-all" onchange="toggleGPAll(this.checked)" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
        تحديد الكل
      </label>
      <span id="gp-selected-count" style="font-size:12px;color:#888"></span>
      <div style="display:flex;gap:6px;align-items:center;margin-right:auto">
        <select id="gp-bulk-group" style="padding:6px 10px;border:1.5px solid #ddd;border-radius:7px;font-size:12px;font-family:inherit">
          <option value="">— الفوج المستهدف —</option>
          <option value="__remove__" style="color:#c00">🗑️ حذف من التفويج</option>
          ${grpOpts}
        </select>
        <button onclick="applyGPBulk()" style="padding:6px 14px;background:#c8971a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">⚡ تنفيذ جماعي</button>
      </div>
    </div>
    <div class="modal-table-wrap" style="max-height:50vh">
      <table style="font-size:13px;min-width:800px">
      <colgroup><col style="width:40px"><col style="width:35px"><col style="width:155px"><col style="width:110px"><col style="width:100px"><col style="width:90px"><col style="width:80px"><col style="width:90px"><col style="width:120px"><col style="width:60px"></colgroup>
        <thead>
          <tr id="gp-thead-row" style="background:linear-gradient(135deg,#3d2000,#7a4500);color:#fff;position:sticky;top:0">
            <th style="padding:9px 8px;text-align:center">☑</th>
            <th style="padding:9px 8px;text-align:center">#</th>
            ${[['name','الاسم'],['id','الهوية'],['phone','الجوال'],['nat','الجنسية'],['city','المدينة'],['status','حالة الحجز']].map(([id,lbl])=>_thSort(id,lbl,window._gpSort,'gp')).join('')}
            <th style="padding:9px 8px">تغيير الفوج</th>
            <th style="padding:9px 8px">حفظ</th>
          </tr>
        </thead>
        <tbody id="gp-tbody"></tbody>
      </table>
    </div>`);
  setTimeout(()=>{
    const box = document.querySelector('.modal-box');
    if(box){ box.style.maxWidth='96vw'; box.style.width='96vw'; box.style.maxHeight='92vh'; }
    window._gpAllData = allInGroup;
    _renderGPTable();
  },50);
}

function _renderGPTable() {
  const groupNum = window._gpCurrentGroup;
  let pilgrims = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(groupNum));
  pilgrims = _applyModalFilters(pilgrims, 'gp');
  const cntEl = document.getElementById('gp-count');
  if(cntEl) cntEl.textContent = pilgrims.length + ' حاج';
  // ترتيب موحد
  const _gpFieldMap = {name:'اسم الحاج',id:'رقم الهوية',phone:'رقم الجوال',nat:'الجنسية',city:'المدينة',status:'حالة الحجز'};
  const {col:gpCol, dir:gpDir} = window._gpSort||{};
  if(gpCol && _gpFieldMap[gpCol]) {
    pilgrims = [...pilgrims].sort((a,b)=>
      String(a[_gpFieldMap[gpCol]]||'').localeCompare(String(b[_gpFieldMap[gpCol]]||''),'ar',{numeric:true})*gpDir
    );
  }
  // تحديث الرأس
  setTimeout(_refreshGPHeader, 0);
  const grpOpts = (window._gpGroups||[]).sort((a,b)=>Number(a.num)-Number(b.num))
    .map(g=>`<option value="${g.num}">${g.num} — ${g.name||groupOrdinalName(g.num)}</option>`).join('');
  const tbody = document.getElementById('gp-tbody');
  if(!tbody) return;
  if(!pilgrims.length){ tbody.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:30px;color:#aaa">لا توجد نتائج</td></tr>`; return; }
  tbody.innerHTML = pilgrims.map((p,i)=>{
    const isMod = window._gpModified.has(String(p['_supabase_id']));
    const rel = isRelated(p);
    const rowBg = isMod?'#fffbe6':rel?'#f0f0f0':'#fff';
    const rowBorder = rel?'border-right:3px solid #c00;border-left:3px solid #c00;':'';
    return `<tr style="background:${rowBg};border-bottom:1px solid #eee;${rowBorder}" id="gp-row-${p['_supabase_id']}"
      data-bn="${p['رقم الحجز']||''}" data-pid="${p['_supabase_id']}" ondblclick="showBookingGroup(this.dataset.bn,this.dataset.pid,'gp')">
      <td style="padding:8px;text-align:center">
        <input type="checkbox" class="gp-chk" data-id="${p['_supabase_id']}" onchange="updateGPSelectedCount()" style="width:15px;height:15px;cursor:pointer;accent-color:#c8971a">
      </td>
      <td style="padding:8px;text-align:center;color:#aaa">${i+1}</td>
      <td style="padding:8px;font-weight:700;color:#3d2000;white-space:nowrap">${p['اسم الحاج']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['رقم الهوية']||'—'}</td>
      <td style="padding:8px;text-align:center;direction:ltr">${p['رقم الجوال']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['الجنسية']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['المدينة']||'—'}</td>
      <td style="padding:8px;text-align:center;${rel?'color:#c00;font-weight:700':''}">${p['حالة الحجز']||'—'}</td>
      <td style="padding:8px;text-align:center">
        <select id="gp-sel-${p['_supabase_id']}" onchange="onGPGroupChange('${p['_supabase_id']}',this.value)"
          style="padding:5px 8px;border:1.5px solid #ddd;border-radius:6px;font-size:12px;font-family:inherit">
          <option value="">— اختر —</option>
          <option value="__remove__" style="color:#c00;font-weight:700">🗑️ حذف</option>
          ${grpOpts}
        </select>
      </td>
      <td style="padding:8px;text-align:center">
        <button id="gp-save-${p['_supabase_id']}" onclick="saveGPRow('${p['_supabase_id']}')"
          style="padding:5px 10px;background:#c8971a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;display:${isMod?'':'none'}">💾</button>
      </td>
    </tr>`;
  }).join('');
}

function toggleGPAll(checked) {
  document.querySelectorAll('.gp-chk:not(:disabled)').forEach(cb=>cb.checked=checked);
  updateGPSelectedCount();
}
function updateGPSelectedCount() {
  const n = document.querySelectorAll('.gp-chk:checked').length;
  const el = document.getElementById('gp-selected-count');
  if(el) el.textContent = n>0 ? 'محدد: '+n : '';
}
async function applyGPBulk() {
  const selected = [...document.querySelectorAll('.gp-chk:checked')].map(cb=>cb.dataset.id);
  const newGroup = document.getElementById('gp-bulk-group')?.value;
  if(!selected.length) return showToast('حدد حاجاً واحداً على الأقل','warning');
  if(!newGroup) return showToast('اختر الفوج المستهدف','warning');
  const isRemove = newGroup==='__remove__';
  if(!isRemove) {
    const grp=(window._gpGroups||[]).find(g=>String(g.num)===String(newGroup));
    if(grp&&grp.max_capacity){
      const cur=ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(newGroup)).length;
      if(cur+selected.length>parseInt(grp.max_capacity)) return showToast('الفوج '+newGroup+' لا يتسع لـ'+selected.length+' إضافيين (المتاح: '+(parseInt(grp.max_capacity)-cur)+')','warning');
    }
  }
  const ok = await showConfirm((isRemove?'حذف ':'نقل ')+selected.length+' حاج '+(isRemove?'من التفويج':'للفوج '+newGroup)+'؟','تنفيذ جماعي','نعم، نفّذ','#c8971a','⚡');
  if(!ok) return;
  let done=0;
  for(const pid of selected){
    try{
      await window.DB.Pilgrims.update(parseInt(pid),{group_num:isRemove?null:newGroup});
      const idx=ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
      if(idx>=0){ALL_DATA[idx]['رقم فوج التفويج الخاص بك']=isRemove?null:newGroup;}
      done++;
    }catch(e){}
  }
  showToast('تم تفويج '+done+' حاج','success');
  renderGroups();
  _renderGPTable();
}

function onGPGroupChange(pid, newGroup) {
  window._gpModified.add(String(pid));
  const btn = document.getElementById('gp-save-'+pid);
  if(btn) btn.style.display='';
}

async function saveGPRow(pid) {
  const sel = document.getElementById('gp-sel-'+pid);
  if(!sel||!sel.value) return showToast('اختر الفوج أولاً','warning');
  const newGroupNum = sel.value;
  const isRemove = newGroupNum === '__remove__';
  if(!isRemove) {
    const grp = (window._gpGroups||[]).find(g=>String(g.num)===String(newGroupNum));
    if(grp && grp.max_capacity) {
      const currentInGroup = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(newGroupNum)).length;
      if(currentInGroup >= parseInt(grp.max_capacity)) return showToast('الفوج '+newGroupNum+' وصل طاقته القصوى ('+grp.max_capacity+')','warning');
    }
  }
  try {
    await window.DB.Pilgrims.update(parseInt(pid), { group_num: isRemove ? null : newGroupNum });
    const idx = ALL_DATA.findIndex(p=>String(p['_supabase_id'])===String(pid));
    if(idx>=0){
      ALL_DATA[idx]['رقم فوج التفويج الخاص بك'] = isRemove ? null : newGroupNum;
      
    }
    window._gpModified.delete(String(pid));
    _renderGPTable();
    renderGroups();
    showToast(isRemove ? 'تم حذف الحاج من التفويج ✅' : 'تم حفظ تفويج الحاج ✅','success');
  } catch(e){ showToast('خطأ: '+e.message,'error'); }
}

async function closeGPModal() {
  if(window._gpModified && window._gpModified.size>0) {
    const ok = await showConfirm('يوجد '+window._gpModified.size+' تعديل لم يُحفظ. هل تريد الخروج بدون حفظ؟','تعديلات غير محفوظة','نعم، اخرج','#c00','⚠️');
    if(!ok) return;
  }
  window._gpModified = new Set();
  // إذا فُتحت من نافذة الغير مفوجين، ارجع إليها
  if(window._gpFromUG) { window._gpFromUG=false; _renderUngroupedModal(); }
  else closeModals();
}

function openUngroupedFromGroup() {
  window._ugFromGP = true;
  showUngroupedPilgrims();
}

function printGroupPilgrims(groupNum, groupName) {
  const pilgrims = ALL_DATA.filter(p=>String(p['رقم فوج التفويج الخاص بك'])===String(groupNum));
  const w = window.open('','_blank');
  const devS = window._devSettings||{};
  const companyName = devS.companyName||'';
  const logo = _getLogo();
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
  const rows = pilgrims.map((p,i)=>`<tr>
    <td>${i+1}</td><td><strong>${p['اسم الحاج']||'—'}</strong></td>
    <td>${p['رقم الهوية']||'—'}</td><td>${p['رقم الجوال']||'—'}</td>
    <td>${p['الجنسية']||'—'}</td><td>${p['الجنس']||'—'}</td>
    <td>${p['رقم الحجز']||'—'}</td><td>${p['حالة الحجز']||'—'}</td>
    <td>${p['حالة الدفع']||'—'}</td>
  </tr>`).join('');
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <style>@page{size:A4 landscape;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#222;margin:0}
  .hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:4mm}
  .co-name{font-size:15px;font-weight:bold;color:#3d2000}.dt-sub{font-size:12px;color:#3d2000;margin-top:2px}
  table{width:100%;border-collapse:collapse}thead{display:table-header-group}
  th{background:#d0d0d0;color:#333;padding:3px 6px;text-align:center;font-size:11px;border:1px solid #ccc;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{padding:3px 6px;border:1px solid #e0d0b0;font-size:10px;text-align:center}
  tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body><table><thead>
  <tr><td colspan="9" style="border-bottom:3px solid #b8860b;padding-bottom:2mm">
    <div class="hdr">
      <div><div class="co-name">${companyName}</div>${devS.license?`<div style="font-size:11px;color:#555;margin-top:2px">رقم الترخيص: ${devS.license}</div>`:''}</div>
      <div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">${_buildPrintLogoHTML(55)}
        <div style="font-size:14px;font-weight:bold;color:#3d2000;margin-top:2px;text-align:center">${groupName}</div></div>
      <div style="text-align:left"><div class="dt-sub">التاريخ: ${today}</div><div class="dt-sub">وقت الطباعة: ${timeStr}</div><div class="dt-sub">عدد الحجاج: <strong>${pilgrims.length}</strong></div></div>
    </div></td></tr>
  <tr><th>#</th><th>الاسم</th><th>الهوية</th><th>الجوال</th><th>الجنسية</th><th>الجنس</th><th>رقم الحجز</th><th>حالة الحجز</th><th>حالة الدفع</th></tr>
  </thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────
// Block 5 — deleteGroup (isolated) (was admin.html L6305-6322)
// ─────────────────────────────────────────────
async function deleteGroup(id) {
  const _ck2 = await showConfirm('هل تريد حذف هذا الفوج؟','حذف فوج','نعم، احذف','#c00','🗑️'); if(!_ck2) return;
  // v17.3: snapshot قبل حذف
  const allGroups = await getGroups();
  const snap = allGroups.find(g => g.id == id);
  await window.DB.Groups.delete(parseInt(id)); renderGroups();
  // v17.3: audit
  if(snap){
    _recordAudit({
      action_type:  'delete',
      entity_type:  'group',
      entity_id:    String(id),
      entity_label: _buildGroupLabel(snap),
      field_changes: { _deleted: { before: snap, after: null } },
      metadata: { source: 'admin_groups', ui_path: 'groups_view' }
    });
  }
}

// ─────────────────────────────────────────────
// Block 6 — Buses section (was admin.html L6324-6701)
// ─────────────────────────────────────────────
// ===== حافلات =====

async function showBusPilgrims(busNum, driverPhone) {
  window._busCurrent = {num: busNum};
  window._busSort = {col:null, dir:1};
  _renderBusPilgrimsModal(busNum);
}

function _renderBusPilgrimsModal(busNum) {
  const pilgrims = ALL_DATA.filter(p=>String(p['رقم الحافلة الخاصة بك'])===String(busNum));
  const buses = window._busCurrent;

  openModal(`
    <div style="background:linear-gradient(135deg,#1a3a6a,#1a5fa8);border-radius:12px;padding:12px 18px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#fff">🚌 حافلة ${busNum}</div>
        <div style="font-size:12px;color:#c0d8ff;margin-top:3px">
          عدد الحجاج: <strong style="color:#fff" id="bp-count">${pilgrims.length}</strong>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="printBusPilgrims('${busNum}')" style="padding:7px 14px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">🖨️ طباعة</button>
        <button onclick="closeBusModal()" style="padding:7px 14px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">✕ إغلاق</button>
      </div>
    </div>
    <!-- فلاتر -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <input id="bp-search" type="text" placeholder="🔍 بحث بالاسم أو الهوية أو الجوال..."
        oninput="_renderBPTable()" style="flex:1;min-width:180px;padding:7px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">
      <select id="bp-f-city" onchange="_renderBPTable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">🏙️ كل المدن</option>
        ${[...new Set(pilgrims.map(p=>p['المدينة']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <select id="bp-f-nat" onchange="_renderBPTable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">🌍 كل الجنسيات</option>
        ${[...new Set(pilgrims.map(p=>p['الجنسية']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <select id="bp-f-gender" onchange="_renderBPTable()" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-family:inherit">
        <option value="">⚧ كل الجنسين</option>
        ${[...new Set(pilgrims.map(p=>p['الجنس']).filter(Boolean))].sort().map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <button onclick="['bp-search','bp-f-city','bp-f-nat','bp-f-gender'].forEach(id=>{const el=document.getElementById(id);if(el&&el.tagName==='INPUT')el.value='';else if(el)el.value='';});_renderBPTable()"
        style="padding:7px 12px;background:#eee;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">↺</button>
    </div>
    <div class="modal-table-wrap" style="max-height:55vh">
      <table style="font-size:13px;min-width:700px">
        <colgroup><col style="width:35px"><col style="width:155px"><col style="width:110px"><col style="width:90px"><col style="width:50px"><col style="width:110px"><col style="width:80px"><col style="width:90px"><col style="width:80px"></colgroup>
        <thead>
          <tr id="bp-thead-row" style="background:linear-gradient(135deg,#1a3a6a,#1a5fa8);color:#fff;position:sticky;top:0">
            <th style="padding:9px 8px">#</th>
            ${[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['city','المدينة'],['mcamp','مخيم منى'],['grp','الفوج']].map(([id,lbl])=>_thSort(id,lbl,window._busSort||{col:null,dir:1},'bp')).join('')}
          </tr>
        </thead>
        <tbody id="bp-tbody"></tbody>
      </table>
    </div>`);
  setTimeout(()=>{
    const box=document.querySelector('.modal-box');
    if(box){box.style.maxWidth='92vw';box.style.width='92vw';box.style.maxHeight='90vh';}
    _renderBPTable();
  },50);
}

function _renderBPTable() {
  if(!window._busCurrent) return;
  const busNum = window._busCurrent.num;
  const q=(document.getElementById('bp-search')?.value||'').trim().toLowerCase();
  const city=document.getElementById('bp-f-city')?.value||'';
  const nat=document.getElementById('bp-f-nat')?.value||'';
  const gender=document.getElementById('bp-f-gender')?.value||'';
  const {col,dir}=window._busSort||{};
  const _bpFieldMap={name:'اسم الحاج',id:'رقم الهوية',nat:'الجنسية',gender:'الجنس',phone:'رقم الجوال',city:'المدينة',mcamp:'mina_camp',grp:'رقم فوج التفويج الخاص بك'};
  let pilgrims=ALL_DATA.filter(p=>String(p['رقم الحافلة الخاصة بك'])===String(busNum));
  if(q) pilgrims=pilgrims.filter(p=>[(p['اسم الحاج']||''),(p['رقم الهوية']||''),(p['رقم الجوال']||'')].some(v=>v.toLowerCase().includes(q)));
  if(city) pilgrims=pilgrims.filter(p=>p['المدينة']===city);
  if(nat) pilgrims=pilgrims.filter(p=>p['الجنسية']===nat);
  if(gender) pilgrims=pilgrims.filter(p=>p['الجنس']===gender);
  if(col&&_bpFieldMap[col]) pilgrims=[...pilgrims].sort((a,b)=>String(a[_bpFieldMap[col]]||'').localeCompare(String(b[_bpFieldMap[col]]||''),'ar',{numeric:true})*dir);
  const cnt=document.getElementById('bp-count'); if(cnt) cnt.textContent=pilgrims.length;
  const tbody=document.getElementById('bp-tbody'); if(!tbody) return;
  if(!pilgrims.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:#aaa">لا توجد نتائج</td></tr>';return;}
  // تحديث رأس الجدول
  const th=document.getElementById('bp-thead-row');
  if(th) th.innerHTML='<th style="padding:9px 8px">#</th>'+[['name','اسم الحاج'],['id','رقم الهوية'],['nat','الجنسية'],['gender','الجنس'],['phone','رقم الجوال'],['city','المدينة'],['mcamp','مخيم منى'],['grp','الفوج']].map(([id,lbl])=>_thSort(id,lbl,window._busSort||{col:null,dir:1},'bp')).join('');
  tbody.innerHTML=pilgrims.map((p,i)=>{
    const rel=isRelated(p);
    const rowBg=rel?'#f0f0f0':'#fff';
    const rowBorder=rel?'border-right:3px solid #c00;border-left:3px solid #c00;':'';
    return `<tr style="background:${rowBg};border-bottom:1px solid #eee;${rowBorder}"
      data-bn="${p['رقم الحجز']||''}" data-pid="${p['_supabase_id']}" ondblclick="showBookingGroup(this.dataset.bn,this.dataset.pid,'bp')">
      <td style="padding:8px;text-align:center;color:#aaa">${i+1}</td>
      <td style="padding:8px;font-weight:700;color:#3d2000;white-space:nowrap">${p['اسم الحاج']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['رقم الهوية']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['الجنسية']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['الجنس']||'—'}</td>
      <td style="padding:8px;text-align:center;direction:ltr">${p['رقم الجوال']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['المدينة']||'—'}</td>
      <td style="padding:8px;text-align:center">${p['mina_camp']||'—'}</td>
      <td style="padding:8px;text-align:center;${rel?'color:#c00;font-weight:700':''}">${p['رقم الحجز']||'—'}</td>
    </tr>`;
  }).join('');
}

function closeBusModal() {
  closeModals();
}

function printBusPilgrims(busNum) {
  const pilgrims=ALL_DATA.filter(p=>String(p['رقم الحافلة الخاصة بك'])===String(busNum));
  const w=window.open('','_blank');
  const devS=window._devSettings||{};
  const companyName=devS.companyName||'';
  const logo=_getLogo();
  const now=new Date();
  const rows=pilgrims.map((p,i)=>`<tr>
    <td>${i+1}</td><td><strong>${p['اسم الحاج']||'—'}</strong></td>
    <td>${p['رقم الهوية']||'—'}</td><td>${p['رقم الجوال']||'—'}</td>
    <td>${p['الجنسية']||'—'}</td><td>${p['المدينة']||'—'}</td>
    <td>${p['mina_camp']||'—'}</td><td>${p['رقم الحجز']||'—'}</td>
  </tr>`).join('');
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <style>@page{size:A4 landscape;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#222;margin:0}
  .hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:4mm}
  .co-name{font-size:15px;font-weight:bold;color:#3d2000}.dt-sub{font-size:12px;color:#3d2000;margin-top:2px}
  table{width:100%;border-collapse:collapse}thead{display:table-header-group}
  th{background:#d0d0d0;color:#333;padding:3px 6px;text-align:center;font-size:11px;border:1px solid #ccc;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{padding:3px 6px;border:1px solid #e0d0b0;font-size:10px;text-align:center}
  tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body><table><thead>
  <tr><td colspan="8" style="border-bottom:3px solid #1a5fa8;padding-bottom:2mm">
    <div class="hdr">
      <div><div class="co-name">${companyName}</div>${devS.license?`<div style="font-size:11px;color:#555">رقم الترخيص: ${devS.license}</div>`:''}</div>
      <div style="text-align:center">${_buildPrintLogoHTML(55)}
        <div style="font-size:14px;font-weight:bold;color:#1a5fa8;margin-top:2px">حافلة ${busNum}</div></div>
      <div style="text-align:left"><div class="dt-sub">التاريخ: ${now.toLocaleDateString('ar-SA')}</div><div class="dt-sub">عدد الحجاج: <strong>${pilgrims.length}</strong></div></div>
    </div></td></tr>
  <tr><th>#</th><th>الاسم</th><th>الهوية</th><th>الجوال</th><th>الجنسية</th><th>المدينة</th><th>مخيم منى</th><th>رقم الحجز</th></tr>
  </thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

async function getBuses() { try { return window.DB ? await window.DB.Buses.getAll() : []; } catch(e) { return []; } }
async function saveBusesData(d) { }

async function renderBuses() {
  const buses = await getBuses();
  const el = document.getElementById('buses-list');
  if(!buses.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:30px">لا توجد حافلات بعد.</p>'; return; }
  el.innerHTML = buses.map(b => `
    <div class="item-card" style="cursor:pointer" onclick="showBusPilgrims('${b.num}','${b.driverPhone||b.driver_phone||''}')">
      <div class="item-card-body">
        <div class="item-card-title">🚌 مجموعة ${b.num} &nbsp;<span style="font-size:13px;font-weight:600;color:#7a4500;background:#fdf0e0;padding:2px 10px;border-radius:8px;letter-spacing:4px">${b.plate ? (b.plate.split(' ')[0]||'').split('').join(' ')+' | '+(b.plate.split(' ')[1]||'') : '—'}</span>${b.busType?` <span style="font-size:12px;color:#555;background:#f5f5f5;padding:2px 8px;border-radius:6px">${b.bus_type}</span>`:''}</div>
        <div class="item-card-sub">👤 ${b.driver||'—'} &nbsp;|&nbsp; 📞 ${b.driverPhone||'—'} &nbsp;|&nbsp; 🪪 ${b.driverId||'—'} &nbsp;|&nbsp; 👥 ${b.capacity||'—'} راكب</div>
        ${(b.model||b.color)?`<div class="item-card-sub">🚌 ${b.model||''} ${b.color?'| 🎨 '+b.color:''}</div>`:''}
        ${b.entry_time?`<div class="item-card-sub" style="font-size:11px;color:#bbb">🕐 أُدخل: ${b.entry_time}</div>`:''}
        <div style="text-align:left;font-size:11px;color:#c8971a;margin-top:6px">اضغط لعرض الحجاج ◀</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-edit" onclick="event.stopPropagation();openBusModal('${b.id}')">✏️ تعديل</button>
        <button class="btn-delete" onclick="event.stopPropagation();deleteBus('${b.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function openBusModal(id) {
  let b = {};
  if(id) { const buses = await getBuses(); b = buses.find(x=>String(x.id)===String(id))||{}; }
  // التحقق من الأرقام المستخدمة لمنع التكرار
  const allBuses = await getBuses();
  const usedNums = allBuses.filter(x=>!id||x.id!==parseInt(id)).map(x=>String(x.num));
  openModal(`
    <h3 class="modal-title">🚌 ${id?'تعديل':'إضافة'} حافلة</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row">
        <label>رقم مجموعة الحافلة <span style="color:#c00">*</span></label>
        <input type="number" id="m-b-num" value="${b.num||''}" placeholder="1" min="1" style="font-size:16px;font-weight:700">
        <div style="font-size:11px;color:#999;margin-top:3px">أرقام فقط، يبدأ من 1، لا يتكرر</div>
      </div>
      <div class="form-row">
        <label>الطاقة الاستيعابية <span style="color:#c00">*</span></label>
        <input type="number" id="m-b-capacity" value="${b.capacity||''}" placeholder="50">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>🚗 رقم اللوحة <span style="color:#c00">*</span></label>
        <div style="display:flex;gap:8px;align-items:center;direction:rtl">
          <div style="display:flex;gap:4px">
            <input type="text" id="m-b-plate-c1" maxlength="1" value="${(b.plate||'').split(' ')[0]?.[0]||''}"
              style="width:44px;text-align:center;font-size:18px;font-weight:700;padding:8px 4px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit"
              oninput="this.value=this.value.replace(/[^أ-ي]/g,'').slice(0,1);if(this.value)this.nextElementSibling.focus()">
            <input type="text" id="m-b-plate-c2" maxlength="1" value="${(b.plate||'').split(' ')[0]?.[1]||''}"
              style="width:44px;text-align:center;font-size:18px;font-weight:700;padding:8px 4px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit"
              oninput="this.value=this.value.replace(/[^أ-ي]/g,'').slice(0,1);if(this.value)this.nextElementSibling.focus()">
            <input type="text" id="m-b-plate-c3" maxlength="1" value="${(b.plate||'').split(' ')[0]?.[2]||''}"
              style="width:44px;text-align:center;font-size:18px;font-weight:700;padding:8px 4px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit"
              oninput="this.value=this.value.replace(/[^أ-ي]/g,'').slice(0,1)">
          </div>
          <span style="font-size:20px;color:#ccc;font-weight:300">|</span>
          <input type="text" id="m-b-plate-n" maxlength="4" value="${(b.plate||'').split(' ')[1]||''}"
            style="width:90px;text-align:center;font-size:18px;font-weight:700;padding:8px 6px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;letter-spacing:3px"
            oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,4)"
            placeholder="1234">
        </div>
      </div>
      <div class="form-row">
        <label>👤 اسم السائق <span style="color:#c00">*</span></label>
        <input type="text" id="m-b-driver" value="${b.driver||''}" placeholder="اسم السائق">
      </div>
      <div class="form-row">
        <label>📱 جوال السائق <span style="color:#c00">*</span></label>
        <input type="text" id="m-b-phone" value="${b.driverPhone||''}" placeholder="0500000000">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>🪪 هوية السائق <span style="color:#c00">*</span></label>
        <input type="text" id="m-b-driverid" value="${b.driverId||''}" placeholder="رقم الهوية الوطنية">
      </div>
      <div class="form-row">
        <label>🚌 موديل الحافلة (السنة) <span style="color:#c00">*</span></label>
        <select id="m-b-model" style="padding:10px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;width:100%">
          <option value="">اختر السنة</option>
          ${Array.from({length:26},(_,i)=>2015+i).map(y=>`<option value="${y}" ${String(b.model||'')===String(y)?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>📋 نوع الحافلة (الشركة المصنعة) <span style="color:#c00">*</span></label>
        <input type="text" id="m-b-type" value="${b.busType||''}" placeholder="مثال: تويوتا، هيونداي...">
      </div>
      <div class="form-row">
        <label>🎨 اللون <span style="color:#c00">*</span></label>
        <input type="text" id="m-b-color" value="${b.color||''}" placeholder="مثال: أبيض">
      </div>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveBus('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
  // حفظ الأرقام المستخدمة للتحقق
  window._usedBusNums = usedNums;
}

async function saveBus(id) {
  const num = document.getElementById('m-b-num').value.trim();
  if(!num) return showToast('أدخل رقم مجموعة الحافلة', 'warning');
  if(parseInt(num) < 1) return showToast('الرقم يجب أن يبدأ من 1', 'warning');
  if((window._usedBusNums||[]).includes(num)) return showToast('رقم المجموعة ' + num + ' مستخدم بالفعل', 'warning');
  if(!document.getElementById('m-b-capacity').value.trim()) return showToast('أدخل الطاقة الاستيعابية', 'warning');
  const phone = document.getElementById('m-b-phone').value.trim();
  if(phone && (!/^05\d{8}$/.test(phone))) return showToast('رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام', 'warning');
  const driverId = document.getElementById('m-b-driverid').value.trim();
  if(driverId && (!/^\d{10}$/.test(driverId))) return showToast('هوية السائق يجب أن تتكون من 10 أرقام فقط', 'warning');
  if(!document.getElementById('m-b-driver').value.trim()) return showToast('أدخل اسم السائق', 'warning');
  if(!document.getElementById('m-b-phone').value.trim()) return showToast('أدخل جوال السائق', 'warning');
  if(!document.getElementById('m-b-driverid').value.trim()) return showToast('أدخل هوية السائق', 'warning');
  if(!document.getElementById('m-b-type').value.trim()) return showToast('أدخل نوع الحافلة (الشركة المصنعة)', 'warning');
  if(!document.getElementById('m-b-model').value) return showToast('اختر موديل الحافلة (السنة)', 'warning');
  if(!document.getElementById('m-b-color').value.trim()) return showToast('أدخل لون الحافلة', 'warning');
  const c1 = document.getElementById('m-b-plate-c1').value.trim();
  const c2 = document.getElementById('m-b-plate-c2').value.trim();
  const c3 = document.getElementById('m-b-plate-c3').value.trim();
  const pn = document.getElementById('m-b-plate-n').value.trim();
  const plateLetters = (c1+c2+c3).trim();
  const plate = (plateLetters && pn) ? plateLetters + ' ' + pn : (plateLetters || pn || '');
  if(!plateLetters || !pn) return showToast('أدخل رقم اللوحة كاملاً (أحرف وأرقام)', 'warning');
  const now = new Date().toLocaleDateString('ar-SA') + ' ' + new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
  const obj = {
    num,
    plate,
    driver: document.getElementById('m-b-driver').value.trim(),
    driver_phone: document.getElementById('m-b-phone').value.trim(),
    driver_id: document.getElementById('m-b-driverid').value.trim(),
    capacity: document.getElementById('m-b-capacity').value.trim(),
    model: document.getElementById('m-b-model').value.trim(),
    bus_type: document.getElementById('m-b-type').value.trim(),
    color: document.getElementById('m-b-color').value.trim(),
    entry_time: now
  };
  // v17.3: snapshot قبل update
  const allBuses = await window.DB.Buses.getAll();
  const before = id ? allBuses.find(b => b.id == id) : null;
  try {
    if(id) { await window.DB.Buses.update(parseInt(id), obj); }
    else { await window.DB.Buses.insert(obj); }
    closeModals(); renderBuses(); showToast('تم الحفظ بنجاح', 'success');
    // v17.3: audit
    _recordAudit({
      action_type:  id ? 'update' : 'create',
      entity_type:  'bus',
      entity_id:    String(id || obj.num),
      entity_label: _buildBusLabel(obj),
      field_changes: id
        ? _buildFieldChanges(before || {}, obj)
        : { _created: { before: null, after: obj } },
      metadata: { source: 'admin_buses' }
    });
  } catch(e) { showToast('خطأ في الحفظ: ' + e.message, 'error'); }
}


function printBusesReport() {
  const w = window.open('', '_blank');
  const now = new Date();
  const today = now.toLocaleDateString('ar-SA');
  const timeStr = now.toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'});
  const logo = _getLogo();
  const devS = window._devSettings||{};
  const companyName = devS.companyName||'';
  getBuses().then(buses => {
    buses.sort((a,b)=>Number(a.num)-Number(b.num));
    const rows = buses.map((b,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${b.num||'—'}</strong></td>
      <td style="letter-spacing:4px;font-weight:700">${b.plate ? (b.plate.split(' ')[0]||'').split('').join(' ')+' | '+(b.plate.split(' ')[1]||'') : '—'}</td>
      <td>${b.bus_type||'—'}</td>
      <td>${b.model||'—'}</td>
      <td>${b.color||'—'}</td>
      <td>${b.driver||'—'}</td>
      <td>${b.driverPhone||b.driver_phone||'—'}</td>
      <td>${b.driver_id||'—'}</td>
      <td>${b.capacity||'—'}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الحافلات</title>
    <style>
      @page{size:A4 landscape;margin:8mm 10mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#222;margin:0}
      .hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:4mm}
      .co-name{font-size:15px;font-weight:bold;color:#3d2000}
      .dt-sub{font-size:12px;color:#3d2000;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      thead{display:table-header-group}
      th{background:#d0d0d0;color:#333;padding:3px 6px;text-align:center;font-size:11px;border:1px solid #ccc;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      td{padding:3px 6px;border:1px solid #e0d0b0;font-size:10px;text-align:center}
      tr:nth-child(even){background:#fffbf0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body>
    <table><thead>
      <tr><td colspan="10" style="border-bottom:3px solid #b8860b;padding-bottom:2mm">
        <div class="hdr">
          <div style="text-align:right">
            <div class="co-name">${companyName}</div>
            ${devS.license?`<div style="font-size:11px;color:#555;margin-top:2px">رقم الترخيص: ${devS.license}</div>`:''}
          </div>
          <div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
            ${_buildPrintLogoHTML(55)}
            <div style="font-size:14px;font-weight:bold;color:#3d2000;margin-top:3px;text-align:center">تقرير الحافلات</div>
          </div>
          <div style="text-align:left">
            <div class="dt-sub">التاريخ: ${today}</div>
            <div class="dt-sub">وقت الطباعة: ${timeStr}</div>
            <div class="dt-sub">عدد الحافلات: <strong>${buses.length}</strong></div>
          </div>
        </div>
      </td></tr>
      <tr><th>#</th><th>رقم المجموعة</th><th>رقم اللوحة</th><th>النوع</th><th>الموديل</th><th>اللون</th><th>السائق</th><th>الجوال</th><th>الهوية</th><th>الطاقة</th></tr>
    </thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
    w.document.write(html);
    w.document.close();
  });
}

async function deleteBus(id) {
  const _ck3 = await showConfirm('هل تريد حذف هذه الحافلة؟','حذف حافلة','نعم، احذف','#c00','🗑️'); if(!_ck3) return;
  // v17.3: snapshot قبل حذف
  const allBuses = await window.DB.Buses.getAll();
  const snap = allBuses.find(b => b.id == id);
  await window.DB.Buses.delete(parseInt(id)); renderBuses();
  // v17.3: audit
  if(snap){
    _recordAudit({
      action_type:  'delete',
      entity_type:  'bus',
      entity_id:    String(id),
      entity_label: _buildBusLabel(snap),
      field_changes: { _deleted: { before: snap, after: null } },
      metadata: { source: 'admin_buses' }
    });
  }
}

// ─────────────────────────────────────────────
// Block 7 — deleteGroupCfg (was admin.html L8070-8088)
// ─────────────────────────────────────────────
async function deleteGroupCfg(id) {
  const ok = await showConfirm('حذف هذه المجموعة؟', 'تأكيد', 'حذف', '#c00', '🗑️');
  if(!ok) return;
  // v17.3: snapshot قبل حذف
  const allGroups = await getGroups();
  const snap = allGroups.find(g => g.id == id);
  await window.DB.Groups.delete(parseInt(id)); renderGroupsCfg(); showToast('تم الحذف', 'success');
  // v17.3: audit
  if(snap){
    _recordAudit({
      action_type:  'delete',
      entity_type:  'group',
      entity_id:    String(id),
      entity_label: _buildGroupLabel(snap),
      field_changes: { _deleted: { before: snap, after: null } },
      metadata: { source: 'admin_groups', ui_path: 'settings_groups_cfg' }
    });
  }
}