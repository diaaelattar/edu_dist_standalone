'use server';

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { getUser } from './authActions';

/**
 * Generate an Excel template pre-filled with schools list (for reference)
 * and empty columns for supervisor data & wishes.
 */
export async function generateGuidanceTemplate() {
  const user = await getUser();
  if (!user || user.role !== 'guidance') {
    return { error: 'غير مصرح لك بهذا الإجراء' };
  }

  // Fetch schools for reference sheet
  const { data: schools } = await supabase
    .from('schools')
    .select('school_code, school_name, stage, school_type')
    .eq('is_active', true)
    .order('school_code');

  // Fetch existing supervisors for this specialty (pre-fill if any)
  const { data: supervisors } = await supabase
    .from('supervisors')
    .select('national_id, name, phone, is_active')
    .eq('specialty', user.specialty)
    .order('name');

  // Fetch existing wishes
  const { data: existingSups } = await supabase
    .from('supervisors')
    .select('id, national_id')
    .eq('specialty', user.specialty);

  let wishesMap: Record<string, any> = {};
  if (existingSups && existingSups.length > 0) {
    const supIds = existingSups.map(s => s.id);
    const { data: wishesData } = await supabase
      .from('supervisor_wishes')
      .select('supervisor_id, wish_1, wish_2, wish_3, wish_4')
      .in('supervisor_id', supIds);

    // Build school UUID -> code map
    const { data: allSchools } = await supabase
      .from('schools')
      .select('id, school_code');
    const schoolIdToCode: Record<string, string> = {};
    if (allSchools) {
      allSchools.forEach(s => { schoolIdToCode[s.id] = s.school_code; });
    }

    // Build supervisor_id -> national_id map
    const supIdToNatId: Record<string, string> = {};
    existingSups.forEach(s => { supIdToNatId[s.id] = s.national_id; });

    if (wishesData) {
      wishesData.forEach(w => {
        const natId = supIdToNatId[w.supervisor_id];
        if (natId) {
          wishesMap[natId] = {
            wish_1: w.wish_1 ? schoolIdToCode[w.wish_1] || '' : '',
            wish_2: w.wish_2 ? schoolIdToCode[w.wish_2] || '' : '',
            wish_3: w.wish_3 ? schoolIdToCode[w.wish_3] || '' : '',
            wish_4: w.wish_4 ? schoolIdToCode[w.wish_4] || '' : '',
          };
        }
      });
    }
  }

  const workbook = XLSX.utils.book_new();

  // --- Sheet 1: الموجهين ---
  const supHeader = ['كود الموجه (الرقم القومي)', 'اسم الموجه', 'رقم التليفون', 'الحالة (متاح/غير متاح)'];
  const supRows: any[][] = [supHeader];
  if (supervisors && supervisors.length > 0) {
    supervisors.forEach(s => {
      supRows.push([
        s.national_id || '',
        s.name,
        s.phone || '',
        s.is_active ? 'متاح' : 'غير متاح'
      ]);
    });
  } else {
    // Add 5 empty rows as template
    for (let i = 0; i < 5; i++) {
      supRows.push(['', '', '', 'متاح']);
    }
  }
  const supSheet = XLSX.utils.aoa_to_sheet(supRows);
  // Set column widths
  supSheet['!cols'] = [
    { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(workbook, supSheet, 'الموجهين');

  // --- Sheet 2: الرغبات ---
  const wishHeader = [
    'كود الموجه (الرقم القومي)', 'اسم الموجه',
    'كود المدرسة 1', 'اسم المدرسة 1',
    'كود المدرسة 2', 'اسم المدرسة 2',
    'كود المدرسة 3', 'اسم المدرسة 3',
    'كود المدرسة 4', 'اسم المدرسة 4',
  ];

  // Build school code->name map
  const { data: allSchoolsForNames } = await supabase.from('schools').select('id, school_code, school_name');
  const schoolIdToName: Record<string, string> = {};
  const schoolCodeToName: Record<string, string> = {};
  if (allSchoolsForNames) {
    allSchoolsForNames.forEach(s => {
      schoolIdToName[s.id] = s.school_name;
      schoolCodeToName[s.school_code] = s.school_name;
    });
  }

  const wishRows: any[][] = [wishHeader];
  if (supervisors && supervisors.length > 0) {
    supervisors.forEach(s => {
      const w = wishesMap[s.national_id] || {};
      wishRows.push([
        s.national_id || '',
        s.name,
        w.wish_1 || '', schoolCodeToName[w.wish_1] || '',
        w.wish_2 || '', schoolCodeToName[w.wish_2] || '',
        w.wish_3 || '', schoolCodeToName[w.wish_3] || '',
        w.wish_4 || '', schoolCodeToName[w.wish_4] || '',
      ]);
    });
  } else {
    for (let i = 0; i < 5; i++) {
      wishRows.push(['', '', '', '', '', '', '', '', '', '']);
    }
  }
  const wishSheet = XLSX.utils.aoa_to_sheet(wishRows);
  wishSheet['!cols'] = [
    { wch: 20 }, { wch: 35 },
    { wch: 15 }, { wch: 30 },
    { wch: 15 }, { wch: 30 },
    { wch: 15 }, { wch: 30 },
    { wch: 15 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, wishSheet, 'الرغبات');

  // --- Sheet 3: دليل المدارس (مرجعي) ---
  const schoolHeader = ['كود المدرسة', 'اسم المدرسة', 'المرحلة', 'النوعية'];
  const schoolRows: any[][] = [schoolHeader];
  if (schools) {
    schools.forEach(s => {
      schoolRows.push([s.school_code, s.school_name, s.stage, s.school_type]);
    });
  }
  const schoolSheet = XLSX.utils.aoa_to_sheet(schoolRows);
  schoolSheet['!cols'] = [
    { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(workbook, schoolSheet, 'دليل المدارس');

  // Write to buffer
  const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  return {
    base64: buf,
    filename: `تمبلت_${user.specialty}_${new Date().toISOString().split('T')[0]}.xlsx`
  };
}

/**
 * Import supervisors + wishes from filled-in template
 */
export async function importGuidanceExcel(formData: FormData) {
  const user = await getUser();
  if (!user || user.role !== 'guidance') {
    return { success: false, message: 'غير مصرح لك بهذا الإجراء' };
  }

  try {
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, message: 'لم يتم اختيار ملف' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    let supCount = 0;
    let wishCount = 0;

    // --- 1. Process Supervisors sheet ---
    const supSheet = workbook.Sheets['الموجهين'];
    if (supSheet) {
      const rows = XLSX.utils.sheet_to_json<any[]>(supSheet, { header: 1 });
      const supPayload = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || !row[1]) continue; // code & name required
        const statusStr = String(row[3] || 'متاح');
        supPayload.push({
          national_id: String(row[0]),
          name: String(row[1]),
          specialty: user.specialty,
          phone: row[2] ? String(row[2]) : null,
          is_active: !statusStr.includes('غير')
        });
      }

      if (supPayload.length > 0) {
        const { error } = await supabase.from('supervisors').upsert(
          supPayload,
          { onConflict: 'national_id' }
        );
        if (error) throw new Error('خطأ في إدخال الموجهين: ' + error.message);
        supCount = supPayload.length;
      }
    }

    // --- 2. Process Wishes sheet ---
    const wishSheet = workbook.Sheets['الرغبات'];
    if (wishSheet) {
      const rows = XLSX.utils.sheet_to_json<any[]>(wishSheet, { header: 1 });

      // Get supervisor ID mapping (national_id -> UUID)
      const { data: dbSups } = await supabase
        .from('supervisors')
        .select('id, national_id')
        .eq('specialty', user.specialty);
      const supMap = new Map<string, string>();
      if (dbSups) dbSups.forEach(s => supMap.set(s.national_id, s.id));

      // Get school ID mapping (school_code -> UUID)
      const { data: dbSchools } = await supabase
        .from('schools')
        .select('id, school_code');
      const schoolMap = new Map<string, string>();
      if (dbSchools) dbSchools.forEach(s => schoolMap.set(s.school_code, s.id));

      const wishPayload = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const supId = supMap.get(String(row[0]));
        if (!supId) continue;

        const w1 = row[2] ? schoolMap.get(String(row[2])) || null : null;
        const w2 = row[4] ? schoolMap.get(String(row[4])) || null : null;
        const w3 = row[6] ? schoolMap.get(String(row[6])) || null : null;
        const w4 = row[8] ? schoolMap.get(String(row[8])) || null : null;

        if (w1 || w2 || w3 || w4) {
          wishPayload.push({
            supervisor_id: supId,
            wish_1: w1,
            wish_2: w2,
            wish_3: w3,
            wish_4: w4,
          });
        }
      }

      if (wishPayload.length > 0) {
        const { error } = await supabase.from('supervisor_wishes').upsert(
          wishPayload,
          { onConflict: 'supervisor_id' }
        );
        if (error) throw new Error('خطأ في إدخال الرغبات: ' + error.message);
        wishCount = wishPayload.length;
      }
    }

    return {
      success: true,
      message: `تم الاستيراد بنجاح! (${supCount} موجه، ${wishCount} رغبة)`
    };
  } catch (error: any) {
    console.error('Guidance Excel Import Error:', error);
    return { success: false, message: error.message || 'حدث خطأ أثناء قراءة الملف' };
  }
}
