// Authentication UI Components
import { authManager } from './auth.js';

export class AuthUI {
  constructor() {
    this.currentView = 'login'; // 'login', 'register', 'verify', 'passwordless-otp'
    this.pendingEmail = null;
    this.pendingUsername = null;
    this.passwordlessEmail = null;
  }

  // Generate login form HTML
  generateLoginForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>🎥 Sign In to Easy Video Share</h2>
          
          <!-- Passwordless Login Section -->
          <div class="auth-method-section">
            <h3>✨ Passwordless Login</h3>
            <p>Get a login code sent to your email - no password required!</p>
            <form id="passwordless-form" class="auth-form">
              <div class="form-group">
                <label for="passwordless-email">Email</label>
                <input 
                  type="email" 
                  id="passwordless-email" 
                  name="email" 
                  required 
                  placeholder="Enter your email"
                />
              </div>
              <button type="submit" class="auth-btn primary">Send Login Code</button>
            </form>
          </div>

          <div class="auth-divider">
            <span>or</span>
          </div>
          
          <!-- Traditional Login Section -->
          <div class="auth-method-section">
            <h3>🔐 Password Login</h3>
            <form id="login-form" class="auth-form">
              <div class="form-group">
                <label for="login-email">Email</label>
                <input 
                  type="email" 
                  id="login-email" 
                  name="email" 
                  required 
                  placeholder="Enter your email"
                />
              </div>
              
              <div class="form-group">
                <label for="login-password">Password</label>
                <input 
                  type="password" 
                  id="login-password" 
                  name="password" 
                  required 
                  placeholder="Enter your password"
                />
              </div>

              <button type="submit" class="auth-btn">Sign In with Password</button>
            </form>
          </div>
            
          <div class="auth-links">
            <p>Don't have an account? 
              <a href="#" id="show-register">Sign up here</a>
            </p>
          </div>
          
