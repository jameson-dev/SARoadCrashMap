/**
 * Inline Handlers Module
 * Consolidates JavaScript that was previously inline in index.html
 * This module should be migrated to proper event listeners over time
 *
 * TODO: Refactor these functions to use proper event listeners instead of onclick attributes
 */

/**
 * Info Modal Management
 */
export function openInfoModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

export function closeInfoModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Setup info modal event listeners
 */
export function initInfoModals() {
    // Close on background click
    document.querySelectorAll('.info-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.id === modal.id) {
                closeInfoModal(e.target.id);
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.info-modal.active').forEach(modal => {
                closeInfoModal(modal.id);
            });
        }
    });
}

/**
 * Checkbox Dropdown Management
 */
export function toggleCheckboxDropdown(dropdownId) {
    const dropdown = document.getElementById(`${dropdownId}Dropdown`);
    if (!dropdown) return;

    dropdown.classList.toggle('open');

    // Close other dropdowns
    document.querySelectorAll('.checkbox-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
    });
}

export function updateCheckboxDropdownDisplay(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    const display = document.getElementById(`${dropdownId}Display`);

    if (!menu || !display) return;

    const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);

    if (checked.length === 0 || checked.length === checkboxes.length) {
        display.textContent = `All ${capitalize(dropdownId)}${dropdownId === 'crashType' ? 's' : dropdownId === 'severity' ? ' Levels' : 's'}`;
    } else if (checked.length === 1) {
        display.textContent = checked[0].nextElementSibling?.textContent || checked[0].value;
    } else {
        display.textContent = `${checked.length} selected`;
    }
}

export function selectAllDropdownItems(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;

    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateCheckboxDropdownDisplay(dropdownId);
}

export function clearAllDropdownItems(dropdownId) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;

    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateCheckboxDropdownDisplay(dropdownId);
}

export function filterDropdownItems(dropdownId, searchTerm) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;

    const items = menu.querySelectorAll('.checkbox-dropdown-item');
    const term = searchTerm.toLowerCase();

    items.forEach(item => {
        const label = item.querySelector('label')?.textContent || '';
        item.style.display = label.toLowerCase().includes(term) ? '' : 'none';
    });
}

/**
 * Utility Functions
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Close dropdowns when clicking outside
 */
export function initDropdownCloseHandlers() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.checkbox-dropdown')) {
            document.querySelectorAll('.checkbox-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        }
    });
}

/**
 * Initialize all inline handlers
 */
export function initInlineHandlers() {
    initInfoModals();
    initDropdownCloseHandlers();
    console.log('Inline handlers initialized');
}

// Make functions globally available (for now, until HTML is updated)
if (typeof window !== 'undefined') {
    window.openInfoModal = openInfoModal;
    window.closeInfoModal = closeInfoModal;
    window.toggleCheckboxDropdown = toggleCheckboxDropdown;
    window.updateCheckboxDropdownDisplay = updateCheckboxDropdownDisplay;
    window.selectAllDropdownItems = selectAllDropdownItems;
    window.clearAllDropdownItems = clearAllDropdownItems;
    window.filterDropdownItems = filterDropdownItems;
}

export default {
    openInfoModal,
    closeInfoModal,
    toggleCheckboxDropdown,
    updateCheckboxDropdownDisplay,
    selectAllDropdownItems,
    clearAllDropdownItems,
    filterDropdownItems,
    initInlineHandlers
};
