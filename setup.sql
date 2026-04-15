-- ===== جدول الحجاج =====
create table pilgrims (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  booking_num text,
  id_num text,
  mobile text,
  city text,
  camp_num text,
  pilgrim_type text,
  name text,
  gender text,
  birth_date text,
  nationality text,
  package_type text,
  pattern_name text,
  transport_type text,
  license_num text,
  company_name text,
  booked_via text,
  booking_date text,
  booking_status text,
  payment_method text,
  payment_status text,
  permit_status text,
  card_status text,
  bus_status text,
  camp_status text,
  mina_seat text,
  arafat_seat text,
  supervisor_name text,
  supervisor_phone text,
  group_num text,
  bus_num text
);

-- ===== جدول التعاميم =====
create table announcements (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  title text,
  body text,
  type text default 'info',
  active boolean default true,
  ann_date text
);

-- ===== جدول المخيمات =====
create table camps (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text,
  location text,
  capacity text,
  notes text
);

-- ===== جدول الأفواج =====
create table groups (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  num text,
  name text,
  supervisor text,
  camp text,
  notes text
);

-- ===== جدول الحافلات =====
create table buses (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  num text,
  plate text,
  driver text,
  driver_phone text,
  capacity text,
  group_num text
);

-- ===== جدول مستخدمي النظام =====
create table sys_users (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  username text unique,
  name text,
  password text,
  role text default 'viewer',
  active boolean default true
);

-- ===== جدول طلبات الحجاج =====
create table requests (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  pilgrim_name text,
  id_num text,
  type text,
  details text,
  status text default 'new',
  req_date text
);

-- ===== جدول الموظفين =====
create table staff (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text,
  title text,
  department text,
  phone text,
  tasks text,
  pilgrims_ids text
);

-- ===== إعدادات إظهار الأقسام =====
create table settings (
  id bigint generated always as identity primary key,
  key text unique,
  value text
);

-- ===== تفعيل RLS لجميع الجداول =====
alter table pilgrims enable row level security;
alter table announcements enable row level security;
alter table camps enable row level security;
alter table groups enable row level security;
alter table buses enable row level security;
alter table sys_users enable row level security;
alter table requests enable row level security;
alter table staff enable row level security;
alter table settings enable row level security;

-- ===== سياسات القراءة العامة =====
create policy "allow_read" on pilgrims for select using (true);
create policy "allow_read" on announcements for select using (true);
create policy "allow_read" on camps for select using (true);
create policy "allow_read" on groups for select using (true);
create policy "allow_read" on buses for select using (true);
create policy "allow_read" on sys_users for select using (true);
create policy "allow_read" on requests for select using (true);
create policy "allow_read" on staff for select using (true);
create policy "allow_read" on settings for select using (true);

-- ===== سياسات الكتابة العامة =====
create policy "allow_write" on pilgrims for all using (true);
create policy "allow_write" on announcements for all using (true);
create policy "allow_write" on camps for all using (true);
create policy "allow_write" on groups for all using (true);
create policy "allow_write" on buses for all using (true);
create policy "allow_write" on sys_users for all using (true);
create policy "allow_write" on requests for all using (true);
create policy "allow_write" on staff for all using (true);
create policy "allow_write" on settings for all using (true);
