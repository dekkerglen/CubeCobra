import React, { useCallback, useContext, useMemo, useState } from 'react';

import { hostedImageToImageData } from '@utils/hostedImagesUtil';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardHeader } from 'components/base/Card';
import Collapse from 'components/base/Collapse';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import ImageUploadWidget from 'components/ImageUploadWidget';
import MtgImage from 'components/MtgImage';
import TextEntry from 'components/TextEntry';
import UserContext from 'contexts/UserContext';
import useCanUploadImages from 'hooks/useCanUploadImages';
import { cardNameMatches, fetchCardImage } from 'utils/cardAutocomplete';

interface UserProfileProps {
  userEmail?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userEmail }) => {
  const user = useContext(UserContext);
  const canUploadImages = useCanUploadImages();
  const [markdown, setMarkdown] = useState(user?.about || '');
  const [username, setUsername] = useState(user?.username);
  const [email, setEmail] = useState(userEmail || user?.email);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [imagename, setImagename] = useState(user?.image?.imageName || '');
  const [image, setImage] = useState(
    user?.image || {
      artist: user?.image?.artist || '',
      uri: user?.image?.uri || '',
    },
  );
  // Custom uploaded avatar (Lotus Cobra perk). Empty string means "use card art".
  const [profileHostedImageId, setProfileHostedImageId] = useState(user?.profileHostedImageId || '');
  const [uploadOpen, setUploadOpen] = useState(false);

  const changeImage = useCallback((img: string) => {
    setImagename(img);
    setProfileHostedImageId('');
    fetchCardImage(img).then((resolved) => {
      if (resolved) {
        setImage(resolved);
      }
    });
  }, []);

  const formData = useMemo(
    () => ({
      username: username || '',
      email: email || '',
      image: imagename || '',
      profileHostedImageId,
      body: markdown,
    }),
    [username, email, imagename, profileHostedImageId, markdown],
  );

  return (
    <CSRFForm method="POST" action="/user/updateuserinfo" ref={formRef} formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input label="Username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Text semibold>Profile Pic</Text>
        <Row>
          <Col xs={6}>
            <Card>
              <CardHeader>
                <Text semibold lg>
                  Preview
                </Text>
              </CardHeader>
              <MtgImage image={image} showArtist />
            </Card>
          </Col>
          <Col xs={6}>
            <Flexbox direction="col" gap="2">
              <AutocompleteInput
                getMatches={cardNameMatches(true)}
                type="text"
                name="remove"
                value={imagename}
                setValue={changeImage}
                onSubmit={(event) => event.preventDefault()}
                placeholder="Cardname for image"
                autoComplete="off"
              />
              {canUploadImages && (
                <>
                  <Button color="secondary" onClick={() => setUploadOpen((o) => !o)}>
                    {uploadOpen ? 'Cancel Upload' : 'Upload Custom Image'}
                  </Button>
                  <Collapse isOpen={uploadOpen}>
                    <ImageUploadWidget
                      usage="profile"
                      label="Choose Image"
                      onUploaded={(uploaded) => {
                        setProfileHostedImageId(uploaded.id);
                        setImage(hostedImageToImageData(uploaded.url, uploaded.id));
                        setUploadOpen(false);
                      }}
                    />
                  </Collapse>
                  {profileHostedImageId && (
                    <Button
                      color="danger"
                      outline
                      onClick={() => {
                        setProfileHostedImageId('');
                        if (imagename) {
                          changeImage(imagename);
                        }
                      }}
                    >
                      Remove Custom Image
                    </Button>
                  )}
                </>
              )}
            </Flexbox>
          </Col>
        </Row>
        <Text semibold>About</Text>
        <TextEntry maxLength={2500} setValue={setMarkdown} name="body" value={markdown} />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Update
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserProfile;
