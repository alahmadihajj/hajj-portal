-- ============================================================
-- نظام الاستبيانات — المرحلة 1: البنية التحتية
-- ============================================================

-- ===== جدول الاستبيانات =====
create table if not exists surveys (
  id bigint generated always as identity primary key,
  code text unique not null,
  title text not null,
  description text,
  icon text,
  active boolean default false,
  repeat_type text default 'once',
  start_date date,
  end_date date,
  display_order int default 0,
  welcome_message text,
  thanks_message text,
  auto_activate boolean default false,
  anonymous boolean default false,
  show_progress boolean default true,
  allow_edit boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== جدول الأسئلة =====
create table if not exists survey_questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  options jsonb,
  required boolean default true,
  display_order int default 0,
  category text
);

create index if not exists idx_survey_questions_survey_id on survey_questions(survey_id);

-- ===== جدول الإجابات =====
create table if not exists survey_responses (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  pilgrim_id bigint references pilgrims(id) on delete set null,
  pilgrim_booking text,
  pilgrim_name text,
  response_date date default current_date,
  answers jsonb,
  submitted_at timestamptz default now()
);

create index if not exists idx_survey_responses_survey_id on survey_responses(survey_id);
create index if not exists idx_survey_responses_pilgrim on survey_responses(survey_id, pilgrim_id, response_date);

-- ===== RLS =====
alter table surveys enable row level security;
alter table survey_questions enable row level security;
alter table survey_responses enable row level security;

create policy "allow_read" on surveys for select using (true);
create policy "allow_write" on surveys for all using (true);
create policy "allow_read" on survey_questions for select using (true);
create policy "allow_write" on survey_questions for all using (true);
create policy "allow_read" on survey_responses for select using (true);
create policy "allow_write" on survey_responses for all using (true);

-- ============================================================
-- بذور: الاستبيانات الخمسة الافتراضية
-- ============================================================
insert into surveys (code, title, description, icon, repeat_type, display_order) values
  ('pre_trip',  'ما قبل الرحلة',                   'تقييم مرحلة التسجيل والتحضير قبل السفر',     '📋', 'once',  1),
  ('arrival',   'الوصول والتنظيم',                  'تقييم مرحلة الاستقبال وبداية الرحلة',        '🏨', 'once',  2),
  ('mashaer',   'المشاعر (منى ومزدلفة وعرفات)',    'تقييم أيام المشاعر المقدسة',                 '🕋', 'daily', 3),
  ('transport', 'النقل والتفويج',                   'تقييم خدمات النقل والتفويج بين المشاعر',     '🚌', 'once',  4),
  ('post_trip', 'التقييم العام بعد الحج',            'التقييم الشامل لتجربة الحج بعد إتمامها',     '⭐', 'once',  5);

-- ============================================================
-- بذور: الأسئلة الافتراضية لكل استبيان
-- ============================================================

-- ===== pre_trip =====
insert into survey_questions (survey_id, question_text, question_type, options, required, display_order, category) values
  ((select id from surveys where code='pre_trip'), 'ما تقييمك لسهولة عملية التسجيل والحجز؟',       'rating', null, true,  1, 'التسجيل'),
  ((select id from surveys where code='pre_trip'), 'ما تقييمك لوضوح المعلومات المقدمة قبل السفر؟', 'rating', null, true,  2, 'التواصل'),
  ((select id from surveys where code='pre_trip'), 'ما تقييمك لسرعة الرد على استفساراتك؟',        'rating', null, true,  3, 'التواصل'),
  ((select id from surveys where code='pre_trip'), 'هل وصلتك التعاميم والتعليمات بشكل واضح؟',      'single', '["نعم","جزئياً","لا"]'::jsonb, true, 4, 'التواصل'),
  ((select id from surveys where code='pre_trip'), 'ما تقييمك لجودة التواصل من قبل الشركة؟',       'rating', null, true,  5, 'التواصل'),
  ((select id from surveys where code='pre_trip'), 'اقتراحاتك لتحسين مرحلة ما قبل الرحلة',         'text',   null, false, 6, 'الملاحظات');

