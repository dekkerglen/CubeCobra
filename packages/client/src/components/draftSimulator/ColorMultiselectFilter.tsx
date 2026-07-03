import React from 'react';

export const WUBRG_C = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export type WUBRGCColor = (typeof WUBRG_C)[number];
export type ColorMatchMode = 'any' | 'all';

const COLOR_BG: Record<WUBRGCColor, string> = {
  W: '#f8f5e7',
  U: '#bbd5f0',
  B: '#bcb9b8',
  R: '#f3b4ab',
  G: '#b4d8b9',
  C: '#d6d3d1',
};

const COLOR_NAME: Record<WUBRGCColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

/** WUBRG+C swatch buttons used in the simulator toolbars. Empty selection = no filter
 *  (matches "All" semantics in the consuming filter logic).
 *
 *  When 2+ colors are selected, an Any/All pill appears so consumers can switch between
 *  OR semantics ("anything containing any selected color") and AND semantics ("must
 *  contain every selected color", i.e. the BG+ case). With 0 or 1 selected, the pill is
 *  hidden because Any/All are equivalent. */
const ColorMultiselectFilter: React.FC<{
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  mode?: ColorMatchMode;
  onModeChange?: (mode: ColorMatchMode) => void;
}> = ({ selected, onChange, mode = 'any', onModeChange }) => {
  const toggle = (c: WUBRGCColor) => {
    const next = new Set(selected);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange(next);
  };
  const showModeToggle = !!onModeChange && selected.size >= 2;
  return (
    <div className="flex items-center gap-1">
      {WUBRG_C.map((c) => {
        const isSelected = selected.has(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            title={COLOR_NAME[c]}
            className={[
              'flex items-center justify-center rounded text-xs font-semibold border',
              isSelected ? 'border-link ring-2 ring-link' : 'border-border hover:border-text-secondary',
            ].join(' ')}
            style={{ width: 24, height: 24, background: COLOR_BG[c] }}
          >
            {c}
          </button>
        );
      })}
      {showModeToggle && (
        <div
          className="ml-1 flex items-center rounded border border-border overflow-hidden"
          title={
            mode === 'any'
              ? 'Match pools containing any selected color'
              : 'Match only pools containing every selected color'
          }
        >
          {(['any', 'all'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange!(m)}
              className={[
                'px-2 py-0.5 text-xs font-semibold',
                mode === m ? 'bg-link text-white' : 'bg-bg text-text-secondary hover:bg-bg-active',
              ].join(' ')}
            >
              {m === 'any' ? 'Any' : 'All'}
            </button>
          ))}
        </div>
      )}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="ml-1 text-xs text-text-secondary hover:text-text"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default ColorMultiselectFilter;
