import React from 'react';

import { ArrowRightIcon } from '@primer/octicons-react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface SearchSyntaxModalProps {
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
          window.location.href = `/search?q=${encodeURIComponent(query)}`;
        }}
        className="text-green-600 hover:text-green-700 cursor-pointer p-1"
        aria-label={`Search for: ${query}`}
      >
        <ArrowRightIcon size={16} />
      </button>
    </Flexbox>
  );
};

const SearchSyntaxModal: React.FC<SearchSyntaxModalProps> = ({ setOpen, isOpen }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md scrollable>
      <ModalHeader setOpen={setOpen}>Cube Search Syntax</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="3">
          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Basic Search
            </Text>
            <Text sm className="mb-2">
              Type keywords to search for cubes by name. Multiple words will search for cubes containing all keywords.
            </Text>
            <SearchExample query="vintage powered" />
            <Text sm>Finds cubes with both "vintage" and "powered" in the name.</Text>
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
                Search for cubes containing specific cards:
              </Text>
              <SearchExample query='card:"Black Lotus"' />
              <SearchExample query='oracle:"Ancestral Recall"' />
              <Text sm>Use quotes for multi-word card names.</Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Keyword Search
              </Text>
              <Text sm className="mb-2">
                Search for specific keywords in cube names:
              </Text>
              <SearchExample query="keywords:commander" />
              <Text sm>You can combine multiple keywords.</Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Tag Search
              </Text>
              <Text sm className="mb-2">
                Search for cubes with specific tags:
              </Text>
              <SearchExample query="tag:powered" />
              <SearchExample query="tag:budget" />
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Category Search
              </Text>
              <Text sm className="mb-2">
                Search for cubes by category or category prefix:
              </Text>
              <SearchExample query="category:Vintage" />
              <SearchExample query="category:powered" />
              <SearchExample query="category:pauper" />
              <Text sm className="mb-2">
                <strong>Main categories:</strong> Vintage, Legacy+, Legacy, Modern, Premodern, Pioneer, Historic,
                Standard, Set, Custom
              </Text>
              <Text sm>
                <strong>Category prefixes:</strong> Powered, Unpowered, Pauper, Peasant, Budget, Silver-bordered,
                Commander, Battle Box, Multiplayer, Judge Tower, Desert
              </Text>
            </Flexbox>

            <Flexbox direction="col" gap="2" className="mb-3">
              <Text semibold sm className="mb-1">
                Size Search
              </Text>
              <Text sm className="mb-2">
                Search for cubes by card count:
              </Text>
              <SearchExample query="size=360" />
              <SearchExample query="size>450" />
              <SearchExample query="size<180" />
              <Text sm>Use =, &gt;, or &lt; operators. You can also use "cards=" instead of "size=".</Text>
            </Flexbox>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Combining Searches
            </Text>
            <Text sm className="mb-2">
              You can combine multiple search operators:
            </Text>
            <SearchExample query="vintage tag:powered size=360" />
            <Text sm className="mb-2">
              Finds cubes with "vintage" in the name, tagged as "powered", with exactly 360 cards.
            </Text>
            <SearchExample query='card:"Mox Ruby" card:"Mox Sapphire" size>450' />
            <Text sm className="mb-2">
              Finds cubes containing both cards with more than 450 cards.
            </Text>
            <SearchExample query='category:Modern tag:budget card:"Lightning Bolt"' />
            <Text sm>Finds Modern cubes tagged as "budget" that contain Lightning Bolt.</Text>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Current Limitations
            </Text>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <Text sm>
                  Multi-criteria searches will check up to 1000 cubes matching the first term before stopping if no
                  matches to all terms are found.
                </Text>
              </li>
              <li>
                <Text sm>For best performance, put the most restrictive criteria first in your query</Text>
              </li>
            </ul>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold md className="mb-2">
              Tips
            </Text>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <Text sm>Use quotes around multi-word card names or search terms</Text>
              </li>
              <li>
                <Text sm>Searches are case-insensitive</Text>
              </li>
              <li>
                <Text sm>Use the sort and order options to organize your results</Text>
              </li>
            </ul>
          </Flexbox>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)} block>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SearchSyntaxModal;
