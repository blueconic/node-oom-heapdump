let oom = require("../index.js")({
    threshold: 75,
    path: "../my_heapdump",
    heapdumpOnOOM: true
});

// It is important to use named constructors (like the one below), otherwise
// the heap snapshots will not produce useful outputs for you.
function LeakingClass1() {
}

var leaks = [];
var handle = setInterval(function () {
    for (var i = 0; i < 100000; i++) {
        leaks.push(new LeakingClass1);
    }

    console.error('Leaks: %d', leaks.length);
}, 50);