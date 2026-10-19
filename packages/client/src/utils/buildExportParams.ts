export interface ExportParamsOptions {
  isFilterUsed: boolean;
  filterInput: string | null;
  isSortUsed: boolean;
  sortPrimary: string | null;
  sortSecondary: string | null;
  sortTertiary: string | null;
  sortQuaternary: string | null;
  exportAllBoards: boolean;
  currentViewBoards: string[];
  /** The cube's "show unsorted" setting, i.e. whether the page displays the "Other" group. */
  showUnsorted: boolean;
}

/**
 * Builds the query string for the cube export links.
 *
 * `showother` mirrors the cube's "show unsorted" setting so a download matches what the page is
 * showing. Without it the download endpoint defaults to false and silently discards any card no
 * sort bucket claims - a custom card or voucher with no type line, for example - even though the
 * page lists those cards under "Other". It is sent regardless of the sort checkbox because the
 * download endpoint sorts either way, falling back to the default sorts when none are given.
 */
export const buildExportParams = ({
  isFilterUsed,
  filterInput,
  isSortUsed,
  sortPrimary,
  sortSecondary,
  sortTertiary,
  sortQuaternary,
  exportAllBoards,
  currentViewBoards,
  showUnsorted,
}: ExportParamsOptions): string => {
  const params = new URLSearchParams();

  if (isFilterUsed && filterInput) {
    params.set('filter', filterInput);
  }

  if (isSortUsed) {
    if (sortPrimary) params.set('primary', sortPrimary);
    if (sortSecondary) params.set('secondary', sortSecondary);
    if (sortTertiary) params.set('tertiary', sortTertiary);
    if (sortQuaternary) params.set('quaternary', sortQuaternary);
  }

  if (showUnsorted) {
    params.set('showother', 'true');
  }

  if (exportAllBoards) {
    params.set('allBoards', '1');
  } else {
    params.set('boards', currentViewBoards.join(','));
  }

  return params.toString();
};

export default buildExportParams;
