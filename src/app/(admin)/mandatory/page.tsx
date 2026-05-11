'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Save, Trash2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAllSchools, updateSchool, getAllSupervisors, getUniqueStages } from '@/services/distributionService';
import { School, Supervisor, SCHOOL_TYPES } from '@/types/database';

export default function MandatoryPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [onlyMandatory, setOnlyMandatory] = useState(false);

  // local edits: schoolId -> supervisorId (or '')
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schs, sups, stagesData] = await Promise.all([getAllSchools(), getAllSupervisors(), getUniqueStages()]);
      setSchools(schs);
      setSupervisors(sups);
      setStages(stagesData);
      // init drafts from existing mandatory_supervisor_id
      const init: Record<string, string> = {};
      schs.forEach(s => { init[s.id] = s.mandatory_supervisor_id ?? ''; });
      setDrafts(init);
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (schoolId: string) => {
    setSaving(schoolId);
    try {
      const supId = drafts[schoolId] || undefined;
      
      // Warning if already assigned elsewhere
      if (supId) {
        const otherAssignments = schools.filter(s => s.mandatory_supervisor_id === supId && s.id !== schoolId);
        if (otherAssignments.length > 0) {
          const supName = supervisors.find(s => s.id === supId)?.name;
          toast(`تنبيه: الموجه ${supName} مُكلَّف بالفعل بمدرسة أخرى (${otherAssignments[0].school_name})`, {
            icon: '⚠️',
            duration: 4000
          });
        }
      }

      await updateSchool(schoolId, { mandatory_supervisor_id: supId });
      // Update local state to reflect saved
      setSchools(prev => prev.map(s => s.id === schoolId
        ? { ...s, mandatory_supervisor_id: supId || undefined }
        : s
      ));
      toast.success('تم حفظ التكليف الإجباري');
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (schoolId: string) => {
    setDrafts(d => ({ ...d, [schoolId]: '' }));
    setSaving(schoolId);
    try {
      await updateSchool(schoolId, { mandatory_supervisor_id: undefined });
      setSchools(prev => prev.map(s => s.id === schoolId
        ? { ...s, mandatory_supervisor_id: undefined }
        : s
      ));
      toast.success('تم إلغاء التكليف');
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const filtered = schools.filter(s => {
    const matchSearch = s.school_name.includes(search) || s.school_code.includes(search);
    const matchStage = stageFilter ? s.stage === stageFilter : true;
    const matchMandatory = onlyMandatory ? !!s.mandatory_supervisor_id : true;
    return matchSearch && matchStage && matchMandatory;
  });

  const mandatoryCount = schools.filter(s => s.mandatory_supervisor_id).length;
  const isDirty = (schoolId: string) => drafts[schoolId] !== (schools.find(s => s.id === schoolId)?.mandatory_supervisor_id ?? '');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">التكليفات الإدارية الإجبارية</h1>
          <p className="page-subtitle">
            تحديد موجه مسبق لمدرسة معينة — سيُجاوَز به نظام الخوارزمية تلقائياً
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '8px 16px', borderRadius: 10,
            background: mandatoryCount > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${mandatoryCount > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: mandatoryCount > 0 ? '#fbbf24' : '#64748b',
            fontSize: 13, fontWeight: 600,
          }}>
            <Zap size={14} style={{ display: 'inline', marginLeft: 6 }} />
            {mandatoryCount} تكليف إجباري نشط
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="glass-card" style={{
        padding: '12px 16px', marginBottom: 16,
        background: 'rgba(251,191,36,0.06)',
        border: '1px solid rgba(251,191,36,0.15)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            <strong style={{ color: '#fbbf24' }}>تكليف إجباري</strong> يعني أن هذا الموجه محدد مسبقاً لهذه المدرسة بقرار إداري، وسيُوزَّع عليها تلقائياً بغض النظر عن رغباته أو نقاطه. يُستخدم للمدارس التي تحتاج موجهاً معيناً بقرار من الوكيل أو المدير العام.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input className="form-input" style={{ paddingRight: 36 }}
            placeholder="بحث باسم المدرسة أو الكود..."
            autoComplete="off"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 150, flex: '0 0 auto' }}
          value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">كل المراحل</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={onlyMandatory}
            onChange={e => setOnlyMandatory(e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          إجبارية فقط
        </label>
        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{filtered.length} مدرسة</span>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الكود</th>
                <th>اسم المدرسة</th>
                <th>المرحلة</th>
                <th>النوع</th>
                <th style={{ minWidth: 260 }}>الموجه المُكلَّف إجبارياً</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#475569' }}>
                  لا توجد مدارس مطابقة
                </td></tr>
              ) : (
                filtered.map((school, idx) => {
                  const currentSup = supervisors.find(s => s.id === school.mandatory_supervisor_id);
                  const draftVal = drafts[school.id] ?? '';
                  const dirty = isDirty(school.id);

                  return (
                    <tr key={school.id} style={{
                      background: school.mandatory_supervisor_id ? 'rgba(251,191,36,0.04)' : 'transparent',
                    }}>
                      <td style={{ color: '#64748b', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>{school.school_code}</td>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>{school.school_name}</td>
                      <td><span className={`badge ${school.stage === 'ابتدائي' ? 'badge-cyan' : school.stage === 'إعدادي' ? 'badge-purple' : 'badge-amber'}`}>{school.stage}</span></td>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>{school.school_type}</td>
                      <td>
                        <select
                          className="form-input"
                          style={{
                            fontSize: 13,
                            borderColor: dirty ? 'rgba(251,191,36,0.5)' : undefined,
                            background: dirty ? 'rgba(251,191,36,0.05)' : undefined,
                          }}
                          value={draftVal}
                          onChange={e => setDrafts(d => ({ ...d, [school.id]: e.target.value }))}
                        >
                          <option value="">— بدون تكليف إجباري —</option>
                           {supervisors.map(s => {
                             const count = schools.filter(sch => sch.mandatory_supervisor_id === s.id).length;
                             return (
                               <option key={s.id} value={s.id}>
                                 {s.name} — {s.specialty} {count > 0 ? `(مُكلَّف بـ ${count} مدرسة)` : ''}
                               </option>
                             );
                           })}
                        </select>
                      </td>
                      <td>
                        {school.mandatory_supervisor_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
                            <CheckCircle2 size={13} />
                            مُكلَّف
                          </div>
                        ) : (
                          <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {dirty && (
                            <button
                              className="btn-primary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                              onClick={() => handleSave(school.id)}
                              disabled={saving === school.id}
                            >
                              <Save size={12} />
                              {saving === school.id ? '...' : 'حفظ'}
                            </button>
                          )}
                          {school.mandatory_supervisor_id && !dirty && (
                            <button
                              style={{
                                padding: '5px 10px', borderRadius: 7,
                                border: '1px solid rgba(248,113,113,0.25)',
                                background: 'rgba(248,113,113,0.08)',
                                color: '#f87171', cursor: 'pointer', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                              onClick={() => handleClear(school.id)}
                              disabled={saving === school.id}
                            >
                              <Trash2 size={11} /> إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
