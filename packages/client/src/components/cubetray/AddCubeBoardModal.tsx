import React, { useContext, useEffect, useMemo, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
import { CARD_STATUSES } from '@utils/datatypes/Card';
import Cube, { boardNameToKey, getBoardDefinitions } from '@utils/datatypes/Cube';
import TagData from '@utils/datatypes/TagData';

import { CSRFContext } from '../../contexts/CSRFContext';
import { CubeBoardCombo, useCubeTray } from '../../contexts/CubeTrayContext';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import Collapse from '../base/Collapse';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Spinner from '../base/Spinner';
import Text from '../base/Text';
import TextArea from '../base/TextArea';
import TagInput from '../TagInput';

interface AddCubeBoardModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

interface BoardOption {
  value: string;
  label: string;
}

// Stable identity so the board-validity effect doesn't churn every render.
const DEFAULT_BOARD_OPTIONS: BoardOption[] = [
  { value: 'mainboard', label: 'Mainboard' },
  { value: 'maybeboard', label: 'Maybeboard' },
];

// The empty first option is the default — cards keep the cube's normal status.
const STATUS_OPTIONS: BoardOption[] = [
  { value: '', label: 'No status (default)' },
  ...CARD_STATUSES.map((status) => ({ value: status, label: status })),
];

const AddCubeBoardModal: React.FC<AddCubeBoardModalProps> = ({ isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const tray = useCubeTray();

  const [cubes, setCubes] = useState<Cube[]>([]);
  const [cubesLoaded, setCubesLoaded] = useState(false);
  const [cubesLoading, setCubesLoading] = useState(false);
  const [selectedCube, setSelectedCube] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('mainboard');
  // Real boards per cube, fetched lazily from cubeJSON and cached so switching
  // back to an already-seen cube is instant. mycubes has no card data, so it
  // can't tell us the boards on its own.
  const [boardsByCube, setBoardsByCube] = useState<Record<string, BoardOption[]>>({});
  const [boardsLoading, setBoardsLoading] = useState(false);

  // Advanced defaults applied to cards dropped on this board. Empty by default.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Start each new "add" from a clean slate.
  useEffect(() => {
    if (isOpen) {
      setAdvancedOpen(false);
      setNotes('');
      setStatus('');
      setTags([]);
    }
  }, [isOpen]);

  // Lazy-load the user's cubes the first time the modal opens. `cubesLoaded` is
  // the only guard (see AddToCubeModal for why loading state must not gate this).
  useEffect(() => {
    if (!isOpen || cubesLoaded || !user) return;
    let cancelled = false;
    (async () => {
      setCubesLoading(true);
      try {
        const res = await csrfFetch('/cube/api/mycubes');
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          if (json.success === 'true' && Array.isArray(json.cubes)) {
            setCubes(json.cubes as Cube[]);
            setCubesLoaded(true);
          }
        }
      } catch {
        // best-effort; an empty list renders the "no cubes" state
      } finally {
        if (!cancelled) setCubesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, cubesLoaded, user, csrfFetch]);

  // Default the cube selection once cubes are available.
  useEffect(() => {
    if (cubes.length === 0) return;
    setSelectedCube((prev) => (prev && cubes.some((c) => c.id === prev) ? prev : cubes[0].id));
  }, [cubes]);

  // Fetch the selected cube's actual boards (mainboard/maybeboard plus any
  // custom boards) the first time it's selected.
  useEffect(() => {
    if (!selectedCube || boardsByCube[selectedCube]) return;
    const cube = cubes.find((c) => c.id === selectedCube);
    if (!cube) return;
    let cancelled = false;
    (async () => {
      setBoardsLoading(true);
      try {
        const res = await csrfFetch(`/cube/api/cubeJSON/${encodeURIComponent(selectedCube)}`);
        if (cancelled) return;
        let options: BoardOption[] | undefined;
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          options = getBoardDefinitions(cube, json?.cards).map((board) => ({
            value: boardNameToKey(board.name),
            label: board.name,
          }));
        }
        setBoardsByCube((prev) => ({
          ...prev,
          [selectedCube]: options && options.length > 0 ? options : DEFAULT_BOARD_OPTIONS,
        }));
      } catch {
        setBoardsByCube((prev) => ({ ...prev, [selectedCube]: DEFAULT_BOARD_OPTIONS }));
      } finally {
        if (!cancelled) setBoardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCube, cubes, boardsByCube, csrfFetch]);

  const boardOptions = useMemo(() => boardsByCube[selectedCube] || DEFAULT_BOARD_OPTIONS, [boardsByCube, selectedCube]);

  // Keep the selected board valid for the chosen cube.
  useEffect(() => {
    if (boardOptions.length === 0) return;
    setSelectedBoard((prev) => (boardOptions.some((b) => b.value === prev) ? prev : boardOptions[0].value));
  }, [boardOptions]);

  const save = () => {
    const cube = cubes.find((c) => c.id === selectedCube);
    const board = boardOptions.find((b) => b.value === selectedBoard) || boardOptions[0];
    if (!cube || !board) return;
    const combo: CubeBoardCombo = {
      cubeId: cube.id,
      cubeName: cube.name,
      boardKey: board.value,
      boardLabel: board.label,
    };
    const trimmedNotes = notes.trim();
    if (trimmedNotes) combo.notes = trimmedNotes;
    if (status) combo.status = status;
    if (tags.length > 0) combo.tags = tags;
    tray?.addCombo(combo);
    setOpen(false);
  };

  if (user && (cubesLoading || !cubesLoaded)) {
    return (
      <Modal isOpen={isOpen} setOpen={setOpen} sm>
        <ModalHeader setOpen={setOpen}>Add Cube Board</ModalHeader>
        <ModalBody className="centered">
          <Flexbox direction="col" alignItems="center" gap="2" className="py-6">
            <Spinner lg />
          </Flexbox>
        </ModalBody>
      </Modal>
    );
  }

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} setOpen={setOpen} sm>
        <ModalHeader setOpen={setOpen}>Add Cube Board</ModalHeader>
        <ModalBody>
          <Text>You don't appear to have any cubes. Are you logged in?</Text>
        </ModalBody>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm scrollable>
      <ModalHeader setOpen={setOpen}>Add Cube Board</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="3">
          <Select
            label="Cube"
            options={cubes.map((cube) => ({ value: cube.id, label: cube.name }))}
            value={selectedCube}
            setValue={setSelectedCube}
          />
          <Select
            label="Board"
            options={boardOptions}
            value={selectedBoard}
            setValue={setSelectedBoard}
            loading={boardsLoading && !boardsByCube[selectedCube]}
          />

          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="flex w-full items-center justify-between py-1 text-text"
            >
              <Text semibold sm>
                Advanced
              </Text>
              {advancedOpen ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
            </button>
            <Collapse isOpen={advancedOpen} className="transition-all duration-300">
              <Flexbox direction="col" gap="3" className="pt-2">
                <Text sm className="text-text-secondary">
                  Set defaults that get applied to every card you drop on this board — a status, a note, or one or more
                  tags.
                </Text>
                <Select label="Status" options={STATUS_OPTIONS} value={status} setValue={setStatus} />
                <TextArea
                  label="Notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Optional note added to each card"
                />
                <TagInput
                  label="Tags"
                  tags={tags.map((tag): TagData => ({ text: tag, id: tag }))}
                  addTag={(tag: TagData) => {
                    if (tag.text && !tags.includes(tag.text)) setTags([...tags, tag.text]);
                  }}
                  deleteTag={(index: number) => setTags(tags.filter((_, i) => i !== index))}
                />
              </Flexbox>
            </Collapse>
          </div>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button block color="primary" onClick={save}>
          Add to Tray
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddCubeBoardModal;
