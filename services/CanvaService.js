const axios = require('axios');
const logger = require('../utils/logger');

class CanvaService {
    constructor() {
        this.baseURL = 'https://api.canva.com/rest/v1';
        this.oauthURL = 'https://api.canva.com/rest/v1/oauth';
        this.clientId = process.env.CANVA_CLIENT_ID;
        this.clientSecret = process.env.CANVA_CLIENT_SECRET;
        this.redirectUri = process.env.CANVA_REDIRECT_URI;
    }

    // Get tokens from authorization code
    async getTokens(code, codeVerifier) {
        try {
            const response = await axios.post(`${this.oauthURL}/token`, {
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                code: code,
                code_verifier: codeVerifier
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to get tokens:', error.message);
            throw new Error('Failed to get Canva tokens');
        }
    }

    // Refresh access token
    async refreshToken(refreshToken) {
        try {
            const response = await axios.post(`${this.oauthURL}/token`, {
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to refresh token:', error.message);
            throw new Error('Failed to refresh Canva token');
        }
    }

    // Alias for middleware compatibility
    async refreshAccessToken(refreshToken) {
        return this.refreshToken(refreshToken);
    }

    // Get user info
    async getUser(accessToken) {
        try {
            const response = await axios.get(`${this.baseURL}/users/me`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to get user:', error.message);
            if (error.response?.status === 401) {
                throw new Error('Token expired');
            }
            throw new Error('Failed to get user info');
        }
    }

    // Get templates (tries brand templates first, falls back to designs)
    async getTemplates(accessToken, limit = 20, search = '') {
        try {
            // First try brand templates (for Canva Enterprise users)
            const params = { limit };
            if (search) params.query = search;

            logger.info('Attempting to get Canva brand templates', {
                url: `${this.baseURL}/brand-templates`,
                params,
                hasToken: !!accessToken
            });

            const response = await axios.get(`${this.baseURL}/brand-templates`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                params
            });

            logger.info('Successfully got Canva brand templates', {
                count: response.data?.items?.length || 0
            });

            return response.data;

        } catch (brandTemplateError) {
            // If brand templates fail (likely not Enterprise user), try designs as fallback
            if (brandTemplateError.response?.status === 403 || brandTemplateError.response?.status === 404) {
                logger.info('Brand templates not accessible, trying user designs as fallback');

                try {
                    const designParams = { limit };
                    const designResponse = await axios.get(`${this.baseURL}/designs`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        params: designParams
                    });

                    logger.info('Successfully got user designs as template fallback', {
                        count: designResponse.data?.items?.length || 0
                    });

                    return designResponse.data;

                } catch (designError) {
                    logger.error('Both brand templates and designs failed:', {
                        brandTemplateError: brandTemplateError.response?.status,
                        designError: designError.response?.status
                    });
                    throw new Error('Unable to access templates or designs');
                }
            }

            // Log detailed error for other issues
            logger.error('Failed to get templates - Detailed error:', {
                message: brandTemplateError.message,
                status: brandTemplateError.response?.status,
                statusText: brandTemplateError.response?.statusText,
                data: brandTemplateError.response?.data,
                url: brandTemplateError.config?.url
            });

            if (brandTemplateError.response?.status === 401) {
                throw new Error('Token expired');
            }

            throw new Error(`Failed to get templates: ${brandTemplateError.response?.status || brandTemplateError.message}`);
        }
    }

    // Get user designs
    async getDesigns(accessToken, limit = 20) {
        try {
            const response = await axios.get(`${this.baseURL}/designs`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                params: { limit }
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to get designs:', error.message);
            if (error.response?.status === 401) {
                throw new Error('Token expired');
            }
            throw new Error('Failed to get designs');
        }
    }

    // Create design from template
    async createDesign(accessToken, templateId, title) {
        try {
            const response = await axios.post(`${this.baseURL}/designs`, {
                design_type: 'presentation',
                title: title,
                template_id: templateId
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to create design:', error.message);
            if (error.response?.status === 401) {
                throw new Error('Token expired');
            }
            throw new Error('Failed to create design');
        }
    }

    // Check if token is valid
    async isTokenValid(accessToken) {
        try {
            await this.getUser(accessToken);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Test API connection and token validity (for middleware)
    async testConnection(accessToken) {
        try {
            await this.getUser(accessToken);
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                needsReauth: error.message.includes('expired') || error.message.includes('Token expired')
            };
        }
    }

    // Alias for middleware compatibility
    async refreshAccessToken(refreshToken) {
        return this.refreshToken(refreshToken);
    }

    // ============================================================================
    // CANVA ACCESS APPROVAL FUNCTIONS
    // ============================================================================

    // Approve user for Canva access (since team management APIs don't exist)
    async approveUserForCanvaAccess(adminAccessToken, userEmail, role = 'member') {
        try {
            logger.info('Approving user for Canva access', {
                userEmail,
                role,
                hasToken: !!adminAccessToken
            });

            // Verify admin's Canva connection is valid
            const userInfo = await this.getUser(adminAccessToken);
            logger.info('Verified admin Canva connection', {
                adminId: userInfo.id,
                adminEmail: userInfo.email
            });

            // Since Canva doesn't provide team management APIs, we'll:
            // 1. Verify the admin has a valid Canva connection
            // 2. Mark the user as approved in our system
            // 3. The user will need to connect their own Canva account separately

            logger.info('Canva team management APIs not available - user will need to connect their own Canva account', {
                userEmail,
                adminEmail: userInfo.email
            });

            // Return success response indicating approval
            return {
                id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                email: userEmail,
                role: role,
                status: 'approved',
                approved_at: new Date().toISOString(),
                admin_id: userInfo.id,
                message: 'User approved for Canva access. User must connect their own Canva account.'
            };
        } catch (error) {
            logger.error('Failed to approve user for Canva access - Detailed error:', {
                userEmail,
                role,
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url
            });

            if (error.response?.status === 401) {
                throw new Error('Admin token expired or invalid');
            }
            if (error.response?.status === 403) {
                throw new Error('Insufficient permissions');
            }
            if (error.response?.status === 400) {
                throw new Error(`Invalid request: ${error.response.data?.message || 'Bad request'}`);
            }

            throw new Error(`Failed to approve user for Canva access: ${error.response?.status || error.message}`);
        }
    }

    // Check if user has Canva access (simplified since no team APIs)
    async isUserInTeam(adminAccessToken, userEmail) {
        try {
            logger.info('Checking if user has Canva access', { userEmail });

            // Since Canva doesn't provide team management APIs, we can't actually check
            // if a user is in a team. We'll return false to allow the approval process.
            logger.info('Canva team management APIs not available - cannot verify team membership', {
                userEmail
            });

            return false;
        } catch (error) {
            logger.error('Failed to check user Canva access:', {
                userEmail,
                message: error.message
            });
            return false;
        }
    }



}

module.exports = new CanvaService();