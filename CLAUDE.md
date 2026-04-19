# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Arabic-language (RTL) Hajj pilgrim management portal for شركة الأحمدي. Two self-contained pages backed by Supabase:

- `index.html` — pilgrim-facing portal. Login by `id_num` + `booking_num`, then displays status, timeline, seats, supervisor, announcements, etc. Multi-language via the `LANGS` dictionary near the top of the `<script>` block.
- `admin.html` — admin panel (data tab, settings, housing/camps/buses/groups, staff, announcements, users). Also contains the **supervisor** panel (`#supervisor-panel`) served to users with `role === 'supervisor'`.

No build tooling. No tests. No package.json. To run locally, serve the folder statically (e.g. `python -m http.server 8000`) or open the HTML files directly; Supabase is reached over HTTPS.

## Architecture

**Data layer (`supabase.js`)** exposes a single global `window.DB` with per-table namespaces: `Pilgrims`, `Announcements`, `Camps`, `Groups`, `Buses`, `SysUsers`, `Requests`, `Staff`, `Settings`. Every table access in the HTML pages goes through these — never call `_db` directly or embed raw Supabase calls in `index.html`/`admin.html`. After the client connects, `supabase.js` dispatches a `db-ready` event on `window`; page bootstraps should guard on `window.DB` existence before accessing data.

**Config (`config.js`)** holds the Supabase URL/anon key and the hardcoded super-admin credentials (`SYSTEM_CONFIG.superAdmin`). The super-admin short-circuits DB lookup in `doAdminLogin` (`admin.html:1256`). All other auth goes through the `sys_users` table (plain-text password comparison — this is a closed internal tool, not a public site).

**Roles** (`sys_users.role`): `superadmin`, `admin`, `viewer`, `supervisor`. The supervisor role is handled specially — `enterAdminPanel` (`admin.html:1280`) routes supervisors into `#supervisor-panel` via `loadSupervisorPanel`, which filters pilgrims to the user's assigned `group_num` (used as the bus number). The main admin tabs (`data`, `settings`, `housing`, `staff`, `ann`, `users`) are orchestrated by `switchTab` (`admin.html:4407`) — each tab lazy-loads its renderer.

**Schema drift warning.** `setup.sql` is the original schema but the live Supabase database has additional columns added over time that are not reflected there — e.g. `pilgrims.nusuk_card_status`, `pilgrims.bracelet_time`, `sys_users.group_num`, `sys_users.name`. When reading/writing columns, trust the code over `setup.sql`. If you add a new column, update both the live DB (via Supabase dashboard / SQL editor) and `setup.sql` so a fresh setup still works.

**Pilgrim record shape is bilingual by key.** `index.html` reads fields using Arabic keys (`r['رقم الحجز']`, `r['حالة الحجز']`, `r['موقع الجلوس في منى']`, etc.) while `admin.html` and `supabase.js` use the English snake_case column names (`booking_num`, `booking_status`, `mina_seat`). There is a mapping layer — when changing a field, check both sides.

**Client-side caching.** Portal theming (logo, colors) is cached in `localStorage` under `hajj_portal_colors` and `hajj_portal_logo_cache` and applied in an inline script *before* the body renders to prevent color/logo flash (`index.html:156`). Section visibility is read from `settings` table key `haj_sections_visibility`. Remember-me credentials live in `localStorage` (`admin_user_saved`, `admin_pass_saved`, and per-pilgrim equivalents).

**File size.** `admin.html` is ~8k lines / 500KB; `index.html` is ~1k lines with very long inline-data lines / 1.1MB. Use `Grep` with `-n` to locate sections before editing — do not try to read these files top-to-bottom.

## Common tasks

- **Add a new DB field:** add the column in Supabase (and `setup.sql`), add a wrapper method to the relevant namespace in `supabase.js` if CRUD shape differs, then update the reader/writer in `admin.html` and — if pilgrim-visible — in `index.html` (add the Arabic-key mapping).
- **Add a new admin tab:** add the button to the tab bar (`admin.html` ~line 639), add a `<div id="tab-<name>">` panel, add `<name>` to the `tabs` array in `switchTab`, and wire a renderer in the `if(tab==='<name>')` branch.
- **Change pilgrim portal sections:** sections have stable IDs listed in `SECTION_IDS` (`index.html` near line 805); `applyVisibilitySettings` toggles them based on the `haj_sections_visibility` setting.

