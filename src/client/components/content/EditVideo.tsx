import AutocompleteInput from 'components/base/AutocompleteInput';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import { CONVERT_STATUS } from 'datatypes/Content';
import VideoType from 'datatypes/Video';
import React from 'react';
import VideoPreview from './VideoPreview';
import Link from 'components/base/Link';

interface EditVideoProps {
  video: VideoType;
  title: string;
  setTitle: (title: string) => void;
  url: string;
  setUrl: (url: string) => void;
  short: string;
  setShort: (short: string) => void;
  imageName: string;
  setImageName: (imageName: string) => void;
  imageUri: string;
  imageArtist: string;
  loading: boolean;
  body: string;
  setBody: (body: string) => void;
}

const EditVideo: React.FC<EditVideoProps> = ({
  video,
  title,
  setTitle,
  short,
  setShort,
  imageName,
  setImageName,
  imageUri,
  imageArtist,
  loading,
  url,
  setUrl,
  body,
  setBody,
}) => {
  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Row>
        <Col xs={12} md={6} lg={4} xxl={3}>
          {loading ? (
            <div className="centered w-full my-2">
              <Spinner lg />
            </div>
          ) : (
            <VideoPreview
              video={{
                ...video,
                url,
                title,
                short,
                imageName,
                image: {
                  uri: imageUri,
                  artist: imageArtist,
                  id: video.image?.id || '',
                  imageName: imageName,
                },
              }}
            />
          )}
        </Col>
        <Col xs={12} md={6} lg={8} xxl={9}>
          <Flexbox direction="col" gap="2" className="m-2">
            <Text semibold md>
              {`Status: ${CONVERT_STATUS[video.status]}`}
            </Text>
            <Input label="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input label="Video URL" maxLength={200} value={url} onChange={(e) => setUrl(e.target.value)} />
            <TextArea
              label="Short Description"
              maxLength={1000}
              value={short}
              onChange={(e) => setShort(e.target.value)}
            />
            <p>Plaintext only. This short description will be used for the video preview.</p>
            <Flexbox direction="row" gap="2" className="w-full" alignItems="center">
              <Text semibold md>
                Thumbnail:
              </Text>
              <AutocompleteInput
                treeUrl="/cube/api/fullnames"
                treePath="cardnames"
                type="text"
                className="me-2"
                name="remove"
                value={imageName}
                setValue={setImageName}
                onSubmit={(event) => event.preventDefault()}
                placeholder="Cardname for image"
                autoComplete="off"
                data-lpignore
              />
            </Flexbox>
          </Flexbox>
        </Col>
      </Row>
      <Text>
        Write any supplmental text here. Cube Cobra uses a variation of markdown you can read about{' '}
        <Link href="/markdown" target="_blank">
          here
        </Link>
        .
      </Text>
      <TextArea
        maxLength={1000000}
        className="w-full article-area"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
    </Flexbox>
  );
};

export default EditVideo;
