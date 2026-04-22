-- ═══════════════════════════════════════════════════════
-- v23.0-pre — توحيد صياغات نسك للاتساق البصري
-- تاريخ: 2026-04-22
-- الهدف: تحويل الصياغات الطويلة إلى قصيرة عصرية
-- يجب تشغيله مرة واحدة في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- الخطوة 1: إسقاط constraint القديم
ALTER TABLE pilgrims DROP CONSTRAINT IF EXISTS chk_nusuk_card_status;

-- الخطوة 2: تحديث القيم الموجودة في البيانات
UPDATE pilgrims SET nusuk_card_status = 'لدى الإدارة'
  WHERE nusuk_card_status = 'موجودة لدى الإدارة';

UPDATE pilgrims SET nusuk_card_status = 'لدى المشرف'
  WHERE nusuk_card_status = 'موجودة لدى المشرف';

-- الخطوة 3: إضافة constraint الجديد بالقيم الموحّدة
ALTER TABLE pilgrims ADD CONSTRAINT chk_nusuk_card_status
  CHECK (nusuk_card_status IN (
    'لم تطبع',
    'في الطباعة',
    'لدى الإدارة',
    'لدى المشرف',
    'مسلّمة للحاج'
  ));

-- ═══════════════════════════════════════════════════════
-- قسم التحقّق (اختياري — شغّله يدوياً بعد الـ migration)
-- ═══════════════════════════════════════════════════════
-- SELECT nusuk_card_status, COUNT(*)
--   FROM pilgrims
--   GROUP BY nusuk_card_status;
--
-- النتيجة المتوقّعة: فقط القيم الخمس الجديدة، لا قيم قديمة.
