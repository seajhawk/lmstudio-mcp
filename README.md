# LM Studio MCP Server

A Model Context Protocol (MCP) server for [LM Studio](https://lmstudio.ai/) that enables model management through standardized tools.

## Features

- 📋 **List Models** - View all available models and their current state
- 🚀 **Load Models** - Load models into memory with configurable TTL
- 🛑 **Unload Models** - Immediately unload models from memory
- ⚙️ **Configure Models** - Adjust model settings like TTL and draft models
- 📊 **Model Details** - Get detailed information about specific models

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [LM Studio](https://lmstudio.ai/) running with local server enabled
- LM Studio local server running on port 1234 (default) or custom port

## Installation

```bash
npm install
npm run build
```

## Quickstart (Build & Run)

Follow these steps to build and run the MCP server locally.

1. Install dependencies and build the project:

```bash
npm install
npm run build
```

2. Start the server (uses the compiled files in `dist`):

```bash
npm start
```

3. The server writes MCP communication to `stdout` and logs to `stderr`.

Environment variable tips:

- Default LM Studio URL: `http://localhost:1234`.
- To use a custom LM Studio URL, set `LM_STUDIO_BASE_URL` before starting.

PowerShell (Windows) example:

```powershell
$env:LM_STUDIO_BASE_URL = "http://localhost:1234"
npm start
```

Command Prompt (Windows) example:

```cmd
set LM_STUDIO_BASE_URL=http://localhost:1234 && npm start
```

macOS / Linux example:

```bash
LM_STUDIO_BASE_URL="http://localhost:1234" npm start
```

Development workflow:

- Rebuild on change (in one terminal): `npm run watch`
- Run the server (in another terminal): `npm run dev` (starts Node with the inspector)

You can also run the compiled script directly with `node dist/index.js` if preferred.


## Configuration

### LM Studio Setup

1. Open LM Studio
2. Go to the **Developer** tab
3. Enable the local server (default port: 1234)
4. Optionally enable "Serve on Local Network" if accessing remotely

### Environment Variables

- `LM_STUDIO_BASE_URL` - Base URL for LM Studio API (default: `http://localhost:1234`)

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lmstudio": {
      "command": "node",
      "args": ["/path/to/lmstudio-mcp/dist/index.js"],
      "env": {
        "LM_STUDIO_BASE_URL": "http://localhost:1234"
      }
    }
  }
}
```

### With Other MCP Clients

Run the server directly:

```bash
node dist/index.js
```

The server communicates over stdio following the MCP protocol.

## Available Tools

### `list_models`

List all available models with their current state (loaded/not-loaded).

**Parameters:** None

**Example Response:**
```json
[
  {
    "id": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF",
    "type": "llm",
    "publisher": "Meta",
    "architecture": "llama",
    "state": "loaded",
    "max_context_length": 8192
  }
]
```

### `get_model_details`

Get detailed information about a specific model.

**Parameters:**
- `model_id` (string, required) - The ID of the model

**Example:**
```json
{
  "model_id": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"
}
```

### `load_model`

Load a model into memory with configurable Time-To-Live.

**Parameters:**
- `model_id` (string, required) - The ID of the model to load
- `ttl` (number, optional) - Time-To-Live in seconds before auto-unload (default: 3600)

**Example:**
```json
{
  "model_id": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF",
  "ttl": 7200
}
```

### `unload_model`

Unload a model from memory immediately.

**Parameters:**
- `model_id` (string, required) - The ID of the model to unload

**Example:**
```json
{
  "model_id": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF"
}
```

### `configure_model`

Configure model settings such as TTL and draft model for speculative decoding.

**Parameters:**
- `model_id` (string, required) - The ID of the model to configure
- `ttl` (number, optional) - Time-To-Live in seconds
- `draft_model` (string, optional) - Draft model ID for speculative decoding

**Example:**
```json
{
  "model_id": "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF",
  "ttl": 1800,
  "draft_model": "small-draft-model"
}
```

## How It Works

LM Studio uses JIT (Just-In-Time) model loading. Models are loaded on-demand when inference requests are made:

- **Loading**: Making an inference request automatically loads the model with the specified TTL
- **Unloading**: Models auto-unload after TTL expires, or immediately when TTL is set to 0
- **Configuration**: Model settings are applied through inference request parameters

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Debug
```bash
npm run dev
```

## API Reference

This server interfaces with the [LM Studio Developer API](https://lmstudio.ai/docs/developer):

- `GET /api/v0/models` - List all available models
- `GET /api/v0/models/{model}` - Get model details
- `POST /api/v0/chat/completions` - Used for loading/configuring models

## Troubleshooting

### Connection Refused
- Ensure LM Studio is running
- Verify the local server is enabled in Developer settings
- Check that port 1234 (or custom port) is accessible

### Model Not Found
- Verify the model ID is correct using `list_models`
- Ensure the model is downloaded in LM Studio

### Model Won't Load
- Check available system memory
- Verify model compatibility with your system
- Review LM Studio logs for errors

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [LM Studio](https://lmstudio.ai/)
- [LM Studio Developer Docs](https://lmstudio.ai/docs/developer)
- [Model Context Protocol](https://modelcontextprotocol.io/)
