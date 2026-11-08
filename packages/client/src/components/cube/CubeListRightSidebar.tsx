import React, { useContext } from 'react';

import { ArrowSwitchIcon, ChevronRightIcon, MoveToTopIcon, SidebarExpandIcon, XIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import ScrollShadowContainer from 'components/base/ScrollShadowContainer';
import Tooltip from 'components/base/Tooltip';
import DisplayContext from 'contexts/DisplayContext';
import useStickyPanelHeight from 'hooks/useStickyPanelHeight';

import CubeListEditSidebar from './CubeListEditSidebar';
import CubeListSortSidebar from './CubeListSortSidebar';

interface CubeListRightSidebarProps {
  canEdit: boolean;
}

interface SidebarPanelProps {
  title: string;
  onClose: () => void;
  actions: React.ReactNode;
  children: React.ReactNode;
}

// Sticky panel shared by the mobile and desktop sidebars. The header sits outside the scroll area so
// it stays reachable however far the content is scrolled.
const SidebarPanel: React.FC<SidebarPanelProps> = ({ title, onClose, actions, children }) => {
  const panelRef = useStickyPanelHeight<HTMLDivElement>();

  return (
    <div ref={panelRef} className="sticky top-0 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between w-80 max-w-full flex-shrink-0 px-4 py-3 border-b border-border bg-bg-accent">
        <button
          onClick={onClose}
          className="text-text hover:text-text-secondary transition-colors cursor-pointer"
          aria-label="Close sidebar"
        >
          <ChevronRightIcon size={20} />
        </button>
        <h2
          onClick={onClose}
          className="text-lg font-semibold cursor-pointer hover:text-text-secondary transition-colors"
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0">
        <ScrollShadowContainer>
          <div className="w-80 max-w-full p-4">{children}</div>
        </ScrollShadowContainer>
      </div>
    </div>
  );
};

// Component for the right sidebar (mobile and desktop)
const CubeListRightSidebar: React.FC<CubeListRightSidebarProps> = ({ canEdit }) => {
  const { rightSidebarMode, setRightSidebarMode, rightSidebarPosition } = useContext(DisplayContext);

  const closeSidebar = () => {
    setRightSidebarMode('none');
  };

  const isSidebarOpen = rightSidebarMode !== 'none';
  const isEditMode = rightSidebarMode === 'edit';
  const isSortMode = rightSidebarMode === 'sort';

  // Don't render right sidebars when in bottom position
  if (rightSidebarPosition === 'bottom') {
    return null;
  }

  const editActions = (
    <>
      <Tooltip text="Switch to Display" position="bottom">
        <button
          onClick={() => setRightSidebarMode('sort')}
          className="text-text hover:text-text-secondary transition-colors"
          aria-label="Switch to Display"
        >
          <ArrowSwitchIcon size={20} />
        </button>
      </Tooltip>
      <CubeListBottomToggle />
    </>
  );

  const sortActions = (
    <>
      {canEdit && (
        <Tooltip text="Switch to Edit" position="bottom">
          <button
            onClick={() => setRightSidebarMode('edit')}
            className="text-text hover:text-text-secondary transition-colors"
            aria-label="Switch to Edit"
          >
            <ArrowSwitchIcon size={20} />
          </button>
        </Tooltip>
      )}
      <CubeListBottomToggle />
    </>
  );

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Edit Sidebar - Mobile */}
      {canEdit && (
        <div
          className={classNames(
            'md:hidden bg-bg-accent border-l border-border transition-transform duration-300 ease-in-out flex-shrink-0',
            'fixed top-0 right-0 h-full z-50 w-80 max-w-screen transform',
            {
              'translate-x-0': rightSidebarMode === 'edit',
              'translate-x-full': rightSidebarMode !== 'edit',
            },
          )}
        >
          <SidebarPanel title="Edit" onClose={closeSidebar} actions={editActions}>
            <CubeListEditSidebar />
          </SidebarPanel>
        </div>
      )}

      {/* Edit Sidebar - Desktop Right */}
      {canEdit && (
        <div
          className={classNames(
            'hidden md:block bg-bg-accent border-l border-border transition-all duration-300 ease-in-out flex-shrink-0 max-w-screen',
            {
              'w-80': isEditMode,
              'w-0': !isEditMode,
              'border-l-0': !isEditMode,
            },
          )}
        >
          <SidebarPanel title="Edit" onClose={closeSidebar} actions={editActions}>
            <CubeListEditSidebar isHorizontal={false} />
          </SidebarPanel>
        </div>
      )}

      {/* Sort Sidebar - Mobile */}
      <div
        className={classNames(
          'md:hidden bg-bg-accent border-l border-border transition-transform duration-300 ease-in-out flex-shrink-0',
          'fixed top-0 right-0 h-full z-50 w-80 max-w-screen transform',
          {
            'translate-x-0': isSortMode,
            'translate-x-full': !isSortMode,
          },
        )}
      >
        <SidebarPanel title="Display" onClose={closeSidebar} actions={sortActions}>
          <CubeListSortSidebar canEdit={canEdit} />
        </SidebarPanel>
      </div>

      {/* Sort Sidebar - Desktop Right */}
      <div
        className={classNames(
          'hidden md:block bg-bg-accent border-l border-border transition-all duration-300 ease-in-out flex-shrink-0 max-w-screen',
          {
            'w-80': isSortMode,
            'w-0': !isSortMode,
            'border-l-0': !isSortMode,
          },
        )}
      >
        <SidebarPanel title="Display" onClose={closeSidebar} actions={sortActions}>
          <CubeListSortSidebar canEdit={canEdit} isHorizontal={false} />
        </SidebarPanel>
      </div>
    </>
  );
};

