import React, {Component} from 'react';
import Helmet from 'react-helmet';
import {Route, Switch} from 'react-router-dom';
import AppBar from 'material-ui/AppBar';
import Toolbar from 'material-ui/Toolbar';
import Typography from 'material-ui/Typography';

import FrontPage from './pages/FrontPage';

function NotFound() {
  return <div>Not found</div>;
}

export default class AppWrapper extends Component {
  FrontPage = () => <FrontPage />;

  render() {
    return (
      <div>
        <Helmet>
          <title>JS Interpreter Tyrant</title>
        </Helmet>
        <AppBar position="static">
          <Toolbar>
            <Typography type="title" color="inherit">
              JS Interpreter Tyrant
            </Typography>
          </Toolbar>
        </AppBar>
        <div>
          <Switch>
            <Route exact path="/" component={FrontPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    );
  }
}
