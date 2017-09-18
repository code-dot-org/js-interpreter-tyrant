import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ServerEvents, ClientEvents} from '../constants';
import Connection from '../client/Connection';
import styled from 'styled-components';
import moment from 'moment-mini';

const Wrapper = styled.div`
  .collection-item {
    cursor: pointer;
    &:hover {
      background-color: #eee;
    }
  }
`;

export default class VersionSwitcher extends Component {
  static propTypes = {};

  state = {
    versions: [],
    currentVersion: null,
    lastLog: '',
    updating: false,
  };

  updateVersions = async () => {
    this.setState(await Connection.VersionManager.update());
  };

  componentDidMount() {
    this.updateVersions();
    Connection.on(ClientEvents.VERSION_MANAGER_STATE_CHANGE, newState => {
      this.setState(newState);
    });
  }

  selectVersion = version => {
    Connection.VersionManager.selectVersion(version);
  };

  renderCommit({sha, summary, time}) {
    time = moment(new Date(time));
    return (
      <span>
        <span className="grey-text">{sha.slice(0, 6)}</span> {summary}{' '}
        <span className="right">
          {time.format('ll')} {time.format('LT')}
        </span>
      </span>
    );
  }

  render() {
    return (
      <Wrapper className="card">
        <div className="card-content">
          <span className="card-title">Interpreter Versions</span>
          <p>
            {this.state.lastLog}
          </p>
          {this.state.updating &&
            <div className="progress">
              <div className="indeterminate" />
            </div>}
          <ul className="collection">
            {this.state.versions.map(({version, commit}) =>
              <li
                key={commit.sha}
                className="collection-item"
                onClick={() => this.selectVersion(version)}
              >
                {commit.sha === this.state.currentVersion.sha &&
                  <strong>(current)</strong>}{' '}
                <strong>{version}</strong> {this.renderCommit(commit)}
              </li>
            )}
          </ul>
        </div>
      </Wrapper>
    );
  }
}
