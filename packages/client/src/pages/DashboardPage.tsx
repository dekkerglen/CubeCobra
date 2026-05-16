import React, { useContext, useState } from 'react';

import { cdnUrl } from '@utils/cdnUrl';
import Cube from '@utils/datatypes/Cube';
import { P1P1Pack } from '@utils/datatypes/P1P1Pack';
import classNames from 'classnames';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import CubesCard from 'components/cube/CubesCard';
import DynamicFlash from 'components/DynamicFlash';
import Feed from 'components/Feed';
import DailyP1P1Card from 'components/p1p1/DailyP1P1Card';
import withQuickCreateCube from 'components/QuickCreateCubeButton';
import RenderToRoot from 'components/RenderToRoot';
import SideBanner from 'components/SideBanner';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

type SearchTab = 'cubes' | 'cards' | 'packages';

const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'cubes', label: 'Cubes' },
  { id: 'cards', label: 'Cards' },
  { id: 'packages', label: 'Packages' },
];

const buildSearchUrl = (tab: SearchTab, query: string): string => {
  const encoded = encodeURIComponent(query);
  switch (tab) {
    case 'cubes':
      return `/search?q=${encoded}`;
    case 'cards':
      return `/tool/searchcards?f=${encoded}`;
    case 'packages':
      return `/packages?q=${encoded}`;
  }
};

type ChipSuggestion = { label: string; href: string };

const SUGGESTIONS: Partial<Record<SearchTab, ChipSuggestion[]>> = {
  cubes: [
    { label: 'Vintage', href: '/search?q=category%3A%22Vintage%22' },
    { label: '100 Ornithopters', href: '/search?q=100%20Ornithopters' },
    { label: 'card:"Life from the Loam"', href: '/search?q=card%3A"Life%20from%20the%20loam"' },
  ],
  cards: [
    { label: 'Black Lotus', href: '/tool/searchcards?f=black+lotus&p=0&s=Elo&d=descending&di=names&v=cards' },
    { label: 'type:snake', href: '/tool/searchcards?f=type%3Asnake&p=0&s=Elo&d=descending&di=names&v=cards' },
  ],
  packages: [
    { label: 'Shocklands', href: '/packages?q=Shocklands' },
    { label: 'card:"Arid Mesa"', href: '/packages?q=card:"Arid%20Mesa"' },
  ],
};

