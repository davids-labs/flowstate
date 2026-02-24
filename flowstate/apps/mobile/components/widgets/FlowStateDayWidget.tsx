'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface FlowStateDayWidgetProps {
  dayTitle?: string;
  dayNumber?: number;
  totalDays?: number;
  mustDoTotal?: number;
  mustDoDone?: number;
  modulesTracked?: number;
  modulesTotal?: number;
  planName?: string;
}

export function FlowStateDayWidget({
  dayTitle = 'No plan loaded',
  dayNumber,
  totalDays,
  mustDoTotal = 0,
  mustDoDone = 0,
  modulesTracked = 0,
  modulesTotal = 0,
  planName = 'FlowState',
}: FlowStateDayWidgetProps) {
  const mustDoPercent = mustDoTotal > 0 ? Math.round((mustDoDone / mustDoTotal) * 100) : 0;
  const modulePercent = modulesTotal > 0 ? Math.round((modulesTracked / modulesTotal) * 100) : 0;

  const dayLabel = dayNumber && totalDays
    ? `Day ${dayNumber} of ${totalDays}`
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: 16,
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
      }}
      accessibilityLabel="FlowState daily overview widget"
      clickAction="OPEN_APP"
    >
      {/* Header row */}
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
          text="⚡ FlowState"
          style={{
            fontSize: 13,
            color: '#8B8FA3',
          }}
        />
        <TextWidget
          text={dayLabel}
          style={{
            fontSize: 13,
            color: '#6C63FF',
            fontWeight: '600',
          }}
        />
      </FlexWidget>

      {/* Title */}
      <TextWidget
        text={dayTitle}
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: 12,
        }}
        maxLines={1}
      />

      {/* Stats row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* Must-Dos */}
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <TextWidget
            text="Must-Dos"
            style={{
              fontSize: 11,
              color: '#8B8FA3',
              marginBottom: 4,
            }}
          />
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text={`${mustDoDone}/${mustDoTotal}`}
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: mustDoPercent >= 100 ? '#4ADE80' : '#FFFFFF',
              }}
            />
            {mustDoTotal > 0 && (
              <TextWidget
                text={mustDoPercent >= 100 ? ' ✓' : ` ${mustDoPercent}%`}
                style={{
                  fontSize: 14,
                  color: mustDoPercent >= 100 ? '#4ADE80' : '#8B8FA3',
                  marginLeft: 4,
                }}
              />
            )}
          </FlexWidget>
        </FlexWidget>

        {/* Modules */}
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="Modules"
            style={{
              fontSize: 11,
              color: '#8B8FA3',
              marginBottom: 4,
            }}
          />
          <TextWidget
            text={`${modulesTracked}/${modulesTotal}`}
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: modulePercent >= 100 ? '#4ADE80' : '#FFFFFF',
            }}
          />
        </FlexWidget>

        {/* Progress ring visual (simple text-based) */}
        <FlexWidget
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#2A2A4A',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={`${mustDoTotal > 0 ? mustDoPercent : modulePercent}%`}
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#6C63FF',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
