import React, {Component} from 'react';
import RunCard from '../components/RunCard';
import VersionSwitcher from '../components/VersionSwitcher';
import SlavesCard from '../components/SlavesCard';
import {Grid} from 'material-ui';
import styled from 'styled-components';

const Wrapper = styled(Grid).attrs({container: true, spacing: 24})`
  padding: 24px;
  background-color: white;
`;

export default class FrontPage extends Component {
  static propTypes = {};

  render() {
    return (
      <Wrapper>
        <Grid item xs={12} md={6}>
          <VersionSwitcher />
        </Grid>
        <Grid item xs={12} md={6}>
          <Grid container direction="column" spacing={24}>
            <Grid item>
              <RunCard />
            </Grid>
            <Grid item>
              <SlavesCard />
            </Grid>
          </Grid>
        </Grid>
      </Wrapper>
    );
  }
}
