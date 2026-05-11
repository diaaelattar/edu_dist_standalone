import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // All active supervisors
    const { data: allSupervisors } = await supabase
      .from('supervisors')
      .select('id, name, specialty, stage, school_type, phone, national_id, grade, qualification, appointment_type, is_active')
      .eq('is_active', true)
      .order('specialty')
      .order('name');

    // Schools that have a mandatory supervisor assigned
    const { data: assignedSchools } = await supabase
      .from('schools')
      .select('mandatory_supervisor_id')
      .not('mandatory_supervisor_id', 'is', null)
      .eq('is_active', true);

    const assignedSupIds = new Set(
      (assignedSchools || []).map((s: any) => s.mandatory_supervisor_id).filter(Boolean)
    );

    const unassignedSupervisors = (allSupervisors || []).filter(
      (s: any) => !assignedSupIds.has(s.id)
    );

    // Schools without any mandatory supervisor
    const { data: schoolsWithout } = await supabase
      .from('schools')
      .select('id, school_code, school_name, stage, school_type, needs_count, address, specialization')
      .is('mandatory_supervisor_id', null)
      .eq('is_active', true)
      .order('stage')
      .order('school_name');

    // Settings
    const { data: settingsData } = await supabase
      .from('distribution_settings')
      .select('setting_key, setting_value');

    const settings = (settingsData || []).reduce((acc: Record<string, string>, curr: any) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, {});

    const { count: totalSup } = await supabase
      .from('supervisors')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalSch } = await supabase
      .from('schools')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      unassignedSupervisors,
      schoolsWithoutSupervisor: schoolsWithout || [],
      totalSupervisors: totalSup ?? 0,
      totalSchools: totalSch ?? 0,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
