import React, { useContext } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import AddRoundModal from 'components/modals/AddRoundModal';
import EditMatchResultsModal from 'components/modals/EditMatchResultsModal';
import EditRoundModal from 'components/modals/EditRoundModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import RecordType from 'datatypes/Record';

const AddRoundLink = withModal(Link, AddRoundModal);
const EditRoundLink = withModal(Link, EditRoundModal);
const EditMatchResultsLink = withModal(Link, EditMatchResultsModal);

interface RecordMatchesProps {
  record: RecordType;
}

const RecordMatches: React.FC<RecordMatchesProps> = ({ record }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        {record.matches.length === 0 && <Text sm>{'No matches have been recorded for this record yet.'}</Text>}
        {isOwner && (
          <AddRoundLink
            modalprops={{
              record,
            }}
          >
            {'Add a new round of matches to this record'}
          </AddRoundLink>
        )}
        {record.matches.map((round, index) => (
          <Card key={index}>
            <CardHeader>
              <Flexbox direction="row" justify="between">
                <Text md semibold>
                  {`Round ${index + 1}`}
                </Text>
                {isOwner && (
                  <Flexbox direction="row" gap="4">
                    <EditRoundLink
                      modalprops={{
                        record,
                        roundIndex: index,
                        round,
                      }}
                    >
                      {'Edit Round'}
                    </EditRoundLink>
                    <EditMatchResultsLink
                      modalprops={{
                        record,
                        roundIndex: index,
                        round,
                      }}
                    >
                      {'Edit Match Results'}
                    </EditMatchResultsLink>
                  </Flexbox>
                )}
              </Flexbox>
            </CardHeader>
            <Table
              headers={['Player 1', 'Player 2', 'Player 1 Wins', 'Player 2 Wins', 'Draws']}
              rows={round.matches.map((match) => ({
                'Player 1': match.p1,
                'Player 2': match.p2,
                'Player 1 Wins': match.results[0],
                'Player 2 Wins': match.results[1],
                Draws: match.results[2],
              }))}
            />
          </Card>
        ))}
      </Flexbox>
    </CardBody>
  );
};

export default RecordMatches;
