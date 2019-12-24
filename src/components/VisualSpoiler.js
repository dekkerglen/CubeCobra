import React, { useEffect } from 'react';

import { Row, Col } from 'reactstrap';

import SortContext from './SortContext';
import SpoilerImage from './SpoilerImage';

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
      {getLabels(primary)
        .filter((label1) => groups[label1])
        .map((label1) =>
          getLabels(secondary)
            .filter((label2) => groups[label1][label2])
            .map((label2) =>
              getLabels(tertiary)
                .filter((label3) => groups[label1][label2][label3])
                .map((label3) =>
                  groups[label1][label2][label3].map(({ index, tags, finish, details }) => (
                    <Col key={index} xs={6} sm={4} className="col-md-1-5">
                      <SpoilerImage index={index} tags={tags} finish={finish} {...details} />
                    </Col>
                  )),
                ),
            ),
        )}
    </Row>
  );
};

const VisualSpoiler = SortContext.Wrapped(VisualSpoilerRaw);

export default VisualSpoiler;
