export interface EmptyBasicsMessage {
  message: string;
  hint?: { text: string; linkText: string; href: string };
}

export const getEmptyBasicsMessage = (
  basicsBoard: string | undefined,
  canEdit: boolean,
  cubeId: string,
): EmptyBasicsMessage => {
  const id = encodeURIComponent(cubeId);
  const listLink = { linkText: 'the cube list', href: `/cube/list/${id}` };

  if (basicsBoard === 'None') {
    const message = "This cube doesn't provide basic lands for this draft.";
    return canEdit
      ? {
          message,
          hint: {
            text: "To offer basics, change this format's Basics board in",
            linkText: 'Draft Formats settings',
            href: `/cube/settings/${id}?view=draft-formats`,
          },
        }
      : { message };
  }

  if (basicsBoard) {
    const label = basicsBoard.charAt(0).toUpperCase() + basicsBoard.slice(1);
    const message = `This draft uses the ${label} board, but it has no cards.`;
    return canEdit
      ? { message, hint: { text: `To offer basics, add cards to the ${label} board in`, ...listLink } }
      : { message };
  }

  const message = 'No basic lands are available for this draft.';
  return canEdit
    ? { message, hint: { text: "Basic lands come from the cube's Basics board. Add cards to it in", ...listLink } }
    : { message };
};
