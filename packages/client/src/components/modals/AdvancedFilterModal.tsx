import React, { ChangeEvent, useContext, useMemo } from 'react';

import Card, { DefaultElo, FilterValues, SUPPORTED_FORMATS } from '@utils/datatypes/Card';
import { getLabels } from '@utils/sorting/Sort';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { ColorChecksAddon } from 'components/ColorCheck';
import EnumFilterField from 'components/EnumFilterField';
import NumericField from 'components/NumericField';
import SelectField from 'components/SelectField';
import CubeContext from 'contexts/CubeContext';
import { cubeCardTagMatches } from 'utils/cardAutocomplete';

// Build dropdown options from a list of distinct label strings, dropping blanks.
const toOptions = (labels: string[]): { value: string; label: string }[] =>
  labels.filter((label) => label && label.trim().length > 0).map((label) => ({ value: label, label }));

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

  // Flatten every board of the current cube so we can gather the distinct set,
  // artist, and rarity values actually present in it. Empty when there is no
  // cube (e.g. the global card search), in which case the enum fields fall back
  // to free-text inputs.
  const cubeCards = useMemo<Card[]>(
    () => (cube?.cards ? (Object.values(cube.cards).flat().filter(Boolean) as Card[]) : []),
    [cube?.cards],
  );

  const setOptions = useMemo(() => toOptions(getLabels(cubeCards, 'Set', false)), [cubeCards]);
  const artistOptions = useMemo(() => toOptions(getLabels(cubeCards, 'Artist', false)), [cubeCards]);
  // Rarity is a small fixed enum, so it is always a dropdown, even without a cube.
  const rarityOptions = useMemo(
    () => getLabels(cubeCards, 'Rarity', false).map((rarity) => ({ value: rarity.toLowerCase(), label: rarity })),
    [cubeCards],
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg scrollable>
      <ModalHeader setOpen={setOpen}>Advanced Filters</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="2">
          <Text sm className="mb-2">
            Having trouble using filter syntax? Check out our{' '}
            <Link href="/wiki/reference/filter-syntax">syntax guide</Link>.
          </Text>
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
          <EnumFilterField
            name="set"
            label="Set"
            placeholder={'Any set code, e.g. "WAR"'}
            value={values.set}
            options={setOptions}
            setValue={(v: string) => updateValue(v, 'set')}
          />
          {cubeId && (
            <AutocompleteInput
              label="Tag"
              getMatches={cubeCardTagMatches(cubeId)}
              type="text"
              name="tag"
              value={values.tag ?? ''}
              setValue={(tag: string) => updateValue(tag, 'tag')}
              placeholder={'Any text, e.g. "Zombie Testing"'}
              autoComplete="off"
              data-lpignore
              className="tag-autocomplete-input"
              wrapperClassName="tag-autocomplete-wrapper"
              showImages={false}
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
                options={[{ value: '', label: 'Any' }].concat(
                  getLabels(null, 'Finish', false).map((status: string) => ({
                    value: status,
                    label: status,
                  })),
                )}
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
            placeholder={`Any integer number, e.g. "${DefaultElo}"`}
            value={values.elo}
            operator={values.eloOp}
            setValue={(value: string) => updateValue(value, 'elo')}
            setOperator={(operator: string) => updateValue(operator, 'eloOp')}
          />
          <NumericField
            name="edhrecRank"
            humanName="EDHREC Rank"
            placeholder={'Any integer number, e.g. "100"'}
            value={values.edhrecRank}
            operator={values.edhrecRankOp}
            setValue={(value: string) => updateValue(value, 'edhrecRank')}
            setOperator={(operator: string) => updateValue(operator, 'edhrecRankOp')}
          />
          <NumericField
            name="edhrecSalt"
            humanName="Salt"
            placeholder={'Any number, e.g. "1.5"'}
            value={values.edhrecSalt}
            operator={values.edhrecSaltOp}
            setValue={(value: string) => updateValue(value, 'edhrecSalt')}
            setOperator={(operator: string) => updateValue(operator, 'edhrecSaltOp')}
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
          <SelectField
            humanName="Rarity"
            value={values.rarity}
            operator={values.rarityOp}
            options={rarityOptions}
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
                ...[{ value: '', label: 'Any' }],
                ...SUPPORTED_FORMATS.map((item) => ({ value: item, label: item })),
              ]}
            />
          </Flexbox>
          <EnumFilterField
            name="artist"
            label="Artist"
            placeholder={'Any text, e.g. "seb"'}
            value={values.artist}
            options={artistOptions}
            setValue={(v: string) => updateValue(v, 'artist')}
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
