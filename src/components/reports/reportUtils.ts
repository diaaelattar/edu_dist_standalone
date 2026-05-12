/* ═══════════════════════════════════════════════════════════════════════
   PDF Report Generator — uses html2pdf.js with proper Arabic/RTL support
   ═══════════════════════════════════════════════════════════════════════ */

export interface ReportSettings {
  governorate: string;
  directorate: string;
  academicYear: string;
  semester: string;
  gm_name: string;
  gm_title: string;
  gm_phone: string;
  deputy_name: string;
  deputy_title: string;
  deputy_phone: string;
  security_name: string;
  security_title: string;
  security_phone: string;
  mgr_primary: string;
  mgr_primary_phone: string;
  mgr_prep: string;
  mgr_prep_phone: string;
  mgr_sec: string;
  mgr_sec_phone: string;
}

export function settingsToReport(s: Record<string, string>): ReportSettings {
  return {
    governorate: s.governorate_name || 'محافظة الجيزة',
    directorate: s.directorate_name || 'إدارة العمرانية التعليمية',
    academicYear: s.academic_year || '2025/2026',
    semester: 'آخر العام - الدور الأول',
    gm_name: s.officials_gm_name || '',
    gm_title: s.officials_gm_title || 'مدير عام الإدارة',
    gm_phone: s.officials_gm_phone || '',
    deputy_name: s.officials_deputy_name || '',
    deputy_title: s.officials_deputy_title || 'وكيل الإدارة',
    deputy_phone: s.officials_deputy_phone || '',
    security_name: s.officials_security_name || '',
    security_title: s.officials_security_title || 'مسئول أمن الإدارة',
    security_phone: s.officials_security_phone || '',
    mgr_primary: s.officials_mgr_primary || '',
    mgr_primary_phone: s.officials_mgr_primary_phone || '',
    mgr_prep: s.officials_mgr_prep || '',
    mgr_prep_phone: s.officials_mgr_prep_phone || '',
    mgr_sec: s.officials_mgr_sec || '',
    mgr_sec_phone: s.officials_mgr_sec_phone || '',
  };
}

