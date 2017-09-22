import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {List, ListItem, ListItemText, Avatar} from 'material-ui';
import {ExpandLess, ExpandMore, Folder} from 'material-ui-icons';
import Collapse from 'material-ui/transitions/Collapse';
import {withTheme} from 'material-ui/styles';

import {shortTestName} from '../util';

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

@withTheme
export default class TestResultsTable extends Component {
  static propTypes = {
    results: PropTypes.array.isRequired,
    title: PropTypes.string,
    filter: PropTypes.func,
    level: PropTypes.number,
    theme: PropTypes.object.isRequired,
  };

  static defaultProps = {
    filter: null,
    level: 0,
  };

  state = {
    expanded: {},
  };

  onClickRow = key => () => {
    this.setState({
      expanded: {...this.state.expanded, [key]: !this.state.expanded[key]},
    });
  };

  getRowData(results, level = 0) {
    return Array.from(
      groupBy(
        results,
        test =>
          shortTestName(test.file).split('/').slice(level, level + 1).join('/'),
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
    );
  }

  renderLevel(results, level = 0) {
    return this.getRowData(
      results,
      level
    ).map(({results, key, passed, total}) => {
      const expandable = !key.endsWith('.js');
      const isExpanded = this.state.expanded[key];
      let primary = key;
      if (expandable) {
        primary += '/';
      }
      const row = (
        <ListItem
          key={key}
          button
          disableRipple
          onClick={this.onClickRow(key)}
          style={{
            paddingLeft:
              this.props.theme.spacing.unit +
              level * this.props.theme.spacing.unit * 4,
          }}
        >
          {expandable &&
            <Avatar>
              <Folder />
            </Avatar>}
          <ListItemText
            primary={primary}
            secondary={`${passed}/${total} ${Math.round(
              passed / total * 100
            )}%`}
          />
          {expandable && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
        </ListItem>
      );
      if (isExpanded) {
        const rows = this.renderLevel(results, level + 1).map((item, index) =>
          <Collapse
            key={index}
            in={this.state.expanded[key]}
            transitionDuration="auto"
            unmountOnExit
          >
            {item}
          </Collapse>
        );
        return [row, ...rows];
      }
      return [row];
    });
  }

  render() {
    let {results} = this.props;
    if (this.props.filter) {
      results = results.filter(this.props.filter);
    }

    return (
      <List dense>
        {this.renderLevel(results)}
      </List>
    );
  }
}
