/**
 * Statistics — Desktop Data Mirror page.
 *
 * Six visualisation panels for a selected module:
 * Volume, Trend, Consistency, Circadian, Photo Stream, Raw Ledger.
 * Plus Goal Summary when active.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDatabase, useDatabaseReady } from '../components/DatabaseProvider';
import {
  VolumeBarChart,
  MetricTrendLineChart,
  ConsistencyGrid,
  CircadianClock,
  GoalSummaryCard,
  RawLedger,
} from '../components/charts';
import * as core from '@flowstate/core';

interface ModuleOption {
  id: string;
  label: string;
  emoji?: string | null;
  type: string;
}

type TimeRange = '7d' | '30d' | '90d' | '365d';

function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case '7d': start.setDate(start.getDate() - 7); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
    case '365d': start.setDate(start.getDate() - 365); break;
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function StatisticsPage() {
  const db = useDatabase();
  const ready = useDatabaseReady();

  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Data state
  const [volumeData, setVolumeData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [consistencyData, setConsistencyData] = useState<any>(null);
  const [circadianData, setCircadianData] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [goalMetrics, setGoalMetrics] = useState<any>(null);
  const [ledgerPage, setLedgerPage] = useState(1);

  // Load modules
  useEffect(() => {
    if (!db || !ready) return;
    core.getModuleSpecs(db).then((specs: any[]) => {
      setModules(
        specs.filter((s) => !s.archivedAt).map((s) => ({ id: s.id, label: s.label, emoji: s.emoji, type: s.type })),
      );
    });
  }, [db, ready]);

  // Load data
  useEffect(() => {
    if (!db || !ready || !selectedId) return;

    const { start, end } = getDateRange(timeRange);
    const groupBy = timeRange === '7d' || timeRange === '30d' ? 'day' : 'week';

    Promise.all([
      core.getModuleVolume(db, selectedId, start, end, groupBy),
      core.getMetricTrend(db, selectedId, start, end),
      core.getConsistencyGrid(db, selectedId),
      core.getCircadianDistribution(db, start, end, selectedId),
      core.getRawLedger(db, selectedId, { page: 1, pageSize: 50, startDate: start, endDate: end }),
      loadGoalMetrics(db, selectedId),
    ]).then(([vol, trend, consistency, circadian, ledger, goal]) => {
      setVolumeData(vol);
      setTrendData(trend);
      setConsistencyData(consistency);
      setCircadianData(circadian);
      setLedgerData(ledger);
      setGoalMetrics(goal);
      setLedgerPage(1);
    }).catch(console.error);
  }, [db, ready, selectedId, timeRange]);

  async function loadGoalMetrics(database: any, moduleId: string) {
    const goals = await core.getGoalsForModule(database, moduleId);
    if (goals.length === 0) return null;
    const sorted = [...goals].sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
    return core.calculateGoalMetrics(database, sorted[0].id);
  }

  const handleLoadMoreLedger = useCallback(async () => {
    if (!db || !selectedId || !ledgerData?.hasMore) return;
    const { start, end } = getDateRange(timeRange);
    const nextPage = ledgerPage + 1;
    const more = await core.getRawLedger(db, selectedId, { page: nextPage, pageSize: 50, startDate: start, endDate: end });
    setLedgerData({ ...more, entries: [...(ledgerData?.entries ?? []), ...more.entries] });
    setLedgerPage(nextPage);
  }, [db, selectedId, ledgerData, ledgerPage, timeRange]);

  const handleLedgerSearch = useCallback(
    async (query: string) => {
      if (!db || !selectedId) return;
      const { start, end } = getDateRange(timeRange);
      const results = await core.getRawLedger(db, selectedId, { page: 1, pageSize: 50, search: query || undefined, startDate: start, endDate: end });
      setLedgerData(results);
      setLedgerPage(1);
    },
    [db, selectedId, timeRange],
  );

  const TIME_RANGES: { key: TimeRange; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '365d', label: '1Y' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Statistics</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Data Mirror</p>

      {/* Module selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid var(--border)',
              background: selectedId === m.id ? '#2563EB' : 'var(--surface)',
              color: selectedId === m.id ? '#fff' : 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {m.emoji ? `${m.emoji} ` : ''}{m.label}
          </button>
        ))}
      </div>

      {!selectedId && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Select a module to view its data</div>
        </div>
      )}

      {selectedId && (
        <>
          {/* Time range */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {TIME_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: timeRange === r.key ? '#2563EB' : 'var(--surface)',
                  color: timeRange === r.key ? '#fff' : 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Goal Summary */}
            {goalMetrics && (
              <GoalSummaryCard
                label={goalMetrics.label}
                unit={goalMetrics.unit}
                startValue={goalMetrics.startValue}
                targetValue={goalMetrics.targetValue}
                currentValue={goalMetrics.currentValue}
                requiredDailyRate={goalMetrics.requiredDailyRate}
                actualDailyRate={goalMetrics.actualDailyRate}
                adjustedDailyRate={goalMetrics.adjustedDailyRate}
                daysRemaining={goalMetrics.daysRemaining}
                progressFraction={goalMetrics.progressFraction}
                isAhead={goalMetrics.isAhead}
                gapFromLinear={goalMetrics.gapFromLinear}
              />
            )}

            {/* Two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Volume Bar Chart */}
              {volumeData && (
                <div className="card" style={{ padding: 16 }}>
                  <VolumeBarChart
                    bars={volumeData.bars}
                    unit={volumeData.unit}
                    label={`${volumeData.label} — Volume`}
                  />
                </div>
              )}

              {/* Metric Trend Line */}
              {trendData && trendData.points.length > 0 && (
                <div className="card" style={{ padding: 16 }}>
                  <MetricTrendLineChart
                    points={trendData.points}
                    label={`${trendData.label} — Trend`}
                    unit={trendData.unit}
                    targetPath={goalMetrics?.targetPath}
                    gapFromTarget={goalMetrics?.gapFromLinear}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Consistency Grid */}
              {consistencyData && (
                <div className="card" style={{ padding: 16 }}>
                  <ConsistencyGrid
                    days={consistencyData.days}
                    label={`${consistencyData.label} — Consistency`}
                    totalLogged={consistencyData.totalLogged}
                  />
                </div>
              )}

              {/* Circadian Clock */}
              {circadianData && circadianData.totalSessions > 0 && (
                <div className="card" style={{ padding: 16 }}>
                  <CircadianClock
                    buckets={circadianData.buckets}
                    label={`${circadianData.label} — When`}
                    peakHour={circadianData.peakHour}
                    totalSessions={circadianData.totalSessions}
                  />
                </div>
              )}
            </div>

            {/* Raw Ledger (full width) */}
            {ledgerData && (
              <RawLedger
                entries={ledgerData.entries}
                label={`${trendData?.label ?? 'Module'} — Raw Log`}
                unit={trendData?.unit}
                hasMore={ledgerData.hasMore}
                onLoadMore={handleLoadMoreLedger}
                onSearch={handleLedgerSearch}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
