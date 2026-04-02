const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const expo = path.resolve(cwd, '..', '..', 'node_modules', '.bin', 'expo.cmd');

const child = spawn(
  'cmd.exe',
  ['/c', expo, 'start', '--dev-client', '--host', 'localhost', '--port', '8081', '--clear'],
  {
    cwd,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      EXPO_NO_METRO_WORKSPACE_ROOT: '1',
      EXPO_PROJECT_ROOT: cwd,
      EXPO_ROUTER_APP_ROOT: path.join(cwd, 'app'),
    },
  },
);

child.unref();
console.log(`Metro started in background (pid: ${child.pid ?? 'unknown'})`);
