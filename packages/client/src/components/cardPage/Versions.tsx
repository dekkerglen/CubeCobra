import React from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

import { Card, CardBody } from '../base/Card';
import Link from '../base/Link';
import PagedTable from '../base/PagedTable';
import withAutocard from '../WithAutocard';

const AutocardA = withAutocard(Link);

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
  const sortedVersions = versions.sort((a, b) => {
    const date1 = new Date(a.released_at);
    const date2 = new Date(b.released_at);

    if (date1 > date2) {
      return -1;
    }
    if (date2 > date1) {
      return 1;
    }
    return 0;
  });

  const filteredVersions = sortedVersions.filter((version) => {
    return version.scryfall_id !== card.scryfall_id;
  });

  return (
    <Card>
      {filteredVersions.length > 0 ? (
        <PagedTable
          headers={['Version', 'USD', 'USD Foil', 'EUR', 'TIX']}
          rows={filteredVersions.map((version) => ({
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
          className="m-2 ml-4"
        />
      ) : (
        <CardBody>
          <p>No other versions</p>
        </CardBody>
      )}
    </Card>
  );
};

export default CardVersions;
