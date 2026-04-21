-- ═══════════════════════════════════════════════════════════════════════
-- Migration: نظام الإقرارات الرسمية — v22.0 الدفعة 1
-- الدورة 13
-- ═══════════════════════════════════════════════════════════════════════
-- الهدف:
--   1. رقم هوية المشرف — يظهر في إقرار استلام بطاقات نسك من الإدارة
--   2. فصل تواقيع الاستلام (المشرف من الإدارة) عن تواقيع التسليم (للحاج)
--      بحيث لا يُستبدل توقيع المشرف عند تسليم البطاقة للحاج
-- ═══════════════════════════════════════════════════════════════════════

-- [1] رقم هوية المشرف في sys_users
ALTER TABLE sys_users
  ADD COLUMN IF NOT EXISTS id_num TEXT;

COMMENT ON COLUMN sys_users.id_num IS
  'رقم الهوية/الإقامة للمشرف — يظهر في إقرار استلام بطاقات نسك من الإدارة';

-- [2] حقول إقرار المشرف المنفصلة في pilgrims
ALTER TABLE pilgrims
  ADD COLUMN IF NOT EXISTS nusuk_supervisor_sig    TEXT,
  ADD COLUMN IF NOT EXISTS nusuk_supervisor_time   TEXT,
  ADD COLUMN IF NOT EXISTS nusuk_supervisor_ack_id TEXT;

COMMENT ON COLUMN pilgrims.nusuk_supervisor_sig IS
  'توقيع المشرف عند استلام البطاقة من الإدارة (منفصل عن nusuk_card_sig — توقيع الحاج)';
COMMENT ON COLUMN pilgrims.nusuk_supervisor_time IS
  'وقت استلام المشرف للبطاقة (منفصل عن nusuk_card_time)';
COMMENT ON COLUMN pilgrims.nusuk_supervisor_ack_id IS
  'معرّف bulk_session للإقرار الجماعي الذي استُلمت ضمنه البطاقة (ربط بطاقات بنفس الإقرار)';

-- ═══════════════════════════════════════════════════════════════════════
-- تحقُّق:
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('sys_users','pilgrims')
--   AND column_name IN ('id_num','nusuk_supervisor_sig','nusuk_supervisor_time','nusuk_supervisor_ack_id');
-- ═══════════════════════════════════════════════════════════════════════
