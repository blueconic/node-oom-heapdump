let oomLib = require("../index.js")({
    heapdumpOnOOM: false
});

var i = 0;
var path = "";

oomLib.createCpuProfile(require("path").resolve("myCPU.cpuprofile"), 3000).then((p) => {
    console.error("CPU profile", p);

    //oomLib.deleteAllCpuProfiles();
}).catch((err) => {
    console.error(err);
});

var handle = setInterval(function () {
    i++;

    oomLib.createHeapSnapshot(require("path").resolve("../", "myName")).then((p) => {
        path = p;
    }).catch((err) => {
        console.error(err);
    });

    if (i === 5) {
        /* oomLib.deleteHeapSnapshot(path).then(() => {
             //
         }).catch((err) => {
             console.error("err", err);
         });*/
        setTimeout(function () {
            process.exit(0);
        }, 100);
    }
}, 1000);