## Conventions

- Arabic UI strings are written directly in source; keep RTL (`dir="rtl"`) intact. English/other-language strings go into the `LANGS` object on the pilgrim portal.
- The codebase uses vanilla JS with global functions and globals on `window`. No modules, no bundler — `<script>` order in each HTML file matters (Supabase SDK → `config.js` → `supabase.js` → inline page script).
- Recent commits use short Arabic messages prefixed with a version tag (e.g. `v9.0 - ربط بوابة الحاج بلوحة التحكم في الأدمن`). Follow that style for new commits.

## قواعد العمل مع أحمد
- ردود قصيرة ومباشرة بالعربي
- لا تضف ميزات غير مطلوبة
- لا تعطِ رأيك إلا إذا طُلب
- التنفيذ المباشر بدون شرح طويل
- إذا قال "ارجع" تراجع فوراً
- بعد كل تعديل: اقترح أمر git commit جاهز للنسخ

## روابط المشروع
- GitHub: https://github.com/alahmadihajj/hajj-portal
- Vercel: https://hajj-portal.vercel.app
- Supabase: https://txdvqedfhzwgejbtplyr.supabase.co
- سوبر أدمن: 1057653261 / A@a0508777228

## ميزات مستقبلية مطلوبة

### إدارة الفئات (Categories Management) — ذو أولوية متوسطة
- واجهة مستقلة (صفحة أو modal) لعرض/تعديل/حذف الفئات
- زر في toolbar "إدارة الأسئلة" أو تبويب منفصل
- الفئات الـ 15 الافتراضية محمية بقفل 🔒 — لا تُحذف ولا تُعدّل
- الفئات المخصصة:
  * ✏️ تعديل الاسم → يحدّث كل الأسئلة المرتبطة تلقائياً
  * 🗑️ حذف فارغ (0 سؤال) → مباشر
  * 🗑️ حذف مع أسئلة → خيار نقلها لفئة أخرى قبل الحذف
- عرض عدد الأسئلة المرتبطة بكل فئة

### تحسين بصري: محاذاة سهم select — أولوية منخفضة
- السهم في حقل الفئة (qe-category-select) وحقل فلتر الفئة (qm-cat-filter) يظهر في أعلى يسار الحقل بدل المنتصف العمودي
- لا يؤثر على الوظائف — جمالي فقط
- المتصفح: يحتاج اختبار عبر Chrome/Firefox/Safari
- محاولات سابقة: `top 50%`، `center`، `background-size` explicit
- الحل المحتمل: custom wrapper div مع `::after` pseudo-element لرسم السهم يدوياً بدل `background-image`

### نظام المطور العالمي (Master Developer Access) — أولوية عالية عند توسّع المبيعات

**السياق:**
المشروع مبني للبيع لشركات حج متعددة. كل شركة ستحصل على نسخة مستقلة بقاعدة بياناتها الخاصة. المطور (أحمد الثاقفي) يحتاج الوصول لكل النسخ لـ:
- الدعم الفني عن بُعد
- إرسال قوالب استبيانات جاهزة
- إصلاح الأخطاء
- التحديثات
- استيراد/تصدير/حذف الاستبيانات

**الحل المطلوب مستقبلاً:**

1. إنشاء جدول في كل قاعدة بيانات:
```sql
CREATE TABLE developer_access (
  id bigint generated always as identity primary key,
  developer_id text UNIQUE NOT NULL,
  developer_name text,
  granted_at timestamptz DEFAULT now(),
  granted_by text,
  is_active boolean DEFAULT true,
  last_access timestamptz,
  notes text
);
```

2. إضافة حساب المطور الثابت عند تثبيت كل نسخة:
```sql
INSERT INTO developer_access (developer_id, developer_name, granted_by)
VALUES ('DEV_AHMAD_THAGAFI_2026', 'أحمد الثاقفي - المطور الأساسي', 'system_install');
```

