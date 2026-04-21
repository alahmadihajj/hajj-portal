// ═══════════════════════════════════════════════════════════════════════
// UI Helpers Module — v11.5 Phase 1/5
// بوابة الحاج — شركة الأحمدي
// ═══════════════════════════════════════════════════════════════════════
// المحتوى:
//   - showToast(msg, type, duration, options)        — نظام التوست الموحّد
//   - showConfirm(msg, title, okText, okColor, icon) — نافذة تأكيد بسيطة
//   - showActionModal(opts)                          — Modal قرار احترافي (v15.4+)
//
// Dependencies (globals): document, window
// No DB/audit deps — pure UI helpers.
// ═══════════════════════════════════════════════════════════════════════

// ===== Toast Notifications =====
// نظام التوست: أيقونة موحّدة + aria-live + مدة ديناميكية + stack بحد أقصى 3
function showToast(msg, type='success', duration, options) {
  // Guard: لا تعرض toasts أثناء شاشة الدخول (تمنع ظهور رسائل من جلسة سابقة)
  const loginScreen = document.getElementById('login-screen');
  if(loginScreen && loginScreen.style.display === 'flex') return;
  let container = document.getElementById('toast-container');
  if(!container){
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  // حد أقصى 3 توستات متراكمة — يُزال الأقدم (FIFO)
  const MAX_TOASTS = 3;
  while(container.children.length >= MAX_TOASTS){
    const oldest = container.firstElementChild;
    if(!oldest) break;
    oldest.remove();
  }
  const hasAction = !!(options && options.action && typeof options.action.handler === 'function');
  // المدة الديناميكية: 3s ثابتة + 40ms لكل حرف، محصورة بين 3s و 10s
  // عند وجود action: الافتراضي 10s (كافٍ للتفاعل) إذا لم يُمرَّر duration صراحة
  const safeMsg = String(msg||'');
  const autoDuration = hasAction
    ? 10000
    : Math.min(10000, Math.max(3000, 3000 + safeMsg.length * 40));
  const ms = (typeof duration === 'number' && duration > 0) ? duration : autoDuration;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
  const actionHtml = hasAction
    ? `<button class="toast-action" type="button" aria-label="${esc(options.action.label||'تراجع')}">${esc(options.action.label||'تراجع')}</button>`
    : '';
  toast.innerHTML = `<span class="toast-ic" aria-hidden="true">${icons[type]||'✅'}</span><span class="toast-msg">${safeMsg}</span>${actionHtml}`;
  container.appendChild(toast);
  if(hasAction){
    const btn = toast.querySelector('.toast-action');
    btn.addEventListener('click', () => {
      try { options.action.handler(); } catch(e){ console.error(e); }
      toast.style.animation = 'toastOut 0.3s cubic-bezier(.2,.8,.2,1) forwards';
      setTimeout(() => toast.remove(), 300);
    });
  }
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s cubic-bezier(.2,.8,.2,1) forwards';
    setTimeout(() => toast.remove(), 300);
  }, ms);
}


// ===== نافذة التأكيد =====
function showConfirm(msg, title='تأكيد', okText='نعم', okColor='#c00', icon='⚠️') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="font-size:40px;margin-bottom:12px">${icon}</div>
        <div style="font-size:17px;font-weight:700;color:#3d2000;margin-bottom:10px">${title}</div>
        <div style="font-size:14px;color:#666;margin-bottom:24px;line-height:1.6">${msg}</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="sc-ok" style="padding:11px 24px;background:${okColor};color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">${okText}</button>
          <button id="sc-cancel" style="padding:11px 24px;background:#f0f0f0;color:#555;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('sc-ok').onclick = () => { overlay.remove(); resolve(true); };
    document.getElementById('sc-cancel').onclick = () => { overlay.remove(); resolve(false); };
  });
}