          <div id="auth-status" class="status-message"></div>
        </div>
      </div>
    `;
  }

  // Generate register form HTML
  generateRegisterForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>🎥 Join Easy Video Share</h2>
          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label for="register-email">Email</label>
              <input 
                type="email" 
                id="register-email" 
                name="email" 
                required 
                placeholder="Enter your email"
              />
            </div>
            
            <div class="form-group">
              <label for="register-password">Password</label>
              <input 
                type="password" 
                id="register-password" 
                name="password" 
                required 
                placeholder="Choose a strong password"
                minlength="8"
              />
              <small>Password must be at least 8 characters with uppercase, lowercase, number, and symbol</small>
            </div>

            <div class="form-group">
              <label for="register-name">Name (Optional)</label>
              <input 
                type="text" 
                id="register-name" 
                name="name" 
                placeholder="Your name"
              />
            </div>

            <button type="submit" class="auth-btn primary">Create Account</button>
            
            <div class="auth-links">
              <p>Already have an account? 
                <a href="#" id="show-login">Sign in here</a>
              </p>
            </div>
          </form>
          
          <div id="auth-status" class="status-message"></div>
        </div>
      </div>
    `;
  }

  // Generate verification form HTML
  generateVerificationForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>📧 Verify Your Email</h2>
          <p>We've sent a verification code to <strong>${this.pendingEmail}</strong></p>
          
          <form id="verify-form" class="auth-form">
            <div class="form-group">
              <label for="verification-code">Verification Code</label>
              <input 
                type="text" 
                id="verification-code" 
                name="code" 
                required 
                placeholder="Enter 6-digit code"
                maxlength="6"
              />
            </div>

            <button type="submit" class="auth-btn primary">Verify Email</button>
            
            <div class="auth-links">
              <p>Didn't receive the code? 
                <a href="#" id="resend-code">Resend verification code</a>
              </p>
              <p>
                <a href="#" id="back-to-login">Back to login</a>
              </p>
            </div>
          </form>
          
          <div id="auth-status" class="status-message"></div>
        </div>
      </div>
    `;
  }

  // Generate passwordless OTP form HTML
  generatePasswordlessOTPForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>✨ Enter Your Login Code</h2>
          <p>We've sent a login code to <strong>${this.passwordlessEmail}</strong></p>
          
          <form id="passwordless-otp-form" class="auth-form">
            <div class="form-group">
              <label for="login-code">Login Code</label>
              <input 
                type="text" 
                id="login-code" 
                name="code" 
                required 
                placeholder="Enter 6-digit code"
                maxlength="6"
                autocomplete="one-time-code"
              />
              <small>Check your email for the login code (expires in 5 minutes)</small>
            </div>

            <button type="submit" class="auth-btn primary">Complete Login</button>
            
            <div class="auth-links">
              <p>Didn't receive the code? 
                <a href="#" id="resend-login-code">Resend login code</a>
              </p>
              <p>
                <a href="#" id="back-to-login">Back to login</a>
              </p>
            </div>
          </form>
          
          <div id="auth-status" class="status-message"></div>
        </div>
      </div>
    `;
  }

  // Show authentication UI
  show(view = 'login') {
    this.currentView = view;
    const appContainer = document.querySelector('#app');
    
    let html = '';
    switch (view) {
      case 'register':
        html = this.generateRegisterForm();
        break;
      case 'verify':
        html = this.generateVerificationForm();
        break;
      case 'passwordless-otp':
        html = this.generatePasswordlessOTPForm();
        break;
      default:
        html = this.generateLoginForm();
    }
    
    appContainer.innerHTML = html;
    this.setupEventListeners();
  }

  // Setup event listeners for auth forms
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    // Passwordless form
    const passwordlessForm = document.getElementById('passwordless-form');
    if (passwordlessForm) {
      passwordlessForm.addEventListener('submit', this.handlePasswordlessLogin.bind(this));
    }

    // Passwordless OTP form
    const passwordlessOTPForm = document.getElementById('passwordless-otp-form');
    if (passwordlessOTPForm) {
      passwordlessOTPForm.addEventListener('submit', this.handlePasswordlessOTP.bind(this));
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
    }

    // Verification form
    const verifyForm = document.getElementById('verify-form');
    if (verifyForm) {
      verifyForm.addEventListener('submit', this.handleVerification.bind(this));
    }

    // Navigation links
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('register');
      });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('login');
      });
    }

    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
      backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('login');
      });
    }

    const resendCode = document.getElementById('resend-code');
    if (resendCode) {
      resendCode.addEventListener('click', this.handleResendCode.bind(this));
    }

    const resendLoginCode = document.getElementById('resend-login-code');
    if (resendLoginCode) {
      resendLoginCode.addEventListener('click', this.handleResendLoginCode.bind(this));
    }
  }

  // Handle login form submission
  async handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    const password = formData.get('password');
    
    if (!email || !password) {
      this.showStatus('error', 'Please fill in all fields');
      return;
    }

    this.showStatus('info', 'Signing in...');
    
    const result = await authManager.login(email, password);
    
    if (result.success) {
      this.showStatus('success', result.message);
      // The main app will handle the redirect via auth state change
    } else if (result.needsVerification) {
      this.pendingEmail = email;
      this.show('verify');
      this.showStatus('error', result.error);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle register form submission
  async handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    const password = formData.get('password');
    const name = formData.get('name').trim();
    
    if (!email || !password) {
      this.showStatus('error', 'Please fill in all required fields');
      return;
    }

    this.showStatus('info', 'Creating account...');
    
    const result = await authManager.register(email, password, name || null);
    
    if (result.success) {
      this.pendingEmail = email;
      this.pendingUsername = result.username; // Store the generated username
      this.show('verify');
      this.showStatus('success', result.message);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle verification form submission
  async handleVerification(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const code = formData.get('code').trim();
    
    if (!code) {
      this.showStatus('error', 'Please enter the verification code');
      return;
    }

    this.showStatus('info', 'Verifying...');
    
    const result = await authManager.confirmRegistration(this.pendingEmail, code);
    
    if (result.success) {
      this.showStatus('success', result.message);
      setTimeout(() => {
        this.show('login');
      }, 2000);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle resend verification code
  async handleResendCode(event) {
    event.preventDefault();
    
    this.showStatus('info', 'Sending verification code...');
    
    const result = await authManager.resendConfirmationCode(this.pendingEmail);
    
    if (result.success) {
      this.showStatus('success', result.message);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle passwordless login form submission
  async handlePasswordlessLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    
    if (!email) {
      this.showStatus('error', 'Please enter your email');
      return;
    }

    this.showStatus('info', 'Sending login code...');
    
    const result = await authManager.startPasswordlessLogin(email);
    
    if (result.success) {
      this.passwordlessEmail = email;
      this.show('passwordless-otp');
      this.showStatus('success', result.message);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle passwordless OTP form submission
  async handlePasswordlessOTP(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const code = formData.get('code').trim();
    
    if (!code) {
      this.showStatus('error', 'Please enter the login code');
      return;
    }

    this.showStatus('info', 'Verifying login code...');
    
    const result = await authManager.completePasswordlessLogin(code);
    
    if (result.success) {
      this.showStatus('success', result.message);
      // The main app will handle the redirect via auth state change
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle resend login code
  async handleResendLoginCode(event) {
    event.preventDefault();
    
    if (!this.passwordlessEmail) {
      this.showStatus('error', 'Email not found. Please go back to login.');
      return;
    }

    this.showStatus('info', 'Resending login code...');
    
    const result = await authManager.startPasswordlessLogin(this.passwordlessEmail);
    
    if (result.success) {
      this.showStatus('success', 'Login code sent! Check your email.');
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Show status message
  showStatus(type, message) {
    const statusDiv = document.getElementById('auth-status');
    if (statusDiv) {
      statusDiv.className = `status-message ${type}`;
      statusDiv.textContent = message;
      
      // Auto-clear success messages
      if (type === 'success') {
        setTimeout(() => {
          statusDiv.textContent = '';
          statusDiv.className = 'status-message';
        }, 5000);
      }
    }
  }
}

// Export singleton instance
export const authUI = new AuthUI(); 