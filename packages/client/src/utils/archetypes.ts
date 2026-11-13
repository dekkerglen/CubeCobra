// Whether the served model has archetype topics (render.ts sets reactProps.topicArchetypes); without
// them nothing is classified, so archetype views hide.
export const hasTopicArchetypes = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (window.reactProps as { topicArchetypes?: boolean } | undefined)?.topicArchetypes === true;
};
