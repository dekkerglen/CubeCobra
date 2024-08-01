import React, { useContext,useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Col,
  FormGroup,
  Input,
  Label,
  Nav,
  Row,
  Spinner,
  TabContent,
  TabPane,
} from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';

import Article from 'components/Article';
import ArticlePreview from 'components/ArticlePreview';
import AutocompleteInput from 'components/AutocompleteInput';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import Tab from 'components/Tab';
import UserContext from 'contexts/UserContext';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CONVERT_STATUS = {
  p: 'Published',
  r: 'In Review',
  d: 'Draft',
};

const EditArticlePage = ({ loginCallback, article }) => {
  const user = useContext(UserContext);

  const [tab, setTab] = useQueryParam('tab', '0');
  const [body, setBody] = useState(article.body);
  const [title, setTitle] = useState(article.title);
  const [short, setShort] = useState(article.short || '');
  const [imageName, setImageName] = useState(article.imageName);
  const [imageArtist, setImageArtist] = useState(article.image.artist);
  const [imageUri, setImageUri] = useState(article.image);
  const [imageDict, setImageDict] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => {
        setLoading(false);
        setImageDict(json.dict);
      });
  }, []);

  useEffect(() => {
    if (imageDict) {
      const result = imageDict[imageName.toLowerCase()];
      if (result) {
        setImageArtist(result.artist);
        setImageUri(result.uri);
      }
    }
  }, [imageName, imageDict]);

  const hasChanges =
    article.body !== body || article.title !== title || article.imageName !== imageName || article.short !== short;

  return (
    <MainLayout loginCallback={loginCallback}>
      <Card>
        <CardBody>
          <Row>
            <Col xs="12" sm="6">
              <h4>Edit Article</h4>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/creators" className="float-end">
                Back to Dashboard
              </a>
            </Col>
          </Row>
          <Row>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/editarticle" autoComplete="off">
                <Input type="hidden" name="articleid" value={article.id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="body" value={body} />
                <Button type="submit" color="accent" block disabled={!hasChanges}>
                  Save
                </Button>
              </CSRFForm>
            </Col>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/submitarticle" autoComplete="off">
                <Input type="hidden" name="articleid" value={article.id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="body" value={body} />
                <Button type="submit" outline color="accent" block>
                  Submit for Review
                </Button>
              </CSRFForm>
            </Col>
          </Row>
        </CardBody>
        <Nav className="mt-2" tabs justified>
          <Tab tab={tab} setTab={setTab} index="0">
            Source
          </Tab>
          <Tab tab={tab} setTab={setTab} index="1">
            Preview
          </Tab>
        </Nav>
        <DynamicFlash />
        <TabContent activeTab={tab}>
          <TabPane tabId="0">
            <CardBody>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Status:</Label>
                  </Col>
                  <Col sm="10">
                    <Input disabled value={CONVERT_STATUS[article.status]} />
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Title:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxLength="1000" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Short Description:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxLength="1000" value={short} onChange={(event) => setShort(event.target.value)} />
                    <p>Plaintext only. This short description will be used for the article preview.</p>
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Thumbnail:</Label>
                  </Col>
                  <Col sm="5">
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
                  </Col>
                  <Col sm="5">
                    <Card>
                      {loading ? (
                        <div className="centered py-3">
                          <Spinner className="position-absolute" />
                        </div>
                      ) : (
                        <div className="position-relative">
                          <img width="100%" src={imageUri} alt={imageName} />
                          <em className="cube-preview-artist">Art by {imageArtist}</em>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </FormGroup>
              <p>
                Write the article text here. Cube Cobra articles use a variation of markdown you can read about{' '}
                <a href="/markdown" target="_blank">
                  here
                </a>
                .
              </p>
              <Input
                type="textarea"
                maxLength="1000000"
                className="w-100 article-area"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </CardBody>
          </TabPane>
          <TabPane tabId="1">
            <CardBody>
              <h5>Article Previews</h5>
              <Row>
                <Col xs="12" sm="6" md="4" className="mb-3">
                  <ArticlePreview
                    article={{
                      id: article.id,
                      username: user.username,
                      title,
                      body,
                      short,
                      imageName,
                      image: {
                        uri: imageUri,
                        artist: imageArtist,
                      },
                      date: article.date,
                    }}
                  />
                </Col>
                <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
                  <ArticlePreview
                    article={{
                      id: article.id,
                      username: user.username,
                      title,
                      body,
                      short,
                      imageName,
                      image: {
                        uri: imageUri,
                        artist: imageArtist,
                      },
                      date: article.date,
                    }}
                  />
                </Col>
              </Row>
            </CardBody>
            <Article
              article={{
                id: article.id,
                username: user.username,
                title,
                body,
                short,
                imageName,
                image: imageUri,
                date: article.date,
              }}
            />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

EditArticlePage.propTypes = {
  loginCallback: PropTypes.string,
  article: ContentPropType.isRequired,
};

EditArticlePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(EditArticlePage);
