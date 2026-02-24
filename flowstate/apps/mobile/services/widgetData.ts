import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_DATA_KEY = '@flowstate/widget-data';

export interface WidgetSnapshot {
  dayTitle: string;
  dayNumber?: number;
  totalDays?: number;
  mustDoTotal: number;
  mustDoDone: number;
  modulesTracked: number;
  modulesTotal: number;
  planName?: string;
  updatedAt: string;
}

/** Save a snapshot of today's data for the widget to read */
export async function saveWidgetSnapshot(data: Omit<WidgetSnapshot, 'updatedAt'>): Promise<void> {
  try {
    const snapshot: WidgetSnapshot = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(snapshot));
  } catch {
    // Silently fail — widget data is best-effort
  }
}

/** Read the last saved widget snapshot */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    return null;
  }
}
