/**
 * TALLER ALE GAVILAN — CARS SOLUTIONS
 * Main JavaScript · v3.0
 */

"use strict";

/* ==========================================
   1. AUTO-DISMISS ALERTS
   ========================================== */
function initAlerts() {
  document.querySelectorAll(".alert.alert-dismissible").forEach((el) => {
    const dismiss = el.querySelector(".btn-close");
    if (!dismiss) return;

    // Auto-cerrar en 5 segundos los alerts de éxito/info
    if (el.classList.contains("alert-success") || el.classList.contains("alert-info")) {
      setTimeout(() => {
        el.classList.remove("show");
        el.classList.add("fade");
        setTimeout(() => el.remove(), 400);
      }, 5000);
    }
  });
}

/* ==========================================
   2. FORMSET DINÁMICO (Ítems de Trabajo / Presupuesto)
   ========================================== */
function initFormset(opts) {
  const {
    prefix,          // Django formset prefix (ej: "items")
    containerId,     // ID del contenedor de rows
    addBtnId,        // ID del botón "Agregar ítem"
    calcFn = null,   // Función de cálculo a llamar tras agregar
  } = opts;

  const container = document.getElementById(containerId);
  const addBtn = document.getElementById(addBtnId);
  const totalFormsInput = document.querySelector(`#id_${prefix}-TOTAL_FORMS`);

  if (!container || !addBtn || !totalFormsInput) return;

  addBtn.addEventListener("click", () => {
    const formCount = parseInt(totalFormsInput.value, 10);
    const template = container.querySelector(".formset-template");
    if (!template) return;

    const newRow = template.cloneNode(true);
    newRow.classList.remove("formset-template", "d-none");
    newRow.innerHTML = newRow.innerHTML.replaceAll(`${prefix}-__prefix__`, `${prefix}-${formCount}`);

    container.appendChild(newRow);
    totalFormsInput.value = formCount + 1;

    // Activar listeners en la nueva fila
    initRowListeners(newRow, calcFn);

    // Focus en primer input visible
    const firstInput = newRow.querySelector("input:not([type=hidden]):not([name*=DELETE])");
    if (firstInput) firstInput.focus();
  });

  // Listeners en filas existentes
  container.querySelectorAll(".formset-row:not(.formset-template)").forEach((row) => {
    initRowListeners(row, calcFn);
  });
}

function initRowListeners(row, calcFn) {
  // Botón eliminar fila
  const delBtn = row.querySelector(".formset-delete-btn");
  const deleteCheck = row.querySelector("input[name*=DELETE]");

  if (delBtn && deleteCheck) {
    delBtn.addEventListener("click", () => {
      deleteCheck.checked = true;
      row.classList.add("marked-delete");
      row.querySelectorAll("input, select").forEach((el) => {
        if (!el.name.includes("DELETE") && !el.name.includes("id")) {
          el.disabled = true;
        }
      });
      if (calcFn) calcFn();
    });
  }

  // Recalcular al cambiar cantidad / precio
  if (calcFn) {
    row.querySelectorAll("input[name*=cantidad], input[name*=precio_unitario]")
       .forEach((el) => el.addEventListener("input", calcFn));
  }
}

/* ==========================================
   3. CÁLCULO LIVE TOTALES (Trabajo / Presupuesto)
   ========================================== */
