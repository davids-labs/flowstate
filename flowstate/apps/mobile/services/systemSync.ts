import { syncNotificationCenter } from './notificationCenter';
import { syncWidgetSnapshots } from './widgetSync';

export async function refreshAmbientState(db: any) {
  await Promise.allSettled([syncNotificationCenter(db), syncWidgetSnapshots(db)]);
}
