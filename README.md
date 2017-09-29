# node-oom-heapdump
Node module which will create a V8 memory snapshot right before an "Out of Memory" error occurs.

# Why?
When running nodejs processes in a low memory environment, every out of memory that occurs is interesting. 
To figure out why a process went out of memory, a memory snapshot (e.g. heapdump) can help a lot.
This module creates a memory snapshot right before an suspected out of memory error occurs.
It shows what the heap was filled with right before the out of memory error occured.

There are several modules around which can create heapdumps (v8-profiler, node-heapdump), but these run in the same process as the one going out of memory. Often, creating heapdump won't work when the node process is already struggling.
This module creates the memory snapshot from a separate process, which solves this issue.  

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
    name: "my_heapdump"
});
```

Your node process should at least be started with the "--inspect" (or --inspect=<port>) flag.
When running in an low memory environment, the following flags are advised:
* --max_old_space_size=60 - this will limit your heapsize
* --optimize_for_size - keep memory as low as possible (GC more often than usual)
* --always_compact - keep memory as low as possible (do compactions each GC)
These might impact performance though.

# Options
* threshold - integer which determines when to make the snapshot. When the used heapSize exceeds the threshold, a heapdump is made.
* name - the name of the heapdump file
* port - optionally the alternative DevTools protocol port. Defauls to 9229.
