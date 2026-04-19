-- ============================================================
-- ترجمة الفئات (categories) من الإنجليزية إلى العربية
-- شغّل هذا الملف مرة واحدة على قاعدة البيانات الموجودة
-- ============================================================

UPDATE survey_questions SET category = 'التسجيل'       WHERE category = 'registration';
UPDATE survey_questions SET category = 'التواصل'       WHERE category = 'communication';
UPDATE survey_questions SET category = 'الملاحظات'     WHERE category = 'feedback';
UPDATE survey_questions SET category = 'الاستقبال'     WHERE category = 'reception';
UPDATE survey_questions SET category = 'الإجراءات'     WHERE category = 'process';
UPDATE survey_questions SET category = 'السكن'         WHERE category = 'housing';
UPDATE survey_questions SET category = 'الطعام'        WHERE category = 'food';
UPDATE survey_questions SET category = 'الخدمات'       WHERE category = 'services';
UPDATE survey_questions SET category = 'السلامة'       WHERE category = 'safety';
UPDATE survey_questions SET category = 'المواعيد'      WHERE category = 'timeliness';
UPDATE survey_questions SET category = 'النظافة'       WHERE category = 'cleanliness';
UPDATE survey_questions SET category = 'التنظيم'       WHERE category = 'organization';
UPDATE survey_questions SET category = 'التقييم العام' WHERE category = 'overall';
UPDATE survey_questions SET category = 'الكوادر'       WHERE category = 'staff';
UPDATE survey_questions SET category = 'التوصية'       WHERE category = 'recommendation';
