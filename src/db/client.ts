import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

// enableChangeListener drives useLiveQuery re-renders across the app –
// the core of the "no stale TDCI / no manual refresh" requirement.
const expoDb = openDatabaseSync('mealapp.db', { enableChangeListener: true });

expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
