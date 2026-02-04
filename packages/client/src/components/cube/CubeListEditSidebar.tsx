import React, { useCallback, useContext, useRef, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import { BoardType } from '@utils/datatypes/Card';

import Alert from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Collapse from 'components/base/Collapse';
import Dropdown from 'components/base/Dropdown';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import Changelist from 'components/Changelist';
import LoadingButton from 'components/LoadingButton';
import PasteBulkModal from 'components/modals/PasteBulkModal';
import UploadBulkModal from 'components/modals/UploadBulkModal';
import UploadBulkReplaceModal from 'components/modals/UploadBulkReplaceModal';
import TextEntry from 'components/TextEntry';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextValue } from 'contexts/DisplayContext';
import useLocalStorage from 'hooks/useLocalStorage';
import { getCard } from 'utils/cards/getCard';

const DEFAULT_BLOG_TITLE = 'Cube Updated – Automatic Post';

const PasteBulkButton = withModal(Button, PasteBulkModal);
const UploadBulkButton = withModal(Button, UploadBulkModal);
const UploadBulkReplaceButton = withModal(Button, UploadBulkReplaceModal);

interface CubeListEditSidebarProps {
  isHorizontal?: boolean;
}

const CubeListEditSidebar: React.FC<CubeListEditSidebarProps> = ({ isHorizontal = false }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');
  const { setRightSidebarMode } = useContext(DisplayContext) as DisplayContextValue;
  const addRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLInputElement>(null);

  const {
    cube,
    changes,
    addCard,
    removeCard,
    swapCard,
    changedCards,
    clearChanges,
    commitChanges,
    alerts,
    setAlerts,
    loading,
    useBlog,
    setUseBlog,
  } = useContext(CubeContext)!;

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, '');
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, DEFAULT_BLOG_TITLE);
  const [specifyEdition, setSpecifyEdition] = useLocalStorage(`${cube.id}-specifyEdition`, false);
  const [boardToEdit, setBoardToEdit] = useLocalStorage<BoardType>(`${cube.id}-editBoard`, 'mainboard');

  const handleAdd = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      try {
        const card = await getCard(csrfFetch, cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard(
          { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
          boardToEdit,
        );
        setAddValue('');

        if (addRef.current) {
          addRef.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [csrfFetch, cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard, boardToEdit],
  );

  const handleRemoveReplace = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        let removeIndex = -1;
        const board = changedCards[boardToEdit];
        for (let i = 0; i < board.length; i++) {
          const card = board[i];
          if (
            !card.markedForDelete &&
            card.index !== undefined &&
            cardName(card).toLowerCase() === match.toLowerCase()
          ) {
            removeIndex = card.index;
          }
        }

        if (removeIndex === -1) {
          setAlerts((items) => [
            ...items,
            {
              color: 'danger',
              message: `Couldn't find a card with name "${match}" in "${boardToEdit}".`,
            },
          ]);
          return;
        }

        if (replace) {
          const card = await getCard(csrfFetch, cube.defaultPrinting, addValue, setAlerts);
          if (!card) {
            return;
          }
          swapCard(
            removeIndex,
            { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
            boardToEdit,
          );
        } else {
          removeCard(removeIndex, boardToEdit);
        }

        setAddValue('');
        setRemoveValue('');

        const focus = replace ? addRef : removeRef;
        if (focus.current) {
          focus.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [
      addValue,
      changedCards,
      boardToEdit,
      setAlerts,
      csrfFetch,
      cube.defaultPrinting,
      cube.defaultStatus,
      swapCard,
      removeCard,
    ],
  );

  const submit = useCallback(async () => {
    commitChanges(postTitle, postContent);
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');
  }, [commitChanges, postContent, postTitle, setPostContent, setPostTitle]);

  return (
    <>
      {!isHorizontal ? (
        // Vertical layout for right sidebar
        <Flexbox direction="col" gap="3">
          {alerts.map(({ color, message }, index) => (
            <Alert key={index} color={color}>
              {message}
            </Alert>
          ))}

          <Flexbox direction="col" gap="2">
            <Dropdown
              trigger={
                <Button color="secondary" block>
                  Import
                </Button>
              }
              align="right"
            >
              <Flexbox direction="col" gap="2" className="p-3">
                <PasteBulkButton
                  modalprops={{ cubeID: cube.id }}
                  className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                >
                  Paste Text
                </PasteBulkButton>
                <UploadBulkButton
                  modalprops={{ cubeID: cube.id }}
                  className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                >
                  Upload File
                </UploadBulkButton>
                <UploadBulkReplaceButton
                  modalprops={{ cubeID: cube.id }}
                  className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                >
                  Replace with CSV Upload
                </UploadBulkReplaceButton>
              </Flexbox>
            </Dropdown>
          </Flexbox>

          <Select
            label="Board"
            value={boardToEdit}
            setValue={(value) => setBoardToEdit(value as BoardType)}
            options={[
              { value: 'mainboard', label: 'Mainboard' },
              { value: 'maybeboard', label: 'Maybeboard' },
            ]}
          />

          <Flexbox direction="col" gap="2">
            <Text semibold sm>
              Add Card
            </Text>
            <AutocompleteInput
              treeUrl={specifyEdition ? '/cube/api/fullnames' : '/cube/api/cardnames'}
              treePath="cardnames"
              type="text"
              innerRef={addRef}
              name="add"
              value={addValue}
              setValue={setAddValue}
              onSubmit={(e, addCardValue) => handleAdd(e, addCardValue!)}
              placeholder="Card to Add"
              autoComplete="off"
              data-lpignore
              defaultPrinting={cube.defaultPrinting}
            />
            <Button color="primary" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)} block>
              Add
            </Button>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold sm>
              Remove/Replace Card
            </Text>
            <AutocompleteInput
              cubeId={cube.id}
              treeUrl={`/cube/api/cubecardnames/${cube.id}/${boardToEdit}`}
              treePath="cardnames"
              type="text"
              innerRef={removeRef}
              name="remove"
              value={removeValue}
              setValue={setRemoveValue}
              onSubmit={(e, removeCardValue) => handleRemoveReplace(e, removeCardValue!)}
              placeholder="Card to Remove"
              autoComplete="off"
              data-lpignore
            />
            <Button
              color="accent"
              disabled={removeValue.length === 0}
              onClick={(e) => handleRemoveReplace(e, removeValue)}
              block
            >
              Remove/Replace
            </Button>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Checkbox
              label="Specify Versions"
              checked={specifyEdition}
              setChecked={(value) => setSpecifyEdition(value)}
            />
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox label="Create Blog Post" checked={useBlog} setChecked={(value) => setUseBlog(value)} />
              <Tooltip text="The last checked status for 'Create Blog Post' will be remembered per Cube. The default can be set in your display preferences now.">
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
          </Flexbox>

          <Collapse
            isOpen={
              Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
                (c) => c.length > 0,
              ) ||
              Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
                (c) => c.length > 0,
              )
            }
          >
            <Flexbox direction="col" gap="3">
              <Changelist />

              {useBlog && (
                <Flexbox direction="col" gap="2">
                  <Input
                    label="Blog Post Title"
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    className="mb-2 !h-auto"
                  />
                  <TextEntry name="blog" value={postContent} setValue={setPostContent} maxLength={10000} rows={4} />
                </Flexbox>
              )}

              <Flexbox direction="row" gap="2">
                <LoadingButton color="primary" block onClick={submit} loading={loading} className="flex-1">
                  Save Changes
                </LoadingButton>
                <Button
                  color="danger"
                  block
                  onClick={() => {
                    clearChanges();
                    setPostTitle(DEFAULT_BLOG_TITLE);
                    setPostContent('');
                    setRightSidebarMode('none');
                  }}
                  className="flex-1"
                >
                  Discard All
                </Button>
              </Flexbox>
            </Flexbox>
          </Collapse>
        </Flexbox>
      ) : (
        // Horizontal layout for bottom card - completely redesigned
        <div className="w-full">
          {alerts.map(({ color, message }, index) => (
            <Alert key={index} color={color} className="mb-3">
              {message}
            </Alert>
          ))}

          {/* Board select - shown alone on md, hidden on lg+ */}
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Text semibold sm className="whitespace-nowrap">
              Board
            </Text>
            <Select
              value={boardToEdit}
              setValue={(value) => setBoardToEdit(value as BoardType)}
              options={[
                { value: 'mainboard', label: 'Mainboard' },
                { value: 'maybeboard', label: 'Maybeboard' },
              ]}
            />
          </div>

          {/* First Row: Board (lg+ only), Add Card, Remove/Replace Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Board - shown inline on lg+ */}
            <div className="hidden lg:flex items-center gap-2">
              <Text semibold sm className="whitespace-nowrap">
                Board
              </Text>
              <Select
                value={boardToEdit}
                setValue={(value) => setBoardToEdit(value as BoardType)}
                options={[
                  { value: 'mainboard', label: 'Mainboard' },
                  { value: 'maybeboard', label: 'Maybeboard' },
                ]}
              />
            </div>

            {/* Add Card */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <AutocompleteInput
                    treeUrl={specifyEdition ? '/cube/api/fullnames' : '/cube/api/cardnames'}
                    treePath="cardnames"
                    type="text"
                    innerRef={addRef}
                    name="add"
                    value={addValue}
                    setValue={setAddValue}
                    onSubmit={(e, addCardValue) => handleAdd(e, addCardValue!)}
                    placeholder="Card to Add"
                    autoComplete="off"
                    data-lpignore
                    defaultPrinting={cube.defaultPrinting}
                  />
                </div>
                <Button color="primary" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)}>
                  Add
                </Button>
              </div>
            </div>

            {/* Remove/Replace Card */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <AutocompleteInput
                    cubeId={cube.id}
                    treeUrl={`/cube/api/cubecardnames/${cube.id}/${boardToEdit}`}
                    treePath="cardnames"
                    type="text"
                    innerRef={removeRef}
                    name="remove"
                    value={removeValue}
                    setValue={setRemoveValue}
                    onSubmit={(e, removeCardValue) => handleRemoveReplace(e, removeCardValue!)}
                    placeholder="Card to Remove"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button
                  color="accent"
                  disabled={removeValue.length === 0}
                  onClick={(e) => handleRemoveReplace(e, removeValue)}
                >
                  Remove/Replace
                </Button>
              </div>
            </div>
          </div>

          {/* Second Row: Specify Versions, Create Blog Post, Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {/* Specify Versions */}
            <div className="flex items-center">
              <Checkbox
                label="Specify Versions"
                checked={specifyEdition}
                setChecked={(value) => setSpecifyEdition(value)}
              />
            </div>

            {/* Create Blog Post */}
            <div className="flex items-center gap-2">
              <Checkbox label="Create Blog Post" checked={useBlog} setChecked={(value) => setUseBlog(value)} />
              <Tooltip text="The last checked status for 'Create Blog Post' will be remembered per Cube. The default can be set in your display preferences now.">
                <QuestionIcon size={16} />
              </Tooltip>
            </div>

            {/* Import */}
            <div className="flex flex-col gap-2">
              <Dropdown
                trigger={
                  <Button color="secondary" block>
                    Import
                  </Button>
                }
                align="right"
              >
                <Flexbox direction="col" gap="2" className="p-3">
                  <PasteBulkButton
                    modalprops={{ cubeID: cube.id }}
                    className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                  >
                    Paste Text
                  </PasteBulkButton>
                  <UploadBulkButton
                    modalprops={{ cubeID: cube.id }}
                    className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                  >
                    Upload File
                  </UploadBulkButton>
                  <UploadBulkReplaceButton
                    modalprops={{ cubeID: cube.id }}
                    className="!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium"
                  >
                    Replace with CSV Upload
                  </UploadBulkReplaceButton>
                </Flexbox>
              </Dropdown>
            </div>
          </div>

          {/* Changelist and Blog - Side by Side on Wide Screens */}
          {(Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
            (c) => c.length > 0,
          ) ||
            Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
              (c) => c.length > 0,
            )) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Changelist */}
                <div>
                  <Changelist />
                </div>

                {/* Blog Post */}
                {useBlog && (
                  <div className="flex flex-col gap-4">
                    <Input
                      label="Blog Post Title"
                      type="text"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="mb-2 !h-auto"
                    />
                    <TextEntry name="blog" value={postContent} setValue={setPostContent} maxLength={10000} rows={4} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons - Full Width at Bottom */}
          {(Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
            (c) => c.length > 0,
          ) ||
            Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
              (c) => c.length > 0,
            )) && (
            <div className="mt-4 pt-4 border-t border-border flex gap-4">
              <LoadingButton color="primary" block onClick={submit} loading={loading} className="flex-1">
                Save Changes
              </LoadingButton>
              <Button
                color="danger"
                block
                onClick={() => {
                  clearChanges();
                  setPostTitle(DEFAULT_BLOG_TITLE);
                  setPostContent('');
                  setRightSidebarMode('none');
                }}
                className="flex-1"
              >
                Discard All
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CubeListEditSidebar;
