import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { FlowStateDayWidget } from './components/widgets/FlowStateDayWidget';
import { WeeklyStatsWidget } from './components/widgets/WeeklyStatsWidget';
import { QuickLogWidget } from './components/widgets/QuickLogWidget';
import { GoalProgressWidget } from './components/widgets/GoalProgressWidget';
import { readWidgetSnapshot, readWeeklyStatsSnapshot, readQuickLogSnapshot, readGoalProgressSnapshot } from './services/widgetData';

const nameToWidget: Record<string, React.ComponentType<any>> = {
  FlowStateDay: FlowStateDayWidget,
  FlowStateWeeklyStats: WeeklyStatsWidget,
  FlowStateQuickLog: QuickLogWidget,
  FlowStateGoalProgress: GoalProgressWidget,
};

async function getWidgetProps(widgetName: string) {
  if (widgetName === 'FlowStateWeeklyStats') {
    return (await readWeeklyStatsSnapshot()) ?? {};
  }
  if (widgetName === 'FlowStateQuickLog') {
    return (await readQuickLogSnapshot()) ?? {};
  }
  if (widgetName === 'FlowStateGoalProgress') {
    return (await readGoalProgressSnapshot()) ?? {};
  }
  // Default: FlowStateDay
  const snapshot = await readWidgetSnapshot();
  if (!snapshot) return {};
  return {
    dayTitle: snapshot.dayTitle,
    dayNumber: snapshot.dayNumber,
    totalDays: snapshot.totalDays,
    mustDoTotal: snapshot.mustDoTotal,
    mustDoDone: snapshot.mustDoDone,
    modulesTracked: snapshot.modulesTracked,
    modulesTotal: snapshot.modulesTotal,
    planName: snapshot.planName,
  };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget =
    nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  switch (props.widgetAction) {
    case 'WIDGET_ADDED': {
      const widgetProps = await getWidgetProps(widgetInfo.widgetName);
      props.renderWidget(<Widget {...widgetProps} />);
      break;
    }

    case 'WIDGET_UPDATE': {
      const widgetProps = await getWidgetProps(widgetInfo.widgetName);
      props.renderWidget(<Widget {...widgetProps} />);
      break;
    }

    case 'WIDGET_RESIZED': {
      const widgetProps = await getWidgetProps(widgetInfo.widgetName);
      props.renderWidget(<Widget {...widgetProps} />);
      break;
    }

    case 'WIDGET_DELETED':
      break;

    case 'WIDGET_CLICK':
      // clickAction="OPEN_APP" handles opening the app automatically
      break;

    default:
      break;
  }
}
