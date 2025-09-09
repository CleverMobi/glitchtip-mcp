import { GlitchtipMCPServer } from './src/index.js';

// Set environment variables for testing
process.env.GLITCHTIP_API_TOKEN = '';
process.env.GLITCHTIP_API_ENDPOINT = '';
process.env.GLITCHTIP_ORGANIZATION_SLUG = '';

const server = new GlitchtipMCPServer();
const issueId = '21873';

console.log('Testing MCP Server getIssue method with size reductions...\n');

try {
  const result = await server.getIssue({ issue_id: issueId });
  const data = JSON.parse(result.content[0].text);
  
  // Write to file for comparison
  const fs = await import('fs');
  fs.writeFileSync('dump-test.json', JSON.stringify(data, null, 2));
  
  // Check size
  const reducedSize = fs.statSync('dump-mcp-reduced.json').size;
  
  console.log('✅ SUCCESS! MCP Server getIssue executed successfully\n');
  console.log('=' .repeat(70));
  console.log('SIZE COMPARISON:');
  console.log('=' .repeat(70));
  console.log(`  Reduced size:  ${reducedSize.toLocaleString()} bytes`);
  console.log('=' .repeat(70));
  
  // Verify key reductions
  console.log('\n📋 VERIFICATION:');
  console.log(`  ✅ issue.project removed: ${!data.issue.project}`);
  console.log(`  ✅ latestEvent.packages removed: ${!data.latestEvent?.packages}`);
  console.log(`  ✅ latestEvent.sdk removed: ${!data.latestEvent?.sdk}`);
  
  // Check breadcrumbs
  const breadcrumbs = data.latestEvent?.entries?.find(e => e.type === 'breadcrumbs');
  if (breadcrumbs) {
    console.log(`  ✅ Breadcrumbs limited: ${breadcrumbs.data.values.length} entries`);
    const truncationNote = breadcrumbs.data.values[0];
    if (truncationNote.category === 'truncation') {
      console.log(`     ${truncationNote.message}`);
    }
  }
  
  // Check for truncated fields
  let truncatedCount = 0;
  const checkTruncation = (obj) => {
    if (typeof obj === 'string' && obj.includes('... [truncated]')) {
      truncatedCount++;
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(checkTruncation);
    }
  };
  checkTruncation(data);
  console.log(`  ✅ Truncated message fields: ${truncatedCount}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}