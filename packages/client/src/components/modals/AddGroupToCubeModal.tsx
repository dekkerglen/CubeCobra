import React, { useCallback, useContext, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import CubePropType from '@utils/datatypes/Cube';

import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import Alert from '../base/Alert';
import Button from '../base/Button';
import CardList from '../base/CardList';
import Checkbox from '../base/Checkbox';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import LoadingButton from '../LoadingButton';

export interface AddGroupToCubeModalProps {
  cards: CardDetails[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubes: CubePropType[];
  packid?: string;
  voters?: string[];
}

interface AlertProps {
  color: string;
  message: string;
}

const AddGroupToCubeModal: React.FC<AddGroupToCubeModalProps> = ({
  cards,
  isOpen,
  setOpen,
  cubes,
  packid = null,
  voters = [],
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const [selectedCube, setSelectedCube] = useState<string | null>(cubes && cubes.length > 0 ? cubes[0].id : null);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);
  const [board, setBoard] = useState<'mainboard' | 'maybeboard'>('mainboard');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [upvotePackage, setUpvotePackage] = useState(true);
  const [autoTag, setAutoTag] = useLocalStorage<boolean>('addGroupToCubeAutoTag', true);
  const [createBlogPost, setCreateBlogPost] = useLocalStorage<boolean>('addGroupToCubeCreateBlogPost', true);

  const add = useCallback(async () => {
    setLoadingSubmit(true);
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          cards: cards.map((card) => card.scryfall_id),
          packid,
          board,
          autoTag,
          createBlogPost,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          // If user wants to upvote and hasn't already, upvote the package
          if (upvotePackage && packid && user && !voters.includes(user.id)) {
            await csrfFetch(`/packages/upvote/${packid}`);
          }
          setOpen(false);
        }
      } else {
        setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
      }
    } catch {
      setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
    }
    setLoadingSubmit(false);
  }, [
    csrfFetch,
    selectedCube,
    cards,
    packid,
    board,
    alerts,
    setOpen,
    upvotePackage,
    user,
    voters,
    autoTag,
    createBlogPost,
  ]);

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} setOpen={setOpen} sm>
        <ModalHeader setOpen={setOpen}>Add Package to Cube</ModalHeader>
        <ModalBody>
          <CardList cards={cards.map(detailsToCard)} />
          <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
        </ModalBody>
        <ModalFooter>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Add Package to Cube</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color} className="mt-2">
              {message}
            </Alert>
          ))}
          <CardList cards={cards.map(detailsToCard)} />
          <Select
            label="Cube"
            value={selectedCube ?? ''}
            setValue={(value) => setSelectedCube(value)}
            options={cubes.map((cube) => ({ value: cube.id, label: cube.name }))}
          />
          <Select
            label="Board"
            value={board}
            setValue={(value) => setBoard(value as 'mainboard' | 'maybeboard')}
            options={[
              { value: 'mainboard', label: 'Mainboard' },
              { value: 'maybeboard', label: 'Maybeboard' },
            ]}
          />
          {packid && (
            <>
              <Checkbox label="Autotag new cards with package name" checked={autoTag} setChecked={setAutoTag} />
              <Checkbox label="Create blog post" checked={createBlogPost} setChecked={setCreateBlogPost} />
            </>
          )}
          {packid && user && !voters.includes(user.id) && (
            <Checkbox label="+1 this package" checked={upvotePackage} setChecked={setUpvotePackage} />
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <LoadingButton block loading={loadingSubmit} color="primary" onClick={() => add()}>
            Add
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default AddGroupToCubeModal;
