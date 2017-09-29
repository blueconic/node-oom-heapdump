let cp = require("child_process");
let path = require("path");

let busy = false;

module.exports = function (options) {
  parseOptions(options || {});

  // see https://www.npmjs.com/package/gc-stats
  let gcStats = new require('gc-stats')();
  gcStats.on('stats', function (stats) {
    // gctype 2 is a Full GC (Mark/Sweep/Compact)
    if (stats.gctype === 2 && !busy) {
      let heapSizeUsedPercentage = (parseInt(stats.after.totalHeapSize) / parseInt(stats.after.heapSizeLimit)) * 100;
      if (heapSizeUsedPercentage > options.threshold) {
        busy = true;

        // this is a full GC and the used heap size is using more than 80% of the assigned heap space limit
        console.warn('OoM is imminent: Full GC (Mark/Sweep/Compact) complete and still more than %s% (%s%) of the heap is used. Creating heapdump now. GC stats: ', options.threshold, Math.round(heapSizeUsedPercentage), stats);

        // start OoMworker to create heapdump
        let child = cp.spawn('node', ['./oomWorker.js', options.port, options.name], {
          cmd: path.dirname(require.main.filename),
          stdio: 'inherit'
        });
        child.on('error', function (err) {
          console.error(err);
        });
      }
    }
  });
};

function parseOptions(options) {
  if (!options.threshold) {
    options.threshold = 75;
  } else {
    options.threshold = parseInt(options.threshold);
  }
  if (!options.port) {
    options.port = 9229;
  } else {
    options.port = parseInt(options.port);
  }
  if (!options.name) {
    options.name = "OoM-" + process.pid + "-" + Date.now();
  }
}