3. في `admin.html`، استبدال الفحص الحالي (`isDeveloperMode` بـ 1057653261 أو `?dev=1`) بفحص ديناميكي من جدول `developer_access`:
```javascript
async function isDeveloperMode() {
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  const { data } = await supabase
    .from('developer_access')
    .select('is_active')
    .eq('developer_id', currentUser.developer_id)
    .single();
  if (data?.is_active) {
    await supabase.from('developer_access')
      .update({ last_access: new Date().toISOString() })
      .eq('developer_id', currentUser.developer_id);
    return true;
  }
  return false;
}
```

4. إنشاء صفحة منفصلة `developer.html` — لوحة تحكم المطور تعرض:
- كل الشركات المرتبطة
- إحصائيات كل شركة
- سجل وصول المطور
- أدوات متقدمة (تنفيذ SQL، استيراد جماعي، إلخ)

5. آليات الأمان:
- إمكانية إلغاء صلاحية المطور من قبل صاحب الشركة (`is_active = false`)
- سجل كامل لكل عمليات المطور
- إشعار للسوبر أدمن عند دخول المطور

**وقت التنفيذ المتوقع:** 3-4 ساعات عند أول عميل جديد بعد الأحمدي.

**حتى ذلك الحين:** استخدم الحل الحالي (ربط بحساب `1057653261` + `?dev=1`) — مُطبَّق فعلياً في `admin.html` → `isDeveloperMode()`.

### ✅ شعار الشركة الديناميكي — تم التنفيذ (v12.6)
- المصدر الوحيد: `dev_settings.logo` (Supabase Settings، يضبطه السوبر أدمن)
- يُعرض في: شاشة تسجيل الدخول (admin + pilgrim)، header الأدمن، شريط السوبر أدمن، بوابة الحاج، كل التقارير السبع
- Fallback: شعار افتراضي 🕋 في دائرة gradient بنّي/ذهبي
- Legacy: `hajj_portal_logo` يُقرأ كـ fallback ثانوي في index.html للتوافق
- حُذفت الصور base64 الضخمة من admin.html (السطور 849 و 997 كانتا ~60KB مضمّنة)
- Helpers: `_buildLogoHTML(size, options)` للـ UI، `_buildPrintLogoHTML(size)` للتقارير

### تثبيت المنتج عند البيع لعميل جديد — أولوية عالية
عند البيع لشركة حج جديدة:
1. إنشاء قاعدة بيانات Supabase جديدة
2. تنفيذ كل SQL scripts (surveys_setup.sql, surveys_phase2b.sql, setup.sql, إلخ)
3. تسجيل دخول كسوبر أدمن
4. الذهاب إلى: إعدادات النظام (سوبر أدمن)
5. إدخال **اسم الشركة** (مهم جداً — يظهر في كل مكان)
6. إدخال رقم الترخيص
7. رفع شعار الشركة

**اسم الشركة هو المصدر الوحيد** (`dev_settings.companyName`) ويُعرض في:
- شاشة تسجيل الدخول
- عنوان الصفحة
- هيدر الأدمن وبوابة الحاج
- كل التقارير والإقرارات

(الحقول القديمة `pp-company` في "الهوية البصرية" و `cfg-company` في "إعدادات عامة" حُذفت — راجع تاريخ git commit v12.4)

### ملاحظة للمستقبل
هذا القسم سيُضاف له ميزات أخرى تُطلب أثناء التطوير. يجب مراجعته دائماً عند اكتمال مراحل العمل الحالية لبدء تنفيذها.

## المرحلة 3 — بوابة الحاج (نظام الاستبيانات)

### 3A ✅ مكتمل (v13.0)
- حُذف محتوى `sec-survey` القديم (placeholder ثابت) مع الاحتفاظ بـ id نفسه (حفاظاً على admin toggle)
- قسم ديناميكي يقرأ من `DB.Surveys.getActive()` + فلترة حسب إجابات الحاج
- فلترة ذكية حسب `repeat_type`:
  * `once`: إذا سبقت الإجابة → استبعاد
  * `daily`: إذا أجاب اليوم → استبعاد
  * `weekly`: إذا أجاب خلال آخر 7 أيام → استبعاد
  * قيمة غير معروفة → متاح (دفاع آمن)
