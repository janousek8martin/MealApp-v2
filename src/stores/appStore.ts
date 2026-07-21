import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Every route the custom bottom tab bar can show, in canonical display order. */
export type NavKey = 'index' | 'plan' | 'library' | 'shopping' | 'pantry' | 'progress' | 'settings';

export const ALL_NAV_KEYS: NavKey[] = ['index', 'plan', 'library', 'shopping', 'pantry', 'progress', 'settings'];

/** Default main bar per the redesign brief: Home, Plan, Shopping, Library — the everyday cook-and-shop loop. */
export const DEFAULT_MAIN_NAV_KEYS: NavKey[] = ['index', 'plan', 'shopping', 'library'];

export const MAX_MAIN_NAV_ITEMS = 4;

/** Full default order: the default main bar first, then the rest (expand panel). */
const DEFAULT_NAV_ORDER: NavKey[] = [
  ...DEFAULT_MAIN_NAV_KEYS,
  ...ALL_NAV_KEYS.filter((key) => !DEFAULT_MAIN_NAV_KEYS.includes(key)),
];

/**
 * Ephemeral device/UI state only. All domain data lives in SQLite – this
 * store must never duplicate it.
 */
type AppState = {
  /** Which household member's numbers the UI currently shows. */
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  /**
   * User's full drag-reordered nav sequence: the first `MAX_MAIN_NAV_ITEMS`
   * entries sit in the always-visible bar, the rest in the expand panel.
   */
  navOrder: NavKey[];
  setNavOrder: (order: NavKey[]) => void;
  /** Set only once the user swipes through the walkthrough and taps a final CTA. */
  walkthroughSeen: boolean;
  setWalkthroughSeen: (seen: boolean) => void;
  /** Set only once the user has seen the one-time "more nav items" coach-mark. */
  hasSeenMoreHint: boolean;
  setHasSeenMoreHint: (seen: boolean) => void;
  /** Light/dark theme; defaults to light so existing installs don't flip unexpectedly. */
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  /**
   * When off (default), every tab screen resets to the top on re-focus. When
   * on, returning to a tab within `restoreScrollTimeoutSec` of leaving it
   * restores the previous scroll position instead.
   */
  restoreScrollEnabled: boolean;
  setRestoreScrollEnabled: (enabled: boolean) => void;
  restoreScrollTimeoutSec: number;
  setRestoreScrollTimeoutSec: (seconds: number) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: null,
      setActiveProfileId: (id) => set({ activeProfileId: id }),
      navOrder: DEFAULT_NAV_ORDER,
      setNavOrder: (order) => set({ navOrder: order }),
      walkthroughSeen: false,
      setWalkthroughSeen: (seen) => set({ walkthroughSeen: seen }),
      hasSeenMoreHint: false,
      setHasSeenMoreHint: (seen) => set({ hasSeenMoreHint: seen }),
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      restoreScrollEnabled: false,
      setRestoreScrollEnabled: (enabled) => set({ restoreScrollEnabled: enabled }),
      restoreScrollTimeoutSec: 1,
      setRestoreScrollTimeoutSec: (seconds) => set({ restoreScrollTimeoutSec: seconds }),
    }),
    {
      name: 'mealapp-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: (persistedState, version) => {
        const state = persistedState as { mainNavKeys?: NavKey[] } & Record<string, unknown>;
        if (version < 2) {
          const mainNavKeys = state.mainNavKeys ?? DEFAULT_MAIN_NAV_KEYS;
          state.navOrder = [...mainNavKeys, ...ALL_NAV_KEYS.filter((key) => !mainNavKeys.includes(key))];
          delete state.mainNavKeys;
        }
        if (version < 3) {
          state.themeMode = 'light';
        }
        if (version < 4) {
          state.restoreScrollEnabled = false;
          state.restoreScrollTimeoutSec = 1;
        }
        return state as AppState;
      },
    },
  ),
);
