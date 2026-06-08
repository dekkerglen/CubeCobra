import React, { createRef, useMemo, useState } from 'react';

import { cardOracleId, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Record, { PlayerList } from '@utils/datatypes/Record';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import UploadDeck, { NEW_PLAYER } from '../records/UploadDeck';
import UploadDeckFromPhoto from '../records/UploadDeckFromPhoto';

interface ContributeDeckPageProps {
  cube: Cube;
  record: { id: string; name: string; players: PlayerList };
  token: string;
  suggestedName: string;
}

const ContributeDeckPage: React.FC<ContributeDeckPageProps> = ({ cube, record, token, suggestedName }) => {
  const formRef = createRef<HTMLFormElement>();
  // Default to adding yourself as a new player when we know your account name.
  const [selectedUser, setSelectedUser] = useState<number>(suggestedName ? NEW_PLAYER : 0);
  const [newPlayerName, setNewPlayerName] = useState<string>(suggestedName);
  const [mainboardCards, setMainboardCards] = useState<CardDetails[]>([]);
  const [sideboardCards, setSideboardCards] = useState<CardDetails[]>([]);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);
  const [wins, setWins] = useState<number>(0);
  const [losses, setLosses] = useState<number>(0);
  const [draws, setDraws] = useState<number>(0);

  const isNewPlayer = selectedUser === NEW_PLAYER;

  const { submitDisabled, disabledExplanation } = useMemo(() => {
    if (isNewPlayer) {
      if (!newPlayerName.trim()) {
        return { submitDisabled: true, disabledExplanation: 'Enter your name' };
      }
    } else if (selectedUser <= 0 || selectedUser > record.players.length) {
      return { submitDisabled: true, disabledExplanation: 'Pick or add a player' };
    }
    if (mainboardCards.length === 0) {
      return { submitDisabled: true, disabledExplanation: 'Add the cards in your deck' };
    }
    return { submitDisabled: false, disabledExplanation: '' };
  }, [isNewPlayer, newPlayerName, selectedUser, record.players.length, mainboardCards.length]);

  const numberField = (label: string, value: number, setValue: (v: number) => void) => (
    <Col xs={4} md={4}>
      <Text sm semibold>
        {label}
      </Text>
      <Input
        type="number"
        otherInputProps={{ min: 0 }}
        value={`${value}`}
        onChange={(e) => setValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
    </Col>
  );

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="my-2">
        <CardHeader>
          <Text lg semibold>
            Add your deck to: {record.name}
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <UploadDeckFromPhoto cube={cube} setMainboardCards={setMainboardCards} setAlerts={setAlerts} />
            <UploadDeck
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
              newPlayerName={newPlayerName}
              setNewPlayerName={setNewPlayerName}
              record={record as unknown as Record}
              mainboardCards={mainboardCards}
              setMainboardCards={setMainboardCards}
              sideboardCards={sideboardCards}
              setSideboardCards={setSideboardCards}
              setAlerts={setAlerts}
              cubeId={cube.id}
            />

            <Text sm semibold className="mt-2">
              Your record
            </Text>
            <Row>
              {numberField('Wins', wins, setWins)}
              {numberField('Losses', losses, setLosses)}
              {numberField('Draws', draws, setDraws)}
            </Row>

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
              action={`/cube/records/contribute/${record.id}`}
              formData={{
                token,
                userIndex: `${selectedUser}`,
                newPlayer: isNewPlayer ? newPlayerName.trim() : '',
                mainboard: JSON.stringify(mainboardCards.map(detailsToCard).map(cardOracleId)),
                sideboard: JSON.stringify(sideboardCards.map(detailsToCard).map(cardOracleId)),
                wins: `${wins}`,
                losses: `${losses}`,
                draws: `${draws}`,
              }}
              ref={formRef}
            >
              <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={submitDisabled}>
                Submit deck
              </LoadingButton>
            </CSRFForm>
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ContributeDeckPage);
