const API_URL = 'http://localhost:8787/api/summarize';
const pageButton = document.getElementById('summarizePage');
const selectionButton = document.getElementById('summarizeSelection');
const statusEl = document.getElementById('status');
const resultSection = document.getElementById('resultSection');
const resultEl = document.getElementById('result');
let latestSummary = '';

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}
function setBusy(busy) {
  pageButton.disabled = busy;
  selectionButton.disabled = busy;
  pageButton.textContent = busy ? 'Summarizing…' : 'Summarize this page';
}
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Could not find the active tab.');
  return tab;
}
async function getPageText(tab, selectionOnly) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (onlySelection) => {
      const selected = window.getSelection()?.toString().trim();
      if (onlySelection && selected) return selected;
      if (onlySelection && !selected) return '';
      const candidates = [document.querySelector('main'), document.querySelector('article'), document.body];
      const root = candidates.find((el) => el && (el.innerText || '').trim().length > 100) || document.body;
      return (root?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 30000);
    },
    args: [selectionOnly]
  });
  return result || '';
}
async function summarize(selectionOnly) {
  setBusy(true);
  resultSection.classList.add('hidden');
  try {
    setStatus('Reading lecture content…');
    const tab = await getActiveTab();
    const content = await getPageText(tab, selectionOnly);
    if (!content) throw new Error(selectionOnly ? 'Select some lecture text on the page first, then try again.' : 'No readable page text found on this tab.');
    setStatus('Generating your study notes…');
    const response = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, mode: selectionOnly ? 'selection' : 'page' })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Server returned ${response.status}. Is the backend running?`);
    latestSummary = data.summary || '';
    if (!latestSummary) throw new Error('The summarizer returned an empty result.');
    resultEl.textContent = latestSummary;
    resultSection.classList.remove('hidden');
    setStatus(data.provider === 'gemini' ? 'Summary generated with Gemini AI.' : 'Summary generated using the local fallback summarizer.', 'success');
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', 'error');
  } finally { setBusy(false); }
}
pageButton.addEventListener('click', () => summarize(false));
selectionButton.addEventListener('click', () => summarize(true));
document.getElementById('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(latestSummary); setStatus('Notes copied to clipboard.', 'success'); }
  catch { setStatus('Could not copy automatically. Select the notes and copy them manually.', 'error'); }
});
document.getElementById('downloadBtn').addEventListener('click', () => {
  const blob = new Blob([latestSummary], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'lecture-study-notes.txt'; a.click(); URL.revokeObjectURL(url);
});
