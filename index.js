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
}


// utility functions
function parseOptions(options) {
  if (options.heapdumpOnOOM === undefined) {
    options.heapdumpOnOOM = true;
  }
  if (options.threshold === undefined) {
    options.threshold = 90;
  } else {
    options.threshold = parseInt(options.threshold);
  }
  if (options.port === undefined) {
    options.port = 9229;
  } else {
    options.port = parseInt(options.port);
  }
  if (options.path === undefined) {
    options.path = "OoM-" + process.pid + "-" + Date.now();
  }
  if (options.limit === undefined) {
    options.limit = 3;
  } else {
    options.limit = parseInt(options.limit);
  }
}