- `window._currentPilgrim` يُحفظ في `doLogin` بعد جلب بيانات الحاج — ضروري لربط الإجابات
- `startSurvey(id)` حالياً placeholder (console.log + alert) — التنفيذ الكامل في 3C
- إضافة `Surveys.getResponsesByPilgrim(pilgrimId)` في `supabase.js`
- الأداء: `Promise.all` لعدّ أسئلة الاستبيانات المتاحة بالتوازي
- استدعاء `loadAvailableSurveys()` بعد 300ms من `showResult` (بعد ظهور نتيجة الحاج)

**حقل الأيقونة:** الكود يدعم `survey.icon` (الاسم الفعلي في schema) مع fallback لـ `survey.emoji` احتياطياً.

### 3B ✅ مكتمل (v13.1)
- نافذة منبثقة احترافية تظهر فور ظهور قسم الاستبيانات (بعد +500ms)
- ترحيب بأول اسم الحاج (من `pilgrim.name` split بالمسافات)
- عنوان فرعي ديناميكي: مفرد/جمع حسب عدد الاستبيانات
- قائمة مختصرة بكل استبيان (emoji + title + ❓ عدد الأسئلة + ⏱️ وقت تقديري)
- زران: "ابدأ الآن" (يفتح أول استبيان) و "لاحقاً" (إغلاق)
- Animations: fadeIn للـ overlay، scaleIn للحاوية، bellRing لأيقونة 🔔
- Responsive: تكيّف مع الشاشات ≤ 480px
- النقر خارج المحتوى = إغلاق، زر ✕ علوي للإغلاق المباشر
- `document.body.style.overflow = 'hidden'` عند الإظهار لمنع scroll الخلفية
- `window._surveysPopupShown` flag: يمنع إعادة الإظهار في نفس الجلسة
- `window._availableSurveys` يحفظ القائمة لاستخدام 3C

## ميزة: جدولة الاستبيانات مع دعم الساعة (v13.2)

### المنطق الهرمي
- **المفتاح الرئيسي:** `active` (boolean)
  - `OFF` → الاستبيان مغلق كلياً (لا يظهر للحاج، حقول الجدولة معطّلة مع رسالة توضيحية)
  - `ON` → الخصائص التابعة تعمل: `auto_activate`, `start_date`, `end_date`

### ما الجديد
- ✅ دعم الساعة (مثال: 10:00 صباحاً) — تحويل `start_date`/`end_date` إلى `timestamptz` في DB
- ✅ Migration منفصل: `surveys_timestamp_migration.sql`
- ✅ واجهة: حقلي تاريخ + وقت منفصلين في tab الجدولة
- ✅ ديناميكية: toggle `active` يُفعّل/يُعطّل حقول الجدولة فوراً + رسالة توضيحية
- ✅ Badges ملونة في البطاقة: `⏰ يبدأ` / `🔥 ينتهي خلال` / `✓ انتهى`
- ✅ Auto-disable تلقائي: الاستبيان يُعطَّل عند تجاوز `end_date` (مع toast)
- ✅ فلترة index.html: الحاج لا يرى استبياناً خارج النافذة الزمنية
- ✅ `supabase.js → Surveys.getActive()` يفلتر بالتواريخ تلقائياً

### النمط الموحّد للتحديث
جميع دوال التعديل (`saveNewSurvey`, `saveSurveySettings`, `confirmDuplicate`, `deleteSurvey`, `confirmImport`) الآن تستخدم:
```js
await window.DB.Surveys.X(...)
closeModal()
await renderSurveys()  // إعادة جلب كاملة من DB
showToast('✅ ...')
```
هذا يضمن انعكاس التغييرات فوراً (مثل `auto_activate` الذي يُفعَّل تلقائياً عبر `autoManageScheduledSurveys`).

### Bugfix في v13.2
- Emoji الاستبيان الجديد يظهر فوراً (لا F5)
- Auto-activate يُفعّل الاستبيان وبطاقته تعكس الحالة فوراً

