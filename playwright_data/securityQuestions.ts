export function getMagicAnswer(question: string): string {
    switch (question) {
      case 'Security Question: What card type attacks and blocks?':
        return 'Creature';
      case "Security Question: What is the name of Magic's discard pile?":
        return 'Graveyard';
      case 'Security Question: What color of mana does a Plains produce?':
        return 'White';
      case 'Security Question: What color of mana does a Island produce?':
        return 'Blue';
      case 'Security Question: What color of mana does a Swamp produce?':
        return 'Black';
      case 'Security Question: What color of mana does a Mountain produce?':
        return 'Red';
      case 'Security Question: What color of mana does a Forest produce?':
        return 'Green';
      case 'Security Question: What is the name of the basic land that produces white mana?':
        return 'Plains';
      case 'Security Question: What is the name of the basic land that produces blue mana?':
        return 'Island';
      case 'Security Question: What is the name of the basic land that produces black mana?':
        return 'Swamp';
      case 'Security Question: What is the name of the basic land that produces red mana?':
        return 'Mountain';
      case 'Security Question: What is the name of the basic land that produces green mana?':
        return 'Forest';
      default:
        return 'Question not recognized.';
    }
  }
  