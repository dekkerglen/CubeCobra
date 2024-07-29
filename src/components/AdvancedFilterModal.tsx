import React, { ChangeEvent, useContext } from 'react';
import { ColorChecksAddon } from 'components/ColorCheck';
import TextField from 'components/TextField';
import NumericField from 'components/NumericField';
import AutocompleteInput from 'components/AutocompleteInput';
import CubeContext from 'contexts/CubeContext';
import {
  Button,
  Col,
  Row,
  Form,
  Input,
  InputGroup,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';

export interface AdvancedFilterModalProps {
  isOpen: boolean;
  toggle: () => void;
  values: {
    name: string;
    tag: string;
    status: string;
    finish: string;
    price: number;
    oracle: string;
    cmc: number;
    cmcOp: string;
    colorOp: string;
    color: string[];
    type: string;
    colorIdentity: string;
    colorIdentityOp: string;
    mana: string;
    manaOp: string;
    is: string;
    set: string;
    priceOp: string;
    priceFoil: number;
    priceFoilOp: string;
    priceEur: number;
    priceEurOp: string;
    priceTix: number;
    priceTixOp: string;
    elo: number;
    eloOp: string;
    power: number;
    powerOp: string;
    toughness: number;
    toughnessOp: string;
    loyalty: number;
    loyaltyOp: string;
    rarity: string;
    rarityOp: string;
    legality: string;
    legalityOp: string;
    artist: string;
  };
  updateValue: <T>(value: T, key: string) => void;
  apply: () => void;
}

const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({ isOpen, toggle, values, updateValue, apply }) => {
  const { cube } = useContext(CubeContext) ?? {};
  const cubeId = cube ? cube.id : null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <ModalHeader toggle={toggle}>Advanced Filters</ModalHeader>
        <ModalBody>
          <TextField
            name="name"
            humanName="Card name"
            placeholder={'Any words in the name, e.g. "Fire"'}
            value={values.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'name')}
          />
          <TextField
            name="oracle"
            humanName="oracle Text"
            placeholder={'Any text, e.g. "Draw a card"'}
            value={values.oracle}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'oracle')}
          />
          <NumericField
            name="mv"
            humanName="Mana Value"
            placeholder={'Any value, e.g. "2"'}
            value={values.cmc}
            operator={values.cmcOp}
            setValue={(value: number) => updateValue(value, 'cmc')}
            setOperator={(operator: string) => updateValue(operator, 'cmcOp')}
          />
          <InputGroup className="mb-3">
            <InputGroupText>Color</InputGroupText>
            <ColorChecksAddon colorless values={values.color} setValues={(v: string[]) => updateValue(v, 'color')} />
            <Input
              type="select"
              id="colorOp"
              name="colorOp"
              value={values.colorOp}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'colorOp')}
            >
              <option value="=">Exactly these colors</option>
              <option value=">=">Including these colors</option>
              <option value="<=">At most these colors</option>
            </Input>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupText>Color Identity</InputGroupText>
            <ColorChecksAddon
              colorless
              values={values.colorIdentity}
              setValues={(v: string[]) => updateValue(v, 'colorIdentity')}
            />
            <Input
              type="select"
              id="identityOp"
              name="identityOp"
              value={values.colorIdentityOp}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'colorIdentityOp')}
            >
              <option value="=">Exactly these colors</option>
              <option value=">=">Including these colors</option>
              <option value="<=">At most these colors</option>
            </Input>
          </InputGroup>
          <TextField
            name="mana"
            humanName="Mana Cost"
            placeholder={'Any mana cost, e.g. "{1}{W}"'}
            value={values.mana}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'mana')}
          />
          <InputGroup className="mb-3">
            <InputGroupText>Manacost Type</InputGroupText>
            <Input
              type="select"
              name="is"
              value={values.is}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'is')}
            >
              {['', 'Gold', 'Hybrid', 'Phyrexian'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Input>
          </InputGroup>
          <TextField
            name="type"
            humanName="Type Line"
            placeholder="Choose any card type, supertype, or subtypes to match"
            value={values.type}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'type')}
          />
          <TextField
            name="set"
            humanName="Set"
            placeholder={'Any set code, e.g. "WAR"'}
            value={values.set}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'set')}
          />
          {cubeId && (
            <InputGroup className="mb-3">
              <InputGroupText>Tag</InputGroupText>
              <AutocompleteInput
                treeUrl={`/cube/api/cubecardtags/${cubeId}`}
                treePath="tags"
                type="text"
                name="tag"
                value={values.tag}
                setValue={(tag: string) => updateValue(tag, 'tag')}
                placeholder={'Any text, e.g. "Zombie Testing"'}
                autoComplete="off"
                data-lpignore
                className="tag-autocomplete-input"
                wrapperClassName="tag-autocomplete-wrapper"
              />
            </InputGroup>
          )}
          <Row className="row-mid-padding">
            <Col md={6}>
              <InputGroup className="mb-3">
                <InputGroupText>status</InputGroupText>
                <Input
                  type="select"
                  name="status"
                  value={values.status}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'status')}
                >
                  {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Input>
              </InputGroup>
            </Col>
            <Col md={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Finish</InputGroupText>
                <Input
                  type="select"
                  name="finish"
                  value={values.finish}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'finish')}
                >
                  {['', 'Foil', 'Non-foil'].map((finish) => (
                    <option key={finish}>{finish}</option>
                  ))}
                </Input>
              </InputGroup>
            </Col>
          </Row>
          <Row className="row-mid-padding">
            <Col md={6}>
              <NumericField
                name="price"
                humanName="Price USD"
                placeholder={'Any decimal number, e.g. "3.50"'}
                value={values.price}
                operator={values.priceOp}
                setValue={(value: number) => updateValue(value, 'price')}
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
                setValue={(value: number) => updateValue(value, 'priceFoil')}
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
                setValue={(value: number) => updateValue(value, 'priceEur')}
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
                setValue={(value: number) => updateValue(value, 'priceTix')}
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
            setValue={(value: number) => updateValue(value, 'elo')}
            setOperator={(operator: string) => updateValue(operator, 'eloOp')}
          />
          <NumericField
            name="power"
            humanName="Power"
            placeholder={'Any value, e.g. "2"'}
            value={values.power}
            operator={values.powerOp}
            setValue={(value: number) => updateValue(value, 'power')}
            setOperator={(operator: string) => updateValue(operator, 'powerOp')}
          />
          <NumericField
            name="toughness"
            humanName="Toughness"
            placeholder={'Any value, e.g. "2"'}
            value={values.toughness}
            operator={values.toughnessOp}
            setValue={(value: number) => updateValue(value, 'toughness')}
            setOperator={(operator: string) => updateValue(operator, 'toughnessOp')}
          />
          <NumericField
            name="loyalty"
            humanName="Loyalty"
            placeholder={'Any value, e.g. "3"'}
            value={values.loyalty}
            operator={values.loyaltyOp}
            setValue={(value: number) => updateValue(value, 'loyalty')}
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
          <InputGroup className="mb-3">
            <InputGroupText>Legality</InputGroupText>
            <Input
              type="select"
              id="legalityOp"
              name="legalityOp"
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'legalityOp')}
            >
              <option value="=">legal</option>
              <option value="!=">not legal</option>
            </Input>
            <Input
              type="select"
              name="legality"
              value={values.legality}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'legality')}
            >
              {[
                '',
                'Standard',
                'Pioneer',
                'Modern',
                'Legacy',
                'Vintage',
                'Brawl',
                'Historic',
                'Pauper',
                'Penny',
                'Commander',
              ].map((legality) => (
                <option key={legality}>{legality}</option>
              ))}
            </Input>
          </InputGroup>
          <TextField
            name="artist"
            humanName="Artist"
            placeholder={'Any text, e.g. "seb"'}
            value={values.artist}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateValue(event.target.value, 'artist')}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="unsafe" aria-label="Close" onClick={toggle}>
            Cancel
          </Button>
          <Button color="accent" type="submit">
            Apply
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export default AdvancedFilterModal;
