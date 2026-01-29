import React, { useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { Flexbox } from './Layout';
import ResponsiveDiv from './ResponsiveDiv';

interface NavMenuProps {
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  navBar?: boolean;
  alignLeft?: boolean; // New prop to align dropdown to the left
  noChevron?: boolean; // New prop to hide the dropdown chevron
  noActiveStyle?: boolean; // New prop to prevent active styling
  noGap?: boolean; // New prop to remove gap between button and dropdown
}

const NavMenu: React.FC<NavMenuProps> = ({
  label,
  children,
  wide,
  navBar,
  alignLeft = false,
  noChevron = false,
  noActiveStyle = false,
  noGap = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * Per https://stackoverflow.com/a/55360806 don't register the event listener unless the NavMenu is open.
     * Without this every NavMenu registers the same handler so clicks on the page trigger 10+ events; though since
     * only one NavMenu is open at a time, most of the handlers do nothing when they call setIsOpen(false)
     */
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    /*
     * A function returned from useEffect is a cleanup function (https://react.dev/reference/react/useEffect#parameters) which
     * React calls before the next re-render (when the dependencies change)
     */
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      {/* Mobile */}
      <ResponsiveDiv baseVisible md>
        <a
          className={classNames('py-2 font-semibold flex items-center gap-1', {
            'text-text-secondary': !isOpen && navBar,
            'text-text-secondary-active': isOpen && navBar && !noActiveStyle,
            'text-link': !isOpen && !navBar,
            'text-link-active': isOpen && !navBar && !noActiveStyle,
          })}
          onClick={() => setIsOpen(!isOpen)}
        >
          {label}
          {!noChevron && <span className="dropdown-toggle-icon"></span>}
        </a>
        <div
          className={classNames('w-full bg-bg shadow-lg rounded-md border border-border', {
            'opacity-100 max-h-screen': isOpen,
            'opacity-0 pointer-events-none max-h-0': !isOpen,
            'w-64': !wide,
            'w-96': wide,
          })}
        >
          <Flexbox direction="col" gap="1" className="p-2">
            {children}
          </Flexbox>
        </div>
      </ResponsiveDiv>

      {/* Desktop */}
      <ResponsiveDiv md>
        <div className={classNames('inline-block cursor-pointer')} onClick={() => setIsOpen(!isOpen)}>
          <div
            className={classNames('flex items-center gap-1', {
              'rounded-md select-none p-2 font-semibold transition-colors duration-200 ease-in-out':
                !noActiveStyle || navBar,
              'rounded-br-none': !alignLeft && !noActiveStyle,
              'rounded-bl-none': alignLeft && !noActiveStyle,
              'text-text-secondary hover:text-text-secondary-active': !isOpen && navBar && !noActiveStyle,
              'text-text bg-bg': isOpen && navBar && !noActiveStyle,
              'text-link hover:text-link-active': !isOpen && !navBar && !noActiveStyle,
              'bg-link text-bg': isOpen && !navBar && !noActiveStyle,
            })}
          >
            {label}
            {!noChevron && <span className="dropdown-toggle-icon"></span>}
          </div>
        </div>
        <div
          className={classNames(
            'absolute bg-bg shadow-lg rounded-md z-10 border border-border transition-all duration-300',
            {
              'mt-2': !noGap,
              'mt-0': noGap,
              'opacity-100 max-h-screen': isOpen,
              'opacity-0 pointer-events-none max-h-0': !isOpen,
              'w-64': !wide,
              'w-96': wide,
            },
          )}
          style={{ right: 0 }}
        >
          {children}
        </div>
      </ResponsiveDiv>
    </div>
  );
};

export default NavMenu;
