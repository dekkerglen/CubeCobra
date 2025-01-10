import React, { ChangeEvent, useContext } from 'react';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import { ColorChecksAddon } from 'components/ColorCheck';
import NumericField from 'components/NumericField';
import CubeContext from 'contexts/CubeContext';
import { FilterValues } from 'datatypes/CardDetails';

import { getLabels } from '../../utils/Sort';

export interface AdvancedFilterModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  values: Partial<FilterValues>;
  updateValue: (value: string | string[], key: keyof FilterValues) => void;
  apply: () => void;
}

const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({ isOpen, setOpen, values, updateValue, apply }) => {
  const { cube } = useContext(CubeContext) ?? {};
  const cubeId = cube ? cube.id : null;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>Advanced Filters</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Input
            name="name"
            label="Card name"
            placeholder={'Any words in the name, e.g. "Fire"'}
            value={values.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'name')}
          />
          <Input
            name="oracle"
            label="Oracle Text"
            placeholder={'Any text, e.g. "Draw a card"'}
            value={values.oracle}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'oracle')}
          />
          <NumericField
            name="mv"
            humanName="Mana Value"
            placeholder={'Any value, e.g. "2"'}
            value={values.mv}
            operator={values.mvOp}
            setValue={(value: string) => updateValue(value, 'mv')}
            setOperator={(operator: string) => updateValue(operator, 'mvOp')}
          />
          <Flexbox direction="row" gap="1" justify="start" alignItems="end">
            <Select
              label="Color"
              value={values.colorOp}
              setValue={(v: string) => updateValue(v, 'colorOp')}
              options={[
                { value: '=', label: 'Exactly these colors' },
                { value: '>=', label: 'Including these colors' },
                { value: '<=', label: 'At most these colors' },
              ]}
            />
            <ColorChecksAddon
              colorless
              values={values.color ?? []}
              setValues={(v: string[]) => updateValue(v, 'color')}
            />
          </Flexbox>
          <Flexbox direction="row" gap="1" justify="start" alignItems="end">
            <Select
              label="Color Identity"
              value={values.colorIdentityOp}
              setValue={(v: string) => updateValue(v, 'colorIdentityOp')}
              options={[
                { value: '=', label: 'Exactly these colors' },
                { value: '>=', label: 'Including these colors' },
                { value: '<=', label: 'At most these colors' },
              ]}
            />
            <ColorChecksAddon
              colorless
              values={values.colorIdentity ?? []}
              setValues={(v: string[]) => updateValue(v, 'colorIdentity')}
            />
          </Flexbox>
          <Input
            name="mana"
            label="Mana Cost"
            placeholder={'Any mana cost, e.g. "{1}{W}"'}
            value={values.mana}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'mana')}
          />
          <Select
            label="Manacost Type"
            value={values.is}
            setValue={(v: string) => updateValue(v, 'is')}
            options={[
              { value: '', label: 'Any' },
              { value: 'Gold', label: 'Gold' },
              { value: 'Hybrid', label: 'Hybrid' },
              { value: 'Phyrexian', label: 'Phyrexian' },
            ]}
          />
          <Input
            name="type"
            label="Type Line"
            placeholder="Choose any card type, supertype, or subtypes to match"
            value={values.type}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'type')}
          />
          <Input
            name="set"
            label="Set"
            placeholder={'Any set code, e.g. "WAR"'}
            value={values.set}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'set')}
          />
          {cubeId && (
            <AutocompleteInput
              label="Tag"
              treeUrl={`/cube/api/cubecardtags/${cubeId}`}
              treePath="tags"
              type="text"
              name="tag"
              value={values.tag ?? ''}
              setValue={(tag: string) => updateValue(tag, 'tag')}
              placeholder={'Any text, e.g. "Zombie Testing"'}
              autoComplete="off"
              data-lpignore
              className="tag-autocomplete-input"
              wrapperClassName="tag-autocomplete-wrapper"
            />
          )}
          <Row>
            <Col md={6}>
              <Select
                label="Status"
                value={values.status}
                setValue={(v: string) => updateValue(v, 'status')}
                options={[{ value: '', label: 'Any' }].concat(
                  getLabels(null, 'Status', false).map((status: string) => ({
                    value: status,
                    label: status,
                  })),
                )}
              />
            </Col>
            <Col md={6}>
              <Select
                label="Finish"
                value={values.finish}
                setValue={(v: string) => updateValue(v, 'finish')}
                options={[
                  { value: '', label: 'Any' },
                  { value: 'Foil', label: 'Foil' },
                  { value: 'Non-foil', label: 'Non-foil' },
                ]}
              />
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <NumericField
                name="price"
                humanName="Price USD"
                placeholder={'Any decimal number, e.g. "3.50"'}
                value={values.price}
                operator={values.priceOp}
                setValue={(value: string) => updateValue(value, 'price')}
                setOperator={(operator: string) => updateValue(operator, 'priceOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceFoil"
                humanName="Price USD Foil"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceFoil}
                operator={values.priceFoilOp}
                setValue={(value: string) => updateValue(value, 'priceFoil')}
                setOperator={(operator: string) => updateValue(operator, 'priceFoilOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceEur"
                humanName="Price EUR"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceEur}
                operator={values.priceEurOp}
                setValue={(value: string) => updateValue(value, 'priceEur')}
                setOperator={(operator: string) => updateValue(operator, 'priceEurOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceTix"
                humanName="MTGO TIX"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceTix}
                operator={values.priceTixOp}
                setValue={(value: string) => updateValue(value, 'priceTix')}
                setOperator={(operator: string) => updateValue(operator, 'priceTixOp')}
              />
            </Col>
          </Row>
          <NumericField
            name="elo"
            humanName="elo"
            placeholder={'Any integer number, e.g. "1200"'}
            value={values.elo}
            operator={values.eloOp}
            setValue={(value: string) => updateValue(value, 'elo')}
            setOperator={(operator: string) => updateValue(operator, 'eloOp')}
          />
          <NumericField
            name="power"
            humanName="Power"
            placeholder={'Any value, e.g. "2"'}
            value={values.power}
            operator={values.powerOp}
            setValue={(value: string) => updateValue(value, 'power')}
            setOperator={(operator: string) => updateValue(operator, 'powerOp')}
          />
          <NumericField
            name="toughness"
            humanName="Toughness"
            placeholder={'Any value, e.g. "2"'}
            value={values.toughness}
            operator={values.toughnessOp}
            setValue={(value: string) => updateValue(value, 'toughness')}
            setOperator={(operator: string) => updateValue(operator, 'toughnessOp')}
          />
          <NumericField
            name="loyalty"
            humanName="Loyalty"
            placeholder={'Any value, e.g. "3"'}
            value={values.loyalty}
            operator={values.loyaltyOp}
            setValue={(value: string) => updateValue(value, 'loyalty')}
            setOperator={(operator: string) => updateValue(operator, 'loyaltyOp')}
          />
          <NumericField
            name="rarity"
            humanName="Rarity"
            placeholder={'Any rarity, e.g. "common"'}
            value={values.rarity}
            operator={values.rarityOp}
            setValue={(value: string) => updateValue(value, 'rarity')}
            setOperator={(operator: string) => updateValue(operator, 'rarityOp')}
          />
          <Flexbox direction="row" gap="1" justify="start" alignItems="end">
            <Select
              label="Legality"
              value={values.legalityOp}
              setValue={(v: string) => updateValue(v, 'legalityOp')}
              options={[
                { value: '=', label: 'legal' },
                { value: '!=', label: 'not legal' },
              ]}
            />
            <Select
              value={values.legality}
              setValue={(v: string) => updateValue(v, 'legality')}
              options={[
                { value: '', label: 'Any' },
                { value: 'Standard', label: 'Standard' },
                { value: 'Pioneer', label: 'Pioneer' },
                { value: 'Modern', label: 'Modern' },
                { value: 'Legacy', label: 'Legacy' },
                { value: 'Vintage', label: 'Vintage' },
                { value: 'Brawl', label: 'Brawl' },
                { value: 'Historic', label: 'Historic' },
                { value: 'Pauper', label: 'Pauper' },
                { value: 'Penny', label: 'Penny' },
                { value: 'Commander', label: 'Commander' },
              ]}
            />
          </Flexbox>
          <Input
            name="artist"
            label="Artist"
            placeholder={'Any text, e.g. "seb"'}
            value={values.artist}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'artist')}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox gap="2" justify="between" className="w-full">
          <Button color="secondary" aria-label="Close" onClick={() => setOpen(false)} block>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={() => {
              setOpen(false);
              apply();
            }}
            block
          >
            Apply
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default AdvancedFilterModal;
