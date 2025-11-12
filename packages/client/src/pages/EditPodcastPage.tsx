import React, { useState } from 'react';

import PodcastType from '@utils/datatypes/Podcast';

import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import EditPodcast from 'components/content/EditPodcast';
import Podcast from 'components/content/Podcast';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface EditPodcastPageProps {
  podcast: PodcastType;
}

const EditPodcastPage: React.FC<EditPodcastPageProps> = ({ podcast }) => {
  const [tab, setTab] = useQueryParam('tab', '0');
  const [rss, setRss] = useState(podcast.url);
  const saveFormRef = React.createRef<HTMLFormElement>();
  const submitFormRef = React.createRef<HTMLFormElement>();

  const hasChanges = podcast.url !== rss;

  return (
    <MainLayout>
      <Card className="my-2">
        <CardBody>
          <Flexbox direction="row" justify="between">
            <Text semibold lg>
              Edit Podcast
            </Text>
            <Link href="/content/creators" className="float-end">
              Back to Dashboard
            </Link>
          </Flexbox>
          <Flexbox direction="row" className="gap-2">
            <CSRFForm
              method="POST"
              action="/content/editpodcast"
              ref={saveFormRef}
              formData={{ rss, podcastid: podcast.id }}
            >
              <Button color="primary" block disabled={!hasChanges} onClick={() => saveFormRef.current?.submit()}>
                Save
              </Button>
            </CSRFForm>
            <CSRFForm
              method="POST"
              action="/content/submitpodcast"
              ref={submitFormRef}
              formData={{ rss, podcastid: podcast.id }}
            >
              <Button color="primary" block disabled={!hasChanges} onClick={() => submitFormRef.current?.submit()}>
                Submit for Review
              </Button>
            </CSRFForm>
          </Flexbox>
        </CardBody>
        <DynamicFlash />
        <TabbedView
          activeTab={parseInt(tab, 10)}
          tabs={[
            {
              label: 'Source',
              onClick: () => setTab('0'),
              content: <EditPodcast podcast={podcast} url={rss} setUrl={setRss} />,
            },
            {
              label: 'Preview',
              onClick: () => setTab('1'),
              content: <Podcast podcast={podcast} episodes={[]} />,
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(EditPodcastPage);
