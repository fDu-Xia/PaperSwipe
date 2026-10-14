import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const missing = [];
const major = Number(process.versions.node.split('.')[0]);
console.log(`Node: ${process.versions.node}`);
if (major < 22) missing.push('Node 22+');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const result = spawnSync(java, ['-version'], {encoding:'utf8'});
const version = `${result.stderr || ''}${result.stdout || ''}`.match(/version "([\d.]+)/)?.[1];
console.log(`Java: ${version || '未检测到'}`);
if (!version || Number(version.split('.')[0]) < 21) missing.push('JDK 21（可使用 Android Studio 的 jbr）');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA,'Android','Sdk') : '');
console.log(`Android SDK: ${sdk && existsSync(sdk) ? sdk : '未检测到'}`);
if (!sdk || !existsSync(path.join(sdk,'platforms','android-36','android.jar'))) missing.push('Android SDK Platform 36');
if (missing.length) {
  console.log('尚需配置：\n- '+missing.join('\n- '));
  process.exitCode=1;
} else console.log('基础构建环境就绪；仍需构建及真机验证。');
