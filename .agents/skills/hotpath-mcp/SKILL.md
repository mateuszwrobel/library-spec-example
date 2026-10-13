---
name: Hotpath MCP Profiling
description: Use hotpath's MCP server to query real-time profiling data from Rust applications
---

# Hotpath MCP Profiling Skill

(tool-specific skill example — keep alongside the generic skills and adapt to this project's languages/tools)

This skill enables you to use the hotpath MCP (Model Context Protocol) server to query profiling data in real-time from Rust applications. This allows you to ask questions about application performance directly in your AI-assisted development workflow.

## Overview

Hotpath is a Rust profiling library that provides an MCP server, enabling AI agents like Claude to query profiling data in real-time. This integration allows you to analyze performance metrics, identify bottlenecks, and optimize your application through natural language queries.

## Configuration

### 1. Enable MCP Features in Cargo.toml

Add the hotpath dependency and features to your `Cargo.toml`:

```toml
[dependencies]
hotpath = "0.9"

[features]
hotpath = ["hotpath/hotpath"]
hotpath-mcp = ["hotpath/hotpath-mcp"]
```

### 2. Run Your Application with MCP Enabled

Start your application with the MCP features:

```bash
cargo run --features='hotpath,hotpath-mcp'
```

**Configuration Options:**
- **Default port:** 6771
- **Endpoint:** `http://localhost:6771/mcp`
- **Environment Variables:**
  - `HOTPATH_MCP_PORT` - Customize the port (e.g., `HOTPATH_MCP_PORT=8080`)
  - `HOTPATH_MCP_AUTH_TOKEN` - Optional authentication token for security

### 3. Authentication (Optional)

When `HOTPATH_MCP_AUTH_TOKEN` is set, clients must include the token in the `Authorization` header:

```bash
export HOTPATH_MCP_AUTH_TOKEN="your-secret-token"
cargo run --features='hotpath,hotpath-mcp'
```

When not set, no authentication is required (suitable for local development).

## Claude Code Configuration

### Basic Configuration (No Authentication)

Run this command to add the hotpath MCP server:

```bash
claude mcp add --transport http hotpath http://localhost:6771/mcp
```

Or manually add to your Claude configuration:

```json
"mcpServers": {
    "hotpath": {
        "type": "http",
        "url": "http://localhost:6771/mcp"
    }
}
```

### With Authentication

```bash
claude mcp add --transport http hotpath http://localhost:6771/mcp --header "Authorization: your-secret-token"
```

Or manually:

```json
"mcpServers": {
    "hotpath": {
        "type": "http",
        "url": "http://localhost:6771/mcp",
        "headers": {
            "Authorization": "your-secret-token"
        }
    }
}
```

## Available MCP Tools

The hotpath MCP server provides the following tools for querying profiling data:

### Summary Tools (Aggregated Metrics)

| Tool | Description |
|------|-------------|
| `functions_timing` | Execution timing metrics (call count, avg, p50/p95/p99, total) |
| `functions_alloc` | Memory allocation metrics per function (requires `hotpath-alloc` feature) |
| `channels` | Channel metrics (sent/received counts, queue size, state) |
| `streams` | Stream metrics (items yielded, state) |
| `futures` | Future lifecycle metrics (poll counts, state) |
| `threads` | Thread CPU usage metrics |
| `gauges` | Gauge metrics (current/min/max values, update count) |

### Detailed Log Tools (Individual Events)

| Tool | Description |
|------|-------------|
| `function_timing_logs(function_name)` | Detailed timing logs for a specific function |
| `function_alloc_logs(function_name)` | Detailed allocation logs for a specific function |
| `channel_logs(channel_id)` | Message logs for a specific channel |
| `stream_logs(stream_id)` | Item logs for a specific stream |
| `future_logs(future_id)` | Poll/completion logs for a specific future |
| `gauge_logs(gauge_id)` | Value update logs for a specific gauge |

## Usage Workflow

### 1. Start Your Application

```bash
# Basic usage
cargo run --features='hotpath,hotpath-mcp'

# With custom port
HOTPATH_MCP_PORT=8080 cargo run --features='hotpath,hotpath-mcp'

# With authentication
HOTPATH_MCP_AUTH_TOKEN="my-secret" cargo run --features='hotpath,hotpath-mcp'
```

The MCP server will start automatically on the configured port (default: 6771).

### 2. Configure Claude Code

Ensure Claude Code is configured to connect to the hotpath MCP server (see Configuration section above).

### 3. Query Profiling Data

Once your application is running and Claude is configured, you can ask natural language questions about your application's performance:

**Example Queries:**

- "What are the slowest functions?"
- "Show me the p99 latencies for all functions"
- "Are there any channels with growing queues?"
- "Which functions allocate the most memory?"
- "Show me detailed timing logs for the `process_request` function"
- "What's the current state of all futures?"
- "Are there any performance bottlenecks in the async runtime?"

### 4. Analyze and Optimize

Use the profiling data to:
- Identify performance bottlenecks
- Detect memory leaks or excessive allocations
- Monitor async runtime behavior
- Track channel backpressure
- Optimize critical code paths

## Example Session

```
USER: Start the my-app with profiling enabled

A: [Runs: cargo run --features='hotpath,hotpath-mcp' in my-app/src]

USER: What are the slowest functions in the application?

A: [Queries functions_timing tool via MCP]
Based on the profiling data, the slowest functions are:
1. audio_processing::transcribe - p99: 245ms, avg: 180ms
2. network::send_request - p99: 120ms, avg: 85ms
3. ui::render_waveform - p99: 45ms, avg: 30ms

USER: Show me detailed logs for the transcribe function

A: [Queries function_timing_logs("audio_processing::transcribe")]
Here are the recent timing logs for transcribe:
- Call 1: 178ms
- Call 2: 245ms (outlier)
- Call 3: 165ms
...
```

## Tips and Best Practices

1. **Development Only**: The MCP server is intended for development and debugging. Don't enable it in production builds.

2. **Feature Flags**: Use feature flags to conditionally compile profiling code:
   ```rust
   #[cfg(feature = "hotpath")]
   use hotpath::*;
   ```

3. **Selective Instrumentation**: Only instrument critical code paths to minimize overhead.

4. **Authentication**: Always use `HOTPATH_MCP_AUTH_TOKEN` when exposing the MCP server on a network.

5. **Port Conflicts**: If port 6771 is in use, set `HOTPATH_MCP_PORT` to an available port.

6. **Combine with Other Tools**: Use hotpath alongside other profiling tools (flamegraphs, perf, etc.) for comprehensive analysis.

## Troubleshooting

### MCP Server Not Starting

- Verify the `hotpath-mcp` feature is enabled: `cargo run --features='hotpath,hotpath-mcp'`
- Check if the port is already in use: `lsof -i :6771`
- Review application logs for MCP server startup messages

### Claude Can't Connect

- Ensure the application is running with MCP enabled
- Verify the URL in Claude's configuration matches your setup
- Check authentication token if configured
- Test the endpoint manually: `curl http://localhost:6771/mcp`

### No Profiling Data

- Ensure your code is instrumented with hotpath macros/attributes
- Verify the `hotpath` feature is enabled (not just `hotpath-mcp`)
- Check that the instrumented code paths are actually being executed

### Authentication Errors

- Verify `HOTPATH_MCP_AUTH_TOKEN` matches in both the application and Claude configuration
- Ensure the `Authorization` header is correctly formatted in Claude's config

## Related Resources

- [Hotpath GitHub Repository](https://github.com/hotpath-rs/hotpath)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Code MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)