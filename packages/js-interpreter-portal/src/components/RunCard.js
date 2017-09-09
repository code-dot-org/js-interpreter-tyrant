import React, {Component} from 'react';
import PropTypes from 'prop-types';
import io from 'socket.io-client';
import ApiCalls from '../client/ApiCalls';

export default class RunCard extends Component {
  static propTypes = {};

  componentDidMount() {
    this.io = io();
  }

  run = () => {
    ApiCalls.execute();
  };

  render() {
    return (
      <div className="card">
        <div className="card-content">
          <span className="card-title">Run Tests</span>
          <p>Click the button below to run all the tests!</p>
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
