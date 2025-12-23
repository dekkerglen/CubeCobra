import React from 'react';

import { ArrowRightIcon } from '@primer/octicons-react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface PackageSearchSyntaxModalProps {
  setOpen: (open: boolean) => void;
  isOpen: boolean;
}

interface SearchExampleProps {
  query: string;
}

const SearchExample: React.FC<SearchExampleProps> = ({ query }) => {
  return (
    <Flexbox direction="row" gap="1" alignItems="center" className="max-w-md">
      <Input value={query} disabled onChange={() => {}} className="flex-1 text-sm font-mono" />
      <button
        onClick={() => {
          window.location.href = `/packages?q=${encodeURIComponent(query)}`;
        }}
        className="text-green-600 hover:text-green-700 cursor-pointer p-1"
        aria-label={`Search for: ${query}`}
      >
        <ArrowRightIcon size={16} />
      </button>
    </Flexbox>
  );
};

const PackageSearchSyntaxModal: React.FC<PackageSearchSyntaxModalProps> = ({ setOpen, isOpen }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md scrollable>
      <ModalHeader setOpen={setOpen}>Package Search Syntax</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="3">
          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Basic Search
            </Text>
            <Text sm className="mb-2">
              Type keywords to search for packages by title. Multiple words will search for packages containing all
              keywords.
            </Text>
            <SearchExample query="reanimator" />
            <Text sm>Finds packages with "reanimator" in the title.</Text>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Advanced Search Operators
            </Text>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Card Search
              </Text>
              <Text sm className="mb-2">
                Search for packages containing specific cards:
              </Text>
              <SearchExample query='card:"Black Lotus"' />
              <SearchExample query="card:Griselbrand" />
              <Text sm>Use quotes for multi-word card names. Searches by card name and finds any printing.</Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Oracle Search
              </Text>
              <Text sm className="mb-2">
                Search for packages containing cards with a specific oracle ID:
              </Text>
              <SearchExample query="oracle:00000000-0000-0000-0000-000000000000" />
              <Text sm>Finds all packages containing any printing of that card.</Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                User Search
              </Text>
              <Text sm className="mb-2">
                Search for packages created by a specific user:
              </Text>
              <SearchExample query="user:username" />
              <Text sm>Shows all packages created by that user.</Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Combining Filters
              </Text>
              <Text sm className="mb-2">
                You can combine multiple filters in one search:
              </Text>
              <SearchExample query='reanimator card:"Griselbrand"' />
              <SearchExample query='user:username card:"Sol Ring"' />
              <Text sm>
                Packages must match all specified filters. For card searches, use quotes around multi-word card names.
              </Text>
            </Flexbox>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Sorting
            </Text>
            <Text sm>
              Use the "Sort By" dropdown to sort by:
              <br />• <strong>Popularity</strong> - Most voted packages first
              <br />• <strong>Date</strong> - Most recently created packages first
              <br />
              <br />
              Toggle "Ascending" or "Descending" to change the sort direction.
            </Text>
          </Flexbox>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default PackageSearchSyntaxModal;
