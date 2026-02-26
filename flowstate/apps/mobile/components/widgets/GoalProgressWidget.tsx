'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface GoalProgressWidgetProps {
  goals?: {
    label: string;
    emoji?: string;
    progressPercent: number;
    daysRemaining: number;
    isAhead: boolean;
  }[];
}

export function GoalProgressWidget({
  goals = [],
}: GoalProgressWidgetProps) {
  const displayed = goals.slice(0, 3); // max 3 goals to fit

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
          marginBottom: 10,
        }}
      >
        <TextWidget
          text="Goals"
          style={{ fontSize: 13, color: '#8B8FA3' }}
        />
        <TextWidget
          text={`${goals.length} active`}
          style={{ fontSize: 13, color: '#6C63FF', fontWeight: '600' }}
        />
      </FlexWidget>

      {/* Goals */}
      {displayed.length === 0 ? (
        <TextWidget
          text="No active goals"
          style={{ fontSize: 14, color: '#8B8FA3' }}
        />
      ) : (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'column',
          }}
        >
          {displayed.map((g, i) => {
            const pct = Math.min(Math.round(g.progressPercent * 100), 100);
            return (
              <FlexWidget
                key={`goal-${i}`}
                style={{
                  width: 'match_parent',
                  flexDirection: 'column',
                  marginBottom: 8,
                }}
              >
                {/* Label row */}
                <FlexWidget
                  style={{
                    width: 'match_parent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <TextWidget
                    text={`${g.label}`}
                    style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '500' }}
                    maxLines={1}
                  />
                  <TextWidget
                    text={`${g.daysRemaining}d left`}
                    style={{ fontSize: 11, color: '#8B8FA3' }}
                  />
                </FlexWidget>

                {/* Progress bar background */}
                <FlexWidget
                  style={{
                    width: 'match_parent',
                    height: 8,
                    backgroundColor: '#2A2A4A',
                    borderRadius: 4,
                  }}
                >
                  {/* Progress bar fill — use width as percentage of parent */}
                  <FlexWidget
                    style={{
                      width: `${pct}%` as any,
                      height: 8,
                      backgroundColor: g.isAhead ? '#4ADE80' : '#6C63FF',
                      borderRadius: 4,
                    }}
                  />
                </FlexWidget>

                {/* Status */}
                <TextWidget
                  text={`${pct}% — ${g.isAhead ? 'Ahead' : 'Behind'}`}
                  style={{
                    fontSize: 11,
                    color: g.isAhead ? '#4ADE80' : '#F59E0B',
                    fontWeight: '600',
                  }}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
