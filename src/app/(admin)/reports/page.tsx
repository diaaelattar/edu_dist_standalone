'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Users, School,
  Download, FileText, CheckCircle2, AlertTriangle,
  Printer, Mail, Layers, BookOpen, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAllRuns, getResultsByRun, getSettings, getCurrentMandatoryAssignments } from '@/services/distributionService';
import { DistributionRun, DistributionResult } from '@/types/database';
import { getRankLabel } from '@/lib/distributionAlgorithm';
import {
  settingsToReport, renderHeader, renderOfficials,
  renderManagersTable, renderSignatures, renderGMSignature,
  INSTRUCTIONS, generatePDF, openPrintWindow, ReportSettings, wrapPages,
} from '@/components/reports/reportUtils';

export default function ReportsPage() {
  const [runs, setRuns] = useState<DistributionRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [results, setResults] = useState<DistributionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<ReportSettings | null>(null);
  const [pdfProgress, setPdfProgress] = useState('');
  
  // Filters
  const [filterSpec, setFilterSpec] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [searchSup, setSearchSup] = useState('');
  const [selectedSups, setSelectedSups] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getAllRuns(),
      getSettings(),
    ]).then(([r, s]) => {
      const virtualRun: DistributionRun = {
        id: 'current-mandatory',
        run_name: '⭐ التكليفات الإجبارية الحالية',
        academic_year: s.academic_year || '',
        status: 'draft',
        algorithm_params: {} as any,
        total_assigned: 0,
        total_forced: 0,
        satisfaction_rate: 0,
        created_by: '',
        created_at: new Date().toISOString()
      };
      const allRuns = [virtualRun, ...r];
      setRuns(allRuns);
      if (allRuns.length > 0) setSelectedRun(allRuns[0].id);
      setCfg(settingsToReport(s));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRun) {
      if (selectedRun === 'current-mandatory') {
        getCurrentMandatoryAssignments().then(setResults);
      } else {
        getResultsByRun(selectedRun).then(setResults);
      }
    }
  }, [selectedRun]);

  const run = runs.find(r => r.id === selectedRun);

  // ═══════ Stats ═══════
  const byWish = [1, 2, 3, 4, 0].map(rank => ({
    label: getRankLabel(rank),
    count: results.filter(r => r.rank_achieved === rank).length,
    color: rank === 1 ? '#34d399' : rank === 2 ? '#22d3ee' : rank === 3 ? '#a78bfa' : rank === 4 ? '#60a5fa' : '#fbbf24',
  }));
  const maxCount = Math.max(...byWish.map(b => b.count), 1);

  const bySpecialty = Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      const spec = r.supervisor?.specialty ?? 'غير محدد';
      acc[spec] = (acc[spec] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const uniqueSpecs = Array.from(new Set(results.map(r => r.supervisor?.specialty).filter(Boolean))).sort() as string[];
  const uniqueStages = Array.from(new Set(results.map(r => r.school?.stage).filter(Boolean))).sort() as string[];

  const filteredSups = results
    .map(r => r.supervisor)
    .filter((s, i, arr) => s && arr.findIndex(x => x?.id === s.id) === i)
    .filter(s => (s?.name ?? '').includes(searchSup));

  // ═══════ Export CSV ═══════
  const exportCSV = () => {
    const headers = ['الموجه', 'التخصص', 'المرحلة', 'المدرسة', 'الرغبة المحققة', 'النقاط'];
    const rows = results.map(r => [
      r.supervisor?.name ?? '',
      r.supervisor?.specialty ?? '',
      r.supervisor?.stage ?? '',
      r.school?.school_name ?? '',
      getRankLabel(r.rank_achieved),
      r.final_score?.toFixed(1) ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `توزيع_${run?.run_name ?? 'نتائج'}.csv`;
    a.click();
  };

  // ═══════ Individual Letters ═══════
  const printIndividualLetters = async () => {
    if (!cfg || results.length === 0) return toast.error('لا توجد نتائج');
    const targetResults = selectedSups.length > 0 
      ? results.filter(r => r.supervisor && selectedSups.includes(r.supervisor.id))
      : results.filter(r => r.supervisor);

    if (targetResults.length === 0) return toast.error('لم يتم العثور على خطابات للطباعة بناءً على الاختيار');

    const pages = targetResults.filter(r => r.school).map(r => {
      const supName = r.supervisor?.name ?? '';
      const schoolName = r.school?.school_name ?? '';
      const specialty = r.supervisor?.specialty ?? '';
      const phone = r.supervisor?.phone ?? '';
      return `
        ${renderHeader(cfg, 'خطاب تكليف الموجه المقيم', `لمتابعة امتحانات النقل | ${cfg.semester} ${cfg.academicYear}`)}
        ${renderOfficials(cfg)}
        <div class="sup-card">
          <p style="font-weight:700; margin-bottom:6px;">
            السيد / <span style="border-bottom:1px dashed #000; padding:0 8px;">${supName}</span>
            &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000; padding:0 8px;">${specialty}</span>
            ${phone ? `&nbsp;&nbsp; تليفون: <span dir="ltr" style="font-weight:700;">${phone}</span>` : ''}
          </p>
          <p style="text-align:center; font-weight:700; margin:8px 0;">تم تكليفكم لمتابعة امتحانات ${cfg.semester} ${cfg.academicYear} لصفوف النقل بمدرسة:</p>
          <p style="text-align:center;"><span class="school-box">${schoolName}</span></p>
          <p style="text-align:center; font-size:10px; text-decoration:underline; margin-top:4px;">وحسب مواعيد جدول امتحانات الصفوف الموجودة بالمدرسة</p>
        </div>
        <p style="font-weight:700; margin:6px 0;">ويراعى الالتزام بما يلى:</p>
        <ol class="instructions" dir="rtl">${INSTRUCTIONS.map(i => `<li>${i}</li>`).join('')}</ol>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px;">
          <div style="font-size:11px;">
            <p style="font-weight:700; text-decoration:underline; margin-bottom:5px;">توقيع الموجه</p>
            <p>الاسم: .................................</p>
            <p>الوظيفة: ................................</p>
            <p>رقم التليفون: ...........................</p>
            <p>التوقيع: .................................</p>
          </div>
          ${renderManagersTable(cfg)}
        </div>
        ${renderSignatures(cfg)}
      `;
    });
    try {
      await generatePDF(wrapPages(pages), `خطابات_تكليف_${run?.run_name ?? 'التوزيع'}.pdf`, setPdfProgress);
      toast.success('تم إنشاء ملف PDF بنجاح');
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };

  // ═══════ Guidance Sheets (per specialty) ═══════
  const printGuidanceSheets = async () => {
    if (!cfg || results.length === 0) return toast.error('لا توجد نتائج');
    
    // Apply filters
    const targetResults = results.filter(r => {
      if (filterSpec && r.supervisor?.specialty !== filterSpec) return false;
      if (filterStage && r.school?.stage !== filterStage) return false;
      return true;
    });

    if (targetResults.length === 0) return toast.error('لا توجد نتائج تطابق هذه التصفية');

    const groups: Record<string, DistributionResult[]> = {};
    targetResults.forEach(r => {
      const spec = r.supervisor?.specialty ?? 'غير محدد';
      if (!groups[spec]) groups[spec] = [];
      groups[spec].push(r);
    });
    const pages = Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
      .map(([spec, items]) => {
        items.sort((a, b) => (a.school?.school_name ?? '').localeCompare(b.school?.school_name ?? '', 'ar'));
        const rows = items.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td style="text-align:right; font-weight:600;">${r.school?.school_name ?? ''}</td>
            <td style="font-size:10px; color:#555;">${r.school?.school_type ?? ''}</td>
            <td>${r.supervisor?.name ?? ''}</td>
            <td dir="ltr">${r.supervisor?.phone ?? '—'}</td>
          </tr>`);
        return `
          ${renderHeader(cfg, `كشف الموجهين — توجيه ${spec}`, `${cfg.semester} ${cfg.academicYear}`)}
          <table class="data-tbl">
            <thead><tr>
              <th style="width:35px;">م</th>
              <th>اسم المدرسة</th>
              <th style="width:80px;">النوع</th>
              <th style="width:180px;">اسم الموجه</th>
              <th style="width:110px;">التليفون</th>
            </tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
          ${renderGMSignature(cfg)}
        `;
      });
    try {
      await generatePDF(wrapPages(pages), `كشوف_التوجيه_${run?.run_name ?? ''}.pdf`, setPdfProgress);
      toast.success('تم إنشاء PDF بنجاح');
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };

  // ═══════ Stage Sheets — one page per (stage × type) group ═══════
  const printStageSheets = async () => {
    if (!cfg || results.length === 0) return toast.error('لا توجد نتائج');

    // ① Group by stage, then by official vs private
    const groupMap = new Map<string, DistributionResult[]>();

    results.forEach(r => {
      const stage = r.school?.stage ?? 'غير محددة';
      const type  = r.school?.school_type ?? '';

      // Classify school type
      const isOfficial = ['حكومي','رسمي','رسمى','ثقافي','ثقافى','تجريبي','تجريبى']
        .some(k => type.includes(k));
      const isLanguage = type.includes('لغات');
      const isPrivate  = !isOfficial;

      let groupKey: string;
      if (isLanguage) {
        groupKey = `${stage} — لغات`;
      } else if (isOfficial) {
        groupKey = `${stage} — حكومي / رسمي`;
      } else {
        groupKey = `${stage} — خاص / دولي`;
      }

      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push(r);
    });

    if (groupMap.size === 0) return toast.error('لا توجد نتائج لكشوف المراحل');

    // ② Sort groups by stage name then by label
    const sortedGroups = Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ar'));

    // ③ Build one page per group — identical structure to printGuidanceSheets
    const pages = sortedGroups.map(([groupLabel, items]) => {
      items.sort((a, b) =>
        (a.school?.school_name ?? '').localeCompare(b.school?.school_name ?? '', 'ar')
      );

      const rows = items.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right; font-weight:600;">${r.school?.school_name ?? ''}</td>
          <td style="font-size:10px; color:#555;">${r.school?.school_type ?? ''}</td>
          <td>${r.supervisor?.name ?? ''}</td>
          <td>${r.supervisor?.specialty ?? ''}</td>
          <td dir="ltr">${r.supervisor?.phone ?? '—'}</td>
        </tr>`).join('');

      return `
        ${renderHeader(cfg, `كشف توزيع الموجهين — ${groupLabel}`, `${cfg.semester} ${cfg.academicYear}`)}
        <div style="margin:6px 0; font-size:11px; color:#444; border:1px solid #ccc; padding:4px 10px; border-radius:3px; display:inline-block;">
          إجمالي المدارس: <strong>${items.length}</strong>
        </div>
        <table class="data-tbl">
          <thead><tr>
            <th style="width:35px;">م</th>
            <th>اسم المدرسة</th>
            <th style="width:80px;">النوع</th>
            <th style="width:170px;">اسم الموجه</th>
            <th style="width:90px;">التخصص</th>
            <th style="width:110px;">التليفون</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${renderGMSignature(cfg)}
      `;
    });

    try {
      await generatePDF(wrapPages(pages), `كشوف_المراحل_${run?.run_name ?? ''}.pdf`, setPdfProgress);
      toast.success(`تم إنشاء كشوف ${sortedGroups.length} مجموعة بنجاح`);
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };


  // ═══════ Blank Letter ═══════
  const printBlankLetter = async () => {
    if (!cfg) return toast.error('لم يتم تحميل الإعدادات');
    const page = `
      ${renderHeader(cfg, 'خطاب تكليف الموجه المقيم', `لمتابعة امتحانات النقل | ${cfg.semester} ${cfg.academicYear}`)}
      ${renderOfficials(cfg)}
      <div class="sup-card">
        <p style="font-weight:700; margin-bottom:6px;">السيد / <span style="border-bottom:1px dashed #000; padding:0 40px;"></span> &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000; padding:0 40px;"></span></p>
        <p style="text-align:center; font-weight:700; margin:8px 0;">تم تكليفكم لمتابعة امتحانات ${cfg.semester} ${cfg.academicYear} لصفوف النقل بمدرسة:</p>
        <p style="text-align:center;"><span class="school-box" style="min-width:200px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
      </div>
      <p style="font-weight:700; margin:6px 0;">ويراعى الالتزام بما يلى:</p>
      <ol class="instructions">${INSTRUCTIONS.map(i => `<li>${i}</li>`).join('')}</ol>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px;">
        <div style="font-size:11px;">
          <p style="font-weight:700; text-decoration:underline;">توقيع الموجه</p>
          <p>الاسم: .................................</p><p>الوظيفة: ................................</p>
          <p>رقم التليفون: ...........................</p><p>التوقيع: .................................</p>
        </div>
        ${renderManagersTable(cfg)}
      </div>
      ${renderSignatures(cfg)}
    `;
    try {
      await generatePDF(wrapPages([page]), 'خطاب_تكليف_فارغ.pdf', setPdfProgress);
      toast.success('تم إنشاء PDF بنجاح');
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">التقارير والإحصائيات</h1>
          <p className="page-subtitle">تحليل شامل لنتائج التوزيع وطباعة الكشوف الرسمية</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-input" style={{ width: 220 }}
            value={selectedRun} onChange={e => setSelectedRun(e.target.value)}>
            {runs.map(r => <option key={r.id} value={r.id}>{r.run_name}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportCSV} disabled={results.length === 0}>
            <Download size={14} /> تصدير CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 120, padding: 20 }}>
              <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 32, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : !run ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
          <BarChart3 size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          لا توجد عمليات توزيع بعد. قم بتشغيل التوزيع أولاً.
        </div>
      ) : (
        <>
          {/* ═══════ PDF BUTTONS & FILTERS ═══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Letters Print Card */}
            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Mail size={16} color="#22d3ee" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>طباعة خطابات التكليف</h3>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="بحث عن موجه..." 
                  value={searchSup} 
                  onChange={e => setSearchSup(e.target.value)} 
                  style={{ width: '100%', marginBottom: 8, padding: '6px 12px', fontSize: 12 }}
                />
                <div style={{ maxHeight: 120, overflowY: 'auto', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: 8 }}>
                  {filteredSups.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 10 }}>لا يوجد تطابق</div>
                  ) : (
                    filteredSups.map(sup => sup && (
                      <label key={sup.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedSups.includes(sup.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSups(prev => [...prev, sup.id]);
                            else setSelectedSups(prev => prev.filter(id => id !== sup.id));
                          }}
                        />
                        {sup.name} <span style={{ color: '#64748b', fontSize: 10 }}>({sup.specialty})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setSelectedSups(filteredSups.map(s => s?.id).filter(Boolean) as string[])}>تحديد الكل</button>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setSelectedSups([])}>إلغاء التحديد</button>
              </div>
              
              <button className="btn-primary" onClick={printIndividualLetters} disabled={!!pdfProgress} style={{ width: '100%', marginTop: 12, padding: '8px 16px', fontSize: 13 }}>
                <Printer size={14} /> طباعة {selectedSups.length > 0 ? `(${selectedSups.length} محددين)` : '(الكل)'}
              </button>
            </div>

            {/* Other Reports Card */}
            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BookOpen size={16} color="#a78bfa" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>طباعة الكشوف المجمعة</h3>
              </div>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select className="form-input" style={{ flex: 1, fontSize: 12 }} value={filterSpec} onChange={e => setFilterSpec(e.target.value)}>
                  <option value="">كل التخصصات</option>
                  {uniqueSpecs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="form-input" style={{ flex: 1, fontSize: 12 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                  <option value="">كل المراحل</option>
                  {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button className="btn-primary" onClick={printGuidanceSheets} disabled={!!pdfProgress} style={{ width: '100%', marginBottom: 12, padding: '8px 16px', fontSize: 13, background: 'linear-gradient(135deg,#a78bfa,#818cf8)' }}>
                <Printer size={14} /> طباعة كشوف التوجيه المفلترة
              </button>

              <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '12px 0' }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={printStageSheets} disabled={!!pdfProgress} style={{ flex: 1, padding: '8px', fontSize: 12, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)' }}>
                  <Layers size={14} /> كشوف المراحل
                </button>
                <button className="btn-secondary" onClick={printBlankLetter} disabled={!!pdfProgress} style={{ flex: 1, padding: '8px', fontSize: 12 }}>
                  <FileSpreadsheet size={14} /> خطاب فارغ
                </button>
              </div>
            </div>
          </div>
          
          {pdfProgress && (
            <div className="glass-card glass-card-accent" style={{ padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#22d3ee', fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: '2px solid #22d3ee', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {pdfProgress}
            </div>
          )}

          {/* ═══════ SUMMARY CARDS ═══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'إجمالي التوزيعات', value: results.length, icon: Users, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
              { label: 'توزيع بالرغبة الأولى', value: results.filter(r => r.rank_achieved === 1).length, icon: CheckCircle2, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
              { label: 'توزيع اضطراري', value: results.filter(r => r.rank_achieved === 0).length, icon: AlertTriangle, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
              { label: 'نسبة الرضا', value: run.satisfaction_rate + '%', icon: TrendingUp, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
              { label: 'متوسط النقاط', value: results.length > 0 ? (results.reduce((s, r) => s + (r.final_score ?? 0), 0) / results.length).toFixed(1) : '—', icon: BarChart3, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
              { label: 'مدارس مغطاة', value: new Set(results.map(r => r.assigned_school_id)).size, icon: School, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
            ].map((stat, i) => (
              <div key={i} className="glass-card stat-card">
                <div className="stat-icon" style={{ background: stat.bg }}>
                  <stat.icon size={18} color={stat.color} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 600 }}>{stat.label}</p>
                  <h3 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Wish Distribution */}
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="#22d3ee" /> توزيع الرغبات
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {byWish.map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.count}</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(item.count / maxCount) * 100}%`, background: item.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Specialty */}
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#a78bfa" /> توزيع التخصصات
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {bySpecialty.map(([spec, count]) => (
                  <div key={spec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{spec}</span>
                    <span className="badge badge-purple">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Results Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color="#22d3ee" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>كشف التوزيع الكامل</h3>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, background: '#0d1526', zIndex: 1 }}>
                  <tr>
                    <th>#</th>
                    <th>الموجه</th>
                    <th>التخصص</th>
                    <th>المرحلة</th>
                    <th>المدرسة الموزع عليها</th>
                    <th>الرغبة المحققة</th>
                    <th>النقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => (
                    <tr key={res.id}>
                      <td style={{ color: '#475569', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{res.supervisor?.name}</td>
                      <td style={{ color: '#94a3b8', fontSize: 13 }}>{res.supervisor?.specialty}</td>
                      <td style={{ color: '#94a3b8', fontSize: 13 }}>{res.supervisor?.stage}</td>
                      <td style={{ color: '#94a3b8', fontSize: 13 }}>{res.school?.school_name}</td>
                      <td>
                        <span className={`badge ${
                          res.rank_achieved === 1 ? 'badge-green' :
                          res.rank_achieved === 2 ? 'badge-cyan' :
                          res.rank_achieved === 3 ? 'badge-purple' :
                          res.rank_achieved === 4 ? 'badge-blue' : 'badge-amber'
                        }`}>{getRankLabel(res.rank_achieved)}</span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                        {res.final_score?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
