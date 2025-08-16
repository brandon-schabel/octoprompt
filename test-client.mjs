import fetch from 'node-fetch';

// Simple test to verify the frontend's expected data structure
async function testProjectsEndpoint() {
  try {
    const response = await fetch('http://localhost:3147/api/projects', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log('Raw API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\nData structure check:');
    console.log('- Has success property:', 'success' in data);
    console.log('- Success value:', data.success);
    console.log('- Has data property:', 'data' in data);
    console.log('- Data is array:', Array.isArray(data.data));
    console.log('- Number of projects:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      console.log('\nFirst project structure:');
      const firstProject = data.data[0];
      console.log('- Has id:', 'id' in firstProject);
      console.log('- Has name:', 'name' in firstProject);
      console.log('- Has path:', 'path' in firstProject);
      console.log('- Has created:', 'created' in firstProject);
      console.log('- Has updated:', 'updated' in firstProject);
      console.log('- Project name:', firstProject.name);
      console.log('- Project path:', firstProject.path);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testProjectsEndpoint();
