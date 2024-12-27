import { useCallback, useContext, useEffect, useState } from 'react';

import Comment from 'datatypes/Comment';
import { findUserLinks } from 'markdown/parser';
import { wait } from 'utils/Util';
import { CSRFContext } from 'contexts/CSRFContext';

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

const useComments = (
  parent: string,
  type: string,
): [
  Comment[],
  (comment: string) => Promise<void>,
  boolean,
  (editRequest: EditRequest) => Promise<void>,
  string | null,
  () => Promise<void>,
] => {
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
        const json = await response.json();
        console.log(json);
        return;
      }

      const val: { comment: Comment } = await response.json();
      setComments([val.comment, ...comments]);
    },
    [comments, parent, type],
  );

  const editComment = useCallback(
    async (editRequest: EditRequest) => {
      await csrfFetch(`/comment/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: editRequest,
        }),
      });

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
    [comments],
  );

  useEffect(() => {
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
      const result: CommentResponse = await response.json();
      setComments(result.comments);
      setLastKey(result.lastKey);
      setLoading(false);
    };

    getData();
  }, [parent]);

  const getMore = useCallback(async () => {
    setLoading(true);
    // intentionally wait to avoid too many DB queries
    await wait(2000);

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
      const json: CommentResponse = await response.json();
      if (json.success === 'true') {
        setComments([...comments, ...json.comments]);
        setLastKey(json.lastKey);
        setLoading(false);
      }
    }
  }, [parent, lastKey, comments]);

  return [comments, addComment, loading, editComment, lastKey, getMore];
};

export default useComments;
