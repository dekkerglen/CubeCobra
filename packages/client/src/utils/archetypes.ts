// Whether the served model names decks with archetype topics (render.ts sets reactProps.topicArchetypes).
// The legacy cluster centers only classify whole decks, so views that profile a card list hide.
export const hasTopicArchetypes = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (window.reactProps as { topicArchetypes?: boolean } | undefined)?.topicArchetypes === true;
};
