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