### 3C ✅ مكتمل (v13.3)
- مودال عرض/إجابة الاستبيان — تصميم احترافي كامل في index.html
- 3 مراحل: welcome (ترحيب + emoji + وصف) → questions (سؤال واحد في الشاشة) → thanks (شكر + رسالة مخصّصة)
- 4 أنواع أسئلة (مطابقة الـ schema):
  * `rating` — 5 نجوم تفاعلية (ثابت، لا `max_rating`)
  * `single` — radio options، **مع UX خاص لنعم/لا** عند `options=['نعم','لا']` (أزرار ✅❌ ملوّنة)
  * `multiple` — checkbox options
  * `text` — textarea بلا حد (لا `max_length`)
- Progress bar يحترم `survey.show_progress` (يُخفى إذا false)
- Navigation: سابق/تالي مع validation للأسئلة الإلزامية (required=true)
- Payload إلى `survey_responses`:
  ```js
  { survey_id, pilgrim_id, pilgrim_booking, pilgrim_name, response_date, answers }
  ```
- **خصوصية:** `survey.anonymous=true` → `pilgrim_name/booking` null، لكن `pilgrim_id` يبقى دائماً (لحماية التكرار)
- **allow_edit=true:** بدون تأكيد عند الإغلاق (الحاج يستطيع الرجوع)
- معالجة الأخطاء: إرسال فاشل → زر "🔄 إعادة المحاولة" + toast خطأ + الاحتفاظ بالإجابات
- بعد الإرسال الناجح: إعادة تحميل `loadAvailableSurveys` → الاستبيان المُجاب يختفي من القائمة
- z-index 10001 (فوق `surveys-popup-overlay`)
- Animations: fadeIn + scaleIn للمودال، qFadeIn لكل سؤال
- Responsive كامل (max-width ≤ 480px)

## المرحلة 4 — لوحة النتائج للأدمن (v14.0)

### قرار معماري
Modal واحد بوضعَين داخليَّين بدل tab منفصل — يتناسق مع باقي أزرار البطاقة (⚙️ ⓘ 📝 👁️). يُفتح عبر زر 📊 في البطاقة.

### البنية: 3 مستويات داخل Modal واحد
- **Header ثابت:** emoji + العنوان + KPIs سريعة (عدد الإجابات، نسبة المشاركة، متوسط التقييم، تاريخ آخر إجابة) + زر ✕
- **Tabs داخلية:**
  - `📊 تحليل الأسئلة` (default): bar charts لكل سؤال حسب النوع
  - `👥 الإجابات الفردية`: بطاقة لكل إجابة مع احترام `anonymous`
- **Footer ثابت:** `📥 تصدير Excel`

### تحليل الأسئلة حسب النوع
- **rating:** متوسط كبير + نجوم + bar chart عمودي (5★ إلى 1★) بألوان صفراء متدرّجة
- **single:** options مرتّبة DESC + bars خضراء (%)
- **multiple:** options مرتّبة DESC + bars زرقاء (%)
- **text:** قائمة الردود (max 20) + "+X إجابة أخرى" — قابل للتمرير

### ميزات تقنية
- Cache: `window._currentResultsData` يحفظ `{questions, responses}` — تبديل الـ tabs بدون إعادة جلب
- إذا `ALL_DATA` فارغ → `loadData()` تلقائياً لضمان دقة نسبة المشاركة
- KPI متوسط التقييم: يحسب فقط إذا فيه أسئلة `rating` وإجابات
- تاريخ آخر إجابة: من أول response (مرتّبة DESC)

### تصدير CSV
- `\uFEFF` BOM للعربية (يفتح في Excel مباشرة)
- Headers: التاريخ / الاسم / رقم الحجز / كل سؤال
- Rows: تنسيق تاريخ DD/MM/YYYY HH:mm
- احترام `anonymous`: "مجهول" بدل الاسم، وخانة الحجز فارغة
- اسم الملف: `{surveyTitle}_{YYYY-MM-DD}.csv` مع تنظيف الأحرف غير المسموحة

