let fs = require('fs');

// set global variables based on args passed on to this oomWorker
let devToolsPort = process.argv[2];
let path = process.argv[3];
let logPrefix = (process.argv[4]) ? process.argv[4] + " " : "";

console.error('Started heapdump %sworker for \'%s\' on DevTools port \'%s\'.', logPrefix, path, devToolsPort);

let CDP = require('chrome-remote-interface');

CDP({
    host: 'localhost',
    port: devToolsPort,
}, function (debugInstance) {
    debugInstance.Debugger.enable();
    debugInstance.Debugger.pause();

    let heapProfiler = debugInstance.HeapProfiler;
    heapProfiler.enable();

    let writeStream = fs.createWriteStream(path);

    debugInstance.on('HeapProfiler.addHeapSnapshotChunk', function (evt) {
        writeStream.write(evt.chunk);
    });
    heapProfiler.takeHeapSnapshot({
        reportProgress: false,
    }, function () {
        heapProfiler.disable();
        writeStream.end();

        console.error('%sHeapdump created in \'%s\'. Exiting worker now.', logPrefix, path);

        debugInstance.Debugger.resume();

        // were done, exit normally
        process.exit(0);
    });
}).on('error', (err) => {
    // cannot connect to the remote endpoint
    console.error(err);

    process.exit(-1);
});
