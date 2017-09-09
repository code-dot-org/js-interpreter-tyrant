import React, {Component} from 'react';
import PropTypes from 'prop-types';
import TestResultsTable from './TestResultsTable';
import ResultsDiffTable from './ResultsDiffTable';

export default class WebView extends Component {
  static propTypes = {
    results: PropTypes.array.isRequired,
    resultsDiff: PropTypes.object.isRequired,
  };

  findFailures = test => !test.result.pass;

  render() {
    return (
      <div>
        <ResultsDiffTable resultsDiff={this.props.resultsDiff} />
        <TestResultsTable results={this.props.results} title="Test Results" />
        <script>{`setTimeout(() => {location.reload()}, 2000)`}</script>
      </div>
    );
  }
}
