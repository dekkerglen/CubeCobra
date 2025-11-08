import React from 'react';

import Banner from 'components/Banner';
import { Col, Row } from 'components/base/Layout';
import CardBreakdown from 'components/cardPage/CardBreakdown';
import Correlations from 'components/cardPage/Correlations';
import CardPurchase from 'components/cardPage/Purchase';
import CardVersions from 'components/cardPage/Versions';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';
import MainLayout from 'layouts/MainLayout';

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
  draftedWith: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
  };
  cubedWith: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
  };
  synergistic: {
    top: CardDetails[];
    creatures: CardDetails[];
    spells: CardDetails[];
    other: CardDetails[];
  };
  versions: CardDetails[];
}

const CardPage: React.FC<CardPageProps> = ({
  card,
  history,
  versions,
  draftedWith,
  cubedWith,
  synergistic,
}) => {
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
      <Correlations draftedWith={draftedWith} cubedWith={cubedWith} synergistic={synergistic} oracleId={card.oracle_id} />
    </MainLayout>
  );
};

export default RenderToRoot(CardPage);
