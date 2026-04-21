// ═══════════════════════════════════════════════════════════════════════
// Announcements Module — v11.5 Phase 5b/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - CRUD: getAnnouncements, saveAnnouncementsData, renderAnnouncements
//   - UI: toggleAnnCard, _closeAllAnnCards, openAnnModal, updateActiveLabel,
//         toggleAssemblyRow, fillFromAssembly
//   - Actions: saveAnn, toggleAnn, deleteAnn
//
// Dependencies (globals):
//   - ui-helpers.js: showToast, showConfirm
//   - admin.html:    openModal, closeModals, ALL_DATA
//   - supabase.js:   window.DB.Announcements.*
//   - CDN:           Quill, DOMPurify
// ═══════════════════════════════════════════════════════════════════════

// ===== التعاميم =====
const ANN_KEY = 'haj_announcements';

const annTypes = {
  info:     { label: 'معلومة',        color: '#1a5fa8', bg: '#e8f0fd', icon: 'ℹ️' },
  warning:  { label: 'تنبيه',         color: '#a86b00', bg: '#fdf5e0', icon: '⚠️' },
  urgent:   { label: 'عاجل',          color: '#c00',    bg: '#fde8e8', icon: '🚨' },
  success:  { label: 'إيجابي',        color: '#1a7a1a', bg: '#e8f8e8', icon: '✅' },
  assembly: { label: 'نقطة تجمع',    color: '#6a1a8e', bg: '#f3e8fd', icon: '📍' },
};

async function getAnnouncements() {
  try {
    if(window.DB) return await window.DB.Announcements.getAll();
    return [];
  } catch(e) { return []; }
}
async function saveAnnouncementsData(d) {
  // لا حاجة - كل عملية تحفظ مباشرة في Supabase
}

