import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ServerEvents, ClientEvents} from '../constants';
import getConnection from '../client/getConnection';
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
  };

  updateVersions = () => {
    getConnection().emit(
      ServerEvents.UPDATE_VERSIONS,
      ({versions, currentVersion}) => {
        this.setState({versions, currentVersion});
      }
    );
  };

  componentDidMount() {
    this.updateVersions();
  }

  selectVersion = version => {
    console.log('emitting', ServerEvents.SELECT_VERSION, version);
    getConnection().emit(
      ServerEvents.SELECT_VERSION,
      version,
      currentVersion => {
        this.setState({currentVersion});
      }
    );
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
          <ul className="collection">
            {this.state.versions.map(({version, commit}) =>
              <li
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
