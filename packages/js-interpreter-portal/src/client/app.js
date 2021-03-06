import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { Router } from 'react-router';
import createHistory from 'history/createBrowserHistory';
import { MuiThemeProvider, createMuiTheme } from 'material-ui/styles';
import { blue, orange } from 'material-ui/colors';

import Connection from './Connection';
import AppWrapper from '../AppWrapper';
import TyrantEventQueue, { Events } from './TyrantEventQueue';

const theme = createMuiTheme({
  palette: {
    primary: blue,
    secondary: orange,
  },
  overrides: {
    MuiCardHeader: {
      root: {
        backgroundColor: blue[500],
      },
      title: {
        color: 'white',
      },
    },
  },
});

const history = createHistory();
Connection.initClient({
  callback: () => {
    ReactDOM.render(
      <Router history={history}>
        <MuiThemeProvider theme={theme}>
          <AppWrapper />
        </MuiThemeProvider>
      </Router>,
      document.getElementById('app')
    );
  },
});
