import RPCInterface from './RPCInterface';
import SlaveVersionManager from '../slave/SlaveVersionManager';

@RPCInterface({ type: 'master' })
export default class MasterVersionManager {
  static SlaveClass = SlaveVersionManager;

  clientState = {
    operationLog: [],
  };

  logOperation(opType, ...args) {
    this.setClientState({
      operationLog: [...this.clientState.operationLog, { opType, args }],
    });
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

  update = async () => {
    this.slaveManager.emitToAllSlaves('SlaveVersionManager.update');
    this.logOperation('update');
  };

  selectVersion = async version => {
    this.slaveManager.emitToAllSlaves(
      'SlaveVersionManager.selectVersion',
      version
    );
    this.logOperation('selectVersion', version);
  };

  mergeCommit = async sha => {
    this.slaveManager.emitToAllSlaves('SlaveVersionManager.mergeCommit', sha);
    this.logOperation('mergeCommit', sha);
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
