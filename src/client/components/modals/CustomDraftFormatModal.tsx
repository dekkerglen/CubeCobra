import React, { useContext, useMemo, useState } from 'react';

import { createDefaultDraftFormat, DEFAULT_PACK, DraftFormat, getErrorsInFormat } from '../../../datatypes/Draft';
import CubeContext from '../../contexts/CubeContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import RadioButtonGroup from '../base/RadioButtonGroup';
import Select from '../base/Select';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';
import CustomPackCard from '../CustomPackCard';
import TextEntry from '../TextEntry';

interface CustomDraftFormatModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  formatIndex: number;
}

const CustomDraftFormatModal: React.FC<CustomDraftFormatModalProps> = ({ isOpen, formatIndex, setOpen }) => {
  const { cube } = useContext(CubeContext);
  const [format, setFormat] = useState<DraftFormat>(
    formatIndex === -1 ? createDefaultDraftFormat(3, 15) : cube.formats[formatIndex],
  );
  const formRef = React.createRef<HTMLFormElement>();
  const errorsInFormat = useMemo(() => getErrorsInFormat(format), [format]);

  const formdata: Record<string, string> = useMemo(() => {
    return {
      id: `${formatIndex}`,
      serializedFormat: JSON.stringify(format),
    };
  }, [format, formatIndex]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>
        <Text lg semibold>
          Create Custom Draft Format
        </Text>
      </ModalHeader>
      <ModalBody>
        <CSRFForm method="POST" action={`/cube/format/add/${cube.id}`} formData={formdata} ref={formRef}>
          <Flexbox direction="col" gap="2">
            <Input
              label="Title"
              type="text"
              name="title"
              placeholder="title"
              value={format.title}
              onChange={(e) => setFormat({ ...format, title: e.target.value })}
            />
            <Select
              label="Default seat count"
              value={`${format.defaultSeats ?? 8}`}
              options={Array.from({ length: 15 }, (_, i) => i + 2).map((i) => ({ value: `${i}`, label: `${i}` }))}
              setValue={(value) => setFormat({ ...format, defaultSeats: parseInt(value, 10) })}
            />
            <RadioButtonGroup
              label="Multiples"
              selected={format.multiples ? 'true' : 'false'}
              setSelected={(value) => setFormat({ ...format, multiples: value === 'true' })}
              allowOptionTextWrapping={true}
              options={[
                { value: 'true', label: 'Allow any number of copies of each card in the draft (e.g. set draft)' },
                {
                  value: 'false',
                  label: 'Only allow the number of copies of each card that are in the cube in the draft.',
                },
              ]}
            />
            <Text md semibold>
              Description
            </Text>
            <TextEntry
              name="markdown"
              value={format.markdown ?? format.html ?? ''}
              setValue={(value) => setFormat({ ...format, markdown: value })}
              maxLength={5000}
            />
            <Text>
              Card values can either be single tags or filter parameters or a comma separated list to create a ratio
              (e.g. 3:1 rare to mythic could be <code>rarity:rare, rarity:rare, rarity:rare, rarity:mythic</code>). Tags
              can be specified <code>tag:yourtagname</code> or simply <code>yourtagname</code>. <code>*</code> can be
              used to match any card. Space separated filters act as an AND, eg <code>set:inv r:common</code> matches a
              card from the Invasion set AND is a common. Free slots, those either <code>*</code> or empty, will be
              processed after all other slots are filled (across all packs), to ensure that they don't use up cards such
              that a filtered slot fails to match any remaining card.
            </Text>
            {(format.packs ?? []).map((pack, packIndex) => (
              <CustomPackCard
                key={packIndex}
                packIndex={packIndex}
                setPack={(newPack) =>
                  setFormat({
                    ...format,
                    packs: format.packs.map((p, i) => (i === packIndex ? newPack : p)),
                  })
                }
                removePack={() =>
                  setFormat({
                    ...format,
                    packs: format.packs.filter((_, i) => i !== packIndex),
                  })
                }
                copyPack={() =>
                  setFormat({
                    ...format,
                    packs: format.packs
                      .slice(0, packIndex + 1)
                      .concat(format.packs[packIndex])
                      .concat(format.packs.slice(packIndex + 1)),
                  })
                }
                canRemove={format.packs.length > 1}
                pack={pack}
              />
            ))}
            <Button
              color="accent"
              onClick={() => setFormat({ ...format, packs: [...(format.packs ?? []), DEFAULT_PACK] })}
            >
              Add Pack
            </Button>
          </Flexbox>
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="col" gap="2" className="w-full">
          {errorsInFormat &&
            errorsInFormat.map((error, errorIndex) => (
              <Alert key={errorIndex} color="danger">
                {error}
              </Alert>
            ))}
          <Flexbox direction="row" gap="2">
            <Button block color="primary" disabled={!!errorsInFormat} onClick={() => formRef.current?.submit()}>
              Save
            </Button>
            <Button block color="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CustomDraftFormatModal;
