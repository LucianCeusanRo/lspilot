const $ = (i) => document.getElementById(i);
chrome.storage.local.get({ licenseKey: '', lang: 'ro' }, (s) => { $('key').value = s.licenseKey; $('lang').value = s.lang; });
$('save').onclick = () => chrome.storage.local.set({ licenseKey: $('key').value.trim(), lang: $('lang').value }, () => $('st').textContent = '✓');
$('reset').onclick = () => chrome.storage.local.remove(['history', 'practiceSets'], () => $('st').textContent = 'Resetat');
