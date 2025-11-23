#!/usr/bin/env node
// OffSec Shield local MCP toolbox: docker helpers, HTTP probe, OSV check
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.OFFSEC_REPO_ROOT || path.resolve(__dirname, "../..");
const composeFile = process.env.OFFSEC_COMPOSE_FILE || path.join(repoRoot, "docker-compose.yml");
const defaultTimeoutMs = 20_000;
const outputLimit = 4_000;

function truncate(text, limit = outputLimit) {
  if (!text) return "(no output)";
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated]...` : text;
}

async function run(cmd, args, opts = {}) {
  const { cwd = repoRoot, timeout = defaultTimeoutMs } = opts;
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, timeout, maxBuffer: 2_000_000 });
    const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
    return combined || "(no output)";
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? "";
    const stdout = error?.stdout?.toString?.() ?? "";
    const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
    throw new McpError(
      ErrorCode.InternalError,
      `${cmd} ${args.join(" ")} failed: ${error.message}${combined ? `\n${combined}` : ""}`
    );
  }
}

function ensureComposeFile() {
  if (!fs.existsSync(composeFile)) {
    throw new McpError(ErrorCode.InvalidRequest, `Compose file not found at ${composeFile}`);
  }
  return composeFile;
}

const server = new McpServer(
  { name: "offsec-toolbox", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "docker_ps",
  {
    title: "Docker ps",
    description: "List Docker containers (optionally include stopped ones).",
    inputSchema: z
      .object({
        all: z.boolean().describe("Include stopped containers (docker ps -a)").optional()
      })
      .strip()
  },
  async ({ all = false }) => {
    const args = ["ps"];
    if (all) args.push("-a");
    const output = await run("docker", args);
    return { content: [{ type: "text", text: truncate(output) }] };
  }
);

server.registerTool(
  "docker_logs",
  {
    title: "Docker logs",
    description: "Tail Docker logs for a container.",
    inputSchema: z
      .object({
        container: z.string().min(1).describe("Container name or ID"),
        tail: z.number().int().positive().max(5_000).default(200).optional(),
        timestamps: z.boolean().optional()
      })
      .strip()
  },
  async ({ container, tail = 200, timestamps = false }) => {
    const args = ["logs", "--tail", `${tail}`];
    if (timestamps) args.push("-t");
    args.push(container);
    const output = await run("docker", args);
    return { content: [{ type: "text", text: truncate(output) }] };
  }
);

server.registerTool(
  "docker_inspect",
  {
    title: "Docker inspect",
    description: "Inspect a container/image (JSON).",
    inputSchema: z
      .object({
        target: z.string().min(1).describe("Container/image name or ID"),
        format: z.string().optional().describe("Optional Go template format string")
      })
      .strip()
  },
  async ({ target, format }) => {
    const args = ["inspect"];
    if (format) args.push("--format", format);
    args.push(target);
    const output = await run("docker", args, { timeout: 30_000 });
    return { content: [{ type: "text", text: truncate(output) }] };
  }
);

server.registerTool(
  "compose_ps",
  {
    title: "Compose ps",
    description: "List services in docker-compose.yml (uses OFFSEC_COMPOSE_FILE if set).",
    inputSchema: z
      .object({
        service: z.string().optional().describe("Optional service name to filter")
      })
      .strip()
  },
  async ({ service }) => {
    const file = ensureComposeFile();
    const args = ["compose", "-f", file, "ps"];
    if (service) args.push(service);
    const output = await run("docker", args, { cwd: path.dirname(file) });
    return { content: [{ type: "text", text: truncate(output) }] };
  }
);

server.registerTool(
  "compose_logs",
  {
    title: "Compose logs",
    description: "Tail logs for a docker-compose service.",
    inputSchema: z
      .object({
        service: z.string().min(1).describe("Service name"),
        tail: z.number().int().positive().max(5_000).default(200).optional(),
        timestamps: z.boolean().optional()
      })
      .strip()
  },
  async ({ service, tail = 200, timestamps = false }) => {
    const file = ensureComposeFile();
    const args = ["compose", "-f", file, "logs", "--tail", `${tail}`];
    if (timestamps) args.push("-t");
    args.push(service);
    const output = await run("docker", args, { cwd: path.dirname(file) });
    return { content: [{ type: "text", text: truncate(output) }] };
  }
);

server.registerTool(
  "http_request",
  {
    title: "HTTP probe",
    description: "Lightweight HTTP request to local services (GET/POST/etc).",
    inputSchema: z
      .object({
        url: z.string().url(),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
          .default("GET")
          .optional(),
        headers: z.record(z.string()).optional(),
        body: z.string().optional(),
        timeout_ms: z.number().int().positive().max(60_000).default(8_000).optional()
      })
      .strip()
  },
  async ({ url, method = "GET", headers = {}, body, timeout_ms = 8_000 }) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new McpError(ErrorCode.InvalidParams, "Only http/https URLs are allowed");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout_ms);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      const text = await res.text();
      const responseHeaders = [...res.headers.entries()]
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      const payload = `${res.status} ${res.statusText}\n${responseHeaders}\n\n${truncate(text)}`;
      return { content: [{ type: "text", text: payload }] };
    } catch (error) {
      if (error.name === "AbortError") {
        throw new McpError(ErrorCode.RequestTimeout, `HTTP request timed out after ${timeout_ms}ms`);
      }
      throw new McpError(ErrorCode.InternalError, `HTTP request failed: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
);

server.registerTool(
  "osv_check",
  {
    title: "OSV vulnerability check",
    description: "Query osv.dev for known vulnerabilities for a package/version.",
    inputSchema: z
      .object({
        ecosystem: z
          .string()
          .min(1)
          .describe('Package ecosystem, e.g. "npm", "PyPI", "crates.io"'),
        package: z.string().min(1).describe("Package name"),
        version: z.string().optional().describe("Optional version to check")
      })
      .strip()
  },
  async ({ ecosystem, package: pkg, version }) => {
    const body = {
      package: { ecosystem, name: pkg },
      version
    };
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new McpError(ErrorCode.InternalError, `OSV query failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const vulns = data.vulns || [];
    if (!vulns.length) {
      return { content: [{ type: "text", text: `No vulnerabilities found for ${ecosystem}:${pkg}${version ? "@" + version : ""}.` }] };
    }
    const lines = vulns.map((v) => {
      const summary = v.summary || v.details || "";
      return `${v.id} (${v.modified ?? v.published ?? "n/a"})\n${summary}`;
    });
    return { content: [{ type: "text", text: truncate(lines.join("\n\n")) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
