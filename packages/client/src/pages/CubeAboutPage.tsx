import React, { useContext } from 'react';

import PostType from '@utils/datatypes/BlogPost';
import Cube, { CubeCards } from '@utils/datatypes/Cube';

import BlogView from 'components/about/BlogView';
import ChangelogView from 'components/about/ChangelogView';
import PrimerView from 'components/about/PrimerView';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import AboutNavbar from 'components/cube/AboutNavbar';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import AboutViewContext, { AboutViewContextProvider } from 'contexts/AboutViewContext';
import CubeContext from 'contexts/CubeContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeAboutPageProps {
  cube: Cube;
  cards: CubeCards;
  posts?: PostType[];
  postsLastKey: any;
  changes?: Record<string, any>[];
  changesLastKey?: string;
  followed: boolean;
  followersCount: number;
  priceOwned: number | null;
  pricePurchase: number | null;
}

const CubeAboutPageContent: React.FC<CubeAboutPageProps> = ({
  cube,
  cards,
  posts,
  postsLastKey,
  changes,
  changesLastKey,
}) => {
  const aboutViewContext = useContext(AboutViewContext);
  const view = aboutViewContext?.view || 'primer';

  let content;
  switch (view) {
    case 'blog':
      content = <BlogView cubeId={cube.id} posts={posts} lastKey={postsLastKey} />;
      break;
    case 'changelog':
      content = <ChangelogView changes={changes} lastKey={changesLastKey} />;
      break;
    case 'primer':
    default:
      content = <PrimerView description={cube.description} tags={cube.tags} />;
      break;
  }

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cards={cards} cube={cube} activeLink={view}>
        <CubeAboutPageBody content={content} />
      </CubeLayout>
    </MainLayout>
  );
};

const CubeAboutPageBody: React.FC<{ content: React.ReactNode }> = ({ content }) => {
  const { cardsLoading } = useContext(CubeContext);
  return (
    <Flexbox direction="col" gap="2" className="my-2">
      <DynamicFlash />
      <AboutNavbar />
      {cardsLoading && (
        <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="py-2">
          <Spinner sm />
        </Flexbox>
      )}
      {content}
    </Flexbox>
  );
};

const CubeAboutPage: React.FC<CubeAboutPageProps> = (props) => {
  return (
    <AboutViewContextProvider>
      <CubeAboutPageContent {...props} />
    </AboutViewContextProvider>
  );
};

export default RenderToRoot(CubeAboutPage);
