import React, { useCallback, useContext, useEffect, useState } from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import withAutocard from 'components/WithAutocard';
import ChangesContext from 'contexts/ChangesContext';
import CardData, { BoardChanges } from '@utils/datatypes/Card';
import { CardDetails } from '@utils/datatypes/Card';

const TextAutocard = withAutocard('span');

const Add = ({ card }: { card: CardData }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>(null);

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [card.cardID]);

  return (
    <Flexbox direction="row" gap="1" alignItems="center">
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      {!loading && details ? <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard> : <Spinner sm />}
    </Flexbox>
  );
};

const Remove = ({ card }: { card: CardData }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>(null);

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [card.cardID]);

  return (
    <Flexbox direction="row" gap="1" alignItems="center">
      <span className="mx-1" style={{ color: 'red' }}>
        <NoEntryIcon />
      </span>
      {!loading && details ? <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard> : <Spinner sm />}
    </Flexbox>
  );
};

const Edit = ({ card }: { card: CardData }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>(null);

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [card.cardID]);

  return (
    <Flexbox direction="row" gap="1" alignItems="center">
      <span className="mx-1" style={{ color: 'orange' }}>
        <ToolsIcon />
      </span>
      {!loading && details ? <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard> : <Spinner sm />}
    </Flexbox>
  );
};

const Swap = ({ card, oldCard }: { card: CardData; oldCard: CardData }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>();
  const [details2, setDetails2] = useState<CardDetails | null>();

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }

      const response2 = await fetch(`/cube/api/getcardfromid/${oldCard.cardID}`);
      if (response2.ok) {
        const data = await response2.json();
        setDetails2(data.card);
        setLoading(false);
      }

      return null;
    };
    getData();
  }, [card.cardID, oldCard.cardID]);

  return (
    <Flexbox direction="row" gap="1">
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      {!loading && details ? (
        <TextAutocard card={{ ...oldCard, details }}>{details.name}</TextAutocard>
      ) : (
        <Spinner sm />
      )}
      <ArrowRightIcon className="mx-1" />
      {!loading && details2 ? (
        <TextAutocard card={{ ...card, details: details2 }}>{details2.name}</TextAutocard>
      ) : (
        <Spinner sm />
      )}
    </Flexbox>
  );
};

const BoardChangeList = ({ changes }: { changes?: BoardChanges }) => {
  return (
    <>
      {changes && (changes.adds || []).length > 0 && (
        <Flexbox direction="col" gap="1">
          <Text semibold>Adds:</Text>
          {(changes.adds || []).map((card, index) => (
            <Add key={index} card={card} />
          ))}
        </Flexbox>
      )}
      {changes && (changes.removes || []).length > 0 && (
        <Flexbox direction="col" gap="1">
          <Text semibold>Removes:</Text>
          {(changes.removes || []).map((remove, index) => (
            <Remove key={index} card={remove.oldCard} />
          ))}
        </Flexbox>
      )}
      {changes && (changes.edits || []).length > 0 && (
        <Flexbox direction="col" gap="1">
          <Text semibold>Edits:</Text>
          {(changes.edits || []).map((edit, index) => (
            <Edit key={index} card={edit.oldCard} />
          ))}
        </Flexbox>
      )}
      {changes && (changes.swaps || []).length > 0 && (
        <Flexbox direction="col" gap="1">
          <Text semibold>Swaps:</Text>
          {(changes.swaps || []).map((swap, index) => (
            <Swap key={index} card={swap.card} oldCard={swap.oldCard} />
          ))}
        </Flexbox>
      )}
    </>
  );
};
const VersionMismatch: React.FC = () => {
  const { fixedChanges, setChanges, brokenChanges } = useContext(ChangesContext);

  const clearNonAdds = useCallback(() => {
    const newChanges = { ...brokenChanges };

    if (newChanges.mainboard) {
      newChanges.mainboard.removes = [];
      newChanges.mainboard.edits = [];
      newChanges.mainboard.swaps = [];
    }

    if (newChanges.maybeboard) {
      newChanges.maybeboard.removes = [];
      newChanges.maybeboard.edits = [];
      newChanges.maybeboard.swaps = [];
    }

    setChanges(newChanges);
  }, [brokenChanges, setChanges]);

  const fixedChangesExist = fixedChanges
    ? (fixedChanges.mainboard &&
        ((fixedChanges.mainboard.adds || []).length > 0 ||
          (fixedChanges.mainboard.removes || []).length > 0 ||
          (fixedChanges.mainboard.edits || []).length > 0 ||
          (fixedChanges.mainboard.swaps || []).length > 0)) ||
      (fixedChanges.maybeboard &&
        ((fixedChanges.maybeboard.adds || []).length > 0 ||
          (fixedChanges.maybeboard.removes || []).length > 0 ||
          (fixedChanges.maybeboard.edits || []).length > 0 ||
          (fixedChanges.maybeboard.swaps || []).length > 0))
    : false;

  return (
    <Card className="my-3">
      <CardHeader>
        <Text semibold lg>
          We detected a version mismatch with your pending changes, and the current version of the cube.
        </Text>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <Text>
              This can happen if you've made changes to the cube in another tab or browser. To prevent data loss, you
              can clear the removes, edits, and swaps from your locally stored changes. Adds will still be saved. We
              will attempt to describe the locally stored changes for your reference.
            </Text>
            <Text semibold md>
              Locally Stored Changes:
            </Text>
            {brokenChanges && brokenChanges.mainboard && (
              <Card>
                <CardBody>
                  <Text semibold>Mainboard</Text>
                  <BoardChangeList changes={brokenChanges.mainboard} />
                </CardBody>
              </Card>
            )}
            {brokenChanges && brokenChanges.maybeboard && (
              <Card>
                <CardBody>
                  <Text semibold>Maybeboard</Text>
                  <BoardChangeList changes={brokenChanges.maybeboard} />
                </CardBody>
              </Card>
            )}
            <Button color="danger" block onClick={clearNonAdds}>
              Clear Pending Deletes, Edits, and Swaps
            </Button>
            {fixedChanges && fixedChangesExist && (
              <>
                <Text>
                  Alternatively, we have attempted to fix the changes for you. It may be missing data, so please
                  carefully review.
                </Text>
                {fixedChanges && fixedChanges.mainboard && (
                  <Card>
                    <CardBody>
                      <Text semibold>Mainboard</Text>
                      <BoardChangeList changes={fixedChanges.mainboard} />
                    </CardBody>
                  </Card>
                )}
                {fixedChanges && fixedChanges.maybeboard && (
                  <Card>
                    <CardBody>
                      <Text semibold>Maybeboard</Text>
                      <BoardChangeList changes={fixedChanges.maybeboard} />
                    </CardBody>
                  </Card>
                )}
                <Button color="primary" block onClick={() => setChanges(fixedChanges)}>
                  Apply Fixed Changes
                </Button>
              </>
            )}
          </Flexbox>
        </CardBody>
      </CardHeader>
    </Card>
  );
};

export default VersionMismatch;
