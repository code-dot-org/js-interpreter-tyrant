import React, {Component} from 'react';
import Card, {CardHeader, CardContent, CardActions} from 'material-ui/Card';
import {LinearProgress, Button} from 'material-ui';
import Connection from '../client/Connection';
import TyrantEventQueue, {Events} from '../client/TyrantEventQueue';
import LogOutput from './LogOutput';
import TestResultsTable from './TestResultsTable';

export default class RunCard extends Component {
  static propTypes = {};

  state = {backends: {}};

  run = () => {
    this.setState({numTests: 1, completed: 0});
    Connection.MasterRunner.execute();
  };

  getBackendState(backendId) {
    return this.state.backends[backendId];
  }

  setBackendState(backendId, newState) {
    this.setState({
      backends: {
        ...this.state.backends,
        [backendId]: {
          ...this.getBackendState(backendId),
          ...newState,
        },
      },
    });
  }

  onTick = ({backendId, data: {test}}) => {
    const backendState = this.getBackendState(backendId);
    this.setBackendState(backendId, {
      completed: backendState.completed + 1,
      results: [...backendState.results, test],
    });
  };

  onStartedRunning = ({backendId, data: {numTests}}) => {
    this.setBackendState(backendId, {
      numTests,
      completed: 0,
      results: [],
    });
  };

  componentDidMount() {
    TyrantEventQueue.on(Events.TICK, this.onTick);
    TyrantEventQueue.on(Events.STARTED_RUNNING, this.onStartedRunning);
  }

  getAggregateBackendState() {
    const state = {
      numTests: 0,
      completed: 0,
      results: [],
    };
    Object.values(this.state.backends).forEach(backend => {
      state.numTests += backend.numTests;
      state.completed += backend.completed;
      if (backend.results) {
        state.results = state.results.concat(backend.results);
      }
    });
    return state;
  }

  render() {
    const state = this.getAggregateBackendState();
    const progress =
      state.numTests > 0 ? state.completed / state.numTests * 100 : null;
    return (
      <Card>
        <CardHeader title="Test Results" />
        <CardContent>
          <TestResultsTable results={state.results} />
          {progress !== null &&
            <div>
              <LinearProgress
                color="accent"
                mode="determinate"
                value={progress}
              />
              <LogOutput />
            </div>}
        </CardContent>
        <CardActions>
          <Button color="primary" raised onClick={this.run}>
            Run Tests
          </Button>
        </CardActions>
      </Card>
    );
  }
}
