# Lecture AI Summarizer – Browser Extension

A Manifest V3 browser extension that turns lecture pages or selected text into concise study notes. It uses a small Node.js API and Google's Gemini API when a key is configured. Without a key, a local extractive fallback still lets you test the complete workflow.

## Features

- Summarize readable text from the current browser tab
- Summarize only text selected on a page
- AI notes include a short summary, key concepts, definitions/formulas when present, and revision questions
- Copy notes or download them as a `.txt` file
- Local fallback summarizer for testing without an AI API key
- API key stays in the backend environment, not in the browser extension

## Requirements

- Google Chrome or another Chromium browser supporting Manifest V3
- Node.js 18 or newer
- Optional: Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## 1. Start the backend

Open Terminal and go into the server folder:

```bash
cd server
node server.js
```

No npm packages are required; the backend uses Node.js built-in modules. By default it runs at `http://localhost:8787`.

### Enable AI summaries (optional but recommended)

Set your API key in the same Terminal session before starting the server:

```bash
export GEMINI_API_KEY="paste_your_key_here"
node server.js
```

Optional model override:

```bash
export GEMINI_MODEL="gemini-2.5-flash"
```

Do not commit your API key to GitHub. The extension works without a key using a basic local extractive fallback, but the quality will be more limited.

Check that the backend is running by opening `http://localhost:8787/api/health`. You should see JSON with `"ok":true`.

## 2. Load the extension in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `extension` folder.
5. Pin **Lecture AI Summarizer** from the Extensions menu if you want quick access.

## 3. Use it

1. Open a lecture article, learning page, or transcript in your browser.
2. Click the extension icon.
3. Choose **Summarize this page**, or select text on the page and choose **Summarize selected text**.
4. Copy the notes or download them as a text file.

The extension cannot read restricted browser pages such as `chrome://` pages or some protected video platforms. For best results, use a page with a readable transcript or article text. The extension sends the text you request to your local backend; if Gemini is configured, that text is sent to Google's Gemini API for summarization.

## Project structure

```text
lecture-ai-summarizer/
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── server/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## API

- `GET /api/health` – reports backend status and active provider
- `POST /api/summarize` – accepts `{ "text": "...", "mode": "page" }` and returns `{ "summary": "...", "provider": "gemini|fallback" }`

## Troubleshooting

- **Could not connect / Failed to fetch:** make sure `node server.js` is still running in Terminal.
- **No readable page text:** use a normal webpage with visible text; protected pages may block script access.
- **Selected text is empty:** select the text first, then open the extension and click the selection option.
- **Gemini API error:** check that the key is valid, the model is available to your account, and API access/quota is enabled.

## Privacy and security

- The backend binds to `127.0.0.1`, so it is intended for local use on your computer.
- Never hard-code API keys into `extension/` or commit them to a public repository.
- Only summarize content you have permission to access and send to the configured AI provider.

## Tech stack

JavaScript · Chrome Extension Manifest V3 · Node.js · HTTP/JSON API · Google Gemini API · Natural Language Processing (NLP)

## Future improvements

- Add a summary-length selector
- Export to Markdown/PDF
- Add flashcards and quiz generation
- Support transcript extraction from more learning platforms
