const { spawn } = require('child_process');

const emulatorPath = process.env.ANDROID_EMULATOR_PATH
  || 'C:\\Users\\david\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
const avdName = process.env.ANDROID_AVD_NAME || 'Medium_Phone_API_36.1';

const child = spawn(
  emulatorPath,
  ['-avd', avdName, '-no-snapshot-load', '-no-boot-anim', '-no-audio', '-gpu', 'swiftshader_indirect'],
  {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    env: process.env,
  },
);

child.unref();
console.log(`Emulator launch requested for ${avdName} (pid: ${child.pid ?? 'unknown'})`);
