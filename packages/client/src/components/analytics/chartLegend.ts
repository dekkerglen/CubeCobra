import { type Chart, DoughnutController, Legend, type LegendItem } from 'chart.js';

type LabelGenerator = (chart: Chart) => LegendItem[];

// Chart.js's own default label colour, used when an item carries none of its own.
const CHART_DEFAULT_COLOR = '#666';

const HIDDEN_TEXT_ALPHA = 0.45;
const HIDDEN_SWATCH_LINE_WIDTH = 2;

/**
 * Re-expresses a hex colour as `rgba(...)` at the given alpha, so it blends toward whatever is
 * behind it. Fading is what makes a dimmed label read as dimmed under both the light and the dark
 * theme; a fixed grey can only be lower-contrast against one of them. Anything this cannot parse
 * comes back unchanged rather than becoming `rgba(NaN, NaN, NaN, …)`.
 */
export const fadeColor = (color: string | undefined, alpha: number): string => {
  const hex = (color ?? CHART_DEFAULT_COLOR).trim();
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex);
  if (!match) return hex;

  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Chart.js marks a legend item hidden and strikes its label through, but at the default colour the
 * strike is nearly invisible and the swatch stays fully saturated, so a toggled-off series looks no
 * different. This fades the label and hollows the swatch into a ring of the series colour.
 */
export const dimHiddenLegendItems = (items: LegendItem[]): LegendItem[] =>
  items.map((item) =>
    item.hidden
      ? {
          ...item,
          fillStyle: 'transparent',
          strokeStyle: item.fillStyle,
          lineWidth: HIDDEN_SWATCH_LINE_WIDTH,
          fontColor: fadeColor(item.fontColor as string | undefined, HIDDEN_TEXT_ALPHA),
        }
      : item,
  );

const barBase = (Legend.defaults as { labels?: { generateLabels?: LabelGenerator } } | undefined)?.labels
  ?.generateLabels;

// Doughnuts label each slice, not each dataset, via an override on the controller. Wrapping the
// bar generator here would collapse the legend to a single entry.
const doughnutBase = (
  DoughnutController.overrides as
    { plugins?: { legend?: { labels?: { generateLabels?: LabelGenerator } } } } | undefined
)?.plugins?.legend?.labels?.generateLabels;

/**
 * Both base generators are read out of Chart.js internals, which a future version may reshape. When
 * one goes missing we omit `generateLabels` entirely rather than wrapping `undefined`: spreading an
 * empty object leaves Chart.js to use its own default, so the chart loses the dimming but still
 * renders a working legend instead of throwing.
 */
export const dimmedLegendLabels = (base: LabelGenerator | undefined): { generateLabels?: LabelGenerator } =>
  typeof base === 'function' ? { generateLabels: (chart: Chart) => dimHiddenLegendItems(base(chart)) } : {};

export const barLegendLabels = dimmedLegendLabels(barBase);

export const doughnutLegendLabels = dimmedLegendLabels(doughnutBase);
