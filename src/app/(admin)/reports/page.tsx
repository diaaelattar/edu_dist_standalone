
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

type Tab = 'distribution' | 'unassigned' | 'noSupervisor';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('distribution');

  const [runs, setRuns] = useState<DistributionRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [results, setResults] = useState<DistributionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<ReportSettings | null>(null);
  const [pdfProgress, setPdfProgress] = useState('');
  
  // Extra data for new tabs
  const [extraData, setExtraData] = useState<any>(null);
  
  // Filters
  const [filterSpec, setFilterSpec] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [searchSup, setSearchSup] = useState('');
  const [selectedSups, setSelectedSups] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getAllRuns(),
      getSettings(),
      fetch('/api/reports-data').then(r => r.json()).catch(() => null)
    ]).then(([r, s, ed]) => {
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
      setExtraData(ed);
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
        ${renderHeader(cfg, 'أمر تكليف موجه مقيم')}
        <div class="sup-card" style="padding: 6px 10px; margin-bottom: 4px;">
          <p style="font-weight:700; margin-bottom:5px; font-size:12px;">
            السيد / <span style="border-bottom:1px dashed #000; padding:0 6px; font-weight:800; font-size: 13px;">${supName}</span>
            &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000; padding:0 6px;">${specialty}</span>
          </p>
          <p style="font-weight:600; line-height: 1.4; margin-bottom: 5px; font-size:11.5px;">في إطار الاستعدادات لعقد امتحانات ${cfg.semester}، فقد تقرر تكليفكم بمتابعة لجان سير امتحانات النقل بمدرسة:</p>
          <p style="text-align:center; margin-bottom: 3px;"><span class="school-box" style="font-size:13px; padding: 4px 20px;">${schoolName}</span></p>
          <p style="text-align:center; font-weight:800; font-size:11px; color:#1a3a6e;">( طبقاً لجدول الامتحانات المعلن )</p>
        </div>
        <p style="font-weight:800; font-size: 11px; margin:5px 0 3px; color:#1a3a6e; border-right: 3px solid #1a3a6e; padding-right: 5px;">تعليمات ومهام الموجه المقيم لمتابعة امتحانات النقل</p>
        <p style="font-weight:700; margin-bottom:3px; font-size: 10px;">بناءً على التكليف الصادر لمتابعة سير امتحانات النقل، يُرجى الالتزام التام بالمهام والتعليمات الآتية:</p>
        <ol class="instructions" dir="rtl" style="font-size: 9.5px; margin: 0; padding-right: 16px; column-count: 2; column-gap: 14px; line-height: 1.4;">${INSTRUCTIONS.map(i => `<li style="margin-bottom:1px;">${i}</li>`).join('')}</ol>

        <div style="margin-top: 10px;">
          ${renderSignatures(cfg)}
        </div>
      `;
    });
    try {
      await generatePDF(wrapPages(pages, 'page-a5-landscape'), `خطابات_تكليف_${run?.run_name ?? 'التوزيع'}.pdf`, setPdfProgress, 'A5 landscape');
      toast.success('تم إنشاء ملف PDF بنجاح');
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };

  // ═══════ Guidance Sheets Summary (Assigned & Unassigned) ═══════
  const printGuidanceSheets = async () => {
    if (!cfg || (results.length === 0 && (extraData?.unassignedSupervisors ?? []).length === 0)) {
      return toast.error('لا توجد بيانات للطباعة');
    }

    const assignedSpecs = Array.from(new Set(results.map(r => r.supervisor?.specialty).filter(Boolean)));
    const unassignedSpecs = Array.from(new Set((extraData?.unassignedSupervisors ?? []).map((s: any) => s.specialty).filter(Boolean)));
    const allSpecs = Array.from(new Set([...assignedSpecs, ...unassignedSpecs])).sort((a, b) => (a as string).localeCompare(b as string, 'ar'));

    const targetSpecs = filterSpec ? allSpecs.filter(s => s === filterSpec) : allSpecs;

    if (targetSpecs.length === 0) return toast.error('لا توجد نتائج تطابق التخصص المختار');

    const footerHtml = renderSignatures(cfg);

    const pages = targetSpecs.map(spec => {
      const assigned = results.filter(r => 
        r.supervisor?.specialty === spec && 
        (!filterStage || r.school?.stage === filterStage)
      );

      const unassigned = (extraData?.unassignedSupervisors ?? []).filter((s: any) => 
        s.specialty === spec
      );

      if (assigned.length === 0 && unassigned.length === 0) return null;

      assigned.sort((a: any, b: any) => (a.school?.school_name ?? '').localeCompare(b.school?.school_name ?? '', 'ar'));
      unassigned.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? '', 'ar'));

      const assignedRows = assigned.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right; font-weight:700;">${r.school?.school_name ?? ''}</td>
          <td style="font-size:10px; color:#555;">${r.school?.school_type ?? ''}</td>
          <td style="font-weight:600;">${r.supervisor?.name ?? ''}</td>
          <td dir="ltr" style="font-size:11px;">${r.supervisor?.phone ?? '—'}</td>
        </tr>`).join('');

      const unassignedRows = unassigned.map((s: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right; font-weight:700;">${s.name}</td>
          <td style="color:#c00; font-weight:600;">غير مكلف (متاح)</td>
          <td dir="ltr" style="font-size:11px;">${s.phone ?? '—'}</td>
        </tr>`).join('');

      return `
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
                ${renderHeader(cfg, 'توزيع تكليف السادة الموجهين لمتابعة أعمال امتحان النقل', `آخر العام الدراسي 2025 / 2026`)}
                
                <div style="margin: 12px 0 8px; font-weight: 800; font-size: 15px; border-bottom: 2px solid #1a3a6e; padding-bottom: 5px; color: #1a3a6e;">
                  السيد موجه أول / توجيه ${spec}
                </div>
                
                <p style="margin: 10px 0; font-weight: 700; line-height: 1.6; font-size: 13.5px;">
                  مرفق كشف تكليفات السادة أعضاء القسم التابع لكم لمتابعة أعمال امتحانات : آخر العام الدراسي 2025 / 2026؛
                </p>
                <p style="margin: 5px 0; font-weight: 700; font-size: 13px; color: #444;">
                  الرجا موافاتنا بكل من لم يرد بهذا الكشف من العاملين بالقسم لديكم.
                </p>
                <p style="margin: 8px 0 15px; font-weight: 800; text-decoration: underline; font-size: 14px; text-align: center;">
                  هذا للعلم واتخاذ اللازم
                </p>

                <h4 style="margin: 15px 0 6px; font-size: 13px; color: #1a3a6e; border-right: 4px solid #1a3a6e; padding-right: 8px;">أولاً: السادة الموجهون المكلفون:</h4>
                <table class="data-tbl">
                  <thead><tr>
                    <th style="width:35px;">م</th>
                    <th>اسم المدرسة</th>
                    <th style="width:80px;">النوع</th>
                    <th style="width:200px;">اسم الموجه</th>
                    <th style="width:110px;">التليفون</th>
                  </tr></thead>
                  <tbody>
                    ${assignedRows || '<tr><td colspan="5" style="text-align:center; padding:15px; color:#666;">لا يوجد موجهون مكلفون حالياً في هذا التخصص</td></tr>'}
                  </tbody>
                </table>

                ${unassigned.length > 0 ? `
                  <h4 style="margin: 20px 0 6px; font-size: 13px; color: #c00; border-right: 4px solid #c00; padding-right: 8px;">ثانياً: السادة الموجهون غير المكلفين (المتاحون):</h4>
                  <table class="data-tbl">
                    <thead><tr>
                      <th style="width:35px;">م</th>
                      <th>اسم الموجه</th>
                      <th style="width:120px;">الحالة</th>
                      <th style="width:110px;">التليفون</th>
                    </tr></thead>
                    <tbody>${unassignedRows}</tbody>
                  </table>
                ` : ''}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style="border: none; padding: 0;">
                <div class="sig-container">
                  ${renderSignatures(cfg)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    }).filter(Boolean) as string[];

    try {
      await generatePDF(wrapPages(pages), `كشوف_التوجيهات_${cfg.semester}.pdf`, setPdfProgress, 'A4 portrait');
      toast.success('تم إنشاء الكشوف بنجاح');
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
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
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
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style="border: none; padding: 0;">
                <div class="sig-container">
                  ${renderSignatures(cfg)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
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
        ${renderHeader(cfg, 'أمر تكليف موجه مقيم')}
        <div class="sup-card" style="padding: 6px 10px; margin-bottom: 4px;">
          <p style="font-weight:700; margin-bottom:5px; font-size:12px;">
            السيد / <span style="border-bottom:1px dashed #000; padding:0 6px; font-weight:800; font-size: 13px;">...........................................</span>
            &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000; padding:0 6px;">..........................</span>
          </p>
          <p style="font-weight:600; line-height: 1.4; margin-bottom: 5px; font-size:11.5px;">في إطار الاستعدادات لعقد امتحانات ${cfg.semester}، فقد تقرر تكليفكم بمتابعة لجان سير امتحانات النقل بمدرسة:</p>
          <p style="text-align:center; margin-bottom: 3px;"><span class="school-box" style="font-size:13px; padding: 4px 20px;">...........................................</span></p>
          <p style="text-align:center; font-weight:800; font-size:11px; color:#1a3a6e;">( طبقاً لجدول الامتحانات المعلن )</p>
        </div>
        <p style="font-weight:800; font-size: 11px; margin:5px 0 3px; color:#1a3a6e; border-right: 3px solid #1a3a6e; padding-right: 5px;">تعليمات ومهام الموجه المقيم لمتابعة امتحانات النقل</p>
        <p style="font-weight:700; margin-bottom:3px; font-size: 10px;">بناءً على التكليف الصادر لمتابعة سير امتحانات النقل، يُرجى الالتزام التام بالمهام والتعليمات الآتية:</p>
        <ol class="instructions" dir="rtl" style="font-size: 9.5px; margin: 0; padding-right: 16px; column-count: 2; column-gap: 14px; line-height: 1.4;">${INSTRUCTIONS.map(i => `<li style="margin-bottom:1px;">${i}</li>`).join('')}</ol>

        <div style="margin-top: 10px;">
          ${renderSignatures(cfg)}
        </div>
      `;
    try {
      await generatePDF(wrapPages([page], 'page-a5-landscape'), 'خطاب_تكليف_فارغ.pdf', setPdfProgress, 'A5 landscape');
      toast.success('تم إنشاء PDF بنجاح');
    } catch { toast.error('خطأ في إنشاء PDF'); setPdfProgress(''); }
  };

  // ═══════ New Logic for Extra Tabs ═══════
  const unassigned = (extraData?.unassignedSupervisors ?? []).filter((s: any) => {
    if (filterSpec && s.specialty !== filterSpec) return false;
    return true;
  });

  const noSup = (extraData?.schoolsWithoutSupervisor ?? []).filter((s: any) => {
    if (filterStage && s.stage !== filterStage) return false;
    return true;
  });

  const extraUniqueSpecs = Array.from(new Set((extraData?.unassignedSupervisors ?? []).map((s: any) => s.specialty).filter(Boolean))).sort() as string[];
  const extraUniqueStages = Array.from(new Set((extraData?.schoolsWithoutSupervisor ?? []).map((s: any) => s.stage).filter(Boolean))).sort() as string[];

  const printUnassigned = async () => {
    if (!cfg) return;
    const items = unassigned;
    if (items.length === 0) return toast.error('لا يوجد موجهون غير مكلفون');
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = items.map((s: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right;font-weight:700;">${s.name}</td>
        <td>${s.specialty}</td>
        <td>${s.stage ?? '—'}</td>
        <td>${s.grade ?? '—'}</td>
        <td dir="ltr">${s.phone ?? '—'}</td>
        <td>${s.national_id ?? '—'}</td>
      </tr>`).join('');

    const page = `
      <table style="width: 100%; border: none; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="border: none; padding: 0;">
              ${renderHeader(cfg, 'كشف الموجهين غير المكلفين', 'المتاحون للاستعانة بهم في توزيع الامتحانات')}
              <div style="margin:6px 0;display:flex;gap:16px;font-size:11px;border:1px solid #ccc;padding:6px 12px;border-radius:4px;background:#f9fbff;">
                <span>إجمالي الموجهين النشطين: <strong>${extraData.totalSupervisors}</strong></span>
                <span>المكلفون حالياً: <strong>${extraData.totalSupervisors - extraData.unassignedSupervisors.length}</strong></span>
                <span style="color:#c00;font-weight:700;">غير المكلفين: <strong>${extraData.unassignedSupervisors.length}</strong></span>
                ${filterSpec ? `<span>التخصص: <strong>${filterSpec}</strong></span>` : ''}
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
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="border: none; padding: 0;">
              <div class="sig-container">
                ${renderSignatures(cfg)}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    `;
    try {
      await generatePDF(wrapPages([page]), `كشف_الموجهين_غير_المكلفين_${today}.pdf`, setPdfProgress);
      toast.success('تم إنشاء PDF بنجاح');
    } catch { toast.error('خطأ في PDF'); setPdfProgress(''); }
  };

  const printNoSupervisor = async () => {
    if (!cfg) return;
    const items = noSup;
    if (items.length === 0) return toast.error('جميع المدارس لديها موجه مقيم');
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    const groups: Record<string, typeof items> = {};
    items.forEach((s: any) => {
      const key = s.stage ?? 'غير محددة';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    const pages = Object.entries(groups).map(([stage, list]) => {
      const rows = (list as any[]).map((s: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right;font-weight:700;">${s.school_name}</td>
          <td>${s.school_code ?? '—'}</td>
          <td>${s.school_type}</td>
          <td>${s.specialization ?? '—'}</td>
          <td>${s.needs_count}</td>
          <td>${s.address ?? '—'}</td>
        </tr>`).join('');
      return `
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
                ${renderHeader(cfg, `كشف المدارس بدون موجه مقيم — ${stage}`, 'المدارس التي لم يُخصص لها موجه مقيم حتى الآن')}
                <div style="margin:6px 0;display:flex;gap:16px;font-size:11px;border:1px solid #ccc;padding:6px 12px;border-radius:4px;background:#fff8f8;">
                  <span>المرحلة: <strong>${stage}</strong></span>
                  <span style="color:#c00;font-weight:700;">عدد المدارس: <strong>${list.length}</strong></span>
                  ${filterStage ? '' : `<span>الإجمالي الكلي: <strong>${extraData.schoolsWithoutSupervisor.length}</strong></span>`}
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
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style="border: none; padding: 0;">
                <div class="sig-container">
                  ${renderSignatures(cfg)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    });
    try {
      await generatePDF(wrapPages(pages), `كشف_المدارس_بدون_موجه_${today}.pdf`, setPdfProgress);
      toast.success(`تم إنشاء ${pages.length} صفحة بنجاح`);
    } catch { toast.error('خطأ في PDF'); setPdfProgress(''); }
  };

  const printAssignmentLettersExtra = async () => {
    if (!cfg) return;
    const items = unassigned;
    if (items.length === 0) return toast.error('لا يوجد موجهون لطباعة خطاباتهم');
    const pages = items.map((s: any) => `
        ${renderHeader(cfg, 'أمر تكليف موجه مقيم')}
        <div class="sup-card" style="padding: 6px 10px; margin-bottom: 4px;">
          <p style="font-weight:700; margin-bottom:5px; font-size:12px;">
            السيد / <span style="border-bottom:1px dashed #000; padding:0 6px; font-weight:800; font-size: 13px;">${s.name}</span>
            &nbsp;&nbsp; توجيه: <span style="border-bottom:1px dashed #000; padding:0 6px;">${s.specialty}</span>
          </p>
          <p style="font-weight:600; line-height: 1.4; margin-bottom: 5px; font-size:11.5px;">في إطار الاستعدادات لعقد امتحانات ${cfg.semester}، فقد تقرر تكليفكم بمتابعة لجان سير امتحانات النقل بمدرسة:</p>
          <p style="text-align:center; margin-bottom: 3px;"><span class="school-box" style="font-size:13px; padding: 4px 20px;">...........................................</span></p>
          <p style="text-align:center; font-weight:800; font-size:11px; color:#1a3a6e;">( طبقاً لجدول الامتحانات المعلن )</p>
        </div>
        <p style="font-weight:800; font-size: 11px; margin:5px 0 3px; color:#1a3a6e; border-right: 3px solid #1a3a6e; padding-right: 5px;">تعليمات ومهام الموجه المقيم لمتابعة امتحانات النقل</p>
        <p style="font-weight:700; margin-bottom:3px; font-size: 10px;">بناءً على التكليف الصادر لمتابعة سير امتحانات النقل، يُرجى الالتزام التام بالمهام والتعليمات الآتية:</p>
        <ol class="instructions" dir="rtl" style="font-size: 9.5px; margin: 0; padding-right: 16px; column-count: 2; column-gap: 14px; line-height: 1.4;">${INSTRUCTIONS.map(i => `<li style="margin-bottom:1px;">${i}</li>`).join('')}</ol>

        <div style="margin-top: 10px;">
          ${renderSignatures(cfg)}
        </div>
      `);
    try {
      await generatePDF(wrapPages(pages, 'page-a5-landscape'), `خطابات_تكليف_المتاحين.pdf`, setPdfProgress, 'A5 landscape');
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
          <h1 className="page-title">التقارير والإحصائيات</h1>
          <p className="page-subtitle">تحليل شامل لنتائج التوزيع وطباعة الكشوف الرسمية</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button style={tabStyle('distribution')} onClick={() => setTab('distribution')}>
          📊 تقارير التوزيع الأساسية
        </button>
        <button style={tabStyle('unassigned')} onClick={() => setTab('unassigned')}>
          👤 الموجهون غير المكلفون
          {!loading && extraData && (
            <span style={{ marginRight: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {extraData.unassignedSupervisors.length}
            </span>
          )}
        </button>
        <button style={tabStyle('noSupervisor')} onClick={() => setTab('noSupervisor')}>
          🏫 مدارس بدون موجه مقيم
          {!loading && extraData && (
            <span style={{ marginRight: 6, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {extraData.schoolsWithoutSupervisor.length}
            </span>
          )}
        </button>
      </div>

      <div className="glass-card" style={{ borderRadius: '0 8px 8px 8px', padding: 20 }}>
        {pdfProgress && (
          <div className="glass-card glass-card-accent" style={{ padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#22d3ee', fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #22d3ee', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {pdfProgress}
          </div>
        )}

        {/* ── Tab: Distribution ── */}
        {tab === 'distribution' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select className="form-input" style={{ width: 220 }}
                value={selectedRun} onChange={e => setSelectedRun(e.target.value)}>
                {runs.map(r => <option key={r.id} value={r.id}>{r.run_name}</option>)}
              </select>
              <button className="btn-secondary" onClick={exportCSV} disabled={results.length === 0}>
                <Download size={14} /> تصدير CSV
              </button>
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
                    <div key={i} className="glass-card stat-card" style={{ padding: 16 }}>
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
                <div style={{ overflow: 'hidden', marginTop: 16 }}>
                  <div style={{ padding: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
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
          </>
        )}

        {/* ── Tab: Unassigned Supervisors ── */}
        {tab === 'unassigned' && (
          <div>
            {!loading && extraData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'إجمالي الموجهين النشطين', value: extraData.totalSupervisors, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
                  { label: 'المكلفون حالياً', value: extraData.totalSupervisors - extraData.unassignedSupervisors.length, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
                  { label: 'غير المكلفين / المتاحون', value: extraData.unassignedSupervisors.length, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{c.label}</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</h3>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 180 }} value={filterSpec} onChange={e => setFilterSpec(e.target.value)}>
                <option value="">كل التخصصات</option>
                {extraUniqueSpecs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-primary" onClick={printUnassigned} disabled={!!pdfProgress} style={{ fontSize: 12, padding: '8px 14px' }}>
                <Printer size={14} /> طباعة الكشف
              </button>
              <button className="btn-primary" onClick={printAssignmentLettersExtra} disabled={!!pdfProgress} style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg,#a78bfa,#818cf8)' }}>
                <FileText size={14} /> طباعة خطابات التكليف
              </button>
            </div>

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
          <div>
            {!loading && extraData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'إجمالي مدارس اللجان', value: extraData.totalSchools, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
                  { label: 'مدارس لها موجه مقيم', value: extraData.totalSchools - extraData.schoolsWithoutSupervisor.length, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
                  { label: 'مدارس بدون موجه مقيم', value: extraData.schoolsWithoutSupervisor.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{c.label}</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</h3>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 180 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                <option value="">كل المراحل</option>
                {extraUniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
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
