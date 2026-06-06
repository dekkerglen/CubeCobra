import React, { useCallback, useContext, useEffect, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
import Cube, { CUBE_CATEGORIES, CUBE_PREFIXES } from '@utils/datatypes/Cube';
import { getCubeDescription, getCubeId } from '@utils/Util';

import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext from '../../contexts/CubeContext';
import { cardNameMatches, fetchCardImage } from '../../utils/cardAutocomplete';
import Alert from '../base/Alert';
import AutocompleteInput from '../base/AutocompleteInput';
import { Card, CardHeader } from '../base/Card';
import Checkbox from '../base/Checkbox';
import Collapse from '../base/Collapse';
import Input from '../base/Input';
import { Col, Flexbox, Row } from '../base/Layout';
import Link from '../base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import RadioButtonGroup from '../base/RadioButtonGroup';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';
import MtgImage from '../MtgImage';
import TextEntry from '../TextEntry';

interface EditOverviewModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

interface AlertProps {
  color: string;
  message: string;
}

// A collapsible section. Collapsed by default — the modal only keeps the cube
// name expanded.
const Section: React.FC<{ title: string; isOpen: boolean; toggle: () => void; children: React.ReactNode }> = ({
  title,
  isOpen,
  toggle,
  children,
}) => (
  <Card>
    <CardHeader className="cursor-pointer select-none" onClick={toggle}>
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold md>
          {title}
        </Text>
        {isOpen ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
      </Flexbox>
    </CardHeader>
    <Collapse isOpen={isOpen} className="transition-all duration-300">
      <div className="p-4">{children}</div>
    </Collapse>
  </Card>
);

const EditOverviewModal: React.FC<EditOverviewModalProps> = ({ isOpen, setOpen }) => {
  const { cube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [state, setState] = useState<Cube>(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [openSections, setOpenSections] = useState({
    category: false,
    image: false,
    description: false,
    url: false,
  });

  // Re-sync the working copy whenever the modal is (re)opened, so it reflects
  // the latest saved cube and discards any abandoned edits from a prior open.
  useEffect(() => {
    if (isOpen) {
      setState(JSON.parse(JSON.stringify(cube)));
      setImagename(cube.imageName);
      setAlerts([]);
      setOpenSections({ category: false, image: false, description: false, url: false });
    }
  }, [isOpen, cube]);

  const toggleSection = (key: keyof typeof openSections) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const changeImage = useCallback((image: string) => {
    setImagename(image);
    fetchCardImage(image).then((resolved) => {
      if (resolved) {
        setState((prev) => ({ ...prev, imageName: image, image: resolved }));
      }
    });
  }, []);

  const saveChanges = useCallback(async () => {
    setAlerts([]);
    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/api/editoverview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cube: {
            id: state.id,
            name: state.name,
            shortId: state.shortId,
            imageName: state.imageName,
            image: state.image,
            brief: state.brief,
            categoryOverride: state.categoryOverride,
            categoryPrefixes: state.categoryPrefixes,
          },
        }),
      });

      const body = await response.json();
      if (response.ok) {
        // Reload so the server-rendered cube (hero, etc.) reflects the changes.
        // Keep the button in its loading state through the reload — don't dismiss
        // the modal; the page load tears it down.
        window.location.reload();
        return;
      }
      setAlerts([{ color: 'danger', message: body.error }]);
    } catch {
      setAlerts([{ color: 'danger', message: 'Error updating cube' }]);
    }
    setLoading(false);
  }, [csrfFetch, state]);

  const isEmpty = cube.cardCount === 0;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg scrollable>
      <ModalHeader setOpen={setOpen}>Edit Cube Overview</ModalHeader>
      <ModalBody scrollable>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isEmpty) saveChanges();
          }}
        >
          <Flexbox direction="col" gap="3">
            {alerts.map(({ color, message }) => (
              <Alert key={message} color={color}>
                {message}
              </Alert>
            ))}

            {isEmpty && (
              <Alert color="warning">
                Please add at least one card to the cube in order to edit the overview. This is a spam prevention
                mechanism.
              </Alert>
            )}

            <Input
              label="Cube Name"
              value={state.name}
              required
              onChange={(event) => setState({ ...state, name: event.target.value })}
            />

            <Section title="Category & Tags" isOpen={openSections.category} toggle={() => toggleSection('category')}>
              <Text semibold md className="mb-2">
                Category: {getCubeDescription(state)}
              </Text>
              <Row>
                <Col xs={12} md={6}>
                  <RadioButtonGroup
                    selected={state.categoryOverride || ''}
                    setSelected={(value) => setState({ ...state, categoryOverride: value })}
                    options={[
                      { value: '', label: 'None' },
                      ...CUBE_CATEGORIES.map((item) => ({ value: item, label: item })),
                    ]}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Flexbox direction="col" gap="2">
                    {CUBE_PREFIXES.map((label) => (
                      <Checkbox
                        key={label}
                        label={label}
                        checked={(state.categoryPrefixes || []).includes(label)}
                        setChecked={(checked) => {
                          if (checked) {
                            setState({ ...state, categoryPrefixes: [...(state.categoryPrefixes || []), label] });
                          } else {
                            setState({
                              ...state,
                              categoryPrefixes: (state.categoryPrefixes || []).filter((x) => x !== label),
                            });
                          }
                        }}
                      />
                    ))}
                  </Flexbox>
                </Col>
              </Row>
            </Section>

            <Section title="Image" isOpen={openSections.image} toggle={() => toggleSection('image')}>
              <Row className="mb-3">
                <Col xs={12} sm={6} md={4}>
                  <Card>
                    <CardHeader>
                      <Text semibold>Preview</Text>
                    </CardHeader>
                    <MtgImage image={state.image} showArtist />
                  </Card>
                </Col>
              </Row>
              <AutocompleteInput
                getMatches={cardNameMatches(true)}
                type="text"
                name="image"
                value={imagename}
                setValue={changeImage}
                placeholder="Cardname for image"
                autoComplete="off"
              />
            </Section>

            <Section title="Description" isOpen={openSections.description} toggle={() => toggleSection('description')}>
              <Flexbox direction="col" gap="2">
                <Text sm className="text-text-secondary">
                  A short description displayed in the cube hero (max 500 characters)
                </Text>
                <TextEntry
                  name="brief"
                  value={state.brief || ''}
                  setValue={(value) => setState({ ...state, brief: value })}
                  maxLength={500}
                />
              </Flexbox>
            </Section>

            <Section title="Custom URL" isOpen={openSections.url} toggle={() => toggleSection('url')}>
              <Input
                label="Short ID"
                id="shortId"
                name="shortId"
                type="text"
                value={state.shortId}
                onChange={(event) => setState({ ...state, shortId: event.target.value })}
                required
                placeholder="Give this cube an easy to remember URL."
              />
              <Text semibold sm className="text-muted mt-1">
                Changing the short ID may break existing links to your cube.
              </Text>
            </Section>

            <Flexbox direction="col" gap="1" className="pt-1 pl-4">
              <Text sm semibold>
                Looking for more settings?
              </Text>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>
                  <Link href={`/cube/settings/${getCubeId(cube)}?view=options`}>Options</Link>: notification settings
                  and card defaults
                </li>
                <li>
                  <Link href={`/cube/settings/${getCubeId(cube)}?view=collaborators`}>Collaborators</Link>: manage who
                  can edit your cube
                </li>
                <li>
                  <Link href={`/cube/settings/${getCubeId(cube)}?view=boards-and-views`}>Boards and Views</Link>:
                  customize how your cube is presented
                </li>
                <li>
                  <Link href={`/cube/settings/${getCubeId(cube)}?view=custom-sorts`}>Custom Sorts</Link>: create custom
                  sorting functions for your cube
                </li>
                <li>
                  <Link href={`/cube/settings/${getCubeId(cube)}?view=draft-formats`}>Draft Formats</Link>: manage how
                  your cube can be drafted
                </li>
              </ul>
            </Flexbox>
          </Flexbox>
          {/* Hidden submit so Enter submits the form */}
          <button type="submit" aria-hidden="true" tabIndex={-1} className="hidden" />
        </form>
      </ModalBody>
      <ModalFooter>
        <LoadingButton block color="primary" loading={loading} disabled={isEmpty} onClick={saveChanges}>
          Save Changes
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

export default EditOverviewModal;
