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

/**
 * Download a remote (https) image into the photos directory – used by the
 * web recipe import. Falls back to returning the remote URL itself when the
 * download fails (expo-image renders http(s) uris fine; the photo just won't
 * be available offline until the user replaces it).
 */
export async function downloadPhoto(url: string, id: string): Promise<string> {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) {
      dir.create();
    }
    const destination = new File(dir, `${id}.jpg`);
    if (destination.exists) {
      destination.delete();
    }
    const downloaded = await File.downloadFileAsync(url, destination);
    return downloaded.uri;
  } catch {
    return url;
  }
}
