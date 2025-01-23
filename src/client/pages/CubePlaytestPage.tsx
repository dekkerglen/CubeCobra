import React, { useContext, useMemo } from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import Controls from 'components/base/Controls';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CustomDraftCard from 'components/CustomDraftCard';
import DynamicFlash from 'components/DynamicFlash';
import GridDraftCard from 'components/GridDraftCard';
import CustomDraftFormatModal from 'components/modals/CustomDraftFormatModal';
import UploadDecklistModal from 'components/modals/UploadDecklistModal';
import PlaytestDecksCard from 'components/PlaytestDecksCard';
import RenderToRoot from 'components/RenderToRoot';
import SamplePackCard from 'components/SamplePackCard';
import SealedCard from 'components/SealedCard';
import StandardDraftCard from 'components/StandardDraftCard';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubePlaytestPageProps {
  cube: Cube;
  decks: Draft[];
  decksLastKey: any;
  loginCallback?: string;
}

const UploadDecklistModalLink = withModal(Link, UploadDecklistModal);
const CreateCustomFormatLink = withModal(Link, CustomDraftFormatModal);

const CubePlaytestPage: React.FC<CubePlaytestPageProps> = ({ cube, decks, decksLastKey, loginCallback = '/' }) => {
  const user = useContext(UserContext);
  const defaultDraftFormat = cube.defaultFormat ?? -1;

  // Sort formats alphabetically.
  const formatsSorted = useMemo(
    () =>
      cube.formats
        .map((format, index) => ({ ...format, index }))
        .sort((a, b) => {
          if (a.index === defaultDraftFormat) {
            return -1;
          }
          if (b.index === defaultDraftFormat) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        }),
    [cube.formats, defaultDraftFormat],
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest" hasControls={!!user && cube.owner.id === user.id}>
        <Flexbox direction="col" gap="2" className="mb-2">
          {user && cube.owner.id === user.id && (
            <Controls>
              <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
                <CreateCustomFormatLink
                  modalprops={{
                    formatIndex: -1,
                  }}
                >
                  Create Custom Draft Format
                </CreateCustomFormatLink>
                <UploadDecklistModalLink>Upload Decklist</UploadDecklistModalLink>
              </Flexbox>
            </Controls>
          )}
          <DynamicFlash />
          <Row>
            <Col xs={12} md={6} xl={6}>
              <Flexbox direction="col" gap="2">
                <SamplePackCard />
                {defaultDraftFormat === -1 && <StandardDraftCard defaultDraftFormat={defaultDraftFormat} />}
                {formatsSorted.map((format) => (
                  <CustomDraftCard
                    key={format.index}
                    format={format}
                    defaultDraftFormat={defaultDraftFormat}
                    formatIndex={format.index}
                  />
                ))}
                {defaultDraftFormat !== -1 && <StandardDraftCard defaultDraftFormat={defaultDraftFormat} />}
                <Card>
                  <CardHeader>
                    <Text semibold lg>
                      Multiplayer Draft
                    </Text>
                  </CardHeader>
                  <CardBody>
                    <Text>
                      Draft with other players and bots online using Draftmancer! Playtest data is uploaded back to
                      CubeCobra.
                    </Text>
                  </CardBody>
                  <CardFooter>
                    <Button
                      block
                      type="link"
                      color="primary"
                      href={`https://draftmancer.com/?cubeCobraID=${cube.id}&cubeCobraName=${encodeURIComponent(cube.name)}`}
                    >
                      Draft on Draftmancer
                    </Button>
                  </CardFooter>
                </Card>
                <SealedCard />
                <GridDraftCard />
              </Flexbox>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <Flexbox direction="col" gap="2">
                <PlaytestDecksCard decks={decks} decksLastKey={decksLastKey} cubeId={cube.id} />
              </Flexbox>
            </Col>
          </Row>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubePlaytestPage);