-- ===== arrival =====
insert into survey_questions (survey_id, question_text, question_type, options, required, display_order, category) values
  ((select id from surveys where code='arrival'), 'ما تقييمك للاستقبال عند الوصول؟',                         'rating', null, true,  1, 'الاستقبال'),
  ((select id from surveys where code='arrival'), 'ما تقييمك لسرعة الإجراءات وتسليم البطاقات؟',             'rating', null, true,  2, 'الإجراءات'),
  ((select id from surveys where code='arrival'), 'ما تقييمك لوضوح التوجيهات من فريق الشركة؟',              'rating', null, true,  3, 'الإجراءات'),
  ((select id from surveys where code='arrival'), 'هل تم تسليمك بطاقة نسك في الوقت المحدد؟',                 'single', '["نعم","متأخرة","لم تُسلم"]'::jsonb, true, 4, 'الإجراءات'),
  ((select id from surveys where code='arrival'), 'ملاحظاتك حول مرحلة الوصول',                               'text',   null, false, 5, 'الملاحظات');

-- ===== mashaer =====
insert into survey_questions (survey_id, question_text, question_type, options, required, display_order, category) values
  ((select id from surveys where code='mashaer'), 'ما تقييمك لنظافة المخيم في منى؟',                  'rating', null, true,  1, 'السكن'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لمرافق الحمامات في منى؟',                'rating', null, true,  2, 'السكن'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك للتبريد والراحة في الخيام؟',              'rating', null, true,  3, 'السكن'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لجودة الوجبات؟',                         'rating', null, true,  4, 'الطعام'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لتوفر المياه والمشروبات؟',                'rating', null, true,  5, 'الطعام'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لتنظيم عرفات؟',                          'rating', null, true,  6, 'الخدمات'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لتنظيم مزدلفة؟',                         'rating', null, true,  7, 'الخدمات'),
  ((select id from surveys where code='mashaer'), 'هل توفرت الخدمات الصحية عند الحاجة؟',               'single', '["نعم","جزئياً","لا","لم أحتج"]'::jsonb, true, 8, 'السلامة'),
  ((select id from surveys where code='mashaer'), 'ما تقييمك لسلامة الممرات والتنقل داخل المخيم؟',     'rating', null, true,  9, 'السلامة'),
  ((select id from surveys where code='mashaer'), 'ملاحظاتك حول تجربة المشاعر',                        'text',   null, false, 10, 'الملاحظات');

-- ===== transport =====
insert into survey_questions (survey_id, question_text, question_type, options, required, display_order, category) values
  ((select id from surveys where code='transport'), 'ما تقييمك لالتزام الحافلات بالمواعيد؟',      'rating', null, true,  1, 'المواعيد'),
  ((select id from surveys where code='transport'), 'ما تقييمك لنظافة الحافلات؟',                'rating', null, true,  2, 'النظافة'),
  ((select id from surveys where code='transport'), 'ما تقييمك لسلامة القيادة والسائقين؟',        'rating', null, true,  3, 'السلامة'),
  ((select id from surveys where code='transport'), 'هل كان التفويج منظماً؟',                     'single', '["نعم","إلى حد ما","لا"]'::jsonb, true, 4, 'التنظيم'),
  ((select id from surveys where code='transport'), 'ملاحظاتك حول خدمات النقل',                    'text',   null, false, 5, 'الملاحظات');

-- ===== post_trip =====
insert into survey_questions (survey_id, question_text, question_type, options, required, display_order, category) values
  ((select id from surveys where code='post_trip'), 'ما تقييمك العام لتجربة الحج مع الشركة؟',              'rating', null, true,  1, 'التقييم العام'),
  ((select id from surveys where code='post_trip'), 'ما تقييمك للمشرف الخاص بك؟',                         'rating', null, true,  2, 'الكوادر'),
  ((select id from surveys where code='post_trip'), 'ما تقييمك للطعام طوال الرحلة؟',                       'rating', null, true,  3, 'الخدمات'),
  ((select id from surveys where code='post_trip'), 'ما تقييمك لخدمات النقل؟',                             'rating', null, true,  4, 'الخدمات'),
  ((select id from surveys where code='post_trip'), 'ما تقييمك للسكن في المشاعر؟',                         'rating', null, true,  5, 'الخدمات'),
  ((select id from surveys where code='post_trip'), 'ما تقييمك للخدمات الصحية؟',                           'rating', null, true,  6, 'الخدمات'),
  ((select id from surveys where code='post_trip'), 'هل توصي بهذه الشركة لآخرين؟',                         'single', '["بالتأكيد","ربما","لا"]'::jsonb, true, 7, 'التوصية'),
  ((select id from surveys where code='post_trip'), 'أفضل تجربة عشتها خلال الحج',                          'text',   null, false, 8, 'الملاحظات'),
  ((select id from surveys where code='post_trip'), 'اقتراحاتك لتحسين الخدمة في المستقبل',                 'text',   null, false, 9, 'الملاحظات');
