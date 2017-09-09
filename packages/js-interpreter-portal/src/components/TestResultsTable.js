import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {shortTestName} from './util';

function flatten(arr) {
  let newArr = [];
  arr.forEach(item => {
    if (Array.isArray(item)) {
      newArr = [...newArr, flatten(item)];
    } else {
      newArr.push(item);
    }
  });
  return newArr;
}

function groupBy(items, getKey, agg) {
  const groups = new Map();
  items.forEach(item => {
    const key = getKey(item);
    if (!groups.get(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });
  if (agg) {
    groups.forEach((value, key) => {
      groups.set(key, agg(key, value, groups));
    });
  }
  return groups;
}

export default class TestResultsTable extends Component {
  static propTypes = {
    results: PropTypes.array.isRequired,
    title: PropTypes.string,
    filter: PropTypes.func,
    level: PropTypes.number,
  };

  static defaultProps = {
    filter: null,
    level: 0,
  };

  state = {
    expanded: {
      'built-ins': true,
      isNaN: true,
    },
  };

  onClickRow = key => () => {
    this.setState({
      expanded: {...this.state.expanded, [key]: !this.state.expanded[key]},
    });
  };

  renderLevel(results) {
    const rows = Array.from(
      groupBy(
        results,
        test =>
          shortTestName(test.file)
            .split('/')
            .slice(this.props.level, this.props.level + 1)
            .join('/'),
        (key, tests) => {
          const byResult = groupBy(tests, test => test.result.pass);
          return {
            results: tests,
            key,
            failed: (byResult.get(false) || []).length,
            passed: (byResult.get(true) || []).length,
            total: tests.length,
          };
        }
      ).values()
    ).map(({results, key, failed, passed, total}) =>
      [
        <tr key={key} onClick={this.onClickRow(key)}>
          <td>
            {key}
          </td>
          <td>
            {passed}/{total}
          </td>
          <td>
            {Math.round(passed / total * 100)}%
          </td>
        </tr>,
      ].concat(
        this.state.expanded[key]
          ? [
              <tr key={key + 'expanded'}>
                <td colSpan={3}>
                  <TestResultsTable
                    results={results}
                    level={this.props.level + 1}
                  />
                </td>
              </tr>,
            ]
          : []
      )
    );
    return (
      <table>
        <thead>
          <tr>
            <th>Directory</th>
            <th># Passed</th>
            <th>% Passed</th>
          </tr>
        </thead>
        <tbody>
          {flatten(rows)}
        </tbody>
      </table>
    );
  }

  render() {
    let {results} = this.props;
    if (this.props.filter) {
      results = results.filter(this.props.filter);
    }

    return (
      <div className="card">
        {this.props.title &&
          <div className="card-content indigo lighten-3">
            <span className="card-title">
              {this.props.title}
            </span>
          </div>}
        <div className="card-content">
          {this.renderLevel(results)}
        </div>
      </div>
    );
  }
}
