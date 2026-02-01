import React, { useContext } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';

import { Flexbox } from 'components/base/Layout';
import PlaytestNavbar from 'components/cube/PlaytestNavbar';
import DynamicFlash from 'components/DynamicFlash';
import DecksView from 'components/playtest/DecksView';
import PracticeDraftView from 'components/playtest/PracticeDraftView';
import SamplePackView from 'components/playtest/SamplePackView';
import RenderToRoot from 'components/RenderToRoot';
import PlaytestViewContext, { PlaytestViewContextProvider } from 'contexts/PlaytestViewContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubePlaytestPageProps {
  cube: Cube;
  decks: Draft[];
  decksLastKey: any;
  previousPacks?: any[];
  previousPacksLastKey?: any;
}

const CubePlaytestPage: React.FC<CubePlaytestPageProps> = ({
  cube,
  decks,
  decksLastKey,
  previousPacks = [],
  previousPacksLastKey,
}) => {
  const playtestViewContext = useContext(PlaytestViewContext);
  const view = playtestViewContext?.view || 'practice-draft';

  let content;
  switch (view) {
    case 'practice-draft':
    default:
      content = <PracticeDraftView cube={cube} />;
      break;
    case 'decks':
      content = <DecksView decks={decks} decksLastKey={decksLastKey} cubeId={cube.id} />;
      break;
    case 'sample-pack':
      content = (
        <SamplePackView
          cubeId={cube.id}
          cubeOwnerId={cube.owner.id}
          previousPacks={previousPacks}
          previousPacksLastKey={previousPacksLastKey}
        />
      );
      break;
  }

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink={view}>
        <Flexbox direction="col" gap="2">
          <DynamicFlash />
          <PlaytestNavbar />
          {content}
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

const CubePlaytestPageWrapper: React.FC<CubePlaytestPageProps> = (props) => {
  return (
    <PlaytestViewContextProvider>
      <CubePlaytestPageInner {...props} />
    </PlaytestViewContextProvider>
  );
};

const CubePlaytestPageInner: React.FC<CubePlaytestPageProps> = ({
  cube,
  decks,
  decksLastKey,
  previousPacks,
  previousPacksLastKey,
}) => {
  return (
    <CubePlaytestPage
      cube={cube}
      decks={decks}
      decksLastKey={decksLastKey}
      previousPacks={previousPacks}
      previousPacksLastKey={previousPacksLastKey}
    />
  );
};

export default RenderToRoot(CubePlaytestPageWrapper);
