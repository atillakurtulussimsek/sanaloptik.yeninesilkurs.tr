const axios = require('axios');
const ssoConfig = require('../config/k12net-sso');

class K12NetSSO {
  /**
   * SSO login URL'ini oluştur
   */
  static getAuthorizationUrl() {
    const params = new URLSearchParams({
      response_type: ssoConfig.responseType,
      client_id: ssoConfig.clientId,
      redirect_uri: ssoConfig.redirectUri,
      scope: ssoConfig.scope
    });
    
    return `${ssoConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Authorization code ile access token al
   */
  static async exchangeCodeForToken(authorizationCode) {
    try {
      const response = await axios.post(
        ssoConfig.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: ssoConfig.redirectUri,
          client_id: ssoConfig.clientId,
          client_secret: ssoConfig.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Token exchange hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Access token ile kullanıcı bilgilerini al
   */
  static async getUserInfo(accessToken) {
    try {
      const response = await axios.get(ssoConfig.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('User info hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Client credentials ile API access token al
   */
  static async getApiAccessToken() {
    try {
      const response = await axios.post(
        ssoConfig.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: ssoConfig.clientId,
          client_secret: ssoConfig.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        success: true,
        accessToken: response.data.access_token
      };
    } catch (error) {
      console.error('API token hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Öğrenci bilgilerini al
   */
  static async getStudentInfo(userId, accessToken) {
    try {
      const response = await axios.get(
        `${ssoConfig.apiBaseUrl}/students/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Öğrenci bilgisi hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Öğrenci demografik bilgilerini al
   */
  static async getStudentDemographics(userId, accessToken) {
    try {
      const response = await axios.get(
        `${ssoConfig.apiBaseUrl}/students/${userId}/demographics`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Öğrenci demografik bilgisi hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Öğrenci kayıt bilgilerini al
   */
  static async getStudentEnrollments(userId, accessToken) {
    try {
      const response = await axios.get(
        `${ssoConfig.apiBaseUrl}/students/${userId}/enrollments`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Öğrenci kayıt bilgisi hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = K12NetSSO;
