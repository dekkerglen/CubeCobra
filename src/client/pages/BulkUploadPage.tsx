import React, { useCallback, useContext, useRef, useState } from 'react';

import AutocompleteInput from 'components/base/AutocompleteInput';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Changelist from 'components/Changelist';
import DynamicFlash from 'components/DynamicFlash';
import { getCard } from 'components/EditCollapse';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import CardType from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import useLocalStorage from 'hooks/useLocalStorage';
import useMount from 'hooks/UseMount';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const DEFAULT_BLOG_TITLE = 'Cube Updated - Automatic Post';

interface BulkUploadPageRawProps {
  missing: string[];
  added: string[];
}

const BulkUploadPageRaw: React.FC<BulkUploadPageRawProps> = ({ missing, added }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [addValue, setAddValue] = useState('');

  const { alerts, setAlerts, cube, loading, addCard, bulkAddCard, commitChanges } = useContext(CubeContext);

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, DEFAULT_BLOG_TITLE);
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, '');

  const addInput = useRef<HTMLInputElement>(null);

  useMount(() => {
    bulkAddCard(
      added.map((cardid) => ({
        cardID: cardid,
        addedTmsp: new Date().valueOf().toString(),
        status: cube.defaultStatus,
      })),
      'mainboard',
    );
  });

  const submit = useCallback(async () => {
    await commitChanges(postTitle, postContent);
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');

    // go to cube page
    window.location.href = `/cube/list/${cube.id}`;
  }, [commitChanges, cube.id, postContent, postTitle, setPostContent, setPostTitle]);

  const handleAdd = useCallback(
    async (match: any) => {
      try {
        const card = await getCard(csrfFetch, cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard(
          { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
          'mainboard',
        );
        setAddValue('');

        addInput.current?.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [csrfFetch, cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard],
  );

  return (
    <Card className="mt-3">
      <CardHeader>
        <Text semibold lg>
          Confirm Upload
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="1">
          <Text>
            There were a few problems with your bulk upload. Below is a list of unrecognized cards, please go through
            and manually add them. No changes have been saved.
          </Text>
          <Row>
            <Col xs={6}>
              <Card>
                <CardBody>
                  <Flexbox direction="col" gap="1">
                    {missing.map((card, index) => (
                      <Text key={index}>{card}</Text>
                    ))}
                  </Flexbox>
                </CardBody>
              </Card>
            </Col>
            <Col xs={6}>
              <Flexbox direction="col" gap="1">
                <Row>
                  <Col xs={8}>
                    <AutocompleteInput
                      treeUrl="/cube/api/cardnames"
                      treePath="cardnames"
                      type="text"
                      innerRef={addInput}
                      value={addValue}
                      setValue={setAddValue}
                      placeholder="Card to Add"
                      defaultPrinting={cube.defaultPrinting}
                    />
                  </Col>
                  <Col xs={4}>
                    <LoadingButton
                      block
                      color="accent"
                      disabled={addValue.length === 0}
                      loading={loading}
                      onClick={async () => await handleAdd(addValue)}
                    >
                      Add
                    </LoadingButton>
                  </Col>
                </Row>
                {alerts.map(({ color, message }, index) => (
                  <Text key={index} className={`alert alert-${color} mt-2`}>
                    {message}
                  </Text>
                ))}
                <Changelist />
                <LoadingButton loading={loading} color="primary" className="mt-3" block onClick={submit}>
                  Save Changes
                </LoadingButton>
              </Flexbox>
            </Col>
          </Row>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

interface BulkUploadPageProps {
  cube: Cube;
  cards: {
    mainboard: CardType[];
    maybeboard: CardType[];
  };
  added: string[];
  loginCallback?: string;
  blogpost: {
    title: string;
    html: string;
  };
  missing: string[];
}

const BulkUploadPage: React.FC<BulkUploadPageProps> = ({ cube, cards, added, loginCallback, missing }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <CubeLayout cube={cube} cards={cards} activeLink="list" useChangedCards>
      <BulkUploadPageRaw added={added} missing={missing} />
    </CubeLayout>
  </MainLayout>
);

export default RenderToRoot(BulkUploadPage);
