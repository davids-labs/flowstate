'use no memo';

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface QuickLogWidgetProps {
  modules?: { id: string; label: string; emoji?: string; logged?: boolean }[];
}

export function QuickLogWidget({
  modules = [],
}: QuickLogWidgetProps) {
  const displayed = modules.slice(0, 6); // max 6 to fit the widget

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
          text="⚡ Quick Log"
          style={{ fontSize: 13, color: '#8B8FA3' }}
        />
        <TextWidget
          text={`${modules.filter((m) => m.logged).length}/${modules.length}`}
          style={{ fontSize: 13, color: '#6C63FF', fontWeight: '600' }}
        />
      </FlexWidget>

      {/* Module list */}
      {displayed.length === 0 ? (
        <TextWidget
          text="No modules to log"
          style={{ fontSize: 14, color: '#8B8FA3' }}
        />
      ) : (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'column',
          }}
        >
          {displayed.map((m, i) => (
            <FlexWidget
              key={`mod-${i}`}
              style={{
                width: 'match_parent',
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 4,
                paddingHorizontal: 8,
                backgroundColor: m.logged ? '#1E3A2F' : '#2A2A4A',
                borderRadius: 8,
              }}
            >
              <TextWidget
                text={m.emoji ?? '📦'}
                style={{ fontSize: 14, marginRight: 8 }}
              />
              <TextWidget
                text={m.label}
                style={{
                  fontSize: 13,
                  color: m.logged ? '#4ADE80' : '#FFFFFF',
                  fontWeight: '500',
                }}
                maxLines={1}
              />
              <TextWidget
                text={m.logged ? '✓' : '○'}
                style={{
                  fontSize: 14,
                  color: m.logged ? '#4ADE80' : '#8B8FA3',
                  fontWeight: '700',
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
