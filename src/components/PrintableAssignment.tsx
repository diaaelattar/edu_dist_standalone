'use client';

import { useRef, useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import { DistributionResult, DistributionStats } from '@/types/database';
import { getRankLabel } from '@/lib/distributionAlgorithm';
import { getSettings } from '@/services/distributionService';

interface Props {
  results: DistributionResult[];
  stats: DistributionStats;
  runName?: string;
}

export default function PrintableAssignment({ results, stats, runName }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleDownloadPDF = async () => {
    if (typeof window === 'undefined') return;
    const html2pdf = (await import('html2pdf.js')).default;
    const element = printRef.current;
    if (!element) return;
    const opt = {
      margin: [10, 15, 10, 15] as [number, number, number, number],
      filename: `نشرة_توزيع_${runName ?? ''}_${new Date().toLocaleDateString('ar-EG')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, rtl: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };
    html2pdf().from(element).set(opt).save();
  };

  const handlePrint = () => window.print();

  // Group by school for organized printing
  const bySchool = results.reduce<Record<string, DistributionResult[]>>((acc, r) => {
    const key = r.school?.school_name ?? r.assigned_school_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });


  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}>
      {/* Action Buttons */}
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'flex-end' }}>
        <button onClick={handlePrint} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8,
          background: '#1e293b', color: '#f1f5f9',
          border: '1px solid #334155', cursor: 'pointer', fontSize: 13,
        }}>
          <Printer size={14} /> طباعة
        </button>
        <button onClick={handleDownloadPDF} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8,
          background: '#0f766e', color: '#f0fdf4',
          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}>
          <Download size={14} /> تحميل PDF
        </button>
      </div>

      {/* Printable Content */}
      <div ref={printRef} style={{
        background: 'white', color: 'black',
        padding: '20mm', minHeight: '297mm',
        fontFamily: "'Cairo', 'Arial', sans-serif",
        fontSize: 12,
      }}>
        {/* ===== OFFICIAL HEADER ===== */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: 12, marginBottom: 16,
          borderBottom: '3px double #1e3a5f',
        }}>
          {/* Left: Logo placeholder */}
          <div style={{
            width: 70, height: 70, border: '2px solid #1e3a5f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#1e3a5f', textAlign: 'center',
          }}>
            شعار<br/>الوزارة
          </div>

          {/* Center: Official header */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: '0 0 3px', fontWeight: 900, fontSize: 14 }}>
              وزارة التربية والتعليم والتعليم الفني
            </p>
            <p style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 13 }}>
              مديرية التربية والتعليم بالجيزة
            </p>
            <p style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 13, color: '#1e3a5f' }}>
              إدارة العمرانية التعليمية
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#374151' }}>
              قسم التوجيه الفني
            </p>
          </div>

          {/* Right: Date & Year */}
          <div style={{ textAlign: 'left', minWidth: 120, fontSize: 11 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>التاريخ:</p>
            <p style={{ margin: '0 0 8px', color: '#374151' }}>{today}</p>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>العام الدراسي:</p>
            <p style={{ margin: 0, color: '#374151' }}>2025 / 2026</p>
          </div>
        </div>

        {/* ===== TITLE ===== */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{
            margin: 0, fontSize: 17, fontWeight: 900,
            textDecoration: 'underline', textDecorationStyle: 'double',
            color: '#1e3a5f', letterSpacing: 1,
          }}>
            نشرة توزيع الموجهين المقيمين على لجان الامتحانات
          </h2>
          {runName && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#374151' }}>
              [ {runName} ]
            </p>
          )}
        </div>

        {/* ===== INTRO TEXT ===== */}
        <p style={{
          textAlign: 'justify', lineHeight: 2, fontSize: 12,
          margin: '0 0 16px', color: '#1f2937',
        }}>
          بناءً على التعليمات الواردة وفي ضوء القواعد المنظمة لعمل الموجهين المقيمين خلال فترة الامتحانات،
          واستناداً إلى احتياجات المدارس الفعلية ورغبات السادة الموجهين،
          يتشرف القسم بإعلان نتيجة توزيع السادة الموجهين على المدارس التالية، مع الرجاء من الجهات المختصة تنفيذ ذلك
          في الموعد المحدد.
        </p>

        {/* ===== STATS SUMMARY ===== */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 16,
          border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden',
          fontSize: 11,
        }}>
          {[
            { label: 'الإجمالي', value: stats.total },
            { label: 'رغبة أولى', value: stats.by_wish_1 },
            { label: 'رغبة ثانية', value: stats.by_wish_2 },
            { label: 'رغبة ثالثة', value: stats.by_wish_3 },
            { label: 'رغبة رابعة', value: stats.by_wish_4 },
            { label: 'اضطراري', value: stats.forced },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '6px 4px',
              borderLeft: i < 5 ? '1px solid #d1d5db' : 'none',
              background: i === 0 ? '#f8fafc' : 'white',
            }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1e3a5f' }}>{s.value}</p>
              <p style={{ margin: 0, color: '#6b7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ===== MAIN TABLE ===== */}
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          border: '2px solid #1e3a5f', fontSize: 12,
          marginBottom: 20,
        }}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: 'white' }}>
              <th style={{ padding: '8px 6px', border: '1px solid #1e3a5f', width: 32, textAlign: 'center' }}>م</th>
              <th style={{ padding: '8px 6px', border: '1px solid #1e3a5f' }}>اسم الموجه</th>
              <th style={{ padding: '8px 6px', border: '1px solid #1e3a5f' }}>التخصص</th>
              <th style={{ padding: '8px 6px', border: '1px solid #1e3a5f' }}>المدرسة الموزع عليها</th>
              <th style={{ padding: '8px 6px', border: '1px solid #1e3a5f' }}>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, i) => (
              <tr key={res.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '7px 6px', border: '1px solid #d1d5db', textAlign: 'center', fontWeight: 700 }}>
                  {i + 1}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #d1d5db', fontWeight: 700 }}>
                  {res.supervisor?.name}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #d1d5db', color: '#374151' }}>
                  {res.supervisor?.specialty}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #d1d5db', fontWeight: 600, color: '#1e3a5f' }}>
                  {res.school?.school_name}
                </td>
                <td style={{ padding: '7px 6px', border: '1px solid #d1d5db', fontSize: 11, color: '#6b7280' }}>
                  {res.rank_achieved > 0
                    ? `بناءً على ${getRankLabel(res.rank_achieved)}`
                    : 'توزيع لصالح العمل'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ===== SIGNATURES ===== */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40, paddingLeft: 60 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 900, fontSize: 18 }}>يعتمد،،</p>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div style={{
          marginTop: 30, paddingTop: 10,
          borderTop: '1px solid #d1d5db',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 9, color: '#9ca3af', fontStyle: 'italic',
        }}>
          <span>تم إصدار هذه الوثيقة إلكترونياً عبر منظومة التوزيع الذكي — الإصدار 2.0</span>
          <span>صفحة 1 من 1 — {new Date().toLocaleString('ar-EG')}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
