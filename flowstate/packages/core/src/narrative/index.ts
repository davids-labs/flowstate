/**
 * Weekly narrative generator — template-based text that summarises a
 * week of FlowState data in a short, personal paragraph.
 */

import type { WeeklyAggregate } from '../db/analytics';

// ─── Helpers ────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function plural(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

function trendWord(trend: 'up' | 'down' | 'flat'): string {
  return trend === 'up' ? 'trending up' : trend === 'down' ? 'trending down' : 'holding steady';
}

// ─── Fragments ──────────────────────────────────────────────────

function sessionFragment(agg: WeeklyAggregate): string {
  const { totalSessions, completed, completionRate } = agg.sessionStats;
  if (totalSessions === 0) return 'No sessions were scheduled this week.';
  return `You completed ${plural(completed, 'session')} out of ${totalSessions} (${pct(completionRate)}).`;
}

function mustDoFragment(agg: WeeklyAggregate): string {
  const { totalItems, completedItems, completionRate } = agg.mustDoStats;
  if (totalItems === 0) return '';
  if (completionRate === 1) return 'Every must-do item was checked off — perfect consistency.';
  if (completionRate >= 0.8) return `Must-do completion was strong at ${pct(completionRate)}.`;
  if (completionRate >= 0.5)
    return `Must-do completion was at ${pct(completionRate)} — room to tighten up.`;
  return `Must-do completion was only ${pct(completionRate)}. Consider trimming the list to what truly matters.`;
}

function checkboxFragment(agg: WeeklyAggregate): string {
  if (agg.checkboxCompliance.length === 0) return '';
  const best = agg.checkboxCompliance.reduce((a, b) => (a.rate > b.rate ? a : b));
  const worst = agg.checkboxCompliance.reduce((a, b) => (a.rate < b.rate ? a : b));
  if (agg.checkboxCompliance.length === 1) {
    return `"${best.label}" hit ${pct(best.rate)} compliance.`;
  }
  if (best.rate === worst.rate) {
    return `Your habits were uniformly at ${pct(best.rate)}.`;
  }
  return `"${best.label}" led habits at ${pct(best.rate)} while "${worst.label}" lagged at ${pct(worst.rate)}.`;
}

function ratingFragment(agg: WeeklyAggregate): string {
  if (agg.ratingTrends.length === 0) return '';
  const lines = agg.ratingTrends
    .map((r) => `${r.label} averaged ${r.average}/5 (${trendWord(r.trend)})`)
    .join('; ');
  return lines + '.';
}

function dataFragment(agg: WeeklyAggregate): string {
  if (agg.dataInputStats.length === 0) return '';
  const lines = agg.dataInputStats
    .filter((d) => d.target !== null)
    .map((d) => {
      const hitRate = d.totalDays > 0 ? d.daysOnTarget / d.totalDays : 0;
      return `${d.label}: averaged ${d.average}${d.unit ? ' ' + d.unit : ''}, hit target ${pct(hitRate)} of days`;
    });
  if (lines.length === 0) return '';
  return lines.join('. ') + '.';
}

function streakFragment(agg: WeeklyAggregate): string {
  const active = agg.streaks.filter((s) => s.currentStreak > 0);
  if (active.length === 0) return '';
  const best = active.reduce((a, b) => (a.currentStreak > b.currentStreak ? a : b));
  return `Longest active streak: "${best.label}" at ${plural(best.currentStreak, 'day')}.`;
}

function quietFragment(agg: WeeklyAggregate): string {
  if (agg.quietDays === 0) return '';
  if (agg.quietDays === 1) return 'You took 1 quiet day for rest.';
  return `You took ${agg.quietDays} quiet days for rest.`;
}

// ─── Opener ─────────────────────────────────────────────────────

function opener(agg: WeeklyAggregate): string {
  const { completionRate } = agg.sessionStats;
  const mustDoRate = agg.mustDoStats.completionRate;
  const overall = (completionRate + mustDoRate) / 2;
  if (overall >= 0.9) return 'An outstanding week.';
  if (overall >= 0.75) return 'A solid week overall.';
  if (overall >= 0.5) return 'A mixed week with highs and lows.';
  if (overall > 0) return 'A tough week — progress is still progress.';
  return 'Quiet week. Every pause is a chance to reset.';
}

// ─── Public API ─────────────────────────────────────────────────

export function generateWeeklyNarrative(agg: WeeklyAggregate): string {
  const parts = [
    opener(agg),
    sessionFragment(agg),
    mustDoFragment(agg),
    checkboxFragment(agg),
    ratingFragment(agg),
    dataFragment(agg),
    streakFragment(agg),
    quietFragment(agg),
  ].filter(Boolean);

  return parts.join(' ');
}
