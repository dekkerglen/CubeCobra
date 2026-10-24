import Cube from '@utils/datatypes/Cube';
import { DraftFormat } from '@utils/datatypes/Draft';

export const STANDARD_DRAFT_FORMAT_ID = -1;
export const STANDARD_DRAFT_LABEL = 'Standard Draft';

export interface DraftFormatOption {
  value: string;
  label: string;
}

/* -1 is the sentinel that getDraftFormat resolves to the built-in 3x15 pack structure. A cube
 * can turn standard draft off, but one with no custom formats keeps it anyway so that no
 * format picker is ever left empty.
 */
export const offersStandardDraft = (standardDraftEnabled: boolean, customFormatCount: number): boolean =>
  standardDraftEnabled || customFormatCount === 0;

export const cubeOffersStandardDraft = (cube: Cube): boolean =>
  offersStandardDraft(!cube.disableDraft, cube.formats?.length ?? 0);

/* The format a picker should start on. Matches the draft simulator and the playtest page,
 * which both treat the cube's own default as the starting point.
 */
export const getDefaultDraftFormatValue = (cube: Cube): string => `${cube.defaultFormat ?? STANDARD_DRAFT_FORMAT_ID}`;

export const getDraftFormatOptions = (
  formats: DraftFormat[] | undefined,
  standardDraftEnabled: boolean,
): DraftFormatOption[] => {
  const customFormats = (formats ?? []).map((format, index) => ({
    value: `${index}`,
    label: format.title || `Format ${index + 1}`,
  }));

  if (!offersStandardDraft(standardDraftEnabled, customFormats.length)) {
    return customFormats;
  }

  return [{ value: `${STANDARD_DRAFT_FORMAT_ID}`, label: STANDARD_DRAFT_LABEL }, ...customFormats];
};
