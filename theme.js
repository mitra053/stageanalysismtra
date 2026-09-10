(function () {
  const STORAGE_KEY = 'stage-analysis-theme';
  const THEMES = ['dark', 'light', 'aurora'];

  function getPreferredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.includes(stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Theme preference unavailable:', error);
    }

    return 'light';
  }

  function getNextTheme(currentTheme) {
    const index = THEMES.indexOf(currentTheme);
    return THEMES[(index + 1) % THEMES.length];
  }

  function applyTheme(theme) {
    const selectedTheme = THEMES.includes(theme) ? theme : 'dark';
    document.body.setAttribute('data-theme', selectedTheme);
    document.documentElement.style.colorScheme = selectedTheme === 'light' ? 'light' : 'dark';

    try {
      localStorage.setItem(STORAGE_KEY, selectedTheme);
    } catch (error) {
      console.warn('Could not persist theme selection:', error);
    }

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (!toggleBtn) return;

    const labels = {
      dark: { icon: '☀️', text: 'Dark' },
      light: { icon: '🌙', text: 'Light' },
      aurora: { icon: '🌈', text: 'Aurora' }
    };

    const label = labels[selectedTheme] || labels.dark;
    toggleBtn.innerHTML = '<span class="mr-2">' + label.icon + '</span><span>' + label.text + '</span>';
    toggleBtn.setAttribute('aria-label', 'Switch theme');
    toggleBtn.title = 'Switch theme';
  }

  function bindToggle() {
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', function () {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      applyTheme(getNextTheme(currentTheme));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getPreferredTheme());
    bindToggle();
  });
})();
