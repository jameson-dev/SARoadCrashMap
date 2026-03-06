/**
 * Inline Handlers Module
 * Sets up event listeners for UI components using proper event delegation
 */

import { markFiltersChanged } from './filters.js';

/**
 * Info Modal Management
 */
function initInfoModals() {
    // Close on background click
    document.querySelectorAll('.info-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.id === modal.id && window.closeInfoModal) {
                window.closeInfoModal(e.target.id);
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.closeInfoModal) {
            document.querySelectorAll('.info-modal.active').forEach(modal => {
                window.closeInfoModal(modal.id);
            });
        }
    });
}

/**
 * Toggle checkbox dropdown menu
 */
function toggleCheckboxDropdown(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;

    const trigger = menu.previousElementSibling;
    const arrow = trigger.querySelector('.dropdown-arrow');

    // Close all other dropdowns and clear their searches
    document.querySelectorAll('.checkbox-dropdown-menu').forEach(m => {
        if (m !== menu && m.classList.contains('show')) {
            m.classList.remove('show');
            const otherTrigger = m.previousElementSibling;
            if (otherTrigger) otherTrigger.classList.remove('open');
            const otherArrow = m.previousElementSibling?.querySelector('.dropdown-arrow');
            if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
            // Clear search in the closed dropdown
            const otherSearch = m.querySelector('.dropdown-search');
            if (otherSearch && otherSearch.value) {
                otherSearch.value = '';
                m.querySelectorAll('.checkbox-dropdown-item').forEach(item => item.style.display = '');
            }
        }
    });

    // Toggle current dropdown
    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
        if (trigger) trigger.classList.remove('open');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        // Clear search when closing
        const search = menu.querySelector('.dropdown-search');
        if (search && search.value) {
            search.value = '';
            menu.querySelectorAll('.checkbox-dropdown-item').forEach(item => item.style.display = '');
        }
    } else {
        menu.classList.add('show');
        if (trigger) trigger.classList.add('open');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        // Focus search input when opening
        const search = menu.querySelector('.dropdown-search');
        if (search) setTimeout(() => search.focus(), 50);
    }
}

/**
 * Filter dropdown items based on search query
 */
function filterDropdownItems(dropdownId, query) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;
    const q = query.trim().toLowerCase();
    menu.querySelectorAll('.checkbox-dropdown-item').forEach(function(item) {
        const label = item.querySelector('label');
        const text = label ? label.textContent.toLowerCase() : '';
        item.style.display = (q === '' || text.includes(q)) ? '' : 'none';
    });
}

/**
 * Update checkbox dropdown display text
 */
function updateCheckboxDropdownDisplay(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    const display = document.getElementById(`${dropdownId}Display`);

    if (!menu || !display) return;

    const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
    const totalCheckboxes = menu.querySelectorAll('input[type="checkbox"]').length;

    if (checkboxes.length === 0 || checkboxes.length === totalCheckboxes) {
        if (dropdownId === 'crashType') {
            display.textContent = 'All Types';
        } else if (dropdownId === 'area') {
            display.textContent = 'All Areas';
        } else if (dropdownId === 'severity') {
            display.textContent = 'All Severities';
        } else if (dropdownId === 'suburb') {
            display.textContent = 'All Suburbs';
        }
    } else if (checkboxes.length === 1) {
        display.textContent = checkboxes[0].nextElementSibling.textContent;
    } else {
        display.textContent = `${checkboxes.length} selected`;
    }

    markFiltersChanged();
}

/**
 * Select all items in dropdown
 */
function selectAllDropdownItems(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    updateCheckboxDropdownDisplay(dropdownId);
}

/**
 * Clear all items in dropdown
 */
function clearAllDropdownItems(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    updateCheckboxDropdownDisplay(dropdownId);
}

/**
 * Initialize checkbox dropdown handlers
 */
function initCheckboxDropdowns() {
    // Handle dropdown trigger clicks
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.checkbox-dropdown-trigger');
        if (trigger) {
            const menu = trigger.nextElementSibling;
            if (menu && menu.classList.contains('checkbox-dropdown-menu')) {
                const dropdownId = menu.id.replace('Menu', '');
                toggleCheckboxDropdown(dropdownId);
            }
        }
    });

    // Handle search input
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('dropdown-search')) {
            const menu = e.target.closest('.checkbox-dropdown-menu');
            if (menu) {
                const dropdownId = menu.id.replace('Menu', '');
                filterDropdownItems(dropdownId, e.target.value);
            }
        }
    });

    // Handle checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.closest('.checkbox-dropdown-menu')) {
            const menu = e.target.closest('.checkbox-dropdown-menu');
            if (menu) {
                const dropdownId = menu.id.replace('Menu', '');
                updateCheckboxDropdownDisplay(dropdownId);
            }
        }
    });

    // Handle select all/clear all buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('checkbox-select-all')) {
            const menu = e.target.closest('.checkbox-dropdown-menu');
            if (menu) {
                const dropdownId = menu.id.replace('Menu', '');
                selectAllDropdownItems(dropdownId);
            }
        } else if (e.target.classList.contains('checkbox-clear-all')) {
            const menu = e.target.closest('.checkbox-dropdown-menu');
            if (menu) {
                const dropdownId = menu.id.replace('Menu', '');
                clearAllDropdownItems(dropdownId);
            }
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.checkbox-dropdown')) {
            document.querySelectorAll('.checkbox-dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                const trigger = menu.previousElementSibling;
                if (trigger) trigger.classList.remove('open');
                const arrow = trigger?.querySelector('.dropdown-arrow');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            });
        }
    });
}

/**
 * Initialize all inline handlers
 */
export function initInlineHandlers() {
    initInfoModals();
    initCheckboxDropdowns();
}

export default {
    initInlineHandlers
};
