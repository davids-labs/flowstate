import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pillarColors } from '../constants/theme';

// ─── Pillar type ──────────────────────────────────────────────────────────────
export type Pillar = 'gym' | 'academic' | 'life' | 'general';

// ─── Density ──────────────────────────────────────────────────────────────────
export type DensitySession  = 'compact' | 'standard' | 'expanded';
export type DensityHabit    = 'compact' | 'standard';
export type DensityTask     = 'compact' | 'standard' | 'expanded';
export type GlobalDensity   = 'compact' | 'standard' | 'expanded';

// ─── Theme / appearance ───────────────────────────────────────────────────────
export type ThemePreset    = 'default' | 'midnight' | 'warm' | 'forest' | 'ocean' | 'mono';
export type DarkBackground = 'oled' | 'soft';
export type RadiusScale    = 'sharp' | 'standard' | 'round';

// ─── Timer ────────────────────────────────────────────────────────────────────
export type TimerStyle    = 'ring' | 'bar' | 'minimal';
export type TimerRingSize = 'small' | 'medium' | 'large';

// ─── Haptics ─────────────────────────────────────────────────────────────────
export type HapticIntensity = 'light' | 'medium' | 'heavy';

// ─── My Day zones ─────────────────────────────────────────────────────────────
export type MyDayZone = 'widget' | 'switchboard' | 'timeline' | 'comingUp' | 'quickLinks';
export const DEFAULT_MY_DAY_ZONES: MyDayZone[] = ['widget', 'switchboard', 'timeline', 'comingUp', 'quickLinks'];

const STORAGE_KEY = 'flowstate_user_prefs';

interface UserPrefsState {
  // ── Pillar Colours ──────────────────────────────────────────────
  pillarGym:      string;
  pillarAcademic: string;
  pillarLife:     string;
  pillarGeneral:  string;

  // ── Accent & theme ──────────────────────────────────────────────
  accentColour:       string;
  themePreset:        ThemePreset;
  darkBackground:     DarkBackground;
  radiusScale:        RadiusScale;
  highContrast:       boolean;
  reduceTransparency: boolean;

  // ── Typography ──────────────────────────────────────────────────
  fontSizeOffset:  number;   // -2 | 0 | 2 | 4
  boldMode:        boolean;
  lineHeightScale: 'compact' | 'normal' | 'relaxed';

  // ── Density ─────────────────────────────────────────────────────
  globalDensity:  GlobalDensity;
  densitySession: DensitySession;
  densityHabit:   DensityHabit;
  densityTask:    DensityTask;

  // ── My Day layout ────────────────────────────────────────────────
  myDayZones:       MyDayZone[];
  comingUpDayCount: number;

  // ── Floating pill ────────────────────────────────────────────────
  showFloatingPill: boolean;
  pillAlignment:    'left' | 'right';

  // ── Session timer ────────────────────────────────────────────────
  timerStyle:          TimerStyle;
  timerRingSize:       TimerRingSize;
  showBlockChips:      boolean;
  showPauseIndicator:  boolean;
  keepAwake:           boolean;
  autoStart:           boolean;

  // ── Interaction ──────────────────────────────────────────────────
  hapticFeedback:  boolean;
  hapticIntensity: HapticIntensity;
  reduceMotion:    boolean;

  // ── Date / locale ─────────────────────────────────────────────────
  timeFormat:           '12h' | '24h';
  firstDayOfWeek:       'sun' | 'mon';
  sessionReminders:     boolean;
  reminderLeadMinutes:  number;

  // ── Behaviour ────────────────────────────────────────────────────
  confirmBeforeDelete: boolean;
  swipeThreshold:      number;

  // ── Tab Bar ──────────────────────────────────────────────────────
  showTabLabels: boolean;

  // ── Unit preference ──────────────────────────────────────────────
  weightUnit: 'kg' | 'lb';

  // ── Screen defaults ──────────────────────────────────────────────
  planDefaultView:        'week' | 'pillar';
  todosDefaultMode:       'list' | 'calendar';
  progressDefaultRange:   'week' | 'month' | 'year';
  progressDefaultPillar:  'all' | 'gym' | 'academic' | 'life';

  // ── Actions ──────────────────────────────────────────────────────
  getPillarColour: (pillar: Pillar) => string;
  getPillarTint:   (pillar: Pillar) => string;

  setPillarColour:     (pillar: Pillar, colour: string) => void;
  setAccentColour:     (colour: string) => void;
  setThemePreset:      (p: ThemePreset) => void;
  setDarkBackground:   (b: DarkBackground) => void;
  setRadiusScale:      (r: RadiusScale) => void;
  setHighContrast:     (v: boolean) => void;
  setReduceTransparency: (v: boolean) => void;

