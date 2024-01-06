import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import AddToCubeModal from 'components/AddToCubeModal';
import PagedList from 'components/PagedList';
import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import CubePropType from 'proptypes/CubePropType';
import { encodeName } from 'utils/Card';
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Label,
  ListGroup,
  ListGroupItem,
  ListGroupItemHeading,
  Row,
} from 'reactstrap';
import useToggle from 'hooks/UseToggle';

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

function Suggestion({ card, index, cube }) {
  return (
    <ListGroupItem>
      <h6>
        {index + 1}
        {'. '}
        <AddModal
          card={card}
          href={`/tool/card/${encodeName(card.cardID)}`}
          modalProps={{ card: card.details, hideAnalytics: false, cubeContext: cube.id }}
        >
          {card.details.name}
        </AddModal>
      </h6>
    </ListGroupItem>
  );
}

Suggestion.propTypes = {
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  cube: CubePropType.isRequired,
  index: PropTypes.number.isRequired,
};

function Suggestions({ adds, cuts, cube, maybeboard, filter }) {
  const [maybeOnly, toggleMaybeOnly] = useToggle(false);

  const filteredCuts = useMemo(() => {
    const withIndex = cuts?.map((cut, index) => [cut, index]) ?? [];
    return filter ? withIndex.filter(([card]) => filter(card)) : withIndex;
  }, [cuts, filter]);

  const filteredAdds = useMemo(() => {
    let withIndex = adds?.map((add, index) => [add, index]) ?? [];
    if (maybeOnly) {
      withIndex = withIndex.filter(([card]) =>
        maybeboard.some((maybe) => maybe.details.oracle_id === card.details.oracle_id),
      );
    }
    return filter ? withIndex.filter(([card]) => filter(card)) : withIndex;
  }, [adds, maybeOnly, filter, maybeboard]);

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        View recommended additions and cuts. This data is generated using a machine learning algorithm trained over all
        cubes on Cube Cobra.
      </p>
      <Row>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
              <input className="me-2" type="checkbox" checked={maybeOnly} onClick={toggleMaybeOnly} />
              <Label for="toggleMaybeboard">Show cards from my maybeboard only.</Label>
            </CardHeader>
            <ListGroup className="pb-3">
              {filteredAdds.length > 0 ? (
                <PagedList
                  pageSize={20}
                  showBottom
                  pageWrap={(element) => <CardBody>{element}</CardBody>}
                  rows={filteredAdds.slice(0).map(([add, index]) => (
                    <Suggestion key={add.cardID} index={index} card={add} cube={cube} />
                  ))}
                />
              ) : (
                <CardBody>
                  <em>No results with the given filter.</em>
                </CardBody>
              )}
            </ListGroup>
          </Card>
        </Col>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Cuts</ListGroupItemHeading>
            </CardHeader>
            <ListGroup className="pb-3">
              {filteredCuts.length > 0 ? (
                <PagedList
                  pageSize={20}
                  showBottom
                  pageWrap={(element) => <CardBody>{element}</CardBody>}
                  rows={filteredCuts.slice(0).map(([card, index]) => (
                    <Suggestion key={card.cardID} index={index} card={card} cube={cube} />
                  ))}
                />
              ) : (
                <CardBody>
                  <em>No results with the given filter.</em>
                </CardBody>
              )}
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </>
  );
}

Suggestions.propTypes = {
  adds: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cuts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cube: PropTypes.shape({
    maybe: PropTypes.arrayOf(
      PropTypes.shape({ details: PropTypes.shape({ name_lower: PropTypes.string.isRequired }) }),
    ),
  }).isRequired,
  filter: PropTypes.func,
  maybeboard: PropTypes.arrayOf(PropTypes.shape({ details: PropTypes.shape({ oracle_id: PropTypes.string }) }))
    .isRequired,
};

Suggestions.defaultProps = {
  filter: null,
};

export default Suggestions;
