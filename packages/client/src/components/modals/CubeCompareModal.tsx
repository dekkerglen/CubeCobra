import React, { useContext, useEffect, useState } from 'react';

import CubeType from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext from '../../contexts/CubeContext';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Spinner from '../base/Spinner';
import { TabbedView } from '../base/Tabs';
import Text from '../base/Text';

interface CubeCompareModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

type CubeOption = Pick<CubeType, 'id' | 'shortId' | 'name'>;

const CubeCompareModal: React.FC<CubeCompareModalProps> = ({ isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { cube } = useContext(CubeContext);
  const user: User | null = useContext(UserContext);

  const [activeTab, setActiveTab] = useState(0);

  // Tab 0: free-text cube ID / URL.
  const [compareID, setCompareID] = useState('');

  // Tab 1: the user's own cubes.
  const [myCubes, setMyCubes] = useState<CubeOption[]>([]);
  const [myCubesLoaded, setMyCubesLoaded] = useState(false);
  const [myCubesLoading, setMyCubesLoading] = useState(false);
  const [selectedMyCube, setSelectedMyCube] = useState('');

  // Tab 2: cubes the user follows.
  const [followedCubes, setFollowedCubes] = useState<CubeOption[]>([]);
  const [followedCubesLoaded, setFollowedCubesLoaded] = useState(false);
  const [followedCubesLoading, setFollowedCubesLoading] = useState(false);
  const [selectedFollowedCube, setSelectedFollowedCube] = useState('');

  // Lazily fetch a cube list the first time its tab is shown. `*Loaded` is the
  // only guard; `*Loading` deliberately stays out of the deps (see AddToCubeModal
  // for why including it would leave the spinner stuck).
  const loadCubes = (
    endpoint: string,
    loaded: boolean,
    setList: (cubes: CubeOption[]) => void,
    setLoaded: (loaded: boolean) => void,
    setLoading: (loading: boolean) => void,
  ) => {
    if (!isOpen || loaded || !user) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await csrfFetch(endpoint);
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          if (json.success === 'true' && Array.isArray(json.cubes)) {
            // Exclude the current cube; comparing a cube to itself is pointless.
            setList((json.cubes as CubeOption[]).filter((c) => c.id !== cube.id));
            setLoaded(true);
          }
        }
      } catch {
        // best-effort; an empty list renders the "no cubes" state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (activeTab !== 1) return undefined;
    return loadCubes('/cube/api/mycubes', myCubesLoaded, setMyCubes, setMyCubesLoaded, setMyCubesLoading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, myCubesLoaded, user]);

  useEffect(() => {
    if (activeTab !== 2) return undefined;
    return loadCubes(
      '/cube/api/followedcubes',
      followedCubesLoaded,
      setFollowedCubes,
      setFollowedCubesLoaded,
      setFollowedCubesLoading,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, followedCubesLoaded, user]);

  // Default the dropdown selections to the first available cube.
  useEffect(() => {
    if (myCubes.length === 0) return;
    setSelectedMyCube((prev) => (prev && myCubes.some((c) => c.id === prev) ? prev : myCubes[0].id));
  }, [myCubes]);

  useEffect(() => {
    if (followedCubes.length === 0) return;
    setSelectedFollowedCube((prev) =>
      prev && followedCubes.some((c) => c.id === prev) ? prev : followedCubes[0].id,
    );
  }, [followedCubes]);

  const handleCompare = (targetId: string) => {
    if (targetId) {
      window.location.href = `/cube/compare/${cube.id}/to/${targetId}`;
    }
  };

  // For the free-text tab, extract the Cube ID from the input, accounting for
  // possible URL formats.
  const parsedCompareID = (() => {
    const [input] =
      compareID
        .split('?')[0]
        .trim()
        .match(/[^/]+(?=\/$|$)/) || [];
    return input || '';
  })();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && parsedCompareID) {
      handleCompare(parsedCompareID);
    }
  };

  const renderCubeList = (
    cubes: CubeOption[],
    loading: boolean,
    selected: string,
    setSelected: (value: string) => void,
    emptyMessage: string,
  ) => {
    if (!user) {
      return (
        <Text>
          You must be <Link href="/user/login">logged in</Link> to use this.
        </Text>
      );
    }
    if (loading) {
      return (
        <Flexbox direction="row" justify="center" className="w-full py-2">
          <Spinner />
        </Flexbox>
      );
    }
    if (cubes.length === 0) {
      return <Text>{emptyMessage}</Text>;
    }
    return (
      <Select
        label="Cube"
        options={cubes.map((c) => ({ value: c.id, label: c.name }))}
        value={selected}
        setValue={setSelected}
      />
    );
  };

  // The cube id targeted by the currently active tab.
  const targetId = activeTab === 1 ? selectedMyCube : activeTab === 2 ? selectedFollowedCube : parsedCompareID;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Compare Cubes</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text>Choose the cube you want to compare with {cube.name}.</Text>
          <TabbedView
            activeTab={activeTab}
            tabs={[
              {
                label: 'Cube ID',
                onClick: () => setActiveTab(0),
                content: (
                  <Flexbox direction="col" gap="2" className="pt-2">
                    <Input
                      label="Comparison Cube ID"
                      type="text"
                      placeholder="Enter Cube ID"
                      value={compareID}
                      onChange={(e) => setCompareID(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Flexbox>
                ),
              },
              {
                label: 'Your Cubes',
                onClick: () => setActiveTab(1),
                content: (
                  <div className="pt-2">
                    {renderCubeList(
                      myCubes,
                      myCubesLoading,
                      selectedMyCube,
                      setSelectedMyCube,
                      'You have no other cubes to compare with.',
                    )}
                  </div>
                ),
              },
              {
                label: 'Followed Cubes',
                onClick: () => setActiveTab(2),
                content: (
                  <div className="pt-2">
                    {renderCubeList(
                      followedCubes,
                      followedCubesLoading,
                      selectedFollowedCube,
                      setSelectedFollowedCube,
                      "You aren't following any cubes to compare with.",
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button block color="primary" onClick={() => handleCompare(targetId)} disabled={!targetId}>
            Compare
          </Button>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CubeCompareModal;
