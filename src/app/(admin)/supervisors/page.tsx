'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getAllSupervisorsIncludingInactive, createSupervisor, updateSupervisor, deleteSupervisor, getAllSchools, toggleSupervisorActive, getUniqueSpecialties, getUniqueStages, getAllBaseSchools, updateSupervisorAnnualSchools
} from '@/services/distributionService';
import { Supervisor, SupervisorFormData, School, SCHOOL_TYPES, SUPERVISOR_GRADES, BaseSchool } from '@/types/database';

const EMPTY_FORM: SupervisorFormData = {
  national_id: '',
  name: '',
  specialty: 'عام',
  stage: 'ابتدائي',
  school_type: 'رسمى',
  home_school_id: undefined,
  max_assignments: 1,
  phone: '',
  is_active: true,
  grade: undefined,
  qualification: '',
  appointment_type: 'حكومي',
};

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [baseSchools, setBaseSchools] = useState<BaseSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supervisor | null>(null);
  const [form, setForm] = useState<SupervisorFormData>(EMPTY_FORM);
  const [annualSchools, setAnnualSchools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showManualSpec, setShowManualSpec] = useState(false);
  const [specs, setSpecs] = useState<string[]>(['عام']);
  const [stages, setStages] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sups, schs, baseSchs, specsData, stagesData] = await Promise.all([
        getAllSupervisorsIncludingInactive(),
        getAllSchools(),
        getAllBaseSchools(),
        getUniqueSpecialties(),
        getUniqueStages()
      ]);
      setSupervisors(sups);
      setSchools(schs);
      setBaseSchools(baseSchs);
      setSpecs(specsData);
      setStages(stagesData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = supervisors.filter(s => {
    const matchSearch = s.name.includes(search) || (s.national_id ?? '').includes(search) || (s.phone ?? '').includes(search);
    const matchSpec = specFilter ? s.specialty === specFilter : true;
    const matchStage = stageFilter ? s.stage === stageFilter : true;
    const matchStatus = statusFilter === 'active' ? s.is_active : statusFilter === 'inactive' ? !s.is_active : true;
    return matchSearch && matchSpec && matchStage && matchStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAnnualSchools([]);
    setShowManualSpec(false);
    setShowModal(true);
  };

  const openEdit = (sup: Supervisor) => {
    setEditing(sup);
    setForm({
      national_id: sup.national_id ?? '',
      name: sup.name,
      specialty: sup.specialty,
      stage: sup.stage ?? 'ابتدائي',
      school_type: sup.school_type ?? 'رسمى',
      home_school_id: sup.home_school_id,
      max_assignments: sup.max_assignments ?? 1,
      phone: sup.phone ?? '',
      is_active: sup.is_active,
      grade: sup.grade,
      qualification: sup.qualification ?? '',
      appointment_type: sup.appointment_type ?? 'حكومي',
    });
    setAnnualSchools(sup.annual_schools?.map(s => s.base_school_id) || []);
    setShowManualSpec(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('اسم الموجه مطلوب'); return; }
    setSaving(true);
    try {
      const payload = { ...form, home_school_id: form.home_school_id || undefined };
      if (editing) {
        await updateSupervisor(editing.id, payload);
        await updateSupervisorAnnualSchools(editing.id, annualSchools);
        toast.success('تم تحديث الموجه');
      } else {
        const sup = await createSupervisor(payload);
        await updateSupervisorAnnualSchools(sup.id, annualSchools);
        toast.success('تم إضافة الموجه');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sup: Supervisor) => {
    if (!confirm(`هل تريد حذف "${sup.name}"؟`)) return;
    try {
      await deleteSupervisor(sup.id);
      toast.success('تم الحذف');
      load();
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    }
  };

  const handleToggleActive = async (sup: Supervisor) => {
    const newStatus = !sup.is_active;
    setSupervisors(prev => prev.map(s => s.id === sup.id ? { ...s, is_active: newStatus } : s));
    try {
      await toggleSupervisorActive(sup.id, newStatus);
      toast.success(newStatus ? 'تم تفعيل الموجه' : 'تم تعطيل الموجه');
    } catch (e: any) {
      setSupervisors(prev => prev.map(s => s.id === sup.id ? { ...s, is_active: !newStatus } : s));
      toast.error('خطأ: ' + e.message);
    }
  };

  const activeCount = supervisors.filter(s => s.is_active).length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">إدارة الموجهين</h1>
          <p className="page-subtitle">
            {supervisors.length} موجه مسجّل — {activeCount} متاح / {supervisors.length - activeCount} غير متاح
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> إضافة موجه
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card filters-bar" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200, width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input className="form-input" style={{ paddingRight: 36 }}
            placeholder="بحث بالاسم أو الرقم القومي أو الهاتف..."
            autoComplete="off"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 160, flex: '0 0 auto' }}
          value={specFilter} onChange={e => setSpecFilter(e.target.value)}>
          <option value="">كل التخصصات</option>
          {specs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" style={{ width: 140, flex: '0 0 auto' }}
          value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">كل المراحل</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" style={{ width: 140, flex: '0 0 auto' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">متاح فقط</option>
          <option value="inactive">غير متاح فقط</option>
        </select>
        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>التخصص</th>
                <th>الكادر</th>
                <th>المرحلة</th>
                <th>التليفون</th>
                <th>مدارس المتابعة السنوية</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#475569' }}>
                  لا توجد نتائج مطابقة
                </td></tr>
              ) : (
                filtered.map((sup, idx) => (
                  <tr key={sup.id} style={{ opacity: sup.is_active ? 1 : 0.55 }}>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{sup.name}</div>
                        {sup.national_id && (
                          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{sup.national_id}</div>
                        )}
                      </div>
                    </td>
                    <td><span className="badge badge-purple">{sup.specialty}</span></td>
                    <td>
                      {sup.grade ? (
                        <span className="badge badge-blue">{sup.grade}</span>
                      ) : (
                        <span style={{ color: '#475569', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>{sup.stage ?? '—'}</td>
                    <td>
                      {sup.phone ? (
                        <a href={`tel:${sup.phone}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          color: '#22d3ee', textDecoration: 'none', fontSize: 13,
                          padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(34,211,238,0.08)',
                          border: '1px solid rgba(34,211,238,0.2)',
                        }}>
                          <Phone size={12} />
                          <span dir="ltr">{sup.phone}</span>
                        </a>
                      ) : (
                        <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                        {sup.annual_schools && sup.annual_schools.length > 0 ? (
                          sup.annual_schools.map(as => (
                            <span key={as.id} style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                              color: '#94a3b8', whiteSpace: 'nowrap'
                            }}>
                              {as.base_school?.school_name}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#475569', fontSize: 11 }}>لا يوجد</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button onClick={() => handleToggleActive(sup)} style={{
                        background: sup.is_active ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: sup.is_active ? '#34d399' : '#f87171',
                        fontSize: 12, fontWeight: 600, padding: '4px 8px',
                        borderRadius: 6,
                      }}>
                        {sup.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {sup.is_active ? 'متاح' : 'غير متاح'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(sup)} style={{
                          padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer',
                          fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <Pencil size={12} /> تعديل
                        </button>
                        <button className="btn-danger" style={{ padding: '5px 9px' }} onClick={() => handleDelete(sup)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>
              {editing ? 'تعديل موجه' : 'إضافة موجه جديد'}
            </h3>
            <div className="responsive-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">الاسم الكامل *</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">الرقم القومي</label>
                <input className="form-input" value={form.national_id}
                  onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">رقم التليفون</label>
                <input className="form-input" type="tel" value={form.phone ?? ''}
                  placeholder="01xxxxxxxxx"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">التخصص</label>
                <select className="form-input" value={showManualSpec ? 'other' : form.specialty}
                  onChange={e => {
                    if (e.target.value === 'other') {
                      setShowManualSpec(true);
                      setForm(f => ({ ...f, specialty: '' }));
                    } else {
                      setShowManualSpec(false);
                      setForm(f => ({ ...f, specialty: e.target.value }));
                    }
                  }}>
                  {specs.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="other">+ إضافة تخصص جديد...</option>
                </select>
                {showManualSpec && (
                  <input className="form-input" style={{ marginTop: 8 }}
                    placeholder="اكتب التخصص الجديد..."
                    value={form.specialty}
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    autoFocus />
                )}
              </div>
              <div>
                <label className="form-label">الكادر (الوظيفة)</label>
                <select className="form-input" value={form.grade ?? ''}
                  onChange={e => setForm(f => ({ ...f, grade: (e.target.value || undefined) as any }))}>
                  <option value="">بدون تحديد</option>
                  {SUPERVISOR_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">المؤهل</label>
                <input className="form-input" value={form.qualification ?? ''}
                  onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">نوع التعيين</label>
                <select className="form-input" value={form.appointment_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, appointment_type: e.target.value }))}>
                  <option value="حكومي">حكومي</option>
                  <option value="أجر/حصة">أجر / حصة</option>
                  <option value="عقد">عقد</option>
                </select>
              </div>
              <div>
                <label className="form-label">المرحلة الدراسية</label>
                <select className="form-input" value={form.stage}
                  onChange={e => setForm(f => ({ ...f, stage: e.target.value as any }))}>
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">نوع المدرسة المفضّل</label>
                <select className="form-input" value={form.school_type}
                  onChange={e => setForm(f => ({ ...f, school_type: e.target.value as any }))}>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">مدرسته الأصلية (لا يُوزَّع عليها)</label>
                <select className="form-input" value={form.home_school_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, home_school_id: e.target.value || undefined }))}>
                  <option value="">بدون تحديد</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">مدارس المتابعة السنوية (المدارس الأساسية التي يشرف عليها)</label>
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 12, maxHeight: 150, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  {baseSchools.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#64748b' }}>لا توجد مدارس أساسية مسجلة</span>
                  ) : (
                    baseSchools.map(bs => {
                      const isSelected = annualSchools.includes(bs.id);
                      return (
                        <label key={bs.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input type="checkbox" checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAnnualSchools(prev => [...prev, bs.id]);
                              } else {
                                setAnnualSchools(prev => prev.filter(id => id !== bs.id));
                              }
                            }}
                          />
                          {bs.school_name}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="is_active_chk" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="is_active_chk" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                  متاح للتوزيع
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>إلغاء</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
