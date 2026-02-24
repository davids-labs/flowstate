import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { FlowStateDayWidget } from './components/widgets/FlowStateDayWidget';
import { readWidgetSnapshot } from './services/widgetData';

const nameToWidget = {
  FlowStateDay: FlowStateDayWidget,
};

async function getWidgetProps() {
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
      const widgetProps = await getWidgetProps();
      props.renderWidget(<Widget {...widgetProps} />);
      break;
    }

    case 'WIDGET_UPDATE': {
      const widgetProps = await getWidgetProps();
      props.renderWidget(<Widget {...widgetProps} />);
      break;
    }

    case 'WIDGET_RESIZED': {
      const widgetProps = await getWidgetProps();
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
