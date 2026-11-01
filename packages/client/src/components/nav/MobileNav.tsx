import React, { useContext, useEffect, useState } from 'react';

import { PackageIcon, ThreeBarsIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';

import UserContext from '../../contexts/UserContext';
import MobileNavDrawer from './MobileNavDrawer';

// Both drawers portal to document.body, so they outlive the `md:hidden` wrapper this bar sits in:
// a viewport that crosses 768px while one is open would leave it on screen over the desktop nav.
const DESKTOP_QUERY = '(min-width: 768px)';

// The negative margins cancel the px-2 touch padding so each glyph's ink lands on the navbar
// gutter; without them the boxes are symmetric but the ink sits 8px inside.
const buttonClasses = 'rounded-md px-2 py-1 text-text-secondary hover:text-text-secondary-active';

const MobileNav: React.FC = () => {
  const user = useContext(UserContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cubesOpen, setCubesOpen] = useState(false);

  useEffect(() => {
    // A non-browser consumer has no matchMedia at all, and Safari before 14 returns a
    // MediaQueryList with only the deprecated addListener pair — no MediaQueryList.addEventListener.
    // Either way the bar still paints, it simply keeps no breakpoint watch.
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(DESKTOP_QUERY);
    if (typeof query.addEventListener !== 'function') {
      return undefined;
    }
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
        setCubesOpen(false);
      }
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);

  const hasUnread = (user?.notifications || []).length > 0;

  return (
    <div className="relative flex h-10 flex-row items-center justify-between">
      <button
        type="button"
        aria-label={hasUnread ? 'Open menu, you have unread notifications' : 'Open menu'}
        onClick={() => setMenuOpen(true)}
        className={`${buttonClasses} relative -ml-2`}
      >
        <ThreeBarsIcon size={24} />
        {hasUnread && (
          <span
            data-testid="mobile-nav-unread-dot"
            // Presence only: the count belongs to the Notifications row inside the drawer.
            className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full bg-button-danger ring-2 ring-bg-secondary"
          />
        )}
      </button>

      {/* Centred against the bar rather than between its slots, so the logo does not shift when the
          cubes button is absent. The bar carries the row height the logo used to give it in flow.
          Centring is inset-x-0 plus auto margins rather than left-1/2: a shrink-to-fit absolute box
          offered only half the bar caps the wordmark at 50% of it. The max-width keeps it clear of
          both icon buttons, which at h-10 it would collide with below ~390px. */}
      <a href="/" className="absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[calc(100%-7rem)] -translate-y-1/2">
        <img
          className="h-8 w-auto max-w-full object-contain"
          src={cdnUrl('/content/banner.png')}
          alt="Cube Cobra: a site for Magic: the Gathering Cube"
        />
      </a>

      {/* Signed-in only: every destination in the cubes drawer is personal, so offering the button
          to a signed-out visitor would open an empty panel. */}
      {user && (
        <button
          type="button"
          aria-label="Your cubes"
          onClick={() => setCubesOpen(true)}
          className={`${buttonClasses} -mr-2`}
        >
          <PackageIcon size={24} />
        </button>
      )}

      <MobileNavDrawer isOpen={menuOpen} setOpen={setMenuOpen} side="left" />
      <MobileNavDrawer isOpen={cubesOpen} setOpen={setCubesOpen} side="right" />
    </div>
  );
};

export default MobileNav;
