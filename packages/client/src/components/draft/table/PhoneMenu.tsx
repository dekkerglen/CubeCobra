import React, { useState } from 'react';

import { ThreeBarsIcon, XIcon } from '@primer/octicons-react';
import { motion } from 'framer-motion';

interface PhoneMenuButtonProps {
  open: boolean;
  onToggle: () => void;
  label: string;
}

/** The menu button at the top left of a table on phones. */
export const PhoneMenuButton: React.FC<PhoneMenuButtonProps> = ({ open, onToggle, label }) => (
  <button
    type="button"
    aria-label={label}
    aria-expanded={open}
    onClick={onToggle}
    className="shrink-0 p-1 text-text-secondary hover:text-text"
  >
    {open ? <XIcon size={20} /> : <ThreeBarsIcon size={20} />}
  </button>
);

interface PhoneMenuPanelProps {
  open: boolean;
  children: React.ReactNode;
}

/**
 * The menu's contents, sliding open under the header. It stays mounted while
 * closed so what's inside keeps its state (e.g. an autobuild in progress), and
 * only clips while sliding, so dropdowns inside can hang over the table once open.
 */
export const PhoneMenuPanel: React.FC<PhoneMenuPanelProps> = ({ open, children }) => {
  const [settled, setSettled] = useState(false);
  return (
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onAnimationStart={() => setSettled(false)}
      onAnimationComplete={() => setSettled(open)}
      style={{ overflow: open && settled ? 'visible' : 'hidden' }}
      inert={!open}
    >
      {children}
    </motion.div>
  );
};
