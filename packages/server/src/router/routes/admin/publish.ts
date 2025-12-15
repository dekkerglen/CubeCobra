import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';
import { userDao } from 'dynamo/daos';
import { articleDao, episodeDao, podcastDao, videoDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import sendEmail from 'serverutils/email';
import { redirect } from 'serverutils/render';
import { addNotification, getBaseUrl } from 'serverutils/util';
import { Request, Response } from 'types/express';

export const publishHandler = async (req: Request, res: Response) => {
  // Try to find the content in each DAO
  const [article, video, podcast, episode] = await Promise.all([
    articleDao.getById(req.params.id!),
    videoDao.getById(req.params.id!),
    podcastDao.getById(req.params.id!),
    episodeDao.getById(req.params.id!),
  ]);

  const document = article || video || podcast || episode;

  if (!document) {
    req.flash('danger', 'Content not found');
    return redirect(req, res, '/admin/reviewcontent');
  }

  if (document.status !== ContentStatus.IN_REVIEW) {
    req.flash('danger', `Content not in review`);
    return redirect(req, res, '/admin/reviewcontent');
  }

  document.status = ContentStatus.PUBLISHED;
  document.date = new Date().valueOf();

  // Update using the appropriate DAO
  if (article) {
    await articleDao.update(article);
  } else if (video) {
    await videoDao.update(video);
  } else if (podcast) {
    await podcastDao.update(podcast);
  } else if (episode) {
    await episodeDao.update(episode);
  }

  if (document.owner && req.user) {
    const ownerId = typeof document.owner === 'string' ? document.owner : document.owner.id;

    //Normal hydration of User does not contain email, thus we must fetch it in order to notify about their application
    const owner = await userDao.getByIdWithSensitiveData(ownerId);

    if (owner) {
      await addNotification(
        owner as any,
        req.user,
        `/content/${document.type}/${document.id}`,
        `${req.user.username} has approved and published your content: ${document.title}`,
      );

      const baseUrl = getBaseUrl();
      await sendEmail(owner.email, 'Your content has been published', 'content_publish', {
        title: document.title,
        url: `${baseUrl}/content/${document.type}/${document.id}`,
      });
    }
  }

  req.flash('success', `Content published: ${document.title}`);

  return redirect(req, res, '/admin/reviewcontent');
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), publishHandler],
  },
];