### الحالات الحرجة المعالجة
- لا إجابات → empty state بـ 📭
- لا أسئلة → empty state بـ 📝
- سؤال بلا إجابات → "لم يُجَب بعد" داخل البطاقة
- خطأ في الجلب → رسالة مع تفاصيل
- Rating بقيمة غير صحيحة (خارج 1-5) → تُعرض كنص خام
- Textarea طويل → نمط quote مع border جانبي ذهبي

═══════════════════════════════════════

# ═══ الدورة الرابعة - ملخص شامل (v14.0 → v14.13) ═══

## تاريخ الدورة
- **البداية:** 2026-04-19 (v14.0)
- **النهاية:** 2026-04-19 (v14.13)
- **آخر commit:** `90fee01`

## الإصدارات التي أُنجزت

### v14.0 - لوحة نتائج الأدمن للاستبيانات
- Modal واحد بوضعين (تحليل/إجابات فردية)
- تحليل إحصائي لكل نوع سؤال:
  * تقييم: متوسط + توزيع نجوم
  * اختيار واحد: bars خضراء
  * اختيار متعدد: bars زرقاء
  * نص: قائمة أول 20 إجابة
- تصدير CSV مع BOM
- زر 📊 في بطاقة الاستبيان (معطّل بدون إجابات)
- 7 functions جديدة (openSurveyResults, closeSurveyResults, switchResultsMode, _renderResultsAnalysis, _renderResultsIndividual, exportCurrentResults, helpers)
- Commit: `ae7f63f`

### v14.1 - ترجمة LANGS شاملة
- توسيع LANGS من 55 إلى 130 مفتاح × 6 لغات
- 75 نص جديد × 6 = 450 ترجمة جديدة
- 68 نص موصول بالنظام (شاشات التسجيل، الاستبيانات، التطعيمات، الشركة، الدعاة، التعاميم)
- دالة مساعدة `t(key, params)` مع دعم `{n}`, `{total}`, `{company}`
- إضافة `notranslate` لعناصر LANGS (`id="l-*"` و `id="t-*"`)
- Re-render ديناميكي عند تبديل اللغة
- **ملاحظة:** admin.html لم يُترجم (قرار تجاري — عربي فقط للأدمن)

### v14.2-v14.6 - محاولات ترجمة المحتوى الديناميكي (تعلّم)
- **v14.2:** Google Translate Widget (فشل — `display:none` يمنع Google من إنشاء combo)
- **v14.3:** إصلاح CSS بوضع widget خارج الشاشة (فشل — combo null)
- **v14.4:** استبدال بـ MyMemory API (نجح الاستدعاء)
- **v14.5:** نظام قفل اللغة (`window._userLockedLang`)
- **v14.6:** TreeWalker للترجمة الشاملة لمحتوى التعاميم
- **النتيجة:** الترجمة عملت جزئياً لكن بعدم استقرار + تعقيد غير مبرر
- **قرار:** حذفها والعودة للنسخة النظيفة

### v14.7 - نسخة نظيفة مستقرة
- حذف كامل لنظام MyMemory (125 سطر)
- حذف نظام قفل اللغة
- إرجاع `setLang` لتوقيعها الأصلي `(code, skipResult=false)`
- الاحتفاظ بنظام LANGS (الواجهة الثابتة فقط)
- Commit: `d21676e`

### v14.8 - تصدير PDF لنتائج الاستبيانات
- استخدام jsPDF + html2canvas (من CDN)
- التقاط screenshot لـ `#results-body`
- A4 عمودي مع تقسيم تلقائي على الصفحات
- اسم الملف: `{surveyTitle}_{YYYY-MM-DD}.pdf`
- Toast messages (⏳/✅/❌)
- Commit: `727d938`

### v14.9 - غلاف احترافي للـ PDF
- صفحة غلاف قبل محتوى التحليل
- استخدام helpers موجودة: `_buildPrintLogoHTML`, `_getCompanyName`, `_getLicense`
- شعار (🕋 أو logo مرفوع) + اسم الشركة + الترخيص
- خط فاصل ذهبي متدرّج
- عنوان "تقرير نتائج الاستبيان"
- اسم الاستبيان + بطاقة عدد المستجيبين + التاريخ بالعربي
- ترقيم صفحات (`X / Y`) بـ `pdf.text` (Latin — آمن)
- Commit: `a5e2407`

