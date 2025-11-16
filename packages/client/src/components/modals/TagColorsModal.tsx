import React, { useCallback, useContext, useMemo, useState } from 'react';

import { GrabberIcon } from '@primer/octicons-react';
import { TagColor } from '@utils/datatypes/Cube';
import { getTagColorClass } from '@utils/Util';

import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext, { TAG_COLORS } from '../../contexts/CubeContext';
import { Card } from '../base/Card';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Tag from '../base/Tag';
import { SortableItem, SortableList } from '../DND';
import LoadingButton from '../LoadingButton';

interface TagColorRowProps {
  tag: string;
  tagClass: string;
  value: string | null;
  onChange: (tagColor: string) => void;
  id: string;
}

const TagColorRow: React.FC<TagColorRowProps> = ({ tag, tagClass, value, onChange, id }) => {
  /* In Firefox when the select is clicked it was also triggering the sortable context, such that
   * while the options are open the whole row is moving around. And once the option is chosen its still
   * dragging, like a burr you cannot shake off. Stopping the onPointerDown event from propagating is
   * the solution I found.
   */
  const preventDragStart = (event: React.PointerEvent<HTMLSelectElement>) => {
    event.stopPropagation();
  };

  return (
    <SortableItem id={id} className="p-2 no-touch-action">
      <Card>
        <Flexbox direction="row" justify="between" className="cursor-grab">
          <Flexbox direction="row" justify="start" alignItems="center">
            <GrabberIcon size={16} className="cursor-grab" />
            <Tag text={tag} colorClass={tagClass} />
          </Flexbox>
          <Select
            options={TAG_COLORS.map(([name, v]) => ({ value: v || 'none', label: name }))}
            value={value || 'none'}
            setValue={onChange}
            dense
            onPointerDown={preventDragStart}
          />
        </Flexbox>
      </Card>
    </SortableItem>
  );
};

interface TagColorsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const TagColorsModal: React.FC<TagColorsModalProps> = ({ isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  //Continually update the tagColors in CubeContext as the modal contents change. They won't persist until the actual save
  const { tagColors, setTagColors, showTagColors, updateShowTagColors, canEdit, cube } = useContext(CubeContext);
  const [loading, setLoading] = useState(false);

  const updateModalColors = useCallback(
    async (colors: TagColor[]) => {
      setLoading(true);
      const response = await csrfFetch(`/cube/api/savetagcolors/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({ tag_colors: tagColors }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTagColors(colors);
      } else {
        console.error('Request failed.');
      }
      setLoading(false);
      setOpen(false);
    },
    [csrfFetch, cube.id, tagColors, setOpen, setTagColors],
  );

  const handleChangeColor = useCallback(
    (color: string, tag: string) => {
      const result = [...tagColors];
      const index = tagColors.findIndex((tagColor) => tag === tagColor.tag);
      if (index > -1) {
        result[index] = { tag, color };
      } else {
        result.push({ tag, color });
      }
      setTagColors(result);
    },
    [tagColors, setTagColors],
  );

  const handleSortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;

      //If sort (drag and drop) ends without a collision, eg outside the sortable area, do nothing
      if (!over) {
        return;
      }

      if (active.id !== over.id) {
        const newModalColors = [...tagColors];

        const oldIndex = tagColors.findIndex((tagColor) => tagColor.tag === active.id);
        const newIndex = tagColors.findIndex((tagColor) => tagColor.tag === over.id);

        const [removed] = newModalColors.splice(oldIndex, 1);
        newModalColors.splice(newIndex, 0, removed);

        setTagColors(newModalColors);
      }
    },
    [tagColors, setTagColors],
  );

  const staticRows = useMemo(
    () =>
      tagColors.map(({ tag }) => {
        const tagClass = `me-2 tag ${getTagColorClass(tagColors, tag)}`;
        return (
          <span key={tag} className={tagClass}>
            {tag}
          </span>
        );
      }),
    [tagColors],
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md scrollable>
      <ModalHeader setOpen={setOpen}>{canEdit ? 'Set Tag Colors' : 'Tag Colors'}</ModalHeader>
      <ModalBody scrollable>
        {showTagColors ? (
          <LoadingButton
            block
            color="primary"
            onClick={async () => await updateShowTagColors(false)}
            disabled={!canEdit}
          >
            Hide tag colors by default
          </LoadingButton>
        ) : (
          <LoadingButton
            block
            color="primary"
            onClick={async () => await updateShowTagColors(true)}
            disabled={!canEdit}
          >
            Show tag colors by default
          </LoadingButton>
        )}
        {!canEdit ? (
          ''
        ) : (
          <em>(Drag the tags below into a priority order to use for cards that have more than one tag)</em>
        )}
        {!canEdit ? (
          staticRows
        ) : (
          <SortableList onDragEnd={handleSortEnd} items={tagColors.map(({ tag }) => tag)}>
            {tagColors.map(({ tag, color }) => {
              const tagClass = `tag ${getTagColorClass(tagColors, tag)}`;
              return (
                <TagColorRow
                  key={tag}
                  tag={tag}
                  tagClass={tagClass}
                  value={color}
                  onChange={(color) => handleChangeColor(color, tag)}
                  id={tag}
                />
              );
            })}
          </SortableList>
        )}
      </ModalBody>
      <ModalFooter>
        <LoadingButton block color="primary" onClick={() => updateModalColors(tagColors)} loading={loading}>
          Save Changes
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

export default TagColorsModal;
