import React, { useContext, useMemo } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';

import { Card, CardBody } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import BotDeckStatusBanner from 'components/BotDeckStatusBanner';
import CubeDeckNavbar from 'components/cube/CubeDeckNavbar';
import DeckCard from 'components/DeckCard';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UpgradePrompt from 'components/UpgradePrompt';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import { useCardDetails } from 'hooks/useCardDetails';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

interface CubeDeckPageProps {
  cube: Cube;
  draft: Draft;
}

const CubeDeckPage: React.FC<CubeDeckPageProps> = ({ cube, draft }) => {
  const user = useContext(UserContext);
  const [seatIndex, setSeatIndex] = useQueryParam('seat', '0');
  const [view, setView] = useQueryParam('view', 'draft');

  // The server strips card.details to keep egress down; we rehydrate from
  // the IndexedDB cache (utils/cardDetailsCache). While the cache fetch is
  // in flight every card still has a placeholder details object so any
  // component reading card.details.* keeps rendering.
  const cardIDs = useMemo(() => (draft.cards || []).map((c: any) => c?.cardID).filter(Boolean), [draft.cards]);
  const { details: detailsById } = useCardDetails(cardIDs);

  const hydratedDraft = useMemo<Draft>(() => {
    if (!draft.cards) return draft;
    return {
      ...draft,
      cards: draft.cards.map((c: any) => ({
        ...c,
        details: (c?.cardID && detailsById[c.cardID]) || getPlaceholderCardDetails(c?.cardID || ''),
      })),
    };
  }, [draft, detailsById]);

  const hasData = (hydratedDraft.seats?.length ?? 0) > 0 && (hydratedDraft.cards?.length ?? 0) > 0;

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <DynamicFlash />
          <BotDeckStatusBanner
            draftId={draft.id}
            initiallyPending={draft.botDecksPending}
            initiallyFailed={draft.botDecksFailed}
          />
          {hasData ? (
            <>
              <CubeDeckNavbar
                draft={hydratedDraft}
                user={user}
                seatIndex={seatIndex}
                setSeatIndex={setSeatIndex}
                view={view}
                setView={setView}
              />
              <UpgradePrompt className="mt-3" storageKey="deckPage" message="Hope you enjoyed your draft!" />
              <Row className="mt-3 mb-3">
                <Col>
                  <DeckCard
                    seat={hydratedDraft.seats[parseInt(seatIndex)]}
                    draft={hydratedDraft}
                    seatIndex={`${seatIndex}`}
                    view={view}
                  />
                </Col>
              </Row>
            </>
          ) : (
            <Row className="mt-3 mb-3">
              <Col>
                <Card>
                  <CardBody>
                    <Text semibold lg>
                      This draft has no data.
                    </Text>
                    <Text className="text-text-secondary">
                      The seats and cards for this draft are missing. This usually means the draft was never finished or
                      its data was lost.
                    </Text>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          )}
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDeckPage);
