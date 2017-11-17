let fs = require('fs');

// set global variables based on args passed on to this oomWorker
let devToolsPort = process.argv[2];
let path = process.argv[3];
let duration = process.argv[4];

console.error('Started CPU profile (duration: %sms) %s worker on DevTools port \'%s\'.', duration, path, devToolsPort);

let CDP = require('chrome-remote-interface');
let writeStream = fs.createWriteStream(path);
let handleError = function (arg1, arg2) {
    console.error("Error occurred while creating CPU profile", arg1, arg2 || "");
    writeStream.end();
    process.exit(-1);
};
writeStream.on('error', (err) => {
    handleError("CPU profile path not valid or writable", err);
});

CDP({
    host: 'localhost',
    port: devToolsPort
}, (debugInstance) => {
    let cpuProfiler = debugInstance.Profiler;
    cpuProfiler.enable();
    cpuProfiler.start();

    setTimeout(() => {
        let Profile = cpuProfiler.stop();
        Profile.then((p) => {
            writeStream.write(JSON.stringify(p.profile));
            writeStream.end();

            cpuProfiler.disable();

            console.error('CPU profile created in \'%s\'. Exiting worker now.', path);

            // were done, exit normally
            process.exit(0);
        }).catch((err) => {
            handleError(err);
        });
    }, duration);
}).on('error', (err) => {
    // cannot connect to the remote endpoint
    handleError(err);
});
