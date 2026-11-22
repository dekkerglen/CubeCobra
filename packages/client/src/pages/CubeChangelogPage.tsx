import React from 'react';

import { CubeChangeLog } from '@utils/datatypes/ChangeLog';
import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import ChangelogCardView from 'components/blog/ChangelogCardView';
import ChangelogViewControls from 'components/blog/ChangelogViewControls';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import useCardsPerRow from 'hooks/useCardsPerRow';
import useChangelogView from 'hooks/useChangelogView';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { formatDateTime } from 'utils/Date';

interface CubeChangelogPageProps {
  cube: Cube;
  changelog: CubeChangeLog;
}

const CubeChangelogPage: React.FC<CubeChangelogPageProps> = ({ cube, changelog }) => {
  const [view, setView] = useChangelogView();
  const [cardsPerRow, setCardsPerRow] = useCardsPerRow();

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="changelog">
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
          <Flexbox direction="row" alignItems="center" gap="2">
            <Link href={`/cube/about/${cube.id}?view=changelog`}>
              <Text sm>&larr; Back to changelog</Text>
            </Link>
          </Flexbox>
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
                <Text lg semibold>
                  Changes &mdash; {formatDateTime(new Date(changelog.date))}
                </Text>
                <Flexbox direction="row" gap="2" wrap="wrap">
                  <ChangelogViewControls
                    view={view}
                    setView={setView}
                    cardsPerRow={cardsPerRow}
                    setCardsPerRow={setCardsPerRow}
                  />
                  <Button color="accent" type="link" href={`/cube/changelog/${cube.id}/${changelog.id}/list`}>
                    View List
                  </Button>
                  <Button color="secondary" type="link" href={`/cube/changelog/${cube.id}/${changelog.id}/compare`}>
                    Compare with Present
                  </Button>
                </Flexbox>
              </Flexbox>
            </CardHeader>
            <CardBody>
              {view === 'cards' ? (
                <ChangelogCardView changelog={changelog.changelog} cardsPerRow={cardsPerRow} />
              ) : (
                <BlogPostChangelog changelog={changelog.changelog} />
              )}
            </CardBody>
          </Card>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeChangelogPage);
