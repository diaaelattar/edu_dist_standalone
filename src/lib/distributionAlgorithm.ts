// =============================================================================
// Enterprise Distribution Algorithm - v1.0.1
// خوارزمية التوزيع الذكي - نظام مبني على الأولويات والعدالة والشرح
// =============================================================================

import {
  School, Supervisor, SupervisorWish,
  AlgorithmParams, AlgorithmResult, AssignmentPayload,
  ScoreBreakdown, RejectionReason, DistributionStats,
  DEFAULT_PARAMS, RankLabel,
} from '@/types/database';

// ─────────────────────────────────────────────────────────
// PHASE 1: HARD CONSTRAINT CHECK
// ─────────────────────────────────────────────────────────

function isEligible(supervisor: Supervisor, school: School): boolean {
  // Rule: Cannot be assigned to own school
  if (supervisor.home_school_id && supervisor.home_school_id === school.id) {
    return false;
  }
  
  // Rule: Cannot be assigned to an exam school if they monitor it annually (by name)
  if (supervisor.annual_schools && supervisor.annual_schools.length > 0) {
    const isMonitored = supervisor.annual_schools.some(
      as => as.base_school?.school_name === school.school_name
    );
    if (isMonitored) return false;
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────
// PHASE 2: DYNAMIC SCORING MODEL
// ─────────────────────────────────────────────────────────

function calculateScore(
  supervisor: Supervisor,
  school: School,
  wish: SupervisorWish | undefined,
  currentLoad: number,
  params: AlgorithmParams
): ScoreBreakdown {
  let preference_score = 0;
  let preference_label: RankLabel | null = null;

  if (wish) {
    if (wish.wish_1 === school.id) {
      preference_score = params.wish1_score;
      preference_label = 'رغبة أولى';
    } else if (wish.wish_2 === school.id) {
      preference_score = params.wish2_score;
      preference_label = 'رغبة ثانية';
    } else if (wish.wish_3 === school.id) {
      preference_score = params.wish3_score;
      preference_label = 'رغبة ثالثة';
    } else if (wish.wish_4 === school.id) {
      preference_score = params.wish4_score;
      preference_label = 'رغبة رابعة';
    } else {
      preference_score = params.forced_score;
      preference_label = 'توزيع اضطراري';
    }
  } else {
    preference_score = params.forced_score;
    preference_label = 'توزيع اضطراري';
  }

  // Specialization match bonus
  const specialization_score =
    supervisor.specialty && school.specialization &&
    supervisor.specialty === school.specialization
      ? params.specialization_bonus
      : 0;

  // Stage match bonus
  const stage_score =
    supervisor.stage && school.stage && supervisor.stage === school.stage
      ? params.stage_bonus
      : 0;

  // School type match bonus
  const type_score =
    supervisor.school_type && school.school_type &&
    supervisor.school_type === school.school_type
      ? params.type_bonus
      : 0;

  // Workload penalty (dynamic — increases per existing assignment)
  const workload_penalty = currentLoad * params.workload_penalty;

  const total =
    preference_score + specialization_score + stage_score + type_score - workload_penalty;

  return {
    preference_score,
    specialization_score,
    stage_score,
    type_score,
    workload_penalty,
    total,
    preference_label,
  };
}

// ─────────────────────────────────────────────────────────
// PHASE 3: FAIRNESS-AWARE GREEDY ASSIGNMENT
// ─────────────────────────────────────────────────────────

export function runDistributionAlgorithm(
  supervisors: Supervisor[],
  schools: School[],
  wishes: SupervisorWish[],
  params: AlgorithmParams = DEFAULT_PARAMS
): AlgorithmResult {
  // Map for fast lookup
  const wishesMap = new Map<string, SupervisorWish>();
  wishes.forEach(w => wishesMap.set(w.supervisor_id, w));

  // Track how many schools each supervisor is currently assigned to
  const supervisorLoad = new Map<string, number>();
  supervisors.forEach(s => supervisorLoad.set(s.id, 0));

  // Track how many slots remain for each school
  const schoolCapacities = new Map<string, number>();
  schools.forEach(s => schoolCapacities.set(s.id, s.needs_count ?? 1));

  const assignments: AssignmentPayload[] = [];

  // Process schools sorted by needs_count desc (schools needing more evaluators first)
  const orderedSchools = [...schools].sort(
    (a, b) => (b.needs_count ?? 1) - (a.needs_count ?? 1)
  );

  // ─────────────────────────────────────────────────────────
  // PHASE 1.5: PROCESS MANDATORY ASSIGNMENTS (Admin Pre-assignments)
  // ─────────────────────────────────────────────────────────
  for (const school of orderedSchools) {
    if (school.mandatory_supervisor_id) {
      const sup = supervisors.find(s => s.id === school.mandatory_supervisor_id);
      if (sup) {
        // Find if this was requested to track rank, but it's forced anyway
        const wish = wishesMap.get(sup.id);
        const rankAchieved =
          wish?.wish_1 === school.id ? 1
          : wish?.wish_2 === school.id ? 2
          : wish?.wish_3 === school.id ? 3
          : wish?.wish_4 === school.id ? 4 : 0;

        assignments.push({
          supervisor_id: sup.id,
          assigned_school_id: school.id,
          final_score: 9999, // Max score to ensure it stays locked
          rank_achieved: rankAchieved,
          is_forced: true,
          score_breakdown: {
            preference_score: 0,
            specialization_score: 0,
            stage_score: 0,
            type_score: 0,
            workload_penalty: 0,
            total: 9999,
            preference_label: 'تكليف إداري (إجباري)' as any,
          },
          rejection_reasons: [],
        });

        // Update load and capacity
        supervisorLoad.set(sup.id, (supervisorLoad.get(sup.id) ?? 0) + 1);
        let capacity = schoolCapacities.get(school.id) ?? 1;
        schoolCapacities.set(school.id, capacity - 1);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 3: FAIRNESS-AWARE GREEDY ASSIGNMENT
  // ─────────────────────────────────────────────────────────
  for (const school of orderedSchools) {
    let capacity = schoolCapacities.get(school.id) ?? 0;

    while (capacity > 0) {
      // Find the best available supervisor for this school slot
      let bestSupervisor: Supervisor | null = null;
      let bestBreakdown: ScoreBreakdown | null = null;
      const rejectedThisRound: RejectionReason[] = [];

      for (const sup of supervisors) {
        const load = supervisorLoad.get(sup.id) ?? 0;
        const maxLoad = 1; // HARD RULE: No supervisor assigned to more than one school

        // HARD CONSTRAINT: max load exceeded
        if (load >= maxLoad) {
          rejectedThisRound.push({
            supervisor_id: sup.id,
            supervisor_name: sup.name,
            reason: 'max_load',
            details: `الموجه وصل للحد الأقصى (${maxLoad} مدارس)`,
          });
          continue;
        }

        // HARD CONSTRAINT: own school or annual monitored school
        if (!isEligible(sup, school)) {
          rejectedThisRound.push({
            supervisor_id: sup.id,
            supervisor_name: sup.name,
            reason: 'own_school',
            details: 'مدرسته الأصلية أو إحدى المدارس التي يتابعها (للشفافية)',
          });
          continue;
        }

        // HARD CONSTRAINT: already assigned to this school in this run
        const alreadyAssignedHere = assignments.some(
          a => a.supervisor_id === sup.id && a.assigned_school_id === school.id
        );
        if (alreadyAssignedHere) {
          continue;
        }

        const wish = wishesMap.get(sup.id);
        const breakdown = calculateScore(sup, school, wish, load, params);

        if (!bestSupervisor || breakdown.total > (bestBreakdown?.total ?? -Infinity)) {
          // Track previously rejected best as lower_score
          if (bestSupervisor) {
            rejectedThisRound.push({
              supervisor_id: bestSupervisor.id,
              supervisor_name: bestSupervisor.name,
              reason: 'lower_score',
              details: `سجل أقل: ${bestBreakdown?.total?.toFixed(1)}`,
            });
          }
          bestSupervisor = sup;
          bestBreakdown = breakdown;
        } else {
          rejectedThisRound.push({
            supervisor_id: sup.id,
            supervisor_name: sup.name,
            reason: 'lower_score',
            details: `سجل أقل: ${breakdown.total.toFixed(1)}`,
          });
        }
      }

      if (!bestSupervisor || !bestBreakdown) {
        // No eligible supervisor found for this slot
        break;
      }

      const wish = wishesMap.get(bestSupervisor.id);
      const rankAchieved =
        wish?.wish_1 === school.id ? 1
        : wish?.wish_2 === school.id ? 2
        : wish?.wish_3 === school.id ? 3
        : wish?.wish_4 === school.id ? 4
        : 0;

      assignments.push({
        supervisor_id: bestSupervisor.id,
        assigned_school_id: school.id,
        final_score: bestBreakdown.total,
        rank_achieved: rankAchieved,
        is_forced: rankAchieved === 0,
        score_breakdown: bestBreakdown,
        rejection_reasons: rejectedThisRound.filter(
          r => r.supervisor_id !== bestSupervisor!.id
        ),
      });

      supervisorLoad.set(
        bestSupervisor.id,
        (supervisorLoad.get(bestSupervisor.id) ?? 0) + 1
      );
      capacity--;
      schoolCapacities.set(school.id, capacity);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 4: OPTIONAL OPTIMIZATION PASS (Swap Improvement)
  // ─────────────────────────────────────────────────────────
  if (params.run_optimization) {
    optimizeSwaps(assignments, supervisors, schools, wishesMap, params);
  }

  // ─────────────────────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────────────────────
  const stats = computeStats(assignments, supervisors, schools);

  return { assignments, stats };
}

// ─────────────────────────────────────────────────────────
// OPTIMIZATION: Swap-Based Improvement
// Try swapping two assignments to improve total satisfaction
// ─────────────────────────────────────────────────────────

function optimizeSwaps(
  assignments: AssignmentPayload[],
  supervisors: Supervisor[],
  schools: School[],
  wishesMap: Map<string, SupervisorWish>,
  params: AlgorithmParams
): void {
  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;

    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i];
        const b = assignments[j];

        // Skip if same supervisor
        if (a.supervisor_id === b.supervisor_id) continue;

        const supA = supervisors.find(s => s.id === a.supervisor_id);
        const supB = supervisors.find(s => s.id === b.supervisor_id);
        const schoolA = schools.find(s => s.id === a.assigned_school_id);
        const schoolB = schools.find(s => s.id === b.assigned_school_id);

        if (!supA || !supB || !schoolA || !schoolB) continue;

        // SKIP IF EITHER IS A MANDATORY ASSIGNMENT (Locked by Admin)
        if (schoolA.mandatory_supervisor_id === supA.id || schoolB.mandatory_supervisor_id === supB.id) continue;
        if (a.final_score === 9999 || b.final_score === 9999) continue;

        // Check eligibility for swap
        if (!isEligible(supA, schoolB) || !isEligible(supB, schoolA)) continue;

        // Current load (subtract 1 since we're considering a swap)
        const loadA = (assignments.filter(x => x.supervisor_id === a.supervisor_id).length) - 1;
        const loadB = (assignments.filter(x => x.supervisor_id === b.supervisor_id).length) - 1;

        const wishA = wishesMap.get(a.supervisor_id);
        const wishB = wishesMap.get(b.supervisor_id);

        const currentScore = a.final_score + b.final_score;
        const newBreakdownA = calculateScore(supA, schoolB, wishA, loadA, params);
        const newBreakdownB = calculateScore(supB, schoolA, wishB, loadB, params);
        const newScore = newBreakdownA.total + newBreakdownB.total;

        if (newScore > currentScore + 1) {
          // Swap is beneficial
          const rankA = wishA?.wish_1 === schoolB.id ? 1
            : wishA?.wish_2 === schoolB.id ? 2
            : wishA?.wish_3 === schoolB.id ? 3
            : wishA?.wish_4 === schoolB.id ? 4 : 0;

          const rankB = wishB?.wish_1 === schoolA.id ? 1
            : wishB?.wish_2 === schoolA.id ? 2
            : wishB?.wish_3 === schoolA.id ? 3
            : wishB?.wish_4 === schoolA.id ? 4 : 0;

          assignments[i] = {
            ...a,
            assigned_school_id: schoolB.id,
            final_score: newBreakdownA.total,
            rank_achieved: rankA,
            is_forced: rankA === 0,
            score_breakdown: newBreakdownA,
          };
          assignments[j] = {
            ...b,
            assigned_school_id: schoolA.id,
            final_score: newBreakdownB.total,
            rank_achieved: rankB,
            is_forced: rankB === 0,
            score_breakdown: newBreakdownB,
          };

          improved = true;
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// STATISTICS COMPUTATION
// ─────────────────────────────────────────────────────────

function computeStats(
  assignments: AssignmentPayload[],
  supervisors: Supervisor[],
  schools: School[]
): DistributionStats {
  const total = assignments.length;
  const by_wish_1 = assignments.filter(a => a.rank_achieved === 1).length;
  const by_wish_2 = assignments.filter(a => a.rank_achieved === 2).length;
  const by_wish_3 = assignments.filter(a => a.rank_achieved === 3).length;
  const by_wish_4 = assignments.filter(a => a.rank_achieved === 4).length;
  const forced = assignments.filter(a => a.is_forced).length;

  const totalNeeded = schools.reduce((sum, s) => sum + (s.needs_count ?? 1), 0);
  const unassigned = totalNeeded - total;

  const wishBased = by_wish_1 + by_wish_2 + by_wish_3 + by_wish_4;
  const satisfaction_rate = total > 0 ? Math.round((wishBased / total) * 100) : 0;
  const avg_score = total > 0
    ? Math.round(assignments.reduce((sum, a) => sum + a.final_score, 0) / total)
    : 0;

  return {
    total,
    by_wish_1,
    by_wish_2,
    by_wish_3,
    by_wish_4,
    forced,
    unassigned,
    satisfaction_rate,
    avg_score,
  };
}

// ─────────────────────────────────────────────────────────
// HELPER: Get rank label in Arabic
// ─────────────────────────────────────────────────────────

export function getRankLabel(rank: number): RankLabel {
  switch (rank) {
    case 1: return 'رغبة أولى';
    case 2: return 'رغبة ثانية';
    case 3: return 'رغبة ثالثة';
    case 4: return 'رغبة رابعة';
    default: return 'توزيع اضطراري';
  }
}

export function getRankColor(rank: number): string {
  switch (rank) {
    case 1: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 2: return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    case 3: return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 4: return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    default: return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  }
}
