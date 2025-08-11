// Quick test to verify Google Maps API access
const testGoogleAPI = async () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key starts with:', apiKey?.substring(0, 10) + '...');
  
  // Test Street View API directly
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=300x300&location=25.2048,55.2708&key=${apiKey}`;
  
  try {
    console.log('Testing Street View API...');
    const response = await fetch(streetViewUrl);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
    } else {
      console.log('Street View API working! Image size:', response.headers.get('content-length'));
    }
  } catch (error) {
    console.error('API test failed:', error.message);
  }
};

testGoogleAPI();