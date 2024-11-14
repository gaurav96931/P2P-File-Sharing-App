import os from 'os';

// Function to Get Local IP Address
function getLocalIpAddress () {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const net of interfaces[interfaceName]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  throw new Error('System not connected to network, try again after troubleshoot.');
}
export default getLocalIpAddress;
