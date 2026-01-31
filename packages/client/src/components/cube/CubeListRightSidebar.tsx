import React, { useContext } from 'react';

import classNames from 'classnames';

import DisplayContext from 'contexts/DisplayContext';

import CubeListEditSidebar from './CubeListEditSidebar';
import CubeListSortSidebar from './CubeListSortSidebar';

interface CubeListRightSidebarProps {
  canEdit: boolean;
}

const CubeListRightSidebar: React.FC<CubeListRightSidebarProps> = ({ canEdit }) => {
  const { rightSidebarMode, setRightSidebarMode } = useContext(DisplayContext);

  const closeSidebar = () => {
    setRightSidebarMode('none');
  };

  const isSidebarOpen = rightSidebarMode !== 'none';

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
            'fixed top-0 right-0 h-full z-50 w-96 transform',
            {
              'translate-x-0': rightSidebarMode === 'edit',
              'translate-x-full': rightSidebarMode !== 'edit',
            },
          )}
        >
          <div className="sticky top-0 h-screen overflow-y-auto overflow-x-hidden">
            <div className="w-96 p-4 pb-64">
              <CubeListEditSidebar />
            </div>
          </div>
        </div>
      )}

      {/* Edit Sidebar - Desktop */}
      {canEdit && (
        <div
          className={classNames(
            'hidden md:block bg-bg-accent border-l border-border transition-all duration-300 ease-in-out flex-shrink-0',
            {
              'w-96': rightSidebarMode === 'edit',
              'w-0': rightSidebarMode !== 'edit',
              'border-l-0': rightSidebarMode !== 'edit',
            },
          )}
        >
          <div className="sticky top-0 h-screen overflow-y-auto overflow-x-hidden">
            <div className="w-96 p-4 pb-64">
              <CubeListEditSidebar />
            </div>
          </div>
        </div>
      )}

      {/* Sort Sidebar - Mobile */}
      <div
        className={classNames(
          'md:hidden bg-bg-accent border-l border-border transition-transform duration-300 ease-in-out flex-shrink-0',
          'fixed top-0 right-0 h-full z-50 w-96 transform',
          {
            'translate-x-0': rightSidebarMode === 'sort',
            'translate-x-full': rightSidebarMode !== 'sort',
          },
        )}
      >
        <div className="sticky top-0 h-screen overflow-y-auto overflow-x-hidden">
          <div className="w-96 p-4 pb-64">
            <CubeListSortSidebar canEdit={canEdit} />
          </div>
        </div>
      </div>

      {/* Sort Sidebar - Desktop */}
      <div
        className={classNames(
          'hidden md:block bg-bg-accent border-l border-border transition-all duration-300 ease-in-out flex-shrink-0',
          {
            'w-96': rightSidebarMode === 'sort',
            'w-0': rightSidebarMode !== 'sort',
            'border-l-0': rightSidebarMode !== 'sort',
          },
        )}
      >
        <div className="sticky top-0 h-screen overflow-y-auto overflow-x-hidden">
          <div className="w-96 p-4 pb-64">
            <CubeListSortSidebar canEdit={canEdit} />
          </div>
        </div>
      </div>
    </>
  );
};

export default CubeListRightSidebar;
