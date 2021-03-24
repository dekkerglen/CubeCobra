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
  Spinner,
} from 'reactstrap';
import useToggle from 'hooks/UseToggle';

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

const Suggestion = ({ card, index, cubes, cube }) => {
  return (
    <ListGroupItem>
      <h6>
        {index + 1}
        {'. '}
        <AddModal
          front={card.details.image_normal}
          back={card.details.image_flip ?? undefined}
          href={`/tool/card/${encodeName(card.cardID)}`}
          modalProps={{ card: card.details, cubes, hideAnalytics: true, cubeContext: cube._id }}
        >
          {card.details.name}
        </AddModal>
      </h6>
    </ListGroupItem>
  );
};

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
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ),
};

Suggestion.defaultProps = {
  cubes: [],
};

const Suggestions = ({ adds, cuts, loadState, cube, filter, cubes }) => {
  const [maybeOnly, toggleMaybeOnly] = useToggle(false);

  const filteredCuts = useMemo(() => {
    const withIndex = cuts?.map((cut, index) => [cut, index]) ?? [];
    return filter ? withIndex.filter(([card]) => filter(card)) : withIndex;
  }, [cuts, filter]);

  const filteredAdds = useMemo(() => {
    let withIndex = adds?.map((add, index) => [add, index]) ?? [];
    if (maybeOnly) {
      withIndex = withIndex.filter(([card]) =>
        cube.maybe.some((maybe) => maybe.details.name_lower === card.details.name_lower),
      );
    }
    return filter ? withIndex.filter(([card]) => filter(card)) : withIndex;
  }, [adds, maybeOnly, filter, cube.maybe]);

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        View recommended additions and cuts. This data is generated using a machine learning algorithm trained over all
        cubes on Cube Cobra.
      </p>
      {loadState === 'error' ? (
        <Card>
          <CardHeader>
            <h5>Service Unavailable</h5>
          </CardHeader>
          <CardBody>
            <p>We encountered an unexpected error while connecting to the recommender. Please try again later.</p>
          </CardBody>
        </Card>
      ) : (
        <Row>
          <Col xs="12" lg="6">
            <Card>
              <CardHeader>
                <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
                <input className="mr-2" type="checkbox" checked={maybeOnly} onClick={toggleMaybeOnly} />
                <Label for="toggleMaybeboard">Show cards from my Maybeboard only.</Label>
              </CardHeader>
              <ListGroup className="pb-3">
                {loadState === 'loading' && (
                  <CardBody>
                    <div className="centered py-3">
                      <Spinner className="position-absolute" />
                    </div>
                  </CardBody>
                )}
                {loadState === 'loaded' &&
                  (filteredAdds.length > 0 ? (
                    <PagedList
                      pageSize={20}
                      showBottom
                      pageWrap={(element) => <CardBody>{element}</CardBody>}
                      rows={filteredAdds.slice(0).map(([add, index]) => (
                        <Suggestion key={add.cardID} index={index} card={add} cubes={cubes} cube={cube} />
                      ))}
                    />
                  ) : (
                    <CardBody>
                      <em>No results with the given filter.</em>
                    </CardBody>
                  ))}
              </ListGroup>
            </Card>
          </Col>
          <Col xs="12" lg="6">
            <Card>
              <CardHeader>
                <ListGroupItemHeading>Recommended Cuts</ListGroupItemHeading>
              </CardHeader>
              <ListGroup className="pb-3">
                {loadState === 'loading' && (
                  <CardBody>
                    <div className="centered py-3">
                      <Spinner className="position-absolute" />
                    </div>
                  </CardBody>
                )}
                {loadState === 'loaded' &&
                  (filteredCuts.length > 0 ? (
                    <PagedList
                      pageSize={20}
                      showBottom
                      pageWrap={(element) => <CardBody>{element}</CardBody>}
                      rows={filteredCuts.slice(0).map(([card, index]) => (
                        <Suggestion key={card.cardID} index={index} card={card} cubes={cubes} cube={cube} />
                      ))}
                    />
                  ) : (
                    <CardBody>
                      <em>No results with the given filter.</em>
                    </CardBody>
                  ))}
              </ListGroup>
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
};

Suggestions.propTypes = {
  adds: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cuts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loadState: PropTypes.oneOf(['loading', 'loaded', 'error']).isRequired,
  cube: PropTypes.shape({
    maybe: PropTypes.arrayOf(
      PropTypes.shape({ details: PropTypes.shape({ name_lower: PropTypes.string.isRequired }) }),
    ),
  }).isRequired,
  filter: PropTypes.func,
  cubes: PropTypes.arrayOf(PropTypes.shape({})),
};

Suggestions.defaultProps = {
  filter: null,
  cubes: [],
};

export default Suggestions;
