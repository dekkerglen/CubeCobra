import React, { createRef, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ArrowLeftIcon } from '@primer/octicons-react';
import QRCode from 'react-qr-code';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import { CardDetails } from 'datatypes/Card';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';
import User from 'datatypes/User';
import MainLayout from 'layouts/MainLayout';
import { cardOracleId, detailsToCard } from 'utils/cardutil';

import EditDescription from '../records/EditDescription';
import EditPlayerList from '../records/EditPlayerList';
import UploadDeck from '../records/UploadDeck';

interface UploadDeckStepProps {
  record: Record;
  draft?: Draft;
  cubeId: string;
  cards: CardDetails[];
  setCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  newRecord: boolean;
}

const UploadDeckStep: React.FC<UploadDeckStepProps> = ({ record, draft, cubeId, cards, setCards, newRecord }) => {
  const formRef = createRef<HTMLFormElement>();
  const [selectedUser, setSelectedUser] = useState<number>(0);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);

  const { submitDisabled, disabledExplanation } = useMemo(() => {
    if (selectedUser <= 0 || selectedUser > record.players.length) {
      return { submitDisabled: true, disabledExplanation: 'No player selected' };
    }

    // player already has a deck in the draft
    if (draft && draft.seats[selectedUser - 1]?.mainboard?.flat(3).length > 0) {
      return { submitDisabled: true, disabledExplanation: 'Selected player already has a deck in the draft' };
    }

    if (cards.length === 0) {
      return { submitDisabled: true, disabledExplanation: 'No cards added to deck' };
    }

    return { submitDisabled: false, disabledExplanation: '' };
  }, [selectedUser, record.players.length, draft, cards.length]);

  return (
    <>
      <UploadDeck
        cubeId={cubeId}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        record={record}
        cards={cards}
        setCards={setCards}
        setAlerts={setAlerts}
      />
      {alerts.map(({ color, message }, index) => (
        <Alert key={index} color={color}>
          {message}
        </Alert>
      ))}
      {disabledExplanation && (
        <Alert color="warning" className="mt-2">
          {disabledExplanation}
        </Alert>
      )}
      <CSRFForm
        method="POST"
        action={`/cube/records/import/${cubeId}`}
        formData={{
          userIndex: `${selectedUser}`,
          newRecord: newRecord ? 'true' : 'false',
          cards: JSON.stringify(cards.map(detailsToCard).map(cardOracleId)),
          record: JSON.stringify(record),
        }}
        ref={formRef}
      >
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={submitDisabled}>
          Upload
        </LoadingButton>
      </CSRFForm>
    </>
  );
};

interface SelectRecordStepProps {
  cubeId: string;
  selectedRecord: Record;
  setSelectedRecord: React.Dispatch<React.SetStateAction<Record>>;
}

const PAGE_SIZE = 20;

