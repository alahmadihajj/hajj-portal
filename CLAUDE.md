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
