-- ============================================================
-- نظام الاستبيانات — v13.2: دعم الوقت في جدولة الاستبيان
-- تحويل start_date و end_date من date إلى timestamptz
-- شغّل هذا الملف مرة واحدة على قاعدة بيانات موجودة
-- ============================================================

ALTER TABLE surveys
  ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz;

ALTER TABLE surveys
  ALTER COLUMN end_date TYPE timestamptz USING end_date::timestamptz;
