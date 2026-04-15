// ===== Supabase Client =====
const { createClient } = window.supabase;
const _db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== الحجاج =====
const Pilgrims = {
  async getAll() {
    const { data, error } = await _db.from('pilgrims').select('*');
    if (error) throw error;
    return data || [];
  },
  async findByBookingAndId(bookingNum, idNum) {
    const { data, error } = await _db
      .from('pilgrims')
      .select('*')
      .eq('booking_num', String(bookingNum))
      .eq('id_num', String(idNum))
      .single();
    if (error) return null;
    return data;
  },
  async insertMany(pilgrims) {
    const { error } = await _db.from('pilgrims').insert(pilgrims);
    if (error) throw error;
  },
  async deleteAll() {
    const { error } = await _db.from('pilgrims').delete().neq('id', 0);
    if (error) throw error;
  }
};

// ===== التعاميم =====
const Announcements = {
  async getAll() {
    const { data, error } = await _db
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getActive() {
    const { data, error } = await _db
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async insert(ann) {
    const { error } = await _db.from('announcements').insert(ann);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('announcements').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('announcements').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== المخيمات =====
const Camps = {
  async getAll() {
    const { data, error } = await _db.from('camps').select('*');
    if (error) throw error;
    return data || [];
  },
  async insert(camp) {
    const { error } = await _db.from('camps').insert(camp);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('camps').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('camps').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== الأفواج =====
const Groups = {
  async getAll() {
    const { data, error } = await _db.from('groups').select('*');
    if (error) throw error;
    return data || [];
  },
  async insert(group) {
    const { error } = await _db.from('groups').insert(group);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('groups').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('groups').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== الحافلات =====
const Buses = {
  async getAll() {
    const { data, error } = await _db.from('buses').select('*');
    if (error) throw error;
    return data || [];
  },
  async insert(bus) {
    const { error } = await _db.from('buses').insert(bus);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('buses').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('buses').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== مستخدمو النظام =====
const SysUsers = {
  async getAll() {
    const { data, error } = await _db.from('sys_users').select('*');
    if (error) throw error;
    return data || [];
  },
  async findByUsername(username) {
    const { data, error } = await _db
      .from('sys_users')
      .select('*')
      .eq('username', username)
      .single();
    if (error) return null;
    return data;
  },
  async insert(user) {
    const { error } = await _db.from('sys_users').insert(user);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('sys_users').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('sys_users').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== الطلبات =====
const Requests = {
  async getAll() {
    const { data, error } = await _db
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async insert(req) {
    const { error } = await _db.from('requests').insert(req);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('requests').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('requests').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== الموظفون =====
const Staff = {
  async getAll() {
    const { data, error } = await _db.from('staff').select('*');
    if (error) throw error;
    return data || [];
  },
  async insert(member) {
    const { error } = await _db.from('staff').insert(member);
    if (error) throw error;
  },
  async update(id, updates) {
    const { error } = await _db.from('staff').update(updates).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('staff').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== الإعدادات =====
const Settings = {
  async get(key) {
    const { data, error } = await _db
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) return null;
    return data ? JSON.parse(data.value) : null;
  },
  async set(key, value) {
    const { error } = await _db
      .from('settings')
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
    if (error) throw error;
  }
};

// تعريف DB عالمياً
window.DB = { Pilgrims, Announcements, Camps, Groups, Buses, SysUsers, Requests, Staff, Settings };
window.dispatchEvent(new Event('db-ready'));
console.log('✅ Supabase متصل بنجاح');
