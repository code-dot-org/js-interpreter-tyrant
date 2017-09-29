import path from 'path';
import fs from 'fs';
import Git, {
  Tag,
  Repository,
  Checkout,
  Remote,
  Merge,
  Signature,
  Revwalk,
} from 'nodegit';
import ChildProcess from 'child_process';
import {promisify} from 'util';
import rimraf from 'rimraf';
import {ClientEvents} from '../constants';
import RPCInterface from '../server/RPCInterface';

const REPO_ROOT = '/tmp/js-interpreter-repos';
const exec = promisify(ChildProcess.exec);
const rmdir = promisify(rimraf);
export const Repos = {
  CODE_DOT_ORG: {
    gitUrl: 'https://github.com/code-dot-org/JS-Interpreter.git',
    name: 'code-dot-org',
  },
  NeilFraser: {
    gitUrl: 'https://github.com/NeilFraser/JS-Interpreter.git',
    name: 'NeilFraser',
  },
};

function commitToJSON(commit) {
  return {
    sha: commit.sha(),
    summary: commit.summary(),
    time: commit.timeMs(),
    author: commit.author().toString(),
    committer: commit.committer().toString(),
  };
}

@RPCInterface
export default class SlaveVersionManager {
  repo = null;

  constructor(socket, backendId) {
    this.socket = socket;
    this.backendId = backendId;
    this.clientState = {
      lastLog: '',
      currentVersion: null,
      versions: [],
      updating: false,
      backendId: this.backendId,
    };
    this.repoConfig = Repos.CODE_DOT_ORG;
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

  ensureRemotes = async () => {
    const remotes = await Remote.list(this.repo);
    await Promise.all(
      Object.keys(Repos).map(async key => {
        const remoteRepoConfig = Repos[key];
        if (
          remoteRepoConfig !== this.repoConfig &&
          !remotes.includes(remoteRepoConfig.name)
        ) {
          await Remote.create(
            this.repo,
            remoteRepoConfig.name,
            remoteRepoConfig.gitUrl
          );
        }
      })
    );
    await this.repo.fetchAll();
  };

  cloneRepo = async () => {
    const localPath = this.getLocalRepoPath(this.repoConfig);
    this.log('deleting old repo');
    await rmdir(localPath);
    this.log('cloning repo...');
    this.repo = await Git.Clone(this.repoConfig.gitUrl, localPath);
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
  };

  getCommitLog = async head => {
    if (!head) {
      head = await this.repo.getMasterCommit();
    }
    const jsonCommits = [];
    const queue = [head];
    while (queue.length > 0 && jsonCommits.length < 100) {
      const commit = queue.shift();
      jsonCommits.push(commitToJSON(commit));
      const parents = await commit.getParents(1);
      parents.forEach(parent => queue.push(parent));
    }
    jsonCommits.sort((a, b) => b.time - a.time);
    return jsonCommits;
  };

  mergeRemote = async remote => {
    console.log('Attempting merge...');
    await this.repo.mergeBranches(
      'master',
      `${remote}/master`,
      Signature.now('Tyrant', 'paul@code.org'),
      Merge.PREFERENCE.NONE
    );
  };

  async getVersions() {
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
    newVersions.sort((a, b) => b.commit.time - a.commit.time);
    return newVersions;
  }

  getClientState = async () => {
    const versions = await this.getVersions();
    let head = await this.repo.getHeadCommit();
    if (!head) {
      console.log("well this repo got screwed up... let's re-clone it!");
      await this.cloneRepo();
      head = await this.repo.getHeadCommit();
    }
    await this.ensureRemotes();
    let commits = await this.getCommitLog();
    let upstream = await this.getCommitLog(
      await this.repo.getReferenceCommit('refs/remotes/NeilFraser/master')
    );
    commits = commits.map(commit => ({version: commit.summary, commit}));
    upstream = upstream.map(commit => ({version: commit.summary, commit}));
    const currentVersion = commitToJSON(head);
    this.setClientState({
      currentVersion,
      versions,
      commits,
      upstream,
      updating: false,
    });
    return this.clientState;
  };

  update = async () => {
    this.setClientState({updating: true});
    const localPath = this.getLocalRepoPath(this.repoConfig);
    if (fs.existsSync(localPath)) {
      this.repo = await Repository.open(localPath);
    } else {
      await this.cloneRepo();
    }
    return await this.getClientState();
  };

  selectVersion = async sha => {
    //    const tag = await this.repo.getTagByName(version);
    //    const sha = tag.targetId();
    const head = await this.repo.getCommit(sha);
    await Checkout.tree(this.repo, head, {
      checkoutStrategy: Checkout.STRATEGY.FORCE,
    });
    this.repo.setHeadDetached(
      sha,
      this.repo.defaultSignature,
      'Checkout: HEAD ' + sha
    );
    const currentVersion = {
      sha: head.sha(),
      summary: head.summary(),
      time: head.timeMs(),
    };
    this.setClientState({currentVersion});
    return currentVersion;
  };

  getLocalRepoPath(repoConfig, extraPath) {
    const args = [REPO_ROOT, this.backendId, repoConfig.name];
    if (extraPath) {
      args.push(extraPath);
    }
    return path.resolve(...args);
  }
}
