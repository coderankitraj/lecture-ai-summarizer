const http = require('node:http');

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 150000) { reject(new Error('Request too large. Please summarize a shorter passage.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    req.on('error', reject);
  });
}
function fallbackSummary(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const useful = sentences.map(s => s.trim()).filter(s => s.length > 35);
  if (!useful.length) return `Key content\n\n${clean.slice(0, 1600)}${clean.length > 1600 ? '…' : ''}\n\nRevision tip: Review the original lecture for details and examples.`;
  const ranked = useful.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    const unique = new Set(words);
    const score = unique.size / Math.sqrt(words.length || 1) + (index < 3 ? 0.35 : 0);
    return { sentence, index, score };
  });
  const chosen = ranked.sort((a, b) => b.score - a.score).slice(0, Math.min(7, Math.max(3, Math.ceil(useful.length * 0.25)))).sort((a, b) => a.index - b.index);
  const summary = chosen.map(item => `• ${item.sentence}`).join('\n');
  return `QUICK SUMMARY\n\n${summary}\n\nKEY TAKEAWAY\nReview the bullet points above, then revisit the lecture for supporting explanations and examples.\n\nNote: Set GEMINI_API_KEY in your environment to enable AI-generated summaries.`;
}
async function geminiSummary(text) {
  const prompt = `You are a helpful university lecture note-taking assistant. Summarize the lecture content below into useful study notes. Use this exact structure: 1) Title, 2) Short summary (2-4 sentences), 3) Key concepts as bullet points, 4) Important definitions/formulas if present, 5) Three quick revision questions. Be accurate, clear, and concise. Do not invent facts not supported by the source.\n\nLECTURE CONTENT:\n${text}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1200 } })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Gemini API error (${response.status}).`);
  return (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n').trim();
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, provider: GEMINI_API_KEY ? 'gemini' : 'fallback' });
  if (req.method !== 'POST' || req.url !== '/api/summarize') return send(res, 404, { error: 'Route not found.' });
  try {
    const { text } = await readBody(req);
    if (typeof text !== 'string' || !text.trim()) return send(res, 400, { error: 'Please provide lecture text to summarize.' });
    if (text.length > 30000) return send(res, 413, { error: 'Text is too long. Please use a shorter passage.' });
    let summary; let provider = 'fallback';
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_api_key_here') {
      try { summary = await geminiSummary(text); provider = 'gemini'; }
      catch (error) { console.error('Gemini request failed:', error.message); return send(res, 502, { error: `AI summary failed: ${error.message}. Check your API key/model or try again.` }); }
    } else summary = fallbackSummary(text);
    return send(res, 200, { summary, provider });
  } catch (error) {
    return send(res, 400, { error: error.message || 'Unable to process request.' });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`Lecture AI Summarizer API listening at http://localhost:${PORT}`));