// ─── Shared A4 styles embedded in each report ────────────────────────────
export const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Arial', sans-serif;
    direction: rtl;
    color: #111;
    background: #fff;
    font-size: 12px;
    line-height: 1.5;
  }

  /* ─── Page layout ─── */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 16mm 12mm;
    margin: 0 auto;
    position: relative;
    background: #fff;
  }

  /* ─── Header ─── */
  .rpt-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px double #1a3a6e;
    padding-bottom: 5px;
    margin-bottom: 6px;
  }
  .rpt-title-box {
    text-align: center;
    border: 1.5px solid #1a3a6e;
    padding: 4px 10px;
    border-radius: 4px;
    background: linear-gradient(180deg, #eef3fb 0%, #fff 100%);
    flex: 1;
    margin: 0 10px;
  }
  .rpt-title { font-size: 14px; font-weight: 900; color: #1a3a6e; }
  .rpt-subtitle { font-size: 10px; color: #555; margin-top: 2px; }
  .rpt-logo {
    width: 52px; height: 52px;
    border: 1.5px solid #1a3a6e;
    display: flex; align-items: center; justify-content: center;
    background: #f5f7fb;
  }
  .rpt-logo img { width: 100%; height: 100%; object-fit: contain; }

  /* ─── Officials strip ─── */
  .officials { margin: 8px 0; }
  .official-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1.5px solid #333;
    padding: 4px 12px;
    margin-bottom: 4px;
    font-size: 11px;
  }
  .official-name { font-weight: 700; }
  .official-title { color: #555; }
  .official-phone { direction: ltr; font-weight: 600; color: #1a3a6e; }

  /* ─── DATA TABLE — header repeats on every page ─── */
  .data-tbl {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #1a3a6e;
    margin-top: 12px;
  }
  .data-tbl thead {
    display: table-header-group;  /* 🔑 Repeat on every printed page */
  }
  .data-tbl thead th {
    background: #1a3a6e;
    color: #fff;
    padding: 8px 7px;
    border: 1px solid #1a3a6e;
    text-align: center;
    font-size: 11.5px;
    font-weight: 700;
  }
  .data-tbl tbody td {
    padding: 7px 8px;
    border: 1px solid #ccc;
    text-align: center;
    vertical-align: middle;
    font-size: 11.5px;
  }
  .data-tbl tbody tr:nth-child(even) { background: #f4f7fc; }
  .data-tbl thead { display: table-header-group; }
  .data-tbl tr { page-break-inside: avoid; }

  /* ─── Stage badges ─── */
  .badge { padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-p { background: #dbeafe; color: #1d4ed8; }
  .badge-e { background: #ede9fe; color: #6d28d9; }
  .badge-s { background: #fef3c7; color: #92400e; }

  /* ─── Section title ─── */
  .section-title {
    font-size: 13px; font-weight: 800; color: #1a3a6e;
    margin: 10px 0 6px;
    padding-right: 8px;
    border-right: 4px solid #1a3a6e;
  }

  /* ─── Instructions ─── */
  .instructions { margin-right: 16px; font-size: 13px; line-height: 1.65; }
  .instructions li { margin-bottom: 3px; }

  /* ─── Signature row ─── */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 12px;
  }
  .sig-block { text-align: center; min-width: 130px; }
  .sig-name { font-weight: 900; font-size: 12px; margin-top: 2px; }
  .sig-title { font-weight: 700; font-size: 11px; }
  .sig-line {
    margin-top: 22px;
    border-top: 1px solid #000;
    padding-top: 3px;
    font-size: 10px;
    color: #555;
  }

  /* ─── Managers table ─── */
  .mgr-tbl {
    width: 100%; border-collapse: collapse;
    border: 2px solid #000; margin-top: 4px;
    font-size: 11px;
  }
  .mgr-tbl th { background: #e5eaf4; padding: 4px 8px; border: 2px solid #000; font-weight: 800; color: #000; }
  .mgr-tbl td { padding: 4px 8px; border: 1px solid #000; color: #000; }

  /* ─── Supervisor card in letter ─── */
  .sup-card {
    border: 2px solid #1a3a6e;
    padding: 8px 12px;
    margin: 8px 0;
    border-radius: 4px;
    background: #f9fbff;
  }
  .school-box {
    display: inline-block;
    border: 2px solid #1a3a6e;
    padding: 4px 20px;
    font-size: 14px;
    font-weight: 900;
    background: #f0f4fb;
    border-radius: 4px;
  }

  /* ─── Notes box ─── */
  .notes-box {
    border: 1.5px solid #000;
    padding: 8px 14px;
    font-size: 10.5px;
    line-height: 1.7;
  }
  .notes-box p { margin-bottom: 3px; }

  @media print {
    @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  
  tfoot { display: table-footer-group; }
  .sig-container { margin-top: 15px; }

  
  .page-a5 {
    width: 148mm;
    min-height: 210mm;
    padding: 8mm 10mm 8mm;
    margin: 0 auto;
    position: relative;
    background: #fff;
  }
  .page-a5-landscape {
    width: 210mm;
    min-height: 148mm;
    padding: 6mm 10mm 6mm;
    margin: 0 auto;
    position: relative;
    background: #fff;
  }
`;

// ─── Header block ────────────────────────────────────────────────────────
export function renderHeader(cfg: ReportSettings, title: string, subtitle?: string): string {
  const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <div class="rpt-header">
      <div style="min-width:140px; text-align:right;">
        <div style="font-weight:900; font-size:14px;">${cfg.governorate}</div>
        <div style="font-weight:800; font-size:12px; margin-top:2px;">${cfg.directorate}</div>
        <div style="font-size:10px; color:#555; margin-top:4px;">التاريخ: ${today}</div>
      </div>
      <div class="rpt-title-box">
        <div class="rpt-title">${title}</div>
        ${subtitle ? `<div class="rpt-subtitle">${subtitle}</div>` : ''}
        <div style="font-size:10px; color:#666; margin-top:2px;">العام الدراسي: ${cfg.academicYear} | ${cfg.semester}</div>
      </div>
      <div style="text-align:center; min-width:80px;">
        <div class="rpt-logo">
          <img src="/logo.png" alt="شعار" />
        </div>
        <div style="font-size:9px; font-weight:700; margin-top:3px;">إدارة العمرانية</div>
      </div>
    </div>
  `;
}

// ─── Officials strip ──────────────────────────────────────────────────────
export function renderOfficials(cfg: ReportSettings): string {
  const rows = [
    { name: cfg.gm_name, title: cfg.gm_title, phone: cfg.gm_phone },
    { name: cfg.deputy_name, title: cfg.deputy_title, phone: cfg.deputy_phone },
    { name: cfg.security_name, title: cfg.security_title, phone: cfg.security_phone },
  ];
  return `
    <div class="officials">
      ${rows.map(r => `
        <div class="official-row">
          <span class="official-name">${r.name}</span>
          <span class="official-title">${r.title}</span>
          <span class="official-phone" dir="ltr">${r.phone}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Managers phone table ─────────────────────────────────────────────────
export function renderManagersTable(cfg: ReportSettings): string {
  return `
    <table class="mgr-tbl">
      <thead><tr>
        <th>المرحلة</th><th>الاسم</th><th>التليفون</th>
      </tr></thead>
      <tbody>
        <tr><td style="font-weight:600;">الابتدائية</td><td>${cfg.mgr_primary}</td><td dir="ltr">${cfg.mgr_primary_phone}</td></tr>
        <tr><td style="font-weight:600;">الإعدادية</td><td>${cfg.mgr_prep}</td><td dir="ltr">${cfg.mgr_prep_phone}</td></tr>
        <tr><td style="font-weight:600;">الثانوية</td><td>${cfg.mgr_sec}</td><td dir="ltr">${cfg.mgr_sec_phone}</td></tr>
      </tbody>
    </table>
  `;
}

// ─── Signatures row ───────────────────────────────────────────────────────
export function renderSignatures(cfg: ReportSettings): string {
  return `
    <div class="sig-row" style="justify-content: flex-end; margin-top: 30px; padding-left: 50px;">
      <div class="sig-block">
        <div class="sig-title" style="font-weight:900; font-size: 16px;">يعتمد،،</div>
      </div>
    </div>
  `;
}

// ─── GM signature block ───────────────────────────────────────────────────
export function renderGMSignature(cfg: ReportSettings): string {
  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-top:18px;">
      <div class="notes-box" style="flex:1;">
        <p><strong>ملاحظات هامة:</strong></p>
        <p>• يُرجى الالتزام التام بالمدرسة المحددة.</p>
        <p>• التواصل الفوري مع غرفة العمليات عند أي طارئ.</p>
        <p>• الحضور قبل بدء الامتحان بوقت كافٍ.</p>
      </div>
      <div class="sig-block" style="min-width:190px; text-align: center;">
        <div class="sig-title" style="font-weight:900; font-size: 16px;">يعتمد،،</div>
      </div>
    </div>
  `;
}

// ─── Official instructions ────────────────────────────────────────────────
export const INSTRUCTIONS = [
  'الالتزام بالحضور المبكر إلى مقر اللجنة ، وقبل موعد فتح مظاريف الأسئلة بوقت كافٍ للتأكد من استيفاء جميع الإجراءات المتصلة بالامتحان.',
  'متابعة فتح المظاريف مع مدير المدرسة ومراجعة سلامتها بالكامل قبل الفتح.',
  'الإشراف على عمليات توزيع الأظرف الفرعية لأسئلة الامتحان داخل اللجان الفرعية قبل بداية الاختبار بمدة لا تتجاوز خمس دقائق (5 دقائق).',
  'الالتزام التام بمواعيد جدول الامتحان كما هو وارد من الإدارة التعليمية وعدم مخالفته مطلقاً.',
  'التأكد من اتخاذ إجراءات التفتيش الدقيق للطلاب، وجمع الهواتف المحمولة أو أي أجهزة أو وسائل أخرى لمنع الغش.',
  'التأكد من سحب الهواتف المحمولة من السادة الملاحظين والمراقبين؛ وفي حالة ضبط ملاحظ يستخدم الهاتف المحمول أثناء انعقاد الاختبار، يتم تحرير محضر إثبات حالة فوراً وإثبات ذلك في التقرير اليومي.',
  'التأكد من غلق أبواب اللجان خلال زمن الاختبار، ومنع دخول أو خروج أي شخص غير مسموح له لضمان هدوء وانضباط اللجان.',
  'التواصل الفوري مع غرفة العمليات بالإدارة التعليمية في حال حدوث أي مخالفة أو عارض ذي شأن أثناء سير الامتحان.',
  'التأكد من بقاء الطلاب حتى نهاية الزمن المحدد للاختبار وعدم مغادرة المدرسة إلا بعد خروج آخر طالب، ومتابعة ذلك بدقة مع مدير المدرسة ومراقبي الأدوار.',
  'إعداد تقرير يومي مفصل عن سير الامتحان.'
];

// ─── Core: generate PDF using html2pdf.js ────────────────────────────────
export async function generatePDF(
  bodyHtml: string,
  filename: string,
  onProgress?: (msg: string) => void,
  pageSize: string = 'A4 portrait',
  footerHtml?: string
): Promise<void> {
  onProgress?.('تجهيز الملف للطباعة...');
  
  return new Promise((resolve) => {
    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      onProgress?.('');
      resolve();
      return;
    }

    // Write the HTML content with print-specific styles
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${filename}</title>
        <style>
          ${BASE_STYLES}
          @page { size: ${pageSize}; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        </style>
      </head>
      <body>
        ${bodyHtml}
        ${footerHtml ? `<div class="footer-fixed">${footerHtml}</div>` : ''}
      </body>
    </html>
  `);
    doc.close();

    // Wait for content to load, then trigger print
    iframe.onload = () => {
      onProgress?.('');
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup after print dialog is closed
      setTimeout(() => {
        document.body.removeChild(iframe);
        resolve();
      }, 1000);
    };
  });
}

// ─── Convenience: open in browser print dialog (fallback) ────────────────
export function openPrintWindow(title: string, html: string) {
  const w = window.open('', '_blank', 'width=1050,height=850');
  if (!w) { alert('يرجى السماح بالنوافذ المنبثقة للطباعة'); return; }
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>${BASE_STYLES}</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 700);
}

// ─── Wraps one or more page divs ─────────────────────────────────────────
export function wrapPages(pages: string[], pageClass: string = 'page'): string {
  return pages.map(p => `<div class="${pageClass}">${p}</div>`).join('\n');
}