  setFontSizeOffset:   (n: number) => void;
  setBoldMode:         (v: boolean) => void;
  setLineHeightScale:  (s: 'compact' | 'normal' | 'relaxed') => void;

  setGlobalDensity:    (d: GlobalDensity) => void;
  setDensitySession:   (d: DensitySession) => void;
  setDensityHabit:     (d: DensityHabit) => void;
  setDensityTask:      (d: DensityTask) => void;

  setMyDayZones:       (zones: MyDayZone[]) => void;
  setComingUpDayCount: (n: number) => void;

  setShowFloatingPill: (v: boolean) => void;
  setPillAlignment:    (a: 'left' | 'right') => void;

  setTimerStyle:         (s: TimerStyle) => void;
  setTimerRingSize:      (s: TimerRingSize) => void;
  setShowBlockChips:     (v: boolean) => void;
  setShowPauseIndicator: (v: boolean) => void;
  setKeepAwake:          (v: boolean) => void;
  setAutoStart:          (v: boolean) => void;

  setHapticFeedback:   (v: boolean) => void;
  setHapticIntensity:  (i: HapticIntensity) => void;
  setReduceMotion:     (v: boolean) => void;

  setTimeFormat:          (f: '12h' | '24h') => void;
  setFirstDayOfWeek:      (d: 'sun' | 'mon') => void;
  setSessionReminders:    (v: boolean) => void;
  setReminderLeadMinutes: (n: number) => void;

  setConfirmBeforeDelete: (v: boolean) => void;
  setSwipeThreshold:      (n: number) => void;

  setShowTabLabels:  (v: boolean) => void;
  setWeightUnit:     (u: 'kg' | 'lb') => void;

  setPlanDefaultView:       (v: 'week' | 'pillar') => void;
  setTodosDefaultMode:      (v: 'list' | 'calendar') => void;
  setProgressDefaultRange:  (v: 'week' | 'month' | 'year') => void;
  setProgressDefaultPillar: (v: 'all' | 'gym' | 'academic' | 'life') => void;

  loadPrefs: () => Promise<void>;
  _persist:  () => void;
}