/**
 * Modal تنبيه احترافي موحّد — يدعم عدة أزرار + قائمة تفصيلية + أنواع دلالية.
 * يُستخدم في v15.5+ لفحوصات الجنس/السعة/تفكيك الحجز.
 *
 * @param {Object} opts
 * @param {string} opts.title               — العنوان الرئيسي
 * @param {string} [opts.description]       — وصف إضافي اختياري
 * @param {'warning'|'error'|'success'|'info'} [opts.type='warning']
 * @param {string} [opts.icon]              — emoji مخصّص (يغلب الافتراضي)
 * @param {Array<{label,value,icon}|string>} [opts.items]  — قائمة تفصيلية (bullet list)
 * @param {Array<{label, value, color, emoji, variant}>} opts.actions
 *        - label: نص الزر
 *        - value: القيمة المُرجَعة (null = إلغاء)
 *        - color: 'brand'|'success'|'danger'|'warning'|'neutral' (default: neutral)
 *        - emoji: أيقونة اختيارية في بداية الزر
 *        - variant: 'primary'|'secondary'|'cancel' (تأثير بصري)
 * @returns {Promise<*>} قيمة الزر المختار، أو null للإلغاء (ESC/overlay/X)
 */
function showActionModal(opts){
  return new Promise(resolve => {
    const o = opts || {};
    const type = o.type || 'warning';
    const defaultIcons = { warning:'⚠️', error:'❌', success:'✅', info:'ℹ️' };
    const icon = o.icon || defaultIcons[type] || '⚠️';
    const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const itemsHtml = Array.isArray(o.items) && o.items.length
      ? `<ul class="am-items">${o.items.map(it => {
          if(typeof it === 'string') return `<li class="am-item"><span class="am-item-val">${esc(it)}</span></li>`;
          const lbl = it.label ? `<span class="am-item-lbl">${esc(it.label)}</span>` : '';
          const val = it.value ? `<span class="am-item-val">${esc(it.value)}</span>` : '';
          const ic  = it.icon ? `<span class="am-item-ic" aria-hidden="true">${esc(it.icon)}</span>` : '';
          return `<li class="am-item">${ic}${lbl}${val}</li>`;
        }).join('')}</ul>`
      : '';

    const actions = (o.actions && o.actions.length) ? o.actions : [{label:'إغلاق', value:null, variant:'cancel'}];
    const actionsHtml = actions.map((a, i) => {
      const variant = a.variant || 'neutral';
      const color   = a.color   || '';
      const em = a.emoji ? `<span class="am-btn-ic" aria-hidden="true">${esc(a.emoji)}</span>` : '';
      return `<button class="am-btn am-btn-${variant}${color?' am-btn-color-'+color:''}" data-idx="${i}" type="button">${em}<span>${esc(a.label)}</span></button>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'am-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
    overlay.innerHTML = `
      <div class="am-box am-type-${type}" tabindex="-1">
        <button class="am-close" aria-label="إغلاق" type="button">✕</button>
        <div class="am-icon am-icon-${type}">${esc(icon)}</div>
        <h3 class="am-title">${esc(o.title||'')}</h3>
        ${o.description ? `<p class="am-desc">${esc(o.description)}</p>` : ''}
        ${itemsHtml}
        <div class="am-actions">${actionsHtml}</div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (val) => {
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('am-leaving');
      setTimeout(() => { overlay.remove(); resolve(val); }, 180);
    };
    const onKey = (e) => {
      if(e.key === 'Escape'){ e.preventDefault(); close(null); }
      else if(e.key === 'Enter'){
        const primary = overlay.querySelector('.am-btn-primary');
        if(primary){ e.preventDefault(); primary.click(); }
      }
    };
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(null); });
    overlay.querySelector('.am-close').addEventListener('click', () => close(null));
    overlay.querySelectorAll('.am-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const a = actions[idx];
        close(a ? a.value : null);
      });
    });

    // Focus — الزر الأول primary، أو الصندوق نفسه
    setTimeout(() => {
      const primary = overlay.querySelector('.am-btn-primary') || overlay.querySelector('.am-box');
      if(primary) primary.focus();
    }, 30);
  });
}
