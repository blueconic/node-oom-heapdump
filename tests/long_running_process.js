let oomLib = require("../index.js")({
    heapdumpOnOOM: false
});

var i = 0;
var path = "";

var handle = setInterval(function () {
    i++;

    oomLib.createHeapSnapshot(require("path").resolve("../", "myName")).then((p) => {
        path = p;
    }).catch((err) => {
        console.error(err);
    });

    if (i === 3) {
        oomLib.deleteHeapSnapshot(path);
        setTimeout(function () {
            process.exit(0);
        }, 100);
    }
}, 2000);