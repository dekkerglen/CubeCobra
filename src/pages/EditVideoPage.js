import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import VideoPropType from 'proptypes/VideoPropType';

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
import VideoPreview from 'components/VideoPreview';
import Tab from 'components/Tab';
import Video from 'components/Video';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import AutocompleteInput from 'components/AutocompleteInput';
import CSRFForm from 'components/CSRFForm';
import useQueryParam from 'hooks/useQueryParam';

const EditVideoPage = ({ user, loginCallback, video }) => {
  const [tab, setTab] = useQueryParam('tab', '0');
  const [body, setBody] = useState(video.body);
  const [short, setShort] = useState(video.short);
  const [url, setUrl] = useState(video.url);
  const [title, setTitle] = useState(video.title);
  const [imageName, setImageName] = useState(video.imagename);
  const [imageArtist, setImageArtist] = useState(video.artist);
  const [imageUri, setImageUri] = useState(video.image);
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

  const hasChanges = video.body !== body || video.url !== url || video.title !== title || video.imagename !== imageName;

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Card>
        <CardBody>
          <Row>
            <Col xs="12" sm="6">
              <h4>Edit Video</h4>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/creators" className="float-right">
                Back to Dashboard
              </a>
            </Col>
          </Row>
          <Row>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/editvideo" autoComplete="off">
                <Input type="hidden" name="videoid" value={video._id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="image" value={imageUri} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="artist" value={imageArtist} />
                <Input type="hidden" name="body" value={body} />
                <Input type="hidden" name="url" value={url} />
                <Button type="submit" color="success" block disabled={!hasChanges}>
                  Save
                </Button>
              </CSRFForm>
            </Col>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/submitvideo" autoComplete="off">
                <Input type="hidden" name="videoid" value={video._id} />
                <Input type="hidden" name="title" value={title} />
                <Input type="hidden" name="short" value={short} />
                <Input type="hidden" name="image" value={imageUri} />
                <Input type="hidden" name="imagename" value={imageName} />
                <Input type="hidden" name="artist" value={imageArtist} />
                <Input type="hidden" name="body" value={body} />
                <Input type="hidden" name="url" value={url} />
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
                    <Input disabled value={video.status} />
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
                    <Label>Video URL:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxLength="1000" value={url} onChange={(event) => setUrl(event.target.value)} />
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
                    <p>Plaintext only. This short description will be used for the video preview.</p>
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
                Write any supplmental text here. Cube Cobra videos use a variation of markdown you can read about{' '}
                <a href="/markdown" target="_blank">
                  here
                </a>
                .
              </p>
              <Input
                type="textarea"
                maxLength="1000000"
                className="w-100 video-area"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </CardBody>
          </TabPane>
          <TabPane tabId="1">
            <CardBody>
              <Row className="px-3">
                <Col xs="12" sm="6" md="4" className="mb-3">
                  <VideoPreview
                    video={{
                      username: user.username,
                      title,
                      body,
                      short,
                      artist: imageArtist,
                      imagename: imageName,
                      image: imageUri,
                      date: video.date,
                    }}
                  />
                </Col>
                <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
                  <VideoPreview
                    video={{
                      username: user.username,
                      title,
                      body,
                      short,
                      artist: imageArtist,
                      imagename: imageName,
                      image: imageUri,
                      date: video.date,
                    }}
                  />
                </Col>
              </Row>
            </CardBody>
            <Video
              video={{
                username: user.username,
                title,
                body,
                short,
                artist: imageArtist,
                imagename: imageName,
                image: imageUri,
                date: video.date,
                url,
              }}
            />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

EditVideoPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  video: VideoPropType.isRequired,
};

EditVideoPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(EditVideoPage);
