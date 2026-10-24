import Cube from '@utils/datatypes/Cube';
import { DraftFormat } from '@utils/datatypes/Draft';

export const STANDARD_DRAFT_FORMAT_ID = -1;
export const STANDARD_DRAFT_LABEL = 'Standard Draft';

export interface DraftFormatOption {
  value: string;
  label: string;
}

/* Whether the cube owner has standard draft turned on. This is their stated intent, and it is
 * what surfaces that can legitimately show nothing — the playtest tiles — must respect.
 */
export const standardDraftEnabled = (cube: Cube): boolean => !cube.disableDraft;

/* Whether a format *picker* should list standard draft. -1 is the sentinel that getDraftFormat
 * resolves to the built-in 3x15 pack structure. Same rule as above, except that a cube with no
 * custom format keeps it regardless, because a picker must always have something to select.
 */
export const offersStandardDraft = (enabled: boolean, customFormatCount: number): boolean =>
  enabled || customFormatCount === 0;

/* The format a picker should start on. Matches the draft simulator and the playtest page,
 * which both treat the cube's own default as the starting point.
 */
export const getDefaultDraftFormatValue = (cube: Cube): string => `${cube.defaultFormat ?? STANDARD_DRAFT_FORMAT_ID}`;

export const getDraftFormatOptions = (formats: DraftFormat[] | undefined, enabled: boolean): DraftFormatOption[] => {
  const customFormats = (formats ?? []).map((format, index) => ({
    value: `${index}`,
    label: format.title || `Format ${index + 1}`,
  }));

  if (!offersStandardDraft(enabled, customFormats.length)) {
    return customFormats;
  }

  return [{ value: `${STANDARD_DRAFT_FORMAT_ID}`, label: STANDARD_DRAFT_LABEL }, ...customFormats];
};
