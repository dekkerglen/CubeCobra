import React, { useEffect, useState } from 'react';

import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import EditVideo from 'components/content/EditVideo';
import Video from 'components/content/Video';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import VideoType from 'datatypes/Video';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface EditVideoPageProps {
  video: VideoType;
}

const EditVideoPage: React.FC<EditVideoPageProps> = ({ video }) => {
  const [tab, setTab] = useQueryParam('tab', '0');
  const [body, setBody] = useState(video.body);
  const [short, setShort] = useState(video.short);
  const [url, setUrl] = useState(video.url);
  const [title, setTitle] = useState(video.title);
  const [imageName, setImageName] = useState(video.imageName);
  const [imageArtist, setImageArtist] = useState(video.image?.artist);
  const [imageUri, setImageUri] = useState(video.image?.uri);
  const [imageDict, setImageDict] = useState<Record<string, { artist: string; uri: string }>>({});
  const [loading, setLoading] = useState(true);
  const saveFormRef = React.createRef<HTMLFormElement>();
  const submitFormRef = React.createRef<HTMLFormElement>();

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => {
        setLoading(false);
        setImageDict(json.dict);
      });
  }, []);

  useEffect(() => {
    if (imageDict && imageName) {
      const result = imageDict[imageName.toLowerCase()];
      if (result) {
        setImageArtist(result.artist);
        setImageUri(result.uri);
      }
    }
  }, [imageName, imageDict]);

  const hasChanges = video.body !== body || video.url !== url || video.title !== title || video.imageName !== imageName;

  return (
    <MainLayout>
      <Card className="my-2">
        <DynamicFlash />
        <CardBody>
          <Flexbox direction="row" justify="between">
            <Text semibold lg>
              Edit Video
            </Text>
            <Link href="/content/creators" className="float-end">
              Back to Dashboard
            </Link>
          </Flexbox>
          <Flexbox direction="row" className="gap-2">
            <CSRFForm
              method="POST"
              action="/content/editvideo"
              ref={saveFormRef}
              formData={{
                body: body || '',
                short: short || '',
                url,
                title: title || '',
                imagename: imageName || '',
                videoid: video.id,
              }}
            >
              <Button color="primary" block disabled={!hasChanges} onClick={() => saveFormRef.current?.submit()}>
                Save
              </Button>
            </CSRFForm>
            <CSRFForm
              method="POST"
              action="/content/submitvideo"
              ref={submitFormRef}
              formData={{
                body: body || '',
                short: short || '',
                url,
                title: title || '',
                imagename: imageName || '',
                videoid: video.id,
              }}
            >
              <Button color="primary" block disabled={!hasChanges} onClick={() => submitFormRef.current?.submit()}>
                Submit for Review
              </Button>
            </CSRFForm>
          </Flexbox>
        </CardBody>
        <TabbedView
          activeTab={parseInt(tab, 10)}
          tabs={[
            {
              label: 'Source',
              onClick: () => setTab('0'),
              content: (
                <EditVideo
                  video={video}
                  url={url}
                  setUrl={setUrl}
                  title={title || ''}
                  setTitle={setTitle}
                  short={short || ''}
                  setShort={setShort}
                  imageName={imageName || ''}
                  setImageName={setImageName}
                  imageUri={imageUri || ''}
                  imageArtist={imageArtist || ''}
                  loading={loading}
                  body={body || ''}
                  setBody={setBody}
                />
              ),
            },
            {
              label: 'Preview',
              onClick: () => setTab('1'),
              content: (
                <Video
                  video={{
                    ...video,
                    url,
                    title,
                    body,
                    short,
                    image: {
                      uri: imageUri || video.image?.uri || '',
                      artist: imageArtist || video.image?.artist || '',
                      imageName: imageName || video.imageName || '',
                      id: video.image?.id || '',
                    },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(EditVideoPage);
