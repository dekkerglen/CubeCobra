import React, { useMemo, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

import { Card, CardFooter, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Pagination from '../base/Pagination';
import Table from '../base/Table';
import Text from '../base/Text';
import useCubeTrayDrag from '../cubetray/useCubeTrayDrag';
import withAutocard from '../WithAutocard';

const AutocardA = withAutocard(Link);

const PAGE_SIZE = 10;

interface CardPageProps {
  card: CardDetails;
  versions: CardDetails[];
}

const capStringLength = (str: string, maxLength: number) => {
  if (str.length > maxLength + 3) {
    return `${str.substring(0, maxLength)}...`;
  }
  return str;
};

const CardVersions: React.FC<CardPageProps> = ({ card, versions }) => {
  const drag = useCubeTrayDrag();
  const [page, setPage] = useState(0);

  // The printing being viewed leads the list rather than being left out of it, so the
  // table covers every printing and prices this one alongside the rest. Sorting the
  // filtered copy, since Array.sort mutates and `versions` is a prop.
  const printings = useMemo(() => {
    const others = versions
      .filter((version) => version.scryfall_id !== card.scryfall_id)
      .sort((a, b) => new Date(b.released_at).valueOf() - new Date(a.released_at).valueOf());

    return [card, ...others];
  }, [card, versions]);

  const pageCount = Math.ceil(printings.length / PAGE_SIZE);
  const visiblePrintings = printings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Make each row a cube-tray drag source (mirrors the card search table).
  const getRowProps = drag.active
    ? (rowIndex: number) => ({
        className: 'cursor-grab active:cursor-grabbing',
        onPointerDown: (e: React.PointerEvent<HTMLTableRowElement>) =>
          drag.start(detailsToCard(visiblePrintings[rowIndex]), e),
        onDragStart: (e: React.DragEvent<HTMLTableRowElement>) => e.preventDefault(),
        // Capture so a drag's trailing click doesn't follow the Version link.
        onClickCapture: (e: React.MouseEvent<HTMLTableRowElement>) => {
          if (drag.suppressClick()) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
      })
    : undefined;

  return (
    <Card>
      {/* The pager shares the header rather than taking a band of its own above the
          table, which cost a row and read as a second heading. */}
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" gap="2">
          <Text semibold lg>
            Printings
          </Text>
          {pageCount > 1 && <Pagination count={pageCount} active={page} onClick={(p) => setPage(p)} />}
        </Flexbox>
      </CardHeader>
      {/* Always at least one row, since the printing being viewed is always in the list. */}
      <Table
        borderless
        headers={['Version', 'USD', 'USD Foil', 'EUR', 'TIX']}
        rows={visiblePrintings.map((version) => ({
          Version: (
            <AutocardA card={detailsToCard(version)} href={`/tool/card/${version.scryfall_id}`}>
              {capStringLength(`${version.set_name} [${version.set.toUpperCase()}-${version.collector_number}]`, 30)}
            </AutocardA>
          ),
          USD: version.prices.usd ? `$${version.prices.usd}` : '',
          'USD Foil': version.prices.usd_foil ? `$${version.prices.usd_foil}` : '',
          EUR: version.prices.eur ? `€${version.prices.eur}` : '',
          TIX: version.prices.tix ? `${version.prices.tix}` : '',
        }))}
        getRowProps={getRowProps}
      />
      {/* The full search lives at the end of the list it extends, rather than as a
          button competing with the card's other links. */}
      <CardFooter>
        <Link href={`/tool/searchcards?f=name%3A"${card.name}"&p=0&di=printings`} target="_blank">
          View all printings
        </Link>
      </CardFooter>
    </Card>
  );
};

export default CardVersions;
