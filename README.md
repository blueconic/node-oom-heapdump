[![TravisCI Build Status](https://travis-ci.org/blueconic/node-oom-heapdump.svg?branch=master)](https://travis-ci.org/blueconic/node-oom-heapdump)

# node-oom-heapdump
Node module that can create heapdumps and CPU profiles on request like 'v8-profiler', but does this off-process so it doesn't interfere with execution of the main process.

Tested on Node.js 7.x, 8.x, 9.x, 10.x, 11.x, 12.x, 13.x, 14.x and 16.x.
No support for Node.js < 7.0 at the moment (although this can be fixed if needed).  

Also comes with prebuilt binaries (hosted on Github releases), thanks to Stuart Miller (https://github.com/spmiller).

## Node.js 14.18.x and higher
https://github.com/nodejs/node/pull/33010 landed in Node.js 14.18.0, which makes this module no longer needed for heapdumps on out of memory.
One can use the `--heapsnapshot-near-heap-limit` Node.js CLI option as an native alternative.
See https://nodejs.org/dist/latest-v14.x/docs/api/cli.html#cli_heapsnapshot_near_heap_limit_max_count.

For Node versions older than 14, use the `2.2.0` release, where this functionality is still present (not maintained anymore).
For Node versions 14 and up, use `--heapsnapshot-near-heap-limit` for out-of-memory heapdumps. This functionality has been removed from `3.0.0`.

One can still use the API of this module to create CPU profiles and heapdumps on request

# Why?
There are several modules around which can create heapdumps (v8-profiler, node-heapdump), although this module creates the heap snapshot from a separate process which performs better and doesn't affect the main event loop.

# What?
When creating a heapdump of CPU profile on request, the DevTools protocol is used to create these files (no native add-on needed).
The --inspect node.js flag is needed to make this work (which is validated on startup).

# Usage

```javascript
npm install node-oom-heapdump
```

Just add the following snippet to your node process.

```javascript
let path = require('path');
require('node-oom-heapdump')({
    path: path.resolve(__dirname, 'my_heapdump')
});
```

To make heapdumps and CPU profiles on request, your node process should at least be started with the "--inspect" (or --inspect=port) flag. When the module is loaded, the configured port is verified. If it doesn't respond correctly, a console warning will be shown.

When running in a low memory environment, the following flags are advised:

* --max_old_space_size=60 - this will limit your heapsize on 60MB
* --optimize_for_size - keep memory as low as possible (GC more often than usual)
* --always_compact - keep memory as low as possible (do compactions each GC)

These might impact performance though.
On Node.js 12.x the latter two flags seem to cause some stability issues (see https://github.com/nodejs/node/issues/27552#issuecomment-542695931). So, if you encounter issues on Node.js 12.x in combination with those flags, please refrain from using these.

# Options
* addTimestamp - add a timestamp to the heapdump filename, to make it unique. Default is false.
* port - optionally, the alternative DevTools protocol port. Defaults to 9229. Should map on the port given to the --inspect arg.

# API
The API for creating heapdumps and CPU profiles on request. See below for the currently available API.

Notice that you cannot create a heapdump while a CPU profile is being generated and vice versa; an Error will be thrown if this is the case.

```javascript
let nodeOomHeapdump = require("node-oom-heapdump")({
  heapdumpOnOOM: false
});

/**
  * Returns the path to the created heap snapshot in a promise, or rejects on error
  * @param {String} snapshotPath - path of the snapshot
  * @return {Promise} Promise containing the heap snapshot path on success or error on rejection
  */
nodeOomHeapdump.createHeapSnapshot("myheapsnapshotpath").then((snapshotPath) => {
  // do something with heap snapshot

  // and delete again from disk
  nodeOomHeapdump.deleteHeapSnapshot(snapshotPath);
}).catch((err) => {
  // handle error
});

/**
  * Deletes all previously created heapsnapshots from disk
  */
nodeOomHeapdump.deleteAllHeapSnapshots();

/**
  * Deletes a particular snapshot from disk
  * @param {String} snapshotPath - path of the heap snapshot to delete
  * @return {Promise}
  */
nodeOomHeapdump.deleteHeapSnapshot(snapshotPath);

/**
  * Returns the path to the created CPU profile in a promise, or rejects on error
  * @param {String} cpuProfilePath - path of the CPU profile
  * @param {number} duration - the duration of the CPU profile in ms (default: 30000ms)
  * @return {Promise} the CPU profile path on success or error on rejection
  */
nodeOomHeapdump.createCpuProfile("mycpuprofilepath", 10000).then((cpuProfilePath) => {
  // do something with CPU profile

  // and delete again from disk
  nodeOomHeapdump.deleteCpuProfile(cpuProfilePath);
}).catch((err) => {
  // handle error
});

/**
  * Deletes all previously created CPU profiles from disk
  */
nodeOomHeapdump.deleteAllCpuProfiles();

/**
  * Deletes a particular CPU profile from disk
  * @param {String} cpuProfilePath - path to the CPU profile to delete from disk
  * @return {Promise}
  */
nodeOomHeapdump.deleteCpuProfile(cpuProfilePath);
```

# Known issues and limitations

## Memory usage
When creating a heapdump on request, it's notorious for using a lot of memory. This is caused by a bug in V8/DevTools protocol and is reported here (https://bugs.chromium.org/p/chromium/issues/detail?id=768355); the protocol has no backpressure mechanism, which causes the heapdump to be pushed faster than the DevTools client can handle, causing in-memory buffering.

This is not a problem if your server/machine has memory to spare, but can cause issues in memory restricted environments like a Docker container. Once the process exceeds the container memory threshold, it will be killed by OoMKiller (if enabled). This leads to an empty heapsnapshot file (0 bytes).

Please vote for that issue to be fixed!
