/* eslint-disable react/prop-types */
import React, { useContext, useCallback, useMemo } from 'react';

import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Col, Input, Label, Modal, ModalBody, ModalHeader, Row } from 'reactstrap';

import { arrayMove, getTagColorClass } from 'utils/Util';
import CubeContext, { TAG_COLORS } from 'contexts/CubeContext';

const SortableItem = SortableElement(({ value }) => <div className="sortable-item">{value}</div>);

const SortableList = SortableContainer(({ items }) => {
  return (
    <div>
      {items.map(({ element, key }, index) => (
        <SortableItem key={key} index={index} value={element} />
      ))}
    </div>
  );
});

const TagColorRow = ({ tag, tagClass, value, onChange }) => (
  <Row className="tag-color-row">
    <Col>
      <div className={tagClass}>{tag}</div>
    </Col>
    <Col className="d-flex flex-column justify-content-center">
      <Input type="select" bsSize="sm" name={`tagcolor-${tag}`} value={value || 'none'} onChange={onChange}>
        {TAG_COLORS.map(([name, v]) => (
          <option key={v || 'none'} value={v || 'none'}>
            {name}
          </option>
        ))}
      </Input>
    </Col>
  </Row>
);

const TagColorsModal = ({ isOpen, toggle }) => {
  const { tagColors, updateTagColors, showTagColors, updateShowTagColors, canEdit } = useContext(CubeContext);

  const handleChangeColor = useCallback(
    (event) => {
      const { target } = event;
      const name = target.getAttribute('name');
      if (!name.startsWith('tagcolor-')) {
        return;
      }
      const tag = name.slice('tagcolor-'.length);
      const color = target.value === 'none' ? null : target.value;

      const result = [...tagColors];
      const index = tagColors.findIndex((tagColor) => tag === tagColor.tag);
      if (index > -1) {
        result[index] = { tag, color };
      } else {
        result.push({ tag, color });
      }
      updateTagColors(result);
    },
    [tagColors, updateTagColors],
  );

  const handleSortEnd = useCallback(
    ({ oldIndex, newIndex }) => {
      updateTagColors(arrayMove(tagColors, oldIndex, newIndex));
    },
    [tagColors, updateTagColors],
  );

  const editableRows = useMemo(
    () =>
      tagColors.map(({ tag, color }) => {
        const tagClass = `tag ${getTagColorClass(tagColors, tag)}`;
        return {
          element: <TagColorRow tag={tag} tagClass={tagClass} value={color} onChange={handleChangeColor} />,
          key: tag,
        };
      }),
    [tagColors, handleChangeColor],
  );

  const staticRows = useMemo(() => {
    tagColors.map(({ tag }) => {
      const tagClass = `me-2 tag ${getTagColorClass(tagColors, tag)}`;
      return (
        <span key={tag} className={tagClass}>
          {tag}
        </span>
      );
    });
  }, [tagColors]);

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>{canEdit ? 'Set Tag Colors' : 'Tag Colors'}</ModalHeader>
      <ModalBody>
        <Label>
          <Input
            type="checkbox"
            className="me-1"
            checked={showTagColors}
            onChange={(e) => updateShowTagColors(e.target.checked)}
          />
          Show Tag Colors in Card List
        </Label>
        {!canEdit ? (
          ''
        ) : (
          <em>(Drag the tags below into a priority order to use for cards that have more than one tag)</em>
        )}
        {!canEdit ? (
          staticRows
        ) : (
          <Row className="tag-color-container">
            <Col>
              <SortableList onSortEnd={handleSortEnd} items={editableRows} />
            </Col>
          </Row>
        )}
      </ModalBody>
    </Modal>
  );
};

TagColorsModal.defaultProps = {
  canEdit: false,
};

export default TagColorsModal;
