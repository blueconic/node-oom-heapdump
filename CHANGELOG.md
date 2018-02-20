02-20-2018 Paul Rütter
- 1.1.2 - Fixed heapdump generation on Unix machines.
- Added option to use the "old" implementation (GCmonitoring), as the new implementatuion is more prone to run in with the OoM killer when in memory restricted environments (like Docker). The old implementation was less impacted by this, because the "threshold" parameter can be used to create the heapdump earlier.
You can specify which OoM implementation to use, either: "NATIVE_HOOK" (default) or "GC_MONITORING" (old implementation).

02-19-2018 Paul Rütter
- 1.1.0 - Changed the way the "out of memory" heapdump is created, based on the work of 'trevnorris' (https://github.com/trevnorris/node-ofe/blob/master/ofe.cc). Using V8 engine isolate.SetOOMErrorHandler() to hook in on the out of memory event.
- Updated readme and removed deprecated 'limit' and 'threshold' parameters.
- Removed 'gc-stats' module, as we no longer need it with the native C++ add-on.

02-13-2018 - Paul Rütter
- 1.0.12 - Use 'require-main-filename' instead of require.main.filename, to resolve 'https://github.com/blueconic/node-oom-heapdump/issues/3'.
- Upgrade dependencies

11-21-2017 - Paul Rütter
- 1.0.11 - Added port verification; when the module is loaded, the configured WebSocket port is verified. If the websocket responds with ECONNREFUSED, the process might have been started without the --inspect flag.

11-17-2017 - Paul Rütter
- 1.0.10 - Use gc-stats to calculate when to make a OoM heapdumo instead of process.memoryUsage() as this memory information (heapTotal) is growing over time, which is not expected.
- Stringify gc-stats output, so it runs over only 1 line.

06-10-2017 - Paul Rütter
- 1.0.9 - Handle exit codes better and reject promise if so.

05-10-2017 - Paul Rütter
- 1.0.8 - Add CPU profile functionality.

04-10-2017 - Paul Rütter
- 1.0.7 - Add addTimestamp option.

04-10-2017 - Paul Rütter
- 1.0.6 - Add limit option.

03-10-2017 - Paul Rütter
- 1.0.5 - Change heap calculation.

03-10-2017 - Paul Rütter
- 1.0.4 - Add error handler in case the calling process is not running anymore. Also, block execution a while to allow heapdump to be created.

01-10-2017 - Paul Rütter
- 1.0.3 - Minor doc changes.

01-10-2017 - Paul Rütter
- 1.0.2 - Refactored code; split up API and implementation. Also added API for creating heapdumps on the fly. Documentation updated.

29-09-2017 - Paul Rütter
- 1.0.1 - minor changed

29-09-2017 - Paul Rütter
- 1.0.1 - initial version