async function renderAnnouncements() {
  const anns = await getAnnouncements();
  const statsEl = document.getElementById('ann-stats');
  const listEl = document.getElementById('ann-list');
  const total = anns.length;
  const active = anns.filter(a=>a.active!==false).length;
  statsEl.innerHTML = `
    <div style="background:#fff;border:1.5px solid #e0d5c5;border-radius:10px;padding:12px 20px;text-align:center;min-width:90px">
      <div style="font-size:22px;font-weight:700;color:#3d2000">${total}</div>
      <div style="font-size:12px;color:#888">الإجمالي</div>
    </div>
    <div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:10px;padding:12px 20px;text-align:center;min-width:90px">
      <div style="font-size:22px;font-weight:700;color:#1a7a1a">${active}</div>
      <div style="font-size:12px;color:#888">نشط</div>
    </div>
    <div style="background:#fff;border:1.5px solid #f5c6c6;border-radius:10px;padding:12px 20px;text-align:center;min-width:90px">
      <div style="font-size:22px;font-weight:700;color:#c00">${total-active}</div>
      <div style="font-size:12px;color:#888">مخفي</div>
    </div>`;

  if(!anns.length){
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:40px;margin-bottom:12px">📢</div><div>لا توجد تعاميم. أضف تعميماً جديداً.</div></div>';
    return;
  }
  listEl.innerHTML = anns.map(a => {
    const t = annTypes[a.type] || annTypes.info;
    const bodyPreview = (a.body||'').replace(/\n/g,' ').slice(0,100) + ((a.body||'').length>100?'...':'');
    return `
    <div class="ann-card" id="ann-card-${a.id}"
      style="background:#fff;border:1.5px solid ${a.active===false?'#e0e0e0':t.color+'33'};border-right:5px solid ${a.active===false?'#ccc':t.color};border-radius:14px;padding:16px 20px;margin-bottom:12px;opacity:${a.active===false?'0.6':'1'};cursor:pointer;transition:box-shadow .2s,transform .15s;box-shadow:0 1px 6px rgba(0,0,0,.06)"
      onclick="toggleAnnCard('${a.id}',event)"
      onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,.12)';this.style.transform='translateY(-1px)'"
      onmouseout="this.style.boxShadow='0 1px 6px rgba(0,0,0,.06)';this.style.transform=''">

      <!-- رأس البطاقة -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1;min-width:0">
          <span style="background:${t.bg};color:${t.color};padding:5px 13px;border-radius:20px;font-size:13px;font-weight:700;white-space:nowrap;letter-spacing:.3px">${t.icon} ${t.label}</span>
          <span style="font-size:16px;font-weight:800;color:#2d1500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">${a.title||''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${a.city?'<span style="background:#f3e8fd;color:#6a1a8e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">🏙️ '+a.city+'</span>':'<span style="background:#f5f5f5;color:#999;padding:3px 10px;border-radius:20px;font-size:12px">🌐 الكل</span>'}
          ${a.active===false?'<span style="background:#fde8e8;color:#c00;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600">🔴 مخفي</span>':'<span style="background:#e8f8e8;color:#1a7a1a;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600">✅ نشط</span>'}
          <span id="ann-arrow-${a.id}" style="font-size:14px;color:#c8971a;transition:transform .25s;font-weight:700">▼</span>
        </div>
      </div>

      <!-- التاريخ + معاينة -->
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:#bbb">📅 ${a.ann_date||''} ${a.published_time?'<span style="color:#c8971a">'+a.published_time+'</span>':''}</span>
        ${a.published_by?'<span style="font-size:12px;color:#bbb">👤 '+a.published_by+'</span>':''}
        <div id="ann-preview-${a.id}" style="font-size:13px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${bodyPreview}</div>
      </div>

      <!-- التفاصيل — مخفية افتراضياً -->
      <div id="ann-detail-${a.id}" style="display:none;margin-top:14px;border-top:1.5px dashed #f0e8d8;padding-top:14px">
        <div style="font-size:15px;color:#444;line-height:1.9;white-space:pre-wrap;margin-bottom:14px;background:${t.bg}22;border-radius:10px;padding:12px 14px">${a.body||''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" onclick="event.stopPropagation()">
          <button class="btn-edit" onclick="openAnnModal('${a.id}')">✏️ تعديل</button>
          <button class="btn-edit" style="background:${a.active===false?'#e8f8e8':'#fde8e8'};color:${a.active===false?'#1a7a1a':'#c00'}" onclick="toggleAnn('${a.id}')">${a.active===false?'👁️ إظهار':'🙈 إخفاء'}</button>
          <button class="btn-delete" onclick="deleteAnn('${a.id}')">🗑️ حذف</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // إغلاق عند النقر خارج البطاقات
  setTimeout(() => {
    document.removeEventListener('click', _closeAllAnnCards);
    document.addEventListener('click', _closeAllAnnCards);
  }, 10);
}


function toggleAnnCard(id, e) {
  if(e) e.stopPropagation();
  const detail = document.getElementById('ann-detail-'+id);
  const preview = document.getElementById('ann-preview-'+id);
  const arrow = document.getElementById('ann-arrow-'+id);
  if(!detail) return;
  const isOpen = detail.style.display !== 'none';
  // أغلق كل المفتوحة
  document.querySelectorAll('.ann-card').forEach(card => {
    const cid = card.id.replace('ann-card-','');
    const d = document.getElementById('ann-detail-'+cid);
    const p = document.getElementById('ann-preview-'+cid);
    const a = document.getElementById('ann-arrow-'+cid);
    if(d) d.style.display = 'none';
    if(p) p.style.display = '';
    if(a) { a.style.transform = ''; a.textContent = '▼'; }
  });
  if(!isOpen) {
    detail.style.display = '';
    if(preview) preview.style.display = 'none';
    if(arrow) { arrow.style.transform = 'rotate(180deg)'; arrow.textContent = '▲'; }
  }
}

function _closeAllAnnCards() {
  document.querySelectorAll('.ann-card').forEach(card => {
    const cid = card.id.replace('ann-card-','');
    const d = document.getElementById('ann-detail-'+cid);
    const p = document.getElementById('ann-preview-'+cid);
    const a = document.getElementById('ann-arrow-'+cid);
    if(d) d.style.display = 'none';
    if(p) p.style.display = '';
    if(a) { a.style.transform = ''; a.textContent = '▼'; }
  });
}

async function openAnnModal(id) {
  let a = {};
  if(id) { const anns = await getAnnouncements(); a = anns.find(x=>x.id===id)||{}; }
  // جلب نقاط التجمع والمدن والمشرفين
  const [assemblyPts, allUsers] = await Promise.all([getAssemblyPoints(), getSysUsers()]);
  window._supervisors = allUsers.filter(u=>u.role==='supervisor');
  window._assemblyPts = assemblyPts;
  setTimeout(updateActiveLabel, 50);
  const cities = [...new Set(ALL_DATA.map(r=>r['المدينة']).filter(Boolean))].sort();
  const cityOpts = '<option value="">🌐 جميع الحجاج</option>' + cities.map(ct=>`<option value="${ct}" ${a.city===ct?'selected':''}>${ct}</option>`).join('');
  const apOpts = '<option value="">— اختر نقطة تجمع —</option>' + assemblyPts.map(p=>`<option value="${p.id}">${p.city} — ${p.location_name}</option>`).join('');

  openModal(`
    <h3 class="modal-title">📢 ${id?'تعديل':'إضافة'} تعميم</h3>
    <div class="form-row"><label>نوع التعميم</label>
      <select id="m-a-type" onchange="toggleAssemblyRow()">
        ${Object.entries(annTypes).map(([v,t])=>'<option value="'+v+'" '+(a.type===v?'selected':'')+'>'+t.icon+' '+t.label+'</option>').join('')}
      </select>
    </div>
    <div class="form-row" id="m-a-assembly-row" style="${a.type==='assembly'?'':'display:none'}">
      <label>📍 نقطة التجمع</label>
      <select id="m-a-assembly" onchange="fillFromAssembly()">
        ${apOpts}
      </select>
    </div>
    <div class="form-row" id="m-a-city-row">
      <label>🏙️ المدينة <span id="m-a-city-req" style="color:#c00;display:none;font-size:11px;margin-right:4px">* مطلوب لنقطة التجمع</span></label>
      <select id="m-a-city" onchange="updateActiveLabel()" style="background:#fffbf0;color:#555">${cityOpts}</select>
      <div id="m-a-city-hint" style="font-size:12px;color:#888;margin-top:3px">اتركها فارغة لنشر التعميم لجميع الحجاج</div>
    </div>
    <div class="form-row"><label>عنوان التعميم</label><input type="text" id="m-a-title" value="${(a.title||'').replace(/"/g,'&quot;')}" placeholder="عنوان التعميم"></div>
    <div class="form-row"><label>نص التعميم</label><textarea id="m-a-body" rows="5" placeholder="اكتب نص التعميم هنا...">${a.body||''}</textarea></div>
    <div class="form-row"><label>الحالة</label>
      <select id="m-a-active">
        <option value="true" ${a.active!==false?'selected':''} id="m-a-active-true">✅ نشط — ينشر لجميع الحجاج</option>
        <option value="false" ${a.active===false?'selected':''}>🙈 مخفي</option>
      </select>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveAnn('${id||''}')">💾 حفظ ونشر</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
  window._assemblyPts = assemblyPts;
  setTimeout(updateActiveLabel, 50);
}


