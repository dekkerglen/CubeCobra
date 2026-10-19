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
 * Builds the query string for the cube export links so a download matches what the page shows with
 * the same Use Sort / Use Filter settings. With sorting off it sends `nosort`, since the download
 * endpoint otherwise sorts by the cube's defaults and drops cards no sort group claims.
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
    if (showUnsorted) params.set('showother', 'true');
  } else {
    params.set('nosort', 'true');
  }

  if (exportAllBoards) {
    params.set('allBoards', '1');
  } else {
    params.set('boards', currentViewBoards.join(','));
  }

  return params.toString();
};

export default buildExportParams;
