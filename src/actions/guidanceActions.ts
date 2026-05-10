'use server';

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { getUser } from './authActions';
import { revalidatePath } from 'next/cache';

export async function getGuidanceData() {
  const user = await getUser();
  if (!user || user.role !== 'guidance') {
    return { error: 'Unauthorized' };
  }

  // Fetch supervisors matching the guidance specialty
  const { data: supervisors, error: supError } = await supabase
    .from('supervisors')
    .select('*')
    .eq('specialty', user.specialty)
    .order('name');

  if (supError) {
    return { error: supError.message };
  }

  // Fetch wishes for these supervisors
  const supIds = supervisors.map(s => s.id);
  
  let wishes = [];
  if (supIds.length > 0) {
    const { data: wishesData, error: wishesError } = await supabase
      .from('supervisor_wishes')
      .select('*')
      .in('supervisor_id', supIds);
      
    if (!wishesError && wishesData) {
      wishes = wishesData;
    }
  }

  // Fetch schools for wish selection
  const { data: schools } = await supabase
    .from('schools')
    .select('id, school_name, school_type, stage')
    .eq('is_active', true)
    .order('school_name');

  // Fetch all base schools (needed for the new tabs)
  const { data: base_schools } = await supabase
    .from('base_schools')
    .select('*')
    .order('school_name');

  // Fetch annual_schools for these supervisors
  let annual_schools = [];
  if (supIds.length > 0) {
    const { data: annualData } = await supabase
      .from('supervisor_annual_schools')
      .select('*, base_school:base_schools!base_school_id(*)')
      .in('supervisor_id', supIds);
    if (annualData) annual_schools = annualData;
  }

  // Determine subjects based on specialty
  const subjects = getSubjectsForSpecialty((user.specialty || '').trim());
  
  // Fetch teachers for these subjects
  let teachers = [];
  if (subjects.length > 0) {
    const { data: teachersData } = await supabase
      .from('teachers')
      .select('*, base_school:base_schools!base_school_id(id, school_name, stage, school_type)')
      .in('subject', subjects);
    if (teachersData) teachers = teachersData;
    if (teachersData) teachers = teachersData;
  }

  // Fetch settings for PDF reporting
  const { data: settingsData } = await supabase.from('settings').select('*');
  const settings = settingsData?.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {}) || {};

  return { 
    supervisors, 
    wishes, 
    schools: schools || [],
    base_schools: base_schools || [],
    annual_schools,
    teachers,
    settings,
    specialty: user.specialty 
  };
}

function getSubjectsForSpecialty(specialty: string): string[] {
  const cleanSpec = specialty.replace(/^ال/, '').trim(); // Remove "ال" prefix
  
  if (cleanSpec === 'علوم') return ['علوم', 'علوم لغات', 'كيمياء', 'فيزياء', 'أحياء', 'كيمياء لغات', 'فيزياء لغات', 'أحياء لغات', 'علوم متكاملة'];
  if (cleanSpec === 'دراسات اجتماعية' || cleanSpec === 'دراسات') return ['دراسات اجتماعية', 'دراسات', 'تاريخ', 'جغرافيا', 'تاريخ وجغرافيا'];
  if (cleanSpec === 'لغة عربية' || cleanSpec === 'لغه عربيه' || cleanSpec === 'لغة العربية' || cleanSpec === 'لغه العربيه' || specialty === 'اللغة العربية') return ['لغة عربية', 'لغه عربيه', 'عربي', 'لغة عربية (تربية دينية)', 'تربية إسلامية', 'تربيه اسلاميه', 'تربية دينية', 'تربيه دينيه'];
  if (cleanSpec === 'رياضيات') return ['رياضيات', 'رياضيات لغات'];
  return [specialty, cleanSpec];
}

export async function updateSupervisorActive(id: string, is_active: boolean) {
  const user = await getUser();
  if (!user || user.role !== 'guidance') return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('supervisors')
    .update({ is_active })
    .eq('id', id)
    .eq('specialty', user.specialty); // security check

  if (error) return { error: error.message };
  revalidatePath('/guidance');
  return { success: true };
}

export async function saveSupervisorWishes(supervisorId: string, wishes: { wish_1?: string, wish_2?: string, wish_3?: string, wish_4?: string, notes?: string }) {
  const user = await getUser();
  if (!user || user.role !== 'guidance') return { error: 'Unauthorized' };

  // check if supervisor belongs to this guidance
  const { data: sup } = await supabase.from('supervisors').select('id').eq('id', supervisorId).eq('specialty', user.specialty).single();
  if (!sup) return { error: 'Unauthorized' };

  const payload = {
    supervisor_id: supervisorId,
    wish_1: wishes.wish_1 || null,
    wish_2: wishes.wish_2 || null,
    wish_3: wishes.wish_3 || null,
    wish_4: wishes.wish_4 || null,
    notes: wishes.notes || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('supervisor_wishes')
    .upsert(payload, { onConflict: 'supervisor_id' });

  if (error) return { error: error.message };
  revalidatePath('/guidance');
  return { success: true };
}

export async function addSupervisorManually(data: { national_id: string; name: string; phone?: string }) {
  const user = await getUser();
  if (!user || user.role !== 'guidance') return { error: 'غير مصرح لك بهذا الإجراء' };

  const { error } = await supabase.from('supervisors').upsert({
    national_id: data.national_id,
    name: data.name,
    specialty: user.specialty,
    phone: data.phone || null,
    is_active: true,
  }, { onConflict: 'national_id' });

  if (error) return { error: error.message };
  revalidatePath('/guidance');
  return { success: true };
}

export async function assignAnnualSchools(supervisorId: string, schoolIds: string[]) {
  const user = await getUser();
  if (!user || user.role !== 'guidance') return { error: 'غير مصرح لك بهذا الإجراء' };

  // check if supervisor belongs to this guidance
  const { data: sup } = await supabase.from('supervisors').select('id').eq('id', supervisorId).eq('specialty', user.specialty).single();
  if (!sup) return { error: 'Unauthorized' };

  // Delete existing
  await supabase.from('supervisor_annual_schools').delete().eq('supervisor_id', supervisorId);

  if (schoolIds.length > 0) {
    const payload = schoolIds.map(id => ({
      supervisor_id: supervisorId,
      base_school_id: id,
    }));
    const { error } = await supabase.from('supervisor_annual_schools').insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath('/guidance');
  return { success: true };
}