### v14.10 - إصلاحات + إحصائيات مبسطة
- **إصلاح `letter-spacing`** (كان يقطّع العربية) — حُذف من الغلاف
- "استبيان" → "الاستبيان"
- 3 بطاقات إحصائية ملونة في الغلاف:
  * عدد المستجيبين (أحمر)
  * عدد الأسئلة (ذهبي)
  * متوسط التقييم ⭐ (أخضر — فقط إذا يوجد rating questions)
- helper `_statCard(value, label, gradient)`
- Commit: `394c85c`

### v14.11 - تقرير PDF احترافي كامل
- **صفحة 2: النتائج الرئيسية**
  * 4 KPIs (grid 2×2): المستجيبون/الأسئلة/⭐ المتوسط/% الإكمال
  * 🏆 أعلى تقييماً — top 3 أسئلة rating (أخضر)
  * 📉 بحاجة لتحسين — أسوأ 3 أقل من 4 (أحمر)
  * إخفاء ذكي للأقسام الفارغة
- **الصفحة الأخيرة: الخلاصة والتوصيات**
  * ملخّص ذاتي من البيانات
  * توصيات ديناميكية حسب المتوسط ونسبة الإكمال
  * رسالة شكر + تذييل
- حسابات: `qRatings[]`, `topRated`, `worstRated`, `completionRate`
- حماية: `_esc()` من XSS لكل نص ديناميكي
- Commit: `54e4ec0`

### v14.12 - تنبيه تواريخ الاستبيان (confirm)
- فحص داخل `saveSurveySettings`:
  * `end_date < now` → `confirm()` 🚨
  * `start_date < now` + `auto_activate` → `confirm()` ⚠️
  * `end_date <= start_date` → يبقى error ❌ (يُحفظ السلوك)
- فقط في `saveSurveySettings` (نموذج الإنشاء لا يحوي حقول تاريخ)
- Commit: `c354874`

### v14.13 - Modal احترافي للتنبيهات
- استبدال `confirm()`/toast بـ `showDateWarningModal({type, title, description, details, note, confirmLabel, cancelLabel, showCancel})`
- Promise-based → `const ok = await showDateWarningModal({...})`
- 3 أنواع: `warning` (أصفر 🟡) / `danger` (أحمر 🔴) / `error` (أحمر قوي ❌ بدون cancel افتراضياً)
- ميزات:
  * Animations: `fadeIn` (0.18s) + `slideUp+scale` (0.22s)
  * ESC للإغلاق
  * نقر خارج Modal يُغلق
  * Focus تلقائي على زر التأكيد
  * `role="dialog" aria-modal="true"`
  * تنسيق التواريخ: `toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' })`
- Commit: `90fee01`

## الخلاصة التقنية للدورة الرابعة

### إحصائيات
- **عدد الإصدارات:** 14 (v14.0 → v14.13)
- **الأسطر المضافة (صافي):** ~1500 سطر
- **الملفات الرئيسية المعدّلة:** `index.html`, `admin.html`
- **المكتبات الجديدة:** `jsPDF@2.5.1`, `html2canvas@1.4.1` (من CDN jsdelivr)

### الدروس المستفادة
1. **Google Translate Widget غير موثوق** للمواقع المخصّصة (يحتاج body مرئي)
2. **الترجمة الآلية للمحتوى الديناميكي** تحتاج Backend (cache + تحديث عند تعديل DB) — لا JavaScript فقط
3. **html2canvas ممتاز للعربية في PDF** (صورة بدل نصوص — يتجاوز مشكلة Arabic shaping في jsPDF)
4. **Modal مخصّص يتفوّق على `confirm()`/`alert()`** في التحكم بالتصميم والسلوك
5. **`letter-spacing` يكسر العربية** — يجب تجنّبه في النصوص العربية
6. **مبدأ مهم:** عند فشل ميزة بعد عدة محاولات → العودة للنسخة النظيفة خير من التراكم

