import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import {Router} from 'react-router';
import createHistory from 'history/createBrowserHistory';
import Connection from './Connection';
import AppWrapper from '../AppWrapper';
import TyrantEventQueue from './TyrantEventQueue';

const DEBUG = process.env.NODE_ENV !== 'production';

const history = createHistory();
Connection.initClient(() => {
  TyrantEventQueue.init();
  ReactDOM.render(
    <Router history={history}>
      <AppWrapper />
    </Router>,
    document.getElementById('app')
  );
});
