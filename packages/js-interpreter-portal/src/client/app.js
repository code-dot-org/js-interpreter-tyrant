import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import {Router} from 'react-router';
import createHistory from 'history/createBrowserHistory';

import AppWrapper from '../AppWrapper';

const DEBUG = process.env.NODE_ENV !== 'production';

const history = createHistory();

console.log('heyo...');

ReactDOM.render(
  <Router history={history}>
    <AppWrapper />
  </Router>,
  document.getElementById('app')
);