═══════════════════════════════════════

# ═══ الدورة الخامسة - الخطة القادمة ═══

## الأولويات المقترحة (حسب القيمة التجارية)

### 🔥 أولوية عالية

#### 1. لوحة تحكم رئيسية (Dashboard) — 3-4 ساعات
- أول شيء يراه الأدمن عند الدخول
- إحصائيات عامة: عدد الحجاج، استبيانات نشطة، إجابات جديدة
- رسوم بيانية سريعة
- اختصارات للمهام الشائعة
- إشعارات/تنبيهات

#### 2. استهداف الاستبيانات — 3-4 ساعات
- **حالياً:** كل الحجاج يرون كل الاستبيانات
- **المقترح:** اختيار من يراها حسب:
  * الجنسية
  * المجموعة/الحافلة
  * نوع الباقة
  * حجاج محددين
- إضافة جدول `survey_targets` في DB
- UI في شاشة إنشاء/تعديل استبيان
- فلترة عند جلب الاستبيانات للحاج في `index.html`

#### 3. المجموعات والحافلات — 4-6 ساعات
- جدول `groups` في DB
- إنشاء/تعديل/حذف مجموعات
- إسناد حجاج للمجموعات
- إسناد مشرفين للمجموعات
- قوائم الحافلات للطباعة
- ربط مع نظام الاستهداف (#2)

### 🔥🔥 أولوية متوسطة

#### 4. إدارة الحجاج المتقدمة — 4-5 ساعات
- تصدير Excel شامل
- فلاتر متقدمة (بحث + جنسية + حالة)
- بحث سريع
- تعديل مجمّع (Bulk edit)

#### 5. التعاميم المتقدمة — 2-3 ساعات
- جدولة التعاميم (تاريخ نشر + انتهاء)
- تعميم لمجموعة محددة
- 4 أنواع (معلومة/تحذير/عاجل/نجاح) — موجودة
- تنسيق غني (rich text) — Quill موجود

#### 6. التطعيمات المتقدمة — 3-4 ساعات
- إضافة/تعديل أنواع تطعيمات
- جدول تطعيمات لكل حاج
- تتبع الحالة (مأخوذ/لم يؤخذ)
- تذكيرات

#### 7. Auto-save للاستبيانات — 2-3 ساعات
- حفظ تلقائي كل 30 ثانية
- استعادة الإجابات الجزئية
- إشعار "لديك استبيان غير مكتمل"

### 🔥 أولوية منخفضة

#### 8. نسخ استبيان (Duplicate) — 30 دقيقة *(موجود جزئياً في v11)*
#### 9. ترتيب الأسئلة (Drag & Drop) — 1-2 ساعة
#### 10. إدارة المشرفين المتقدمة — 4-5 ساعات
#### 11. إشعارات للحاج — 2-3 ساعات (في الموقع)
#### 12. توثيق للوزارة (حزمة رسمية) — 3 ساعات

## ملاحظات مهمة للدورة الخامسة

1. **البدء بـ:** لوحة التحكم الرئيسية (Dashboard) — أول ما يراه العميل
2. **الهدف:** رفع المنتج من 6.5/10 إلى 9/10
3. **استراتيجية:** بناء ميزة متكاملة كل دورة بدل ميزات صغيرة متعددة
4. **لا تكرر خطأ الدورة 4:** الترجمة الآلية — إذا طُلبت، ابنِ Backend مع cache
5. **الحفاظ على:** الاستقرار والأداء — الكود النظيف

## حالة المنتج الحالية

### التقييم (من 10)
- الاستبيانات: **9/10** ⭐⭐
- الترجمة: **7/10**
- إدارة الحجاج: **6/10**
- التقارير: **8/10** ⭐
- لوحة الأدمن: **6/10**
- التطعيمات: **5/10**
- التعاميم: **5/10**
- **المتوسط: 6.5/10 — جاهز للبيع**

### الإصدار الحالي على Vercel
- **v14.13** — Modal احترافي للتنبيهات
- **آخر Commit:** `90fee01`

═══════════════════════════════════════
