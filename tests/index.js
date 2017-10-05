let cp = require("child_process");
let fs = require("fs");
let path = require("path");

describe('Heapdumps', function () {
  it('should be created in x seconds', function (done) {
    this.timeout(250000);

    let child = cp.fork(path.resolve(__dirname, './oom_app.js'), null, {
      cmd: path.dirname(require.main.filename),
      stdio: 'inherit',
      execArgv: ["--max_old_space_size=40", "--optimize_for_size", "--always_compact", "--inspect=9229"]
    });

    setTimeout(function () {
      child.kill();
      fs.lstat(path.resolve(__dirname, "../abc.heapsnapshot"), (err, stats) => {
        if (!err && stats.isFile()) {
          done();
        } else {
          done(err);
        }
        clearTimeout(handle);
      })
    }, 20000);
  });
});
