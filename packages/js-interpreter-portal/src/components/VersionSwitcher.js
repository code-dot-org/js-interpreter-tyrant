import sortBy from 'lodash.sortby';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment-mini';
import {
  Typography,
  Tabs,
  Tab,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  Grid,
  Paper,
} from 'material-ui';
import styled from 'styled-components';

import { ClientEvents } from '../constants';
import Connection from '../client/Connection';

import MainCard from './MainCard';

const Commit = styled.span`
  span {
    &:last-child {
      float: right;
    }
  }
`;

function CommitText({ commit: { sha, summary, time, author, committer } }) {
  time = moment(new Date(time));
  return (
    <span>
      <span>{sha.slice(0, 6)}</span>
      <span>
        {author} {committer && committer !== author && committer}{' '}
        {time.format('ll')} {time.format('LT')}
      </span>
    </span>
  );
}
CommitText.propTypes = {
  commit: PropTypes.shape({
    sha: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    time: PropTypes.number.isRequired,
    author: PropTypes.string.isRequired,
    committer: PropTypes.string.isRequired,
  }).isRequired,
};

class CommitList extends Component {
  static propTypes = {
    commits: PropTypes.array.isRequired,
    current: PropTypes.string.isRequired,
    onClickCommit: PropTypes.func.isRequired,
    onClickMerge: PropTypes.func,
  };

  static defaultProps = {
    onClickMerge: null,
  };

  state = {
    numToShow: 30,
  };

  onClickShowMore = () => {
    this.setState({ numToShow: this.state.numToShow + 30 });
  };

  render() {
    const { onClickMerge, current, commits, onClickCommit } = this.props;
    return (
      <CardContent style={{ padding: 0 }}>
        <List dense>
          {commits
            .slice(0, this.state.numToShow)
            .map(
              ({
                version,
                commit: {
                  sha,
                  summary,
                  time,
                  author,
                  committer,
                  merged,
                  upstreamName,
                },
              }) => (
                <ListItem key={sha} divider>
                  <Grid container>
                    <Grid item xs={sha === current ? 12 : 8}>
                      <div>
                        {sha === current && <strong>(current)</strong>}{' '}
                        <a
                          href={`https://github.com/${
                            upstreamName
                          }/JS-Interpreter/commit/${sha}`}
                          target="_blank"
                        >
                          {sha.slice(0, 6)}
                        </a>{' '}
                        {version}
                      </div>
                      <Typography type="caption">
                        {author}{' '}
                        {committer &&
                          committer !== author && (
                            <span>(Commited by {committer})</span>
                          )}
                        <div>
                          {moment(time).format('ll')}{' '}
                          {moment(time).format('LT')}
                        </div>
                      </Typography>
                    </Grid>
                    {sha !== current && (
                      <Grid item xs={4}>
                        <Grid
                          container
                          justify="space-around"
                          align="center"
                          spacing={8}
                        >
                          <Grid item>
                            <Button
                              raised
                              color="primary"
                              onClick={() => onClickCommit(sha)}
                            >
                              Checkout
                            </Button>
                          </Grid>
                          {onClickMerge && (
                            <Grid item>
                              <Button
                                raised
                                color="primary"
                                disabled={merged}
                                onClick={() => onClickMerge(sha)}
                              >
                                Merge
                              </Button>
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    )}
                  </Grid>
                </ListItem>
              )
            )}
        </List>
        {this.state.numToShow < commits.length && (
          <Button onClick={this.onClickShowMore}>Show More</Button>
        )}
      </CardContent>
    );
  }
}

export default class VersionSwitcher extends Component {
  static propTypes = {};

  state = {
    tab: 'tags',
    slaves: {},
    masterState: {
      lastLog: '',
      currentVersion: null,
      versions: [],
      commits: [],
      upstream: [],
      updating: false,
    },
  };

  setSlaveState = newState => {
    const slaveState = this.state.slaves[newState.slaveId] || {
      lastLog: '',
    };
    this.setState({
      slaves: {
        ...this.state.slaves,
        [newState.slaveId]: {
          ...slaveState,
          ...newState,
        },
      },
    });
  };

  setMasterState = masterState => {
    this.setState({ masterState });
  };

  async componentDidMount() {
    Connection.SlaveVersionManager.onClientStateChange(this.setSlaveState);
    const slaves = await Connection.MasterVersionManager.getSlaveStates();
    this.setState({
      slaves,
    });

    Connection.MasterVersionManager.onClientStateChange(this.setMasterState);
    this.setMasterState(
      await Connection.MasterVersionManager.getClientState(this.setMasterState)
    );

    Connection.MasterVersionManager.update();
  }

  selectVersion = sha => {
    Connection.MasterVersionManager.selectVersion(sha);
  };

  changeTab = (event, tab) => {
    this.setState({ tab });
  };

  onClickMerge = sha => {
    Connection.MasterVersionManager.mergeCommit(sha);
  };

  onClickPushUpstream = () => {
    Connection.MasterVersionManager.pushUpstream();
  };

  onClickReset = () => {
    Connection.MasterVersionManager.update({ reset: true });
  };

  render() {
    const {
      upstream,
      commits,
      currentVersion,
      versions,
    } = this.state.masterState;
    const upstreamCommits =
      upstream && upstream.filter(({ commit }) => !commit.merged).reverse();
    return (
      <MainCard>
        <CardHeader title="Interpreter Versions" />
        <CardContent>
          <Card>
            <CardContent>
              <Typography type="body1">
                {this.state.masterState.lastLog &&
                  this.state.masterState.lastLog}
              </Typography>
              {this.state.masterState.updating && <LinearProgress />}
            </CardContent>
            {sortBy(Object.values(this.state.slaves), s =>
              parseInt(s.slaveId.split('.')[1])
            )
              .filter(slaveState => slaveState.updating || slaveState.lastLog)
              .map(slaveState => (
                <CardContent key={slaveState.slaveId}>
                  <Typography type="body1">
                    {slaveState.slaveId}:{' '}
                    {slaveState.lastLog && slaveState.lastLog}
                  </Typography>
                  {slaveState.updating && <LinearProgress />}
                </CardContent>
              ))}
            <CardActions>
              <Button raised color="primary" onClick={this.onClickPushUpstream}>
                Push Upstream
              </Button>
              <Button raised color="primary" onClick={this.onClickReset}>
                Reset
              </Button>
            </CardActions>
          </Card>
        </CardContent>

        <CardContent>
          <Paper>
            <Tabs value={this.state.tab} onChange={this.changeTab}>
              <Tab value="tags" label="Tags" />
              <Tab value="commits" label="Commits" />
              <Tab value="upstream" label="Upstream" />
            </Tabs>
            {currentVersion && (
              <div>
                {this.state.tab === 'tags' && (
                  <CommitList
                    commits={versions}
                    current={currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />
                )}
                {this.state.tab === 'commits' && (
                  <CommitList
                    commits={commits}
                    current={currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />
                )}
                {this.state.tab === 'upstream' && (
                  <CommitList
                    commits={upstreamCommits}
                    onClickMerge={this.onClickMerge}
                    current={currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />
                )}
              </div>
            )}
          </Paper>
        </CardContent>
      </MainCard>
    );
  }
}
