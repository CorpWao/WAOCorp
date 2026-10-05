(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Header: solid background after scroll
  --------------------------------------------------------------------- */
  var header = document.querySelector('.site-header');
  var lastScrollState = false;
  function onScroll() {
    var scrolled = window.scrollY > 12;
    if (scrolled !== lastScrollState) {
      header.classList.toggle('is-scrolled', scrolled);
      lastScrollState = scrolled;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------
     Mobile menu
  --------------------------------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      menu.classList.toggle('is-open', !isOpen);
      document.body.style.overflow = !isOpen ? 'hidden' : '';
    });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------------------------------------------------------------------
     Smooth-scroll offset for the fixed header
  --------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var headerHeight = header ? header.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12;
      window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  });

  /* ---------------------------------------------------------------------
     Reveal-on-scroll
  --------------------------------------------------------------------- */
  if ('IntersectionObserver' in window && !prefersReduced) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------------------------------------------------------------------
     Services accordion (keyboard + pointer accessible)
  --------------------------------------------------------------------- */
  document.querySelectorAll('.service-row').forEach(function (row) {
    row.addEventListener('click', function () {
      var wasOpen = row.classList.contains('is-open');
      document.querySelectorAll('.service-row.is-open').forEach(function (r) {
        r.classList.remove('is-open');
        r.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        row.classList.add('is-open');
        row.setAttribute('aria-expanded', 'true');
      }
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });
  });

  /* ---------------------------------------------------------------------
     Hero tags: subtle mouse-parallax (desktop, fine pointer only)
  --------------------------------------------------------------------- */
  var hero = document.querySelector('.hero');
  var tags = document.querySelectorAll('.hero-tag');
  var canParallax = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced;
  if (hero && tags.length && canParallax) {
    var rafId = null;
    var targetX = 0, targetY = 0;
    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!rafId) rafId = requestAnimationFrame(applyParallax);
    });
    function applyParallax() {
      tags.forEach(function (tag, i) {
        var depth = 10 + i * 4;
        tag.style.transform = 'translate(' + (targetX * depth).toFixed(1) + 'px, ' + (targetY * depth).toFixed(1) + 'px)';
      });
      rafId = null;
    }
  }

  /* ---------------------------------------------------------------------
     Custom cursor accent (desktop, fine pointer only)
  --------------------------------------------------------------------- */
  var canCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canCursor) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(dot);
    var cx = 0, cy = 0, dRaf = null;

    window.addEventListener('mousemove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      dot.classList.add('is-active');
      if (!dRaf) dRaf = requestAnimationFrame(moveDot);
    });
    function moveDot() {
      dot.style.left = cx + 'px';
      dot.style.top = cy + 'px';
      dRaf = null;
    }
    document.addEventListener('mouseleave', function () { dot.classList.remove('is-active'); });

    var hoverables = 'a, button, .service-row, .work-item';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(hoverables)) dot.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(hoverables)) dot.classList.remove('is-hover');
    });
  }

  /* ---------------------------------------------------------------------
     Quote request form — sent through Formspree (the endpoint is the
     form's `action` attribute). Without JavaScript the browser posts the
     form natively; with JavaScript we send it in the background and show
     the confirmation (or an error) in place.
  --------------------------------------------------------------------- */
  var devisForm = document.getElementById('devis-form');
  if (devisForm) {
    var devisError = document.getElementById('devis-error');
    var devisSubmit = devisForm.querySelector('button[type="submit"]');

    var isFr = (document.documentElement.lang || '').toLowerCase().indexOf('fr') === 0;
    var showDevisError = function () {
      devisError.textContent = isFr
        ? "Votre message n'a pas pu être envoyé. Écrivez-nous directement à corp.wao@gmail.com."
        : 'Your message could not be sent. Please email us directly at corp.wao@gmail.com.';
      devisError.hidden = false;
    };

    devisForm.addEventListener('submit', function (e) {
      e.preventDefault();
      devisError.hidden = true;
      if (!devisForm.checkValidity()) {
        devisForm.reportValidity();
        return;
      }

      var endpoint = devisForm.getAttribute('action') || '';
      if (endpoint.indexOf('YOUR_FORM_ID') !== -1) {
        showDevisError();
        return;
      }

      devisSubmit.disabled = true;
      devisSubmit.setAttribute('aria-busy', 'true');

      fetch(endpoint, {
        method: 'POST',
        body: new FormData(devisForm),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var name = (document.getElementById('f-name').value || '').trim().split(' ')[0];
        var nameEl = document.getElementById('devis-confirm-name');
        if (nameEl) nameEl.textContent = name ? ', ' + name : '';

        devisForm.classList.add('is-hidden');
        var confirmEl = document.getElementById('devis-confirm');
        if (confirmEl) confirmEl.classList.add('is-visible');
      }).catch(function () {
        showDevisError();
      }).then(function () {
        devisSubmit.disabled = false;
        devisSubmit.removeAttribute('aria-busy');
      });
    });
  }

  /* ---------------------------------------------------------------------
     Footer year
  --------------------------------------------------------------------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
