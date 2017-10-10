import React, {Component} from 'react';
import {
  LinearProgress,
  Button,
  Tabs,
  Tab,
  CardHeader,
  CardContent,
  CardActions,
  Card,
  TextField,
} from 'material-ui';

import Connection from '../client/Connection';
import TyrantEventQueue, {Events} from '../client/TyrantEventQueue';
import LogOutput from './LogOutput';
import TestResultsTable from './TestResultsTable';

class GlobInput extends Component {
  state = {
    value: '',
  };

  render() {
    return (
      <form noValidate autoComplete="off">
        <TextField
          id="paths"
          label="Test Glob"
          value={this.state.value}
          onChange={e => this.setState({value: e.target.value})}
          margin="normal"
          fullWidth
        />
        <Button
          color="primary"
          raised
          onClick={() =>
            this.props.onClickRun(
              this.state.value.split(' ').map(fn => `tyrant/test262/test/${fn}`)
            )}
        >
          Run Tests
        </Button>
        <Button
          disabled={!this.props.hasResults}
          color="primary"
          raised
          onClick={this.props.onClickSaveResults}
          style={{marginLeft: 8}}
        >
          Save Results
        </Button>
      </form>
    );
  }
}

export default class RunCard extends Component {
  static propTypes = {};

  state = {
    slaves: {},
    savedResults: [],
    tab: 'new-results',
    testGlob: '',
  };

  run = tests => {
    this.setState({numTests: tests ? tests.length * 2 : 1, completed: 0});
    Connection.MasterRunner.execute({tests});
  };

  getSlaveState(slaveId) {
    return this.state.slaves[slaveId];
  }

  setSlaveState(slaveId, newState) {
    this.setState({
      slaves: {
        ...this.state.slaves,
        [slaveId]: {
          ...this.getSlaveState(slaveId),
          ...newState,
        },
      },
    });
  }

  onTick = ({slaveId, data: {test}}) => {
    const slaveState = this.getSlaveState(slaveId);
    this.setSlaveState(slaveId, {
      completed: slaveState.completed + 1,
      results: [...slaveState.results, test],
    });
  };

  onStartedRunning = ({slaveId, data: {numTests}}) => {
    this.setSlaveState(slaveId, {
      numTests,
      completed: 0,
      results: [],
    });
  };

  async componentDidMount() {
    TyrantEventQueue.on(Events.TICK, this.onTick);
    TyrantEventQueue.on(Events.STARTED_RUNNING, this.onStartedRunning);
    Connection.MasterRunner.onClientStateChange(newState => {
      this.setState(newState);
    });
    const savedResults = await Connection.MasterRunner.getSavedResults();
    this.setState({savedResults});
  }

  onClickSaveResults = async () => {
    await Connection.MasterRunner.saveResults(
      this.getAggregateSlaveState().results
    );
  };

  onClickRerunTests = async tests => {
    this.run(tests);
  };
  onClickRun = () => this.run(this.state.testGlob.split(' '));

  handleChange = name => ({target: {value}}) => this.setState({[name]: value});

  getAggregateSlaveState() {
    const state = {
      numTests: 0,
      completed: 0,
      results: [],
    };
    Object.values(this.state.slaves).forEach(slave => {
      state.numTests += slave.numTests;
      state.completed += slave.completed;
      if (slave.results) {
        state.results = state.results.concat(slave.results);
      }
    });
    return state;
  }

  changeTab = (event, tab) => this.setState({tab});

  render() {
    const state = this.getAggregateSlaveState();
    const progress =
      state.numTests > 0 ? state.completed / state.numTests * 100 : null;
    const hasResults = state.results && state.results.length > 0;
    return (
      <Card>
        <CardHeader title="Test Results" />
        <CardContent>
          <Tabs value={this.state.tab} onChange={this.changeTab}>
            <Tab value="saved-results" label="Saved Results" />
            <Tab
              value="new-results"
              label="New Results"
              disabled={!hasResults}
            />
          </Tabs>
          {/*this.state.tab === 'saved-results' &&
            <TestResultsTable
              results={this.state.savedResults}
              onClickRun={this.onClickRerunTests}
            />*/}
          {this.state.tab === 'new-results' &&
            <TestResultsTable
              results={state.results}
              onClickRun={this.onClickRerunTests}
            />}
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
        <CardContent>
          <GlobInput
            onClickRun={this.onClickRerunTests}
            onClickSaveResults={this.onClickSaveResults}
            hasResults={hasResults}
          />
        </CardContent>
        <CardContent />
      </Card>
    );
  }
}