function updateActiveLabel() {
  const city = document.getElementById('m-a-city')?.value;
  const opt = document.getElementById('m-a-active-true');
  if(opt) opt.textContent = city ? '✅ نشط — ينشر لحجاج ' + city + ' فقط' : '✅ نشط — ينشر لجميع الحجاج';
}

async function toggleAssemblyRow() {
  const typeEl = document.getElementById('m-a-type');
  const type = typeEl.value;
  const isAssembly = type === 'assembly';
  const wasAssembly = window._prevAnnType === 'assembly';

  // تنبيه عند الدخول لنقطة التجمع إذا كان هناك محتوى مدخل
  if(isAssembly && !wasAssembly) {
    const title = document.getElementById('m-a-title')?.value.trim();
    const body = document.getElementById('m-a-body')?.value.trim();
    if(title || body) {
      const confirmed = await showConfirm(
        'سيتم حذف المدخلات التي أدخلتها (العنوان والنص). هل ترغب في تغيير الإعلان إلى نقطة تجمع؟',
        'تنبيه', 'نعم، غيّر', '#c8971a', '⚠️'
      );
      if(!confirmed) {
        typeEl.value = window._prevAnnType || 'info';
        return;
      }
      // مسح الحقول قبل التبديل
      const t = document.getElementById('m-a-title');
      const b = document.getElementById('m-a-body');
      if(t) t.value = '';
      if(b) b.value = '';
    }
  }
  const row = document.getElementById('m-a-assembly-row');
  if(row) row.style.display = isAssembly ? '' : 'none';
  const req = document.getElementById('m-a-city-req');
  const hint = document.getElementById('m-a-city-hint');
  if(req) req.style.display = isAssembly ? 'inline' : 'none';
  if(hint) hint.style.display = isAssembly ? 'none' : '';
  // تعطيل/تفعيل منسدل المدينة
  const cityEl = document.getElementById('m-a-city');
  if(cityEl) {
    cityEl.disabled = isAssembly;
    cityEl.style.opacity = isAssembly ? '0.7' : '1';
    cityEl.title = isAssembly ? 'يُحدَّد تلقائياً من نقطة التجمع' : '';
    if(isAssembly || wasAssembly) cityEl.value = '';
  }
  // تصفير الحقول عند الخروج من نقطة تجمع — مع تنبيه إذا كانت البيانات مُدخلة
  if(!isAssembly && wasAssembly) {
    const body = document.getElementById('m-a-body')?.value.trim();
    const assembly = document.getElementById('m-a-assembly')?.value;
    if(body || assembly) {
      const confirmed = await showConfirm(
        'سيتم حذف بيانات نقطة التجمع المُدخلة. هل ترغب في الخروج من نقطة التجمع؟',
        'تنبيه', 'نعم، اخرج', '#c8971a', '⚠️'
      );
      if(!confirmed) {
        typeEl.value = 'assembly';
        return;
      }
    }
    const title = document.getElementById('m-a-title');
    const bodyEl = document.getElementById('m-a-body');
    const assemblyEl = document.getElementById('m-a-assembly');
    if(title) title.value = '';
    if(bodyEl) bodyEl.value = '';
    if(assemblyEl) assemblyEl.value = '';
    window._lastAssemblyCity = '';
  }
  window._prevAnnType = type;
  updateActiveLabel();
}

