# js-interpreter-tyrant
A test harness for running test262 ecmascript test suite against Neil Fraser's js interpreter

## Install

First you'll want to make sure `@code-dot-org/js-interpreter` is installed since
it is a peer dependency:

```
npm install @code-dot-org/js-interpreter
```

Then you can install `js-interpreter-tyrant`:

```
npm install @code-dot-org/js-interpreter-tyrant
```

## Example Usage

### Running tests

```
js-interpreter-tyrant --run
```

Test results will be saved to `tyrant/test-results-new.json` each time you run this command. If the `--run` option isn't specified, then `js-interpreter-tyrant` will just use the previously saved results for all it's operations.

### Saving test results for future comparison

```
js-interpreter-tyrant --save
```

Since it's a pretty high bar to get _all_ the tests to pass, it's helpful to save the results of your test run for future comparison. Then at least you can figure out if changes you make have fixed or regressed anything as compared to the last time you ran them. The `--save` option will just copy the test results to `tyrant/test-results.json`. It's a good idea to check this in to your repo to live along side the interpreter.

### Comparing test results to previously saved results

```
js-interpreter-tyrant --diff
```

Once you have some saved results, you can make changes to the interpreter and see what the impact those changes had by rerunning the tests and then comparing them with the `--diff` option. This will give you a summary of fixes and regressions compared to the previous test run. For a detailed listing of which specific tests were fixed/regressed, you can add the `--verbose` option.

### Running specific tests

```
js-interpreter-tyrant --run tyrant/test262/test/language/literals/regexp/S7.8.5_A1.4_T2.js
```

You can pass any number of positional arguments to `js-interpreter-tyrant` which
will be interpreted as test files to run. Otherwise all tests will be run.

## All Options

| Option | Alias | Description |
| ------ | ----- | ----------- |
| `--diff` | `-d` | Compare test results to previously saved results |
| `--run` | `-r` | Generate new test results |
| `--rerun` | | Rerun tests that resulted in a regression. Good for fixing timeout failures. If individiual test paths are also passed in, then only those tests will be run, and the test results will be merged into the existing results file  |
| `--splitInto N` | | Used in conjunction with `--run`, only run a portion (1/`N`) of the tests |
| `--splitIndex N` | | Used in conjunction with `--run` and `--splitInto`, specify which portion of the (1/`N`) tests to run |
| `--save` | `-s` | Save the results of the current or previously recorded test run |
| `--threads` | `-t` | Specify the number of threads to use when running the tests. Defaults to the number of processors on your machine |
| `--progress` | | Display a progress bar while running tests |
| `--verbose` | `-v` | Display more verbose output |
| `--root [DIR]` | | Change the root directory where `js-interpreter-tyrant` will look for the test262 suite and results files. Defaults to `tyrant` |
| `--compiledOut [DIR]` | | Directory to dump compiled test files to |
| `--savedResults [FILE]` | | Location of the previously saved test results file. Defaults to `tyrant/test-results.json` |
| `--input [FILE]` | `-i` | Location of the test results file. When used in conjection with `--run`, test results will be stored at this location. |
| `--interpreter` | | The path to the interpreter module to use. Defaults to `@code-dot-rg/js-interpreter/interpreter.js`
| `--circleBuild [BUILD-ID]` | | Downloads and merges build results for the `code-dot-org/JS-Interpreter` repo |
| `--hostPath [PATH]` | | Path to the `js-interpreter` script. Defaults to the `node_modules/js-interpreter/bin/run.js` |
