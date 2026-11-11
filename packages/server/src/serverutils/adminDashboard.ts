import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

/** The admin tools are tabs of /admin/dashboard, keyed by their old page name (/admin/notices is ?tab=notices). */
export const adminTabUrl = (tab: string): string => `/admin/dashboard?tab=${tab}`;

/** Sends an old admin page URL to its tab, keeping its query (e.g. /admin/pathanalysis?path=...). */
export const redirectToAdminTab =
  (tab: string) =>
  (req: Request, res: Response): void => {
    const query = req.originalUrl.split('?')[1];
    redirect(req, res, query ? `${adminTabUrl(tab)}&${query}` : adminTabUrl(tab));
  };
