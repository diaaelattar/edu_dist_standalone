// =============================================================================
// Enterprise Distribution Service — Full CRUD + Business Logic
// =============================================================================

import { supabase } from '@/lib/supabase';
import {
  School, Supervisor, SupervisorWish, DistributionRun,
  DistributionResult, DistributionSetting,
  SchoolFormData, SupervisorFormData, WishFormData,
  AssignmentPayload, AlgorithmParams, DistributionStats,
  BaseSchool, BaseSchoolFormData,
  Teacher, TeacherFormData
} from '@/types/database';

// ────────────────────────────────────────────────────────────
// BASE SCHOOLS (المدارس الأساسية)
// ────────────────────────────────────────────────────────────

export async function getAllBaseSchools(): Promise<BaseSchool[]> {
  const { data, error } = await supabase
    .from('base_schools')
    .select('*')
    .order('school_name');
  if (error) throw error;
  return data ?? [];
}

export async function createBaseSchool(data: BaseSchoolFormData): Promise<BaseSchool> {
  const { data: school, error } = await supabase
    .from('base_schools')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return school;
}

export async function updateBaseSchool(id: string, data: Partial<BaseSchoolFormData>): Promise<BaseSchool> {
  const { data: school, error } = await supabase
    .from('base_schools')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return school;
}

export async function deleteBaseSchool(id: string): Promise<void> {
  const { error } = await supabase
    .from('base_schools')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// EXAM SCHOOLS (لجان الامتحانات)
// ────────────────────────────────────────────────────────────

export async function getAllSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('is_active', true)
    .order('school_name');
  if (error) throw error;
  return data ?? [];
}

export async function createSchool(data: SchoolFormData): Promise<School> {
  const { data: school, error } = await supabase
    .from('schools')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return school;
}

export async function updateSchool(id: string, data: Partial<SchoolFormData>): Promise<School> {
  const { data: school, error } = await supabase
    .from('schools')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return school;
}

