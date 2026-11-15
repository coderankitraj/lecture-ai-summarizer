# Lecture AI Summarizer

**Turn lecture pages and selected passages into concise study notes.**

A Chrome Manifest V3 extension backed by a lightweight Node.js API. The API uses Google Gemini when configured and includes an extractive fallback for local development.

## Highlights

- Summarizes readable text from the active tab or selected passage
- Produces structured study notes, key concepts, definitions, and revision questions with Gemini
- Includes an extractive fallback when no Gemini key is configured
- Copy or download generated notes as a text file
- Keeps the Gemini API key on the server, never in the extension
- Includes backend tests and a GitHub Actions CI workflow

## Architecture

```text
Lecture page
    │ active-tab text
    ▼
Chrome extension ── POST /api/summarize ──► Node.js API
                                                │
                                     ┌──────────┴──────────┐
                                     ▼                     ▼
                                  Gemini             Extractive fallback
```

The extension reads page content only after the user clicks a summarize action. By default, it uses the hosted API below. To run locally, start the backend and change `API_BASE_URL` in `extension/api-config.js` to `http://127.0.0.1:8787`.

## Hosted API

The public API is deployed at [lecture-ai-summarizer-coderankitraj.onrender.com](https://lecture-ai-summarizer-coderankitraj.onrender.com). Check its [health endpoint](https://lecture-ai-summarizer-coderankitraj.onrender.com/api/health).

The free Render instance may sleep when idle, so the first request can take about a minute. It currently uses the extractive fallback because no Gemini API key is configured. Add `GEMINI_API_KEY` as a secret in the Render dashboard to enable Gemini summaries; never commit the key to GitHub.

## Requirements

- Google Chrome or another Chromium browser supporting Manifest V3
- Node.js 18 or newer
- Optional: Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Run locally

From the project root:

```bash
cd server
npm start
```

The API uses Node.js built-in modules and listens on `127.0.0.1:8787` by default. Keep the process running while using the extension. Verify it at `http://127.0.0.1:8787/api/health`.

### Enable Gemini summaries

Copy the example environment file from the `server/` directory:

```bash
cd server
cp .env.example .env
```

Set `GEMINI_API_KEY` in `server/.env`. Keep this file private; `.env` is ignored by Git.

Without a key, the API returns the local extractive summary. Restart the server after changing environment values.

### Load the extension

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the project's `extension/` folder.
3. Pin **Lecture AI Summarizer** from the Extensions menu.
4. Open a normal article or transcript page and use the extension popup.

## Render deployment

`render.yaml` defines the Render Blueprint used for the hosted service. To deploy your own copy or a fork:

1. Push the project to GitHub. Do not commit `.env` or API keys.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Add `GEMINI_API_KEY` as a secret in the Render environment settings if Gemini summaries are needed.
4. Set `API_BASE_URL` in `extension/api-config.js` to your service origin and update the matching host permission in `extension/manifest.json`.
5. Reload the unpacked extension and verify your service's `/api/health` endpoint.

Public API requests share a limit of 30 summaries per minute per running service instance. This is not user authentication. Anyone with the endpoint can call it, so monitor Gemini quota and add per-user authentication before using it at larger scale. Only send content you have permission to process.

## Project structure

```text
lecture-ai-summarizer/
├── .github/
│   └── workflows/ci.yml
├── extension/
│   ├── api-config.js
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── server/
│   ├── .env.example
│   ├── server.test.js
│   ├── server.js
│   └── package.json
├── .gitignore
├── render.yaml
└── README.md
```

## API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Returns API status and active provider |
| `POST` | `/api/summarize` | Accepts `{ "text": "...", "mode": "page" }`; returns a summary and a provider value of `gemini` or `fallback` |

The API returns `429 Too Many Requests` with a `Retry-After` header when the shared request limit is reached.

## Testing

```bash
npm test --prefix server
```

GitHub Actions runs the backend tests on pushes and pull requests to `main` and `master`.

## Limitations and security

- Restricted browser pages (such as `chrome://` pages) cannot be read.
- Public Render free services can sleep when idle and have limited included usage.
- Never put a Gemini API key in the extension or commit it to GitHub.
- When Gemini is enabled, requested lecture text is sent to Google's Gemini API.
