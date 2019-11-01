import React, { useEffect } from 'react';

import { Row, Col } from 'reactstrap';

import AutocardImage from './AutocardImage';
import SortContext from './SortContext';

const VisualSpoilerRaw = ({ cards, primary, secondary, tertiary, changeSort, ...props }) => {
  const groups = {};
  for (const [label1, primaryGroup] of Object.entries(sortIntoGroups(cards, primary))) {
    groups[label1] = {};
    for (const [label2, secondaryGroup] of Object.entries(sortIntoGroups(primaryGroup, secondary))) {
      groups[label1][label2] = sortIntoGroups(secondaryGroup, tertiary);
    }
  }
  return (
    <Row noGutters className="mt-3 justify-content-center" {...props}>
      {
        getLabels(primary).filter(label1 => groups[label1]).map(label1 =>
          getLabels(secondary).filter(label2 => groups[label1][label2]).map(label2 =>
            getLabels(tertiary).filter(label3 => groups[label1][label2][label3]).map(label3 =>
              groups[label1][label2][label3].map(({ index, tags, details }) =>
                <Col key={index} className="w-auto flex-grow-0">
                  <div className="visualSpoilerCardContainer">
                    <AutocardImage index={index} tags={tags} {...details} />
                  </div>
                </Col>
              )
            )
          )
        )
      }
    </Row>
  );
}

const VisualSpoiler = SortContext.Wrapped(VisualSpoilerRaw);

export default VisualSpoiler;
