# Glitchtip MCP Server

MCP (Model Context Protocol) server for interacting with the Glitchtip API.

Created for internal use mostly by Claude Code.
License: GNU AGPLv3

## Features

Complete integration with Glitchtip error tracking platform, providing access to:
- Issues and error details
- Events and error occurrences
- Projects and organization management
- Teams and member information

## Requirements

- Node.js 18+
- Glitchtip API token with appropriate scopes (see Authentication section)

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```bash
export GLITCHTIP_API_TOKEN="your-api-token"
export GLITCHTIP_ORGANIZATION_SLUG="your-org-slug"
export GLITCHTIP_API_ENDPOINT="https://app.glitchtip.com"  # Or your self-hosted instance
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "glitchtip": {
      "command": "npx",
      "args": ["-y", "github:CleverMobi/glitchtip-mcp"],
      "env": {
        "GLITCHTIP_API_TOKEN": "your-api-token",
        "GLITCHTIP_ORGANIZATION_SLUG": "your-org-slug",
        "GLITCHTIP_API_ENDPOINT": "https://your-glitchtip-instance.com"
      }
    }
  }
}
```

## Available Tools

### Issue & Event Tools (Require `event:read` scope)

#### get_issue
Get complete details of a specific Glitchtip issue including:
- Basic issue information (title, status, count, project, etc.)
- Latest event details with full stack trace
- All comments on the issue

Parameters:
- `issue_id` (required): The ID of the issue to retrieve

Example:
```
get_issue(issue_id: "21241")
```

Returns a comprehensive object with three sections:
- `issue`: Core issue details
- `latestEvent`: Most recent occurrence with stack trace, tags, and metadata
- `comments`: Array of all comments with author and timestamp

#### list_issues
List issues in the organization or a specific project.

Parameters:
- `project_slug` (optional): Filter issues by project
- `limit` (optional): Maximum number of issues to return (default: 25)

Example:
```
list_issues(project_slug: "my-project", limit: 10)
```

#### list_events
List events for a specific project.

Parameters:
- `project_slug` (required): The slug of the project
- `limit` (optional): Maximum number of events to return (default: 25)

Example:
```
list_events(project_slug: "my-project", limit: 5)
```

### Project & Organization Tools

#### list_projects
List all Glitchtip projects in the organization.

No parameters required.

Example:
```
list_projects()
```

#### get_project
Get details of a specific Glitchtip project.

Parameters:
- `project_slug` (required): The slug of the project to retrieve

Example:
```
get_project(project_slug: "my-project")
```

#### get_organization
Get organization details including all projects and teams.

No parameters required.

Example:
```
get_organization()
```

#### list_teams
List all teams in the organization.

No parameters required.

Example:
```
list_teams()
```

## Authentication

This server uses Bearer token authentication. Your API token needs specific scopes depending on which tools you want to use:

### Required Scopes

| Tool | Required Scopes |
|------|----------------|
| `get_issue`, `list_issues`, `list_events` | `event:read` |
| `list_projects`, `get_project` | `project:read` |
| `get_organization` | `org:read` |
| `list_teams` | `team:read` |

### Minimum Token Scopes

- For basic project/org information: `project:read`, `org:read`, `team:read`, `member:read`
- For full functionality including issues: `project:read`, `org:read`, `team:read`, `member:read`, `event:read`

To create an API token in Glitchtip:
1. Go to your Glitchtip instance
2. Navigate to Settings → API Tokens
3. Create a new token with the required scopes

## Testing

Test the server functionality:
```bash
# Run basic tests
node test-get-issue.js
```

## Troubleshooting

### 403 Forbidden Errors
If you receive 403 errors when accessing issues or events, your API token is missing the `event:read` scope. Create a new token with the appropriate scopes.

### 401 Unauthorized Errors
Ensure your API token is valid and uses Bearer authentication format.

### Connection Issues
Verify your `GLITCHTIP_API_ENDPOINT` is correct and accessible.
