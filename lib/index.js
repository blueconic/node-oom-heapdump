let cp = require("child_process");
let fs = require("fs");
let path = require("path");

class NodeOomHeapDumpImpl {
  constructor(options) {
    this._opts = options;
    this._heapSnapshots = [];
    this._busy = false;
    this._count = 0;
    this._limitReached = false;

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
        let memoryUsage = process.memoryUsage();
        var memoryUsagePercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
        if (memoryUsagePercentage > this._opts.threshold) {
          if (this._count < this._opts.limit) {
            // this is a full GC and the used heap size is using more than x% of the assigned heap space limit
            console.warn('OoM is imminent: Full GC (Mark/Sweep/Compact) complete and still more than %s% (%s%) of the heap is used. Creating heapdump now. GC stats: ', this._opts.threshold, Math.round(memoryUsagePercentage), stats);

            this.createHeapSnapshot(this._opts.path, "OoM");

            // block execution of other code for a while (5 second) to enable snapshot to be created
            const time = Date.now();
            let diff = 0;
            do {
              diff = Date.now() - time;
            }
            while (diff < 5000);
          } else if (!this._limitReached) {
            this._limitReached = true;
            console.warn("OoM heapdump limit reached (%s); no more heapdumps will be created.", this._opts.limit);
            return;
          }
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
    if (!snapshotPath) {
      snapshotPath = path.resolve(__dirname, "./heapsnapshot");
    }
    if (logPrefix === "OoM" && this._opts.addTimestamp){
      if (snapshotPath.endsWith(".heapsnapshot")) {
        snapshotPath = snapshotPath.replace(".heapsnapshot", "");
      }
      // in case of OoM error, add if timestamp if needed
      snapshotPath += "-" + Date.now();
    }
    if (!snapshotPath.endsWith(".heapsnapshot")) {
      snapshotPath += ".heapsnapshot";
    }

    // resolve to absolute file path
    snapshotPath = path.resolve(snapshotPath);

    // start OoMworker to create heapdump
    let child = cp.spawn('node', [path.resolve(__dirname, './heapdumpWorker.js'), this._opts.port, snapshotPath, logPrefix || ""], {
      cmd: path.dirname(require.main.filename),
      stdio: 'inherit'
    });

    return new Promise((resolve, reject) => {
      this._busy = true;
      var error = null;

      child.on('error', (err) => {
        error = err;
        reject(err);
      });
      child.on('exit', () => {
        if (!error) {
          this._count++;
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