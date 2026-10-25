import fs from 'fs';
import path from 'path';

import { HERO_THEMES } from '@utils/heroTheme';

/**
 * The hero theme colours live in CSS, not TypeScript, so that light/dark works through the
 * existing mode blocks with no JavaScript and no flash. The cost of that choice is that a
 * registry key with no stylesheet block would silently fall back to the default green, and a
 * naive "adding a key needs no other edits" check would pass on a broken theme.
 *
 * This test closes that hole. It is the only place in the feature where colour maths exists.
 */

const STYLESHEET = fs.readFileSync(path.join(__dirname, '../../src/css/stylesheet.css'), 'utf8');

const HERO_VARS = ['--hero-bg', '--hero-text', '--hero-text-hover', '--hero-badge-bg', '--hero-badge-text'] as const;

type HeroVar = (typeof HERO_VARS)[number];
type Rgb = [number, number, number];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const toLab = ([r, g, b]: Rgb): [number, number, number] => {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const deltaE76 = (a: Rgb, b: Rgb): number => {
  const [la, aa, ba] = toLab(a);
  const [lb, ab, bb] = toLab(b);
  return Math.hypot(la - lb, aa - ab, ba - bb);
};

/** Returns the body of the brace block that opens at or after `from`, via brace matching. */
const blockAt = (from: number): string | null => {
  const open = STYLESHEET.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < STYLESHEET.length; i += 1) {
    if (STYLESHEET[i] === '{') depth += 1;
    else if (STYLESHEET[i] === '}') {
      depth -= 1;
      if (depth === 0) return STYLESHEET.slice(open + 1, i);
    }
  }
  return null;
};

/**
 * Finds a rule whose selector *begins a line*, so `.hero-theme-blue` cannot be satisfied by
 * the tail of `:root[class~='dark'] .hero-theme-blue`. A plain substring search silently
 * accepts a stylesheet whose light rule has been deleted, which is the one failure this
 * whole test exists to catch.
 */
const ruleBlock = (selector: string): string | null => {
  const pattern = new RegExp(`^[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm');
  const match = pattern.exec(STYLESHEET);
  return match ? blockAt(match.index) : null;
};

/** The body of every `@media (prefers-color-scheme: dark)` block in the stylesheet. */
const prefersDarkBlocks = (): string[] => {
  const blocks: string[] = [];
  const pattern = /@media \(prefers-color-scheme: dark\)/g;
  let match = pattern.exec(STYLESHEET);
  while (match) {
    const body = blockAt(match.index);
    if (body) blocks.push(body);
    match = pattern.exec(STYLESHEET);
  }
  return blocks;
};

const varsIn = (block: string): Partial<Record<HeroVar, Rgb>> => {
  const found: Partial<Record<HeroVar, Rgb>> = {};
  for (const name of HERO_VARS) {
    const match = new RegExp(`${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(block);
    if (match) found[name] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return found;
};

// The base rule carries the light values (matching :root); the two dark selectors outrank it.
const lightSelector = (key: string) => `.hero-theme-${key}`;
const darkSelector = (key: string) => `:root[class~='dark'] .hero-theme-${key}`;
const systemSelector = (key: string) => `:root[class~='system'] .hero-theme-${key}`;

/**
 * The system-dark rule only applies inside a `prefers-color-scheme: dark` media query, so
 * finding the selector anywhere in the file is not enough — it has to be inside one.
 */
const systemDarkBlock = (key: string): string | null => {
  const selector = systemSelector(key);
  for (const media of prefersDarkBlocks()) {
    const index = media.indexOf(selector);
    if (index === -1) continue;
    const open = media.indexOf('{', index);
    const close = media.indexOf('}', open);
    if (open !== -1 && close !== -1) return media.slice(open + 1, close);
  }
  return null;
};

const paletteFor = (mode: 'light' | 'dark') =>
  HERO_THEMES.map(({ key }) => {
    const block = ruleBlock(mode === 'light' ? lightSelector(key) : darkSelector(key));
    return { key, vars: block ? varsIn(block) : {} };
  });

describe('hero theme palette', () => {
  describe.each(HERO_THEMES.map((t) => t.key))('%s', (key) => {
    it.each([
      ['light', () => ruleBlock(lightSelector(key))],
      ['explicit dark', () => ruleBlock(darkSelector(key))],
      ['system dark', () => systemDarkBlock(key)],
    ] as const)('defines all five variables in its %s rule', (_mode, lookup) => {
      const block = lookup();
      expect(block).not.toBeNull();
      expect(Object.keys(varsIn(block as string)).sort()).toEqual([...HERO_VARS].sort());
    });
  });

  describe.each(['light', 'dark'] as const)('%s mode', (mode) => {
    const palette = paletteFor(mode);

    it.each(palette.map((p) => [p.key, p] as const))('%s: hero text contrast is at least 4.5', (_key, entry) => {
      expect(contrast(entry.vars['--hero-bg'] as Rgb, entry.vars['--hero-text'] as Rgb)).toBeGreaterThanOrEqual(4.5);
    });

    // 4.389 is today's light green badge (34 139 34 on white). It is below AA, but it ships
    // today and "existing cubes look identical" outranks improving it. No theme may be worse.
    it.each(palette.map((p) => [p.key, p] as const))('%s: badge text contrast is at least 4.389', (_key, entry) => {
      expect(
        contrast(entry.vars['--hero-badge-bg'] as Rgb, entry.vars['--hero-badge-text'] as Rgb),
      ).toBeGreaterThanOrEqual(4.389);
    });

    // The control carries no text labels by design, so the fills alone must identify a theme.
    it('every pair of backgrounds differs by at least deltaE 15', () => {
      const pairs = palette.flatMap((a, i) => palette.slice(i + 1).map((b) => [a, b] as const));
      const tooClose = pairs
        .map(([a, b]) => ({
          pair: `${a.key}/${b.key}`,
          dE: deltaE76(a.vars['--hero-bg'] as Rgb, b.vars['--hero-bg'] as Rgb),
        }))
        .filter(({ dE }) => dE < 15);
      expect(tooClose).toEqual([]);
    });
  });
});
