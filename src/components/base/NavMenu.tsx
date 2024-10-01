import React, { useState, useRef, useEffect } from 'react';
import ResponsiveDiv from './ResponsiveDiv';
import Flexbox from './Flexbox';
import classNames from 'classnames';
// import Collapse from './Collapse';

interface NavMenuProps {
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}

const NavMenu: React.FC<NavMenuProps> = ({ label, children, wide }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      {/* Mobile */}
      <ResponsiveDiv baseVisible md>
        <a
          className={classNames('py-2 dropdown-toggle font-semibold', {
            'text-text-secondary': !isOpen,
            'text-text-secondary-active': isOpen,
          })}
          onClick={() => setIsOpen(!isOpen)}
        >
          {label}
        </a>
        {isOpen && (
          <div className="w-full bg-bg shadow-lg rounded-md border border-border">
            <Flexbox direction="col" gap="1" className="p-2">
              {children}
            </Flexbox>
          </div>
        )}
      </ResponsiveDiv>

      {/* Desktop */}
      <ResponsiveDiv md>
        <a
          className={classNames(
            'rounded-md rounded-br-none select-none p-2 dropdown-toggle font-semibold cursor-pointer transition-colors duration-200 ease-in-out',
            {
              'text-text-secondary hover:text-text-secondary-active': !isOpen,
              'text-text bg-bg': isOpen,
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
