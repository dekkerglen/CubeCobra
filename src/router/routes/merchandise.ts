import Stripe from 'stripe';

import { csrfProtection } from '../../routes/middleware';
import { Request, Response } from '../../types/express';
import { redirect, render } from '../../util/render';
import util from '../../util/util';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-01-27.acacia',
});

const products = [
  {
    name: 'Year of the Snake Playmat',
    description: `A commemorative Year of the Snake playmat to celebrate the Lunar Year. 24" x 14" Playmat, Black stitched edging.`,
    price: 4000,
    image: 'Final_cubecobra_small.png',
    id: 'prod_Rg7XQwlS2OmWMy',
  },
  {
    name: 'Year of the Snake Token',
    description: `A commemorative token (Snake on one side, Treasure on the back) to celebrate the Year of the Snake. Tokens are standard playing card size (2.5" x 3.5"). Included image is the source art, not a token preview.`,
    price: 100,
    image: 'year_of_the_snake_tokens.png',
    id: 'prod_Rg7ZFbdYo7jUkN',
  },
  {
    name: 'Year of the Snake Pin',
    description: `Commemorative 2" enamel pin to celebrate the lunar new year, ushering in the year of the snake! Glossy red on a shiny gold colored metal plating.`,
    price: 1000,
    image: 'sticker_red.png',
    id: 'prod_Rg7Iknvca5vxzF',
  },
];

const handler = async (req: Request, res: Response) => {
  try {
    return render(
      req,
      res,
      'MerchandisePage',
      {},
      {
        title: `Cube Cobra Merchandise`,
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

const checkout = async (req: Request, res: Response) => {
  try {
    const { body } = req;
    const lineItems = Object.entries(body)
      .filter(([key]) => key.startsWith('prod_'))
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) {
          throw new Error(`Product with id ${productId} not found`);
        }
        return {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: product.price,
          },
          quantity: parseInt(quantity as string, 10),
        };
      });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'], // Adjust the allowed countries as needed
      },
      success_url: `${req.protocol}://${req.get('host')}/merchandise/success`,
      cancel_url: `${req.protocol}://${req.get('host')}/merchandise/cancel`,
    });

    return redirect(req, res, session.url);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
};

const success = async (req: Request, res: Response) => {
  return render(req, res, 'InfoPage', {
    title: 'Order Success',
    content: [
      {
        label: 'Your order has been received',
        text: `Thank you for your purchase! Your order has been received and is being processed. You will receive an email confirmation shortly.`,
      },
    ],
  });
};

const cancel = async (req: Request, res: Response) => {
  return render(req, res, 'InfoPage', {
    title: 'Order Cancelled',
    content: [
      {
        label: 'Your order has been cancelled',
        text: `Your order has been cancelled. If you have any questions, please contact us.`,
      },
    ],
  });
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, handler],
  },
  {
    path: '/checkout',
    method: 'post',
    handler: [csrfProtection, checkout],
  },
  {
    path: '/success',
    method: 'get',
    handler: [csrfProtection, success],
  },
  {
    path: '/cancel',
    method: 'get',
    handler: [csrfProtection, cancel],
  },
];
