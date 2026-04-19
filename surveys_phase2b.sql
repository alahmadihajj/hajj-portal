-- ============================================================
-- نظام الاستبيانات — المرحلة 2B: أعمدة إعدادات إضافية
-- شغّل هذا الملف على قاعدة بيانات موجودة بها surveys_setup.sql
-- ============================================================

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS thanks_message text;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS auto_activate boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS anonymous boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS show_progress boolean DEFAULT true;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS allow_edit boolean DEFAULT false;
