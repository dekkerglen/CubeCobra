import React, { useMemo } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import Banner from 'components/Banner';
import { Col, Row } from 'components/base/Layout';
import CardBreakdown from 'components/cardPage/CardBreakdown';
import Correlations from 'components/cardPage/Correlations';
import CardPurchase from 'components/cardPage/Purchase';
import CardVersions from 'components/cardPage/Versions';
import CubeTray from 'components/cubetray/CubeTray';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CubeTrayProvider } from 'contexts/CubeTrayContext';
import { useCardDetails } from 'hooks/useCardDetails';
import MainLayout from 'layouts/MainLayout';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

interface IDBuckets {
  top: string[];
  creatures: string[];
  spells: string[];
  other: string[];
}

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
  versionIDs: string[];
  draftedWithIDs: IDBuckets;
  cubedWithIDs: IDBuckets;
  synergisticIDs: IDBuckets;
}

const hydrateBucket = (
  ids: IDBuckets,
  detailsById: Record<string, CardDetails | null>,
): {
  top: CardDetails[];
  creatures: CardDetails[];
  spells: CardDetails[];
  other: CardDetails[];
} => ({
  top: ids.top.map((id) => detailsById[id] || getPlaceholderCardDetails(id)),
  creatures: ids.creatures.map((id) => detailsById[id] || getPlaceholderCardDetails(id)),
  spells: ids.spells.map((id) => detailsById[id] || getPlaceholderCardDetails(id)),
  other: ids.other.map((id) => detailsById[id] || getPlaceholderCardDetails(id)),
});

const CardPage: React.FC<CardPageProps> = ({
  card,
  history,
  versionIDs,
  draftedWithIDs,
  cubedWithIDs,
  synergisticIDs,
}) => {
  // The main `card` ships inline from the server — it's the subject of the
  // page and we want the breakdown/header rendered immediately. Everything
  // else (versions table + related-card buckets) is hydrated from the cache
  // in a single batched lookup, with placeholders filling in until details
  // arrive from IndexedDB.
  const listIDs = useMemo(() => {
    const set = new Set<string>(versionIDs);
    for (const bucket of [draftedWithIDs, cubedWithIDs, synergisticIDs]) {
      if (!bucket) continue;
      for (const list of [bucket.top, bucket.creatures, bucket.spells, bucket.other]) {
        for (const id of list || []) set.add(id);
      }
    }
    return [...set];
  }, [versionIDs, draftedWithIDs, cubedWithIDs, synergisticIDs]);

  const { details: detailsById } = useCardDetails(listIDs);

  const filteredVersions = useMemo(() => {
    const list = versionIDs.map((id) => detailsById[id] || getPlaceholderCardDetails(id));
    return list
      .slice()
      .sort((a, b) => {
        const date1 = new Date(a.released_at).getTime();
        const date2 = new Date(b.released_at).getTime();
        if (date1 > date2) return -1;
        if (date2 > date1) return 1;
        return 0;
      })
      .filter((version) => version.scryfall_id !== card.scryfall_id);
  }, [versionIDs, detailsById, card.scryfall_id]);

  const draftedWith = useMemo(() => hydrateBucket(draftedWithIDs, detailsById), [draftedWithIDs, detailsById]);
  const cubedWith = useMemo(() => hydrateBucket(cubedWithIDs, detailsById), [cubedWithIDs, detailsById]);
  const synergistic = useMemo(() => hydrateBucket(synergisticIDs, detailsById), [synergisticIDs, detailsById]);

  return (
    <CubeTrayProvider>
      <MainLayout>
        <DynamicFlash />
        <Banner />
        <Row className="my-3">
          <Col xs={12} xxl={8}>
            <CardBreakdown card={card} history={history} />
          </Col>
          <Col xs={12} xxl={4}>
            <Row>
              <Col xs={12} md={6} xxl={12}>
                <CardVersions card={card} versions={filteredVersions} />
              </Col>
              <Col xs={12} md={6} xxl={12}>
                <CardPurchase card={card} />
              </Col>
            </Row>
          </Col>
        </Row>
        <Correlations
          draftedWith={draftedWith}
          cubedWith={cubedWith}
          synergistic={synergistic}
          oracleId={card.oracle_id}
        />
      </MainLayout>
      <CubeTray />
    </CubeTrayProvider>
  );
};

export default RenderToRoot(CardPage);
