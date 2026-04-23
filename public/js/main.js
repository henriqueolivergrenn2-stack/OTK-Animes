/* ============================================
   OTK ANIMES - JavaScript Principal
   Mobile-first interacoes
   ============================================ */

// ===== SEARCH TOGGLE =====
function toggleSearch() {
  const bar = document.getElementById('searchBar');
  const btn = document.getElementById('searchToggle');
  if (bar && btn) {
    bar.classList.toggle('open');
    btn.classList.toggle('active');
    if (bar.classList.contains('open')) {
      const input = bar.querySelector('input');
      if (input) setTimeout(() => input.focus(), 100);
    }
  }
}

// ===== HEADER SCROLL EFFECT =====
(function() {
  const header = document.getElementById('topHeader');
  if (!header) return;
  let lastScroll = 0;
  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50) {
      header.style.background = 'rgba(10, 10, 20, 0.98)';
    } else {
      header.style.background = 'rgba(10, 10, 20, 0.92)';
    }
    lastScroll = currentScroll;
  }, { passive: true });
})();

// ===== CAROUSEL DRAG SCROLL =====
(function() {
  document.querySelectorAll('.carousel').forEach(carousel => {
    let isDown = false;
    let startX;
    let scrollLeft;

    carousel.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('mouseleave', () => { isDown = false; });
    carousel.addEventListener('mouseup', () => { isDown = false; });

    carousel.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2;
      carousel.scrollLeft = scrollLeft - walk;
    });

    // Touch support
    let touchStartX = 0;
    let touchScrollLeft = 0;
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchScrollLeft = carousel.scrollLeft;
    }, { passive: true });

    carousel.addEventListener('touchmove', (e) => {
      const x = e.touches[0].clientX;
      const walk = (touchStartX - x) * 1.5;
      carousel.scrollLeft = touchScrollLeft + walk;
    }, { passive: true });
  });
})();

// ===== SECTION FADE IN ON SCROLL =====
(function() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 30px 0px' });

  document.querySelectorAll('.content-section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(16px)';
    section.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(section);
  });
})();

// ===== HIDE BOTTOM NAV ON SCROLL DOWN =====
(function() {
  const bottomNav = document.getElementById('bottomNav');
  if (!bottomNav) return;
  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          bottomNav.style.transform = 'translateY(100%)';
        } else {
          bottomNav.style.transform = 'translateY(0)';
        }
        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ===== LOGIN FORM LOADING =====
(function() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function() {
      const btn = document.getElementById('submitBtn');
      if (btn) {
        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
        btn.textContent = 'Entrando...';
      }
    });
  }
})();
