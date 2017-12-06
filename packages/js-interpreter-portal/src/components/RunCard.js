import moment from 'moment-mini';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
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
  Typography,
  CircularProgress,
} from 'material-ui';
import { withTheme } from 'material-ui/styles';

import MainCard from './MainCard';
import Connection from '../client/Connection';
import TyrantEventQueue, { Events } from '../client/TyrantEventQueue';
import TestResultsTable from './TestResultsTable';
import NumberDropdown from './NumberDropdown';
import { shortTestName, fullTestName } from '../util';

class GlobInput extends Component {
  state = {
    globValue: 'built-ins/Object/defineProperty/*.js',
    numSlaves: 1,
    numThreads: 8,
  };

  static propTypes = {
    onClickRun: PropTypes.func.isRequired,
    onClickKill: PropTypes.func.isRequired,
    masterState: PropTypes.shape({
      running: PropTypes.bool.isRequired,
    }).isRequired,
  };

  componentDidMount() {
    Connection.MasterRunner.onClientStateChange(state => this.setState(state));
  }

  update = key => e => {
    if (this.state.running) {
      Connection.MasterRunner.changeOptions({ [key]: e.target.value });
    } else {
      this.setState({ [key]: e.target.value });
    }
  };

  render() {
    return (
      <Card>
        <CardContent>
          <form noValidate autoComplete="off">
            <TextField
              id="paths"
              label="Test File Glob"
              helperText="Use this to limit the number of files being tested. (i.e. language/types/string/**.js)"
              value={this.state.globValue}
              onChange={e => this.setState({ globValue: e.target.value })}
              margin="normal"
              fullWidth
            />
            <NumberDropdown
              label="Num Slaves"
              start={0}
              count={40}
              id="num-slaves"
              value={this.state.numSlaves}
              onChange={this.update('numSlaves')}
            />
            <NumberDropdown
              label="Num Threads"
              start={1}
              count={8}
              id="num-threads"
              value={this.state.numThreads}
              onChange={this.update('numThreads')}
            />
          </form>
        </CardContent>
        <CardActions>
          <Button
            color="primary"
            raised
            disabled={this.props.masterState.running}
            onClick={() =>
              this.props.onClickRun({
                numThreads: this.state.numThreads,
                numSlaves: this.state.numSlaves,
                tests: this.state.globValue
                  .split(' ')
                  .filter(s => !!s)
                  .map(fn => fullTestName(fn)),
              })
            }
          >
            {this.state.globValue ? 'Run Tests' : 'Run All 40,0000+ Tests'}
          </Button>
          <Button
            raised
            disabled={!this.props.masterState.running}
            onClick={this.props.onClickKill}
          >
            Stop
          </Button>
        </CardActions>
      </Card>
    );
  }
}

@withTheme
export default class RunCard extends Component {
  static propTypes = {
    theme: PropTypes.object.isRequired,
  };

  state = {
    slaves: {},
    masterState: {},
    results: [],
    savedResults: null,
    tab: 'new-results',
    testGlob: '',
    loadingNewResults: false,
  };

