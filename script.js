document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamic Theme Toggling with Local Storage Persistence
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  const savedTheme = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // 2. Mobile Drawer Menu Navigation
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');

  menuToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', false);
    });
  });

  // 3. Project Grid Filtering Component
  const filterButtons = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', false);
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', true);

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filterValue === 'all' || category === filterValue) {
          card.classList.remove('is-hidden');
        } else {
          card.classList.add('is-hidden');
        }
      });
    });
  });

  // 4. Form Validation Engine & EmailJS Dispatch Stub
  const contactForm = document.getElementById('contact-form');
  const submitBtn = document.getElementById('submit-btn');
  const formStatus = document.getElementById('form-status');

  const validators = {
    user_name: (val) => val.trim().length >= 2 ? '' : 'Name must be at least 2 characters.',
    user_email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? '' : 'Please enter a valid email address.',
    subject: (val) => val.trim().length >= 4 ? '' : 'Subject must be at least 4 characters.',
    message: (val) => val.trim().length >= 10 ? '' : 'Message must be at least 10 characters.'
  };

  const validateField = (input) => {
    const errorSpan = document.getElementById(`${input.id.replace('user_', '')}-error`) || 
                      document.getElementById(`${input.id}-error`);
    const errorMsg = validators[input.name] ? validators[input.name](input.value) : '';

    if (errorMsg) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (errorSpan) errorSpan.textContent = errorMsg;
      return false;
    } else {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      if (errorSpan) errorSpan.textContent = '';
      return true;
    }
  };

  ['input', 'blur'].forEach(evt => {
    contactForm.addEventListener(evt, (e) => {
      if (e.target.matches('.form-control')) {
        validateField(e.target);
      }
    }, true);
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let isValid = true;
    const inputs = contactForm.querySelectorAll('.form-control');
    inputs.forEach(input => {
      if (!validateField(input)) isValid = false;
    });

    if (!isValid) return;

    // UI Loading State
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Transmitting...';
    formStatus.className = 'form-status';
    formStatus.textContent = '';

    try {
      // Integration endpoint / EmailJS trigger
      await new Promise((resolve) => setTimeout(resolve, 1200));

      formStatus.className = 'form-status success';
      formStatus.textContent = 'Inquiry successfully transmitted. Our executive team will connect shortly.';
      contactForm.reset();
      inputs.forEach(i => i.classList.remove('is-valid'));
    } catch (error) {
      formStatus.className = 'form-status error';
      formStatus.textContent = 'Failed to transmit message. Please verify network or connect directly via LinkedIn.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'Transmit Inquiry';
    }
  });
});