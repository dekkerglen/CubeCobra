import React, { useCallback, useState } from 'react';

import { CubeChangeLog } from '@utils/datatypes/ChangeLog';
import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { formatDateTime } from 'utils/Date';

interface CubeChangelogPageProps {
  cube: Cube;
  changelog: CubeChangeLog;
}

const CubeChangelogPage: React.FC<CubeChangelogPageProps> = ({ cube, changelog }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      window.location.href = `/cube/changelog/${cube.id}/${changelog.id}/download`;
    } finally {
      // Give the browser a moment to start the download before clearing state
      setTimeout(() => setDownloading(false), 3000);
    }
  }, [cube.id, changelog.id]);

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
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
                <Text lg semibold>
                  Changes &mdash; {formatDateTime(new Date(changelog.date))}
                </Text>
              </CardHeader>
              <CardBody>
                <Flexbox direction="row" gap="2" className="mb-4" alignItems="center" wrap="wrap">
                  <Button color="accent" outline type="link" href={`/cube/changelog/${cube.id}/${changelog.id}/list`}>
                    View Point in Time Cube List
                  </Button>
                  <Button color="primary" outline type="button" onClick={handleDownload} disabled={downloading}>
                    {downloading ? 'Downloading...' : 'Download Point in Time Cube'}
                  </Button>
                  <Button color="secondary" outline type="link" href={`/cube/changelog/${cube.id}/${changelog.id}/compare`}>
                    Compare Point in Time Cube with Present
                  </Button>
                </Flexbox>
                <BlogPostChangelog changelog={changelog.changelog} />
              </CardBody>
            </Card>
          </Flexbox>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeChangelogPage);
