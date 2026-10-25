/**
 * Banner theme registry: the fixed set of cube hero appearances, named after Magic's colours.
 *
 * This module holds keys, labels and order only. **The colour values live in
 * `packages/client/src/css/stylesheet.css`**, as `--hero-*` custom properties under a
 * `.banner-theme-<key>` class, with a light rule and two dark rules each. Keeping the values
 * in CSS is what makes the light/dark split work without JavaScript reading the active
 * theme, and without a flash on load.
 *
 * Adding a theme means exactly two edits: one entry in `BANNER_THEMES` below, and one block of
 * colours per mode in that stylesheet. Nothing in the control, the endpoint, the validation
 * or the DAO enumerates themes by hand. A test in the client package parses the stylesheet
 * and fails if a key here has no matching block, or if its contrast falls below the bar.
 */

export interface BannerTheme {
  key: string;
  label: string;
}

/**
 * The registry. Adding a theme means one entry here and one block of colours per mode in the
 * stylesheet — nothing else. `BannerThemeKey` is derived from these entries rather than written
 * out separately, so a new theme does not also need a hand-edited union.
 */
export const BANNER_THEMES = [
  { key: 'white', label: 'White' },
  { key: 'blue', label: 'Blue' },
  { key: 'black', label: 'Black' },
  { key: 'red', label: 'Red' },
  { key: 'green', label: 'Green' },
] as const satisfies readonly BannerTheme[];

export type BannerThemeKey = (typeof BANNER_THEMES)[number]['key'];

/**
 * The theme a cube gets when it has chosen nothing. An unset cube and a cube that picked
 * Green are the same state: the control publishes an empty value for Green, the endpoint
 * normalizes the default to "no theme", and `bannerThemeClass` returns null so the hero renders
 * from the stylesheet's `:root` defaults with no theme class at all.
 */
export const DEFAULT_BANNER_THEME: BannerThemeKey = 'green';

/**
 * Returns `input` when it is a registry key, otherwise null.
 *
 * Deliberately strict: no trimming and no case-folding. These are machine values chosen from
 * a closed set by a control, never typed by a person, so anything that is not an exact match
 * is a bug or an attack rather than a near miss worth rescuing.
 */
export const normalizeBannerTheme = (input: unknown): BannerThemeKey | null =>
  BANNER_THEMES.find((theme) => theme.key === input)?.key ?? null;
/**
 * The CSS class that applies a theme, or null when none should be applied.
 *
 * Null for unset, unrecognised, and for the default — so a default cube carries no class and
 * inherits the stylesheet's base `--hero-*` values, which is what keeps every existing cube
 * rendering exactly as it does today.
 */
export const bannerThemeClass = (key?: string | null): string | null => {
  const theme = normalizeBannerTheme(key);
  return theme && theme !== DEFAULT_BANNER_THEME ? `banner-theme-${theme}` : null;
};
