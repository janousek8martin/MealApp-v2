import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Every route the custom bottom tab bar can show, in canonical display order. */
export type NavKey = 'index' | 'plan' | 'library' | 'shopping' | 'pantry' | 'progress' | 'settings';

export const ALL_NAV_KEYS: NavKey[] = ['index', 'plan', 'library', 'shopping', 'pantry', 'progress', 'settings'];

/** Default main bar per the redesign brief: Home, Meal plan, Shopping, Settings. */
export const DEFAULT_MAIN_NAV_KEYS: NavKey[] = ['index', 'plan', 'shopping', 'settings'];

export const MAX_MAIN_NAV_ITEMS = 4;

/**
 * Ephemeral device/UI state only. All domain data lives in SQLite – this
 * store must never duplicate it.
 */
type AppState = {
  /** Which household member's numbers the UI currently shows. */
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  /** Which nav items sit in the default (always-visible) bar vs. the expand panel. */
  mainNavKeys: NavKey[];
  setMainNavKeys: (keys: NavKey[]) => void;
  /** Set only once the user swipes through the walkthrough and taps a final CTA. */
  walkthroughSeen: boolean;
  setWalkthroughSeen: (seen: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: null,
      setActiveProfileId: (id) => set({ activeProfileId: id }),
      mainNavKeys: DEFAULT_MAIN_NAV_KEYS,
      setMainNavKeys: (keys) => set({ mainNavKeys: keys }),
      walkthroughSeen: false,
      setWalkthroughSeen: (seen) => set({ walkthroughSeen: seen }),
    }),
    {
      name: 'mealapp-app-state',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
