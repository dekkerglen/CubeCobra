import React from 'react';

import { Card, CardBody } from 'components/base/Card';
import PagedTable from 'components/base/PagedTable';
import Text from 'components/base/Text';
import withAutocard from 'components/WithAutocard';
import CardType from 'datatypes/CardDetails';
import { detailsToCard } from 'utils/Card';
import Link from 'components/base/Link';

const AutocardA = withAutocard(Link);

interface CardPageProps {
  card: CardType;
  versions: CardType[];
}

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
    <Card className="mt-4">
      {filteredVersions.length > 0 ? (
        <PagedTable
          headers={['Version', 'USD', 'USD Foil', 'EUR', 'TIX']}
          rows={filteredVersions.map((version) => ({
            Version: (
              <AutocardA card={detailsToCard(version)} href={`/tool/card/${version.scryfall_id}`}>
                {`${version.set_name} [${version.set.toUpperCase()}-${version.collector_number}]`}
              </AutocardA>
            ),
            USD: version.prices.usd ? `$${version.prices.usd}` : '',
            'USD Foil': version.prices.usd_foil ? `$${version.prices.usd_foil}` : '',
            EUR: version.prices.eur ? `€${version.prices.eur}` : '',
            TIX: version.prices.tix ? `${version.prices.tix}` : '',
          }))}
          className="m-2 ml-4"
        >
          <Text semibold lg>
            Versions
          </Text>
        </PagedTable>
      ) : (
        <CardBody>
          <p>No other versions</p>
        </CardBody>
      )}
    </Card>
  );
};

export default CardVersions;