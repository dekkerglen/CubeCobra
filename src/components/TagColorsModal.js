import React, { Component } from 'react';

import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Button, Col, Form, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Row } from 'reactstrap';

import { arrayMove } from '../util/Util';

import TagContext, { getTagColorClass } from './TagContext';

const SortableItem = SortableElement(({ value }) =>
  <div className="sortable-item">{value}</div>
);

const SortableList = SortableContainer(({ items }) => {
  return (
    <div>
      {items.map(({ element, key }, index) => (
        <SortableItem key={key} index={index} value={element} />
      ))}
    </div>
  );
});

const TagColorRow = ({ tag, tagClass, value, onChange }) =>
  <Row className="tag-color-row">
    <Col>
      <div className={tagClass}>{tag}</div>
    </Col>
    <Col>
      <Input type="select" name={`tagcolor-${tag}`} value={value || 'none'} onChange={onChange}>
        {TagContext.colors.map(([name, value]) =>
          <option key={value || 'none'} value={value || 'none'}>{name}</option>
        )}
      </Input>
    </Col>
  </Row>

class TagColorsModalRaw extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tagColors: this.props.savedTagColors,
      showTagColors: this.props.savedShowTagColors,
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChangeColor = this.handleChangeColor.bind(this);
    this.handleChangeShowTagColors = this.handleChangeShowTagColors.bind(this);
    this.handleSortEnd = this.handleSortEnd.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();
    return Promise.all([
      this.props.setTagColors(this.state.tagColors),
      this.props.setShowTagColors(this.state.showTagColors),
    ]).then(() => this.props.toggle());
  }

  handleChangeColor(event) {
    const target = event.target;
    const name = target.getAttribute('name');
    if (!name.startsWith('tagcolor-')) {
      return;
    }
    const tag = name.slice('tagcolor-'.length);
    const color = target.value === 'none' ? null : target.value;

    this.setState(({ tagColors }) => {
      const result = [...tagColors];
      const index = tagColors.findIndex(tagColor => tag === tagColor.tag);
      if (index > -1) {
        result[index] = { tag, color };
      } else {
        result.push({ tag, color });
      }
      return {
        tagColors: result,
      };
    });
  }

  handleChangeShowTagColors(event) {
    const target = event.target;
    this.setState({
      showTagColors: target.checked,
    });
  }

  handleSortEnd({ oldIndex, newIndex }) {
    const { allTags } = this.props;
    const { tagColors } = this.state;
    const filteredTags = allTags.filter(tag => !tagColors.some(tagColor => tag === tagColor.tag))
    const allTagColors = [
      ...this.state.tagColors,
      ...filteredTags.map(tag => ({ tag, color: null })),
    ];
    this.setState({
      tagColors: arrayMove(allTagColors, oldIndex, newIndex),
    });
  }

  render() {
    const { canEdit, isOpen, toggle, allTags } = this.props;
    const { tagColors, showTagColors } = this.state;

    const knownTags = tagColors.map(({ tag, color }) => tag);
    const unknownTags = allTags.filter(tag => !knownTags.includes(tag));
    const unknownTagColors = unknownTags.map(tag => ({ tag, color: null }));
    const orderedTags = [...tagColors, ...unknownTagColors];

    const rows = orderedTags.map(({ tag, color }) => {
      const tagClass = `tag-item ${getTagColorClass(tagColors, tag)}`;
      return {
        element: <TagColorRow tag={tag} tagClass={tagClass} value={color} onChange={this.handleChangeColor} />,
        key: tag,
      };
    });

    return (
      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>
          {canEdit ? 'Set Tag Colors' : 'Tag Colors'}
        </ModalHeader>
        <ModalBody>
          {!canEdit ? '' :
            <>
              <Form inline>
                <Label>
                  <Input type="checkbox" checked={showTagColors} onChange={this.handleChangeShowTagColors} />
                  Show Tag Colors in Card List
                </Label>
              </Form>
              <p><em>(Drag the tags below into a priority order to use for cards that have more than one tag)</em></p>
            </>
          }
          <SortableList onSortEnd={this.handleSortEnd} items={rows} />
        </ModalBody>
        <ModalFooter>
          <Button color="success" className="ml-auto" onClick={this.handleSubmit}>
            Submit
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

const TagColorsModal = props =>
  <TagContext.Consumer>
    {({ tagColors, setTagColors, showTagColors, setShowTagColors, allTags }) =>
      <TagColorsModalRaw
        allTags={allTags}
        savedTagColors={tagColors}
        setTagColors={setTagColors}
        savedShowTagColors={showTagColors}
        setShowTagColors={setShowTagColors}
        {...props}
      />
    }
  </TagContext.Consumer>

export default TagColorsModal;
