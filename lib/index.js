let cp = require("child_process");
let fs = require("fs");
let path = require("path");

class NodeOomHeapDumpImpl {
  constructor(options) {
    this._opts = options;
    this._files = [];
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
        let memoryUsagePercentage = Math.round((stats.after.usedHeapSize / stats.after.heapSizeLimit) * 100);
        if (memoryUsagePercentage > this._opts.threshold) {
          if (this._count < this._opts.limit) {
            // this is a full GC and the used heap size is using more than x% of the assigned heap space limit
            console.warn('OoM is imminent: Full GC (Mark/Sweep/Compact) complete and still more than %s% (%s%) of the heap is used. Creating heapdump now. GC stats: ', this._opts.threshold, Math.round(memoryUsagePercentage), JSON.stringify(stats));

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
   * Calls the designated worker and returns a promise
   * @param {String} workerPath - path of the worker
   * @param {String[]} workerArgs - arguments to worker
   * @return {Promise} resolve on success, reject on error
   */
  _callWorker(workerPath, workerArgs) {
    if (this._busy) {
      return new Promise((resolve, reject) => {
        reject(new Error("A CPU profile or heapdump is already being created, please retry later."));
      });
    }

    var args = [path.resolve(__dirname, workerPath)].concat(workerArgs);

    // use 'require-main-filename' module instead of require.main.filename, see https://github.com/blueconic/node-oom-heapdump/issues/3
    let mainFilename = require('require-main-filename')();

    // start worker
    let child = cp.spawn('node', args, {
      cmd: path.dirname(mainFilename),
      stdio: 'inherit'
    });

    return new Promise((resolve, reject) => {
      this._busy = true;
      var error = null;

      child.on('error', (err) => {
        error = err;
        reject(err);
      });
      child.on('exit', (code) => {
        if (!error) {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error("Worker exited with statusCode: " + code));
          }
        }
        this._busy = false;
      });
    });
  }

  /**
   * Returns the path to the created heap snapshot in a promise, or rejects on error
   * @param {String} snapshotPath - path of the snapshot
   * @param {String} logPrefix - optional log prefix message when heapdump is created
   * @return {Promise} the heap snapshot path on success or error on rejection
   */
  createHeapSnapshot(snapshotPath, logPrefix) {
    if (!snapshotPath) {
      snapshotPath = path.resolve(__dirname, "../heapsnapshot-" + Date.now());
    }
    if (logPrefix === "OoM" && this._opts.addTimestamp) {
      if (snapshotPath.endsWith(".heapsnapshot")) {
        snapshotPath = snapshotPath.replace(".heapsnapshot", "");
      }
      // in case of OoM error, add timestamp if needed
      snapshotPath += "-" + Date.now();
    }
    if (!snapshotPath.endsWith(".heapsnapshot")) {
      snapshotPath += ".heapsnapshot";
    }

    // start OoMworker to create heapdump
    return this._callWorker('./heapdumpWorker.js', [this._opts.port, snapshotPath, logPrefix || ""]).then(() => {
      if (logPrefix === "OoM") {
        this._count++;
      }
      if (!this._files.includes(snapshotPath)) {
        this._files.push(snapshotPath);
      }
      return snapshotPath;
    });
  }

  /**
   * Returns the path to the created CPU profile in a promise, or rejects on error
   * @param {String} cpuProfilePath - path of the CPU profile
   * @param {number} duration - the duration of the cpu profile (in ms)
   * @return {Promise} the CPU profile path on success or error on rejection
   */
  createCpuProfile(cpuProfilePath, duration) {
    if (!cpuProfilePath) {
      cpuProfilePath = path.resolve(__dirname, "../cpuprofile-" + Date.now());
    }
    if (!cpuProfilePath.endsWith(".cpuprofile")) {
      cpuProfilePath += ".cpuprofile";
    }

    // start OoMworker to create heapdump
    return this._callWorker('./cpuProfileWorker.js', [this._opts.port, cpuProfilePath, duration]).then(() => {
      if (!this._files.includes(cpuProfilePath)) {
        this._files.push(cpuProfilePath);
      }
      return cpuProfilePath;
    });
  }

  /**
   * Delete all created heap snapshots
   */
  deleteAllHeapSnapshots() {
    this._files.forEach((snapshotPath) => {
      if (snapshotPath.endsWith(".heapsnapshot")) {
        this.deleteHeapSnapshot(snapshotPath);
      }
    });
  }

  /**
   * Deletes a particular snapshot from disk
   * @param {String} snapshotPath - path of the heap snapshot to delete
   * @return {Promise}
   */
  deleteHeapSnapshot(snapshotPath) {
    return this._deleteFile(snapshotPath);
  }

  /**
   * Delete all created CPU profiles
   */
  deleteAllCpuProfiles() {
    this._files.forEach((path) => {
      if (path.endsWith(".cpuprofile")) {
        this.deleteCpuProfile(path);
      }
    });
  }

  /**
   * Deletes a particular CPU profile from disk
   * @param {String} cpuProfilePath - path of the CPU profile to delete
   * @return {Promise}
   */
  deleteCpuProfile(cpuProfilePath) {
    return this._deleteFile(cpuProfilePath);
  }

  /**
   * Deletes a given CPU profile or heapsnapshot  from disk
   * @param {String} path - path to the file to delete
   * @return {Promise}
   */
  _deleteFile(path) {
    return new Promise((resolve, reject) => {
      if (this._files.includes(path)) {
        fs.unlink(path, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(path);
          }
        });
      } else {
        reject(new Error("File not found:" + path));
      }
    });
  }
}

module.exports = NodeOomHeapDumpImpl;