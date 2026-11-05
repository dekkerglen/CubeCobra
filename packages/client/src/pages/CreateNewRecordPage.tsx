import React from 'react';

import Cube from '@utils/datatypes/Cube';
import Record from '@utils/datatypes/Record';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import { defaultRecordDate, defaultRecordName } from '../records/recordName';
import EditDescription from '../records/EditDescription';

interface CreateNewRecordPageProps {
  cube: Cube;
  // Which path opened this wizard. The form is the same either way; this decides where it
  // posts, and so whether the organiser lands on the record page to run the event or in the
  // transcription workspace to type one in.
  finished?: boolean;
}

const CreateNewRecordPage: React.FC<CreateNewRecordPageProps> = ({ cube, finished = false }) => {
  // An organiser opening this wizard knows what the event is called and roughly when, but often
  // not yet who turned up — asking for a player list here is why this used to be a two-step
  // wizard, and part of why nothing linked to it. Players are added on the record page instead.
  //
  // The finished path arrives prefilled: it replaced a single button that generated exactly
  // these two values, so asking for them again would make the quicker path the slower one.
  const [record, setRecord] = React.useState<Partial<Record>>(() => {
    if (!finished) {
      return {};
    }
    const now = new Date();
    return { name: defaultRecordName(now), date: defaultRecordDate(now) };
  });
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              {finished ? 'Input Finished Event' : 'Start an Event'}
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="2">
              <EditDescription value={record} setValue={setRecord} />
              <Text sm className="text-text-secondary">
                {finished
                  ? 'Name the event and set its date, then enter the players, decks and results all at once.'
                  : 'Name the event and set its date. You will add players and record matches as it runs.'}
              </Text>
              <CSRFForm
                method="POST"
                action={`/cube/records/create/${finished ? 'finished/' : ''}${cube.id}`}
                formData={{ record: JSON.stringify(record) }}
                ref={formRef}
              >
                <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={!record.name}>
                  {finished ? 'Continue to event data' : 'Create'}
                </LoadingButton>
              </CSRFForm>
            </Flexbox>
          </CardBody>
        </Card>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CreateNewRecordPage);
