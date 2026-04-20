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
  async update(id, updates) {
    const { error } = await _db.from('pilgrims').update(updates).eq('id', id);
    if (error) throw error;
  },
  async bulkUpdate(ids, updates) {
    const { error } = await _db.from('pilgrims').update(updates).in('id', ids);
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
      .maybeSingle();
    if (error) return null;
    return data ? JSON.parse(data.value) : null;
  },
  async set(key, value) {
    const { error } = await _db
      .from('settings')
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
    if (error) throw error;
  },
  async delete(key) {
    const { error } = await _db.from('settings').delete().eq('key', key);
    if (error) throw error;
  }
};

// ===== الاستبيانات =====
const Surveys = {
  async getAll() {
    const { data, error } = await _db
      .from('surveys')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  async getActive() {
    const { data, error } = await _db
      .from('surveys')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    if (error) throw error;
    const now = new Date();
    return (data || []).filter(s => {
      if (s.start_date && new Date(s.start_date) > now) return false;
      if (s.end_date && new Date(s.end_date) <= now) return false;
      return true;
    });
  },
  async getById(id) {
    const { data, error } = await _db.from('surveys').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },
  async create(data) {
    const { data: inserted, error } = await _db.from('surveys').insert(data).select().single();
    if (error) throw error;
    return inserted;
  },
  async update(id, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { error } = await _db.from('surveys').update(payload).eq('id', id);
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _db.from('surveys').delete().eq('id', id);
    if (error) throw error;
  },
  async getQuestions(surveyId) {
    const { data, error } = await _db
      .from('survey_questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  async addQuestion(surveyId, question) {
    const payload = { ...question, survey_id: surveyId };
    const { data, error } = await _db.from('survey_questions').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateQuestion(id, updates) {
    const { error } = await _db.from('survey_questions').update(updates).eq('id', id);
    if (error) throw error;
  },
  async deleteQuestion(id) {
    const { error } = await _db.from('survey_questions').delete().eq('id', id);
    if (error) throw error;
  },
  async submitResponse(response) {
    const { data, error } = await _db.from('survey_responses').insert(response).select().single();
    if (error) throw error;
    return data;
  },
  async getResponses(surveyId) {
    const { data, error } = await _db
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getAllResponseCountsBySurvey() {
    const { data, error } = await _db.from('survey_responses').select('survey_id');
    if (error) throw error;
    const counts = {};
    (data || []).forEach(r => { counts[r.survey_id] = (counts[r.survey_id] || 0) + 1; });
    return counts;
  },
  async getMyResponse(surveyId, pilgrimId, date) {
    let q = _db.from('survey_responses').select('*').eq('survey_id', surveyId).eq('pilgrim_id', pilgrimId);
    if (date) q = q.eq('response_date', date);
    const { data, error } = await q;
    if (error) return null;
    return data && data.length ? data : null;
  },
  async getResponsesByPilgrim(pilgrimId) {
    const { data, error } = await _db
      .from('survey_responses')
      .select('*')
      .eq('pilgrim_id', pilgrimId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getStats(surveyId) {
    const [questions, responses] = await Promise.all([
      this.getQuestions(surveyId),
      this.getResponses(surveyId)
    ]);
    const stats = { total_responses: responses.length, questions: {} };
    for (const q of questions) {
      const answers = responses
        .map(r => r.answers && r.answers[q.id])
        .filter(v => v !== undefined && v !== null && v !== '');
      if (q.question_type === 'rating') {
        const nums = answers.map(Number).filter(n => !isNaN(n));
        const sum = nums.reduce((s, n) => s + n, 0);
        stats.questions[q.id] = {
          type: 'rating',
          count: nums.length,
          avg: nums.length ? (sum / nums.length) : 0,
          distribution: [1,2,3,4,5].reduce((d, s) => { d[s] = nums.filter(n => n === s).length; return d; }, {})
        };
      } else if (q.question_type === 'single' || q.question_type === 'multiple') {
        const counts = {};
        for (const a of answers) {
          const arr = Array.isArray(a) ? a : [a];
          for (const v of arr) counts[v] = (counts[v] || 0) + 1;
        }
        stats.questions[q.id] = { type: q.question_type, count: answers.length, counts };
      } else if (q.question_type === 'text') {
        stats.questions[q.id] = { type: 'text', count: answers.length, samples: answers };
      }
    }
    return stats;
  }
};

// ===== سجلّ التدقيق (Audit Log) =====
const Audit = {
  async log(entry) {
    const { error } = await _db.from('audit_log').insert(entry);
    if (error) throw error;
  },
  async getAll(filters) {
    // skeleton — يُستخدم في v17.1 (لوحة UI للسجلّ)
    const { data, error } = await _db
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  },
  async getByEntity(entityType, entityId) {
    // skeleton — للاستعلامات السياقية في v17.2
    const { data, error } = await _db
      .from('audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', String(entityId))
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async markUndone(id, undoneBy) {
    // skeleton — للـ undo الموسَّع في v17.2
    const { error } = await _db
      .from('audit_log')
      .update({ undone: true, undone_at: new Date().toISOString(), undone_by: undoneBy })
      .eq('id', id);
    if (error) throw error;
  }
};

// تعريف DB عالمياً
window.DB = { Pilgrims, Announcements, Camps, Groups, Buses, SysUsers, Requests, Staff, Settings, Surveys, Audit };
window.dispatchEvent(new Event('db-ready'));
console.log('✅ Supabase متصل بنجاح');
