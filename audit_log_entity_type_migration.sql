-- ═══════════════════════════════════════════════════════════════════════
-- Migration: audit_log.chk_entity_type — إصلاح القيد
-- الدورة 12 — v20.4.1 Hotfix
-- ═══════════════════════════════════════════════════════════════════════
-- السبب:
--   القيد السابق لم يشمل جميع القيم المستخدمة في الكود (من AUDIT_ENTITY_LABELS).
--   كان يرفض inserts بأخطاء 400 Bad Request + "violates check constraint chk_entity_type".
--
-- الإصلاح:
--   إعادة تعريف القيد ليشمل جميع الـ 9 قيم المستخدمة في audit.js (+ القديم 'user').
--
-- تنفيذ يدوي عبر Supabase SQL Editor:
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_entity_type;

ALTER TABLE audit_log ADD CONSTRAINT chk_entity_type
CHECK (entity_type IN (
  'pilgrim',
  'camp',
  'group',
  'bus',
  'user',         -- legacy (قبل توحيد sysuser)
  'sysuser',
  'announcement',
  'survey',
  'staff'
));

-- ═══════════════════════════════════════════════════════════════════════
-- تحقُّق:
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT conname, pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint
-- WHERE conname = 'chk_entity_type';
-- ═══════════════════════════════════════════════════════════════════════
