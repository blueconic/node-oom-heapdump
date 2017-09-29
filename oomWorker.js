let fs = require('fs');
let path = require('path');

// set global variables based on args passed on to this oomWorker
let devToolsPort = process.argv[2];
let fileName = process.argv[3];

console.error('Started OoM worker for \'%s\' on DevTools port \'%s\'.', fileName, devToolsPort);

let CDP = require('chrome-remote-interface');

CDP({
    host: 'localhost',
    port: devToolsPort,
}, function (debugInstance) {
    debugInstance.Debugger.enable();
    debugInstance.Debugger.pause();

    let heapProfiler = debugInstance.HeapProfiler;
    heapProfiler.enable();

    let fullPath = path.resolve('./' + fileName + '.heapsnapshot');
    let writeStream = fs.createWriteStream(fullPath);

    debugInstance.on('HeapProfiler.addHeapSnapshotChunk', function (evt) {
        writeStream.write(evt.chunk);
    });
    heapProfiler.takeHeapSnapshot({
        reportProgress: false,
    }, function () {
        heapProfiler.disable();
        writeStream.end();

        console.error('OoM Heapdump created in \'%s\'. Exiting worker now.', fullPath);

        debugInstance.Debugger.resume();

        // were done, exit normally
        process.exit(0);
    });
});
