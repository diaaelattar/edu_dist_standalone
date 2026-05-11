import { writeFileSync } from 'fs';
import { join } from 'path';

const page = `'use client';

import { useState, useEffect } from 'react';
import { Users, School, Printer, Download, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getReportsData } from '@/actions/reportsActions';
import { getSettings } from '@/services/distributionService';
import {
  settingsToReport, renderHeader, renderGMSignature,
  BASE_STYLES, wrapPages, INSTRUCTIONS,
  renderOfficials, renderManagersTable, renderSignatures,
  generatePDF, ReportSettings
} from '@/components/reports/reportUtils';
import { toast } from 'react-hot-toast';

type Tab = 'distribution' | 'unassigned' | 'noSupervisor';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('distribution');
  const [data, setData] = useState<any>(null);
  const [cfg, setCfg] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfProgress, setPdfProgress] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [filterStage, setFilterStage] = useState('');

  useEffect(() => {
    Promise.all([getReportsData(), getSettings()]).then(([d, s]) => {
      setData(d);
      setCfg(settingsToReport(s));
    }).finally(() => setLoading(false));
  }, []);

  // Unassigned supervisors filtered
  const unassigned = (data?.unassignedSupervisors ?? []).filter((s: any) => {
    if (filterSpec && s.specialty !== filterSpec) return false;
    return true;
  });

  const noSup = (data?.schoolsWithoutSupervisor ?? []).filter((s: any) => {
    if (filterStage && s.stage !== filterStage) return false;
    return true;
  });

  const uniqueSpecs = Array.from(new Set((data?.unassignedSupervisors ?? []).map((s: any) => s.specialty).filter(Boolean))).sort() as string[];
  const uniqueStages = Array.from(new Set((data?.schoolsWithoutSupervisor ?? []).map((s: any) => s.stage).filter(Boolean))).sort() as string[];

  // Print unassigned supervisors PDF
  const printUnassigned = async () => {
    if (!cfg) return;
    const items = unassigned;
    if (items.length === 0) return toast.error('لا يوجد موجهون غير مكلفون');
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = items.map((s: any, i: number) => \`
      <tr>
        <td>\${i + 1}</td>
        <td style="text-align:right;font-weight:700;">\${s.name}</td>
        <td>\${s.specialty}</td>
        <td>\${s.stage ?? '—'}</td>
        <td>\${s.grade ?? '—'}</td>
        <td dir="ltr">\${s.phone ?? '—'}</td>
        <td>\${s.national_id ?? '—'}</td>
      </tr>\`).join('');

    const page = \`
      \${renderHeader(cfg, 'كشف الموجهين غير المكلفين', 'المتاحون للاستعانة بهم في توزيع الامتحانات')}
      <div style="margin:6px 0;display:flex;gap:16px;font-size:11px;border:1px solid #ccc;padding:6px 12px;border-radius:4px;background:#f9fbff;">
        <span>إجمالي الموجهين النشطين: <strong>\${data.totalSupervisors}</strong></span>
        <span>المكلفون حالياً: <strong>\${data.totalSupervisors - data.unassignedSupervisors.length}</strong></span>
        <span style="color:#c00;font-weight:700;">غير المكلفين: <strong>\${data.unassignedSupervisors.length}</strong></span>
        \${filterSpec ? \`<span>التخصص: <strong>\${filterSpec}</strong></span>\` : ''}
      </div>
      <table class="data-tbl">
        <thead><tr>
          <th style="width:35px;">م</th>
          <th>اسم الموجه</th>
          <th style="width:120px;">التخصص</th>
          <th style="width:80px;">المرحلة</th>
          <th style="width:100px;">الدرجة الوظيفية</th>
          <th style="width:110px;">التليفون</th>
          <th style="width:120px;">الرقم القومي</th>
        </tr></thead>
        <tbody>\${rows}</tbody>
      </table>
      \${renderGMSignature(cfg)}
    \`;
    try {
      await generatePDF(wrapPages([page]), \`كشف_الموجهين_غير_المكلفين_\${today}.pdf\`, setPdfProgress);
      toast.success('تم إنشاء PDF بنجاح');
    } catch { toast.error('خطأ في PDF'); setPdfProgress(''); }
  };

  // Print schools without supervisor PDF
  const printNoSupervisor = async () => {
    if (!cfg) return;
    const items = noSup;
    if (items.length === 0) return toast.error('جميع المدارس لديها موجه مقيم');
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    // Group by stage
    const groups: Record<string, typeof items> = {};
    items.forEach((s: any) => {
      const key = s.stage ?? 'غير محددة';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    const pages = Object.entries(groups).map(([stage, list]) => {
      const rows = (list as any[]).map((s: any, i: number) => \`
        <tr>
          <td>\${i + 1}</td>
          <td style="text-align:right;font-weight:700;">\${s.school_name}</td>
          <td>\${s.school_code ?? '—'}</td>
          <td>\${s.school_type}</td>
          <td>\${s.specialization ?? '—'}</td>
          <td>\${s.needs_count}</td>
          <td>\${s.address ?? '—'}</td>
        </tr>\`).join('');
      return \`
        \${renderHeader(cfg, \`كشف المدارس بدون موجه مقيم — \${stage}\`, 'المدارس التي لم يُخصص لها موجه مقيم حتى الآن')}
        <div style="margin:6px 0;display:flex;gap:16px;font-size:11px;border:1px solid #ccc;padding:6px 12px;border-radius:4px;background:#fff8f8;">
          <span>المرحلة: <strong>\${stage}</strong></span>
          <span style="color:#c00;font-weight:700;">عدد المدارس: <strong>\${list.length}</strong></span>
          \${filterStage ? '' : \`<span>الإجمالي الكلي: <strong>\${data.schoolsWithoutSupervisor.length}</strong></span>\`}
        </div>
        <table class="data-tbl">
          <thead><tr>
            <th style="width:35px;">م</th>
            <th>اسم المدرسة</th>
            <th style="width:80px;">الكود</th>
            <th style="width:90px;">النوع</th>
            <th style="width:100px;">التخصص</th>
            <th style="width:55px;">العدد</th>
            <th>العنوان</th>
          </tr></thead>
          <tbody>\${rows}</tbody>
        </table>
        \${renderGMSignature(cfg)}
      \`;
    });
    try {
      await generatePDF(wrapPages(pages), \`كشف_المدارس_بدون_موجه_\${today}.pdf\`, setPdfProgress);
      toast.success(\`تم إنشاء \${pages.length} صفحة بنجاح\`);
    } catch { toast.error('خطأ في PDF'); setPdfProgress(''); }
  };

  // Print assignment letters for unassigned supervisors (blank slots)
  const printAssignmentLetters = async () => {
    if (!cfg) return;
    const items = unassigned;
    if (items.length === 0) return toast.error('لا يوجد موجهون لطباعة خطاباتهم');
    const pages = items.map((s: any) => \`
      \${renderHeader(cfg, 'خطاب تكليف الموجه المقيم', \`لمتابعة امتحانات النقل | \${cfg.semester} \${cfg.academicYear}\`)}
      \${renderOfficials(cfg)}
      <div class="sup-card">
        <p style="font-weight:700;margin-bottom:6px;">
          السيد / <span style="border-bottom:1px dashed #000;padding:0 8px;">\${s.name}</span>
          &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000;padding:0 8px;">\${s.specialty}</span>
          \${s.phone ? \`&nbsp;&nbsp; تليفون: <span dir="ltr" style="font-weight:700;">\${s.phone}</span>\` : ''}
        </p>
        <p style="text-align:center;font-weight:700;margin:8px 0;">تم تكليفكم لمتابعة امتحانات \${cfg.semester} \${cfg.academicYear} لصفوف النقل بمدرسة:</p>
        <p style="text-align:center;"><span class="school-box" style="min-width:220px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
        <p style="text-align:center;font-size:10px;text-decoration:underline;margin-top:4px;">وحسب مواعيد جدول امتحانات الصفوف الموجودة بالمدرسة</p>
      </div>
      <p style="font-weight:700;margin:6px 0;">ويراعى الالتزام بما يلى:</p>
      <ol class="instructions" dir="rtl">\${INSTRUCTIONS.map(i => \`<li>\${i}</li>\`).join('')}</ol>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
        <div style="font-size:11px;">
          <p style="font-weight:700;text-decoration:underline;margin-bottom:5px;">توقيع الموجه</p>
          <p>الاسم: .................................</p>
          <p>الوظيفة: ................................</p>
          <p>رقم التليفون: .............................</p>
          <p>التوقيع: .................................</p>
        </div>
        \${renderManagersTable(cfg)}
      </div>
      \${renderSignatures(cfg)}
    \`);
    try {
      await generatePDF(wrapPages(pages), \`خطابات_تكليف_الموجهين_المتاحين.pdf\`, setPdfProgress);
      toast.success('تم إنشاء الخطابات بنجاح');
    } catch { toast.error('خطأ في PDF'); setPdfProgress(''); }
  };

  const tabStyle = (t: Tab) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    borderRadius: '8px 8px 0 0', border: 'none',
    background: tab === t ? 'rgba(34,211,238,0.15)' : 'transparent',
    color: tab === t ? '#22d3ee' : '#64748b',
    borderBottom: tab === t ? '2px solid #22d3ee' : '2px solid transparent',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">التقارير والكشوف الرسمية</h1>
          <p className="page-subtitle">كشوف الموجهين وخطابات التكليف والإحصائيات</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button style={tabStyle('distribution')} onClick={() => setTab('distribution')}>
          📊 توزيع الامتحانات
        </button>
        <button style={tabStyle('unassigned')} onClick={() => setTab('unassigned')}>
          👤 الموجهون غير المكلفون
          {!loading && data && (
            <span style={{ marginRight: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {data.unassignedSupervisors.length}
            </span>
          )}
        </button>
        <button style={tabStyle('noSupervisor')} onClick={() => setTab('noSupervisor')}>
          🏫 مدارس بدون موجه مقيم
          {!loading && data && (
            <span style={{ marginRight: 6, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {data.schoolsWithoutSupervisor.length}
            </span>
          )}
        </button>
      </div>

      <div className="glass-card" style={{ borderRadius: '0 8px 8px 8px', padding: 0, overflow: 'hidden' }}>
        {pdfProgress && (
          <div style={{ padding: '10px 20px', background: 'rgba(34,211,238,0.1)', display: 'flex', alignItems: 'center', gap: 10, color: '#22d3ee', fontSize: 13 }}>
            <div style={{ width: 14, height: 14, border: '2px solid #22d3ee', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {pdfProgress}
          </div>
        )}

        {/* ── Tab: Distribution ── */}
        {tab === 'distribution' && (
          <div style={{ padding: 20 }}>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>للتقارير المفصلة عن التوزيع، يرجى الانتقال إلى صفحة <strong>التقارير والطباعة</strong> الرئيسية في القائمة الجانبية.</p>
          </div>
        )}

        {/* ── Tab: Unassigned Supervisors ── */}
        {tab === 'unassigned' && (
          <div style={{ padding: 20 }}>
            {/* Summary cards */}
            {!loading && data && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'إجمالي الموجهين النشطين', value: data.totalSupervisors, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
                  { label: 'المكلفون حالياً', value: data.totalSupervisors - data.unassignedSupervisors.length, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
                  { label: 'غير المكلفين / المتاحون', value: data.unassignedSupervisors.length, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: \`1px solid \${c.color}33\`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{c.label}</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</h3>
                  </div>
                ))}
              </div>
            )}

            {/* Filters + Actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 180 }} value={filterSpec} onChange={e => setFilterSpec(e.target.value)}>
                <option value="">كل التخصصات</option>
                {uniqueSpecs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-primary" onClick={printUnassigned} disabled={!!pdfProgress} style={{ fontSize: 12, padding: '8px 14px' }}>
                <Printer size={14} /> طباعة الكشف
              </button>
              <button className="btn-primary" onClick={printAssignmentLetters} disabled={!!pdfProgress} style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg,#a78bfa,#818cf8)' }}>
                <FileText size={14} /> طباعة خطابات التكليف
              </button>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>جارٍ التحميل...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>اسم الموجه</th><th>التخصص</th><th>المرحلة</th>
                      <th>الدرجة الوظيفية</th><th>التليفون</th><th>الرقم القومي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassigned.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#34d399' }}>
                        <CheckCircle2 size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
                        جميع الموجهين مكلفون
                      </td></tr>
                    ) : unassigned.map((s: any, i: number) => (
                      <tr key={s.id}>
                        <td style={{ color: '#475569', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td><span className="badge badge-purple">{s.specialty}</span></td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.stage ?? '—'}</td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.grade ?? '—'}</td>
                        <td dir="ltr" style={{ color: '#94a3b8', fontSize: 12 }}>{s.phone ?? '—'}</td>
                        <td style={{ color: '#94a3b8', fontSize: 11 }}>{s.national_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Schools Without Supervisor ── */}
        {tab === 'noSupervisor' && (
          <div style={{ padding: 20 }}>
            {!loading && data && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'إجمالي مدارس اللجان', value: data.totalSchools, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
                  { label: 'مدارس لها موجه مقيم', value: data.totalSchools - data.schoolsWithoutSupervisor.length, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
                  { label: 'مدارس بدون موجه مقيم', value: data.schoolsWithoutSupervisor.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: \`1px solid \${c.color}33\`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{c.label}</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</h3>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 180 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                <option value="">كل المراحل</option>
                {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-primary" onClick={printNoSupervisor} disabled={!!pdfProgress} style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Printer size={14} /> طباعة كشف المدارس
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>جارٍ التحميل...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>اسم المدرسة</th><th>الكود</th><th>المرحلة</th>
                      <th>النوع</th><th>التخصص</th><th>العدد المطلوب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noSup.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#34d399' }}>
                        <CheckCircle2 size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
                        جميع المدارس لديها موجه مقيم
                      </td></tr>
                    ) : noSup.map((s: any, i: number) => (
                      <tr key={s.id}>
                        <td style={{ color: '#475569', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.school_name}</td>
                        <td style={{ color: '#94a3b8', fontSize: 11 }}>{s.school_code ?? '—'}</td>
                        <td><span className="badge badge-blue">{s.stage}</span></td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.school_type}</td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.specialization ?? '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{s.needs_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
`;

const outPath = join(process.cwd(), 'src/app/(admin)/reports/page.tsx');
writeFileSync(outPath, page, 'utf8');
console.log('✅ Written:', outPath);
