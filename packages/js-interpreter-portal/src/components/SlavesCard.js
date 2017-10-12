import React, {Component} from 'react';
import {
  Typography,
  Select,
  MenuItem,
  Input,
  List,
  ListItem,
  Card,
  CardHeader,
  CardContent,
  FormControl,
  InputLabel,
  withStyles,
} from 'material-ui';
import Connection from '../client/Connection';
import MainCard from './MainCard';

const NumberDropdown = withStyles({
  formControl: {
    minWidth: 200,
    display: 'block',
  },
})(function NumberDropdown({
  start,
  count,
  id,
  value,
  onChange,
  label,
  classes,
}) {
  const items = [];
  for (let i = start; i < start + count; i++) {
    items.push(
      <MenuItem key={i} value={i}>
        {i}
      </MenuItem>
    );
  }
  return (
    <FormControl className={classes.formControl}>
      <InputLabel htmlFor={id}>
        {label}
      </InputLabel>
      <Select value={value} onChange={onChange} input={<Input id={id} />}>
        {items}
      </Select>
    </FormControl>
  );
});

export default class SlavesCard extends Component {
  static propTypes = {};

  state = {
    slaves: [],
    numThreads: 1,
    formation: null,
  };

  async componentDidMount() {
    const state = await Connection.SlaveManager.getClientState();
    this.setState(state);
    Connection.SlaveManager.onClientStateChange(state => this.setState(state));
  }

  onChangeNumSlaves = async ({target: {value}}) => {
    this.setState({requestedNumSlaves: value});
    await Connection.SlaveManager.setConfig({numSlaves: value});
  };

  onChangeNumThreads = async ({target: {value}}) => {
    await Connection.SlaveManager.setConfig({numThreads: value});
  };

  render() {
    let cost = 0;
    const costs = {
      'Standard-1X': 25,
      'Standard-2X': 50,
      'Performance-M': 250,
      'Performance-L': 500,
    };
    if (this.state.formation) {
      cost = this.state.formation.reduce((sum, dynoType) => {
        const runningTimeMs =
          new Date().getTime() - new Date(dynoType.updatedAt).getTime();
        const runningTimeMonths = runningTimeMs / 1000 / 60 / 60 / 24 / 30;
        return (
          sum + dynoType.quantity * runningTimeMonths * costs[dynoType.size]
        );
      }, 0);
    }
    return (
      <MainCard>
        <CardHeader title="Slaves" />
        <CardContent>
          <Card>
            <CardContent>
              <Typography type="body1">
                Net Cost: ${Math.floor(cost * 1000) / 1000}
              </Typography>
            </CardContent>
            <CardContent>
              <NumberDropdown
                label="Num Slaves"
                start={1}
                count={40}
                id="num-slaves"
                value={this.state.slaves.length}
                onChange={this.onChangeNumSlaves}
              />
              <NumberDropdown
                label="Num Threads"
                start={1}
                count={8}
                id="num-threads"
                value={this.state.numThreads}
                onChange={this.onChangeNumThreads}
              />
            </CardContent>
          </Card>
        </CardContent>
        <CardContent>
          <Card>
            <List>
              {this.state.slaves.map(slave =>
                <ListItem key={slave.id} divider>
                  {slave.id}
                </ListItem>
              )}
            </List>
            {this.state.formation &&
              <CardContent>
                <pre>
                  {JSON.stringify(this.state.formation, null, 2)}
                </pre>
              </CardContent>}
          </Card>
        </CardContent>
      </MainCard>
    );
  }
}
