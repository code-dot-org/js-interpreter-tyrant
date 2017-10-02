import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {
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
import {ClientEvents} from '../constants';

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
  };

  async componentDidMount() {
    const state = await Connection.SlaveManager.getClientState();
    console.log('got state', state);
    this.setState(state);
    Connection.SlaveManager.onClientStateChange(state => this.setState(state));
  }

  onChangeNumSlaves = async ({target: {value}}) => {
    await Connection.SlaveManager.setConfig({numBackends: value});
  };

  onChangeNumThreads = async ({target: {value}}) => {
    await Connection.SlaveManager.setConfig({numThreads: value});
  };

  render() {
    return (
      <Card>
        <CardHeader title="Slaves" />
        <CardContent>
          <NumberDropdown
            label="Num Slaves"
            start={1}
            count={8}
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
        <CardContent style={{padding: 0}}>
          <List>
            {this.state.slaves.map(slave =>
              <ListItem key={slave.id} divider>
                {slave.id}
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
    );
  }
}
