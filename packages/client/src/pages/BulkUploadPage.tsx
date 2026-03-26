import React, { useCallback, useContext, useRef, useState } from 'react';

import CardType, { Changes } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Changelist from 'components/Changelist';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import ChangesContext from 'contexts/ChangesContext';
import CubeContext from 'contexts/CubeContext';
import useLocalStorage from 'hooks/useLocalStorage';
import useMount from 'hooks/UseMount';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { getCard } from 'utils/cards/getCard';

const DEFAULT_BLOG_TITLE = 'Cube Updated - Automatic Post';

interface BulkUploadPageRawProps {
  missing: string[];
  added: string[];
  addedByBoard: Record<string, any[]>;
  changelog?: Changes;
}

const BulkUploadPageRaw: React.FC<BulkUploadPageRawProps> = ({ missing, added, addedByBoard, changelog }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [addValue, setAddValue] = useState('');

  const { alerts, setAlerts, cube, loading, addCard, commitChanges, clearChanges } = useContext(CubeContext);
  const { changes, setChanges } = useContext(ChangesContext);

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, DEFAULT_BLOG_TITLE);
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, '');

  const addInput = useRef<HTMLInputElement>(null);

  useMount(() => {
    if (changelog && Object.keys(changelog).length > 0) {
      // Replace flow: server already computed the full changelog (adds + removes per board)
      // Set it directly into ChangesContext
      setChanges(changelog);
    } else if (Object.keys(addedByBoard).length > 0) {
      // Add flow: build a single changes object with all boards at once
      const newChanges: Changes = { ...changes };
      for (const [boardName, cardEntries] of Object.entries(addedByBoard)) {
        const existingAdds = (newChanges[boardName] as any)?.adds || [];
        newChanges[boardName] = {
          adds: [
            ...existingAdds,
            ...cardEntries.map((entry) => {
              // entry may be a string (cardID from TXT upload) or an object (full card from CSV upload)
              if (typeof entry === 'string') {
                return {
                  cardID: entry,
                  addedTmsp: new Date().valueOf().toString(),
                  status: cube.defaultStatus,
                };
              }
              // CSV path: spread full card data to preserve tags, notes, finish, etc.
              return {
                ...entry,
                addedTmsp: entry.addedTmsp || new Date().valueOf().toString(),
                status: entry.status || cube.defaultStatus,
              };
            }),
          ],
          removes: (newChanges[boardName] as any)?.removes || [],
          swaps: (newChanges[boardName] as any)?.swaps || [],
          edits: (newChanges[boardName] as any)?.edits || [],
        };
      }
      setChanges(newChanges);
    }
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

  const hasMissing = missing.length > 0;

  // Build a summary of cards per board for display
  const boardSummary = Object.entries(addedByBoard).map(([boardName, entries]) => ({
    boardName: boardName.charAt(0).toUpperCase() + boardName.slice(1),
    count: entries.length,
  }));

  return (
    <Card className="mt-3">
      <CardHeader>
        <Text semibold lg>
          Confirm Import
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="1">
          {hasMissing ? (
            <Text>
              There were a few problems with your bulk upload. Below is a list of unrecognized cards, please go through
              and manually add them. No changes have been saved.
            </Text>
          ) : (
            <Text>
              Review the cards to be added below. No changes have been saved yet. Click &quot;Save Changes&quot; to
              confirm the import.
            </Text>
          )}

          {boardSummary.length > 0 && (
            <Flexbox direction="col" gap="1" className="mt-2 mb-2">
              <Text semibold sm>Cards to be imported:</Text>
              {boardSummary.map(({ boardName, count }) => (
                <Text key={boardName} sm>
                  {boardName}: {count} card{count !== 1 ? 's' : ''}
                </Text>
              ))}
            </Flexbox>
          )}

          <Row>
            {hasMissing && (
              <Col xs={6}>
                <Card>
                  <CardHeader>
                    <Text semibold sm>
                      Unrecognized Cards ({missing.length})
                    </Text>
                  </CardHeader>
                  <CardBody>
                    <Flexbox direction="col" gap="1">
                      {missing.map((card, index) => (
                        <Text key={index}>{card}</Text>
                      ))}
                    </Flexbox>
                  </CardBody>
                </Card>
              </Col>
            )}
            <Col xs={hasMissing ? 6 : 12}>
              <Flexbox direction="col" gap="1">
                {hasMissing && (
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
                )}
                {alerts.map(({ color, message }, index) => (
                  <Text key={index} className={`alert alert-${color} mt-2`}>
                    {message}
                  </Text>
                ))}
                <Changelist />
                <Flexbox direction="row" gap="2" className="mt-3">
                  <Button
                    color="secondary"
                    outline
                    block
                    onClick={() => {
                      clearChanges();
                      window.location.href = `/cube/list/${cube.id}`;
                    }}
                  >
                    Cancel Import
                  </Button>
                  <LoadingButton loading={loading} color="primary" block onClick={submit}>
                    Save Changes
                  </LoadingButton>
                </Flexbox>
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
  addedByBoard: Record<string, any[]>;
  changelog?: Changes;
  blogpost: {
    title: string;
    html: string;
  };
  missing: string[];
}

const BulkUploadPage: React.FC<BulkUploadPageProps> = ({ cube, cards, added, addedByBoard, changelog, missing }) => (
  <MainLayout useContainer={false}>
    <DynamicFlash />
    <CubeLayout cube={cube} cards={cards} activeLink="bulkupload" useChangedCards>
      <BulkUploadPageRaw added={added} addedByBoard={addedByBoard || { mainboard: added }} changelog={changelog} missing={missing} />
    </CubeLayout>
  </MainLayout>
);

export default RenderToRoot(BulkUploadPage);