export async function deleteSchool(id: string): Promise<void> {
  const { error } = await supabase
    .from('schools')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// SUPERVISORS
// ────────────────────────────────────────────────────────────

export async function getAllSupervisors(): Promise<Supervisor[]> {
  const { data, error } = await supabase
    .from('supervisors')
    .select('*, home_school:schools!home_school_id(id, school_name, school_code)')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getAllSupervisorsIncludingInactive(): Promise<Supervisor[]> {
  const { data, error } = await supabase
    .from('supervisors')
    .select(`
      *, 
      home_school:schools!home_school_id(id, school_name, school_code),
      annual_schools:supervisor_annual_schools(id, base_school_id, base_school:base_schools(school_name))
    `)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function toggleSupervisorActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('supervisors')
    .update({ is_active })
    .eq('id', id);
  if (error) throw error;
}

export async function setMandatorySupervisor(schoolId: string, supervisorId: string | null): Promise<void> {
  const { error } = await supabase
    .from('schools')
    .update({ mandatory_supervisor_id: supervisorId })
    .eq('id', schoolId);
  if (error) throw error;
}


export async function createSupervisor(data: SupervisorFormData): Promise<Supervisor> {
  const { data: sup, error } = await supabase
    .from('supervisors')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return sup;
}

export async function updateSupervisor(id: string, data: Partial<SupervisorFormData>): Promise<Supervisor> {
  const { data: sup, error } = await supabase
    .from('supervisors')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return sup;
}

export async function deleteSupervisor(id: string): Promise<void> {
  const { error } = await supabase
    .from('supervisors')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function updateSupervisorAnnualSchools(supervisorId: string, baseSchoolIds: string[]): Promise<void> {
  // 1. Delete existing
  const { error: delError } = await supabase
    .from('supervisor_annual_schools')
    .delete()
    .eq('supervisor_id', supervisorId);
  if (delError) throw delError;

  // 2. Insert new ones
  if (baseSchoolIds.length > 0) {
    const payload = baseSchoolIds.map(id => ({ supervisor_id: supervisorId, base_school_id: id }));
    const { error: insError } = await supabase
      .from('supervisor_annual_schools')
      .insert(payload);
    if (insError) throw insError;
  }
}

// ────────────────────────────────────────────────────────────
// WISHES / PREFERENCES
// ────────────────────────────────────────────────────────────

export async function getAllWishes(): Promise<SupervisorWish[]> {
  const { data, error } = await supabase
    .from('supervisor_wishes')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, name, specialty),
      school_1:schools!wish_1(id, school_name),
      school_2:schools!wish_2(id, school_name),
      school_3:schools!wish_3(id, school_name),
      school_4:schools!wish_4(id, school_name)
    `);
  if (error) throw error;
  return data ?? [];
}

export async function getSupervisorWishes(): Promise<SupervisorWish[]> {
  const { data, error } = await supabase
    .from('supervisor_wishes')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function upsertWish(data: WishFormData): Promise<void> {
  const { error } = await supabase
    .from('supervisor_wishes')
    .upsert(data, { onConflict: 'supervisor_id' });
  if (error) throw error;
}

export async function deleteWish(supervisor_id: string): Promise<void> {
  const { error } = await supabase
    .from('supervisor_wishes')
    .delete()
    .eq('supervisor_id', supervisor_id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// DISTRIBUTION RUNS
// ────────────────────────────────────────────────────────────

export async function createDistributionRun(params: {
  run_name: string;
  academic_year: string;
  algorithm_params: AlgorithmParams;
}): Promise<DistributionRun> {
  const { data, error } = await supabase
    .from('distribution_runs')
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRunStats(
  runId: string,
  stats: DistributionStats
): Promise<void> {
  const { error } = await supabase
    .from('distribution_runs')
    .update({
      status: 'completed',
      total_assigned: stats.total,
      total_forced: stats.forced,
      satisfaction_rate: stats.satisfaction_rate,
    })
    .eq('id', runId);
  if (error) throw error;
}

export async function getAllRuns(): Promise<DistributionRun[]> {
  const { data, error } = await supabase
    .from('distribution_runs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteRun(id: string): Promise<void> {
  // Results are cascade deleted
  const { error } = await supabase
    .from('distribution_runs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// DISTRIBUTION RESULTS
// ────────────────────────────────────────────────────────────

export async function saveDistributionResults(
  runId: string,
  assignments: AssignmentPayload[]
): Promise<void> {
  const rows = assignments.map(a => ({
    run_id: runId,
    supervisor_id: a.supervisor_id,
    assigned_school_id: a.assigned_school_id,
    final_score: a.final_score,
    rank_achieved: a.rank_achieved,
    is_forced: a.is_forced,
    score_breakdown: a.score_breakdown,
    rejection_reasons: a.rejection_reasons,
  }));

  const { error } = await supabase
    .from('distribution_results')
    .insert(rows);
  if (error) throw error;
}

export async function getResultsByRun(runId: string): Promise<DistributionResult[]> {
  const { data, error } = await supabase
    .from('distribution_results')
    .select(`
      *,
      supervisor:supervisors!supervisor_id(id, name, specialty, stage, school_type),
      school:schools!assigned_school_id(id, school_name, school_code, stage, school_type)
    `)
    .eq('run_id', runId)
    .order('final_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestResults(): Promise<DistributionResult[]> {
  // Get the most recent completed run
  const { data: run } = await supabase
    .from('distribution_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!run) return [];
  return getResultsByRun(run.id);
}

export async function updateResultSchool(
  resultId: string,
  newSchoolId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('distribution_results')
    .update({
      assigned_school_id: newSchoolId,
      is_manual_override: true,
    })
    .eq('id', resultId);
  if (error) throw error;

  // Log the override
  const { data: result } = await supabase
    .from('distribution_results')
    .select('run_id, assigned_school_id')
    .eq('id', resultId)
    .single();

  if (result) {
    await supabase.from('override_logs').insert({
      run_id: result.run_id,
      result_id: resultId,
      new_school_id: newSchoolId,
      override_reason: reason,
    });
  }
}

// ────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('distribution_settings')
    .select('setting_key, setting_value');
  if (error) throw error;

  const map: Record<string, string> = {};
  (data ?? []).forEach(s => { map[s.setting_key] = s.setting_value; });
  return map;
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('distribution_settings')
    .update({ setting_value: value })
    .eq('setting_key', key);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// USERS MANAGEMENT
// ────────────────────────────────────────────────────────────

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('username');
  if (error) throw error;
  return data;
}

export async function createUser(data: any) {
  const { data: user, error } = await supabase
    .from('users')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return user;
}

export async function updateUser(id: string, data: any) {
  const { data: user, error } = await supabase
    .from('users')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return user;
}

export async function deleteUser(id: string) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getUniqueSpecialties(): Promise<string[]> {
  const { data, error } = await supabase
    .from('supervisors')
    .select('specialty');
  if (error) throw error;
  
  const specs = Array.from(new Set((data ?? []).map(s => s.specialty).filter(Boolean))).sort();
  return specs.length > 0 ? specs : ['عام'];
}

export async function getUniqueStages(): Promise<string[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('stage');
  if (error) throw error;
  
  const stages = Array.from(new Set((data ?? []).map(s => s.stage).filter(Boolean))).sort();
  return stages.length > 0 ? stages : ['إعدادي'];
}

// ────────────────────────────────────────────────────────────
// TEACHERS (بوابة المعلمين)
// ────────────────────────────────────────────────────────────

export async function getTeacherByNID(nid: string): Promise<Teacher | null> {
  const { data, error } = await supabase
    .from('teachers')
    .select('*, base_school:base_schools!base_school_id(id, school_name, stage, school_type)')
    .eq('national_id', nid)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data ?? null;
}

export async function upsertTeacher(teacherData: TeacherFormData): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .upsert(teacherData, { onConflict: 'national_id' })
    .select('*, base_school:base_schools!base_school_id(id, school_name, stage, school_type)')
    .single();
  if (error) throw error;
  return data;
}

export async function getAllTeachers(): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('*, base_school:base_schools!base_school_id(id, school_name, stage, school_type)')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getTeachersBySchool(baseSchoolId: string): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('base_school_id', baseSchoolId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function deleteTeacher(id: string): Promise<void> {
  const { error } = await supabase
    .from('teachers')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}