// Helper component for the bottom toggle button
const CubeListBottomToggle: React.FC = () => {
  const { setRightSidebarPosition } = useContext(DisplayContext);

  const togglePosition = () => {
    setRightSidebarPosition((prev) => (prev === 'right' ? 'bottom' : 'right'));
  };

  return (
    <Tooltip text="Move to inline" position="bottom">
      <button
        onClick={togglePosition}
        className="text-text hover:text-text-secondary transition-colors"
        aria-label="Move to inline"
      >
        <MoveToTopIcon size={20} />
      </button>
    </Tooltip>
  );
};

// Component for inline bottom cards (to be rendered in page content)
export const CubeListBottomCard: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { rightSidebarMode, setRightSidebarMode, rightSidebarPosition, setRightSidebarPosition } =
    useContext(DisplayContext);

  const closeSidebar = () => {
    setRightSidebarMode('none');
  };

  const togglePosition = () => {
    setRightSidebarPosition((prev) => (prev === 'right' ? 'bottom' : 'right'));
  };

  const isEditMode = rightSidebarMode === 'edit';
  const isSortMode = rightSidebarMode === 'sort';

  // Only render when in bottom position and sidebar is open
  if (rightSidebarPosition !== 'bottom' || rightSidebarMode === 'none') {
    return null;
  }

  return (
    <>
      {/* Edit Card */}
      {canEdit && isEditMode && (
        <div className="w-full bg-bg-accent border border-border rounded-lg shadow-sm mt-2">
          <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent rounded-t-lg">
              <h2 className="text-lg font-semibold">Edit</h2>
              <div className="flex items-center gap-2">
                <Tooltip text="Switch to Display" position="bottom">
                  <button
                    onClick={() => setRightSidebarMode('sort')}
                    className="text-text hover:text-text-secondary transition-colors"
                    aria-label="Switch to Display"
                  >
                    <ArrowSwitchIcon size={20} />
                  </button>
                </Tooltip>
                <Tooltip text="Move to sidebar" position="bottom">
                  <button
                    onClick={togglePosition}
                    className="text-text hover:text-text-secondary transition-colors"
                    aria-label="Move to sidebar"
                  >
                    <SidebarExpandIcon size={20} />
                  </button>
                </Tooltip>
                <Tooltip text="Close" position="bottom">
                  <button
                    onClick={closeSidebar}
                    className="text-text hover:text-text-secondary transition-colors"
                    aria-label="Close"
                  >
                    <XIcon size={20} />
                  </button>
                </Tooltip>
              </div>
            </div>
            {/* Content */}
            <div className="p-4">
              <CubeListEditSidebar isHorizontal={true} />
            </div>
          </div>
        </div>
      )}

      {/* Sort/Display Card */}
      {isSortMode && (
        <div className="w-full bg-bg-accent border border-border rounded-lg shadow-sm mt-2">
          <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent rounded-t-lg">
              <h2 className="text-lg font-semibold">Display</h2>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <Tooltip text="Switch to Edit" position="bottom">
                    <button
                      onClick={() => setRightSidebarMode('edit')}
                      className="text-text hover:text-text-secondary transition-colors"
                      aria-label="Switch to Edit"
                    >
                      <ArrowSwitchIcon size={20} />
                    </button>
                  </Tooltip>
                )}
                <Tooltip text="Move to sidebar" position="bottom">
                  <button
                    onClick={togglePosition}
                    className="text-text hover:text-text-secondary transition-colors"
                    aria-label="Move to sidebar"
                  >
                    <SidebarExpandIcon size={20} />
                  </button>
                </Tooltip>
                <Tooltip text="Close" position="bottom">
                  <button
                    onClick={closeSidebar}
                    className="text-text hover:text-text-secondary transition-colors"
                    aria-label="Close"
                  >
                    <XIcon size={20} />
                  </button>
                </Tooltip>
              </div>
            </div>
            {/* Content */}
            <div className="p-4">
              <CubeListSortSidebar canEdit={canEdit} isHorizontal={true} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CubeListRightSidebar;
