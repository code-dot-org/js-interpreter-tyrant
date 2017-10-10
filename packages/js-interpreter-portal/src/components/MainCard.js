import React, {Component} from 'react';
import {Card} from 'material-ui';
import {grey} from 'material-ui/colors';

export default props =>
  <Card raised style={{background: grey[200], ...props.style}} {...props} />;
