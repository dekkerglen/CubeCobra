export function GetCmc(card) {
  return card.cmc !== undefined ? card.cmc : card.details.cmc;
}

export function GetColorCat(colors) {
  if (colors.length === 0) {
    return 'Colorless';
  }
  if (colors.length > 1) {
    return 'Multi';
  }
  if (colors.length === 1) {
    switch (colors[0]) {
      case 'W':
        return 'White';
      case 'U':
        return 'Blue';
      case 'B':
        return 'Black';
      case 'R':
        return 'Red';
      case 'G':
        return 'Green';
      case 'C':
      default:
        return 'Colorless';
    }
  }
}

export default { GetCmc, GetColorCat };
