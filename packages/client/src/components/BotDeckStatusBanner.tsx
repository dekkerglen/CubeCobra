import React, { useContext, useEffect, useState } from 'react';

import Alert from 'components/base/Alert';
import { CSRFContext } from 'contexts/CSRFContext';

const POLL_INTERVAL_MS = 30 * 1000;
// Stop polling after ~20 minutes so a wedged build doesn't spin the banner forever.
const MAX_POLLS = 40;

export interface BotDeckStatusBannerProps {
  draftId: string;
  // Whether bot decks were still pending at page render (from the server-rendered draft).
  initiallyPending?: boolean;
  // Whether the bot-deck build had terminally failed at page render.
  initiallyFailed?: boolean;
}

/**
 * Shows a banner for the async bot-deckbuild pipeline: while this draft's bot (AI opponent)
 * decks are still building it polls /draft/botstatus/:id every 30s, then prompts a refresh
 * once they're ready or shows a terminal failure. Renders nothing if the decks were never
 * pending and didn't fail.
 */
const BotDeckStatusBanner: React.FC<BotDeckStatusBannerProps> = ({ draftId, initiallyPending, initiallyFailed }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [pending, setPending] = useState<boolean>(!!initiallyPending);
  // Flipped once the decks finish building during this session, so we can prompt a refresh.
  const [becameReady, setBecameReady] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(!!initiallyFailed);

  useEffect(() => {
    if (!initiallyPending) {
      return;
    }

    let polls = 0;
    const intervalId = window.setInterval(async () => {
      polls += 1;
      try {
        const res = await csrfFetch(`/draft/botstatus/${draftId}`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          // Check failed before pending: a failed draft is no longer pending.
          if (data.failed) {
            setFailed(true);
            setPending(false);
            window.clearInterval(intervalId);
            return;
          }
          if (!data.pending) {
            setBecameReady(true);
            setPending(false);
            window.clearInterval(intervalId);
            return;
          }
        }
      } catch {
        // Ignore transient errors and keep polling.
      }
      if (polls >= MAX_POLLS) {
        window.clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [csrfFetch, draftId, initiallyPending]);

  if (failed) {
    return (
      <Alert color="danger">Bot decks couldn't be built — the opponents' decks are shown in a basic layout.</Alert>
    );
  }

  if (becameReady) {
    return <Alert color="success">Bot decks are ready — please refresh to view the opponents' decks.</Alert>;
  }

  if (pending) {
    return <Alert color="info">Bot decks are building… the opponents' decks will be ready shortly.</Alert>;
  }

  return null;
};

export default BotDeckStatusBanner;
