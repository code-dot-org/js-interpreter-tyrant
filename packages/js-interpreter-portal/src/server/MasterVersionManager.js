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
import { promisify } from 'util';
import rimraf from 'rimraf';
import RPCInterface from './RPCInterface';
import { Lock } from '../util';

import SlaveVersionManager from '../slave/SlaveVersionManager';

export const rootLock = new Lock('git-root-lock');

export const REPO_ROOT = '/tmp/js-interpreter-repos';
const exec = promisify(ChildProcess.exec);
const spawn = (...args) =>
  new Promise((resolve, reject) => {
    ChildProcess.spawn(...args)
      .on('close', resolve)
      .on('error', reject);
  });
const rmdir = promisify(rimraf);
export const Repos = {
  CODE_DOT_ORG: {
    gitUrl: `https://${process.env.GITHUB_USERNAME}:${
      process.env.GITHUB_PASSWORD
    }@github.com/code-dot-org/JS-Interpreter.git`,
    name: 'origin',
    githubUrl: `https://github.com/code-dot-org/JS-Interpreter`,
  },
  NeilFraser: {
    gitUrl: `https://github.com/NeilFraser/JS-Interpreter.git`,
    name: 'NeilFraser',
    githubUrl: `https://github.com/NeilFraser/JS-Interpreter`,
  },
};

function commitToJSON(commit, repoConfig = Repos.CODE_DOT_ORG) {
  return {
    sha: commit.sha(),
    summary: commit.summary(),
    time: commit.timeMs(),
    author: commit.author().toString(),
    committer: commit.committer().toString(),
    upstreamName: repoConfig.name,
    githubUrl: repoConfig.githubUrl + `/commit/${commit.sha()}`,
  };
}

@RPCInterface({ type: 'master' })
export default class MasterVersionManager {
  static SlaveClass = SlaveVersionManager;

  repo = null;
  repoConfig = Repos.CODE_DOT_ORG;
  clientState = {
    lastLog: '',
    currentVersion: null,
    versions: [],
    commits: [],
    upstream: [],
    updating: false,
  };

  log(msg) {
    console.log(msg);
    this.setClientState({ lastLog: msg });
  }

  getSlaveStates = async () => {
    const states = await this.slaveManager.emitToAllSlaves(
      'SlaveVersionManager.getClientState'
    );
    let slaveStates = {};
    states.forEach(({ slaveId, result }) => {
      slaveStates[slaveId] = result;
    });
    return slaveStates;
  };

