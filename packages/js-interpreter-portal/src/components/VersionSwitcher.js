import React, {Component} from 'react';
import moment from 'moment-mini';
import Card, {CardHeader, CardContent} from 'material-ui/Card';
import List, {ListItem, ListItemText} from 'material-ui/List';
import {LinearProgress, withStyles} from 'material-ui';
import styled from 'styled-components';

import {ClientEvents} from '../constants';
import Connection from '../client/Connection';

const Commit = styled.span`
  span {
    &:last-child {
      float: right;
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
      <Commit>
        <span>{sha.slice(0, 6)}</span> {summary}{' '}
        <span>
          {time.format('ll')} {time.format('LT')}
        </span>
      </Commit>
    );
  }

  render() {
    return (
      <Card>
        <CardHeader title="Interpreter Versions" />
        <CardContent style={{padding: 0}}>
          {this.state.lastLog &&
            <p>
              {this.state.lastLog}
            </p>}
          {this.state.updating && <LinearProgress />}
          <List dense>
            {this.state.versions.map(({version, commit}) =>
              <ListItem
                key={commit.sha}
                button
                divider
                disableRipple
                onClick={() => this.selectVersion(version)}
              >
                <ListItemText
                  primary={
                    <span>
                      {commit.sha === this.state.currentVersion.sha &&
                        <strong>(current)</strong>}{' '}
                      {version}
                    </span>
                  }
                  secondary={this.renderCommit(commit)}
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
    );
  }
}
