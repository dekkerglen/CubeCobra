import React, { useMemo } from 'react';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import MainLayout from 'layouts/MainLayout';

const ConfirmActionButton = withModal(Button, ConfirmActionModal);

interface InfoPageProps {
  title: string;
  content: {
    label: string;
    text: string;
    table?: [string, string][];
  }[];
  loginCallback?: string;
}

const products = [
  {
    name: 'Year of the Snake Playmat',
    description: `A commemorative Year of the Snake playmat to celebrate the Lunar Year. 24" x 14" Playmat, Black stitched edging. Art by Grace Lam.`,
    price: 40,
    image: 'Final_cubecobra_small.png',
    id: 'prod_Rg7XQwlS2OmWMy',
  },
  {
    name: 'Year of the Snake Token',
    description: `A commemorative token (Snake on one side, Treasure on the back) to celebrate the Year of the Snake. Tokens are standard playing card size (2.5" x 3.5"). Included image is the source art, not a token preview. Art by Grace Lam.`,
    price: 1,
    image: 'year_of_the_snake_tokens.png',
    id: 'prod_Rg7ZFbdYo7jUkN',
  },
  {
    name: 'Year of the Snake Pin',
    description: `Commemorative 2" enamel pin to celebrate the lunar new year, ushering in the year of the snake! Glossy red on a shiny gold colored metal plating.`,
    price: 10,
    image: 'sticker_red.png',
    id: 'prod_Rg7Iknvca5vxzF',
  },
];

const InfoPage: React.FC<InfoPageProps> = ({ loginCallback }) => {
  const [volume, setVolume] = React.useState<Record<string, number>>(
    Object.fromEntries(products.map((product) => [product.id, 0])),
  );
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(() => {
    return Object.fromEntries(
      Object.entries(volume)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => [key, `${value}`]),
    );
  }, [volume]);

  const price = products.reduce((acc, product) => acc + product.price * (volume[product.id] || 0), 0);

  const handleInputChange = (id: string, value: number) => {
    setVolume((prevVolume) => ({
      ...prevVolume,
      [id]: Math.max(0, Math.round(value)),
    }));
  };

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3 mx-4">
        <CardBody>
          <CSRFForm method="POST" action="/merchandise/checkout" formData={formData} ref={formRef}>
            <Flexbox direction="col" gap="4">
              <Text semibold lg>
                All merchandise is for pre-orders only. Production will start when orders close on March 1st, 2025.
              </Text>
              <Text>
                Shipping to United States and Canada addresses only. Payment will be processed through Stripe, and will
                appear as "Hedron Network" on your statement.
              </Text>
              {products.map((product) => (
                <Row xs={3} md={5} key={product.id}>
                  <Col xs={3} md={1}>
                    <img src={`/content/${product.image}`} alt={product.name} />
                  </Col>
                  <Col xs={2} md={3} className="content-center">
                    <Flexbox direction="col" gap="4">
                      <Text xl semibold>
                        {product.name}
                      </Text>
                      <Text>{product.description}</Text>
                      <Text>{`${product.price}.00 (free shipping, only to United States)`}</Text>
                    </Flexbox>
                  </Col>
                  <Col xs={1} className="content-center">
                    <Input
                      type="number"
                      min="0"
                      value={`${volume[product.id]}` || '0'}
                      onChange={(e) => handleInputChange(product.id, parseInt(e.target.value, 10))}
                      placeholder="Quantity"
                    />
                  </Col>
                </Row>
              ))}
              <ConfirmActionButton
                color="primary"
                type="submit"
                block
                modalprops={{
                  title: 'Confirm Your Order',
                  onClick: () => formRef.current?.submit(),
                  buttonText: 'Proceed to Checkout',
                  message:
                    'All orders are presale only. Production will start when orders close on March 1st, 2025. Shipping to United States and Canada addresses only. Payment will be processed through Stripe, and will appear as "Hedron Network" on your statement.',
                }}
                disabled={price === 0}
              >
                {`Checkout - $${price}.00`}
              </ConfirmActionButton>
            </Flexbox>
          </CSRFForm>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(InfoPage);
