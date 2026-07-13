/** Pure resolution of a single-select tap, kept in its own RN-import-free module so it's unit-testable without pulling in the native-module graph (see ChipSelect.tsx). */
export function resolveChipSelectTap(current: string | null, tapped: string, allowDeselect: boolean): string | null {
  if (allowDeselect && current === tapped) return null;
  return tapped;
}