const SelectRecordStep: React.FC<SelectRecordStepProps> = ({ cubeId, selectedRecord, setSelectedRecord }) => {
  const [records, setRecords] = useState<Record[]>([]);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = React.useState(0);
  const { csrfFetch } = useContext(CSRFContext);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const response = await csrfFetch(`/cube/records/list/${cubeId}`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const data = await response.json();
        if (data.records) {
          setRecords((prevItems) => [...prevItems, ...data.records]);
          setLastKey(data.lastKey);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [csrfFetch, cubeId]);

  const fetchMore = useCallback(async () => {
    if (loading || !lastKey) return;
    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/records/list/${cubeId}`, {
        method: 'POST',
        body: JSON.stringify({ lastKey }),
      });
      const data = await response.json();
      if (data.records) {
        setRecords((prevItems) => [...prevItems, ...data.records]);
        setLastKey(data.lastKey);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, lastKey, csrfFetch, cubeId]);

  const pageCount = Math.ceil(records.length / PAGE_SIZE);
  const hasMore = !!lastKey;

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        if (newPage >= pageCount) {
          await fetchMore();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  if (loading) {
    return <Spinner lg />;
  }

  return (
    <>
      {records.length > 0 ? (
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full p-4">
            {pager}
          </Flexbox>
          <Table
            headers={['', 'Name', 'Date', 'Players']}
            rows={records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((record) => ({
              '': (
                <Checkbox
                  checked={record.id === selectedRecord.id}
                  setChecked={() => setSelectedRecord(record)}
                  label={''}
                />
              ),
              Name: <Link href={`/cube/record/${record.id}`}>{record.name}</Link>,
              Date: <FormatttedDate date={record.date} />,
              Players: (
                <Flexbox direction="row" gap="1">
                  {record.players.map((player, index) => {
                    if (player.userId) {
                      return (
                        <>
                          <Link key={player.userId} href={`/user/view/${player.userId}`}>
                            <Text sm>{player.name}</Text>
                          </Link>
                          {index < record.players.length - 1 && <Text sm>, </Text>}
                        </>
                      );
                    }

                    return (
                      <Text key={player.name} sm>
                        {player.name}
                        {index < record.players.length - 1 && <Text sm>, </Text>}
                      </Text>
                    );
                  })}
                </Flexbox>
              ),
            }))}
          />
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full p-4">
            {pager}
          </Flexbox>
        </Flexbox>
      ) : (
        <CardBody>
          <Text md>No draft reports to show, create a new report to get started!</Text>
        </CardBody>
      )}
    </>
  );
};

interface ImportRecordPageProps {
  cards: CardDetails[];
  loginCallback?: string;
}

const ImportRecordPage: React.FC<ImportRecordPageProps> = ({ cards, loginCallback = '/' }) => {
  const user: User | null = useContext(UserContext);
  const [isYourCube, setIsYourCube] = React.useState(true);
  const [existingRecord, setExistingRecord] = React.useState<boolean>(false);
  const [step, setStep] = React.useState(0);
  const [record, setRecord] = React.useState<Partial<Record>>({});
  const cubes: { id: string; name: string }[] = user?.cubes ?? [];
  const [selectedCube, setSelectedCube] = useState<string>('');
  const [cardState, setCardState] = useState<CardDetails[]>(cards);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-2">
        <CardHeader>
          <Text lg semibold>
            Import draft data to record
          </Text>
        </CardHeader>
        <CardBody>
          {/* Step 1: Is this for your cube? */}
          {step === 0 && (
            <Flexbox direction="col" gap="2">
              <Text md semibold>
                1. Does this draft belong to one of your cubes?
              </Text>
              <Flexbox direction="row" gap="2">
                <Button
                  onClick={() => {
                    setIsYourCube(true);
                    setStep(1);
                  }}
                  color="primary"
                >
                  Yes, it's my cube
                </Button>
                <Button
                  onClick={() => {
                    setIsYourCube(false);
                    setStep(1);
                  }}
                  color="secondary"
                >
                  No, it's someone else's cube
                </Button>
              </Flexbox>
            </Flexbox>
          )}

          {/* Step 2a. Choose cube */}
          {step === 1 && isYourCube && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(0)}>
                <ArrowLeftIcon size={16} />
                Back to Step 1
              </Link>
              <Text md semibold>
                2. Choose Cube
              </Text>
              <Text sm>
                {isYourCube ? 'Select your cube to import the draft data.' : 'Select a cube to import the draft data.'}
              </Text>
              <Select
                label="Cube"
                options={[
                  { value: '', label: 'Select a cube' },
                  ...cubes.map((cube) => ({ value: cube.id, label: cube.name })),
                ]}
                value={selectedCube}
                setValue={(val) => setSelectedCube(val)}
              />
              <Button
                onClick={() => {
                  setStep(2);
                }}
                color="primary"
              >
                Next Step
              </Button>
            </Flexbox>
          )}

          {/* Step 2b (terminal). Show QR */}
          {step === 1 && !isYourCube && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(0)}>
                <ArrowLeftIcon size={16} />
                Back to Step 1
              </Link>
              <Text md semibold>
                2. Show QR Code to cube owner
              </Text>
              <Text sm>
                {
                  'Data can only be imported by the cube owner. Please show this QR code to the cube owner to import the draft data.'
                }
              </Text>
              <div className="centered">
                <div className="p-3 qr-code-area">
                  <QRCode id="qr-code" value={window.location.href} />
                </div>
              </div>
            </Flexbox>
          )}

          {/* Step 3: Existing or new record? */}
          {step === 2 && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(1)}>
                <ArrowLeftIcon size={16} />
                Back to Step 2
              </Link>
              <Text md semibold>
                3. Is this an existing record or a new one?
              </Text>
              <Flexbox direction="row" gap="2">
                <Button
                  onClick={() => {
                    setExistingRecord(true);
                    setStep(3);
                  }}
                  color="primary"
                >
                  Yes, it's for an existing record
                </Button>
                <Button
                  onClick={() => {
                    setExistingRecord(false);
                    setStep(3);
                  }}
                  color="secondary"
                >
                  No, it's for a new record
                </Button>
              </Flexbox>
            </Flexbox>
          )}

          {/* Step 4a: Select Record */}
          {step === 3 && existingRecord && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(2)}>
                <ArrowLeftIcon size={16} />
                Back to Step 3
              </Link>
              <Text md semibold>
                4. Select Record
              </Text>
              <Text sm>Please select the record you want to import the draft data into.</Text>
              <SelectRecordStep
                cubeId={selectedCube}
                selectedRecord={record as Record}
                setSelectedRecord={(r) => {
                  setRecord(r as Partial<Record>);
                }}
              />
              <Button onClick={() => setStep(4)} color="primary" disabled={!record.id}>
                Next Step
              </Button>
            </Flexbox>
          )}

          {/* Step 5a (terminal): Select player and confirm deck */}
          {step === 4 && existingRecord && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(3)}>
                <ArrowLeftIcon size={16} />
                Back to Step 4
              </Link>
              <Text md semibold>
                5. Choose Player and Confirm Deck
              </Text>
              <UploadDeckStep
                record={record as Record}
                cubeId={selectedCube}
                cards={cardState}
                setCards={setCardState}
                newRecord={false}
              />
            </Flexbox>
          )}

          {/* Step 4b: Record Overview? */}
          {step === 3 && !existingRecord && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(2)}>
                <ArrowLeftIcon size={16} />
                Back to Step 3
              </Link>
              <Text md semibold>
                4. Name and Description
              </Text>
              <Text sm>Please provide a name and description for the new record.</Text>
              <EditDescription value={record} setValue={setRecord} />
              <Button onClick={() => setStep(4)} color="primary" disabled={!record.name}>
                Next Step
              </Button>
            </Flexbox>
          )}

          {/* Step 5b: Player List */}
          {step === 4 && !existingRecord && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(3)}>
                <ArrowLeftIcon size={16} />
                Back to Step 4
              </Link>
              <Text md semibold>
                5. Create Player List
              </Text>
              <EditPlayerList
                players={record?.players || []}
                setPlayers={(players) => {
                  const newRecord = JSON.parse(JSON.stringify(record || {}));
                  newRecord.players = players;
                  setRecord(newRecord);
                }}
              />
              <Button onClick={() => setStep(5)} color="primary" disabled={!record.name}>
                Next Step
              </Button>
            </Flexbox>
          )}

          {/* Step 6b (terminal): Select player and confirm deck */}
          {step === 5 && !existingRecord && (
            <Flexbox direction="col" gap="2">
              <Link onClick={() => setStep(4)}>
                <ArrowLeftIcon size={16} />
                Back to Step 5
              </Link>
              <Text md semibold>
                6. Choose Player and Confirm Deck
              </Text>
              <UploadDeckStep
                record={record as Record}
                cubeId={selectedCube}
                cards={cardState}
                setCards={setCardState}
                newRecord={true}
              />
            </Flexbox>
          )}
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ImportRecordPage);