  ensureRemotes = async () => {
    this.log('fetching all remotes');
    const remotes = await Remote.list(this.repo);
    await Promise.all(
      Object.keys(Repos).map(async key => {
        const remoteRepoConfig = Repos[key];
        if (!remotes.includes(remoteRepoConfig.name)) {
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

  getArchive = async sha => {
    const outputPath = `${REPO_ROOT}/master-${sha}.zip`;
    await rootLock.waitForLock(async () => {
      if (!fs.existsSync(outputPath)) {
        await exec(`git archive ${sha} --format zip --output ${outputPath}`, {
          cwd: this.getLocalRepoPath(this.repoConfig),
        });
      }
    });
    return outputPath;
  };

  cloneRepo = async () => {
    const localPath = this.getLocalRepoPath(this.repoConfig);
    this.log('deleting old repo');
    await rmdir(localPath);
    this.log('cloning repo...');
    this.repo = await Git.Clone(this.repoConfig.gitUrl, localPath);
    this.log('setting up...');
    const cmds = [
      'git config user.email paul@code.org',
      'git config user.name Tyrant',
      'yarn',
      'curl https://codeload.github.com/tc39/test262/zip/89160ff5b7cb6d5f8938b4756829100110a14d5f -o test262.zip',
      'unzip -q test262.zip',
      'rm -rf tyrant/test262',
      'mv test262-89160ff5b7cb6d5f8938b4756829100110a14d5f tyrant/test262',
    ];
    for (const cmd of cmds) {
      this.log(cmd);
      const parts = cmd.split(' ');
      await this.spawn(parts[0], parts.slice(1));
    }
    this.log('done');
  };

  getCommitLog = async (repoConfig, head) => {
    if (!head) {
      head = await this.repo.getMasterCommit();
    }
    const history = head.history(Revwalk.SORT.Time);
    const jsonCommits = await new Promise((resolve, reject) => {
      // History emits "commit" event for each commit in the branch's history
      const commits = [];
      history.on('commit', commit => {
        commits.push(commitToJSON(commit, repoConfig));
      });
      history.on('end', () => resolve(commits));
      history.on('error', reject);
      history.start();
    });
    return jsonCommits;
  };

  mergeRemote = async remote => {
    this.log('Attempting merge...');
    await this.repo.mergeBranches(
      'master',
      `${remote}/master`,
      this.getSignature(),
      Merge.PREFERENCE.NONE
    );
  };

  getSignature() {
    return Signature.now('Tyrant', 'paul@code.org');
  }

  async commitFile(filePath, commitMessages) {
    const msgs = [];
    commitMessages.forEach(msg => {
      msgs.push('-m');
      msgs.push(msg);
    });
    await this.spawn('git', [
      'commit',
      ...msgs,
      '--author="Tyrant <paul@code.org>"',
      '--',
      filePath,
    ]);
    this.update({ items: ['commits'] });
  }

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

  spawn = async (cmd, args) => {
    return await spawn(cmd, args, {
      cwd: this.getLocalRepoPath(this.repoConfig),
      stdio: 'inherit',
    });
  };

  pushUpstream = async () => {
    this.log(`pushing master to ${Repos.CODE_DOT_ORG.gitUrl}`);
    await this.spawn(`git`, [
      'push',
      '--force',
      Repos.CODE_DOT_ORG.gitUrl,
      'refs/heads/master:refs/heads/tyrant-changes',
    ]);
    this.log('finished pushing to master');
    await this.update();
    await this.mergeUpstreamMaster();
  };

  mergeUpstreamMaster = async () => {
    await rootLock.waitForLock(async () => {
      this.repo.mergeBranches('master', 'origin/master');
    });
  };

  update = async options => {
    if (this.clientState.updating) {
      return this.clientState;
    }
    options = { items: ['all'], reset: false, ...options };
    const { reset } = options;
    this.log('Updating interpreter versions');
    this.setClientState({ updating: true });

    await rootLock.waitForLock(async () => {
      const localPath = this.getLocalRepoPath(this.repoConfig);
      if (!reset && fs.existsSync(localPath)) {
        try {
          this.repo = await Repository.open(localPath);
        } catch (e) {
          // well the repo must be screwed up...
          await this.cloneRepo();
        }
      } else {
        await this.cloneRepo();
      }
      let head = await this.repo.getHeadCommit();
      if (!head) {
        console.log("well this repo got screwed up... let's re-clone it!");
        await this.cloneRepo();
        head = await this.repo.getHeadCommit();
      }
      if (options.items.includes('all') || options.items.includes('tags')) {
        this.setClientState({ versions: await this.getVersions() });
      }
      if (options.items.includes('all') || options.items.includes('remotes')) {
        await this.ensureRemotes();
      }
      if (options.items.includes('all') || options.items.includes('commits')) {
        this.log('reading commit history');
        let commits = await this.getCommitLog(Repos.CODE_DOT_ORG);
        const commitsBySha = {};
        commits.forEach(commit => (commitsBySha[commit.sha] = commit));
        let upstream = await this.getCommitLog(
          Repos.NeilFraser,
          await this.repo.getReferenceCommit(
            `refs/remotes/${Repos.NeilFraser.name}/master`
          )
        );
        commits = commits.map(commit => ({ version: commit.summary, commit }));
        for (let i = 0; i < upstream.length; i++) {
          let upstreamCommit = upstream[i];
          let originCommit = commitsBySha[upstreamCommit.sha];
          upstreamCommit.merged = !!originCommit;
          upstream[i] = {
            version: upstreamCommit.summary,
            commit: upstreamCommit,
          };
        }
        const currentVersion = commitToJSON(head);
        this.setClientState({
          currentVersion,
          commits,
          upstream,
        });
      }
      this.setClientState({
        updating: false,
      });
      this.log('Everything is up to date!');
    });
    return this.clientState;
  };

  selectVersion = async sha => {
    await rootLock.waitForLock(async () => {
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
      this.setClientState({ currentVersion });
    });
    return this.clientState.currentVersion;
  };

  mergeCommit = async sha => {
    await rootLock.waitForLock(async () => {
      await this.spawn(`git`, ['merge', sha]);
      this.log(`Successfully merged commit ${sha}`);
      const head = await this.repo.getMasterCommit();
      const currentVersion = {
        sha: head.sha(),
        summary: head.summary(),
        time: head.timeMs(),
      };
      this.setClientState({ currentVersion });
      this.update({ items: ['commits'] });
    });
  };

  getLocalRepoPath(repoConfig, extraPath) {
    const args = [REPO_ROOT, this.slaveId || 'master', repoConfig.name];
    if (extraPath) {
      args.push(extraPath);
    }
    return path.resolve(...args);
  }
}
