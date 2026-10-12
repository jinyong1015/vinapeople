import { THEME_STORAGE_KEY } from '@/lib/vina/theme';
import Script from 'next/script';

const themeInitScript = `
(function () {
  var key = ${JSON.stringify(THEME_STORAGE_KEY)};
  var root = document.documentElement;
  var theme = 'light';
  try {
    var stored = localStorage.getItem(key);
    if (stored === 'light' || stored === 'dark') theme = stored;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch (e) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  }
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
})();
`.trim();

export function ThemeScript() {
  return (
    <Script
      id="vina-theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
