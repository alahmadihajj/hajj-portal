// ═══════════════════════════════════════════════════════════════════════
// Users/SysUsers/Staff/Requests Module — v11.5 Phase 5c/7
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - Users: renderUsers, openUserModal, toggleGroupField, saveUser, deleteUser
//   - SysUsers (Supervisors): getSysUsers, saveSysUsersData, renderSysUsers,
//                             openSupervisorModal, saveSupervisor, deleteSysUser
//   - Requests: getRequests, saveRequestsData, renderRequests, openRequestModal, saveRequest, deleteRequest
//   - Staff: getStaff, saveStaffData, renderStaff, openStaffModal, saveStaffMember, deleteStaff
//
// Dependencies (globals):
//   - ui-helpers.js:    showToast, showConfirm
//   - audit.js:         _recordAudit, _buildUserLabel, _buildFieldChanges
//   - admin.html:       openModal, closeModals, ALL_DATA, _genderOf
//   - supabase.js:      window.DB.SysUsers/Requests/Staff.*
// ═══════════════════════════════════════════════════════════════════════


// ─────────── Users Management (was admin.html L4790-4925) ───────────
// ===== إدارة المستخدمين =====
async function renderUsers() {
  const users = await getSysUsers();
  const el = document.getElementById('users-list');
  if(!users.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:30px">لا يوجد مستخدمون بعد.</p>'; return; }
  const roleLabel = { superadmin:'👑 سوبر أدمن', admin:'👨‍💼 مشرف', supervisor:'🎯 مشرف مجموعة', viewer:'👁️ مشاهد' };
  const roleColor = { superadmin:'#7a4500', admin:'#1a5fa8', supervisor:'#1a7a1a', viewer:'#666' };
  el.innerHTML = users.map(u => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">
          ${u.name||u.username}
          <span style="margin-right:8px;font-size:12px;font-weight:600;color:${roleColor[u.role]||'#666'}">${roleLabel[u.role]||u.role}</span>
          <span style="font-size:11px;color:${u.active===false||u.active==='false'?'#c00':'#1a7a1a'}">${u.active===false||u.active==='false'?'🔴 موقوف':'✅ نشط'}</span>
        </div>
        <div class="item-card-sub">🔑 ${u.username}${u.group_num?` &nbsp;|&nbsp; 👥 مجموعة: ${u.group_num}`:''}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-edit" onclick="openUserModal('${u.username}')">✏️ تعديل</button>
        <button class="btn-delete" onclick="deleteUser('${u.username}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function openUserModal(username) {
  let u = {};
  if(username) { const users = await getSysUsers(); u = users.find(x=>x.username===username)||{}; }
  const _mt = username ? 'تعديل' : 'إضافة';
  const _ro = username ? 'readonly' : '';
  const _pw = username ? '(اتركها فارغة للإبقاء على الحالية)' : '';
  const groups = await getGroups();
  const groupOptions = groups.map(g=>`<option value="${g.num}" ${u.group_num===g.num?'selected':''}>${g.num} — ${g.name||g.supervisor||''}</option>`).join('');
  openModal(`
    <h3 class="modal-title">👤 ${_mt} مستخدم</h3>
    <div class="form-row"><label>اسم المستخدم</label><input type="text" id="mu-username" value="${u.username||''}" placeholder="username" ${_ro}></div>
    <div class="form-row"><label>الاسم الكامل</label><input type="text" id="mu-name" value="${u.name||''}" placeholder="الاسم الكامل"></div>
    <div class="form-row"><label>📱 رقم الجوال</label><input type="text" id="mu-phone" value="${u.phone||''}" placeholder="0500000000"></div>
    <div class="form-row"><label>كلمة المرور ${_pw}</label><input type="password" id="mu-password" placeholder="••••••••"></div>
    <div class="form-row"><label>الصلاحية</label>
      <select id="mu-role" onchange="toggleGroupField()">
        <option value="admin" ${u.role==='admin'?'selected':''}>👨‍💼 مشرف</option>
        <option value="supervisor" ${u.role==='supervisor'?'selected':''}>🎯 مشرف مجموعة</option>
        <option value="viewer" ${u.role==='viewer'?'selected':''}>👁️ مشاهد</option>
      </select>
    </div>
    <div class="form-row" id="mu-group-row" style="${u.role==='supervisor'?'':'display:none'}">
      <label>المجموعة</label>
      <select id="mu-group">
        <option value="">اختر المجموعة</option>
        ${groupOptions}
      </select>
    </div>
    <div class="form-row"><label>الحالة</label>
      <select id="mu-active">
        <option value="true" ${u.active!==false&&u.active!=='false'?'selected':''}>✅ نشط</option>
        <option value="false" ${u.active===false||u.active==='false'?'selected':''}>🔴 موقوف</option>
      </select>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveUser('${username||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

function toggleGroupField() {
  const role = document.getElementById('mu-role').value;
  const row = document.getElementById('mu-group-row');
  if(row) row.style.display = role==='supervisor' ? '' : 'none';
}

async function saveUser(existingUsername) {
  const username = document.getElementById('mu-username').value.trim();
  const name = document.getElementById('mu-name').value.trim();
  const password = document.getElementById('mu-password').value.trim();
  const role = document.getElementById('mu-role').value;
  const group_num = document.getElementById('mu-group')?.value.trim()||'';
  const active = document.getElementById('mu-active').value === 'true';
  if(!username) return showToast('أدخل اسم المستخدم', 'warning');
  try {
    const users = await getSysUsers();
    if(existingUsername) {
      const u = users.find(x=>x.username===existingUsername);
      const phone = document.getElementById('mu-phone')?.value.trim()||'';
      if(u){
        const updates = { name, phone, role, group_num, active, ...(password?{password}:{}) };
        await window.DB.SysUsers.update(u.id, updates);
        // v17.3: audit
        const after = Object.assign({}, u, updates);
        _recordAudit({
          action_type:  'update',
          entity_type:  'sysuser',
          entity_id:    String(u.username),
          entity_label: _buildUserLabel(after),
          field_changes: _buildFieldChanges(u, after),
          metadata: { source: 'admin_users', ui_path: 'users_view' }
        });
      }
    } else {
      if(!password) return showToast('أدخل كلمة المرور', 'warning');
      const phone2 = document.getElementById('mu-phone')?.value.trim()||'';
      const newUser = { username, name, phone: phone2, password, role, group_num, active };
      await window.DB.SysUsers.insert(newUser);
      // v17.3: audit
      _recordAudit({
        action_type:  'create',
        entity_type:  'sysuser',
        entity_id:    String(username),
        entity_label: _buildUserLabel(newUser),
        field_changes: { _created: { before: null, after: newUser } },
        metadata: { source: 'admin_users', ui_path: 'users_view' }
      });
    }
    closeModals(); renderUsers(); showToast('تم الحفظ بنجاح', 'success');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
}

async function deleteUser(username) {
  const ok = await showConfirm('حذف هذا المستخدم؟', 'تأكيد الحذف', 'حذف', '#c00', '🗑️');
  if(!ok) return;
  const users = await getSysUsers();
  const u = users.find(x=>x.username===username);
  if(u) {
    await window.DB.SysUsers.delete(u.id);
    renderUsers();
    showToast('تم الحذف', 'success');
    // v17.3: audit
    _recordAudit({
      action_type:  'delete',
      entity_type:  'sysuser',
      entity_id:    String(username),
      entity_label: _buildUserLabel(u),
      field_changes: { _deleted: { before: u, after: null } },
      metadata: { source: 'admin_users', ui_path: 'users_view' }
    });
  }
}

// ─────────── SysUsers / Supervisors (was admin.html L4281-4427) ───────────
// ===== مستخدمو النظام =====
async function getSysUsers() { try { return window.DB ? await window.DB.SysUsers.getAll() : []; } catch(e) { return []; } }
async function saveSysUsersData(d) { }

async function renderSysUsers() {
  const users = await getSysUsers();
  const el = document.getElementById('sysusers-list');
  const supervisors = users.filter(u => u.role === 'supervisor');
  if(!supervisors.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:40px">لا يوجد مشرفون بعد.</p>'; return; }
  window._assemblySups = {};
  supervisors.forEach(s => { window._assemblySups[s.username] = s.name||s.username; });
  el.innerHTML = `
    <div style="overflow-x:auto;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);border:1px solid #e8ddd0">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead>
          <tr style="background:linear-gradient(135deg,#3d2000,#7a4500);color:#fff">
            <th style="padding:12px 14px;text-align:center">#</th>
            <th style="padding:12px 14px;text-align:right">👤 الاسم</th>
            <th style="padding:12px 14px;text-align:center">🪪 رقم الهوية</th>
            <th style="padding:12px 14px;text-align:center">📱 الجوال</th>
            <th style="padding:12px 14px;text-align:center">📍 المدينة</th>
            <th style="padding:12px 14px;text-align:center">🚌 الحافلة</th>
            <th style="padding:12px 14px;text-align:center">الحالة</th>
            <th style="padding:12px 14px;text-align:center">إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${supervisors.map((u,i) => `
          <tr style="background:${i%2===0?'#fff':'#fffbf5'};border-bottom:1px solid #f0e8d8" onmouseover="this.style.background='#fdf5e8'" onmouseout="this.style.background='${i%2===0?'#fff':'#fffbf5'}'">
            <td style="padding:11px 14px;text-align:center;color:#999">${i+1}</td>
            <td style="padding:11px 14px">
              <div style="font-weight:700;color:#3d2000">${u.name||u.username}</div>
              <div style="font-size:11px;color:#999;margin-top:2px">🔑 ${u.username}</div>
            </td>
            <td style="padding:11px 14px;text-align:center;direction:ltr;font-size:12px;color:${u.id_num?'#555':'#ccc'}">${u.id_num||'—'}</td>
            <td style="padding:11px 14px;text-align:center;direction:ltr">${u.phone?`<a href="tel:${u.phone}" style="color:#1a5fa8;text-decoration:none;font-weight:600">${u.phone}</a>`:'<span style="color:#ccc">—</span>'}</td>
            <td style="padding:11px 14px;text-align:center">${u.city||'<span style="color:#ccc">—</span>'}</td>
            <td style="padding:11px 14px;text-align:center">${u.group_num?`<span style="background:#3d2000;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">🚌 ${u.group_num}</span>`:'<span style="color:#ccc">—</span>'}</td>
            <td style="padding:11px 14px;text-align:center">
              <span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${u.active===false||u.active==='false'?'#fde8e8':'#e8f8e8'};color:${u.active===false||u.active==='false'?'#c00':'#1a7a1a'}">
                ${u.active===false||u.active==='false'?'🔴 موقوف':'✅ نشط'}
              </span>
            </td>
            <td style="padding:11px 14px;text-align:center">
              <div style="display:flex;gap:6px;justify-content:center">
                <button onclick="openSupervisorModal('${u.username}')" style="padding:6px 12px;background:#f0e8d0;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:#7a4500">✏️ تعديل</button>
                <button onclick="deleteSysUser('${u.username}')" style="padding:6px 12px;background:#fde8e8;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:#c00">🗑️ حذف</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function openSupervisorModal(username) {
  let u = {};
  if(username) { const users = await getSysUsers(); u = users.find(x=>x.username===username)||{}; }
  const groups = await getGroups();
  const groupOptions = groups.map(g=>`<option value="${g.num}" ${String(u.group_num)===String(g.num)?'selected':''}>${g.num} — ${g.name||''}</option>`).join('');
  openModal(`
    <h3 class="modal-title">🎯 ${username?'تعديل':'إضافة'} مشرف حجاج</h3>
    <div class="form-row"><label>اسم المستخدم (للدخول)</label><input type="text" id="sv-username" value="${u.username||''}" placeholder="رقم الجوال أو الهوية" ${username?'readonly':''}></div>
    <div class="form-row"><label>الاسم الكامل</label><input type="text" id="sv-name" value="${u.name||''}" placeholder="اسم المشرف"></div>
    <div class="form-row"><label>🪪 رقم الهوية / الإقامة</label><input type="text" id="sv-id-num" value="${u.id_num||''}" placeholder="يظهر في إقرار الاستلام" style="direction:ltr"></div>
    <div class="form-row"><label>📱 رقم الجوال</label><input type="text" id="sv-phone" value="${u.phone||''}" placeholder="0500000000"></div>
    <div class="form-row"><label>📍 المدينة</label><input type="text" id="sv-city" value="${u.city||''}" placeholder="جدة، الرياض..."></div>
    <div class="form-row"><label>كلمة المرور ${username?'(اتركها فارغة للإبقاء)':''}</label><input type="password" id="sv-password" placeholder="••••••••"></div>
    <div class="form-row"><label>🚌 رقم الحافلة</label>
      <select id="sv-group">
        <option value="">اختر الحافلة</option>
        ${groupOptions}
      </select>
    </div>
    <div class="form-row"><label>الحالة</label>
      <select id="sv-active">
        <option value="true" ${u.active!==false&&u.active!=='false'?'selected':''}>✅ نشط</option>
        <option value="false" ${u.active===false||u.active==='false'?'selected':''}>🔴 موقوف</option>
      </select>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveSupervisor('${username||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

async function saveSupervisor(existingUsername) {
  const username = document.getElementById('sv-username').value.trim();
  const name = document.getElementById('sv-name').value.trim();
  const id_num = document.getElementById('sv-id-num').value.trim(); // v22.0
  const phone = document.getElementById('sv-phone').value.trim();
  const city = document.getElementById('sv-city').value.trim();
  const password = document.getElementById('sv-password').value.trim();
  const group_num = document.getElementById('sv-group').value.trim();
  const active = document.getElementById('sv-active').value === 'true';
  if(!username) return showToast('أدخل اسم المستخدم', 'warning');
  if(!group_num) return showToast('اختر رقم الحافلة', 'warning');
  try {
    // v17.3: snapshot + audit
    const users = await getSysUsers();
    if(existingUsername) {
      const u = users.find(x=>x.username===existingUsername);
      if(u){
        const updates = { name, id_num, phone, city, group_num, active, role:'supervisor', ...(password?{password}:{}) };
        await window.DB.SysUsers.update(u.id, updates);
        const after = Object.assign({}, u, updates);
        _recordAudit({
          action_type:  'update',
          entity_type:  'sysuser',
          entity_id:    String(u.username),
          entity_label: _buildUserLabel(after),
          field_changes: _buildFieldChanges(u, after),
          metadata: { source: 'admin_users', ui_path: 'supervisors_view' }
        });
      }
    } else {
      if(!password) return showToast('أدخل كلمة المرور', 'warning');
      const newUser = { username, name, id_num, phone, city, password, role:'supervisor', group_num, active };
      await window.DB.SysUsers.insert(newUser);
      _recordAudit({
        action_type:  'create',
        entity_type:  'sysuser',
        entity_id:    String(username),
        entity_label: _buildUserLabel(newUser),
        field_changes: { _created: { before: null, after: newUser } },
        metadata: { source: 'admin_users', ui_path: 'supervisors_view' }
      });
    }
    closeModals(); renderSysUsers(); showToast('تم الحفظ بنجاح', 'success');
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
}

async function deleteSysUser(username) {
  const confirmed = await showConfirm('هل تريد حذف هذا المشرف؟', 'حذف مشرف', 'نعم، احذف', '#c00', '🗑️');
  if(!confirmed) return;
  const users = await getSysUsers();
  const u = users.find(x=>x.username===username);
  if(u){
    await window.DB.SysUsers.delete(u.id);
    // v17.3: audit
    _recordAudit({
      action_type:  'delete',
      entity_type:  'sysuser',
      entity_id:    String(username),
      entity_label: _buildUserLabel(u),
      field_changes: { _deleted: { before: u, after: null } },
      metadata: { source: 'admin_users', ui_path: 'supervisors_view' }
    });
  }
  renderSysUsers();
}

// ─────────── Requests (was admin.html L4429-4497) ───────────
// ===== طلبات الحجاج =====
async function getRequests() { try { return window.DB ? await window.DB.Requests.getAll() : []; } catch(e) { return []; } }
async function saveRequestsData(d) { }

const statusLabelsMap = { new:'🔵 جديد', progress:'🟡 قيد المعالجة', done:'✅ منجز', closed:'⛔ مغلق' };
const statusBadgeMap = { new:'badge-status-new', progress:'badge-status-progress', done:'badge-status-done', closed:'badge-status-closed' };

async function renderRequests() {
  const reqs = await getRequests();
  const el = document.getElementById('requests-list');
  if(!reqs.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:30px">لا توجد طلبات بعد.</p>'; return; }
  el.innerHTML = reqs.map(r => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${r.pilgrim||'—'} — ${r.type||''}
          <span class="badge-role ${statusBadgeMap[r.status]||'badge-viewer'}" style="margin-right:8px">${statusLabelsMap[r.status]||r.status}</span>
        </div>
        <div class="item-card-sub">🪪 ${r.idNum||'—'}</div>
        ${r.details ? `<div class="item-card-sub" style="margin-top:4px">📝 ${r.details}</div>` : ''}
        <div class="item-card-sub" style="color:#bbb;margin-top:4px;font-size:11px">${r.date||''}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-edit" onclick="openRequestModal('${r.id}')">✏️ تعديل</button>
        <button class="btn-delete" onclick="deleteRequest('${r.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function openRequestModal(id) {
  let r = {};
  if(id) { const reqs = await getRequests(); r = reqs.find(x=>x.id===id)||{}; }
  openModal(`
    <h3 class="modal-title">📝 ${id?'تعديل':'إضافة'} طلب</h3>
    <div class="form-row"><label>اسم الحاج</label><input type="text" id="m-r-pilgrim" value="${r.pilgrim||''}" placeholder="اسم الحاج"></div>
    <div class="form-row"><label>رقم الهوية</label><input type="text" id="m-r-id" value="${r.idNum||''}" placeholder="رقم الهوية" inputmode="numeric"></div>
    <div class="form-row"><label>نوع الطلب</label>
      <select id="m-r-type">
        ${['استفسار','شكوى','طلب خدمة','طلب تعديل بيانات','أخرى'].map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label>تفاصيل الطلب</label><textarea id="m-r-details" rows="3">${r.details||''}</textarea></div>
    <div class="form-row"><label>الحالة</label>
      <select id="m-r-status">
        ${Object.entries(statusLabelsMap).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveRequest('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

async function saveRequest(id) {
  const pilgrim = document.getElementById('m-r-pilgrim').value.trim();
  if(!pilgrim) return showToast('أدخل اسم الحاج', 'warning');
  const reqs = await getRequests();
  const obj = { id: id||Date.now().toString(), pilgrim, idNum: document.getElementById('m-r-id').value.trim(), type: document.getElementById('m-r-type').value, details: document.getElementById('m-r-details').value.trim(), status: document.getElementById('m-r-status').value, date: id ? (reqs.find(x=>x.id===id)||{}).date||new Date().toLocaleDateString('ar') : new Date().toLocaleDateString('ar') };
  try {
    if(id) { await window.DB.Requests.update(parseInt(id), obj); }
    else { await window.DB.Requests.insert(obj); }
    closeModals(); renderRequests();
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
}

async function deleteRequest(id) {
  const _ck4 = await showConfirm('هل تريد حذف هذا الطلب؟','حذف طلب','نعم، احذف','#c00','🗑️'); if(!_ck4) return;
  await window.DB.Requests.delete(parseInt(id)); renderRequests();
}


// ─────────── Staff (was admin.html L4498-4555) ───────────
// ===== الموظفون =====
async function getStaff() { try { return window.DB ? await window.DB.Staff.getAll() : []; } catch(e) { return []; } }
async function saveStaffData(d) { }

async function renderStaff() {
  const staff = await getStaff();
  const el = document.getElementById('staff-list');
  if(!staff.length){ el.innerHTML = '<p style="color:#888;text-align:center;padding:30px">لا يوجد موظفون بعد. أضف موظفاً جديداً.</p>'; return; }
  el.innerHTML = staff.map(s => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">👨‍💼 ${s.name} <span style="font-size:13px;color:#888;font-weight:500">— ${s.title||''}</span></div>
        <div class="item-card-sub">🏢 ${s.department||'—'} &nbsp;|&nbsp; 📞 ${s.phone||'—'}</div>
        ${s.tasks ? `<div class="item-card-sub" style="margin-top:4px">📋 <strong>المهام:</strong> ${s.tasks}</div>` : ''}
        ${s.pilgrims_ids ? `<div class="item-card-sub" style="margin-top:4px">🕋 <strong>الحجاج المرتبطون:</strong> ${(s.pilgrims_ids||'').split(',').length} حاج</div>` : ''}
      </div>
      <div class="item-card-actions">
        <button class="btn-edit" onclick="openStaffModal('${s.id}')">✏️ تعديل</button>
        <button class="btn-delete" onclick="deleteStaff('${s.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function openStaffModal(id) {
  let s = {};
  if(id) { const staff = await getStaff(); s = staff.find(x=>x.id===id)||{}; }
  openModal(`
    <h3 class="modal-title">👨‍💼 ${id?'تعديل':'إضافة'} موظف</h3>
    <div class="form-row"><label>الاسم الكامل</label><input type="text" id="m-s-name" value="${s.name||''}" placeholder="اسم الموظف"></div>
    <div class="form-row"><label>المسمى الوظيفي</label><input type="text" id="m-s-title" value="${s.title||''}" placeholder="مشرف / مرشد / سائق..."></div>
    <div class="form-row"><label>القسم</label><input type="text" id="m-s-dept" value="${s.department||''}" placeholder="التسكين / النقل / الإرشاد..."></div>
    <div class="form-row"><label>رقم الجوال</label><input type="text" id="m-s-phone" value="${s.phone||''}" placeholder="0500000000" inputmode="tel"></div>
    <div class="form-row"><label>المهام والمسؤوليات</label><textarea id="m-s-tasks" rows="2">${s.tasks||''}</textarea></div>
    <div class="form-row"><label>أرقام هوية الحجاج المرتبطين (مفصولة بفاصلة)</label><textarea id="m-s-pilgrims" rows="2" placeholder="2530190376, 2234356935...">${s.pilgrims_ids||''}</textarea></div>
    <div class="modal-btns">
      <button class="btn-save" onclick="saveStaffMember('${id||''}')">💾 حفظ</button>
      <button class="btn-cancel" onclick="closeModals()">إلغاء</button>
    </div>`);
}

async function saveStaffMember(id) {
  const name = document.getElementById('m-s-name').value.trim();
  if(!name) return showToast('أدخل اسم الموظف', 'warning');
  const staff = await getStaff();
  const obj = { name, title: document.getElementById('m-s-title').value.trim(), department: document.getElementById('m-s-dept').value.trim(), phone: document.getElementById('m-s-phone').value.trim(), tasks: document.getElementById('m-s-tasks').value.trim(), pilgrims_ids: document.getElementById('m-s-pilgrims').value.trim() };
  try {
    if(id) { await window.DB.Staff.update(parseInt(id), obj); }
    else { await window.DB.Staff.insert(obj); }
    closeModals(); renderStaff();
  } catch(e) { showToast('خطأ: ' + e.message, 'error'); }
}

async function deleteStaff(id) {
  const _ck5 = await showConfirm('هل تريد حذف هذا الموظف؟','حذف موظف','نعم، احذف','#c00','🗑️'); if(!_ck5) return;
  await window.DB.Staff.delete(parseInt(id)); renderStaff();
}

