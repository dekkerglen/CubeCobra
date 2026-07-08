import React, { useCallback, useContext, useState } from 'react';

import { DefaultPrintingPreference, PrintingPreference } from '@utils/datatypes/Card';

import { CSRFContext } from '../../contexts/CSRFContext';
import { cardNameMatches } from '../../utils/cardAutocomplete';
import Alert, { UncontrolledAlertProps } from '../base/Alert';
import AutocompleteInput from '../base/AutocompleteInput';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Spinner from '../base/Spinner';
import Text from '../base/Text';
import { ColorChecksAddon } from '../ColorCheck';

interface SeedCrystalModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeId: string;
  defaultPrinting?: PrintingPreference | string;
  defaultCardCount?: number;
}

const MAX_CUBE_SIZE = 1000;

const SeedCrystalModal: React.FC<SeedCrystalModalProps> = ({
  isOpen,
  setOpen,
  cubeId,
  defaultPrinting,
  defaultCardCount = 180,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [cardName, setCardName] = useState('');
  const [cardCount, setCardCount] = useState<string>(String(defaultCardCount));
  const [printingPreference, setPrintingPreference] = useState<string>(
    (defaultPrinting as string) || DefaultPrintingPreference,
  );
  const [includeColors, setIncludeColors] = useState<string[]>(['W', 'U', 'B', 'R', 'G']);
  const [balanced, setBalanced] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);

  const handleSubmit = useCallback(async () => {
    setAlerts([]);

    const trimmedName = cardName.trim();
    if (!trimmedName) {
      setAlerts([{ color: 'danger', message: 'Please enter a seed card name.' }]);
      return;
    }

    const parsedCount = Math.min(Math.max(parseInt(cardCount, 10) || 0, 1), MAX_CUBE_SIZE);

    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/api/seedcrystal/${encodeURIComponent(cubeId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: trimmedName,
          cardCount: parsedCount,
          printingPreference,
          includeColors,
          balanced,
        }),
      });

      const json = await response.json();
      if (json.success !== 'true') {
        setAlerts([{ color: 'danger', message: json.message || 'Failed to grow cube from seed crystal.' }]);
        setLoading(false);
        return;
      }

      // Refresh the page to display the freshly built cube
      window.location.reload();
    } catch (err) {
      setAlerts([{ color: 'danger', message: (err as Error).message || 'Unexpected error.' }]);
      setLoading(false);
    }
  }, [balanced, cardCount, cardName, csrfFetch, cubeId, includeColors, printingPreference]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Grow a Cube from a Seed Crystal</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text sm>
            Pick a single card to seed your cube. We'll pull in everything synergistic with it and then use Smart Search
            to fill out the rest. Pick a small card count for a starting point you can curate, or crank it up for a
            complete cube right out of the gate.
          </Text>

          <div>
            <label className="block text-sm font-medium text-text mb-1" htmlFor="seedCrystalCard">
              Seed card
            </label>
            <AutocompleteInput
              id="seedCrystalCard"
              getMatches={cardNameMatches(false)}
              type="text"
              name="seedCrystalCard"
              value={cardName}
              setValue={setCardName}
              placeholder="e.g. Yawgmoth, Thran Physician"
              autoComplete="off"
              data-lpignore
            />
          </div>

          <Select
            label="Printing preference"
            value={printingPreference}
            setValue={setPrintingPreference}
            options={[
              { value: PrintingPreference.DEFAULT, label: 'Default printing' },
              { value: PrintingPreference.RECENT, label: 'Most recent printing' },
              { value: PrintingPreference.FIRST, label: 'First printing' },
              { value: PrintingPreference.CHEAPEST, label: 'Cheapest printing' },
            ]}
          />

          <Input
            label="Card count"
            type="number"
            value={cardCount}
            onChange={(e) => setCardCount(e.target.value)}
            otherInputProps={{ min: 1, max: MAX_CUBE_SIZE, step: 1 }}
          />

          <ColorChecksAddon label="Colors to include" values={includeColors} setValues={setIncludeColors} />
          <Text sm>The seed card's own colors all need to be included.</Text>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-primary-button mt-0.5 flex-shrink-0"
              checked={balanced}
              onChange={(e) => setBalanced(e.target.checked)}
            />
            <span className="text-text">
              Balance the cube — equal counts across each included color, colorless, multicolored, and lands.
            </span>
          </label>

          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color}>
              {message}
            </Alert>
          ))}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        {loading ? (
          <div className="text-center min-w-full">
            <Spinner />
          </div>
        ) : (
          <Flexbox direction="row" gap="2" className="w-full">
            <Button color="secondary" block onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" block onClick={handleSubmit} disabled={!cardName.trim()}>
              Grow Cube
            </Button>
          </Flexbox>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default SeedCrystalModal;
