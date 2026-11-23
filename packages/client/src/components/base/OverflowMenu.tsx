import React from 'react';

import { KebabHorizontalIcon } from '@primer/octicons-react';

import Dropdown from './Dropdown';
import { Flexbox } from './Layout';

// Matches the record overview's overflow menu, which solved the same problem: actions that belong
// to a card but should not compete with its content for attention.
export const overflowMenuItemClass = '!text-text hover:!text-link-active hover:cursor-pointer font-medium';
export const overflowMenuDangerItemClass = '!text-danger hover:!text-link-active hover:cursor-pointer font-medium';

interface OverflowMenuProps {
  // Names the trigger for screen readers and as its tooltip, e.g. "Post actions".
  label: string;
  children: React.ReactNode;
}

/**
 * A quiet kebab trigger opening a list of actions. Callers render nothing at all when there are no
 * actions: a menu that opens onto an empty list is worse than no menu.
 */
const OverflowMenu: React.FC<OverflowMenuProps> = ({ label, children }) => (
  <Dropdown
    // The trigger sits at a card's right edge, so the menu hangs from that edge; aligned left it
    // would open past it.
    align="right"
    // No minWidth: Dropdown's own min-w-max sizes the menu to its longest item, so no label wraps.
    trigger={
      <button
        type="button"
        aria-label={label}
        title={label}
        className="shrink-0 px-1 text-text-secondary hover:text-text transition-colors"
      >
        <KebabHorizontalIcon size={16} />
      </button>
    }
  >
    <Flexbox direction="col" gap="2" className="p-3">
      {children}
    </Flexbox>
  </Dropdown>
);

export default OverflowMenu;
