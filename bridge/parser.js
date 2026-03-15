// parser.js — Parses OpenClaw JSONL events into dashboard state updates
import config from './config.js';

/**
 * Parse a single JSONL line into a structured event
 * Returns null if the line isn't relevant to the dashboard
 */
export function parseEvent(line, agentId) {
  try {
    const raw = JSON.parse(line);
    const timestamp = raw.timestamp || raw.message?.timestamp || new Date().toISOString();

    switch (raw.type) {
      case 'session':
        return {
          kind: 'session_start',
          agentId,
          sessionId: raw.id,
          timestamp,
          version: raw.version,
        };

      case 'model_change':
        return {
          kind: 'model_change',
          agentId,
          provider: raw.provider,
          model: raw.modelId,
          timestamp,
        };

      case 'thinking_level_change':
        return {
          kind: 'thinking_change',
          agentId,
          level: raw.thinkingLevel,
          timestamp,
        };

      case 'message':
        return parseMessage(raw, agentId, timestamp);

      default:
        return null;
    }
  } catch (err) {
    // Malformed line, skip
    return null;
  }
}

function parseMessage(raw, agentId, timestamp) {
  const msg = raw.message;
  if (!msg) return null;

  // Assistant message — agent is working
  if (msg.role === 'assistant') {
    const content = msg.content || [];
    const toolCalls = content.filter(c => c.type === 'toolCall');
    const textBlocks = content.filter(c => c.type === 'text');

    // Extract usage/cost data
    const usage = msg.usage || null;
    const provider = msg.provider || null;
    const model = msg.model || null;

    if (toolCalls.length > 0) {
      return {
        kind: 'tool_calls',
        agentId,
        timestamp,
        provider,
        model,
        usage,
        tools: toolCalls.map(tc => ({
          callId: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          station: classifyTool(tc.name),
        })),
      };
    }

    if (textBlocks.length > 0) {
      return {
        kind: 'agent_thinking',
        agentId,
        timestamp,
        provider,
        model,
        usage,
        preview: textBlocks[0]?.text?.substring(0, 120) || '',
      };
    }

    // Message with usage but no parsed content (e.g., streaming)
    if (usage) {
      return {
        kind: 'usage_update',
        agentId,
        timestamp,
        provider,
        model,
        usage,
      };
    }

    return null;
  }

  // Tool result — tool finished
  if (msg.role === 'toolResult') {
    return {
      kind: 'tool_result',
      agentId,
      timestamp: typeof msg.timestamp === 'number'
        ? new Date(msg.timestamp).toISOString()
        : timestamp,
      callId: msg.toolCallId,
      toolName: msg.toolName,
      isError: msg.isError || false,
      station: classifyTool(msg.toolName),
    };
  }

  // User message — new task/prompt
  if (msg.role === 'user') {
    const textContent = (msg.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');

    return {
      kind: 'user_prompt',
      agentId,
      timestamp,
      preview: textContent.substring(0, 120),
    };
  }

  return null;
}

/**
 * Classify a tool name into a featured station or "generic"
 */
function classifyTool(toolName) {
  for (const ft of config.featuredTools) {
    if (ft.pattern.test(toolName)) {
      return { name: ft.name, icon: ft.icon };
    }
  }
  return { name: 'Tools', icon: '🔧' };
}
