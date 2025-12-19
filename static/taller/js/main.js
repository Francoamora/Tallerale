/**
 * Ale Gavilan Cars Solutions — Main JavaScript
 * v2.1 PREMIUM (NO-JANK NAVBAR)
 *
 * Fixes:
 * ✅ Navbar sin layout shifts (no cambia altura al scrollear)
 * ✅ RAF scroll loop (suave y eficiente)
 * ✅ Spacer solo si navbar es FIXED
 * ✅ Progressive enhancement + robustez
 */

(function () {
  'use strict';

  // =========================
  //  UTILITIES
  // =========================

  function throttle(func, wait = 100) {
    let timeout = null;
    let previous = 0;

    return function executedFunction(...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          func.apply(this, args);
        }, remaining);
      }
    };
  }

  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function isInViewport(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  function safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (e) {
      console.warn(`Invalid selector: ${selector}`, e);
      return null;
    }
  }

  function safeQuerySelectorAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (e) {
      console.warn(`Invalid selector: ${selector}`, e);
      return [];
    }
  }

  // =========================
  //  NAVBAR ENHANCEMENTS (NO-JANK)
  // =========================

  function initNavbar() {
    const navbar = safeQuerySelector("#mainNav");
    if (!navbar) return;

    const cs = getComputedStyle(navbar);
    const isFixed = cs.position === 'fixed';
    const isSticky = cs.position === 'sticky';

    // ✅ Spacer SOLO si es fixed (si es sticky, ya ocupa espacio en el flujo)
    let spacer = null;

    function ensureSpacer() {
      if (!isFixed) return;

      if (!spacer) {
        spacer = document.createElement('div');
        spacer.className = 'navbar-spacer';
        spacer.style.width = '100%';
        spacer.style.display = 'block';
        navbar.parentNode.insertBefore(spacer, navbar.nextSibling);
      }

      // Ajustar alto real del navbar
      spacer.style.height = `${navbar.getBoundingClientRect().height}px`;
    }

    if (isFixed) {
      ensureSpacer();
      window.addEventListener('resize', throttle(ensureSpacer, 150), { passive: true });
    }

    // ✅ Scroll: class toggle sin tocar height/padding inline
    const scrollThreshold = 50;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const isScrolled = window.scrollY > scrollThreshold;
        navbar.classList.toggle('scrolled', isScrolled);

        // Si es fixed, re-medimos por si cambió por fonts/zoom (pero tu CSS ya no cambia altura)
        if (isFixed) ensureSpacer();

        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    highlightActiveNavLink();
  }

  function highlightActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = safeQuerySelectorAll('.nav-link');

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const isActive =
        href === currentPath ||
        (href !== '/' && currentPath.startsWith(href));

      link.classList.toggle('active', isActive);

      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  // =========================
  //  CLIENTE SELECT ENHANCEMENT
  // =========================

  function enhanceClienteSelect() {
    const select = safeQuerySelector('#id_cliente');
    if (!select) return;

    if (select.dataset.enhanced === '1') return;
    select.dataset.enhanced = '1';

    const parent = select.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.className = 'cliente-select-wrapper';

    const searchLabel = document.createElement('label');
    searchLabel.className = 'form-label small text-muted mb-1';
    searchLabel.innerHTML = '<i class="bi bi-search me-1"></i>Buscar cliente';
    searchLabel.setAttribute('for', 'cliente-search-input');

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'cliente-search-input';
    searchInput.placeholder = 'Nombre, apellido o DNI…';
    searchInput.className = 'form-control form-control-sm mb-2';
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('aria-label', 'Buscar cliente');

    wrapper.appendChild(searchLabel);
    wrapper.appendChild(searchInput);
    fragment.appendChild(wrapper);

    parent.insertBefore(fragment, select);
    wrapper.appendChild(select);

    const originalOptions = Array.from(select.options).map((opt) => ({
      value: opt.value,
      text: opt.text,
      searchText: opt.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    }));

    const applyFilter = debounce(() => {
      const term = searchInput.value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const currentValue = select.value;
      const frag = document.createDocumentFragment();
      let hasResults = false;

      originalOptions.forEach((o) => {
        if (!term || o.searchText.includes(term)) {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.text;
          frag.appendChild(opt);
          hasResults = true;
        }
      });

      if (!hasResults && term) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No se encontraron clientes';
        opt.disabled = true;
        frag.appendChild(opt);
      }

      select.innerHTML = '';
      select.appendChild(frag);

      if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
      }

      wrapper.classList.toggle('has-filter', term.length > 0);
    }, 250);

    searchInput.addEventListener('input', applyFilter);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        select.focus();
        if (select.options.length === 1 && select.options[0].value) {
          select.value = select.options[0].value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'btn btn-sm btn-link position-absolute';
    clearButton.style.cssText =
      'right: 8px; top: 32px; display: none; padding: 0; width: 24px; height: 24px;';
    clearButton.innerHTML = '<i class="bi bi-x-circle-fill text-muted"></i>';
    clearButton.setAttribute('aria-label', 'Limpiar búsqueda');

    wrapper.style.position = 'relative';
    wrapper.appendChild(clearButton);

    searchInput.addEventListener('input', () => {
      clearButton.style.display = searchInput.value ? 'block' : 'none';
    });

    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });
  }

  // =========================
  //  CLIENTE → VEHÍCULO LINK
  // =========================

  function setupClienteVehiculoLink(clienteSelector, vehiculoSelector) {
    const clienteField = safeQuerySelector(clienteSelector);
    const vehiculoField = safeQuerySelector(vehiculoSelector);

    if (!clienteField || !vehiculoField) return;

    let isLoading = false;

    function showLoading() {
      if (isLoading) return;
      isLoading = true;
      vehiculoField.disabled = true;
      vehiculoField.innerHTML = '<option value="">Cargando vehículos...</option>';
      vehiculoField.classList.add('loading');
    }

    function hideLoading() {
      isLoading = false;
      vehiculoField.disabled = false;
      vehiculoField.classList.remove('loading');
    }

    async function cargarVehiculos(clienteId, selectedId = null) {
      if (!clienteId) {
        vehiculoField.innerHTML = '<option value="">---------</option>';
        hideLoading();
        return;
      }

      showLoading();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `/api/vehiculos-por-cliente/?cliente_id=${encodeURIComponent(clienteId)}`,
          {
            signal: controller.signal,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const vehiculos = data.vehiculos || [];

        const frag = document.createDocumentFragment();

        if (vehiculos.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No hay vehículos para este cliente';
          opt.disabled = true;
          frag.appendChild(opt);
        } else {
          if (vehiculos.length > 1) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Seleccioná un vehículo';
            frag.appendChild(placeholder);
          }

          vehiculos.forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.label;
            frag.appendChild(opt);
          });
        }

        vehiculoField.innerHTML = '';
        vehiculoField.appendChild(frag);

        if (vehiculos.length === 1) {
          vehiculoField.value = String(vehiculos[0].id);
          vehiculoField.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (selectedId) {
          const optionExists = vehiculoField.querySelector(`option[value="${selectedId}"]`);
          if (optionExists) vehiculoField.value = String(selectedId);
        }

        hideLoading();
      } catch (error) {
        console.error('Error al cargar vehículos:', error);
        vehiculoField.innerHTML = '<option value="">Error al cargar vehículos</option>';

        if (typeof showToast === 'function') {
          showToast('Error al cargar vehículos. Por favor, recargá la página.', 'error');
        }

        hideLoading();
      }
    }

    const debouncedCargarVehiculos = debounce((clienteId) => {
      cargarVehiculos(clienteId, null);
    }, 300);

    clienteField.addEventListener('change', (e) => {
      const clienteId = e.target.value || '';
      debouncedCargarVehiculos(clienteId);
    });

    if (clienteField.value) {
      const currentVehiculoId = vehiculoField.value || null;
      cargarVehiculos(clienteField.value, currentVehiculoId);
    }
  }

  // =========================
  //  SMOOTH SCROLL TO TOP
  // =========================

  function initScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    scrollBtn.setAttribute('aria-label', 'Volver arriba');
    scrollBtn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #f59e0b);
      color: white;
      border: none;
      box-shadow: 0 8px 20px rgba(0,0,0,.3);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(20px);
      transition: all .3s ease;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      will-change: transform, opacity;
    `;

    document.body.appendChild(scrollBtn);

    const toggleScrollBtn = throttle(() => {
      const shouldShow = window.scrollY > 300;

      if (shouldShow) {
        scrollBtn.style.opacity = '1';
        scrollBtn.style.visibility = 'visible';
        scrollBtn.style.transform = 'translateY(0)';
      } else {
        scrollBtn.style.opacity = '0';
        scrollBtn.style.visibility = 'hidden';
        scrollBtn.style.transform = 'translateY(20px)';
      }
    }, 150);

    window.addEventListener('scroll', toggleScrollBtn, { passive: true });

    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    scrollBtn.addEventListener('mouseenter', () => {
      scrollBtn.style.transform = 'translateY(-3px) scale(1.05)';
      scrollBtn.style.boxShadow = '0 12px 28px rgba(0,0,0,.4)';
    });

    scrollBtn.addEventListener('mouseleave', () => {
      scrollBtn.style.transform = 'translateY(0) scale(1)';
      scrollBtn.style.boxShadow = '0 8px 20px rgba(0,0,0,.3)';
    });
  }

  // =========================
  //  FORM VALIDATION ENHANCEMENT
  // =========================

  function enhanceFormValidation() {
    const forms = safeQuerySelectorAll('form[data-needs-validation]');

    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        if (!form.checkValidity()) {
          e.preventDefault();
          e.stopPropagation();
        }
        form.classList.add('was-validated');
      }, false);
    });
  }

  // =========================
  //  LAZY LOAD IMAGES
  // =========================

  function initLazyLoad() {
    if ('loading' in HTMLImageElement.prototype) return;

    const images = safeQuerySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }

  // =========================
  //  INITIALIZATION
  // =========================

  function init() {
    try {
      initNavbar();
      enhanceClienteSelect();
      setupClienteVehiculoLink('#id_cliente', '#id_vehiculo');

      initScrollToTop();
      enhanceFormValidation();
      initLazyLoad();

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('✅ Ale Gavilan Cars - JavaScript inicializado correctamente (v2.1 NO-JANK)');
      }
    } catch (error) {
      console.error('Error al inicializar JavaScript:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TallerUtils = { throttle, debounce, isInViewport };

})();
