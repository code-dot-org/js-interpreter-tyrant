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
} from 'material-ui';
import Connection from '../client/Connection';
import {ClientEvents} from '../constants';

export default class SlavesCard extends Component {
  static propTypes = {};

  state = {
    slaves: [],
  };

  async componentDidMount() {
    const slaves = await Connection.SlaveManager.getBackends();
    this.setState({slaves});
    Connection.on(ClientEvents.SLAVE_MANAGER_STATE_CHANGE, slaves =>
      this.setState({slaves})
    );
  }

  onChangeNumSlaves = async ({target: {value}}) => {
    await Connection.SlaveManager.setNumBackends({numBackends: value});
  };

  render() {
    const menuItems = [];
    for (let i = 1; i <= 8; i++) {
      menuItems.push(
        <MenuItem key={i} value={i}>
          {i}
        </MenuItem>
      );
    }
    return (
      <Card>
        <CardHeader title="Slaves" />
        <CardContent>
          <Select
            value={this.state.slaves.length}
            onChange={this.onChangeNumSlaves}
            input={<Input id="num-slaves" />}
          >
            {menuItems}
          </Select>
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
