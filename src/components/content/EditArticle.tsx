import ArticlePreview from 'components/content/ArticlePreview';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import ArticleType from 'datatypes/Article';
import { CONVERT_STATUS } from 'datatypes/Content';
import React from 'react';

interface EditArticleProps {
  article: ArticleType;
  title: string;
  setTitle: (title: string) => void;
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

const EditArticle: React.FC<EditArticleProps> = ({
  article,
  title,
  setTitle,
  short,
  setShort,
  imageName,
  setImageName,
  imageUri,
  imageArtist,
  body,
  setBody,
  loading,
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
            <ArticlePreview
              article={{
                ...article,
                title,
                short,
                imageName,
                image: {
                  uri: imageUri,
                  artist: imageArtist,
                  id: article.image?.id || '',
                  imageName: imageName,
                },
              }}
            />
          )}
        </Col>
        <Col xs={12} md={6} lg={8} xxl={9}>
          <Flexbox direction="col" gap="2" className="m-2">
            <Text semibold md>
              {`Status: ${CONVERT_STATUS[article.status]}`}
            </Text>
            <Input label="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextArea
              label="Short Description"
              maxLength={1000}
              value={short}
              onChange={(e) => setShort(e.target.value)}
            />
            <p>Plaintext only. This short description will be used for the article preview.</p>
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
        Write the article text here. Cube Cobra articles use a variation of markdown you can read about{' '}
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

export default EditArticle;
