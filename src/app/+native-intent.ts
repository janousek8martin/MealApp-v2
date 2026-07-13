import { getShareExtensionKey } from 'expo-share-intent';

/** Cold start via the Android share sheet lands on a synthetic dataUrl path expo-router can't route directly – send it to the import screen, which reads the actual shared value from useShareIntentContext once mounted. */
export function redirectSystemPath({ path }: { path: string; initial: string }) {
  if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
    return '/recipe/import';
  }
  return path;
}
