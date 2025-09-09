#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';

export class GlitchtipMCPServer {
  constructor() {
    this.apiToken = process.env.GLITCHTIP_API_TOKEN;
    this.organizationSlug = process.env.GLITCHTIP_ORGANIZATION_SLUG;
    this.apiEndpoint = process.env.GLITCHTIP_API_ENDPOINT || 'https://app.glitchtip.com';
    
    if (!this.apiToken) {
      throw new Error('GLITCHTIP_API_TOKEN environment variable is required');
    }
    if (!this.organizationSlug) {
      throw new Error('GLITCHTIP_ORGANIZATION_SLUG environment variable is required');
    }
    
    this.server = new Server(
      {
        name: 'glitchtip-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_issue",
            description: "Get complete details of a specific Glitchtip issue including latest event and comments (requires event:read scope)",
            inputSchema: {
              type: "object",
              properties: {
                issue_id: {
                  type: "string",
                  description: "The ID of the issue to retrieve"
                }
              },
              required: ["issue_id"]
            }
          },
          {
            name: "list_issues",
            description: "List issues in the organization or a specific project (requires event:read scope)",
            inputSchema: {
              type: "object",
              properties: {
                project_slug: {
                  type: "string",
                  description: "Optional project slug to filter issues by project"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of issues to return (default: 25)"
                }
              }
            }
          },
          {
            name: "list_events",
            description: "List events for a specific project (requires event:read scope)",
            inputSchema: {
              type: "object",
              properties: {
                project_slug: {
                  type: "string",
                  description: "The slug of the project"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of events to return (default: 25)"
                }
              },
              required: ["project_slug"]
            }
          },
          {
            name: "list_projects",
            description: "List all Glitchtip projects in the organization",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "get_project",
            description: "Get details of a specific Glitchtip project",
            inputSchema: {
              type: "object",
              properties: {
                project_slug: {
                  type: "string",
                  description: "The slug of the project to retrieve"
                }
              },
              required: ["project_slug"]
            }
          },
          {
            name: "get_organization",
            description: "Get organization details",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "list_teams",
            description: "List all teams in the organization",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });
    
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case "get_issue":
            return await this.getIssue(args);
          case "list_issues":
            return await this.listIssues(args);
          case "list_events":
            return await this.listEvents(args);
          case "list_projects":
            return await this.listProjects();
          case "get_project":
            return await this.getProject(args);
          case "get_organization":
            return await this.getOrganization();
          case "list_teams":
            return await this.listTeams();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      }
    );
  }
  
  async getIssue(args) {
    const { issue_id } = args;
    
    if (!issue_id) {
      return {
        content: [
          {
            type: "text",
            text: "Error: issue_id is required"
          }
        ]
      };
    }
    
    const result = {
      issue: null,
      latestEvent: null,
      comments: []
    };
    
    try {
      // 1. Get basic issue details
      const issueUrl = `${this.apiEndpoint}/api/0/issues/${issue_id}/`;
      const issueResponse = await fetch(issueUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!issueResponse.ok) {
        const errorText = await issueResponse.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching issue: ${issueResponse.status} ${issueResponse.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      result.issue = await issueResponse.json();
      
      // Remove project field to reduce size
      delete result.issue.project;
      
      // 2. Get latest event details
      try {
        const eventUrl = `${this.apiEndpoint}/api/0/issues/${issue_id}/events/latest/`;
        const eventResponse = await fetch(eventUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Accept': 'application/json'
          }
        });
        
        if (eventResponse.ok) {
          result.latestEvent = await eventResponse.json();
          
          // Remove packages and sdk fields to reduce size
          delete result.latestEvent.packages;
          delete result.latestEvent.sdk;
          
          // Process entries to reduce size
          if (result.latestEvent.entries) {
            result.latestEvent.entries.forEach(entry => {
              // Limit breadcrumbs to last 10 if there are more than 10
              if (entry.type === 'breadcrumbs' && entry.data && entry.data.values && 
                  Array.isArray(entry.data.values) && entry.data.values.length > 10) {
                // Keep only the last 10 breadcrumbs
                const totalBreadcrumbs = entry.data.values.length;
                entry.data.values = entry.data.values.slice(-10);
                // Add a note about how many were removed
                entry.data.values.unshift({
                  timestamp: entry.data.values[0]?.timestamp || null,
                  type: 'info',
                  category: 'truncation',
                  level: 'info',
                  message: `[${totalBreadcrumbs - 10} earlier breadcrumbs removed]`
                });
              }
              
              // Check in breadcrumb data values for messenger.messages
              if (entry.data && entry.data.values) {
                entry.data.values.forEach(value => {
                  // Check if value has data.messenger.messages
                  if (value.data && value.data.messenger && value.data.messenger.messages) {
                    value.data.messenger.messages.forEach(message => {
                      if (message.fields) {
                        // Check if the entire fields object when JSON encoded is > 200 chars
                        const fieldsJson = JSON.stringify(message.fields);
                        if (fieldsJson.length > 200) {
                          // Replace the entire fields with a truncated JSON string
                          message.fields = fieldsJson.substring(0, 200) + '... [truncated]';
                        }
                      }
                    });
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        // Silently ignore if latest event cannot be fetched
      }
      
      // 3. Get comments if they exist
      if (result.issue.numComments > 0) {
        try {
          const commentsUrl = `${this.apiEndpoint}/api/0/issues/${issue_id}/comments/`;
          const commentsResponse = await fetch(commentsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Accept': 'application/json'
            }
          });
          
          if (commentsResponse.ok) {
            result.comments = await commentsResponse.json();
          }
        } catch (error) {
          // Silently ignore if comments cannot be fetched
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async listIssues(args) {
    const { project_slug, limit = 25 } = args || {};
    
    let url;
    if (project_slug) {
      url = `${this.apiEndpoint}/api/0/projects/${this.organizationSlug}/${project_slug}/issues/?limit=${limit}`;
    } else {
      url = `${this.apiEndpoint}/api/0/organizations/${this.organizationSlug}/issues/?limit=${limit}`;
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching issues: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async listEvents(args) {
    const { project_slug, limit = 25 } = args || {};
    
    if (!project_slug) {
      return {
        content: [
          {
            type: "text",
            text: "Error: project_slug is required"
          }
        ]
      };
    }
    
    const url = `${this.apiEndpoint}/api/0/projects/${this.organizationSlug}/${project_slug}/events/?limit=${limit}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching events: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async listProjects() {
    const url = `${this.apiEndpoint}/api/0/organizations/${this.organizationSlug}/projects/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching projects: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async getProject(args) {
    const { project_slug } = args;
    
    if (!project_slug) {
      return {
        content: [
          {
            type: "text",
            text: "Error: project_slug is required"
          }
        ]
      };
    }
    
    const url = `${this.apiEndpoint}/api/0/projects/${this.organizationSlug}/${project_slug}/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching project: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async getOrganization() {
    const url = `${this.apiEndpoint}/api/0/organizations/${this.organizationSlug}/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching organization: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async listTeams() {
    const url = `${this.apiEndpoint}/api/0/organizations/${this.organizationSlug}/teams/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Error fetching teams: ${response.status} ${response.statusText}\n${errorText}`
            }
          ]
        };
      }
      
      const data = await response.json();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  }
  
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Glitchtip MCP server started');
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GlitchtipMCPServer();
  server.run().catch(console.error);
}