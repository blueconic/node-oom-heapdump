# node-oom-heapdump
Node module which will create a V8 heap snapshot right before an "Out of Memory" error occurs.
It can also create heapdumps on request like 'v8-profiler', but does this off-process so it doesn't interfere with execution of the main process.

Node 8+ required.

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
Just run "npm test" to see it in action. It creates a heapdump named "my_snapshot.heapsnapshot" in the root.

# Usage

```javascript
npm install node-oom-heapdump
```

Just add the following snippet to your node process.

```javascript
require("node-oom-heapdump")({
    threshold: 75,
    path: "./my_heapdump"
});
```

Your node process should at least be started with the "--inspect" (or --inspect=port) flag.

When running in a low memory environment, the following flags are advised:

* --max_old_space_size=60 - this will limit your heapsize on 60MB
* --optimize_for_size - keep memory as low as possible (GC more often than usual)
* --always_compact - keep memory as low as possible (do compactions each GC)

These might impact performance though.

# Options
* heapdumpOnOOM - boolean whether to create a heapdump when an out of memory occurs. Default true.
* threshold - integer between 0 and 100 (%) which determines when to make the heapdump. When the used heapSize exceeds the threshold, a heapdump is made. 
* path - the path where the heapdump ends up when an out of memory error occurs.
* port - optionally, the alternative DevTools protocol port. Defaults to 9229. Should map on the port given to the --inspect arg.

# API
Besides creating heapdumps when an out of memory error occurs, there also is an API for creating heapdumps on request.
See below for the currently available API.

```javascript
let nodeOomHeapdump = require("node-oom-heapdump")({
  heapdumpOnOOM: false
});

/**
* Returns the path to the created heap snapshot in a promise, or rejects on error
* @param {String} snapshotPath - path of the snapshot
* @return {Promise} Promise containing the heap snapshot path on success or error on rejection
*/
createHeapSnapshot(snapshotPath);

/**
* Deletes all previously created heapsnapshots from disk
*/
deleteAllHeapSnapshots();

/**
* Deletes a particular snapshot from disk
* @param {String} snapshotPath - path of the heap snapshot to delete 
* @return {Promise}
*/
deleteHeapSnapshot(snapshotPath);
```