# Avri

Avri is a desktop AI assistant built with Electron, React, TypeScript, Vite, Tailwind CSS, and the official Google Gemini SDK.

## Requirements

- Node.js 20.19 or newer
- npm

## Install

```bash
npm install
```

## Start the development app

```bash
npm run dev
```

The development process reads `GEMINI_API_KEY` from the local `.env` file. The key is handled only by the Electron main process and is never included in the renderer bundle.

## Configure Gemini

Open **Settings** in Avri to:

- select a Gemini model;
- save a personal API key override;
- test the active Gemini connection.

A key saved in Settings takes priority over the development `.env` key. Saved overrides use Electron's encrypted operating-system storage.

## Test chat

1. Open **Settings** and select **Test Connection**.
2. Return to **New Chat**.
3. Enter a prompt and press Enter or select the send button.
4. Confirm that the response streams into the conversation. Select the stop button to test cancellation.

Chats and AI settings are stored locally in Electron's application data directory.

## Memory

After a completed response, Avri may propose one durable, non-sensitive fact for long-term memory. Proposals are never used until you explicitly save them. You can edit or dismiss a proposal beside the related response, and manage pending, confirmed, or archived memories from **Library**.

Only a small, relevant set of confirmed memories is added to future requests. Memory data is stored separately from chat history in a versioned local store. Obvious secrets and highly sensitive data are rejected before extraction and before persistence.

## Build

```bash
npm run build
```

## Preview the production build

```bash
npm run preview
```

## Tests

```bash
npm test
```

The focused memory suite covers secret detection, proposal validation, relevance scoring, lifecycle operations, corrupted-store recovery, and context limits.

## Architecture

- `src/services/ai` defines the provider contract, shared AI models, errors, and the Gemini implementation.
- `electron/main` owns Gemini requests, cancellation, retries, credentials, and IPC handlers.
- `electron/main/storage` contains replaceable local repositories for chats and settings.
- `src/services/memory` contains provider-independent memory policy, validation, and retrieval logic.
- `electron/main/memory` owns memory persistence and non-blocking Gemini extraction.
- `src/hooks` coordinates streaming and local chat state for the React renderer.
- `src/components` renders the existing Avri interface without direct SDK access.
