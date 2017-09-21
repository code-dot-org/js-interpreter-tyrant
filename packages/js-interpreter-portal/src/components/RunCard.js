import React, {Component} from 'react';
import Card, {CardHeader, CardContent, CardActions} from 'material-ui/Card';
import {LinearProgress, Button} from 'material-ui';
import Connection from '../client/Connection';
import TyrantEventQueue, {Events} from '../client/TyrantEventQueue';
import LogOutput from './LogOutput';
import TestResultsTable from './TestResultsTable';

export default class RunCard extends Component {
  static propTypes = {};

  state = {completed: null, numTests: 0, results: []};

  run = () => {
    this.setState({numTests: 1, completed: 0});
    Connection.Runner.execute();
  };

  onTick = ({data: {test}}) => {
    this.setState({
      completed: this.state.completed + 1,
      results: [...this.state.results, test],
    });
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
      <Card>
        <CardHeader title="Test Results" />
        <CardContent>
          <TestResultsTable results={this.state.results} />
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
