// K12NET SSO Configuration
module.exports = {
  // K12NET OAuth URLs
  authorizationUrl: 'https://api.k12net.com/GWCore.Web/connect/authorize',
  tokenUrl: 'https://api.k12net.com/GWCore.Web/connect/token',
  userInfoUrl: 'https://api.k12net.com/GWCore.Web/connect/userinfo',
  
  // API Endpoints
  apiBaseUrl: 'https://api.k12net.com/INTCore.Web/api/partner/sso',
  
  // Client Credentials (Bu değerleri .env dosyasından veya güvenli bir yerden almalısınız)
  clientId: process.env.K12NET_CLIENT_ID || 'e02a6804-3f38-4069-8509-84f1798fdc88',
  clientSecret: process.env.K12NET_CLIENT_SECRET || '52e65951-172c-4403-86e1-fa7ecb16a16e',
  
  // Redirect URI (Başarılı login sonrası dönüş URL'i)
  redirectUri: process.env.K12NET_REDIRECT_URI || 'http://localhost:3000/sso',
  
  // OAuth Scopes
  scope: 'openid profile',
  
  // Response Type
  responseType: 'code'
};
