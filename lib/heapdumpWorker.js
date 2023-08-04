let fs = require('fs');
let dns = require("dns");

// set global variables based on args passed on to this heapdump worker
let devToolsPort = process.argv[2];
let path = process.argv[3];
let logPrefix = (process.argv[4]) ? process.argv[4] + " " : "";

console.error('Started heapdump %sworker for \'%s\' on DevTools port \'%s\'.', logPrefix, path, devToolsPort);

let CDP = require('chrome-remote-interface');
let writeStream = fs.createWriteStream(path);
let handleError = function (arg1, arg2) {
    console.error("Error occurred while creating heapdump", arg1, arg2 || "");
    writeStream.end();
    process.exit(-1);
};
writeStream.on('error', (err) => {
    handleError("Heapdump path not valid or writable", err);
});

try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {
    // ignore, method not available before node16
}

CDP({
    host: 'localhost',
    port: devToolsPort
}, (debugInstance) => {
    debugInstance.Debugger.enable();
    debugInstance.Debugger.pause();

    let heapProfiler = debugInstance.HeapProfiler;
    heapProfiler.enable();

    debugInstance.on('HeapProfiler.addHeapSnapshotChunk', function (evt) {
        writeStream.write(evt.chunk);
    });
    heapProfiler.takeHeapSnapshot({
        reportProgress: false
    }, function () {
        heapProfiler.disable();
        writeStream.end();

        console.error('%sHeapdump created in \'%s\'. Exiting worker now.', logPrefix, path);

        debugInstance.Debugger.resume();

        // were done, exit normally
        process.exit(0);
    });
}).on('error', (err) => {
    handleError(err);
});
