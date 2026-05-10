'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, User, Shield, BookOpen, Key } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAllUsers, createUser, updateUser, deleteUser, getUniqueSpecialties } from '@/services/distributionService';
// import { SPECIALIZATIONS } from '@/types/database'; // We'll use dynamic specs instead

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    username: '',
    password_hash: '',
    role: 'guidance',
    specialty: 'عام'
  });
  const [saving, setSaving] = useState(false);
  const [specs, setSpecs] = useState<string[]>(['عام']);
  const [showManualSpec, setShowManualSpec] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, specsData] = await Promise.all([
        getAllUsers(),
        getUniqueSpecialties()
      ]);
      setUsers(usersData || []);
      setSpecs(specsData);
      if (!form.specialty && specsData.length > 0) {
        setForm(f => ({ ...f, specialty: specsData[0] }));
      }
    } catch (e: any) {
      toast.error('خطأ في تحميل المستخدمين: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => 
    u.username.includes(search) || (u.specialty || '').includes(search)
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password_hash: '', role: 'guidance', specialty: specs[0] || 'عام' });
    setShowManualSpec(false);
    setShowModal(true);
  };

  const openEdit = (user: any) => {
    setEditing(user);
    setForm({
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      specialty: user.specialty || (specs[0] || 'عام')
    });
    setShowManualSpec(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.password_hash.trim()) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, form);
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await createUser(form);
        toast.success('تم إضافة المستخدم بنجاح');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: any) => {
    if (user.username === 'admin') {
      toast.error('لا يمكن حذف المستخدم الرئيسي');
      return;
    }
    if (!confirm(`هل تريد حذف المستخدم "${user.username}"؟`)) return;
    try {
      await deleteUser(user.id);
      toast.success('تم حذف المستخدم');
      load();
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">إدارة المستخدمين</h1>
          <p className="page-subtitle">إدارة حسابات الأدمن ومسؤولي التوجيه</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> إضافة مستخدم جديد
        </button>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input 
            className="form-input" 
            style={{ paddingRight: 36 }}
            placeholder="بحث باسم المستخدم أو التخصص..."
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>اسم المستخدم</th>
              <th>الدور</th>
              <th>التخصص (للتوجيه)</th>
              <th>تاريخ الإنشاء</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14 }} /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: '#475569' }}>لا توجد نتائج</td></tr>
            ) : (
              filtered.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={14} color="#94a3b8" />
                      {user.username}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-cyan' : 'badge-purple'}`}>
                      {user.role === 'admin' ? 'أدمن' : 'مسؤول توجيه'}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>
                    {user.role === 'guidance' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookOpen size={13} />
                        {user.specialty}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {new Date(user.created_at).toLocaleDateString('ar-EG')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(user)} style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <Pencil size={12} /> تعديل
                      </button>
                      {user.username !== 'admin' && (
                        <button className="btn-danger" onClick={() => handleDelete(user)} style={{ padding: '6px 12px' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 800 }}>
              {editing ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">اسم المستخدم</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="form-input" 
                    style={{ paddingRight: 36 }}
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  />
                  <User size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                </div>
              </div>

              <div>
                <label className="form-label">كلمة المرور</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="form-input" 
                    style={{ paddingRight: 36 }}
                    type="text"
                    value={form.password_hash}
                    onChange={e => setForm(f => ({ ...f, password_hash: e.target.value }))}
                  />
                  <Key size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                </div>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>ملاحظة: يتم تخزين كلمة المرور كما هي حالياً (للتجربة)</p>
              </div>

              <div>
                <label className="form-label">الدور (الصلاحية)</label>
                <div style={{ position: 'relative' }}>
                  <select 
                    className="form-input"
                    style={{ paddingRight: 36 }}
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value, specialty: e.target.value === 'admin' ? '' : f.specialty }))}
                  >
                    <option value="admin">مدير نظام (Admin)</option>
                    <option value="guidance">مسؤول توجيه (Guidance)</option>
                  </select>
                  <Shield size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                </div>
              </div>

              {form.role === 'guidance' && (
                <div>
                  <label className="form-label">التخصص المسؤول عنه</label>
                  <div style={{ position: 'relative' }}>
                    <select 
                      className="form-input"
                      style={{ paddingRight: 36 }}
                      value={showManualSpec ? 'other' : form.specialty}
                      onChange={e => {
                        if (e.target.value === 'other') {
                          setShowManualSpec(true);
                          setForm(f => ({ ...f, specialty: '' }));
                        } else {
                          setShowManualSpec(false);
                          setForm(f => ({ ...f, specialty: e.target.value }));
                        }
                      }}
                    >
                      {specs.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="other">+ إضافة تخصص/توجيه جديد...</option>
                    </select>
                    <BookOpen size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  </div>
                  {showManualSpec && (
                    <div style={{ marginTop: 8 }}>
                      <input 
                        className="form-input"
                        placeholder="اكتب اسم التوجيه الجديد هنا..."
                        value={form.specialty}
                        onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