function fillFromAssembly() {
  const apId = parseInt(document.getElementById('m-a-assembly').value);
  const p = (window._assemblyPts||[]).find(x=>x.id===apId);
  if(!p) return;
  // ملء المدينة
  const cityEl = document.getElementById('m-a-city');
  window._lastAssemblyCity = p.city||'';
  if(cityEl) { cityEl.value = p.city||''; updateActiveLabel(); }
  // ملء العنوان
  const titleEl = document.getElementById('m-a-title');
  if(titleEl) titleEl.value = 'نقطة تجمع — ' + (p.city||'');
  // ملء النص بالصياغة
  const supName = (window._supervisors||[]).find(s=>s.username===p.supervisor_username)?.name || p.supervisor_username || '';
  const supPhone = (window._supervisors||[]).find(s=>s.username===p.supervisor_username)?.phone || '';
  const waPhone = supPhone ? (supPhone.startsWith('0') ? '966'+supPhone.slice(1) : supPhone) : '';
  const companyName = _getCompanyName();
  const bodyEl = document.getElementById('m-a-body');
  if(bodyEl) bodyEl.value = [
    'ترحب بكم ' + companyName + ' ونفيدكم بأن نقطة التجمع في مدينة ' + (p.city||''),
    'بتاريخ ' + formatDateAr(p.assembly_date) + ' حسب الرؤيا',
    'من الساعة ' + formatTimeAr(p.time_from) + ' إلى ' + formatTimeAr(p.time_to),
    'في ' + (p.location_name||'') + '.',
    p.maps_link ? '\nإحداثيات الموقع على الرابط التالي:\n' + p.maps_link : '',
    '\nوللاستفسارات والطلبات يمكنكم إرسالها للمشرف العام بمدينة ' + (p.city||''),
    'الأستاذ / ' + supName + ' عبر الواتساب عبر الرابط التالي:',
    waPhone ? 'https://wa.me/' + waPhone : ''
  ].filter(Boolean).join('\n');
}

async function saveAnn(id) {
  const title = document.getElementById('m-a-title').value.trim();
  const body = document.getElementById('m-a-body').value.trim();
  if(!title) return showToast('أدخل عنوان التعميم', 'warning');
  if(!body) return showToast('أدخل نص التعميم', 'warning');
  const annType = document.getElementById('m-a-type').value;
  const annCity = document.getElementById('m-a-city').value;
  if(annType === 'assembly' && !annCity) return showToast('يجب اختيار المدينة لتعميمات نقاط التجمع', 'warning');
  // تحقق من حالة نقطة التجمع
  if(annType === 'assembly') {
    const apId = parseInt(document.getElementById('m-a-assembly')?.value);
    if(apId) {
      const ap = (window._assemblyPts||[]).find(x=>x.id===apId);
      if(ap && ap.status === 'مغلقة') {
        showToast('⛔ نقطة التجمع هذه مغلقة — لا يمكن نشر إعلان لها', 'error');
        return;
      }
    }
  }
  const obj = {
    title, body,
    type: document.getElementById('m-a-type').value,
    city: document.getElementById('m-a-city').value || (document.getElementById('m-a-assembly')?.value ? window._lastAssemblyCity : null) || null,
    active: document.getElementById('m-a-active').value !== 'false',
    ann_date: new Date().toLocaleDateString('ar-SA'),
    published_time: new Date().toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'}),
    published_by: (window._currentUser?.name || window._currentUser?.username || '—')
  };
  try {
    if(id) {
      await window.DB.Announcements.update(parseInt(id), obj);
    } else {
      await window.DB.Announcements.insert(obj);
    }
    closeModals(); renderAnnouncements();
  } catch(e) { showToast('خطأ في الحفظ: ' + e.message, 'error'); }
}

async function toggleAnn(id) {
  const anns = await getAnnouncements();
  const ann = anns.find(x=>x.id==id);
  if(ann) {
    await window.DB.Announcements.update(parseInt(id), {active: !ann.active});
    renderAnnouncements();
  }
}

async function deleteAnn(id) {
  if(!confirm('حذف هذا التعميم نهائياً؟')) return;
  await window.DB.Announcements.delete(parseInt(id));
  renderAnnouncements();
}