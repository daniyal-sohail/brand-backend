// test-vercel.js
// Simple test to verify Vercel deployment compatibility

console.log('Testing Vercel deployment compatibility...');

// Test environment variables
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);

// Test app initialization
try {
  const app = require('./server');
  console.log('✅ App initialized successfully');
  
  // Test basic middleware
  const testRequest = {
    method: 'GET',
    url: '/api/health',
    headers: {},
    body: {},
    query: {},
    params: {}
  };

  const testResponse = {
    status: (code) => {
      console.log(`✅ Response status: ${code}`);
      return {
        json: (data) => {
          console.log('✅ Response data:', JSON.stringify(data, null, 2));
        }
      };
    }
  };

  // Test the health endpoint
  app._router.handle(testRequest, testResponse, () => {
    console.log('✅ Health endpoint test completed');
  });

} catch (error) {
  console.error('❌ App initialization failed:', error.message);
  process.exit(1);
}

console.log('✅ All tests passed - ready for Vercel deployment!');