  getSlaveState(slaveId) {
    return this.state.slaves[slaveId] || {};
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

  onTyrantEvents = events => {
    const newResults = {};
    events.forEach(event => {
      const { slaveId, eventName, data } = event;
      if (eventName === Events.TICK) {
        const { test } = data;
        newResults[slaveId] = newResults[slaveId] || [];
        newResults[slaveId].push(test);
      } else if (eventName === Events.RERUNNING_TESTS) {
        const { files, retriesLeft } = data;
        const slaveState = this.getSlaveState(slaveId);
        const filesToRemove = new Set(
          files.map(file => file.split('test262')[1])
        );
        const shouldNotBeRemoved = oldTest =>
          !filesToRemove.has(oldTest.file.split('test262')[1]);
        const results = (slaveState.results || []).filter(shouldNotBeRemoved);
        Object.keys(newResults).forEach(slaveId => {
          newResults[slaveId] = newResults[slaveId].filter(shouldNotBeRemoved);
        });
        this.setSlaveState(slaveId, {
          retriesLeft,
          results,
        });
      }
    });
    Object.keys(newResults).forEach(slaveId => {
      const slaveState = this.getSlaveState(slaveId);
      this.setSlaveState(slaveId, {
        results: [...(slaveState.results || []), ...newResults[slaveId]],
      });
    });
  };

  async componentDidMount() {
    TyrantEventQueue.on('multi', this.onTyrantEvents);
    Connection.MasterRunner.onClientStateChange(masterState => {
      this.setState({ masterState });
    });
    this.setState({
      masterState: await Connection.MasterRunner.getClientState(),
    });
    Connection.SlaveRunner.onClientStateChange(newState =>
      this.setSlaveState(newState.slaveId, newState)
    );

    const slaveStates = await Connection.MasterRunner.getSlaveStates();
    slaveStates.forEach(({ result: state, slaveId }) => {
      this.setSlaveState(slaveId, state);
    });

    setInterval(async () => {
      const results = await Connection.MasterRunner.getResults();
      this.setState({ results });
    }, 1000);
  }

  onClickLoadSavedResults = async () => {
    const savedResults = await Connection.MasterRunner.getSavedResults();
    this.setState({ savedResults });
  };

  onClickLoadNewResults = async () => {
    this.setState({ loadingNewResults: true });
    const newResults = await Connection.MasterRunner.getNewDiffResults();
    newResults.forEach(({ result: results, slaveId }) => {
      this.setSlaveState(slaveId, { results });
    });
    this.setState({ loadingNewResults: false });
  };

  onClickSaveResults = async () => {
    await Connection.MasterRunner.saveResults();
  };

  onClickRerunTests = async tests => {
    await Connection.MasterRunner.execute({ tests, rerun: true });
  };
  onClickRun = async ({ numThreads, numSlaves, tests }) => {
    Object.keys(this.state.slaves).forEach(slaveId =>
      this.setSlaveState(slaveId, { results: [] })
    );
    const versionState = await Connection.MasterVersionManager.getClientState();
    Connection.MasterRunner.execute({
      tests,
      numThreads,
      numSlaves,
      sha: versionState.currentVersion.sha,
    });
  };

  onClickRerunRegressedTests = () => {
    const tests = this.getAggregateSlaveState()
      .results.filter(test => test.isRegression)
      .map(test => fullTestName(shortTestName(test.file)));
    this.onClickRerunTests(tests);
  };

  onClickKill = async () => {
    await Connection.MasterRunner.kill();
  };

  handleChange = name => ({ target: { value } }) =>
    this.setState({ [name]: value });

  getAggregateSlaveState() {
    const state = {
      running: 0,
    };
    Object.values(this.state.slaves).forEach(slave => {
      if (slave.running) {
        state.running += 1;
      }
    });
    return state;
  }

  changeTab = (event, tab) => this.setState({ tab });

  render() {
    const { masterState } = this.state;
    const progress =
      masterState.numTests > 0
        ? masterState.numTestsCompleted / masterState.numTests * 100
        : null;

    const hasChangedResults = this.state.results.reduce(
      (found, test) => found || test.isFix || test.isRegression || test.isNew,
      false
    );
    const numRegressions = this.state.results.reduce(
      (num, test) => num + (test.isRegression ? 1 : 0),
      0
    );
    const timeRemaining = moment.duration({ minutes: masterState.minutesLeft });
    return (
      <MainCard>
        <CardHeader title="Test Results" />
        <CardContent>
          <GlobInput
            masterState={masterState}
            onClickRun={this.onClickRun}
            onClickKill={this.onClickKill}
          />
        </CardContent>
        <CardContent>
          <Card>
            <Tabs value={this.state.tab} onChange={this.changeTab}>
              <Tab value="new-results" label="New Results" />
              <Tab value="saved-results" label="Saved Results" />
            </Tabs>
            {this.state.tab === 'saved-results' && (
              <div>
                {this.state.savedResults ? (
                  <TestResultsTable
                    results={this.state.savedResults}
                    onClickRun={this.onClickRerunTests}
                  />
                ) : (
                  <CardContent style={{ textAlign: 'center' }}>
                    <Button
                      raised
                      color="primary"
                      onClick={this.onClickLoadSavedResults}
                    >
                      Load Saved Results
                    </Button>
                    <Typography type="caption" style={{ marginTop: 8 }}>
                      This operation can take a second
                    </Typography>
                  </CardContent>
                )}
              </div>
            )}
            {this.state.tab === 'new-results' && (
              <div>
                <CardContent>
                  {!masterState.running && (
                    <div style={{ textAlign: 'center' }}>
                      <Typography type="body1">
                        Run tests to see new results or...
                      </Typography>
                      {this.state.loadingNewResults && (
                        <CircularProgress size={24} />
                      )}
                      <Button
                        raised
                        color="primary"
                        onClick={this.onClickLoadNewResults}
                        disabled={this.state.loadingNewResults}
                      >
                        Load New Results
                      </Button>
                    </div>
                  )}
                  {masterState.running && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ flexBasis: '100%' }}>
                        <LinearProgress
                          color="accent"
                          mode="determinate"
                          value={progress}
                        />
                      </div>
                      <div style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            color: this.props.theme.palette.secondary[700],
                          }}
                        >
                          {masterState.numTestsCompleted}
                        </span>
                        <span
                          style={{
                            color: this.props.theme.palette.secondary[400],
                          }}
                        >
                          /{masterState.numTests}
                        </span>
                        <Typography color="accent" type="caption">
                          {timeRemaining
                            ? timeRemaining.humanize() + ' left'
                            : '--'}
                        </Typography>
                        <Typography color="accent" type="caption">
                          {this.getAggregateSlaveState().running} slaves
                        </Typography>
                      </div>
                    </div>
                  )}
                </CardContent>
                {this.state.results.length > 0 && (
                  <TestResultsTable
                    results={this.state.results}
                    onClickRun={this.onClickRerunTests}
                  />
                )}
                <CardActions>
                  <Button
                    color="primary"
                    raised
                    disabled={numRegressions === 0 || masterState.running}
                    onClick={this.onClickRerunRegressedTests}
                  >
                    Rerun {numRegressions} Tests
                  </Button>

                  <Button
                    disabled={
                      this.state.results.length === 0 ||
                      masterState.running ||
                      !hasChangedResults
                    }
                    color="primary"
                    raised
                    onClick={this.onClickSaveResults}
                    style={{ marginLeft: 8 }}
                  >
                    {hasChangedResults
                      ? 'Save Results'
                      : 'No New Results To Save'}
                  </Button>
                  <Button
                    href="/test-results-new.json"
                    style={{ marginLeft: 8 }}
                  >
                    Download Results
                  </Button>
                </CardActions>
              </div>
            )}
          </Card>
        </CardContent>
      </MainCard>
    );
  }
}
