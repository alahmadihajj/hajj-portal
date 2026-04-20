-- ═══════════════════════════════════════════════════════════════════════════
-- normalize_bed_seat_consistency.sql
-- Migration لمرة واحدة: توحيد bed + seat في جدول pilgrims
-- السياق (v17.0.1): Audit Log كشف سجلات قديمة فيها bed موجود و seat null (أو العكس).
-- هذا تصحيح نظامي — لا يُخزَّن في audit_log.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───── التدقيق قبل التنفيذ: كم صف متأثّر؟ ─────
-- (اختياري — شغّله أولاً لرؤية الحجم المتوقّع)

SELECT
  (SELECT COUNT(*) FROM pilgrims WHERE mina_bed   IS NOT NULL AND (mina_seat   IS NULL OR mina_seat   = '')) AS mina_bed_no_seat,
  (SELECT COUNT(*) FROM pilgrims WHERE mina_seat  IS NOT NULL AND (mina_bed    IS NULL OR mina_bed    = '')) AS mina_seat_no_bed,
  (SELECT COUNT(*) FROM pilgrims WHERE arafat_bed IS NOT NULL AND (arafat_seat IS NULL OR arafat_seat = '')) AS arafat_bed_no_seat,
  (SELECT COUNT(*) FROM pilgrims WHERE arafat_seat IS NOT NULL AND (arafat_bed IS NULL OR arafat_bed = '')) AS arafat_seat_no_bed;

-- ───── التصحيح (4 UPDATE statements) ─────

-- 1) منى: bed موجود و seat فارغ → انسخ bed إلى seat
UPDATE pilgrims
SET mina_seat = mina_bed
WHERE mina_bed IS NOT NULL
  AND (mina_seat IS NULL OR mina_seat = '');

-- 2) منى: seat موجود و bed فارغ → انسخ seat إلى bed
UPDATE pilgrims
SET mina_bed = mina_seat
WHERE mina_seat IS NOT NULL
  AND (mina_bed IS NULL OR mina_bed = '');

-- 3) عرفات: bed موجود و seat فارغ → انسخ bed إلى seat
UPDATE pilgrims
SET arafat_seat = arafat_bed
WHERE arafat_bed IS NOT NULL
  AND (arafat_seat IS NULL OR arafat_seat = '');

-- 4) عرفات: seat موجود و bed فارغ → انسخ seat إلى bed
UPDATE pilgrims
SET arafat_bed = arafat_seat
WHERE arafat_seat IS NOT NULL
  AND (arafat_bed IS NULL OR arafat_bed = '');

-- ───── التحقّق بعد التنفيذ ─────
-- يجب أن يعود كلاهما 0 — أي عدم وجود عدم اتساق بعد الآن.

SELECT COUNT(*) AS mina_mismatch
FROM pilgrims
WHERE (mina_bed IS NULL) <> (mina_seat IS NULL)
   OR (mina_bed = '')    <> (mina_seat = '');

SELECT COUNT(*) AS arafat_mismatch
FROM pilgrims
WHERE (arafat_bed IS NULL) <> (arafat_seat IS NULL)
   OR (arafat_bed = '')    <> (arafat_seat = '');

-- ═══════════════════════════════════════════════════════════════════════════
-- ملاحظات:
--  • يُستحسن عمل snapshot/backup للجدول قبل التنفيذ (Supabase > Database > Backups).
--  • الاستعلامات idempotent — إعادة تشغيلها آمنة (WHERE تضمن عدم التكرار).
--  • لا تُستخدم هذه الـ UPDATEs ضمن audit_log (مُطبَّقة قبل تفعيل Audit أو كصيانة نظام).
--  • إذا bed و seat موجودان لكن قيمتاهما مختلفتان — لا يُصلحها هذا السكربت (حالة نادرة،
--    تحتاج مراجعة يدوية لأن الأصح غامض).
-- ═══════════════════════════════════════════════════════════════════════════
