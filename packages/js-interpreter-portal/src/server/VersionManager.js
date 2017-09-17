import path from 'path';
import fs from 'fs';
import Git, {Tag, Repository, Checkout} from 'nodegit';
import ChildProcess from 'child_process';
import {promisify} from 'util';
import {ClientEvents} from '../constants';

const REPO_ROOT = '/tmp/js-interpreter-repos';
const exec = promisify(ChildProcess.exec);
export const Repos = {
  CODE_DOT_ORG: {
    gitUrl: 'https://github.com/code-dot-org/JS-Interpreter.git',
    name: 'code-dot-org',
  },
};

function commitToJSON(commit) {
  return {
    sha: commit.sha(),
    summary: commit.summary(),
    time: commit.timeMs(),
  };
}

export default class VersionManager {
  clientState = {
    lastLog: '',
    currentVersion: null,
    versions: [],
    updating: false,
  };
  repo = null;

  constructor({socket}) {
    this.socket = socket;
  }

  setClientState(newState) {
    this.clientState = {...this.clientState, ...newState};
    this.socket.emit(
      ClientEvents.VERSION_MANAGER_STATE_CHANGE,
      this.clientState
    );
  }

  log(msg) {
    console.log(msg);
    this.setClientState({lastLog: msg});
  }

  async update() {
    this.setClientState({updating: true});
    const repoConfig = Repos.CODE_DOT_ORG;
    const localPath = this.getLocalRepoPath(repoConfig);
    if (fs.existsSync(localPath)) {
      this.repo = await Repository.open(localPath);
    } else {
      this.log('cloning repo...');
      this.repo = await Git.Clone(repoConfig.gitUrl, localPath);
      this.log('running yarn...');
      const cmds = [
        'yarn',
        'curl https://codeload.github.com/tc39/test262/zip/89160ff5b7cb6d5f8938b4756829100110a14d5f -o test262.zip',
        'unzip -q test262.zip',
        'rm -rf tyrant/test262',
        'mv test262-89160ff5b7cb6d5f8938b4756829100110a14d5f tyrant/test262',
      ];
      for (const cmd of cmds) {
        this.log(cmd);
        await exec(cmd, {cwd: localPath});
      }
      this.log('done');
    }
    const versions = await Tag.list(this.repo);
    const newVersions = [];
    for (const version of versions) {
      const tag = await this.repo.getTagByName(version);
      const commit = await this.repo.getCommit(tag.targetId());
      newVersions.push({
        version,
        commit: commitToJSON(commit),
      });
    }

    const head = await this.repo.getHeadCommit();
    const currentVersion = {
      sha: head.sha(),
      summary: head.summary(),
      time: head.timeMs(),
    };
    this.setClientState({
      currentVersion,
      versions: newVersions,
      updating: false,
    });
    return this.clientState;
  }

  async selectVersion(version) {
    const tag = await this.repo.getTagByName(version);
    const head = await this.repo.getCommit(tag.targetId());
    await Checkout.tree(this.repo, head, {
      checkoutStrategy: Checkout.STRATEGY.FORCE,
    });
    this.repo.setHeadDetached(
      tag.targetId(),
      this.repo.defaultSignature,
      'Checkout: HEAD ' + tag.targetId()
    );
    const currentVersion = {
      sha: head.sha(),
      summary: head.summary(),
      time: head.timeMs(),
    };
    this.setClientState({currentVersion});
    return currentVersion;
  }

  getLocalRepoPath(repoConfig, extraPath) {
    const args = [REPO_ROOT, repoConfig.name];
    if (extraPath) {
      args.push(extraPath);
    }
    return path.resolve(...args);
  }
}
