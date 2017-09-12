import React, {Component} from 'react';
import PropTypes from 'prop-types';
import moment from 'moment-mini';
import {ServerEvents, ClientEvents} from '../constants';
import getConnection from '../client/getConnection';
import TyrantEventQueue, {Events} from '../client/TyrantEventQueue';
import LogOutput from './LogOutput';

export default class RunCard extends Component {
  static propTypes = {};

  state = {running: false, numTests: 0, data: {}};

  run = () => {
    getConnection().emit(ServerEvents.EXECUTE);
  };

  onTick = ({data}) => {
    this.setState({completed: this.state.completed + 1});
    console.log(event);
  };

  onStartedRunning = ({data: {numTests}}) => {
    this.setState({numTests, completed: 0});
  };

  componentDidMount() {
    TyrantEventQueue.on(Events.TICK, this.onTick);
    TyrantEventQueue.on(Events.STARTED_RUNNING, this.onStartedRunning);
  }

  render() {
    const progress =
      this.state.numTests > 0
        ? this.state.completed / this.state.numTests * 100
        : null;
    return (
      <div className="card">
        <div className="card-content">
          <span className="card-title">Test Results</span>
          {progress !== null &&
            <div>
              <div className="progress">
                <div className="determinate" style={{width: `${progress}%`}} />
              </div>
              <LogOutput />
            </div>}
        </div>
        <div className="card-action">
          <button className="btn" onClick={this.run}>
            Run Tests
          </button>
        </div>
      </div>
    );
  }
}
