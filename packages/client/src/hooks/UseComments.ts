import { useCallback, useContext, useEffect, useState } from 'react';

import Comment from '@utils/datatypes/Comment';

import { findUserLinks } from 'markdown/parser';

import { CSRFContext } from '../contexts/CSRFContext';

export interface EditRequest {
  id: string;
  content?: string;
  remove?: boolean;
}

interface CommentResponse {
  comments: Comment[];
  lastKey: string | null;
  success: 'true';
}

// Guarded JSON parse: the server can return an empty body or an HTML error page
// (rate-limit, 500, stale-deploy 404), and calling response.json() directly on
// those throws "Unexpected end of JSON input" as an unhandled rejection.
const parseJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
};

const useComments = (
  parent: string,
  type: string,
  options?: { enabled?: boolean },
): [
  Comment[],
  (comment: string) => Promise<void>,
  boolean,
  (editRequest: EditRequest) => Promise<void>,
  string | null,
  () => Promise<void>,
] => {
  const enabled = options?.enabled ?? true;
  const { csrfFetch } = useContext(CSRFContext);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const addComment = useCallback(
    async (comment: string) => {
      const mentions = findUserLinks(comment).join(';');
      const response = await csrfFetch(`/comment/addcomment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: comment,
          mentions,
          parent,
          type,
        }),
      });

      if (!response.ok) {
        console.error('Failed to add comment');
        console.log(response);
        const json = await parseJsonSafe(response);
        console.log(json);
        return;
      }

      const val = await parseJsonSafe<{ comment: Comment }>(response);
      if (val?.comment) {
        // Functional update: a reply can be posted before the thread's own fetch has run, so
        // the captured `comments` may be an empty list that is about to be filled.
        setComments((prev) => [val.comment, ...prev]);
      }
    },
    [parent, type, csrfFetch],
  );

  const editComment = useCallback(
    async (editRequest: EditRequest) => {
      const response = await csrfFetch(`/comment/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: editRequest,
        }),
      });

      if (!response.ok) {
        console.error('Failed to edit comment');
        return;
      }

      const clone = JSON.parse(JSON.stringify(comments)) as Comment[];

      for (let i = 0; i < clone.length; i++) {
        if (clone[i].id === editRequest.id) {
          if (editRequest.remove) {
            clone[i].body = '[deleted]';
            clone[i].owner = {
              id: '404',
              username: 'Anonymous',
            };
            clone[i].image = {
              uri: 'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/e/0e386888-57f5-4eb6-88e8-5679bb8eb290.jpg?1608910517',
              artist: 'Allan Pollack',
              id: '0c082aa8-bf7f-47f2-baf8-43ad253fd7d7',
              imageName: 'Ambush Viper',
            };
          } else if (editRequest.content !== undefined) {
            clone[i].body = editRequest.content;
          }
        }
      }

      setComments(clone);
    },
    [comments, csrfFetch],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const getData = async () => {
      const response = await csrfFetch(`/comment/getcomments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent,
        }),
      });
      const result = await parseJsonSafe<CommentResponse>(response);
      if (result) {
        // Merge rather than replace. Replying to a collapsed thread posts the reply and
        // enables this fetch at the same time, and the replies index is eventually
        // consistent, so this response may not contain the reply just written. Overwriting
        // would discard it; the id check keeps it from appearing twice when it is present.
        setComments((prev) => {
          const incoming = new Set(result.comments.map((item) => item.id));
          return [...prev.filter((item) => !incoming.has(item.id)), ...result.comments];
        });
        setLastKey(result.lastKey);
      }
      setLoading(false);
    };

    getData();
  }, [parent, csrfFetch, enabled]);

  const getMore = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/comment/getcomments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent,
        lastKey,
      }),
    });

    if (response.ok) {
      const json = await parseJsonSafe<CommentResponse>(response);
      if (json?.success === 'true') {
        setComments([...comments, ...json.comments]);
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [parent, lastKey, comments, csrfFetch]);

  return [comments, addComment, loading, editComment, lastKey, getMore];
};

export default useComments;
