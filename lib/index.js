let cp = require("child_process");
let fs = require("fs");
let path = require("path");

class NodeOomHeapDumpImpl {
  constructor(options) {
    this._opts = options;
    this._heapSnapshots = [];

    if (this._opts.heapdumpOnOOM) {
      this._monitorHeap();
    }
  }

  _monitorHeap() {
    // see https://www.npmjs.com/package/gc-stats
    let gcStats = new require('gc-stats')();
    gcStats.on('stats', (stats) => {
      // gctype 2 is a Full GC (Mark/Sweep/Compact)
      if (stats.gctype === 2 && !this._busy) {
        let heapSizeUsedPercentage = (parseInt(stats.after.totalHeapSize) / parseInt(stats.after.heapSizeLimit)) * 100;
        if (heapSizeUsedPercentage > this._opts.threshold) {

          // this is a full GC and the used heap size is using more than 80% of the assigned heap space limit
          console.warn('OoM is imminent: Full GC (Mark/Sweep/Compact) complete and still more than %s% (%s%) of the heap is used. Creating heapdump now. GC stats: ', this._opts.threshold, Math.round(heapSizeUsedPercentage), stats);

          this.createHeapSnapshot(path.resolve('./' + this._opts.path + '.heapsnapshot'), "OoM");
          
          // block execution of other code for a while (5 second) to enable snapshot to be created
          const time = Date.now();
          let diff = 0;
          do {
             diff = Date.now() - time;
          }
          while (diff < 5000);
        }
      }
    });
  }

  /**
   * Returns the path to the created heap snapshot in a promise, or rejects on error
   * @param {String} snapshotPath - path of the snapshot
   * @param {String} logPrefix - optional log prefix message when heapdumo is created
   * @return {Promise} the heap snapshot path on success or error on rejection
   */
  createHeapSnapshot(snapshotPath, logPrefix) {
    // start OoMworker to create heapdump
    let child = cp.spawn('node', [path.resolve(__dirname, './heapdumpWorker.js'), this._opts.port, snapshotPath, logPrefix || ""], {
      cmd: path.dirname(require.main.filename),
      stdio: 'inherit'
    });

    return new Promise((resolve, reject) => {
      this._busy = true;
      var error = null;

      if (!snapshotPath) {
        snapshotPath = path.resolve(__dirname, "./heapsnapshot-" + Date.now());
      }
      if (!snapshotPath.endsWith(".heapsnapshot")) {
        snapshotPath = snapshotPath + ".heapsnapshot";
      }
      // resolve to absolute file path
      snapshotPath = path.resolve(snapshotPath);

      child.on('error', (err) => {
        error = err;
        reject(err);
      });
      child.on('exit', () => {
        if (!error) {
          if (!this._heapSnapshots.includes(snapshotPath)) {
            this._heapSnapshots.push(snapshotPath);
          }
          resolve(snapshotPath);
        }
        this._busy = false;
      });
    });
  }

  /**
   * Delete all created heap snapshots
   */
  deleteAllHeapSnapshots() {
    this._heapSnapshots.forEach((snapshotPath) => {
      this.deleteHeapSnapshot(snapshotPath);
    });
  }

  /**
   * Deletes a particular snapshot from disk
   * @param {String} snapshotPath - path of the heap snapshot to delete 
   * @return {Promise}
   */
  deleteHeapSnapshot(snapshotPath) {
    return new Promise((resolve, reject) => {
      if (this._heapSnapshots.includes(snapshotPath)) {
        fs.unlink(snapshotPath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(snapshotPath);
          }
        });
      } else {
        reject(new Error("File not found:" + snapshotPath));
      }
    });
  }
}

module.exports = NodeOomHeapDumpImpl;