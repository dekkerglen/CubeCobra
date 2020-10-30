import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ArticlePropType from 'proptypes/ArticlePropType';
import UserPropType from 'proptypes/UserPropType';

import {
  Spinner,
  Nav,
  CardBody,
  Card,
  TabContent,
  TabPane,
  Input,
  FormGroup,
  Row,
  Col,
  Label,
  Button,
} from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import ArticlePreview from 'components/ArticlePreview';
import Tab from 'components/Tab';
import Article from 'components/Article';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import AutocompleteInput from 'components/AutocompleteInput';
import CSRFForm from 'components/CSRFForm';

const EditArticlePage = ({ user, loginCallback, article }) => {
  const [tab, setTab] = useState('0');
  const [body, setBody] = useState(article.body);
  const [title, setTitle] = useState(article.title);
  const [short, setShort] = useState(article.short || '');
  const [imageName, setImageName] = useState(article.imagename);
  const [imageArtist, setImageArtist] = useState(article.artist);
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
    article.body !== body || article.title !== title || article.imagename !== imageName || article.short !== short;

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Card>
        <CardBody>
          <Row>
            <Col xs="12" sm="6">
              <h4>Edit Article</h4>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/creators" className="float-right">
                Back to Dashboard
              </a>
            </Col>
          </Row>
          <Row>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/editarticle" autoComplete="off">
                <Input type="hidden" name="articleid" value={article._id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="image" value={imageUri} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="artist" value={imageArtist} />
                <Input type="hidden" name="body" value={body} />
                <Button type="submit" color="success" block disabled={!hasChanges}>
                  Save
                </Button>
              </CSRFForm>
            </Col>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/submitarticle" autoComplete="off">
                <Input type="hidden" name="articleid" value={article._id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="image" value={imageUri} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="artist" value={imageArtist} />
                <Input type="hidden" name="body" value={body} />
                <Button type="submit" outline color="success" block>
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
                    <Input disabled value={article.status} />
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Title:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxlength="1000" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>Short Description:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxlength="1000" value={short} onChange={(event) => setShort(event.target.value)} />
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
                      className="mr-2"
                      name="remove"
                      value={imageName}
                      onChange={(event) => setImageName(event.target.value)}
                      onSubmit={(event) => event.preventDefault()}
                      placeholder="Cardname for Image"
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
                      username: user.username,
                      title,
                      body,
                      short,
                      artist: imageArtist,
                      imagename: imageName,
                      image: imageUri,
                      date: article.date,
                    }}
                  />
                </Col>
                <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
                  <ArticlePreview
                    article={{
                      username: user.username,
                      title,
                      body,
                      short,
                      artist: imageArtist,
                      imagename: imageName,
                      image: imageUri,
                      date: article.date,
                    }}
                  />
                </Col>
              </Row>
            </CardBody>
            <Article
              article={{
                username: user.username,
                title,
                body,
                artist: imageArtist,
                imagename: imageName,
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
  user: UserPropType,
  loginCallback: PropTypes.string,
  article: ArticlePropType.isRequired,
};

EditArticlePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(EditArticlePage);
