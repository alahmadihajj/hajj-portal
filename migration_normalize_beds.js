/**
 * migration_normalize_beds.js
 * ===========================
 *
 * سكربت ترحيل لمرة واحدة: يوحّد صيغ أرقام الأسرّة في DB.
 * يحوّل أي صيغة قديمة (مثل "1", "101-01", "101 - 1", "101_1") إلى الصيغة
 * القياسية "campNum-N" (بدون أصفار قائدة).
 *
 * الحقول المُتأثّرة:
 *   - pilgrims.mina_bed, pilgrims.mina_seat
 *   - pilgrims.arafat_bed, pilgrims.arafat_seat
 *
 * كيف تُشغّله:
 *   1) افتح admin.html وسجّل الدخول كسوبر أدمن.
 *   2) افتح Console (F12 → Console).
 *   3) انسخ محتوى هذا الملف كاملاً والصقه ثم اضغط Enter.
 *   4) سيُشغَّل Dry-run تلقائياً + ينزّل backup JSON + يعرض جدول التغييرات.
 *   5) للتنفيذ الفعلي بعد المراجعة:
 *        runBedMigration({ confirm: true })
 *      أو نطاق محدّد (أسلم: ابدأ بمنى):
 *        runBedMigration({ confirm: true, onlyLocation: 'منى' })
 *        runBedMigration({ confirm: true, onlyLocation: 'عرفات' })
 *
 * أمان:
 *   - Dry-run افتراضي، لا حفظ بدون { confirm: true }.
 *   - Backup تلقائي للبيانات الأصلية كـ JSON (حفظ قبل التعديل).
 *   - التحديث لكل سجل على حدة (فشل واحد لا يوقف البقية).
 *   - يحدّث فقط الحقول التي تغيّرت فعلاً (لا overwrite كامل).
 */

// أنماط console بألوان الهوية (ذهبي/بني + حالات دلالية)
window._BED_MIGRATION_STYLE = {
  header:  'background:linear-gradient(135deg,#3d2000,#c8971a);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold',
  section: 'background:#fff8e8;color:#3d2000;padding:6px 14px;border-left:4px solid #c8971a;font-weight:bold;font-size:13px',
  success: 'background:#2e7d32;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold',
  error:   'background:#c00;color:#fff;padding:8px 16px;border-radius:6px;font-weight:bold',
  info:    'color:#1a5fa8;font-weight:bold',
  warn:    'color:#c07000;font-weight:bold',
  muted:   'color:#888'
};

