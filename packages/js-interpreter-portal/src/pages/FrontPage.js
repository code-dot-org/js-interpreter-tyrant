import React, {Component} from 'react';
import RunCard from '../components/RunCard';
import VersionSwitcher from '../components/VersionSwitcher';
//import TestResultsTable from '../components/TestResultsTable';
import Grid from 'material-ui/Grid';
import styled from 'styled-components';

const Wrapper = styled(Grid).attrs({container: true, spacing: 24})`
  padding: 24px;
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
          <RunCard />
        </Grid>
        <Grid>
          <Grid item xs={12} md={6} />
        </Grid>
      </Wrapper>
    );
  }
}
