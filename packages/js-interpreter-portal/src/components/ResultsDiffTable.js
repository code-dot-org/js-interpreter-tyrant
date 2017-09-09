import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {shortTestName} from './util';

function sum(values) {
  if (!Array.isArray(values)) {
    values = Object.values(values);
  }
  return values.reduce((a, s) => a + s, 0);
}

function sorted(arr, key) {
  const newArr = [...arr];
  newArr.sort(key);
  return newArr;
}

export default class ResultsDiffTable extends Component {
  static propTypes = {
    resultsDiff: PropTypes.object.isRequired,
  };

  renderSummaryTable() {
    const {numNew, numFixes, numRegressions} = this.props.resultsDiff;

    return (
      <table>
        <thead>
          <tr>
            <th># Regressions</th>
            <th># Fixes</th>
            <th># New Tests</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {sum(numRegressions)}
            </td>
            <td>
              {sum(numFixes)}
            </td>
            <td>
              {sum(numNew)}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  renderDetailTable() {
    const {testsThatDiffer} = this.props.resultsDiff;
    return (
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Description</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {sorted(
            testsThatDiffer.regressions,
            ({newTest: {file}}, {newTest: {file: file2}}) => file
          ).map(({oldTest, newTest}) =>
            <tr key={newTest.file + newTest.attrs.description}>
              <td>
                {shortTestName(newTest.file)}
              </td>
              <td>
                {newTest.attrs.description}
              </td>
              <td>
                {newTest.result.message}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  render() {
    return (
      <div className="card">
        <div className="card-content indigo lighten-3">
          <span className="card-title">Diff</span>
        </div>
        <div className="card-content">
          {this.renderSummaryTable()}
          {this.renderDetailTable()}
        </div>
      </div>
    );
  }
}
