import { handleRouteError, redirect, render } from 'serverutils/render';
import Stripe from 'stripe';

import { Request, Response } from '../../types/express';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    })
  : null;

const products: any[] = [];

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
    return handleRouteError(req, res, err, '/404');
  }
};

const checkout = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

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

    if (!session.url) {
      throw new Error('Failed to create checkout session');
    }

    return redirect(req, res, session.url);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
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
    handler: [handler],
  },
  {
    path: '/checkout',
    method: 'post',
    handler: [checkout],
  },
  {
    path: '/success',
    method: 'get',
    handler: [success],
  },
  {
    path: '/cancel',
    method: 'get',
    handler: [cancel],
  },
];
