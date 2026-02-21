import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { PlusIcon, StarFillIcon, StarIcon, TrashIcon } from '@primer/octicons-react';
import { getBoardDefinitions } from '@utils/datatypes/Cube';
import { DraftFormat, Pack } from '@utils/datatypes/Draft';
import { createDefaultDraftFormat, getErrorsInFormat } from '@utils/draftutil';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import RadioButtonGroup from 'components/base/RadioButtonGroup';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import CustomPackCard from 'components/CustomPackCard';
import LoadingButton from 'components/LoadingButton';
import TextEntry from 'components/TextEntry';
import CubeContext from 'contexts/CubeContext';

const DraftFormatsSettings: React.FC = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);
  const [formats, setFormats] = useState<DraftFormat[]>(cube.formats || []);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Standard draft format toggles - initialize from cube data (stored as disable flags)
  const [enableDraft, setEnableDraft] = useState(!cube.disableDraft);
  const [enableSealed, setEnableSealed] = useState(!cube.disableSealed);
  const [enableGrid, setEnableGrid] = useState(!cube.disableGrid);
  const [enableMultiplayer, setEnableMultiplayer] = useState(!cube.disableMultiplayer);

  // Default format: -1 means standard draft, 0+ means custom format index
  const [defaultFormat, setDefaultFormat] = useState<number>(cube.defaultFormat ?? -1);

  // Get available boards
  const availableBoards = useMemo(() => {
    const cards =
      unfilteredChangedCards && Object.keys(unfilteredChangedCards).length > 0
        ? unfilteredChangedCards
        : (cube as any).cards;
    return getBoardDefinitions(cube, cards);
  }, [cube, unfilteredChangedCards]);

  // Basics board selection - default to 'Basics' if available, otherwise 'None'
  const defaultBasicsBoard = useMemo(() => {
    if (cube.basicsBoard) return cube.basicsBoard;
    const hasBasics = availableBoards.some((b) => b.name.toLowerCase() === 'basics');
    return hasBasics ? 'Basics' : 'None';
  }, [cube.basicsBoard, availableBoards]);

  const [basicsBoard, setBasicsBoard] = useState(defaultBasicsBoard);

  const getInitialFormats = useCallback((): DraftFormat[] => {
    if (cube.formats && cube.formats.length > 0) {
      return cube.formats.map((f) => ({
        ...f,
        packs: f.packs.map((p) => ({ ...p, slots: [...p.slots], steps: p.steps ? [...p.steps] : null })),
      }));
    }
    return [];
  }, [cube.formats]);

  useEffect(() => {
    setFormats(getInitialFormats());
  }, [getInitialFormats]);

  // Change detection
  useEffect(() => {
    const currentState = JSON.stringify({
      formats,
      enableDraft,
      enableSealed,
      enableGrid,
      enableMultiplayer,
      basicsBoard,
      defaultFormat,
    });
    const initialState = JSON.stringify({
      formats: getInitialFormats(),
      enableDraft: !cube.disableDraft,
      enableSealed: !cube.disableSealed,
      enableGrid: !cube.disableGrid,
      enableMultiplayer: !cube.disableMultiplayer,
      basicsBoard: defaultBasicsBoard,
      defaultFormat: cube.defaultFormat ?? -1,
    });
    setHasChanges(currentState !== initialState);
  }, [
    formats,
    enableDraft,
    enableSealed,
    enableGrid,
    enableMultiplayer,
    basicsBoard,
    defaultFormat,
    getInitialFormats,
    cube.disableDraft,
    cube.disableSealed,
    cube.disableGrid,
    cube.disableMultiplayer,
    defaultBasicsBoard,
    cube.defaultFormat,
  ]);

  const addFormat = () => {
    const newFormat = createDefaultDraftFormat(3, 15);
    newFormat.title = `Format ${formats.length + 1}`;
    setFormats([...formats, newFormat]);
    setExpandedIndex(formats.length);
    setError('');
  };

  const removeFormat = (index: number) => {
    setFormats(formats.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
    // Adjust defaultFormat when removing a format
    if (defaultFormat === index) {
      setDefaultFormat(-1); // Reset to standard draft
    } else if (defaultFormat > index) {
      setDefaultFormat(defaultFormat - 1); // Shift index down
    }
    setError('');
  };

  const updateFormat = (index: number, updates: Partial<DraftFormat>) => {
    const newFormats = [...formats];
    newFormats[index] = { ...newFormats[index], ...updates };
    setFormats(newFormats);
    setError('');
  };

  const addPackToFormat = (formatIndex: number) => {
    const format = formats[formatIndex];
    const newPack = { slots: [], steps: null };
    updateFormat(formatIndex, { packs: [...format.packs, newPack] });
  };

  const removePackFromFormat = (formatIndex: number, packIndex: number) => {
    const format = formats[formatIndex];
    if (format.packs.length <= 1) {
      setError('Format must have at least one pack');
      return;
    }
    const newPacks = format.packs.filter((_, i) => i !== packIndex);
    updateFormat(formatIndex, { packs: newPacks });
  };

  const updatePack = (formatIndex: number, packIndex: number, updates: any) => {
    const format = formats[formatIndex];
    const newPacks = [...format.packs];
    newPacks[packIndex] = { ...newPacks[packIndex], ...updates };
    updateFormat(formatIndex, { packs: newPacks });
  };

  const validateFormats = (): string | null => {
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      if (!format.title || !format.title.trim()) {
        return `Format ${i + 1} must have a title`;
      }
      const errors = getErrorsInFormat(format);
      if (errors && errors.length > 0) {
        return `Format "${format.title}": ${errors.join(', ')}`;
      }
    }

    const titles = formats.map((f) => f.title.trim().toLowerCase());
    const uniqueTitles = new Set(titles);
    if (titles.length !== uniqueTitles.size) {
      return 'Format titles must be unique';
    }

    return null;
  };

  const handleSave = () => {
    const validationError = validateFormats();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');

    if (formRef.current) {
      formRef.current.submit();
    }
  };

  const resetChanges = () => {
    setFormats(getInitialFormats());
    setEnableDraft(!cube.disableDraft);
    setEnableSealed(!cube.disableSealed);
    setEnableGrid(!cube.disableGrid);
    setEnableMultiplayer(!cube.disableMultiplayer);
    setBasicsBoard(defaultBasicsBoard);
    setDefaultFormat(cube.defaultFormat ?? -1);
    setError('');
  };

  return (
    <Flexbox direction="col" gap="3">
      {error && <Alert color="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              Draft Formats
            </Text>
            <Flexbox direction="row" gap="2">
              <Button color="secondary" onClick={resetChanges} disabled={!hasChanges}>
                Reset
              </Button>
              <LoadingButton color="primary" onClick={handleSave} disabled={!hasChanges}>
                Save Changes
              </LoadingButton>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="4">
            {/* Standard Draft Formats */}
            <Flexbox direction="col" gap="2">
              <Text semibold md>
                Standard Formats
              </Text>
              <Text sm className="text-text-secondary">
                Enable or disable standard draft formats for this cube
              </Text>
              <Flexbox direction="col" gap="2">
                <Checkbox label="Enable Standard Draft" checked={enableDraft} setChecked={setEnableDraft} />
                <Checkbox
                  label="Enable Multiplayer Draft"
                  checked={enableMultiplayer}
                  setChecked={setEnableMultiplayer}
                />
                <Checkbox label="Enable Sealed" checked={enableSealed} setChecked={setEnableSealed} />
                <Checkbox label="Enable Grid Draft" checked={enableGrid} setChecked={setEnableGrid} />
              </Flexbox>
            </Flexbox>

            {/* Basics Board Selection */}
            <Flexbox direction="col" gap="2" className="pt-4 border-t border-border">
              <Text semibold md>
                Basics Configuration
              </Text>
              <Text sm className="text-text-secondary">
                Select which board to use for basics in draft formats
              </Text>
              <Select
                label="Basics board"
                id="basicsBoard"
                options={[
                  { value: 'None', label: 'None' },
                  ...availableBoards.map((b) => ({ value: b.name, label: b.name })),
                ]}
                value={basicsBoard}
                setValue={setBasicsBoard}
              />
            </Flexbox>

            {/* Default Format */}
            <Flexbox direction="col" gap="2" className="pt-4 border-t border-border">
              <Text semibold md>
                Default Format
              </Text>
              <Text sm className="text-text-secondary">
                The default format is pre-selected when starting a new draft
              </Text>
              <Select
                label="Default format"
                id="defaultFormat"
                options={[
                  { value: '-1', label: 'Standard Draft' },
                  ...formats.map((f, i) => ({ value: `${i}`, label: f.title || `Format ${i + 1}` })),
                ]}
                value={`${defaultFormat}`}
                setValue={(value) => setDefaultFormat(parseInt(value, 10))}
              />
            </Flexbox>

            {/* Custom Draft Formats */}
            <div className="pt-4 border-t border-border">
              <Flexbox direction="row" justify="between" alignItems="center" className="mb-3">
                <Text semibold md>
                  Custom Formats
                </Text>
                <Button color="accent" onClick={addFormat}>
                  <PlusIcon size={16} className="mr-1" /> Add Format
                </Button>
              </Flexbox>
              <Text sm className="text-text-secondary mb-3">
                Create custom draft formats with unique pack structures and rules.
              </Text>

              {formats.length > 0 ? (
                <Flexbox direction="col" gap="3">
                  {formats.map((format, index) => {
                    const isExpanded = expandedIndex === index;
                    const formatErrors = getErrorsInFormat(format);
                    const isDefault = defaultFormat === index;

                    return (
                      <div
                        key={index}
                        className="rounded-md border border-border bg-bg transition-colors hover:border-border-active"
                      >
                        {/* Format Header */}
                        <div className="p-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDefaultFormat(isDefault ? -1 : index)}
                            className="flex-shrink-0 cursor-pointer bg-transparent border-0 p-0"
                            title={isDefault ? 'Remove as default' : 'Set as default'}
                          >
                            {isDefault ? (
                              <StarFillIcon size={16} className="text-yellow-500" />
                            ) : (
                              <StarIcon size={16} className="text-text-secondary hover:text-yellow-500" />
                            )}
                          </button>
                          <div className="flex-1">
                            <Input
                              value={format.title}
                              onChange={(e) => updateFormat(index, { title: e.target.value })}
                              placeholder="Format name"
                            />
                          </div>
                          <Button color="secondary" onClick={() => setExpandedIndex(isExpanded ? null : index)}>
                            {isExpanded ? 'Collapse' : 'Configure'}
                          </Button>
                          <Button color="danger" onClick={() => removeFormat(index)}>
                            <TrashIcon size={16} />
                          </Button>
                        </div>

                        {/* Format Configuration - Collapsible */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-border pt-3">
                            <Flexbox direction="col" gap="4">
                              {formatErrors && formatErrors.length > 0 && (
                                <Alert color="danger">
                                  {formatErrors.map((err, i) => (
                                    <div key={i}>{err}</div>
                                  ))}
                                </Alert>
                              )}

                              <Select
                                label="Default seat count"
                                value={`${format.defaultSeats ?? 8}`}
                                options={Array.from({ length: 15 }, (_, i) => i + 2).map((i) => ({
                                  value: `${i}`,
                                  label: `${i}`,
                                }))}
                                setValue={(value) => updateFormat(index, { defaultSeats: parseInt(value, 10) })}
                              />

                              <Select
                                label="Basics board"
                                value={format.basicsBoard || 'none'}
                                options={[
                                  { value: 'none', label: 'None' },
                                  ...availableBoards.map((b) => ({
                                    value: b.name.toLowerCase(),
                                    label: b.name,
                                  })),
                                ]}
                                setValue={(value) =>
                                  updateFormat(index, { basicsBoard: value === 'none' ? undefined : value })
                                }
                              />

                              <RadioButtonGroup
                                label="Multiples"
                                selected={format.multiples ? 'true' : 'false'}
                                setSelected={(value) => updateFormat(index, { multiples: value === 'true' })}
                                allowOptionTextWrapping={true}
                                options={[
                                  {
                                    value: 'true',
                                    label: 'Allow any number of copies of each card in the draft (e.g. set draft)',
                                  },
                                  {
                                    value: 'false',
                                    label: 'Limit to the number of copies in the cube (standard cube draft)',
                                  },
                                ]}
                              />

                              <div>
                                <Flexbox direction="row" justify="between" alignItems="center" className="mb-2">
                                  <Text semibold sm>
                                    Packs
                                  </Text>
                                  <Button color="secondary" onClick={() => addPackToFormat(index)}>
                                    <PlusIcon size={16} className="mr-1" /> Add Pack
                                  </Button>
                                </Flexbox>

                                <Flexbox direction="col" gap="2">
                                  {format.packs.map((pack, packIndex) => (
                                    <CustomPackCard
                                      key={packIndex}
                                      pack={pack}
                                      packIndex={packIndex}
                                      canRemove={true}
                                      setPack={(newPack: Pack) => updatePack(index, packIndex, newPack)}
                                      removePack={() => removePackFromFormat(index, packIndex)}
                                      copyPack={() => {
                                        const newFormats = [...formats];
                                        newFormats[index].packs.splice(packIndex + 1, 0, {
                                          ...pack,
                                          slots: [...pack.slots],
                                          steps: pack.steps ? [...pack.steps] : null,
                                        });
                                        setFormats(newFormats);
                                      }}
                                    />
                                  ))}
                                </Flexbox>
                              </div>

                              <TextEntry
                                name="markdown"
                                value={format.markdown || ''}
                                setValue={(value: string) => updateFormat(index, { markdown: value })}
                                maxLength={100000}
                              />
                            </Flexbox>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Flexbox>
              ) : (
                <div className="rounded-md bg-bg-active p-6 text-center">
                  <Text sm className="text-text-secondary">
                    No custom formats yet. Click "Add Format" to create your first custom draft format.
                  </Text>
                </div>
              )}
            </div>
          </Flexbox>
        </CardBody>
      </Card>

      {/* Hidden form for submission */}
      <div className="hidden">
        <CSRFForm
          method="POST"
          action={`/cube/format/update/${cube.id}`}
          formData={{
            formats: JSON.stringify(formats),
            enableDraft: enableDraft.toString(),
            enableMultiplayer: enableMultiplayer.toString(),
            enableSealed: enableSealed.toString(),
            enableGrid: enableGrid.toString(),
            basicsBoard,
            defaultFormat: defaultFormat.toString(),
          }}
          ref={formRef}
        />
      </div>
    </Flexbox>
  );
};

export default DraftFormatsSettings;
