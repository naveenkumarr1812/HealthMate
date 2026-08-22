let deferredPrompt = null;

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Optionally, could dispatch a custom event to notify UI
    window.dispatchEvent(new Event('pwaPromptReady'));
  });
}

export function showInstallPrompt() {
  if (!deferredPrompt) return Promise.resolve(false);
  deferredPrompt.prompt();
  return deferredPrompt.userChoice.then((choiceResult) => {
    deferredPrompt = null;
    return choiceResult.outcome === 'accepted';
  });
}
