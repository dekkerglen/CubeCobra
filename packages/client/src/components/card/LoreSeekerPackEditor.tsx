import React, { useMemo } from 'react';

import { CardSlot, Pack } from '@utils/datatypes/Draft';
import { getErrorsInFormat } from '@utils/draftutil';

import Alert from '../base/Alert';
import { Flexbox } from '../base/Layout';
import Select from '../base/Select';
import CustomPackCard from '../CustomPackCard';

interface LoreSeekerPackEditorProps {
  // null (cleared by an edit) and undefined both mean the draft format's first pack.
  pack: Pack | null | undefined;
  setPack: (pack: Pack | null) => void;
  disabled?: boolean;
}

// A new custom pack starts as a standard 15-card booster.
const newPack = (): Pack => ({
  slots: Array.from({ length: 15 }, (): CardSlot => ({ filter: '*' })),
  steps: null,
});

const LoreSeekerPackEditor: React.FC<LoreSeekerPackEditorProps> = ({ pack, setPack, disabled = false }) => {
  const errors = useMemo(
    () => (pack && getErrorsInFormat({ title: 'Lore Seeker', packs: [pack], multiples: false, defaultSeats: 8 })) || [],
    [pack],
  );

  return (
    <Flexbox direction="col" gap="2" className="mt-3">
      <Select
        label="Lore Seeker pack"
        value={pack ? 'custom' : 'default'}
        setValue={(value) => setPack(value === 'custom' ? (pack ?? newPack()) : null)}
        options={[
          { value: 'default', label: 'Default' },
          { value: 'custom', label: 'Custom' },
        ]}
        disabled={disabled}
      />
      {pack && (
        <>
          {errors.length > 0 && (
            <Alert color="danger">
              {errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </Alert>
          )}
          {/* CustomPackCard has no disabled state; the fieldset disables every control inside it. */}
          <fieldset disabled={disabled} className="min-w-0">
            <CustomPackCard
              packIndex={0}
              title="Lore Seeker pack"
              pack={pack}
              canRemove={false}
              setPack={setPack}
              removePack={() => {}}
            />
          </fieldset>
        </>
      )}
    </Flexbox>
  );
};

export default LoreSeekerPackEditor;
