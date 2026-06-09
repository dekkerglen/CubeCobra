import React, { useContext, useState } from 'react';

import { GearIcon, PackageIcon, PlusIcon, XIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { comboKey, useCubeTray } from '../../contexts/CubeTrayContext';
import UserContext from '../../contexts/UserContext';
import Text from '../base/Text';
import AddCubeBoardModal from './AddCubeBoardModal';
import DragGhost from './DragGhost';

interface CubeTrayProps {
  // Left position class(es) for the floating button, so it can clear a page's
  // left sidebar. Defaults to the bottom-left corner.
  leftClassName?: string;
}

// Floating, bottom-left cube tray. Collapsed it's a green PackageIcon circle;
// hovering — or dragging a card — expands it into the list of saved cube boards,
// which double as drop targets for the drag-to-add gesture.
const CubeTray: React.FC<CubeTrayProps> = ({ leftClassName = 'left-4' }) => {
  const user = useContext(UserContext);
  const tray = useCubeTray();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Hidden when logged out, when the user has turned the tray off in their
  // settings, or (via the `hidden md:flex` class below) on mobile widths.
  if (!user || !tray || user.disableCubeTray) return null;

  const { combos, removeCombo, isDragging, dragCard, getPointer, toast } = tray;
  const expanded = hovered || isDragging || pinned;

  return (
    <>
      <div
        className={classNames(
          // `hidden md:flex` keeps the tray off mobile widths entirely.
          'fixed bottom-4 z-50 hidden md:flex flex-col items-start gap-2 transition-[left] duration-300',
          leftClassName,
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {toast && (
          <div
            className={classNames('rounded-md px-3 py-2 text-sm font-medium shadow-lg text-button-text max-w-xs', {
              'bg-button-primary': toast.color === 'success',
              'bg-button-danger': toast.color === 'danger',
            })}
          >
            {toast.message}
          </div>
        )}

        {expanded && (
          <div className="w-72 max-h-[60vh] overflow-auto rounded-lg border border-border bg-bg-accent p-2 shadow-xl">
            <Text sm semibold className="px-2 py-1 block text-text-secondary">
              {isDragging ? 'Drop on a board to add' : 'Your cube boards'}
            </Text>
            {combos.length === 0 ? (
              <Text sm className="px-2 py-2 block text-text-secondary">
                No saved boards yet. Add the cube you're currently working on - then drag and drop cards from anywhere
                for quick adds!
              </Text>
            ) : (
              <div className="flex flex-col gap-1">
                {combos.map((c) => (
                  <div
                    key={comboKey(c)}
                    data-cubetray-board=""
                    data-cube-id={c.cubeId}
                    data-cube-name={c.cubeName}
                    data-board-key={c.boardKey}
                    data-board-label={c.boardLabel}
                    className={classNames(
                      'group flex items-center gap-2 rounded-md px-3 py-2 transition-colors',
                      isDragging
                        ? 'ring-1 ring-border hover:ring-2 hover:ring-button-primary hover:bg-button-primary/15'
                        : 'hover:bg-bg-active',
                    )}
                  >
                    <PackageIcon size={14} className="shrink-0 text-text-secondary" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-text">{c.cubeName}</span>
                      <span className="truncate text-xs text-text-secondary">{c.boardLabel}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove from tray"
                      className="ml-auto shrink-0 text-text-secondary opacity-60 hover:text-button-danger hover:opacity-100"
                      onClick={() => removeCombo(comboKey(c))}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-button-primary hover:bg-button-primary/10"
              onClick={() => setModalOpen(true)}
            >
              <PlusIcon size={14} /> Add cube board
            </button>
            <a
              href="/user/account?nav=display"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-active hover:text-text"
            >
              <GearIcon size={14} /> Disable this tray in settings
            </a>
          </div>
        )}

        <button
          type="button"
          aria-label="Cube tray"
          aria-expanded={expanded}
          onClick={() => setPinned((p) => !p)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-button-primary text-button-text shadow-lg transition-colors hover:bg-button-primary-active"
        >
          <PackageIcon size={24} />
        </button>
      </div>

      <AddCubeBoardModal isOpen={modalOpen} setOpen={setModalOpen} />
      {isDragging && dragCard && <DragGhost card={dragCard} getPointer={getPointer} />}
    </>
  );
};

export default CubeTray;