(async function bootstrapBedMigration(){
  const S = window._BED_MIGRATION_STYLE;
  if(!window.DB || !window._normalizeBedId){
    console.log('%c❌ خطأ: السياق غير صحيح', S.error);
    console.log('%cشغّل هذا السكربت من admin.html بعد تسجيل الدخول كسوبر أدمن.', S.muted);
    return;
  }
  console.log('%c🕋 شركة الأحمدي — أداة توحيد صيغة الأسرّة', S.header);
  console.log('%c────── المرحلة 1: جلب البيانات ──────', S.section);

  let all;
  try {
    all = await window.DB.Pilgrims.getAll();
  } catch(e){
    console.log('%c❌ فشل جلب البيانات: '+e.message, S.error);
    return;
  }
  console.log(`%c✓ تم جلب ${all.length} سجل`, S.info);

  console.log('%c────── المرحلة 2: نسخة احتياطية ──────', S.section);
  try {
    const backup = all.map(p => ({
      id: p.id,
      name: p['اسم الحاج'],
      mina_camp:  p.mina_camp,
      mina_bed:   p.mina_bed,
      mina_seat:  p.mina_seat,
      arafat_camp: p.arafat_camp,
      arafat_bed:  p.arafat_bed,
      arafat_seat: p.arafat_seat
    }));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    a.href = url; a.download = `beds_backup_${ts}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`%c💾 تم تنزيل: beds_backup_${ts}.json`, S.info);
  } catch(e){
    console.log('%c⚠️ تعذّر إنشاء backup: '+e.message, S.warn);
  }

  console.log('%c────── المرحلة 3: حساب التغييرات (Dry-run) ──────', S.section);
  const FIELDS = [
    { bed: 'mina_bed',   seat: 'mina_seat',   camp: 'mina_camp',   loc: 'منى' },
    { bed: 'arafat_bed', seat: 'arafat_seat', camp: 'arafat_camp', loc: 'عرفات' }
  ];
  const changes = [];
  all.forEach(p => {
    const diff = {};
    FIELDS.forEach(f => {
      const campVal = p[f.camp];
      if(!campVal) return;
      [f.bed, f.seat].forEach(col => {
        const before = p[col];
        if(!before) return;
        const after = window._normalizeBedId(before, campVal);
        if(after && String(before).trim() !== after){
          diff[col] = { before, after, camp: campVal, loc: f.loc };
        }
      });
    });
    if(Object.keys(diff).length) changes.push({ id: p.id, name: p['اسم الحاج']||'—', diff });
  });

  const flatRows = changes.flatMap(c => Object.entries(c.diff).map(([col,v]) => ({
    id: c.id, name: c.name, loc: v.loc, camp: v.camp, field: col, before: v.before, after: v.after
  })));
  console.log(`%c📊 ملخّص Dry-run:`, S.info);
  console.log(`   • الإجمالي:              ${all.length} حاج`);
  console.log(`   • بحاجة لتحديث:          ${changes.length} حاج`);
  console.log(`   • إجمالي الحقول المتأثّرة: ${flatRows.length}`);
  if(flatRows.length){
    console.table(flatRows);
  } else {
    console.log('%c✅ كل البيانات بالصيغة القياسية بالفعل — لا حاجة للترحيل.', S.success);
    return;
  }

  window._pendingBedMigration = changes;
  console.log('%c────── جاهز للتنفيذ ──────', S.section);
  console.log('%c▶️ للتنفيذ الفعلي استخدم أحد الأوامر التالية:', S.info);
  console.log('%c   runBedMigration({ confirm: true })                     %c// الكل', S.info, S.muted);
  console.log('%c   runBedMigration({ confirm: true, onlyLocation: "منى"  }) %c// منى فقط', S.info, S.muted);
  console.log('%c   runBedMigration({ confirm: true, onlyLocation: "عرفات" })%c// عرفات فقط', S.info, S.muted);
})();

window.runBedMigration = async function(opts){
  const S = window._BED_MIGRATION_STYLE;
  opts = opts || {};
  const { confirm, onlyLocation } = opts;
  if(confirm !== true){
    console.log('%c❗ استدعِ: runBedMigration({ confirm: true })', S.warn);
    return;
  }
  const changes = window._pendingBedMigration;
  if(!changes || !changes.length){
    console.log('%cلا شيء للتحديث.', S.muted);
    return;
  }

  // فلترة حسب الموقع إن طُلب
  let work = changes.map(c => {
    if(!onlyLocation) return c;
    const filtered = {};
    Object.entries(c.diff).forEach(([k,v]) => { if(v.loc === onlyLocation) filtered[k] = v; });
    return Object.keys(filtered).length ? { id: c.id, name: c.name, diff: filtered } : null;
  }).filter(Boolean);

  if(!work.length){
    console.log(`%cلا شيء للتحديث في "${onlyLocation}".`, S.muted);
    return;
  }

  console.log(`%c🚀 بدء الترحيل ${onlyLocation ? '('+onlyLocation+')' : '(الكل)'}`, S.header);
  console.log(`%c   العدد: ${work.length} حاج`, S.info);

  const total = work.length;
  let ok = 0, fail = 0, unchanged = 0;
  const failures = [];
  const startTime = Date.now();

  for(let i = 0; i < work.length; i++){
    const c = work[i];
    const updates = {};
    Object.entries(c.diff).forEach(([col, v]) => { updates[col] = v.after; });
    if(!Object.keys(updates).length){ unchanged++; continue; }
    try {
      await window.DB.Pilgrims.update(c.id, updates);
      ok++;
    } catch(e){
      fail++;
      failures.push({ id: c.id, name: c.name, error: e.message });
      console.log(`%c  ❌ [${i+1}/${total}] ${c.id} — ${c.name}: ${e.message}`, S.warn);
    }
    // عدّاد تقدّم كل 10 سجلات
    if((i+1) % 10 === 0 || i === work.length-1){
      const pct = Math.round(((i+1)/total)*100);
      console.log(`%c   ⏳ ${i+1}/${total} (${pct}%) — ✅ ${ok} | ❌ ${fail}`, S.muted);
    }
  }

  const duration = ((Date.now() - startTime)/1000).toFixed(1);
  console.log('%c────── ملخّص نهائي ──────', S.section);
  console.log(`   ✅ نجح:        ${ok}`);
  console.log(`   ❌ فشل:        ${fail}`);
  console.log(`   ⏭  بلا تغيير:  ${unchanged}`);
  console.log(`   ⏱  المدة:      ${duration} ثانية`);
  if(failures.length){
    console.log('%c❌ قائمة الفشل:', S.warn);
    console.table(failures);
  }
  if(fail === 0){
    console.log('%c🎉 تم الترحيل بنجاح — حدّث الصفحة (F5) لرؤية البيانات.', S.success);
  } else {
    console.log(`%c⚠️ اكتمل مع ${fail} خطأ. راجع القائمة أعلاه.`, S.warn);
  }
  return { ok, fail, unchanged, failures };
};