// ─── deriveTint — real HSL lightening ────────────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const h1 = h / 360, s1 = s / 100, l1 = l / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s1 === 0) { r = g = b = l1; }
  else {
    const q = l1 < 0.5 ? l1 * (1 + s1) : l1 + s1 - l1 * s1;
    const p = 2 * l1 - q;
    r = hue2rgb(p, q, h1 + 1/3);
    g = hue2rgb(p, q, h1);
    b = hue2rgb(p, q, h1 - 1/3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function deriveTint(hex: string, isDark = false): string {
  try {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return isDark ? '#1C1C1E' : '#F3F4F6';
    const [h, s] = hexToHsl(hex);
    return isDark
      ? hslToHex(h, Math.min(s, 60), 15)   // very dark saturated tint
      : hslToHex(h, Math.min(s, 40), 94);  // very light tint
  } catch {
    return isDark ? '#1C1C1E' : '#F3F4F6';
  }
}

export const useUserPrefsStore = create<UserPrefsState>((set, get) => ({
  // ── Defaults ──────────────────────────────────────────────────────────────
  pillarGym:      pillarColors.gym,
  pillarAcademic: pillarColors.academic,
  pillarLife:     pillarColors.life,
  pillarGeneral:  '#4F46E5',

  accentColour:       '#4F46E5',
  themePreset:        'default',
  darkBackground:     'oled',
  radiusScale:        'standard',
  highContrast:       false,
  reduceTransparency: false,

  fontSizeOffset:  0,
  boldMode:        false,
  lineHeightScale: 'normal',

  globalDensity:  'standard',
  densitySession: 'standard',
  densityHabit:   'compact',
  densityTask:    'compact',

  myDayZones:       [...DEFAULT_MY_DAY_ZONES],
  comingUpDayCount: 3,

  showFloatingPill: true,
  pillAlignment:    'right',

  timerStyle:         'ring',
  timerRingSize:      'large',
  showBlockChips:     true,
  showPauseIndicator: true,
  keepAwake:          true,
  autoStart:          false,

  hapticFeedback:  true,
  hapticIntensity: 'medium',
  reduceMotion:    false,

  timeFormat:          '12h',
  firstDayOfWeek:      'mon',
  sessionReminders:    false,
  reminderLeadMinutes: 30,

  confirmBeforeDelete: true,
  swipeThreshold:      80,

  showTabLabels: true,
  weightUnit:    'kg',

  planDefaultView:       'week',
  todosDefaultMode:      'list',
  progressDefaultRange:  'week',
  progressDefaultPillar: 'all',

  // ── Derived helpers ───────────────────────────────────────────────────────
  getPillarColour(pillar) {
    const s = get();
    if (pillar === 'gym')      return s.pillarGym;
    if (pillar === 'academic') return s.pillarAcademic;
    if (pillar === 'life')     return s.pillarLife;
    return s.pillarGeneral;
  },

  getPillarTint(pillar) {
    const s = get();
    const colour = s.getPillarColour(pillar);
    return deriveTint(colour);
  },

  // ── Setters ───────────────────────────────────────────────────────────────
  setPillarColour(pillar, colour) {
    const update: Partial<UserPrefsState> = {};
    if (pillar === 'gym')      update.pillarGym      = colour;
    if (pillar === 'academic') update.pillarAcademic = colour;
    if (pillar === 'life')     update.pillarLife     = colour;
    if (pillar === 'general')  update.pillarGeneral  = colour;
    set(update); get()._persist();
  },
  setAccentColour(colour)       { set({ accentColour: colour });       get()._persist(); },
  setThemePreset(p)             { set({ themePreset: p });             get()._persist(); },
  setDarkBackground(b)          { set({ darkBackground: b });          get()._persist(); },
  setRadiusScale(r)             { set({ radiusScale: r });             get()._persist(); },
  setHighContrast(v)            { set({ highContrast: v });            get()._persist(); },
  setReduceTransparency(v)      { set({ reduceTransparency: v });      get()._persist(); },

  setFontSizeOffset(n)          { set({ fontSizeOffset: n });          get()._persist(); },
  setBoldMode(v)                { set({ boldMode: v });                get()._persist(); },
  setLineHeightScale(s)         { set({ lineHeightScale: s });         get()._persist(); },

  setGlobalDensity(d)           { set({ globalDensity: d });           get()._persist(); },
  setDensitySession(d)          { set({ densitySession: d });          get()._persist(); },
  setDensityHabit(d)            { set({ densityHabit: d });            get()._persist(); },
  setDensityTask(d)             { set({ densityTask: d });             get()._persist(); },

  setMyDayZones(zones)          { set({ myDayZones: zones });          get()._persist(); },
  setComingUpDayCount(n)        { set({ comingUpDayCount: n });        get()._persist(); },

  setShowFloatingPill(v)        { set({ showFloatingPill: v });        get()._persist(); },
  setPillAlignment(a)           { set({ pillAlignment: a });           get()._persist(); },

  setTimerStyle(s)              { set({ timerStyle: s });              get()._persist(); },
  setTimerRingSize(s)           { set({ timerRingSize: s });           get()._persist(); },
  setShowBlockChips(v)          { set({ showBlockChips: v });          get()._persist(); },
  setShowPauseIndicator(v)      { set({ showPauseIndicator: v });      get()._persist(); },
  setKeepAwake(v)               { set({ keepAwake: v });               get()._persist(); },
  setAutoStart(v)               { set({ autoStart: v });               get()._persist(); },

  setHapticFeedback(v)          { set({ hapticFeedback: v });          get()._persist(); },
  setHapticIntensity(i)         { set({ hapticIntensity: i });         get()._persist(); },
  setReduceMotion(v)            { set({ reduceMotion: v });            get()._persist(); },

  setTimeFormat(f)              { set({ timeFormat: f });              get()._persist(); },
  setFirstDayOfWeek(d)          { set({ firstDayOfWeek: d });          get()._persist(); },
  setSessionReminders(v)        { set({ sessionReminders: v });        get()._persist(); },
  setReminderLeadMinutes(n)     { set({ reminderLeadMinutes: n });     get()._persist(); },

  setConfirmBeforeDelete(v)     { set({ confirmBeforeDelete: v });     get()._persist(); },
  setSwipeThreshold(n)          { set({ swipeThreshold: n });          get()._persist(); },

  setShowTabLabels(v)           { set({ showTabLabels: v });           get()._persist(); },
  setWeightUnit(u)              { set({ weightUnit: u });              get()._persist(); },

  setPlanDefaultView(v)         { set({ planDefaultView: v });         get()._persist(); },
  setTodosDefaultMode(v)        { set({ todosDefaultMode: v });        get()._persist(); },
  setProgressDefaultRange(v)    { set({ progressDefaultRange: v });    get()._persist(); },
  setProgressDefaultPillar(v)   { set({ progressDefaultPillar: v });   get()._persist(); },

  // ── Persistence ───────────────────────────────────────────────────────────
  async loadPrefs() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<UserPrefsState>;
      set({
        pillarGym:      saved.pillarGym      ?? pillarColors.gym,
        pillarAcademic: saved.pillarAcademic ?? pillarColors.academic,
        pillarLife:     saved.pillarLife     ?? pillarColors.life,
        pillarGeneral:  saved.pillarGeneral  ?? '#4F46E5',

        accentColour:       saved.accentColour       ?? '#4F46E5',
        themePreset:        saved.themePreset        ?? 'default',
        darkBackground:     saved.darkBackground     ?? 'oled',
        radiusScale:        saved.radiusScale        ?? 'standard',
        highContrast:       saved.highContrast       ?? false,
        reduceTransparency: saved.reduceTransparency ?? false,

        fontSizeOffset:  saved.fontSizeOffset  ?? 0,
        boldMode:        saved.boldMode        ?? false,
        lineHeightScale: saved.lineHeightScale ?? 'normal',

        globalDensity:  saved.globalDensity  ?? 'standard',
        densitySession: saved.densitySession ?? 'standard',
        densityHabit:   saved.densityHabit   ?? 'compact',
        densityTask:    saved.densityTask    ?? 'compact',

        myDayZones:       saved.myDayZones       ?? [...DEFAULT_MY_DAY_ZONES],
        comingUpDayCount: saved.comingUpDayCount ?? 3,

        showFloatingPill: saved.showFloatingPill ?? true,
        pillAlignment:    saved.pillAlignment    ?? 'right',

        timerStyle:         saved.timerStyle         ?? 'ring',
        timerRingSize:      saved.timerRingSize      ?? 'large',
        showBlockChips:     saved.showBlockChips     ?? true,
        showPauseIndicator: saved.showPauseIndicator ?? true,
        keepAwake:          saved.keepAwake          ?? true,
        autoStart:          saved.autoStart          ?? false,

        hapticFeedback:  saved.hapticFeedback  ?? true,
        hapticIntensity: saved.hapticIntensity ?? 'medium',
        reduceMotion:    saved.reduceMotion    ?? false,

        timeFormat:          saved.timeFormat          ?? '12h',
        firstDayOfWeek:      saved.firstDayOfWeek      ?? 'mon',
        sessionReminders:    saved.sessionReminders    ?? false,
        reminderLeadMinutes: saved.reminderLeadMinutes ?? 30,

        confirmBeforeDelete: saved.confirmBeforeDelete ?? true,
        swipeThreshold:      saved.swipeThreshold      ?? 80,

        showTabLabels: saved.showTabLabels ?? true,
        weightUnit:    saved.weightUnit    ?? 'kg',

        planDefaultView:       saved.planDefaultView       ?? 'week',
        todosDefaultMode:      saved.todosDefaultMode      ?? 'list',
        progressDefaultRange:  saved.progressDefaultRange  ?? 'week',
        progressDefaultPillar: saved.progressDefaultPillar ?? 'all',
      });
    } catch (_) {}
  },

  _persist() {
    const s = get();
    const snapshot = {
      pillarGym: s.pillarGym, pillarAcademic: s.pillarAcademic,
      pillarLife: s.pillarLife, pillarGeneral: s.pillarGeneral,
      accentColour: s.accentColour, themePreset: s.themePreset,
      darkBackground: s.darkBackground, radiusScale: s.radiusScale,
      highContrast: s.highContrast, reduceTransparency: s.reduceTransparency,
      fontSizeOffset: s.fontSizeOffset, boldMode: s.boldMode,
      lineHeightScale: s.lineHeightScale,
      globalDensity: s.globalDensity, densitySession: s.densitySession,
      densityHabit: s.densityHabit, densityTask: s.densityTask,
      myDayZones: s.myDayZones, comingUpDayCount: s.comingUpDayCount,
      showFloatingPill: s.showFloatingPill, pillAlignment: s.pillAlignment,
      timerStyle: s.timerStyle, timerRingSize: s.timerRingSize,
      showBlockChips: s.showBlockChips, showPauseIndicator: s.showPauseIndicator,
      keepAwake: s.keepAwake, autoStart: s.autoStart,
      hapticFeedback: s.hapticFeedback, hapticIntensity: s.hapticIntensity,
      reduceMotion: s.reduceMotion,
      timeFormat: s.timeFormat, firstDayOfWeek: s.firstDayOfWeek,
      sessionReminders: s.sessionReminders, reminderLeadMinutes: s.reminderLeadMinutes,
      confirmBeforeDelete: s.confirmBeforeDelete, swipeThreshold: s.swipeThreshold,
      showTabLabels: s.showTabLabels, weightUnit: s.weightUnit,
      planDefaultView: s.planDefaultView, todosDefaultMode: s.todosDefaultMode,
      progressDefaultRange: s.progressDefaultRange, progressDefaultPillar: s.progressDefaultPillar,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  },
} as UserPrefsState));
