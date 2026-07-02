import { Directory, File, Paths } from 'expo-file-system';

/**
 * Copy a picked/captured image into the app's own photos directory so it
 * survives gallery cleanups; returns the persistent URI stored in the DB.
 */
export function persistPhoto(sourceUri: string, id: string): string {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create();
  }
  const destination = new File(dir, `${id}.jpg`);
  if (destination.exists) {
    destination.delete();
  }
  new File(sourceUri).copy(destination);
  return destination.uri;
}
