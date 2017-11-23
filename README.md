# node-oom-heapdump
Node module which will create a V8 heap snapshot right before an "Out of Memory" error occurs.

It can also create heapdumps and CPU profiles on request like 'v8-profiler', but does this off-process so it doesn't interfere with execution of the main process.

Tested on Node.js 8.x, but should also work fine using Node.js 6.3 upwards (According to: https://chromedevtools.github.io/devtools-protocol/v8/).

# Why?
When running nodejs processes in a low memory environment, every out of memory that occurs is interesting.
To figure out why a process went out of memory, a heap snapshot (e.g. heapdump) can help a lot.
This module creates a heap snapshot right before a suspected out of memory error occurs.
It shows what the heap was filled with right before the out of memory error occured.

There are several modules around which can create heapdumps (v8-profiler, node-heapdump), but these run in the same process as the one going out of memory. Often, creating heapdump won't work when the node process is already struggling.
This module creates the heap snapshot from a separate process, which solves this issue.

# What?
It uses 'gc-stats' to determine when an out of memory error is about to occur and then fires up a new process which uses 'chrome-remote-interface' to connect with the DevTools protocol (https://chromedevtools.github.io/devtools-protocol/v8/) of the calling process. That process uses HeapProfiler to actually create the heapdump and then exits.

# Example
Just run "npm test" to see it in action. It creates a heapdump named "my_heapdump.heapsnapshot" in the 'tests' directory of this module.

# Usage

```javascript
npm install node-oom-heapdump
```

Just add the following snippet to your node process.

```javascript
let path = require('path');
require('node-oom-heapdump')({
    threshold: 70,
    path: path.resolve(__dirname, 'my_heapdump')
});
```

Your node process should at least be started with the "--inspect" (or --inspect=port) flag.
When the module is loaded, the configured port is verified. If it doesn't respond correctly, a console warning will be shown.

When running in a low memory environment, the following flags are advised:

* --max_old_space_size=60 - this will limit your heapsize on 60MB
* --optimize_for_size - keep memory as low as possible (GC more often than usual)
* --always_compact - keep memory as low as possible (do compactions each GC)

These might impact performance though.

# Options
* heapdumpOnOOM - boolean whether to create a heapdump when an out of memory occurs. Default true.
* threshold - integer between 0 and 100 (%) which determines when to make the heapdump. When the used heapSize exceeds the threshold, a heapdump is made. This value can be tuned depending on your configuration; if memory usage is very volatile, a lower value might make more sense. Default is 70.
* path - the path where the heapdump ends up when an out of memory error occurs. '.heapsnapshot' is automatically appended. Defaults to this modules' directory.
* addTimestamp - add a timestamp to the out of memory heapdump filename, to make it unique. Default is false.
* limit - optionally, specify a limit to how many heapdumps will be created when being above the threshold. Default is 3.
* port - optionally, the alternative DevTools protocol port. Defaults to 9229. Should map on the port given to the --inspect arg.

# API
Besides creating heapdumps when an out of memory error occurs, there also is an API for creating heapdumps and CPU profiles on request. See below for the currently available API.

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

# Known issues
When the OoM heapdump process kicks in, it's notorious for using a lot of memory. This is caused by a bug in V8/DevTools protocol and is reported here (https://bugs.chromium.org/p/chromium/issues/detail?id=768355); the protocol has no backpressure mechanism, which causes the heapdump to be pushed faster than the DevTools client can handle, causing in-memory buffering.

This is not a problem if your server/machine has memory to spare, but can cause issues in memory restricted environments like a Docker container. Once the process exceeds the container memory threshold, it will be killed by OoMKiller (if enabled). This leads to an empty heapsnapshot file (0 bytes).

Please vote for that issue to be fixed!
