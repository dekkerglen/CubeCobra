import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import {
  Row,
  Col,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Input,
} from 'reactstrap';

import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import LoadingButton from 'components/LoadingButton';
import { csrfFetch } from 'utils/CSRF';
import socketIOClient from 'socket.io-client';
import useMount from 'hooks/UseMount';

let addMessage = () => {};

const RedPocPage = ({ loginCallback, room }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  addMessage = (m) => {
    setMessages(messages.concat([m]));
  };

  useMount(() => {
    const socket = socketIOClient('localhost:8080', { rejectUnauthorized: false });
    socket.emit('joinRoom', room);
    socket.on('message', (data) => {
      addMessage(data);
    });
  });

  // TODO: replace with listener and make API call to push message
  const publishMessage = async () => {
    const res = await csrfFetch(`/multiplayer/publishmessage`, {
      method: 'POST',
      body: JSON.stringify({ message, room }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(await res.json());

    setMessage('');
  };

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3 mx-4">
        <CardHeader>
          <h5>Redis Proof of Concept</h5>
        </CardHeader>
        <CardBody>
          {messages.map((m) => (
            <Row>
              <Col xs={12}>{m}</Col>
            </Row>
          ))}
        </CardBody>
        <CardFooter>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Message</InputGroupText>
            </InputGroupAddon>
            <Input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
            <InputGroupAddon addonType="append">
              <LoadingButton color="success" className="square-left" onClick={publishMessage}>
                Apply
              </LoadingButton>
            </InputGroupAddon>
          </InputGroup>
        </CardFooter>
      </Card>
    </MainLayout>
  );
};

RedPocPage.propTypes = {
  loginCallback: PropTypes.string,
  room: PropTypes.string.isRequired,
};

RedPocPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(RedPocPage);
