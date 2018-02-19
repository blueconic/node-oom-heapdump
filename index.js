let nodeOomLib = require("./lib");

// private
let instance;

// expose API, which is a singleton
module.exports = function (options) {
  if (!instance) {
    instance = new NodeOomHeapdumpAPI(options);
  }
  return instance;
}

// API class
class NodeOomHeapdumpAPI {
  constructor(options) {
    parseOptions(options || {});

    // verify connectibility on the configured port
    checkPort(options.port);

    this._impl = new nodeOomLib(options);
  }

  /**
   * Returns the path to the created heap snapshot in a promise, or rejects on error
   * @param {String} snapshotPath - path of the snapshot
   * @return {Promise} the heap snapshot path on success or error on rejection
   */
  createHeapSnapshot(snapshotPath) {
    return this._impl.createHeapSnapshot(snapshotPath);
  }

  /**
   * Deletes all previously created heapsnapshots from disk
   */
  deleteAllHeapSnapshots() {
    this._impl.deleteAllHeapSnapshots();
  }

  /**
   * Deletes a particular snapshot from disk
   * @param {String} snapshotPath - path of the heap snapshot to delete
   * @return {Promise}
   */
  deleteHeapSnapshot(snapshotPath) {
    return this._impl.deleteHeapSnapshot(snapshotPath);
  }

  /**
   * Returns the path to the created CPU profile in a promise, or rejects on error
   * @param {String} cpuProfilePath - path of the CPU profile
   * @param {number} duration - the duration of the CPU profile in ms
   * @return {Promise} the CPU profile path on success or error on rejection
   */
  createCpuProfile(cpuProfilePath, duration) {
    if (duration === undefined) {
      duration = 30000;
    } else {
      duration = parseInt(duration);
    }
    return this._impl.createCpuProfile(cpuProfilePath, duration);
  }

  /**
   * Deletes all previously created CPU profiles from disk
   */
  deleteAllCpuProfiles() {
    this._impl.deleteAllCpuProfiles();
  }

  /**
   * Deletes a particular CPU profile from disk
   * @param {String} cpuProfilePath - path to the CPU profile to delete from disk
   * @return {Promise}
   */
  deleteCpuProfile(cpuProfilePath) {
    return this._impl.deleteCpuProfile(cpuProfilePath);
  }
}

// utility functions
function parseOptions(options) {
  if (options.heapdumpOnOOM === undefined) {
    options.heapdumpOnOOM = true;
  }
  if (options.port === undefined) {
    options.port = 9229;
  } else {
    options.port = parseInt(options.port);
  }
  if (options.path === undefined) {
    options.path = "OoM-pid-" + process.pid;
  }
  if (options.addTimestamp === undefined) {
    options.addTimestamp = false;
  } else {
    options.addTimestamp = options.addTimestamp === true;
  }
}

function checkPort(port) {
  const WebSocket = require('ws');

  const ws = new WebSocket('ws://127.0.0.1:' + port);
  try {
    ws.on('error', function error(e) {
      if (e.code !== 'ECONNREFUSED') {
        // this is good; this port should already be taken
        console.log("Debugger is listening on port %s, 'node-oom-heapdump' can function correctly.", port);
      } else {
        // ECONNREFUSED, this is not good
        console.warn("Debugger is not listening on port %s, 'node-oom-heapdump' cannot function correctly. Is the Node.js process started with the --inspect=%s flag?", port, port, e);
      }
    });
  } catch (err) {
    console.error(err);
  }
}