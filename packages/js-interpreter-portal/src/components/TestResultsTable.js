import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
} from 'material-ui';
import {Folder, Refresh} from 'material-ui-icons';
import Collapse from 'material-ui/transitions/Collapse';
import {withTheme} from 'material-ui/styles';
import styled from 'styled-components';

import {shortTestName} from '../util';

const SecondaryText = styled.span`
  span:after {
    content: '. ';
  }
`;

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
export default class TestResultsTable extends PureComponent {
  static propTypes = {
    results: PropTypes.array.isRequired,
    title: PropTypes.string,
    filter: PropTypes.func,
    level: PropTypes.number,
    theme: PropTypes.object.isRequired,
    onClickRun: PropTypes.func,
  };

  static defaultProps = {
    filter: null,
    level: 0,
    onClickRun: null,
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
    const rowData = groupBy(
      results,
      test =>
        shortTestName(test.file).split('/').slice(level, level + 1).join('/'),
      (key, tests) => {
        const byResult = groupBy(tests, test => test.result.pass);
        const byDiff = groupBy(
          tests,
          test =>
            test.isFix
              ? 'fix'
              : test.isRegression ? 'regression' : test.isNew ? 'new' : 'same'
        );
        return {
          results: tests,
          key,
          failed: (byResult.get(false) || []).length,
          passed: (byResult.get(true) || []).length,
          fixed: (byDiff.get('fix') || []).length,
          regressed: (byDiff.get('regression') || []).length,
          newTest: (byDiff.get('new') || []).length,
          total: tests.length,
        };
      }
    );
    return Array.from(rowData.values());
  }

  renderRowText({passed, fixed, regressed, newTest, total}) {
    return (
      <SecondaryText>
        <span>
          {passed}/{total} ({Math.round(passed / total * 100)}%) passed
        </span>
        {fixed > 0 &&
          <span>
            {fixed} fixes
          </span>}
        {regressed > 0 &&
          <span>
            {regressed} regressions
          </span>}
        {newTest > 0 &&
          <span>
            {newTest} new tests
          </span>}
        {!fixed &&
          !regressed &&
          !newTest &&
          <span>no changes from last run</span>}
      </SecondaryText>
    );
  }

  onClickRun = tests => () => {
    this.props.onClickRun(tests.map(test => test.file));
  };

  renderLevel(results, level = 0) {
    return this.getRowData(results, level).map(data => {
      const {results, key} = data;
      const expandable = !key.endsWith('.js');
      const isExpanded = this.state.expanded[key];
      let primary = key;
      if (expandable) {
        primary += '/';
      }
      const row = (
        <ListItem
          divider
          key={key}
          button
          disableRipple
          onClick={expandable ? this.onClickRow(key) : undefined}
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
            secondary={this.renderRowText(data)}
          />
          <ListItemSecondaryAction>
            <IconButton aria-label="Rerun" onClick={this.onClickRun(results)}>
              <Refresh />
            </IconButton>
          </ListItemSecondaryAction>
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
      <List dense disablePadding>
        {this.renderLevel(results)}
      </List>
    );
  }
}
