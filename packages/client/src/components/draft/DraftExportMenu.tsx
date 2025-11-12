import React, { useCallback } from 'react';

import { cardName } from '@utils/cardutil';
import Draft from '@utils/datatypes/Draft';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import NavMenu from 'components/base/NavMenu';
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
    <NavMenu label="Export">
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
        <Alerts alerts={alerts} />
      </Flexbox>
    </NavMenu>
  );
};

DraftExportMenu.displayName = 'DraftExportMenu';
export default DraftExportMenu;
