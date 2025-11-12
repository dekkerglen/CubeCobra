import React from 'react';

import { ArrowLeftIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import Record from '@utils/datatypes/Record';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import EditDescription from '../records/EditDescription';
import EditPlayerList from '../records/EditPlayerList';

interface CreateNewRecordPageProps {
  cube: Cube;
}

const CreateNewRecordPage: React.FC<CreateNewRecordPageProps> = ({ cube }) => {
  const [step, setStep] = React.useState(0);
  const [record, setRecord] = React.useState<Partial<Record>>({});
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              Create New Record
            </Text>
          </CardHeader>
          <CardBody>
            {/* Step 1: Name and Description */}
            {step === 0 && (
              <Flexbox direction="col" gap="2">
                <Text md semibold>
                  1. Name and Description
                </Text>
                <EditDescription value={record} setValue={setRecord} />
                <Button onClick={() => setStep(1)} color="primary" disabled={!record.name}>
                  Next Step
                </Button>
              </Flexbox>
            )}

            {/* Step 2: Player List */}
            {step === 1 && (
              <Flexbox direction="col" gap="2">
                <Link onClick={() => setStep(1)}>
                  <ArrowLeftIcon size={16} />
                  Back to Step 1
                </Link>
                <Text md semibold>
                  2. Create Player List
                </Text>
                <EditPlayerList
                  players={record?.players || []}
                  setPlayers={(players) => {
                    const newRecord = JSON.parse(JSON.stringify(record || {}));
                    newRecord.players = players;
                    setRecord(newRecord);
                  }}
                />
                <CSRFForm
                  method="POST"
                  action={`/cube/records/create/${cube.id}`}
                  formData={{ record: JSON.stringify(record) }}
                  ref={formRef}
                >
                  <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
                    Create
                  </LoadingButton>
                </CSRFForm>
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CreateNewRecordPage);
