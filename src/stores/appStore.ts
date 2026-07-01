import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Ephemeral device/UI state only. All domain data lives in SQLite – this
 * store must never duplicate it.
 */
type AppState = {
  /** Which household member's numbers the UI currently shows. */
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: null,
      setActiveProfileId: (id) => set({ activeProfileId: id }),
    }),
    {
      name: 'mealapp-app-state',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
