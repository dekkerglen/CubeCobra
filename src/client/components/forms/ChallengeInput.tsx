import React from 'react';

import Input from '../base/Input';

const questions = [
  'What card type attacks and blocks?',
  "What is the name of Magic's discard pile?",
  'What color of mana does a Plains produce?',
  'What color of mana does a Island produce?',
  'What color of mana does a Swamp produce?',
  'What color of mana does a Mountain produce?',
  'What color of mana does a Forest produce?',
  'What is the name of the basic land that produces white mana?',
  'What is the name of the basic land that produces blue mana?',
  'What is the name of the basic land that produces black mana?',
  'What is the name of the basic land that produces red mana?',
  'What is the name of the basic land that produces green mana?',
];

interface ChallengeInputProps {
  name: string;
  question: string;
  answer: string;
  setAnswer: (answer: string) => void;
}

export const generateChallenge = () => {
  const index = Math.floor(Math.random() * questions.length);

  return {
    question: questions[index],
    answer: index,
  };
};

const ChallengeInput: React.FC<ChallengeInputProps> = ({ name, question, answer, setAnswer }) => {
  return (
    <Input
      name={name}
      id={name}
      label={`Security Question: ${question}`}
      value={answer}
      onChange={(e) => setAnswer(e.target.value)}
      otherInputProps={{
        required: true,
      }}
    />
  );
};

export { questions };
export default ChallengeInput;
