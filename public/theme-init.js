// Applies the saved theme before the first paint, so dark mode never flashes light.
// A separate file because the Content-Security-Policy forbids inline scripts.
// Keep in sync with src/lib/theme.ts (storage key "theme", values "light" | "dark").
;(function () {
  try {
    var preference = localStorage.getItem('theme')
    var dark =
      preference === 'dark' ||
      (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    if (dark) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0d0f0d')
  } catch {
    // Storage blocked: the app follows the system once it has loaded.
  }
})()
