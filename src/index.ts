#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// LM Studio API configuration
const LM_STUDIO_BASE_URL = process.env.LM_STUDIO_BASE_URL || "http://localhost:1234";

interface LMStudioModel {
  id: string;
  type: "llm" | "vlm" | "embeddings";
  publisher?: string;
  architecture?: string;
  compatibility?: string;
  quantization?: string;
  state?: "loaded" | "not-loaded";
  max_context_length?: number;
}

interface ModelsResponse {
  data: LMStudioModel[];
}

/**
 * Make HTTP request to LM Studio API
 */
async function lmStudioRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${LM_STUDIO_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LM Studio API request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * List all available models
 */
async function listModels(): Promise<LMStudioModel[]> {
  const response = await lmStudioRequest<ModelsResponse>("/api/v0/models");
  return response.data;
}

/**
 * Get details for a specific model
 */
async function getModelDetails(modelId: string): Promise<LMStudioModel> {
  const response = await lmStudioRequest<LMStudioModel>(`/api/v0/models/${modelId}`);
  return response;
}

/**
 * Load a model with specified TTL (Time-To-Live in seconds)
 * This is done by making a minimal inference request
 */
async function loadModel(modelId: string, ttl: number = 3600): Promise<string> {
  try {
    await lmStudioRequest("/api/v0/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "system", content: "ping" }],
        max_tokens: 1,
        ttl: ttl,
      }),
    });

    return `Model '${modelId}' loaded successfully with TTL of ${ttl} seconds`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load model: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Unload a model by setting TTL to 0
 */
async function unloadModel(modelId: string): Promise<string> {
  try {
    await lmStudioRequest("/api/v0/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "system", content: "unload" }],
        max_tokens: 1,
        ttl: 0,
      }),
    });

    return `Model '${modelId}' unloaded successfully`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to unload model: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Configure model settings
 */
async function configureModel(
  modelId: string,
  ttl?: number,
  draftModel?: string
): Promise<string> {
  const config: Record<string, any> = {
    model: modelId,
    messages: [{ role: "system", content: "configure" }],
    max_tokens: 1,
  };

  if (ttl !== undefined) {
    config.ttl = ttl;
  }

  if (draftModel) {
    config.draft_model = draftModel;
  }

  try {
    await lmStudioRequest("/api/v0/chat/completions", {
      method: "POST",
      body: JSON.stringify(config),
    });

    const updates: string[] = [];
    if (ttl !== undefined) updates.push(`TTL: ${ttl}s`);
    if (draftModel) updates.push(`Draft model: ${draftModel}`);

    return `Model '${modelId}' configured: ${updates.join(", ")}`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to configure model: ${error.message}`);
    }
    throw error;
  }
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "list_models",
    description: "List all available models in LM Studio with their current state (loaded/not-loaded)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_model_details",
    description: "Get detailed information about a specific model including architecture, quantization, and context length",
    inputSchema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The ID of the model to get details for",
        },
      },
      required: ["model_id"],
    },
  },
  {
    name: "load_model",
    description: "Load a model into memory with configurable Time-To-Live (TTL). The model will auto-unload after the TTL expires.",
    inputSchema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The ID of the model to load",
        },
        ttl: {
          type: "number",
          description: "Time-To-Live in seconds before auto-unload (default: 3600)",
          default: 3600,
        },
      },
      required: ["model_id"],
    },
  },
  {
    name: "unload_model",
    description: "Unload a model from memory immediately by setting its TTL to 0",
    inputSchema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The ID of the model to unload",
        },
      },
      required: ["model_id"],
    },
  },
  {
    name: "configure_model",
    description: "Configure model settings such as TTL and draft model for speculative decoding",
    inputSchema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The ID of the model to configure",
        },
        ttl: {
          type: "number",
          description: "Time-To-Live in seconds (optional)",
        },
        draft_model: {
          type: "string",
          description: "Draft model ID for speculative decoding (optional)",
        },
      },
      required: ["model_id"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "lmstudio-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_models": {
        const models = await listModels();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      }

      case "get_model_details": {
        const modelId = args?.model_id as string;
        if (!modelId) {
          throw new Error("model_id is required");
        }

        const details = await getModelDetails(modelId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      case "load_model": {
        const modelId = args?.model_id as string;
        const ttl = (args?.ttl as number) || 3600;

        if (!modelId) {
          throw new Error("model_id is required");
        }

        const result = await loadModel(modelId, ttl);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "unload_model": {
        const modelId = args?.model_id as string;

        if (!modelId) {
          throw new Error("model_id is required");
        }

        const result = await unloadModel(modelId);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "configure_model": {
        const modelId = args?.model_id as string;
        const ttl = args?.ttl as number | undefined;
        const draftModel = args?.draft_model as string | undefined;

        if (!modelId) {
          throw new Error("model_id is required");
        }

        const result = await configureModel(modelId, ttl, draftModel);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr since stdout is used for MCP communication
  console.error("LM Studio MCP Server running on stdio");
  console.error(`Connecting to LM Studio at: ${LM_STUDIO_BASE_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