const DashboardSearchBar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SearchTab>('cubes');
  const [query, setQuery] = useState('');

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    window.location.href = buildSearchUrl(activeTab, trimmed);
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center">
      <div className="flex flex-wrap justify-center items-center gap-2">
        <span className="text-button-text font-semibold">Search:</span>
        {SEARCH_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={classNames(
              'px-4 py-1 rounded-full text-sm font-semibold border focus:outline-none transition-colors',
              activeTab === tab.id
                ? 'bg-button-text text-bg-secondary border-button-text hover:bg-button-text/90'
                : 'bg-transparent text-button-text border-button-text hover:bg-button-text/15',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4 w-full max-w-md">
        <Input
          name="q"
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onEnter={submit}
          className="!bg-white !text-gray-800 !placeholder-gray-500 !border-gray-300"
        />
      </div>
      <div className="mt-4 h-8 flex flex-wrap justify-center items-center gap-2">
        {SUGGESTIONS[activeTab] && (
          <>
            <span className="text-sm text-button-text/80">Try:</span>
            {SUGGESTIONS[activeTab]!.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-bg-secondary/40 text-button-text border border-button-text/40 transition-colors hover:bg-button-text/20 hover:border-button-text"
              >
                {s.label}
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

interface DashboardPageProps {
  featured?: Cube[];
  collaboratingCubes?: Cube[];
  cubes?: Cube[];
  dailyP1P1?: {
    pack: P1P1Pack;
    cube: Cube;
    date?: number;
  };
}

const CreateCubeModalButton = withQuickCreateCube(Button);

const DashboardPage: React.FC<DashboardPageProps> = ({
  featured = [],
  collaboratingCubes = [],
  cubes = [],
  dailyP1P1,
}) => {
  const user = useContext(UserContext);
  const showDailyP1P1 = !user?.hideFeatured && !!dailyP1P1;
  const featuredPair = featured.slice(0, 2);

  const yourCubesSection = (
    <div>
      <Flexbox direction="row" justify="between" className="px-2 mb-1">
        <Text semibold lg className="!text-button-text">
          Your Cubes
        </Text>
        {cubes.length > 2 && <Link href={`/user/view/${user?.id}`}>View All</Link>}
      </Flexbox>
      {cubes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {cubes.slice(0, 12).map((cube) => (
            <CubePreview key={cube.id} cube={cube} />
          ))}
        </div>
      ) : (
        <div className="p-4">
          <Flexbox direction="col" gap="2" alignItems="start">
            <span>You don't have any cubes.</span>
            <CreateCubeModalButton color="primary">Add a new cube?</CreateCubeModalButton>
          </Flexbox>
        </div>
      )}
    </div>
  );

  const featuredAndP1P1Section = (
    <Flexbox direction="col" gap="4">
      {featuredPair.length > 0 && (
        <div>
          <Flexbox direction="row" justify="between" className="px-2 mb-1">
            <Text semibold lg className="!text-button-text">
              Featured Cubes
            </Text>
            <Link href="/queue">View All</Link>
          </Flexbox>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {featuredPair.map((cube) => (
              <CubePreview key={cube.id} cube={cube} />
            ))}
          </div>
        </div>
      )}
      {showDailyP1P1 && <DailyP1P1Card pack={dailyP1P1!.pack} cube={dailyP1P1!.cube} date={dailyP1P1!.date} />}
    </Flexbox>
  );

  return (
    <MainLayout useContainer={false} transparentNav>
      <div className="relative min-h-screen">
        {/* Image backdrop: screen-height, matching landing / search / resources.
            Content flows in normal page flow on top and continues past the bottom of this. */}
        <div className="absolute inset-x-0 top-0 h-screen overflow-hidden bg-bg-secondary pointer-events-none z-0">
          <img
            src={cdnUrl('/content/cobracube.webp')}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-top select-none"
          />
          <div className="absolute inset-0 bg-bg-secondary/80" />
          <div className="absolute inset-x-0 bottom-0 h-[25vh] bg-gradient-to-b from-transparent to-bg pointer-events-none" />
        </div>

        <a
          href="https://bsky.app/profile/firosart.bsky.social"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-20 right-3 text-xs text-button-text/70 hover:text-button-text underline-offset-2 hover:underline z-[15]"
        >
          Art by Santiago Rosas
        </a>

        <div className="relative z-10">
          {/* Search hero — fixed to 50% of viewport height, content centered */}
          <div className="h-[50vh] flex items-center justify-center px-4 pt-16">
            <DashboardSearchBar />
          </div>

          <Container xxl className="pb-6">
            <Flexbox direction="row" gap="4">
              <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
                <SideBanner placementId="left-rail" />
              </ResponsiveDiv>
              <div className="flex-grow px-2 max-w-full min-w-0">
                <Banner />
                <DynamicFlash />

                {/* MOBILE LAYOUT (< 768px) — Your Cubes first so they're reachable without scrolling */}
                <div className="md:hidden">
                  <Flexbox direction="col" gap="4" className="my-2">
                    {yourCubesSection}
                    {collaboratingCubes.length > 0 && (
                      <CubesCard title="Collaborating On" cubes={collaboratingCubes} lean />
                    )}
                    {featuredAndP1P1Section}
                  </Flexbox>
                </div>

                {/* DESKTOP LAYOUT (≥ 768px) */}
                <div className="hidden md:block">
                  <Row className="my-2">
                    <Col xs={12} md={6}>
                      <Flexbox direction="col" gap="2">
                        {yourCubesSection}
                        {collaboratingCubes.length > 0 && (
                          <CubesCard title="Collaborating On" cubes={collaboratingCubes} lean />
                        )}
                      </Flexbox>
                    </Col>
                    <Col xs={12} md={6}>
                      {featuredAndP1P1Section}
                    </Col>
                  </Row>
                </div>

                <Container lg className="mt-6">
                  <Feed />
                </Container>
              </div>
              <ResponsiveDiv lg className="pr-2 py-2 min-w-fit">
                <SideBanner placementId="right-rail" />
              </ResponsiveDiv>
            </Flexbox>
          </Container>
        </div>
      </div>
    </MainLayout>
  );
};

export default RenderToRoot(DashboardPage);
