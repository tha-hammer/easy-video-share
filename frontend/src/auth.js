// Authentication module using AWS Amplify
import { Amplify } from 'aws-amplify';
import { signUp, signIn, signOut, getCurrentUser, fetchAuthSession, confirmSignUp, resendSignUpCode, fetchUserAttributes, confirmSignIn, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { COGNITO_CONFIG } from './config.js';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: COGNITO_CONFIG.userPoolId,
      userPoolClientId: COGNITO_CONFIG.userPoolClientId,
      region: COGNITO_CONFIG.region,
    }
  }
});

// Auth state management
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    this.idToken = null;
    this.isAdmin = false;
    this.listeners = [];
    this.pendingPasswordlessUsername = null;
  }

  // Subscribe to auth state changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Notify all listeners of auth state change
  notify() {
    this.listeners.forEach(callback => callback({
      isAuthenticated: this.isAuthenticated,
      user: this.currentUser,
      token: this.accessToken,
      idToken: this.idToken,
      isAdmin: this.isAdmin
    }));
  }

  // Check if user is in admin group
  async checkAdminStatus() {
    try {
      if (!this.idToken) {
        return false;
      }

      // Decode JWT token to check groups
      const tokenPayload = this.parseJwt(this.idToken);
      const groups = tokenPayload['cognito:groups'] || [];
      
      this.isAdmin = groups.includes('admin');
      console.log('Admin status:', this.isAdmin, 'Groups:', groups);
      
      return this.isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin = false;
      return false;
    }
  }

  // Helper function to decode JWT token
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return {};
    }
  }

  // Initialize auth state on page load
  async initialize() {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      
      this.currentUser = user;
      this.isAuthenticated = true;
      
      // Store both access token and ID token
      this.accessToken = session.tokens?.accessToken?.toString();
      this.idToken = session.tokens?.idToken?.toString();
      
      // Check admin status
      await this.checkAdminStatus();
      
      console.log('User authenticated:', user.username);
      console.log('Tokens available:', {
        hasIdToken: !!session.tokens?.idToken,
        hasAccessToken: !!session.tokens?.accessToken
      });
      console.log('Is Admin:', this.isAdmin);
      
      this.notify();
      return true;
    } catch (error) {
      console.log('No authenticated user');
      this.currentUser = null;
      this.isAuthenticated = false;
      this.accessToken = null;
      this.idToken = null;
      this.isAdmin = false;
      this.notify();
      return false;
    }
  }

  // Register new user
  async register(email, password, name = null) {
    try {
      const attributes = {
        email: email
      };
      
      if (name) {
        attributes.name = name;
      }

      // Generate a username from email (remove @ and . to avoid email format)
      const username = email.replace(/[@.]/g, '_').toLowerCase();

      const result = await signUp({
        username: username,
        password: password,
        options: {
          userAttributes: attributes
        }
      });

      console.log('Registration successful:', result);
      return {
        success: true,
        message: 'Registration successful! Please check your email for verification code.',
        userId: result.userId,
        nextStep: result.nextStep,
        username: username // Return the generated username
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Confirm registration with verification code
  async confirmRegistration(email, confirmationCode) {
    try {
      // Generate the same username from email
      const username = email.replace(/[@.]/g, '_').toLowerCase();
      
      await confirmSignUp({
        username: username,
        confirmationCode: confirmationCode
      });

      return {
        success: true,
        message: 'Email verified successfully! You can now sign in.'
      };
    } catch (error) {
      console.error('Confirmation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Resend verification code
  async resendConfirmationCode(email) {
    try {
      // Generate the same username from email
      const username = email.replace(/[@.]/g, '_').toLowerCase();
      
      await resendSignUpCode({
        username: username
      });

      return {
        success: true,
        message: 'Verification code sent to your email.'
      };
    } catch (error) {
      console.error('Resend code error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sign in user
  async login(email, password) {
    try {
      // Generate the same username from email
      const username = email.replace(/[@.]/g, '_').toLowerCase();
      
      const result = await signIn({
        username: username,
        password: password
      });

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        return {
          success: false,
          error: 'Please verify your email before signing in.',
          needsVerification: true
        };
      }

      // Get user info and session
      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      this.currentUser = user;
      this.isAuthenticated = true;
      this.accessToken = session.tokens?.accessToken?.toString();
      this.idToken = session.tokens?.idToken?.toString();

      // Check admin status
      await this.checkAdminStatus();

      console.log('Login successful:', user.username);
      console.log('Tokens available after login:', {
        hasIdToken: !!session.tokens?.idToken,
        hasAccessToken: !!session.tokens?.accessToken
      });
      console.log('Is Admin:', this.isAdmin);
      
      this.notify();

      return {
        success: true,
        message: 'Login successful!',
        user: user
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // NEW: Start passwordless login flow using native forgot password
  async startPasswordlessLogin(email) {
    try {
      // Generate the same username from email
      const username = email.replace(/[@.]/g, '_').toLowerCase();
      
      console.log('Starting passwordless login for:', username);
      
      // Use native Cognito forgot password flow for passwordless authentication
      // This sends a verification code to the user's email
      const result = await resetPassword({
        username: username
      });

      console.log('Passwordless login result:', result);

      if (result.nextStep?.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        // Store the username for the confirmation step
        this.pendingPasswordlessUsername = username;
        
        return {
          success: true,
          message: 'Verification code sent to your email. Use this code to sign in.',
          challengeType: 'EMAIL_CODE'
        };
      }

      return {
        success: false,
        error: 'Unexpected response from authentication service'
      };
    } catch (error) {
      console.error('Passwordless login error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('UserNotFoundException')) {
        errorMessage = 'No account found with this email. Please register first or use password login.';
      } else if (error.message.includes('NotAuthorizedException')) {
        errorMessage = 'Account not verified. Please check your email for verification code first.';
      } else if (error.message.includes('LimitExceededException')) {
        errorMessage = 'Too many requests. Please wait a moment before trying again.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // NEW: Confirm passwordless login with verification code
  async confirmPasswordlessLogin(confirmationCode, newPassword = null) {
    try {
      if (!this.pendingPasswordlessUsername) {
        throw new Error('No pending passwordless login session');
      }

      console.log('Confirming passwordless login with code');
      
      // Generate a random password for the reset (user won't need to remember this)
      const tempPassword = newPassword || this.generateSecurePassword();
      
      // First, confirm the password reset with the code
      const resetResult = await confirmResetPassword({
        username: this.pendingPasswordlessUsername,
        confirmationCode: confirmationCode,
        newPassword: tempPassword
      });

      console.log('Password reset confirmed:', resetResult);

      // Now sign in with the new temporary password
      const signInResult = await signIn({
        username: this.pendingPasswordlessUsername,
        password: tempPassword
      });

      console.log('Sign in result:', signInResult);

      if (signInResult.isSignedIn) {
        // Get user info and session
        const user = await getCurrentUser();
        const session = await fetchAuthSession();

        this.currentUser = user;
        this.isAuthenticated = true;
        this.accessToken = session.tokens?.accessToken?.toString();
        this.idToken = session.tokens?.idToken?.toString();

        // Check admin status
        await this.checkAdminStatus();
        
        // Clear the pending username
        this.pendingPasswordlessUsername = null;
        
        console.log('Passwordless login successful:', user.username);
        console.log('Tokens available after passwordless login:', {
          hasIdToken: !!session.tokens?.idToken,
          hasAccessToken: !!session.tokens?.accessToken
        });
        console.log('Is Admin:', this.isAdmin);
        
        this.notify();

        return {
          success: true,
          message: 'Passwordless login successful!',
          user: user
        };
      }

      return {
        success: false,
        error: 'Failed to complete passwordless login'
      };
    } catch (error) {
      console.error('Passwordless confirmation error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('CodeMismatchException')) {
        errorMessage = 'Invalid verification code. Please try again.';
      } else if (error.message.includes('ExpiredCodeException')) {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.message.includes('InvalidPasswordException')) {
        errorMessage = 'There was an issue with the password reset. Please try again.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Helper method to generate a secure random password
  generateSecurePassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure we have at least one of each required character type
    password += 'A'; // uppercase
    password += 'a'; // lowercase  
    password += '1'; // number
    password += '!'; // symbol
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Sign out user
  async logout() {
    try {
      await signOut();
      
          this.currentUser = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    this.idToken = null;
    this.isAdmin = false;
    
    console.log('Logout successful');
    this.notify();

      return {
        success: true,
        message: 'Logged out successfully!'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get current access token for API calls
  async getAccessToken() {
    if (!this.isAuthenticated) {
      console.log('User not authenticated, cannot get token');
      return null;
    }

    try {
      const session = await fetchAuthSession();
      
      // For API Gateway with Cognito authorizer, we need the ID token
      const idToken = session.tokens?.idToken?.toString();
      const accessToken = session.tokens?.accessToken?.toString();
      
      console.log('Token debugging:', {
        hasIdToken: !!idToken,
        hasAccessToken: !!accessToken,
        idTokenStart: idToken ? idToken.substring(0, 20) + '...' : 'None',
        accessTokenStart: accessToken ? accessToken.substring(0, 20) + '...' : 'None'
      });
      
      // Store both for debugging
      this.accessToken = accessToken;
      
      // Return ID token for API Gateway authentication
      const tokenToUse = idToken || accessToken;
      console.log('Using token type:', idToken ? 'ID Token' : 'Access Token');
      
      return tokenToUse;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  // Get user info
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  // Get user attributes
  async getUserAttributes() {
    try {
      if (!this.isAuthenticated) {
        return null;
      }
      
      const attributes = await fetchUserAttributes();
      return attributes;
    } catch (error) {
      console.error('Error fetching user attributes:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authManager = new AuthManager(); 