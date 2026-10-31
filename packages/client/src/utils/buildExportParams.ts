import { EXPORT_SORTS } from '@utils/sorting/Sort';

export interface ExportParamsOptions {
  isFilterUsed: boolean;
  filterInput: string | null;
  exportAllBoards: boolean;
  currentViewBoards: string[];
}

/**
 * Builds the query string for the cube export links.
 *
 * Exports always use the fixed EXPORT_SORTS ordering with `showother=true`, rather than whatever the
 * page or the cube happens to be sorted by. Sorting is the only thing that can make a download
 * disagree with the cube it came from: a multi-label sort writes one card out once per group it
 * matches, and hiding the "Other" group drops any card no group claims. Pinning both means a
 * download always contains every card in scope exactly once.
 *
 * The endpoint still honours caller-supplied sort parameters, including `nosort`; that is for API
 * consumers, and the export menu never sends them.
 */
export const buildExportParams = ({
  isFilterUsed,
  filterInput,
  exportAllBoards,
  currentViewBoards,
}: ExportParamsOptions): string => {
  const params = new URLSearchParams();

  if (isFilterUsed && filterInput) {
    params.set('filter', filterInput);
  }

  const [primary, secondary, tertiary, quaternary] = EXPORT_SORTS;
  params.set('primary', primary);
  params.set('secondary', secondary);
  params.set('tertiary', tertiary);
  params.set('quaternary', quaternary);
  params.set('showother', 'true');

  if (exportAllBoards) {
    params.set('allBoards', '1');
  } else {
    params.set('boards', currentViewBoards.join(','));
  }

  return params.toString();
};

export default buildExportParams;
