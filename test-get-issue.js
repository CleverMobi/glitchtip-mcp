import fetch from 'node-fetch';

// Configuration - same as used in MCP server
const apiToken = '';
const apiEndpoint = 'https://';
const organizationSlug = '';

// Test issue ID
const issueId = '21241';

console.log('='.repeat(70));
console.log('Testing get_issue() - Exact MCP Implementation');
console.log('='.repeat(70));
console.log(`\nFetching complete information for issue #${issueId}...\n`);

/**
 * This function is EXACTLY the same as the getIssue method in the MCP server
 * It fetches issue details, latest event, and comments
 */
async function getIssue(args) {
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
    const issueUrl = `${apiEndpoint}/api/0/issues/${issue_id}/`;
    const issueResponse = await fetch(issueUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
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
      const eventUrl = `${apiEndpoint}/api/0/issues/${issue_id}/events/latest/`;
      const eventResponse = await fetch(eventUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
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
        const commentsUrl = `${apiEndpoint}/api/0/issues/${issue_id}/comments/`;
        const commentsResponse = await fetch(commentsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
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

// Call the function exactly as MCP would
const response = await getIssue({ issue_id: issueId });

// Extract the JSON from the response (MCP format)
const data = JSON.parse(response.content[0].text);

console.log('✅ SUCCESS! Here is the complete response from get_issue():\n');
console.log('='.repeat(70));
console.log('RAW JSON RESPONSE (exactly what MCP returns):');
console.log('='.repeat(70));
console.log(JSON.stringify(data, null, 2));

console.log('\n' + '='.repeat(70));
console.log('📊 PARSED DETAILS:');
console.log('='.repeat(70));

// Display parsed information
console.log('\n1️⃣ BASIC ISSUE INFO:');
console.log(`  Issue ID: ${data.issue.id}`);
console.log(`  Title: ${data.issue.title}`);
console.log(`  Status: ${data.issue.status}`);
console.log(`  Level: ${data.issue.level}`);
console.log(`  Count: ${data.issue.count} occurrences`);
console.log(`  First Seen: ${data.issue.firstSeen}`);
console.log(`  Last Seen: ${data.issue.lastSeen}`);
if (data.issue.project) {
  console.log(`  Project: ${data.issue.project.name} (${data.issue.project.platform})`);
}

console.log('\n2️⃣ LATEST EVENT:');
if (data.latestEvent) {
  console.log(`  Event ID: ${data.latestEvent.id}`);
  console.log(`  Date: ${data.latestEvent.dateCreated}`);
  console.log(`  Culprit: ${data.latestEvent.culprit || 'Not specified'}`);

  if (data.latestEvent.tags && data.latestEvent.tags.length > 0) {
    console.log(`\n  Tags (${data.latestEvent.tags.length}):`);
    data.latestEvent.tags.forEach(tag => {
      console.log(`    - ${tag.key}: ${tag.value}`);
    });
  }

  if (data.latestEvent.entries && data.latestEvent.entries.length > 0) {
    const exception = data.latestEvent.entries.find(e => e.type === 'exception');
    if (exception && exception.data && exception.data.values && exception.data.values[0]) {
      const stacktrace = exception.data.values[0].stacktrace;
      if (stacktrace && stacktrace.frames) {
        console.log(`\n  Stack Trace (${stacktrace.frames.length} frames total, showing top 3):`);
        stacktrace.frames.slice(0, 3).forEach((frame, i) => {
          console.log(`    ${i + 1}. ${frame.filename}:${frame.lineNo}`);
          if (frame.function) {
            console.log(`       in ${frame.function}`);
          }
        });
      }
    }
  }
} else {
  console.log('  No event data available');
}

console.log('\n3️⃣ COMMENTS:');
if (data.comments && data.comments.length > 0) {
  data.comments.forEach((comment, i) => {
    console.log(`  Comment ${i + 1}:`);
    console.log(`    Text: "${comment.data.text}"`);
    console.log(`    Author: ${comment.user.email}`);
    console.log(`    Date: ${comment.dateCreated}`);
  });
} else {
  console.log('  No comments');
}

console.log('\n' + '='.repeat(70));
console.log('💡 This test uses the EXACT same code as the MCP server\'s get_issue()');
console.log('   The response above is what you get when calling the MCP tool');
console.log('='.repeat(70));
