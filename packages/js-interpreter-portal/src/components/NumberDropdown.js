import React from 'react';
import {
  Select,
  MenuItem,
  Input,
  FormControl,
  InputLabel,
  withStyles,
  CircularProgress,
} from 'material-ui';

export default withStyles({
  formControl: {
    minWidth: 200,
    display: 'block',
  },
})(function NumberDropdown({
  start,
  count,
  id,
  value,
  onChange,
  label,
  classes,
  loading,
}) {
  const items = [];
  for (let i = start; i < start + count; i++) {
    items.push(
      <MenuItem key={i} value={i}>
        {i}
      </MenuItem>
    );
  }
  return (
    <FormControl className={classes.formControl}>
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        input={<Input id={id} />}
        style={{ minWidth: 70 }}
        renderValue={value => (
          <span>
            {value} {loading && <CircularProgress size={24} />}
          </span>
        )}
      >
        {items}
      </Select>
    </FormControl>
  );
});
