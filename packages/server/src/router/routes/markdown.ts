import { render } from '../../serverutils/render';
import { Request, Response } from '../../types/express';

const markdownHandler = (req: Request, res: Response) => {
  return render(req, res, 'MarkdownPage');
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [markdownHandler],
  },
];
