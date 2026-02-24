'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface WeeklyStatsWidgetProps {
  weekDays?: { label: string; count: number }[];
  maxCount?: number;
  weekTotal?: number;
  streakCount?: number;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_MAX_HEIGHT = 48;

export function WeeklyStatsWidget({
  weekDays = DAYS.map((d) => ({ label: d, count: 0 })),
  maxCount = 1,
  weekTotal = 0,
  streakCount = 0,
}: WeeklyStatsWidgetProps) {
  const safeMax = Math.max(maxCount, 1);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: 16,
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
      }}
      clickAction="OPEN_APP"
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="📊 Weekly Stats"
          style={{ fontSize: 13, color: '#8B8FA3' }}
        />
        <TextWidget
          text={`🔥 ${streakCount} day streak`}
          style={{ fontSize: 13, color: '#F59E0B', fontWeight: '600' }}
        />
      </FlexWidget>

      {/* Bar chart */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          height: BAR_MAX_HEIGHT + 20,
          marginBottom: 4,
        }}
      >
        {weekDays.map((day, i) => {
          const barHeight = Math.max((day.count / safeMax) * BAR_MAX_HEIGHT, 2);
          return (
            <FlexWidget
              key={`bar-${i}`}
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}
            >
              <FlexWidget
                style={{
                  width: 16,
                  height: barHeight,
                  backgroundColor: day.count > 0 ? '#6C63FF' : '#2A2A4A',
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              />
              <TextWidget
                text={day.label}
                style={{ fontSize: 10, color: '#8B8FA3' }}
              />
            </FlexWidget>
          );
        })}
      </FlexWidget>

      {/* Footer */}
      <TextWidget
        text={`${weekTotal} sessions this week`}
        style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}
      />
    </FlexWidget>
  );
}
