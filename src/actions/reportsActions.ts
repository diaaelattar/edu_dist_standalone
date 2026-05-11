'use server';

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export interface UnassignedSupervisor {
  id: string;
  name: string;
  specialty: string;
  stage: string | null;
  school_type: string | null;
  phone: string | null;
  national_id: string | null;
  grade: string | null;
  qualification: string | null;
  appointment_type: string | null;
  is_active: boolean;
}

export interface SchoolWithoutSupervisor {
  id: string;
  school_code: string;
  school_name: string;
  stage: string;
  school_type: string;
  needs_count: number;
  address: string | null;
  specialization: string | null;
}

export interface ReportsData {
  unassignedSupervisors: UnassignedSupervisor[];
  schoolsWithoutSupervisor: SchoolWithoutSupervisor[];
  totalSupervisors: number;
  totalSchools: number;
  settings: Record<string, string>;
}

export async function getReportsData(): Promise<ReportsData> {
  // 1. جلب جميع الموجهين النشطين
  const { data: allSupervisors, error: supError } = await supabase
    .from('supervisors')
    .select('id, name, specialty, stage, school_type, phone, national_id, grade, qualification, appointment_type, is_active')
    .eq('is_active', true)
    .order('specialty')
    .order('name');

  if (supError) throw new Error(supError.message);

  // 2. جلب معرفات الموجهين المكلفين حاليًا (mandatory)
  const { data: assignedSchools, error: assignErr } = await supabase
    .from('schools')
    .select('mandatory_supervisor_id')
    .not('mandatory_supervisor_id', 'is', null)
    .eq('is_active', true);

  if (assignErr) throw new Error(assignErr.message);

  const assignedSupIds = new Set(
    (assignedSchools || [])
      .map((s: any) => s.mandatory_supervisor_id)
      .filter(Boolean)
  );

  // 3. الموجهون غير المكلفين = نشطون لكن لا يوجد مدرسة تحمل معرفهم كـ mandatory
  const unassignedSupervisors: UnassignedSupervisor[] = (allSupervisors || []).filter(
    (s: any) => !assignedSupIds.has(s.id)
  );

  // 4. جلب المدارس بدون موجه مقيم
  const { data: schoolsWithout, error: schoolErr } = await supabase
    .from('schools')
    .select('id, school_code, school_name, stage, school_type, needs_count, address, specialization')
    .is('mandatory_supervisor_id', null)
    .eq('is_active', true)
    .order('stage')
    .order('school_name');

  if (schoolErr) throw new Error(schoolErr.message);

  // 5. الإعدادات
  const { data: settingsData } = await supabase.from('distribution_settings').select('setting_key, setting_value');
  const settings = (settingsData || []).reduce((acc: Record<string, string>, curr: any) => {
    acc[curr.setting_key] = curr.setting_value;
    return acc;
  }, {});

  // 6. الإجماليات
  const { count: totalSup } = await supabase
    .from('supervisors')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: totalSch } = await supabase
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  return {
    unassignedSupervisors,
    schoolsWithoutSupervisor: schoolsWithout || [],
    totalSupervisors: totalSup ?? 0,
    totalSchools: totalSch ?? 0,
    settings,
  };
}
