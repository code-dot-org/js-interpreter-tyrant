import RPCInterface from './RPCInterface';
import SlaveVersionManager from '../slave/SlaveVersionManager';

@RPCInterface({type: 'master'})
export default class MasterVersionManager {
  static SlaveClass = SlaveVersionManager;

  clientState = {
    lastLog: '',
    currentVersion: null,
    versions: [],
    updating: false,
  };

  update = async () => {
    this.slaveManager.emitToAllSlaves('SlaveVersionManager.update');
  };

  selectVersion = async version => {
    this.slaveManager.emitToAllSlaves(
      'SlaveVersionManager.selectVersion',
      version
    );
  };

  mergeCommit = async sha => {
    this.slaveManager.emitToAllSlaves('SlaveVersionManager.mergeCommit', sha);
  };

  pushUpstream = async () => {
    await this.slaveManager.emitToPrimarySlave(
      'SlaveVersionManager.pushUpstream'
    );
    await this.slaveManager.emitToAllSlaves('SlaveVersionManager.update');
    await this.slaveManager.emitToAllSlaves(
      'SlaveVersionManager.mergeUpstreamMaster'
    );
  };
}
