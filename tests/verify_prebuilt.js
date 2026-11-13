// Verifies that a packaged prebuilt binary (as created by `node-pre-gyp package`) works,
// without needing a GitHub release.
//
// It does what a consumer of the package does, except that the binary is downloaded from a local
// server instead of from the GitHub release:
//   1. copy the package sources (without any build output) to a clean temp dir
//   2. `npm install --ignore-scripts` to get the dependencies
//   3. `node-pre-gyp install` (no fallback to a source build) against a local server that serves the tarball
//   4. load the native addon and let a Node.js process run out of memory, which has to write a heap snapshot
//
// Usage: node tests/verify_prebuilt.js [directory with the packaged tarball, default: build/stage]

const cp = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stageDir = path.resolve(process.argv[2] || path.join(root, 'build', 'stage'));

function fail(message) {
  console.error('FAIL: ' + message);
  process.exit(1);
}

function step(message) {
  console.log('\n=== ' + message);
}

// run a command (through the shell, so that npm/npx also work on Windows) and fail on a non-zero exit code
function run(command, cwd, env) {
  console.log('$ ' + command);
  const result = cp.spawnSync(command, {
    cwd,
    env: Object.assign({}, process.env, env),
    shell: true,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail('"' + command + '" exited with ' + (result.status === null ? 'signal ' + result.signal : result.status));
  }
}

function findTarballs(dir) {
  let found = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found = found.concat(findTarballs(full));
    } else if (entry.name.endsWith('.tar.gz')) {
      found.push(full);
    }
  }
  return found;
}

async function main() {
  if (!fs.existsSync(stageDir)) {
    fail('directory with packaged binaries not found: ' + stageDir + ' (run `npx node-pre-gyp package` first)');
  }
  const tarballs = findTarballs(stageDir);
  if (tarballs.length !== 1) {
    fail('expected exactly 1 tarball in ' + stageDir + ', found ' + tarballs.length + ': ' + tarballs.join(', '));
  }
  const tarball = tarballs[0];
  console.log('Verifying ' + path.basename(tarball));

  // 1. clean copy of the package, without build output or installed modules
  step('Copy the package to a clean directory');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-oom-heapdump-verify-'));
  fs.cpSync(root, workDir, {
    recursive: true,
    filter: (src) => !['build', 'node_modules', '.git'].includes(path.basename(src)),
  });
  console.log(workDir);

  // 2. dependencies, without running the install script (which would otherwise compile from source)
  step('Install the dependencies');
  run('npm install --ignore-scripts --no-audit --no-fund', workDir);

  // 3. install the prebuilt binary from a local server that mimics the GitHub release download
  step('Install the prebuilt binary');
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const requested = path.basename(decodeURIComponent(req.url.split('?')[0]));
    if (requested === path.basename(tarball)) {
      res.writeHead(200, {'Content-Type': 'application/gzip'});
      fs.createReadStream(tarball).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const mirror = 'http://127.0.0.1:' + server.address().port + '/';

  // node-pre-gyp runs synchronously in a child process, so the server has to run in this process asynchronously:
  // use spawn instead of spawnSync here
  await new Promise((resolve) => {
    console.log('$ npx node-pre-gyp install   (binary host: ' + mirror + ')');
    const child = cp.spawn('npx node-pre-gyp install', {
      cwd: workDir,
      env: Object.assign({}, process.env, {npm_config_node_oom_heapdump_native_binary_host_mirror: mirror}),
      shell: true,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code !== 0) {
        fail('node-pre-gyp install exited with ' + code);
      }
      resolve();
    });
  });
  server.close();

  if (!requests.some((url) => url.endsWith(path.basename(tarball)))) {
    fail('the tarball was never requested, requests: ' + JSON.stringify(requests));
  }
  const addon = path.join(workDir, 'build', 'Release', 'node_oom_heapdump_native.node');
  if (!fs.existsSync(addon)) {
    fail('the downloaded tarball did not contain ' + addon);
  }

  // 4a. the addon loads
  step('Load the native addon');
  run('node -e "require(\'bindings\')(\'node_oom_heapdump_native.node\'); console.log(\'addon loaded\')"', workDir);

  // 4b. the addon does its job: an out of memory error results in a heap snapshot
  step('Create a heap snapshot on out of memory');
  const snapshot = path.join(workDir, 'tests', 'my_heapdump.heapsnapshot');
  const oom = cp.spawnSync(process.execPath, ['--max_old_space_size=40', path.join('tests', 'oom_app.js')], {
    cwd: workDir,
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 120000,
  });
  console.log('oom_app exited with ' + (oom.status === null ? 'signal ' + oom.signal : oom.status));
  if (!fs.existsSync(snapshot)) {
    fail('no heap snapshot was created at ' + snapshot);
  }
  const size = fs.statSync(snapshot).size;
  const head = Buffer.alloc(64);
  const fd = fs.openSync(snapshot, 'r');
  fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  if (size < 1024 || !head.toString('utf8').startsWith('{"snapshot"')) {
    fail('the heap snapshot at ' + snapshot + ' looks invalid (' + size + ' bytes)');
  }
  console.log('heap snapshot created: ' + size + ' bytes');

  fs.rmSync(workDir, {recursive: true, force: true});
  console.log('\nOK: ' + path.basename(tarball) + ' works');
}

main().catch((err) => fail(err.stack || String(err)));
