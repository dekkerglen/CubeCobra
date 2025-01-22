import React, { useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { Flexbox } from './Layout';
import ResponsiveDiv from './ResponsiveDiv';

interface NavMenuProps {
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  navBar?: boolean;
}

const NavMenu: React.FC<NavMenuProps> = ({ label, children, wide, navBar }) => {
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

    //asdsd
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
          className={classNames('py-2 dropdown-toggle font-semibold', {
            'text-text-secondary': !isOpen && navBar,
            'text-text-secondary-active': isOpen && navBar,
            'text-link': !isOpen && !navBar,
            'text-link-active': isOpen && !navBar,
          })}
          onClick={() => setIsOpen(!isOpen)}
        >
          {label}
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
        <a
          className={classNames(
            'rounded-md rounded-br-none select-none p-2 dropdown-toggle font-semibold cursor-pointer transition-colors duration-200 ease-in-out',
            {
              'text-text-secondary hover:text-text-secondary-active': !isOpen && navBar,
              'text-text bg-bg': isOpen && navBar,
              'text-link hover:text-link-active': !isOpen && !navBar,
              'bg-link text-bg': isOpen && !navBar,
            },
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {label}
        </a>
        <div
          className={classNames(
            'absolute right-0 mt-2 bg-bg shadow-lg rounded-md z-10 border border-border rounded-tr-none transition-all duration-300',
            {
              'opacity-100 max-h-screen': isOpen,
              'opacity-0 pointer-events-none max-h-0': !isOpen,
              'w-64': !wide,
              'w-96': wide,
            },
          )}
        >
          {children}
        </div>
      </ResponsiveDiv>
    </div>
  );
};

export default NavMenu;
