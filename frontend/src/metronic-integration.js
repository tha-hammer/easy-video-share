// Metronic Integration Manager - Official KTComponent approach

class MetronicManager {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  // Initialize Metronic components - official approach from Keenthemes guide
  async init() {
    if (this.initialized || this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInit();
    return this.initializationPromise;
  }

  async performInit() {
    try {
      console.log('Initializing Metronic components using official approach...');
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Use nextTick equivalent for vanilla JS
      await new Promise(resolve => setTimeout(resolve, 0));

      // Initialize KTComponent (official approach)
      if (typeof window.KTComponent !== 'undefined') {
        window.KTComponent.init();
        console.log('KTComponent initialized successfully');
      } else {
        console.warn('KTComponent not found - check if Metronic core is loaded');
      }

      // Initialize KTLayout (official approach)
      if (typeof window.KTLayout !== 'undefined') {
        window.KTLayout.init();
        console.log('KTLayout initialized successfully');
      } else {
        console.warn('KTLayout not found - check if Metronic layout is loaded');
      }

      this.initialized = true;
      console.log('Metronic integration completed successfully');
      
    } catch (error) {
      console.error('Metronic initialization error:', error);
      this.initialized = true; // Don't block the app
    }
  }

  // Reinitialize components after route/content changes (Vue router approach)
  async reinit() {
    try {
      // Official approach for component reinitialization
      if (typeof window.KTComponent !== 'undefined') {
        window.KTComponent.init();
        console.log('KTComponent reinitialized');
      }
      
      if (typeof window.KTLayout !== 'undefined') {
        window.KTLayout.init();
        console.log('KTLayout reinitialized');
      }
    } catch (error) {
      console.warn('Metronic reinit warning:', error);
    }
  }

  // Initialize components for a specific container
  async initContainer(container) {
    if (!container) return;

    try {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        // Reinitialize KTComponents for the new container
        if (typeof window.KTComponent !== 'undefined') {
          window.KTComponent.init();
        }
        
        // Initialize Bootstrap components if available
        this.initBootstrapComponents(container);
      }, 100);
      
    } catch (error) {
      console.warn('Container init warning:', error);
    }
  }

  // Initialize Bootstrap components manually (fallback)
  initBootstrapComponents(container = document) {
    try {
      // Initialize dropdowns
      const dropdowns = container.querySelectorAll('[data-bs-toggle="dropdown"]');
      dropdowns.forEach(element => {
        if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Dropdown) {
          new window.bootstrap.Dropdown(element);
        }
      });

      // Initialize modals
      const modals = container.querySelectorAll('.modal');
      modals.forEach(element => {
        if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
          // Don't auto-initialize modals, they're handled manually
        }
      });

      // Initialize tooltips
      const tooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]');
      tooltips.forEach(element => {
        if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Tooltip) {
          new window.bootstrap.Tooltip(element);
        }
      });

      // Initialize menu dropdowns specifically
      const menuTriggers = container.querySelectorAll('[data-kt-menu-trigger]');
      menuTriggers.forEach(element => {
        // KTComponent should handle these, but add fallback
        element.addEventListener('click', (e) => {
          const menu = element.querySelector('[data-kt-menu="true"]');
          if (menu) {
            menu.classList.toggle('show');
          }
        });
      });

    } catch (error) {
      console.warn('Bootstrap components init warning:', error);
    }
  }

  // Check if Metronic is properly loaded
  isAvailable() {
    return typeof window.KTComponent !== 'undefined' && typeof window.KTLayout !== 'undefined';
  }

  // Manual menu toggle (fallback for menu interactions)
  toggleMenu(triggerElement) {
    try {
      const menu = triggerElement.querySelector('[data-kt-menu="true"]');
      if (menu) {
        menu.classList.toggle('show');
      }
    } catch (error) {
      console.warn('Menu toggle error:', error);
    }
  }
}

// Export singleton instance
export const metronicManager = new MetronicManager(); 