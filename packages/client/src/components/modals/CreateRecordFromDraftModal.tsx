import React, { createRef, useCallback, useContext, useEffect, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';

import CursorPagination from 'components/base/CursorPagination';
import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

import { defaultRecordName } from '../../records/recordName';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface CreateRecordFromDraftModalProps {
  cube: Cube;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const PAGE_SIZE = 20;

const CreateRecordFromDraftModal: React.FC<CreateRecordFromDraftModalProps> = ({ cube, isOpen, setOpen }) => {
  const { csrfFetch, callApi } = useContext(CSRFContext);
  const formRef = createRef<HTMLFormElement>();
  const [items, setItems] = useState<Draft[]>([]);
  const [lastKey, setLastKey] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const fetchDrafts = useCallback(
    async (key: any) => {
      setLoading(true);
      try {
        const response = await csrfFetch(`/cube/getmoredecks/${cube.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastKey: key }),
        });
        if (response.ok) {
          const json = await response.json();
          setItems((prev) => [...prev, ...(json.decks ?? [])]);
          setLastKey(json.lastKey ?? null);
        }
      } finally {
        setLoading(false);
        setLoadedOnce(true);
      }
    },
    [csrfFetch, cube.id],
  );

  // Lazy-load the first page of drafts the first time the modal opens.
  useEffect(() => {
    if (isOpen && !loadedOnce && !loading) {
      void fetchDrafts(null);
    }
  }, [isOpen, loadedOnce, loading, fetchDrafts]);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(lastKey);
  const selectedDraft = items.find((item) => item.id === selectedId);
  // Match the single-click "create new" behaviour: name the record after the
  // draft's date; the server defaults the date too.
  const name = selectedDraft ? defaultRecordName(new Date(selectedDraft.date as number)) : '';

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Draft>({
        callApi,
        fetchMoreRoute: `/cube/getmoredecks/${cube.id}`,
        items,
        setItems,
        lastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'decks',
        setLoading,
        targetPage,
      });
    },
    [callApi, cube.id, items, lastKey],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData,
        });
      }}
      loading={loading}
    />
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg scrollable>
      <ModalHeader setOpen={setOpen}>Create record from draft</ModalHeader>
      <ModalBody scrollable className="flex flex-col gap-2">
        <Text sm className="text-text-secondary">
          Pick the draft to turn into a record. Players are pulled from the draft seats.
        </Text>
        {!loadedOnce && loading ? (
          <Flexbox direction="row" gap="2" alignItems="center">
            <Spinner sm />
            <Text sm>Loading drafts…</Text>
          </Flexbox>
        ) : items.length === 0 ? (
          <Text sm>No drafts found for this cube.</Text>
        ) : (
          <>
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
            <Table
              headers={['', 'Name', 'Date']}
              rows={items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => ({
                '': (
                  <input
                    type="radio"
                    name="draft-select"
                    className="form-radio h-5 w-5 text-primary-button cursor-pointer"
                    checked={item.id === selectedId}
                    onChange={() => setSelectedId(item.id)}
                  />
                ),
                Name: item.name,
                Date: <FormatttedDate date={item.date as number} />,
              }))}
            />
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
              {pager}
            </Flexbox>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={!selectedId}>
          Create Record
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/create/fromDraft/${cube.id}`}
          formData={{ record: JSON.stringify({ name, date: selectedDraft?.date }), draft: selectedId }}
          ref={formRef}
        />
      </ModalFooter>
    </Modal>
  );
};

export default CreateRecordFromDraftModal;
