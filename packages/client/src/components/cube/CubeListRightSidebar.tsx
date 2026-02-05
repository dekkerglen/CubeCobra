import React, { useContext } from 'react';

import { ArrowSwitchIcon, ChevronRightIcon, MoveToTopIcon, SidebarExpandIcon, XIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import ScrollShadowContainer from 'components/base/ScrollShadowContainer';
import Tooltip from 'components/base/Tooltip';
import DisplayContext from 'contexts/DisplayContext';

import CubeListEditSidebar from './CubeListEditSidebar';
import CubeListSortSidebar from './CubeListSortSidebar';

interface CubeListRightSidebarProps {
  canEdit: boolean;
}

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

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeSidebar}
          aria-hidden="true"
        />
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
          <div className="sticky top-0 h-screen">
            <ScrollShadowContainer>
              <div className="w-80 max-w-full">
                {/* Header */}
                <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent">
                  <button
                    onClick={closeSidebar}
                    className="text-text hover:text-text-secondary transition-colors cursor-pointer"
                    aria-label="Close sidebar"
                  >
                    <ChevronRightIcon size={20} />
                  </button>
                  <h2
                    onClick={closeSidebar}
                    className="text-lg font-semibold cursor-pointer hover:text-text-secondary transition-colors"
                  >
                    Edit
                  </h2>
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
                    <CubeListBottomToggle />
                  </div>
                </div>
                {/* Content */}
                <div className="p-4">
                  <CubeListEditSidebar />
                </div>
              </div>
            </ScrollShadowContainer>
          </div>
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
          <div className="sticky top-0 h-screen">
            <ScrollShadowContainer>
              <div className="w-80 max-w-full">
                {/* Header */}
                <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent">
                  <button
                    onClick={closeSidebar}
                    className="text-text hover:text-text-secondary transition-colors cursor-pointer"
                    aria-label="Close sidebar"
                  >
                    <ChevronRightIcon size={20} />
                  </button>
                  <h2
                    onClick={closeSidebar}
                    className="text-lg font-semibold cursor-pointer hover:text-text-secondary transition-colors"
                  >
                    Edit
                  </h2>
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
                    <CubeListBottomToggle />
                  </div>
                </div>
                {/* Content */}
                <div className="p-4">
                  <CubeListEditSidebar isHorizontal={false} />
                </div>
              </div>
            </ScrollShadowContainer>
          </div>
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
        <div className="sticky top-0 h-screen">
          <ScrollShadowContainer>
            <div className="w-80 max-w-full">
              {/* Header */}
              <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent">
                <button
                  onClick={closeSidebar}
                  className="text-text hover:text-text-secondary transition-colors cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <ChevronRightIcon size={20} />
                </button>
                <h2
                  onClick={closeSidebar}
                  className="text-lg font-semibold cursor-pointer hover:text-text-secondary transition-colors"
                >
                  Display
                </h2>
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
                  <CubeListBottomToggle />
                </div>
              </div>
              {/* Content */}
              <div className="p-4">
                <CubeListSortSidebar canEdit={canEdit} />
              </div>
            </div>
          </ScrollShadowContainer>
        </div>
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
        <div className="sticky top-0 h-screen">
          <ScrollShadowContainer>
            <div className="w-80 max-w-full">
              {/* Header */}
              <div className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-bg-accent">
                <button
                  onClick={closeSidebar}
                  className="text-text hover:text-text-secondary transition-colors cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <ChevronRightIcon size={20} />
                </button>
                <h2
                  onClick={closeSidebar}
                  className="text-lg font-semibold cursor-pointer hover:text-text-secondary transition-colors"
                >
                  Display
                </h2>
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
                  <CubeListBottomToggle />
                </div>
              </div>
              {/* Content */}
              <div className="p-4">
                <CubeListSortSidebar canEdit={canEdit} isHorizontal={false} />
              </div>
            </div>
          </ScrollShadowContainer>
        </div>
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
