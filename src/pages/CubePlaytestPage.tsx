import React, { useContext, useMemo } from 'react';

import Controls from 'components/base/Controls';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import CustomDraftCard from 'components/CustomDraftCard';
import CustomDraftFormatModal from 'components/modals/CustomDraftFormatModal';
import DynamicFlash from 'components/DynamicFlash';
import GridDraftCard from 'components/GridDraftCard';
import PlaytestDecksCard from 'components/PlaytestDecksCard';
import RenderToRoot from 'components/RenderToRoot';
import SamplePackCard from 'components/SamplePackCard';
import SealedCard from 'components/SealedCard';
import StandardDraftCard from 'components/StandardDraftCard';
import UploadDecklistModal from 'components/modals/UploadDecklistModal';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubePlaytestPageProps {
  cube: Cube;
  decks: Draft[];
  loginCallback?: string;
}

const UploadDecklistModalLink = withModal(Link, UploadDecklistModal);
const CreateCustomFormatLink = withModal(Link, CustomDraftFormatModal);

const CubePlaytestPage: React.FC<CubePlaytestPageProps> = ({ cube, decks, loginCallback = '/' }) => {
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
      <CubeLayout cube={cube} activeLink="playtest" hasControls={user != null && cube.owner.id == user.id}>
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
                <SealedCard />
                <GridDraftCard />
              </Flexbox>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <Flexbox direction="col" gap="2">
                <SamplePackCard />
                {decks.length !== 0 && <PlaytestDecksCard decks={decks} />}
              </Flexbox>
            </Col>
          </Row>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubePlaytestPage);
