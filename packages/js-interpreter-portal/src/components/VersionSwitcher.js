import React, {Component} from 'react';
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

import {ClientEvents} from '../constants';
import Connection from '../client/Connection';

const Commit = styled.span`
  span {
    &:last-child {
      float: right;
    }
  }
`;

function CommitText({commit: {sha, summary, time, author, committer}}) {
  time = moment(new Date(time));
  return (
    <span>
      <span>
        {sha.slice(0, 6)}
      </span>
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
    this.setState({numToShow: this.state.numToShow + 30});
  };

  render() {
    const {onClickMerge, current, commits, onClickCommit} = this.props;
    return (
      <CardContent style={{padding: 0}}>
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
              }) =>
                <ListItem key={sha} divider>
                  <Grid container>
                    <Grid item xs={sha === current ? 12 : 8}>
                      <div>
                        {sha === current && <strong>(current)</strong>}{' '}
                        <a
                          href={`https://github.com/${upstreamName}/JS-Interpreter/commit/${sha}`}
                          target="_blank"
                        >
                          {sha.slice(0, 6)}
                        </a>{' '}
                        {version}
                      </div>
                      <Typography type="caption">
                        {author}{' '}
                        {committer &&
                          committer !== author &&
                          <span>
                            (Commited by {committer})
                          </span>}
                        <div>
                          {moment(time).format('ll')}{' '}
                          {moment(time).format('LT')}
                        </div>
                      </Typography>
                    </Grid>
                    {sha !== current &&
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
                          {onClickMerge &&
                            <Grid item>
                              <Button
                                raised
                                color="primary"
                                disabled={merged}
                                onClick={() => onClickMerge(sha)}
                              >
                                Merge
                              </Button>
                            </Grid>}
                        </Grid>
                      </Grid>}
                  </Grid>
                </ListItem>
            )}
        </List>
        {this.state.numToShow < commits.length &&
          <Button onClick={this.onClickShowMore}>Show More</Button>}
      </CardContent>
    );
  }
}

export default class VersionSwitcher extends Component {
  static propTypes = {};

  state = {
    versions: [],
    commits: [],
    upstream: [],
    currentVersion: null,
    lastLog: '',
    updating: false,
    tab: 'tags',
  };

  async componentDidMount() {
    Connection.SlaveVersionManager.onClientStateChange(newState => {
      this.setState(newState);
    });
    await Connection.MasterVersionManager.update();
  }

  selectVersion = sha => {
    Connection.MasterVersionManager.selectVersion(sha);
  };

  changeTab = (event, tab) => {
    this.setState({tab});
  };

  onClickMerge = sha => {
    Connection.MasterVersionManager.mergeCommit(sha);
  };

  onClickPushUpstream = () => {
    Connection.MasterVersionManager.pushUpstream();
  };

  onClickReset = () => {
    Connection.MasterVersionManager.update({reset: true});
  };

  render() {
    const upstreamCommits = this.state.upstream
      .filter(({commit}) => !commit.merged)
      .reverse();
    return (
      <Card>
        <CardHeader title="Interpreter Versions" />
        <CardContent>
          <Card>
            {(this.state.lastLog || this.state.updating) &&
              <CardContent>
                <Typography type="body1">
                  {this.state.lastLog && this.state.lastLog}
                </Typography>
                {this.state.updating && <LinearProgress />}
              </CardContent>}
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
            {this.state.currentVersion &&
              <div>
                {this.state.tab === 'tags' &&
                  <CommitList
                    commits={this.state.versions}
                    current={this.state.currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />}
                {this.state.tab === 'commits' &&
                  <CommitList
                    commits={this.state.commits}
                    current={this.state.currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />}
                {this.state.tab === 'upstream' &&
                  <CommitList
                    commits={upstreamCommits}
                    onClickMerge={this.onClickMerge}
                    current={this.state.currentVersion.sha}
                    onClickCommit={this.selectVersion}
                  />}
              </div>}
          </Paper>
        </CardContent>
      </Card>
    );
  }
}
