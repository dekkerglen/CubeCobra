import React from 'react';

import { ArrowLeftIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import Cube from 'datatypes/Cube';
import Record from 'datatypes/Record';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import EditDescription from '../records/EditDescription';
import EditPlayerList from '../records/EditPlayerList';

interface CreateRecordPageProps {
  cube: Cube;
  loginCallback?: string;
}

const CreateRecordPage: React.FC<CreateRecordPageProps> = ({ cube, loginCallback = '/' }) => {
  const [step, setStep] = React.useState(0);
  const [record, setRecord] = React.useState<Partial<Record>>({});
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              Create Record
            </Text>
          </CardHeader>
          <CardBody>
            {/* Step 1: Select Record Type */}
            {step === 0 && (
              <Flexbox direction="col" gap="2">
                <Text md semibold>
                  1. Is this a new Draft? Or are you uploading a historical report?
                </Text>
                <Flexbox gap="2" direction="row" justify="between">
                  <Button
                    onClick={() => {
                      setRecord((oldRecord) => {
                        const newRecord = JSON.parse(JSON.stringify(oldRecord || {}));
                        newRecord.state = 'playing';
                        return newRecord;
                      });
                      setStep(1);
                    }}
                    color="primary"
                    block
                  >
                    New Draft
                  </Button>
                  <Button
                    onClick={() => {
                      setRecord((oldRecord) => {
                        const newRecord = JSON.parse(JSON.stringify(oldRecord || {}));
                        newRecord.state = 'complete';
                        return newRecord;
                      });
                      setStep(1);
                    }}
                    color="primary"
                    block
                  >
                    Historical Report
                  </Button>
                </Flexbox>
              </Flexbox>
            )}

            {record.state === 'playing' && step > 0 && (
              <>
                {/* Step 2: Create player list */}
                {step === 1 && (
                  <Flexbox direction="col" gap="2">
                    <Link onClick={() => setStep(0)}>
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
                    <Button onClick={() => setStep(2)} color="primary">
                      Next Step
                    </Button>
                  </Flexbox>
                )}

                {/* Step 3: Name and Description */}
                {step === 2 && (
                  <Flexbox direction="col" gap="2">
                    <Link onClick={() => setStep(1)}>
                      <ArrowLeftIcon size={16} />
                      Back to Step 2
                    </Link>
                    <Text md semibold>
                      3. Name and Description
                    </Text>
                    <EditDescription value={record} setValue={setRecord} />
                    <CSRFForm
                      method="POST"
                      action={`/cube/records/create/${cube.id}`}
                      formData={{ record: JSON.stringify(record) }}
                      ref={formRef}
                    >
                      <LoadingButton
                        disabled={!record.name}
                        onClick={() => formRef.current?.submit()}
                        color="primary"
                        block
                      >
                        Create
                      </LoadingButton>
                    </CSRFForm>
                  </Flexbox>
                )}
              </>
            )}

            {record.state === 'complete' && step > 0 && (
              <>
                {/* Step 2: Historical Report Form */}
                {step === 1 && (
                  <Flexbox direction="col" gap="2">
                    <h3>Historical Report</h3>
                    <Button onClick={() => setStep(2)}>Continue to Historical Report Form</Button>
                    <Link onClick={() => setStep(0)}>Back to Step 1</Link>
                  </Flexbox>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CreateRecordPage);
