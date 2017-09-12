import React, {Component} from 'react';
import PropTypes from 'prop-types';
import TyrantEventQueue, {Events} from '../client/TyrantEventQueue';
import styled from 'styled-components';

const Wrapper = styled.div`
  padding: 10px;
  min-height: 100px;
  max-height: 350px;
  overflow: scroll;
  pre {
    margin: 0px;
    span {
      font-size: smaller;
    }
    white-space: pre-wrap;
  }
`;

function formatMessage(message) {
  while (message[0] === '\n') {
    message = message.slice(1);
  }
  return message;
}

export default class LogOutput extends Component {
  onLogVersionChange = () =>
    this.setState({
      logVersion: TyrantEventQueue.getVersion([Events.LOG, Events.WRITE]),
    });

  componentDidMount() {
    TyrantEventQueue.on(Events.LOG, this.onLogVersionChange).on(
      Events.WRITE,
      this.onLogVersionChange
    );
  }

  componentWillUnmount() {
    TyrantEventQueue.removeEventListener(Events.LOG, this.onLogVersionChange);
  }

  getMessages = () => {
    const nodes = [];
    let lastEvent = null;
    function renderLastEvent() {
      const {timestamp, eventName, eventId, data: {message}} = lastEvent;
      nodes.push(
        <pre key={eventId}>
          <span className="grey-text">
            {timestamp.format('HH:mm:ss.SSS')}:
          </span>{' '}
          {formatMessage(message)}
        </pre>
      );
    }
    TyrantEventQueue.getEvents().forEach(event => {
      if (![Events.LOG, Events.WRITE].includes(event.eventName)) {
        return;
      }
      const {eventName, data: {message}} = event;
      if (
        eventName === Events.LOG ||
        (eventName === Events.WRITE && !lastEvent)
      ) {
        // make sure we "complete" the last log entry
        if (lastEvent) {
          renderLastEvent();
        }
        lastEvent = event;
      } else if (eventName === Events.WRITE && lastEvent) {
        lastEvent.data.message += message;
      }
    });

    if (lastEvent) {
      renderLastEvent();
    }
    return nodes;
  };

  render() {
    const RE = /^(?=\s)*/g;
    return (
      <Wrapper className="grey darken-3 white-text">
        {this.getMessages()}
      </Wrapper>
    );
  }
}