function parseARNumber(str) {
  if (!str) return 0;
  str = str.trim();
  // Formato AR: 1.234.567,89 → 1234567.89
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // Sin coma: si hay un punto único con 1-2 decimales → decimal
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      // dejarlo como está (decimal style en punto)
    } else {
      str = str.replace(/\./g, "");
    }
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function formatARS(amount) {
  return amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcularTotalesFormset({ containerId, tipoPrefix = null, manoObraId, repuestosId, descuentoId, totalId }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let totalManoObra = 0;
  let totalRepuestos = 0;

  container.querySelectorAll(".formset-row:not(.formset-template):not(.marked-delete)").forEach((row) => {
    const deleteCheck = row.querySelector("input[name*=DELETE]");
    if (deleteCheck && deleteCheck.checked) return;

    const cantInput = row.querySelector("input[name*=cantidad]");
    const precioInput = row.querySelector("input[name*=precio_unitario]");
    const tipoSelect = tipoPrefix ? row.querySelector("select[name*=tipo]") : null;

    const cant = cantInput ? parseARNumber(cantInput.value) : 1;
    const precio = precioInput ? parseARNumber(precioInput.value) : 0;
    const subtotal = cant * precio;

    // Actualizar campo subtotal visual si existe
    const subtotalDisplay = row.querySelector(".row-subtotal");
    if (subtotalDisplay) {
      subtotalDisplay.textContent = "$ " + formatARS(subtotal);
    }

    if (tipoSelect && tipoSelect.value === "MANO_OBRA") {
      totalManoObra += subtotal;
    } else if (tipoSelect) {
      totalRepuestos += subtotal;
    } else {
      totalManoObra += subtotal;  // presupuesto: todo a mano obra
    }
  });

  // Descuento
  const descuentoEl = descuentoId ? document.getElementById(descuentoId) : null;
  const descuento = descuentoEl ? parseARNumber(descuentoEl.value) : 0;

  const bruto = totalManoObra + totalRepuestos;
  const total = Math.max(0, bruto - descuento);

  // Mostrar en pantalla
  const moEl = manoObraId ? document.getElementById(manoObraId) : null;
  const rpEl = repuestosId ? document.getElementById(repuestosId) : null;
  const totEl = totalId ? document.getElementById(totalId) : null;

  if (moEl) moEl.textContent = "$ " + formatARS(totalManoObra);
  if (rpEl) rpEl.textContent = "$ " + formatARS(totalRepuestos);
  if (totEl) totEl.textContent = "$ " + formatARS(total);
}

/* ==========================================
   4. VEHICULOS POR CLIENTE (select dinámico)
   ========================================== */
function initVehiculoPorCliente({ clienteSelectId, vehiculoSelectId, url, preselectedId = null }) {
  const clienteSelect = document.getElementById(clienteSelectId);
  const vehiculoSelect = document.getElementById(vehiculoSelectId);

  if (!clienteSelect || !vehiculoSelect) return;

  async function loadVehiculos(clienteId) {
    vehiculoSelect.innerHTML = '<option value="">Cargando...</option>';
    vehiculoSelect.disabled = true;

    try {
      const resp = await fetch(`${url}?cliente_id=${clienteId}`);
      if (!resp.ok) throw new Error("Error al cargar vehículos");
      const data = await resp.json();
      const vehiculos = data.vehiculos || data;

      vehiculoSelect.innerHTML = '<option value="">— Seleccionar vehículo —</option>';

      vehiculos.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.patente} – ${v.marca} ${v.modelo}`;
        if (preselectedId && v.id == preselectedId) opt.selected = true;
        vehiculoSelect.appendChild(opt);
      });

      vehiculoSelect.disabled = vehiculos.length === 0;
    } catch (e) {
      vehiculoSelect.innerHTML = '<option value="">Error al cargar</option>';
      vehiculoSelect.disabled = true;
    }
  }

  clienteSelect.addEventListener("change", () => {
    const clienteId = clienteSelect.value;
    if (clienteId) {
      loadVehiculos(clienteId);
    } else {
      vehiculoSelect.innerHTML = '<option value="">— Primero seleccioná un cliente —</option>';
      vehiculoSelect.disabled = true;
    }
  });

  // Cargar si ya hay cliente seleccionado
  if (clienteSelect.value) {
    loadVehiculos(clienteSelect.value);
  }
}

/* ==========================================
   5. TOOLTIPS BOOTSTRAP
   ========================================== */
function initTooltips() {
  const els = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  els.forEach((el) => new bootstrap.Tooltip(el, { trigger: "hover" }));
}

/* ==========================================
   6. CONFIRM DELETE (link/button)
   ========================================== */
function initConfirmDelete() {
  document.querySelectorAll("[data-confirm]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const msg = el.dataset.confirm || "¿Confirmás esta acción?";
      if (!confirm(msg)) e.preventDefault();
    });
  });
}

/* ==========================================
   7. SEARCH FORM — SUBMIT ON CLEAR
   ========================================== */
function initSearchClear() {
  document.querySelectorAll(".search-clear-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.closest("form");
      if (!form) return;
      const input = form.querySelector("input[name='q']");
      if (input) {
        input.value = "";
        form.submit();
      }
    });
  });
}

/* ==========================================
   8. KEYBOARD SHORTCUTS
   ========================================== */
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Alt+N → nuevo trabajo
    if (e.altKey && e.key === "n") {
      e.preventDefault();
      const link = document.querySelector("a[href*='trabajo/nuevo'], a[href*='trabajo_create']");
      if (link) link.click();
    }

    // Escape → cerrar modales
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.show").forEach((m) => {
        const modal = bootstrap.Modal.getInstance(m);
        if (modal) modal.hide();
      });
    }
  });
}

/* ==========================================
   9. NUMBER FORMAT INPUTS (AR)
   ========================================== */
function initNumberFormatting() {
  // Highlight content on focus for numeric inputs
  document.querySelectorAll("input[inputmode='decimal'], input[inputmode='numeric']").forEach((el) => {
    el.addEventListener("focus", function () {
      this.select();
    });
  });
}

/* ==========================================
   10. INIT ALL
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  initAlerts();
  initTooltips();
  initConfirmDelete();
  initSearchClear();
  initKeyboardShortcuts();
  initNumberFormatting();
});
