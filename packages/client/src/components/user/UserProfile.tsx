import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Image from '@utils/datatypes/Image';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import MtgImage from 'components/MtgImage';
import TextEntry from 'components/TextEntry';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';

interface UserProfileProps {
  userEmail?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userEmail }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [markdown, setMarkdown] = useState(user?.about || '');
  const [username, setUsername] = useState(user?.username);
  const [email, setEmail] = useState(userEmail || user?.email);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [imageDict, setImageDict] = useState<Record<string, Image>>({});
  const [imagename, setImagename] = useState(user?.image?.imageName || '');
  const [image, setImage] = useState(
    user?.image || {
      artist: user?.image?.artist || '',
      uri: user?.image?.uri || '',
    },
  );

  useEffect(() => {
    const getData = async () => {
      const response = await csrfFetch('/cube/api/imagedict');
      const json = await response.json();
      setImageDict(json.dict);
    };
    getData();
  }, [csrfFetch]);

  const changeImage = useCallback(
    (img: string) => {
      setImagename(img);

      console.log(imageDict[img.toLowerCase()]);
      if (imageDict[img.toLowerCase()]) {
        setImage(imageDict[img.toLowerCase()]);
      }
    },
    [imageDict],
  );

  const formData = useMemo(
    () => ({
      username: username || '',
      email: email || '',
      image: imagename || '',
      body: markdown,
    }),
    [username, email, imagename, markdown],
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
            <AutocompleteInput
              treeUrl="/cube/api/fullnames"
              treePath="cardnames"
              type="text"
              name="remove"
              value={imagename}
              setValue={changeImage}
              onSubmit={(event) => event.preventDefault()}
              placeholder="Cardname for image"
              autoComplete="off"
            />
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
