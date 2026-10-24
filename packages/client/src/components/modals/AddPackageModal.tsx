import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AlertIcon } from '@primer/octicons-react';
import Card, { BoardType, DefaultPrintingPreference, isPrintingPreference } from '@utils/datatypes/Card';
import CardPackage from '@utils/datatypes/CardPackage';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import usePackageAddOptions from 'hooks/usePackageAddOptions';
import { trackEvent } from 'utils/analytics';
import { getCards } from 'utils/cards/getCards';

const LIMIT = 100;

interface AddPackageModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  boardToEdit: BoardType;
}

const packageOptions = (packages: CardPackage[]) => [
  { value: '', label: 'Select a package…' },
  ...packages.map((p) => ({ value: p.id, label: `${p.title} (${p.cards.length})` })),
];

const AddPackageModal: React.FC<AddPackageModalProps> = ({ isOpen, setOpen, boardToEdit }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const { cube, bulkAddCard } = useContext(CubeContext)!;

  const [myPackages, setMyPackages] = useState<CardPackage[]>([]);
  const [likedPackages, setLikedPackages] = useState<CardPackage[]>([]);
  const [myHasMore, setMyHasMore] = useState(false);
  const [likedHasMore, setLikedHasMore] = useState(false);
  const [selectedMy, setSelectedMy] = useState('');
  const [selectedLiked, setSelectedLiked] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { autoTag, setAutoTag, useDefaultPrinting, setUseDefaultPrinting } = usePackageAddOptions();

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [myRes, likedRes] = await Promise.all([
          csrfFetch('/user/getmorepackages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner: user.id, lastKey: null, limit: LIMIT }),
          }),
          csrfFetch('/packages/liked/getmore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner: user.id, sort: 'date', ascending: 'false', lastKey: null, limit: LIMIT }),
          }),
        ]);

        if (cancelled) return;

        const myJson = myRes.ok ? await myRes.json() : { packages: [] };
        const likedJson = likedRes.ok ? await likedRes.json() : { packages: [] };

        const myAll: CardPackage[] = myJson.packages || [];
        const likedAll: CardPackage[] = likedJson.packages || [];

        setMyPackages(myAll.slice(0, LIMIT));
        setMyHasMore(myAll.length > LIMIT || !!myJson.lastKey);
        setLikedPackages(likedAll.slice(0, LIMIT));
        setLikedHasMore(likedAll.length > LIMIT || !!likedJson.lastKey);
      } catch (_err) {
        if (!cancelled) setError('Failed to load packages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user, csrfFetch]);

  const selectedPackage = useMemo(() => {
    if (selectedMy) return myPackages.find((p) => p.id === selectedMy);
    if (selectedLiked) return likedPackages.find((p) => p.id === selectedLiked);
    return undefined;
  }, [selectedMy, selectedLiked, myPackages, likedPackages]);

  const reset = useCallback(() => {
    setSelectedMy('');
    setSelectedLiked('');
  }, []);

  const handleAdd = useCallback(async () => {
    if (!selectedPackage) return;
    const tmsp = Date.now().toString();
    const packageCards = selectedPackage.cards.filter((card) => !!card?.scryfall_id);

    // The cube's preference wins over the printing the package stored, but only for
    // cards it can resolve — anything else keeps the package's own printing.
    let preferredIds: (string | undefined)[] = [];
    if (useDefaultPrinting && packageCards.length > 0) {
      const printingPreference = isPrintingPreference(cube.defaultPrinting)
        ? cube.defaultPrinting
        : DefaultPrintingPreference;
      const resolved = await getCards(
        csrfFetch,
        printingPreference,
        packageCards.map((card) => card.name),
      );
      preferredIds = resolved.map((card) => card?.scryfall_id);
    }

    const cards: Card[] = packageCards.map((card, index) => ({
      cardID: preferredIds[index] ?? card.scryfall_id,
      addedTmsp: tmsp,
      status: cube.defaultStatus,
      tags: autoTag ? [selectedPackage.title] : [],
    }));
    await bulkAddCard(cards, boardToEdit);
    trackEvent('cube_card_add', { method: 'package', count: cards.length, board: boardToEdit });
    reset();
    setOpen(false);
  }, [
    selectedPackage,
    useDefaultPrinting,
    csrfFetch,
    cube.defaultPrinting,
    cube.defaultStatus,
    autoTag,
    bulkAddCard,
    boardToEdit,
    reset,
    setOpen,
  ]);

  if (!user) {
    return null;
  }

  const hasMy = myPackages.length > 0;
  const hasLiked = likedPackages.length > 0;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Add Package</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text>
            Pick a package to add its cards to your current changelist, or <Link href="/packages">browse packages</Link>{' '}
            to find more.
          </Text>

          {error && (
            <Alert color="danger">
              <Flexbox direction="row" gap="2" alignItems="center">
                <AlertIcon size={16} />
                <Text sm>{error}</Text>
              </Flexbox>
            </Alert>
          )}

          {loading && (
            <Text sm className="text-text-secondary">
              Loading packages…
            </Text>
          )}

          {hasMy && (
            <Select
              label="My Packages"
              link={myHasMore ? { href: `/user/packages/${user.id}`, text: 'View all' } : undefined}
              options={packageOptions(myPackages)}
              value={selectedMy}
              setValue={(v) => {
                setSelectedMy(v);
                if (v) setSelectedLiked('');
              }}
            />
          )}

          {hasLiked && (
            <Select
              label="My Liked Packages"
              link={likedHasMore ? { href: `/packages/liked/${user.id}`, text: 'View all' } : undefined}
              options={packageOptions(likedPackages)}
              value={selectedLiked}
              setValue={(v) => {
                setSelectedLiked(v);
                if (v) setSelectedMy('');
              }}
            />
          )}

          {selectedPackage && (
            <Text sm className="text-text-secondary">
              Will add {selectedPackage.cards.length} card{selectedPackage.cards.length === 1 ? '' : 's'} from "
              {selectedPackage.title}" to the {boardToEdit}.
            </Text>
          )}

          <Checkbox label="Tag cards with package name" checked={autoTag} setChecked={setAutoTag} />
          <Checkbox
            label="Use the cube's default printing"
            checked={useDefaultPrinting}
            setChecked={setUseDefaultPrinting}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button color="primary" disabled={!selectedPackage || loading} block onClick={handleAdd}>
            Add Cards
          </Button>
          <Button color="secondary" onClick={() => setOpen(false)} block>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default AddPackageModal;
