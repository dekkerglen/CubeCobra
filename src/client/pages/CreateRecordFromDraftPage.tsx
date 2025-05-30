import React, { createRef, useCallback, useContext, useState } from 'react';

import { ArrowLeftIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Pagination from 'components/base/Pagination';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import EditDescription from '../records/EditDescription';

interface CreateRecordFromDraftPageProps {
  cube: Cube;
  loginCallback?: string;
  decks: Draft[];
  decksLastKey?: any;
}

const PAGE_SIZE = 20;

const CreateRecordFromDraftPage: React.FC<CreateRecordFromDraftPageProps> = ({
  cube,
  decks,
  decksLastKey,
  loginCallback = '/',
}) => {
  const [step, setStep] = useState(0);
  const { csrfFetch } = useContext(CSRFContext);
  const [record, setRecord] = useState<Partial<Record>>({});
  const formRef = createRef<HTMLFormElement>();
  const [items, setItems] = useState<Draft[]>(decks);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [lastKey, setLastKey] = useState<any>(decksLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!lastKey;

  const fetchMore = useCallback(async () => {
    setLoading(true);
    const response = await csrfFetch(`/cube/getmoredecks/${cube.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();

      setLastKey(json.lastKey);
      setItems([...items, ...json.decks]);
      setPage(page + 1);
      setLoading(false);
    }
  }, [csrfFetch, cube.id, items, lastKey, page]);

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

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Text lg semibold>
              Create record from existing draft
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

            {/* Step 2: Choose draft */}
            {step === 1 && (
              <Flexbox direction="col" gap="2">
                <Link onClick={() => setStep(1)}>
                  <ArrowLeftIcon size={16} />
                  Back to Step 1
                </Link>
                <Text md semibold>
                  2. Choose Draft
                </Text>
                <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                  {pager}
                </Flexbox>
                <Table
                  headers={['', 'Name', 'Date']}
                  rows={items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => ({
                    '': (
                      <Checkbox
                        checked={item.id === selectedItemId}
                        setChecked={() => setSelectedItemId(item.id)}
                        label={''}
                      />
                    ),
                    Name: <Link href={`/cube/deck/${item.id}`}>{item.name}</Link>,
                    Date: <FormatttedDate date={item.date as number} />,
                  }))}
                />
                <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                  {pager}
                </Flexbox>
                <CSRFForm
                  method="POST"
                  action={`/cube/records/create/fromDraft/${cube.id}`}
                  formData={{ record: JSON.stringify(record), draft: selectedItemId }}
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

export default RenderToRoot(CreateRecordFromDraftPage);
