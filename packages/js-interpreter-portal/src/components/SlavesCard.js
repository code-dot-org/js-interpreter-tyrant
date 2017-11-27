import React, { Component } from 'react';
import {
  Typography,
  Select,
  MenuItem,
  Input,
  List,
  ListItem,
  ListItemText,
  Card,
  CardHeader,
  CardContent,
  FormControl,
  InputLabel,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Table,
  withStyles,
  CircularProgress,
} from 'material-ui';
import Connection from '../client/Connection';
import MainCard from './MainCard';
import moment from 'moment-mini';

export default class SlavesCard extends Component {
  static propTypes = {};

  state = {
    slaves: [],
    numThreads: 1,
    formation: null,
    numRequestedSlaves: 0,
  };

  async componentDidMount() {
    const state = await Connection.SlaveManager.getClientState();
    this.setState(state);
    Connection.SlaveManager.onClientStateChange(state => this.setState(state));
  }

  onChangeNumSlaves = async ({ target: { value } }) => {
    await Connection.SlaveManager.setConfig({ numSlaves: value });
  };

  onChangeNumThreads = async ({ target: { value } }) => {
    await Connection.SlaveManager.setConfig({ numThreads: value });
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
          new Date().getTime() - new Date(dynoType.updated_at).getTime();
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
          </Card>
        </CardContent>
        <CardContent>
          <Card>
            <List>
              {this.state.slaves.map(slave => (
                <ListItem key={slave.id} divider>
                  <ListItemText
                    primary={slave.id}
                    secondary={
                      <span>
                        started at{' '}
                        {moment(new Date(slave.startedAt)).format('LT')}{' '}
                        {slave.restarting && (
                          <span>
                            &middot; restarting...{' '}
                            <CircularProgress size={20} />
                          </span>
                        )}
                      </span>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </CardContent>
        <CardContent>
          Formation
          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Updated At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {this.state.formation &&
                  this.state.formation.map(
                    ({ type, quantity, size, updated_at }) => (
                      <TableRow>
                        <TableCell>{type}</TableCell>
                        <TableCell>{quantity}</TableCell>
                        <TableCell>{size}</TableCell>
                        <TableCell>
                          {moment(new Date(updated_at)).format('LT')}
                        </TableCell>
                      </TableRow>
                    )
                  )}
              </TableBody>
            </Table>
          </Card>
        </CardContent>
      </MainCard>
    );
  }
}
