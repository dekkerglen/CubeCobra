import React, { useCallback } from 'react';

import { ChevronDownIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Draft from '@utils/datatypes/Draft';

import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

interface DraftExportMenuProps {
  draft: Draft;
  seatIndex: string;
}

const DraftExportMenu: React.FC<DraftExportMenuProps> = ({ draft, seatIndex }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  const copyToClipboard = useCallback(async () => {
    const cards = draft.cards;
    const mainboard = draft.seats[parseInt(seatIndex || '0')].mainboard;

    //Equivalent logic to the backend
    const cardNames = [];
    for (const row of mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const name = cardName(cards[cardIndex]);
          if (name) {
            cardNames.push(name);
          }
        }
      }
    }

    await navigator.clipboard.writeText(cardNames.join('\n'));
    addAlert('success', 'Copied.');
    //Auto dismiss after a few seconds
    setTimeout(dismissAlerts, 3000);
  }, [addAlert, dismissAlerts, draft, seatIndex]);

  return (
    /* Dropdown, not NavMenu: NavMenu pins its panel with `style={{ right: 0 }}`, which is
       right for a trigger sitting at the right edge of the navbar (its only other two
       callers) and wrong everywhere else. In page content near the left edge the panel ran
       off the side of the screen -- at 390px it opened at left:-66 with its labels clipped.
       Dropdown lets the caller say which edge to anchor to. */
    <Dropdown
      align="left"
      minWidth="16rem"
      trigger={
        <Link className="flex items-center gap-1 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer">
          Export
          <ChevronDownIcon size={16} />
        </Link>
      }
    >
      <Flexbox direction="col" gap="2" className="p-3">
        <Link href={`/cube/deck/download/txt/${draft.id}/${seatIndex}`} className="dropdown-item">
          Card Names (.txt)
        </Link>
        <Link href={`#`} onClick={copyToClipboard} className="dropdown-item">
          Card Names to Clipboard (.txt)
        </Link>
        <Link href={`/cube/deck/download/forge/${draft.id}/${seatIndex}`} className="dropdown-item">
          Forge (.dck)
        </Link>
        <Link href={`/cube/deck/download/xmage/${draft.id}/${seatIndex}`} className="dropdown-item">
          XMage (.dck)
        </Link>
        <Link href={`/cube/deck/download/mtgo/${draft.id}/${seatIndex}`} className="dropdown-item">
          MTGO (.txt)
        </Link>
        <Link href={`/cube/deck/download/arena/${draft.id}/${seatIndex}`} className="dropdown-item">
          Arena (.txt)
        </Link>
        <Link href={`/cube/deck/download/cockatrice/${draft.id}/${seatIndex}`} className="dropdown-item">
          Cockatrice (.txt)
        </Link>
        <Link href={`/cube/deck/download/topdecked/${draft.id}/${seatIndex}`} className="dropdown-item">
          TopDecked (.csv)
        </Link>
        <Link href={`/cube/deck/download/csv/${draft.id}/${seatIndex}`} className="dropdown-item">
          Comma-Separated (.csv)
        </Link>
        <Alerts alerts={alerts} />
      </Flexbox>
    </Dropdown>
  );
};

DraftExportMenu.displayName = 'DraftExportMenu';
export default DraftExportMenu;
