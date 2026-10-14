import {Capacitor, registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';

// Deliberately fail closed in a desktop browser or unsupported native shell.
const vault = registerPlugin('SessionVault');
window.PaperSwipeNative = {
  apiOrigin: PAPERSWIPE_API_ORIGIN,
  vault: Capacitor.isNativePlatform() ? vault : {
    get: () => Promise.reject(new Error('请通过已安装的 PaperSwipe App 打开')),
  },
};

if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', () => {
    const handled = !document.dispatchEvent(new Event('paperswipe:back', {cancelable:true}));
    if (!handled) App.minimizeApp();
  });
  // Returning to the foreground rechecks auth/data, never restarts a paid search.
  App.addListener('appStateChange', ({isActive}) => {
    if (isActive) document.dispatchEvent(new Event('paperswipe:resume'));
  });
}
