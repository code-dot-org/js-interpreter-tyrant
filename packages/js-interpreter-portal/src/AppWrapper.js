import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import styled from 'styled-components';
import {Link, Route, Switch, withRouter} from 'react-router-dom';
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
        <nav>
          <div className="nav-wrapper indigo">
            <a href="#" className="brand-logo center">
              JS Interpreter Tyrant
            </a>
          </div>
        </nav>
        <div className="grey lighten-3">
          <Switch>
            <Route exact path="/" component={FrontPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    );
  }
}
