import React, { createRef, useMemo, useState } from 'react';

import { cardOracleId, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import UploadDeck from '../records/UploadDeck';

interface RecordUploadDeckPageProps {
  cube: Cube;
  record: Record;
  draft?: Draft;
}

const RecordUploadDeckPage: React.FC<RecordUploadDeckPageProps> = ({ cube, record, draft }) => {
  const formRef = createRef<HTMLFormElement>();
  const [selectedUser, setSelectedUser] = useState<number>(0);
  const [mainboardCards, setMainboardCards] = useState<CardDetails[]>([]);
  const [sideboardCards, setSideboardCards] = useState<CardDetails[]>([]);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);

  const { submitDisabled, disabledExplanation } = useMemo(() => {
    if (selectedUser <= 0 || selectedUser > record.players.length) {
      return { submitDisabled: true, disabledExplanation: 'No player selected' };
    }

    // player already has a deck in the draft
    if (draft && draft.seats[selectedUser - 1]?.mainboard?.flat(3).length > 0) {
      return { submitDisabled: true, disabledExplanation: 'Selected player already has a deck in the draft' };
    }

    if (mainboardCards.length === 0) {
      return { submitDisabled: true, disabledExplanation: 'No cards added to mainboard' };
    }

    return { submitDisabled: false, disabledExplanation: '' };
  }, [selectedUser, record.players.length, draft, mainboardCards.length]);

  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              Upload Deck to Record: {record.name}
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="2">
              <UploadDeck
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                record={record}
                mainboardCards={mainboardCards}
                setMainboardCards={setMainboardCards}
                sideboardCards={sideboardCards}
                setSideboardCards={setSideboardCards}
                setAlerts={setAlerts}
                cubeId={cube.id}
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
                action={`/cube/records/uploaddeck/${record.id}`}
                formData={{
                  userIndex: `${selectedUser}`,
                  mainboard: JSON.stringify(mainboardCards.map(detailsToCard).map(cardOracleId)),
                  sideboard: JSON.stringify(sideboardCards.map(detailsToCard).map(cardOracleId)),
                }}
                ref={formRef}
              >
                <LoadingButton
                  onClick={() => formRef.current?.submit()}
                  color="primary"
                  block
                  disabled={submitDisabled}
                >
                  Upload
                </LoadingButton>
              </CSRFForm>
            </Flexbox>
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(RecordUploadDeckPage);
