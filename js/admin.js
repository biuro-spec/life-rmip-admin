/**
 * Life RMiP - Panel Dyspozytorski
 * ================================
 */

// ============================================================
// NAWIGACJA
// ============================================================

const viewTitles = {
    'dashboard': 'Panel główny',
    'new-order': 'Nowe zlecenie',
    'orders': 'Wszystkie zlecenia',
    'calculator': 'Kalkulator cen',
    'reports': 'Rozliczenia',
    'workers': 'Pracownicy',
    'patients': 'Baza pacjentów',
    'map': 'Mapa karetek'
};

function showView(viewId) {
    // Ukryj wszystkie widoki
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));

    // Pokaż wybrany
    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');

    const nav = document.querySelector('[data-view="' + viewId + '"]');
    if (nav) nav.classList.add('active');

    // Jeśli to nowe-zlecenie, podświetl parent toggle
    if (viewId === 'new-order') {
        document.getElementById('nav-new-order-toggle').classList.add('active');
    } else {
        // Wyczyść submenu highlight
        document.querySelectorAll('.nav-sub-item').forEach(s => s.classList.remove('active'));
        document.getElementById('nav-new-order-toggle').classList.remove('active');
    }

    // Tytuł strony
    document.getElementById('page-title').textContent = viewTitles[viewId] || viewId;

    // Zatrzymaj auto-odświeżanie mapy przy zmianie widoku
    if (viewId !== 'map' && mapRefreshInterval) {
        clearInterval(mapRefreshInterval);
        mapRefreshInterval = null;
    }

    // Załaduj dane widoku
    switch (viewId) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrdersList(); break;
        case 'workers': loadWorkersView(); break;
        case 'patients': loadPatientsView(); break;
        case 'map': loadMapView(); break;
        case 'new-order': initOrderForm(); break;
    }

    // Zamknij sidebar na mobile
    document.getElementById('sidebar').classList.remove('open');
    var bd = document.getElementById('sidebar-backdrop');
    if (bd) bd.classList.remove('visible');
    document.body.style.overflow = '';

    // Sync mobile bottom tabs
    document.querySelectorAll('.mobile-tab').forEach(function(tab) {
        tab.classList.remove('active');
        if (tab.getAttribute('data-view') === viewId) tab.classList.add('active');
    });
}

// ============================================================
// INICJALIZACJA
// ============================================================

// ============================================================
// WORKERS CACHE
// ============================================================
var workersCache = [];

async function loadWorkersList() {
    var list = await getWorkersListAPI();
    if (list && list.length) {
        workersCache = list;
        storage.set('workersCache', list);
    } else {
        // Fallback from localStorage
        workersCache = storage.get('workersCache') || [];
    }
    populateWorkerSelects();
    return workersCache;
}

function populateWorkerSelects() {
    var selectIds = ['f-worker1', 'f-worker2', 'edit-worker1', 'edit-worker2'];
    selectIds.forEach(function(id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        // Keep first option (placeholder)
        var firstOpt = sel.options[0];
        sel.innerHTML = '';
        sel.appendChild(firstOpt);

        // Zalogowani na górze, niezalogowani na dole
        var logged = workersCache.filter(function(w) { return w.status && w.status !== ''; });
        var offline = workersCache.filter(function(w) { return !w.status || w.status === ''; });

        logged.forEach(function(w) {
            var opt = document.createElement('option');
            opt.value = w.name;
            opt.textContent = w.name + ' (' + w.status + ')';
            sel.appendChild(opt);
        });

        if (offline.length && logged.length) {
            var separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '── Niezalogowani ──';
            sel.appendChild(separator);
        }

        offline.forEach(function(w) {
            var opt = document.createElement('option');
            opt.value = w.name;
            opt.textContent = w.name + ' (nie w pracy)';
            opt.style.color = '#9ca3af';
            sel.appendChild(opt);
        });
    });
}

// ============================================================
// ADMIN LOGIN
// ============================================================

function showAdminLogin() {
    var overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.style.display = 'flex';
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.querySelector('.main-content');
    var bottomNav = document.getElementById('mobile-bottom-nav');
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';

    initPinBoxes('admin-pin-boxes', function() {
        // Enable login button when all 4 digits entered
        var boxes = document.querySelectorAll('#admin-pin-boxes .pin-box');
        var allFilled = Array.from(boxes).every(function(b) { return b.value.length === 1; });
        var btn = document.getElementById('admin-login-btn');
        var sel = document.getElementById('admin-login-select');
        btn.disabled = !(allFilled && sel.value);
    });

    document.getElementById('admin-login-select').addEventListener('change', function() {
        var boxes = document.querySelectorAll('#admin-pin-boxes .pin-box');
        var allFilled = Array.from(boxes).every(function(b) { return b.value.length === 1; });
        document.getElementById('admin-login-btn').disabled = !(allFilled && this.value);
    });

    document.getElementById('admin-login-btn').addEventListener('click', handleAdminLogin);
}

async function handleAdminLogin() {
    var login = document.getElementById('admin-login-select').value;
    var boxes = document.querySelectorAll('#admin-pin-boxes .pin-box');
    var pin = Array.from(boxes).map(function(b) { return b.value; }).join('');

    if (!login || pin.length !== 4) return;

    var btn = document.getElementById('admin-login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Logowanie...';

    var result = await loginAdminAPI(login, pin);

    if (result.success) {
        session.setAdminSession({
            login: login,
            name: result.data.name || login.charAt(0).toUpperCase() + login.slice(1),
            loginTime: Date.now()
        });
        document.getElementById('admin-login-overlay').style.display = 'none';
        var sidebar = document.getElementById('sidebar');
        var mainContent = document.querySelector('.main-content');
        var bottomNav = document.getElementById('mobile-bottom-nav');
        if (sidebar) sidebar.style.removeProperty('display');
        if (mainContent) mainContent.style.removeProperty('display');
        if (bottomNav) bottomNav.style.removeProperty('display');
        initAdminPanel();
    } else {
        var errEl = document.getElementById('admin-login-error');
        document.getElementById('admin-login-error-text').textContent = result.message || 'Nieprawidłowy PIN';
        errEl.style.display = 'flex';
        boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
        boxes[0].focus();
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">login</span> Zaloguj się';
    }
}

function hideAdminLogin() {
    var overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.style.display = 'none';
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.querySelector('.main-content');
    var bottomNav = document.getElementById('mobile-bottom-nav');
    if (sidebar) sidebar.style.removeProperty('display');
    if (mainContent) mainContent.style.removeProperty('display');
    if (bottomNav) bottomNav.style.removeProperty('display');
}

// PIN boxes initialization (reusable for admin login + set-pin modal)
function initPinBoxes(containerId, onChange) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var boxes = container.querySelectorAll('.pin-box');

    boxes.forEach(function(box, i) {
        box.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length === 1) {
                this.classList.add('filled');
                if (i < boxes.length - 1) boxes[i + 1].focus();
            }
            if (onChange) onChange();
        });
        box.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
                if (onChange) onChange();
            }
        });
        box.addEventListener('focus', function() { this.select(); });
    });
}

function getPinValue(containerId) {
    var boxes = document.querySelectorAll('#' + containerId + ' .pin-box');
    return Array.from(boxes).map(function(b) { return b.value; }).join('');
}

function clearPinBoxes(containerId) {
    var boxes = document.querySelectorAll('#' + containerId + ' .pin-box');
    boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
}

document.addEventListener('DOMContentLoaded', () => {
    // Check admin login first
    if (!session.isAdminLoggedIn()) {
        showAdminLogin();
        return;
    }
    hideAdminLogin();
    initAdminPanel();
});

function initAdminPanel() {
    // --- Sidebar mobile toggle + backdrop ---
    var sidebarEl = document.getElementById('sidebar');
    var backdropEl = document.getElementById('sidebar-backdrop');

    function openSidebar() {
        sidebarEl.classList.add('open');
        if (backdropEl) backdropEl.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebarEl.classList.remove('open');
        if (backdropEl) backdropEl.classList.remove('visible');
        document.body.style.overflow = '';
    }

    document.getElementById('menu-toggle').addEventListener('click', () => {
        if (sidebarEl.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    if (backdropEl) {
        backdropEl.addEventListener('click', closeSidebar);
    }

    // Nawigacja - główne elementy (z data-view)
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showView(item.dataset.view);
        });
    });

    // Submenu "Nowe zlecenie" - rozwijanie
    var toggleBtn = document.getElementById('nav-new-order-toggle');
    var subMenu = document.getElementById('nav-new-order-sub');

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleBtn.classList.toggle('open');
        subMenu.classList.toggle('open');
    });

    // Kliknięcie na kontrahenta w submenu
    document.querySelectorAll('.nav-sub-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            var contractor = item.dataset.contractor;
            openNewOrderForContractor(contractor);

            // Podświetl wybrany element
            document.querySelectorAll('.nav-sub-item').forEach(s => s.classList.remove('active'));
            item.classList.add('active');

            // Zamknij sidebar na mobile
            closeSidebar();
        });
    });

    // Zegar
    function updateClock() {
        const now = new Date();
        document.getElementById('current-time').textContent =
            now.toLocaleDateString('pl-PL') + ' ' +
            now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 30000);

    // Formularz zlecenia - listener
    document.getElementById('order-form').addEventListener('submit', handleOrderSubmit);

    // Kontrahent -> pokaż stawki
    document.getElementById('f-contractor').addEventListener('change', updateRatePreview);

    // Typ pacjenta -> pokaż/ukryj pracownik 2
    document.getElementById('f-patient-type').addEventListener('change', () => {
        const isLying = document.getElementById('f-patient-type').value === 'Leżący';
        document.getElementById('f-worker2').parentElement.style.opacity = isLying ? '1' : '0.4';
    });

    // Admin logout
    document.getElementById('admin-logout').addEventListener('click', () => {
        if (confirm('Wylogować się z panelu?')) {
            session.clearAdminSession();
            window.location.reload();
        }
    });

    // Sidebar "Nowe Zlecenie" button
    var sidebarNewOrder = document.getElementById('sidebar-new-order');
    if (sidebarNewOrder) {
        sidebarNewOrder.addEventListener('click', () => {
            showView('new-order');
            closeSidebar();
        });
    }

    // Mobile bottom tab navigation
    document.querySelectorAll('.mobile-tab').forEach(function(tab) {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            var view = this.getAttribute('data-view');
            if (view === 'more') {
                // Open sidebar for "more" menu
                document.getElementById('sidebar').classList.add('open');
                var bd = document.getElementById('sidebar-backdrop');
                if (bd) bd.classList.add('visible');
                document.body.style.overflow = 'hidden';
            } else {
                showView(view);
            }
        });
    });

    // Topbar user info sync
    var adminSession = session.getAdminSession();
    var dispName = adminSession ? adminSession.name : 'Dyspozytor';
    var userNameEl = document.getElementById('topbar-user-name');
    var userAvatarEl = document.getElementById('topbar-user-avatar');
    if (userNameEl) userNameEl.textContent = dispName;
    if (userAvatarEl) userAvatarEl.textContent = dispName.charAt(0).toUpperCase();

    // Dispatcher name in sidebar
    var dispNameEl = document.getElementById('dispatcher-name');
    if (dispNameEl) dispNameEl.textContent = dispName;

    // Filtr daty - domyślnie dzisiaj
    document.getElementById('filter-date').value = formatDateISO(new Date());

    // Google Places Autocomplete na polach adresowych
    initAddressAutocomplete();

    // Autocomplete pacjentów
    initPatientAutocomplete();

    // Kontrahent change -> auto-baza
    document.getElementById('f-contractor').addEventListener('change', function() {
        var c = this.value;
        if (c && c !== 'NFZ') {
            document.getElementById('f-base').value = 'Rudzka 14, Racibórz';
            document.getElementById('f-return-base').checked = true;
        }
    });

    // Load workers list (populates selects + cache)
    loadWorkersList();

    // "Dodaj pracownika" button
    var addWorkerBtn = document.getElementById('add-worker-btn');
    if (addWorkerBtn) {
        addWorkerBtn.addEventListener('click', function() {
            openModal('add-worker-modal');
        });
    }

    // Save new worker
    var saveNewBtn = document.getElementById('save-new-worker-btn');
    if (saveNewBtn) {
        saveNewBtn.addEventListener('click', saveNewWorker);
    }

    // Set PIN modal init
    initPinBoxes('set-pin-boxes');
    var savePinBtn = document.getElementById('save-pin-btn');
    if (savePinBtn) {
        savePinBtn.addEventListener('click', savePinForWorker);
    }

    // Close menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.worker-menu-dropdown') && !e.target.closest('.worker-detail-more')) {
            document.querySelectorAll('.worker-menu-dropdown').forEach(function(m) { m.remove(); });
        }
    });

    // Załaduj dashboard
    loadDashboard();
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    const today = formatDateISO(new Date());

    // Pobierz zlecenia na dziś
    if (API_MODE === 'api') {
        const result = await apiGet({ action: 'getOrders', date: today });
        if (result) {
            renderDashboard(result);
            return;
        }
    }

    // Mock data fallback
    renderDashboard(mockOrders.filter(o => o.date === today));
}

function renderDashboard(orders) {
    // Statystyki
    document.getElementById('stat-today-total').textContent = orders.length;
    document.getElementById('stat-in-progress').textContent =
        orders.filter(o => {
            var s = o.Status_Zlecenia || o.status || '';
            return s === 'W trasie do pacjenta' || s === 'Z pacjentem' || s === 'in_transit' || s === 'with_patient';
        }).length;
    document.getElementById('stat-completed').textContent =
        orders.filter(o => {
            var s = o.Status_Zlecenia || o.status || '';
            return s === 'Zakończone' || s === 'Do rozliczenia' || s === 'Rozliczone' || s === 'completed';
        }).length;
    document.getElementById('stat-scheduled').textContent =
        orders.filter(o => {
            var s = o.Status_Zlecenia || o.status || '';
            return s === 'Zaplanowane' || s === 'scheduled' || s === 'available';
        }).length;

    // Tabela zleceń
    const tbody = document.getElementById('dashboard-orders-body');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:40px;">Brak zleceń na dzisiaj</td></tr>';
        return;
    }

    orders.forEach(o => {
        const status = o.Status_Zlecenia || mapStatusForDisplay(o.status);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + (o.Godzina_Zaplanowana || o.time || '-') + '</td>' +
            '<td><strong>' + (o.Imie_Nazwisko || o.patientName || '-') + '</strong></td>' +
            '<td>' + shortenAddr(o.Adres_Start || o.from || '') + ' → ' + shortenAddr(o.Adres_Koniec || o.to || '') + '</td>' +
            '<td>' + (o.Kontrahent || o.contractor || '-') + '</td>' +
            '<td>' + (o.Pracownik_1 || o.assignedWorker || '-') + '</td>' +
            '<td>' + (o.Karetka_Nr || o.vehicle || '-') + '</td>' +
            '<td>' + statusBadge(status) + '</td>';
        tbody.appendChild(tr);
    });

    // Pracownicy
    renderWorkersStatus();

    // Kalendarz miesięczny
    loadCalendar();
}

async function renderWorkersStatus() {
    const container = document.getElementById('workers-status-scroll');
    const workers = workersCache.length ? workersCache.map(function(w) { return w.name; }) : ['Krzysztof', 'Aleks', 'Waldemar', 'Dawid', 'Piotrek'];

    function renderScrollItem(name, statusClass) {
        var offlineClass = statusClass === 'offline' ? ' offline' : '';
        return '<div class="worker-scroll-item' + offlineClass + '">' +
            '<div class="worker-scroll-avatar">' +
                '<div class="worker-scroll-avatar-inner' + (statusClass === 'offline' ? ' offline' : '') + '">' + name.charAt(0) + '</div>' +
                '<div class="worker-scroll-dot ' + statusClass + '"></div>' +
            '</div>' +
            '<span class="worker-scroll-name">' + name + '</span>' +
        '</div>';
    }

    container.innerHTML = workers.map(name => renderScrollItem(name, 'offline')).join('');

    if (API_MODE === 'api') {
        const result = await apiGet({ action: 'getWorkers' });
        if (result) {
            container.innerHTML = result.map(w => {
                var statusClass = 'offline';
                if (w.status === 'Wolny') statusClass = 'available';
                else if (w.status === 'W trasie') statusClass = 'in-transit';
                else if (w.status === 'Z pacjentem') statusClass = 'with-patient';
                return renderScrollItem(w.name, statusClass);
            }).join('');
        }
    }
}

// ============================================================
// MINI KALENDARZ MIESIĘCZNY
// ============================================================

var calendarMonth = new Date().getMonth();
var calendarYear = new Date().getFullYear();
var calendarOrderCounts = {}; // { 'YYYY-MM-DD': count }

function calendarChangeMonth(delta) {
    if (delta === 0) {
        // Reset do bieżącego miesiąca
        calendarMonth = new Date().getMonth();
        calendarYear = new Date().getFullYear();
    } else {
        calendarMonth += delta;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    }
    loadCalendar();
}

async function loadCalendar() {
    var monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    document.getElementById('cal-month-title').textContent = monthNames[calendarMonth] + ' ' + calendarYear;

    // Pobierz zlecenia na cały miesiąc
    calendarOrderCounts = {};
    if (API_MODE === 'api') {
        var mm = String(calendarMonth + 1).padStart(2, '0');
        var result = await apiGet({ action: 'getOrders', month: mm, year: String(calendarYear) });
        if (result && Array.isArray(result)) {
            result.forEach(function(o) {
                var d = o.Data_Transportu || o.date || '';
                if (d) {
                    calendarOrderCounts[d] = (calendarOrderCounts[d] || 0) + 1;
                }
            });
        }
    }

    renderCalendar();
}

function renderCalendar() {
    var container = document.getElementById('mini-calendar');
    var html = '';

    // Nagłówki dni tygodnia
    var dayNames = ['Pn','Wt','Śr','Cz','Pt','Sb','Nd'];
    dayNames.forEach(function(d) {
        html += '<div class="cal-header">' + d + '</div>';
    });

    var firstDay = new Date(calendarYear, calendarMonth, 1);
    var lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    var startDow = (firstDay.getDay() + 6) % 7; // Poniedziałek = 0

    var today = formatDateISO(new Date());

    // Dni z poprzedniego miesiąca
    var prevMonthLast = new Date(calendarYear, calendarMonth, 0).getDate();
    for (var i = startDow - 1; i >= 0; i--) {
        var dayNum = prevMonthLast - i;
        html += '<div class="cal-day other-month"><span class="cal-day-num">' + dayNum + '</span></div>';
    }

    // Dni bieżącego miesiąca
    for (var d = 1; d <= lastDay.getDate(); d++) {
        var dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var count = calendarOrderCounts[dateStr] || 0;
        var isToday = dateStr === today;
        var dow = (new Date(calendarYear, calendarMonth, d).getDay());
        var isWeekend = (dow === 0 || dow === 6);

        var classes = 'cal-day';
        if (isToday) classes += ' today';
        if (isWeekend) classes += ' weekend';

        html += '<div class="' + classes + '" onclick="calendarDayClick(\'' + dateStr + '\')">';
        html += '<span class="cal-day-num">' + d + '</span>';
        if (count > 0) {
            html += '<span class="cal-day-count">' + count + '</span>';
        } else {
            html += '<span class="cal-day-count none">0</span>';
        }
        html += '</div>';
    }

    // Uzupełnienie do końca siatki
    var totalCells = startDow + lastDay.getDate();
    var remaining = (7 - totalCells % 7) % 7;
    for (var r = 1; r <= remaining; r++) {
        html += '<div class="cal-day other-month"><span class="cal-day-num">' + r + '</span></div>';
    }

    container.innerHTML = html;
}

function calendarDayClick(dateStr) {
    // Przejdź do widoku zleceń przefiltrowanych na tę datę
    var dateInput = document.getElementById('filter-date');
    if (dateInput) dateInput.value = dateStr;
    showView('orders');
}

// ============================================================
// NOWE ZLECENIE
// ============================================================

function initOrderForm() {
    // Ustaw domyślną datę na dziś
    if (!document.getElementById('f-date').value) {
        document.getElementById('f-date').value = formatDateISO(new Date());
    }
    updateRatePreview();
}

/**
 * Otwiera formularz nowego zlecenia z wybranym kontrahentem
 */
function openNewOrderForContractor(contractor) {
    // Resetuj formularz
    resetOrderForm();

    // Pokaż widok
    showView('new-order');

    // Ustaw kontrahenta
    setSelectValue('f-contractor', contractor);
    updateRatePreview();

    // Auto-baza dla non-NFZ
    if (contractor !== 'NFZ') {
        document.getElementById('f-base').value = 'Rudzka 14, Racibórz';
        document.getElementById('f-return-base').checked = true;
    } else {
        document.getElementById('f-base').value = '';
        document.getElementById('f-return-base').checked = false;
    }

    // Ustaw tytuł
    document.getElementById('page-title').textContent = 'Nowe zlecenie — ' + contractor;

    // Podświetl toggle
    document.getElementById('nav-new-order-toggle').classList.add('active', 'open');
    document.getElementById('nav-new-order-sub').classList.add('open');
}

// ============================================================
// TRASA W FORMULARZU ZLECENIA (wieloprzystankowa)
// ============================================================

var orderStopCounter = 1;

function addOrderStop() {
    orderStopCounter++;
    var container = document.getElementById('f-stops');
    var div = document.createElement('div');
    div.className = 'route-point';
    div.setAttribute('data-stop', orderStopCounter);
    div.innerHTML =
        '<div class="route-marker stop">' + orderStopCounter + '</div>' +
        '<div class="form-group" style="flex:1;">' +
            '<label class="form-label">Przystanek ' + orderStopCounter + '</label>' +
            '<input type="text" class="f-stop-input" placeholder="Wpisz adres...">' +
        '</div>' +
        '<button type="button" class="btn-remove-stop" onclick="removeOrderStop(this)" title="Usuń">' +
            '<span class="material-icons-round">close</span>' +
        '</button>';
    container.appendChild(div);
    attachAutocomplete(div.querySelector('.f-stop-input'));
}

function removeOrderStop(btn) {
    var point = btn.closest('.route-point');
    point.remove();
    renumberOrderStops();
}

function renumberOrderStops() {
    var stops = document.querySelectorAll('#f-stops .route-point');
    stops.forEach(function(stop, i) {
        var num = i + 1;
        stop.querySelector('.route-marker').textContent = num;
        stop.querySelector('.form-label').textContent = 'Przystanek ' + num;
    });
    orderStopCounter = stops.length;
}

/**
 * Oblicz trasę z Google Maps dla formularza zlecenia
 */
function calcOrderRoute() {
    var base = document.getElementById('f-base').value.trim();
    var returnToBase = document.getElementById('f-return-base').checked;
    var btn = document.getElementById('btn-order-route');
    var info = document.getElementById('order-route-info');
    var legsDiv = document.getElementById('order-route-legs');
    var summary = document.getElementById('order-route-summary');

    if (!base) {
        showToast('Wpisz adres bazy', 'error');
        return;
    }

    // Zbierz przystanki
    var stopInputs = document.querySelectorAll('.f-stop-input');
    var stops = [];
    stopInputs.forEach(function(input) {
        if (input.value.trim()) stops.push(input.value.trim());
    });

    if (stops.length === 0) {
        showToast('Dodaj co najmniej 1 przystanek', 'error');
        return;
    }

    if (typeof google === 'undefined' || !google.maps) {
        showToast('Google Maps niedostępne', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Obliczanie trasy...';
    info.style.display = 'none';
    legsDiv.style.display = 'none';

    var origin = base;
    var destination = returnToBase ? base : stops[stops.length - 1];
    var waypoints = [];

    if (returnToBase) {
        stops.forEach(function(s) {
            waypoints.push({ location: s, stopover: true });
        });
    } else {
        for (var i = 0; i < stops.length - 1; i++) {
            waypoints.push({ location: stops[i], stopover: true });
        }
    }

    var directionsService = new google.maps.DirectionsService();
    directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: 'DRIVING',
        region: 'pl'
    }, function(response, status) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">route</span> Oblicz trasę z Google Maps';

        if (status !== 'OK') {
            showToast('Błąd Google Maps: ' + status, 'error');
            return;
        }

        var route = response.routes[0];
        var totalMeters = 0;
        var totalSeconds = 0;
        var legsHtml = '';

        route.legs.forEach(function(leg, i) {
            totalMeters += leg.distance.value;
            totalSeconds += leg.duration.value;
            legsHtml +=
                '<div class="route-leg">' +
                    '<span class="route-leg-num">' + String.fromCharCode(65 + i) + '</span>' +
                    '<span class="route-leg-text">' +
                        shortenAddr(leg.start_address) + ' → ' + shortenAddr(leg.end_address) +
                    '</span>' +
                    '<span class="route-leg-data">' + leg.distance.text + ' | ' + leg.duration.text + '</span>' +
                '</div>';
        });

        var totalKm = Math.round(totalMeters / 1000);
        var totalMin = Math.round(totalSeconds / 60);
        var totalH = Math.round((totalMin / 60) * 100) / 100;

        // Wpisz km i czas
        document.getElementById('f-km').value = totalKm;
        document.getElementById('f-hours').value = totalH;

        // Oblicz koszty na podstawie stawek kontrahenta
        var contractor = document.getElementById('f-contractor').value;
        var rate = STAWKI_LOCAL[contractor];
        var costTime = 0, costKm = 0, costTotal = 0;

        if (rate) {
            costTime = Math.round(totalH * rate.godz * 100) / 100;
            costKm = Math.round(totalKm * rate.km * 100) / 100;
            costTotal = costTime + costKm;
        }

        document.getElementById('f-cost-time').value = costTime ? costTime + ' zł' : '-';
        document.getElementById('f-cost-km').value = costKm ? costKm + ' zł' : '-';
        document.getElementById('f-cost-total').textContent = costTotal ? costTotal + ' zł' : '0 zł';

        // Pokaż info
        info.innerHTML =
            '<div style="padding:10px 14px; background:#e8f5e9; border-radius:8px; color:#2e7d32;">' +
                '<span class="material-icons-round" style="vertical-align:middle;font-size:18px;">check_circle</span> ' +
                'Trasa: <strong>' + totalKm + ' km</strong> | ' +
                '<strong>' + Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'min</strong> ' +
                '(' + route.legs.length + ' odcinków)' +
            '</div>';
        info.style.display = 'block';
        legsDiv.innerHTML = legsHtml;
        legsDiv.style.display = 'block';
        summary.style.display = 'block';

        showToast(totalKm + ' km, ' + Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'min', 'success');
    });
}

function updateRatePreview() {
    const contractor = document.getElementById('f-contractor').value;
    const preview = document.getElementById('rate-preview');

    if (!contractor || contractor === 'NFZ') {
        preview.style.display = 'none';
        return;
    }

    // Znajdź stawkę
    var rate = STAWKI_LOCAL[contractor];
    if (!rate) {
        preview.style.display = 'none';
        return;
    }

    document.getElementById('rate-hourly').textContent = rate.godz;
    document.getElementById('rate-km').textContent = rate.km;
    preview.style.display = 'block';
}

// Lokalna kopia stawek do podglądu
const STAWKI_LOCAL = {
    'Szpital Racibórz': { godz: 120, km: 4 },
    'ScanMed': { godz: 110, km: 4 },
    'Kietrz': { godz: 70, km: 4 },
    'POZ Krzyżanowice': { godz: 60, km: 4 },
    'Prywatne': { godz: 80, km: 4 }
};

async function handleOrderSubmit(e) {
    e.preventDefault();

    // Zbierz przystanki jako trasę
    var base = document.getElementById('f-base').value.trim();
    var stopInputs = document.querySelectorAll('.f-stop-input');
    var stops = [];
    stopInputs.forEach(function(input) {
        if (input.value.trim()) stops.push(input.value.trim());
    });
    var returnToBase = document.getElementById('f-return-base').checked;

    // Adres start = baza, Adres koniec = przystanki (jako opis trasy)
    var adresStart = base || 'Rudzka 14, Racibórz';
    var adresKoniec = stops.join(' → ');
    if (returnToBase && stops.length > 0) {
        adresKoniec += ' → ' + adresStart;
    }

    const data = {
        kontrahent: document.getElementById('f-contractor').value,
        typ_transportu: document.getElementById('f-transport-type').value,
        pilnosc: document.getElementById('f-urgency').value,
        data_transportu: document.getElementById('f-date').value,
        godzina_zaplanowana: document.getElementById('f-time').value,
        imie_nazwisko: document.getElementById('f-patient-name').value,
        pesel: document.getElementById('f-pesel').value,
        telefon: document.getElementById('f-phone').value,
        typ_pacjenta: document.getElementById('f-patient-type').value,
        rodzina_pomoc: document.getElementById('f-family-help').value,
        adres_zamieszkania: document.getElementById('f-address').value,
        adres_start: adresStart,
        adres_koniec: adresKoniec,
        karetka_nr: document.getElementById('f-vehicle').value,
        pracownik_1: document.getElementById('f-worker1').value,
        pracownik_2: document.getElementById('f-worker2').value,
        uwagi_medyczne: document.getElementById('f-medical-notes').value,
        uwagi: document.getElementById('f-notes').value
    };

    if (API_MODE === 'api') {
        const result = await apiPost({ action: 'createOrder', data: data });
        if (result) {
            showToast('Zlecenie utworzone: ' + result.id, 'success');
            resetOrderForm();
            return;
        } else {
            showToast('Błąd tworzenia zlecenia', 'error');
            return;
        }
    }

    // Mock mode
    showToast('Zlecenie utworzone (tryb testowy)', 'success');
    resetOrderForm();
}

function resetOrderForm() {
    document.getElementById('order-form').reset();
    document.getElementById('rate-preview').style.display = 'none';
    document.getElementById('order-route-info').style.display = 'none';
    document.getElementById('order-route-legs').style.display = 'none';
    document.getElementById('order-route-summary').style.display = 'none';
    document.getElementById('f-date').value = formatDateISO(new Date());
    document.getElementById('f-base').value = 'Rudzka 14, Racibórz';
    document.getElementById('f-return-base').checked = true;

    // Reset przystanków - zostaw tylko 1
    var stopsContainer = document.getElementById('f-stops');
    stopsContainer.innerHTML =
        '<div class="route-point" data-stop="1">' +
            '<div class="route-marker stop">1</div>' +
            '<div class="form-group" style="flex:1;">' +
                '<label class="form-label">Przystanek 1 (np. adres pacjenta) *</label>' +
                '<input type="text" class="f-stop-input" placeholder="Wpisz adres..." required>' +
            '</div>' +
            '<button type="button" class="btn-remove-stop" onclick="removeOrderStop(this)" title="Usuń">' +
                '<span class="material-icons-round">close</span>' +
            '</button>' +
        '</div>';
    orderStopCounter = 1;

    // Autocomplete na nowym polu
    attachAutocomplete(stopsContainer.querySelector('.f-stop-input'));
}

// ============================================================
// LISTA ZLECEŃ
// ============================================================

async function loadOrdersList() {
    const date = document.getElementById('filter-date').value;
    const contractor = document.getElementById('filter-contractor').value;
    const status = document.getElementById('filter-status').value;

    const tbody = document.getElementById('orders-list-body');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:#999;">Ładowanie...</td></tr>';

    var orders = [];

    if (API_MODE === 'api') {
        const params = { action: 'getOrders' };
        if (date) params.date = date;
        if (contractor) params.contractor = contractor;
        if (status) params.status = status;

        const result = await apiGet(params);
        if (result) orders = result;
    } else {
        // Mock
        orders = mockOrders;
        if (date) orders = orders.filter(o => o.date === date);
    }

    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#999; padding:40px;">Brak zleceń</td></tr>';
        return;
    }

    orders.forEach(o => {
        const s = o.Status_Zlecenia || mapStatusForDisplay(o.status);
        const kwota = o.Lacznie || '';
        const orderId = o.ID_Zlecenia || o.id;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function() { openEditModal(orderId); };
        tr.innerHTML =
            '<td style="font-size:11px;">' + (orderId || '-') + '</td>' +
            '<td>' + formatDateShort(o.Data_Transportu || o.date) + '</td>' +
            '<td>' + (o.Godzina_Zaplanowana || o.time || '-') + '</td>' +
            '<td><strong>' + (o.Imie_Nazwisko || o.patientName || '-') + '</strong></td>' +
            '<td style="max-width:150px; overflow:hidden; text-overflow:ellipsis;">' + (o.Adres_Start || o.from || '-') + '</td>' +
            '<td style="max-width:150px; overflow:hidden; text-overflow:ellipsis;">' + (o.Adres_Koniec || o.to || '-') + '</td>' +
            '<td>' + (o.Kontrahent || o.contractor || '-') + '</td>' +
            '<td>' + (o.Pracownik_1 || o.assignedWorker || '-') + '</td>' +
            '<td>' + statusBadge(s) + '</td>' +
            '<td>' + (kwota ? kwota + ' zł' : '-') + '</td>';
        tbody.appendChild(tr);
    });
}

// ============================================================
// KALKULATOR CEN
// ============================================================

function calculatePrice() {
    const km = parseFloat(document.getElementById('calc-km').value) || 0;
    const hours = parseFloat(document.getElementById('calc-hours').value) || 0;
    const rateH = parseFloat(document.getElementById('calc-rate-h').value) || 80;
    const rateKm = parseFloat(document.getElementById('calc-rate-km').value) || 4;
    const discount = parseFloat(document.getElementById('calc-discount').value) || 0;

    const timeCost = Math.round(hours * rateH * 100) / 100;
    const kmCost = Math.round(km * rateKm * 100) / 100;
    const basePrice = timeCost + kmCost;
    const finalPrice = Math.max(0, basePrice - discount);

    document.getElementById('calc-time-cost').textContent = timeCost.toFixed(2) + ' zł';
    document.getElementById('calc-km-cost').textContent = kmCost.toFixed(2) + ' zł';
    document.getElementById('calc-base-price').textContent = basePrice.toFixed(2) + ' zł';
    document.getElementById('calc-discount-val').textContent = '-' + discount.toFixed(2) + ' zł';
    document.getElementById('calc-final-price').textContent = finalPrice.toFixed(2) + ' zł';

    document.getElementById('calc-result').style.display = 'block';
}

// ============================================================
// ROZLICZENIA / RAPORTY
// ============================================================

async function loadReport() {
    const contractor = document.getElementById('report-contractor').value;
    const month = document.getElementById('report-month').value;
    const year = document.getElementById('report-year').value;

    if (API_MODE === 'api') {
        const result = await apiGet({
            action: 'getMonthlyReport',
            contractor: contractor,
            month: month,
            year: year
        });

        if (result) {
            renderReport(result);
            return;
        }
    }

    // Mock
    renderReport({
        totalOrders: 0,
        totalHours: 0,
        totalKm: 0,
        totalRevenue: 0,
        orders: []
    });
}

function renderReport(data) {
    document.getElementById('report-results').style.display = 'block';
    document.getElementById('report-orders').textContent = data.totalOrders || 0;
    document.getElementById('report-hours').textContent = (data.totalHours || 0).toFixed(2);
    document.getElementById('report-km').textContent = data.totalKm || 0;
    document.getElementById('report-total').textContent = (data.totalRevenue || 0).toFixed(2) + ' zł';

    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';

    var orders = data.orders || [];
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:30px;">Brak danych</td></tr>';
        return;
    }

    orders.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="font-weight:500;">' + formatDateShort(o.Data_Transportu) + '</td>' +
            '<td>' + (o.Imie_Nazwisko || '-') + '</td>' +
            '<td style="font-size:12px;">' +
                '<span style="font-weight:500;">' + (o.Adres_Start || '-') + '</span>' +
                ' <span class="material-icons-round" style="font-size:12px;vertical-align:middle;color:var(--text-secondary);">arrow_forward</span> ' +
                '<span style="font-weight:500;">' + (o.Adres_Koniec || '-') + '</span>' +
            '</td>' +
            '<td style="color:var(--text-secondary);">' + (o.Laczny_Czas_Dziesietny || '-') + '</td>' +
            '<td style="text-align:center;font-weight:600;">' + (o.Kilometry || '-') + '</td>' +
            '<td style="text-align:right;">' + (o.Obliczenie_Czas ? o.Obliczenie_Czas + ' zł' : '-') + '</td>' +
            '<td style="text-align:right;">' + (o.Obliczenie_Km ? o.Obliczenie_Km + ' zł' : '-') + '</td>' +
            '<td style="text-align:right;font-weight:700;">' + (o.Lacznie ? o.Lacznie + ' zł' : '-') + '</td>';
        tbody.appendChild(tr);
    });
}

async function generateBillingSheet() {
    if (API_MODE !== 'api') {
        showToast('Generowanie arkuszy wymaga połączenia z API', 'error');
        return;
    }

    const contractor = document.getElementById('report-contractor').value;
    const month = document.getElementById('report-month').value;
    const year = document.getElementById('report-year').value;

    showToast('Generowanie arkusza...', 'success');

    const result = await apiPost({
        action: 'generateBillingSheet',
        contractor: contractor,
        month: parseInt(month),
        year: parseInt(year)
    });

    if (result) {
        showToast('Arkusz wygenerowany: ' + result.sheetName + ' (' + result.totalRevenue + ' zł)', 'success');
    } else {
        showToast('Błąd generowania arkusza', 'error');
    }
}

// ============================================================
// PRACOWNICY
// ============================================================

async function loadWorkersView() {
    var grid = document.getElementById('workers-detail-grid');
    var now = new Date();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();

    // Ensure workers loaded
    if (!workersCache.length) await loadWorkersList();
    var workers = workersCache;

    function getInitials(name) {
        var parts = name.split(' ');
        if (parts.length > 1) return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function statusClass(status) {
        if (!status) return 'offline';
        var s = status.toLowerCase();
        if (s === 'available' || s === 'dostępny' || s === 'wolny') return 'available';
        if (s === 'in-transit' || s === 'w trasie') return 'in-transit';
        if (s === 'on-break' || s === 'przerwa') return 'on-break';
        return 'offline';
    }

    function statusLabel(status) {
        var cls = statusClass(status);
        var labels = { 'available': 'Dostępny', 'in-transit': 'Zajęty', 'on-break': 'W przerwie', 'offline': 'Nie w pracy' };
        return labels[cls] || 'Nie w pracy';
    }

    if (!workers.length) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Brak pracowników. Kliknij "Dodaj pracownika" aby dodać pierwszego.</div>';
        return;
    }

    grid.innerHTML = workers.map(function(w) {
        var name = w.name;
        var login = w.login || name.toLowerCase();
        var role = w.role || 'Pracownik';
        var initials = getInitials(name);
        var wStatus = statusClass(w.status || '');
        var isOffline = wStatus === 'offline';
        var cardClass = 'worker-detail-card' + (isOffline ? ' worker-offline' : '');
        return '<div class="' + cardClass + '" data-worker="' + name + '" data-login="' + login + '">' +
            (isOffline ? '<div class="worker-offline-banner"><span class="material-icons-round">power_off</span> Nie w pracy</div>' : '') +
            '<div class="worker-detail-header">' +
                '<div class="worker-detail-avatar">' +
                    initials +
                    '<span class="status-dot ' + wStatus + '"></span>' +
                '</div>' +
                '<button class="worker-detail-more" data-login="' + login + '" data-name="' + name + '"><span class="material-icons-round">more_vert</span></button>' +
            '</div>' +
            '<div class="worker-detail-info">' +
                '<div class="worker-detail-name">' + name + '</div>' +
                '<div class="worker-detail-role">' + role + '</div>' +
            '</div>' +
            '<div class="worker-detail-stats">' +
                '<div class="worker-stat"><span class="worker-stat-label">Zlecenia</span><span class="worker-stat-value">-</span></div>' +
                '<div class="worker-stat"><span class="worker-stat-label">Godziny</span><span class="worker-stat-value">-</span></div>' +
                '<div class="worker-stat"><span class="worker-stat-label">Kilometry</span><span class="worker-stat-value">-</span></div>' +
            '</div>' +
            '<div class="worker-detail-footer">' +
                '<span class="worker-status-label ' + wStatus + '">' + statusLabel(w.status || '') + '</span>' +
                '<button class="worker-detail-link" data-login="' + login + '" data-name="' + name + '" data-role="' + role + '">Szczegóły <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></button>' +
            '</div>' +
        '</div>';
    }).join('');

    // Three-dots menu handlers
    grid.querySelectorAll('.worker-detail-more').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var login = this.getAttribute('data-login');
            var name = this.getAttribute('data-name');
            toggleWorkerMenu(this, login, name);
        });
    });

    // "Szczegóły" link handlers
    grid.querySelectorAll('.worker-detail-link').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var login = this.getAttribute('data-login');
            var name = this.getAttribute('data-name');
            var role = this.getAttribute('data-role');
            openWorkerDetails(login, name, role);
        });
    });

    // Pobierz dane z API
    if (API_MODE === 'api') {
        for (var i = 0; i < workers.length; i++) {
            var result = await apiGet({
                action: 'getWorkerReport',
                worker: workers[i].name,
                month: month,
                year: year
            });

            if (result) {
                var cards = grid.querySelectorAll('.worker-detail-card');
                var card = cards[i];
                if (card) {
                    var stats = card.querySelectorAll('.worker-stat-value');
                    stats[0].textContent = result.totalOrders || 0;
                    stats[1].textContent = (result.totalWorkHours || 0) + 'h';
                    stats[2].textContent = result.totalKm ? (result.totalKm >= 1000 ? (result.totalKm / 1000).toFixed(1) + 'k' : result.totalKm) : '-';
                }
            }
        }
    }

    // Worker search filter
    var searchInput = document.getElementById('workers-search-input');
    if (searchInput) {
        searchInput.oninput = function() {
            var q = this.value.toLowerCase();
            grid.querySelectorAll('.worker-detail-card').forEach(function(card) {
                var name = card.getAttribute('data-worker').toLowerCase();
                card.style.display = name.includes(q) ? '' : 'none';
            });
        };
    }
}

// ============================================================
// WORKER MANAGEMENT (CRUD)
// ============================================================

// Open/Close generic modal
function openModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

// Add new worker
async function saveNewWorker() {
    var name = document.getElementById('new-worker-name').value.trim();
    var login = document.getElementById('new-worker-login').value.trim().toLowerCase();
    var role = document.getElementById('new-worker-role').value;

    if (!name || !login) {
        showToast('Wypełnij imię i login', 'error');
        return;
    }

    // Check duplicate
    if (workersCache.some(function(w) { return w.login === login; })) {
        showToast('Pracownik o tym loginie już istnieje', 'error');
        return;
    }

    var result = await addWorkerAPI(name, login, role);
    if (result.success) {
        showToast('Dodano pracownika: ' + name, 'success');
        closeModal('add-worker-modal');
        // Clear form
        document.getElementById('new-worker-name').value = '';
        document.getElementById('new-worker-login').value = '';
        // Refresh
        await loadWorkersList();
        loadWorkersView();
    } else {
        showToast(result.message || 'Błąd dodawania', 'error');
    }
}

// Remove worker
async function removeWorker(login, name) {
    if (!confirm('Czy na pewno chcesz usunąć pracownika ' + name + '?')) return;

    var result = await removeWorkerAPI(login);
    if (result.success) {
        showToast('Usunięto pracownika: ' + name, 'success');
        await loadWorkersList();
        loadWorkersView();
    } else {
        showToast(result.message || 'Błąd usuwania', 'error');
    }
}

// Three-dots menu
function toggleWorkerMenu(btn, login, name) {
    // Close any existing menus
    document.querySelectorAll('.worker-menu-dropdown').forEach(function(m) { m.remove(); });

    var menu = document.createElement('div');
    menu.className = 'worker-menu-dropdown';
    menu.innerHTML =
        '<button class="worker-menu-item" data-action="edit">' +
            '<span class="material-icons-round">edit</span>' +
            'Edytuj dane' +
        '</button>' +
        '<button class="worker-menu-item" data-action="set-pin">' +
            '<span class="material-icons-round">lock</span>' +
            'Ustaw PIN' +
        '</button>' +
        '<div class="worker-menu-divider"></div>' +
        '<button class="worker-menu-item danger" data-action="remove">' +
            '<span class="material-icons-round">person_remove</span>' +
            'Usuń pracownika' +
        '</button>';

    btn.closest('.worker-detail-card').appendChild(menu);

    menu.querySelector('[data-action="edit"]').addEventListener('click', function() {
        menu.remove();
        openEditWorkerModal(login);
    });

    menu.querySelector('[data-action="set-pin"]').addEventListener('click', function() {
        menu.remove();
        openSetPinModal(login, name);
    });

    menu.querySelector('[data-action="remove"]').addEventListener('click', function() {
        menu.remove();
        removeWorker(login, name);
    });
}

// Set PIN modal
var currentPinWorkerLogin = '';

function openSetPinModal(login, name) {
    currentPinWorkerLogin = login;
    document.getElementById('set-pin-worker-name').textContent = name;
    clearPinBoxes('set-pin-boxes');
    openModal('set-pin-modal');
    // Focus first pin box
    var firstBox = document.querySelector('#set-pin-boxes .pin-box');
    if (firstBox) setTimeout(function() { firstBox.focus(); }, 100);
}

async function savePinForWorker() {
    var pin = getPinValue('set-pin-boxes');
    if (pin.length !== 4) {
        showToast('Wpisz 4 cyfry PIN', 'error');
        return;
    }

    var result = await setWorkerPinAPI(currentPinWorkerLogin, pin);
    if (result.success) {
        showToast('PIN ustawiony pomyślnie', 'success');
        closeModal('set-pin-modal');
    } else {
        showToast(result.message || 'Błąd ustawiania PIN', 'error');
    }
}

// Worker Edit modal
var editingWorkerLogin = null;

async function openEditWorkerModal(login) {
    editingWorkerLogin = login;

    var worker = workersCache.find(function(w) { return w.login === login; });
    var details = await getWorkerDetailsAPI(login);

    document.getElementById('edit-worker-login').textContent = login;
    document.getElementById('ew-name').value = (details && details.name) || (worker && worker.name) || '';
    document.getElementById('ew-phone').value = (details && details.telefon) || '';
    document.getElementById('ew-address').value = (details && details.adres) || '';
    document.getElementById('ew-ice').value = (details && details.nr_ice) || '';
    setSelectValue('ew-contract-type', (details && details.rodzajUmowy) || '');
    document.getElementById('ew-hourly-rate').value = (details && details.stawka) || '';
    document.getElementById('ew-hire-date').value = (details && details.dataZatrudnienia) || '';
    document.getElementById('ew-bank-account').value = (details && details.nrKonta) || '';

    openModal('edit-worker-modal');

    // Google Places autocomplete
    var ewAddr = document.getElementById('ew-address');
    if (ewAddr && !ewAddr._autocompleteInit) {
        attachAutocomplete(ewAddr);
        ewAddr._autocompleteInit = true;
    }
}

async function saveWorker() {
    if (!editingWorkerLogin) return;

    var btn = document.getElementById('save-worker-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round spin">sync</span> Zapisywanie...';

    var data = {
        imie: document.getElementById('ew-name').value.trim(),
        telefon: document.getElementById('ew-phone').value.trim(),
        adres: document.getElementById('ew-address').value.trim(),
        nr_ice: document.getElementById('ew-ice').value.trim(),
        rodzaj_umowy: document.getElementById('ew-contract-type').value,
        stawka_godzinowa: document.getElementById('ew-hourly-rate').value,
        data_zatrudnienia: document.getElementById('ew-hire-date').value,
        nr_konta: document.getElementById('ew-bank-account').value.trim()
    };

    if (!data.imie) {
        showToast('Imię jest wymagane', 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';
        return;
    }

    var result = await updateWorkerAPI(editingWorkerLogin, data);

    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';

    if (result.success) {
        showToast('Dane pracownika zapisane', 'success');
        closeModal('edit-worker-modal');
        await loadWorkersList();
        loadWorkersView();
    } else {
        showToast(result.message || 'Błąd zapisu', 'error');
    }
}

// Worker Details modal
async function openWorkerDetails(login, name, role) {
    // Set header
    var initials = name.split(' ').length > 1
        ? (name.split(' ')[0].charAt(0) + name.split(' ')[name.split(' ').length-1].charAt(0)).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    document.getElementById('wd-avatar').textContent = initials;
    document.getElementById('wd-name').textContent = name;
    document.getElementById('wd-role').textContent = role || 'Pracownik';

    // Status badge
    var worker = workersCache.find(function(w) { return w.login === login; });
    var wStatus = worker && worker.status ? worker.status : '';
    var statusBadge = document.getElementById('wd-status-badge');
    if (wStatus) {
        var cls = 'available';
        if (wStatus === 'W trasie') cls = 'in-transit';
        else if (wStatus === 'Z pacjentem') cls = 'in-transit';
        statusBadge.className = 'worker-status-label ' + cls;
        statusBadge.textContent = wStatus;
    } else {
        statusBadge.className = 'worker-status-label offline';
        statusBadge.textContent = 'Nie w pracy';
    }

    // Reset stats
    document.getElementById('wd-today-hours').textContent = '-';
    document.getElementById('wd-week-hours').textContent = '-';
    document.getElementById('wd-month-hours').textContent = '-';
    document.getElementById('wd-sessions-body').innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:24px;">Ładowanie...</td></tr>';

    openModal('worker-details-modal');

    // Fetch details from API
    var data = await getWorkerDetailsAPI(login);
    if (data) {
        document.getElementById('wd-today-hours').textContent = data.todayHours || '0h 0m';
        document.getElementById('wd-week-hours').textContent = data.weekHours || '0h 0m';
        document.getElementById('wd-month-hours').textContent = data.monthHours || '0h 0m';

        var tbody = document.getElementById('wd-sessions-body');
        if (data.sessions && data.sessions.length > 0) {
            tbody.innerHTML = data.sessions.map(function(s) {
                return '<tr>' +
                    '<td>' + (s.date || '-') + '</td>' +
                    '<td>' + (s.start || '-') + '</td>' +
                    '<td>' + (s.end || '-') + '</td>' +
                    '<td style="font-weight:600;">' + (s.duration || '-') + '</td>' +
                '</tr>';
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:24px;">Brak danych o sesjach</td></tr>';
        }

        // Wynagrodzenie miesięczne
        var salarySection = document.getElementById('wd-salary-section');
        if (data.stawka && data.stawka > 0 && data.rodzajUmowy) {
            var monthMinutes = data.monthMinutes || 0;
            var godziny = Math.round((monthMinutes / 60) * 100) / 100;
            var stawka = data.stawka;
            var brutto = Math.round(godziny * stawka * 100) / 100;
            var rodzajUmowy = data.rodzajUmowy;

            var netto = brutto;
            if (rodzajUmowy === 'Umowa o pracę') {
                var zus = brutto * 0.1371;
                var zdrowotna = (brutto - zus) * 0.09;
                var podatek = Math.max(0, (brutto - zus - 250) * 0.12 - 300);
                netto = Math.round((brutto - zus - zdrowotna - podatek) * 100) / 100;
            } else if (rodzajUmowy === 'Umowa zlecenie') {
                var zusZl = brutto * 0.1371;
                var zdrowotnaZl = (brutto - zusZl) * 0.09;
                var kup = (brutto - zusZl) * 0.20;
                var podatekZl = (brutto - zusZl - kup) * 0.12;
                netto = Math.round((brutto - zusZl - zdrowotnaZl - podatekZl) * 100) / 100;
            }

            document.getElementById('wd-salary-hours').textContent = godziny.toFixed(2) + 'h';
            document.getElementById('wd-salary-rate').textContent = stawka.toFixed(2) + ' zł/h';
            document.getElementById('wd-salary-contract').textContent = rodzajUmowy;
            document.getElementById('wd-salary-brutto').textContent = brutto.toFixed(2) + ' zł';
            document.getElementById('wd-salary-netto').textContent = netto.toFixed(2) + ' zł';
            salarySection.style.display = '';
        } else {
            salarySection.style.display = 'none';
        }
    }
}

// ============================================================
// GOOGLE PLACES AUTOCOMPLETE
// ============================================================

function initAddressAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.log('Google Maps API niedostępne - autocomplete wyłączone');
        return;
    }

    var options = {
        componentRestrictions: { country: 'pl' },
        fields: ['formatted_address', 'name']
    };

    // Autocomplete na polach formularza zlecenia
    var fBase = document.getElementById('f-base');
    if (fBase) new google.maps.places.Autocomplete(fBase, options);

    // Adres zamieszkania pacjenta
    var fAddress = document.getElementById('f-address');
    if (fAddress) new google.maps.places.Autocomplete(fAddress, options);

    var editAddress = document.getElementById('edit-address');
    if (editAddress) new google.maps.places.Autocomplete(editAddress, options);

    document.querySelectorAll('.f-stop-input').forEach(function(input) {
        new google.maps.places.Autocomplete(input, options);
    });

    // Autocomplete na polach kalkulatora
    var calcBase = document.getElementById('calc-base');
    if (calcBase) new google.maps.places.Autocomplete(calcBase, options);

    document.querySelectorAll('.calc-stop-input').forEach(function(input) {
        new google.maps.places.Autocomplete(input, options);
    });
}

// Dodaj autocomplete na nowy input
function attachAutocomplete(input) {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'pl' },
            fields: ['formatted_address', 'name']
        });
    }
}

// Licznik przystanków
var stopCounter = 2;

// Dodaj przystanek
function addStop() {
    stopCounter++;
    var container = document.getElementById('calc-stops');
    var div = document.createElement('div');
    div.className = 'route-point';
    div.setAttribute('data-stop', stopCounter);
    div.innerHTML =
        '<div class="route-marker stop">' + stopCounter + '</div>' +
        '<div class="form-group" style="flex:1;">' +
            '<label class="form-label">Przystanek ' + stopCounter + '</label>' +
            '<input type="text" class="calc-stop-input" placeholder="Wpisz adres...">' +
        '</div>' +
        '<button type="button" class="btn-remove-stop" onclick="removeStop(this)" title="Usuń">' +
            '<span class="material-icons-round">close</span>' +
        '</button>';
    container.appendChild(div);

    // Autocomplete na nowym polu
    attachAutocomplete(div.querySelector('.calc-stop-input'));
}

// Usuń przystanek
function removeStop(btn) {
    var point = btn.closest('.route-point');
    point.remove();
    renumberStops();
}

// Przenumeruj przystanki
function renumberStops() {
    var stops = document.querySelectorAll('#calc-stops .route-point');
    stops.forEach(function(stop, i) {
        var num = i + 1;
        stop.querySelector('.route-marker').textContent = num;
        stop.querySelector('.form-label').textContent = 'Przystanek ' + num;
    });
    stopCounter = stops.length;
}

// Pobierz trasę z Google Maps Directions (wieloprzystankowa)
function fetchRouteFromMaps() {
    var base = document.getElementById('calc-base').value;
    var returnToBase = document.getElementById('calc-return').checked;
    var btn = document.getElementById('btn-fetch-route');
    var info = document.getElementById('route-info');
    var legsDiv = document.getElementById('route-legs');

    if (!base) {
        showToast('Wpisz adres bazy', 'error');
        return;
    }

    // Zbierz przystanki (pomijaj puste)
    var stopInputs = document.querySelectorAll('.calc-stop-input');
    var stops = [];
    stopInputs.forEach(function(input) {
        if (input.value.trim()) stops.push(input.value.trim());
    });

    if (stops.length === 0) {
        showToast('Dodaj co najmniej 1 przystanek', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Obliczanie trasy...';
    info.style.display = 'none';
    legsDiv.style.display = 'none';

    // Buduj request dla Directions API
    var origin = base;
    var destination = returnToBase ? base : stops[stops.length - 1];
    var waypoints = [];

    if (returnToBase) {
        // Wszystkie przystanki jako waypoints
        stops.forEach(function(s) {
            waypoints.push({ location: s, stopover: true });
        });
    } else {
        // Przystanki oprócz ostatniego jako waypoints
        for (var i = 0; i < stops.length - 1; i++) {
            waypoints.push({ location: stops[i], stopover: true });
        }
    }

    var directionsService = new google.maps.DirectionsService();
    directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: 'DRIVING',
        region: 'pl'
    }, function(response, status) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">route</span> Oblicz trasę z Google Maps';

        if (status !== 'OK') {
            showToast('Błąd Google Maps: ' + status, 'error');
            return;
        }

        var route = response.routes[0];
        var totalMeters = 0;
        var totalSeconds = 0;
        var legsHtml = '';

        route.legs.forEach(function(leg, i) {
            totalMeters += leg.distance.value;
            totalSeconds += leg.duration.value;
            legsHtml +=
                '<div class="route-leg">' +
                    '<span class="route-leg-num">' + String.fromCharCode(65 + i) + '</span>' +
                    '<span class="route-leg-text">' +
                        shortenAddr(leg.start_address) + ' → ' + shortenAddr(leg.end_address) +
                    '</span>' +
                    '<span class="route-leg-data">' + leg.distance.text + ' | ' + leg.duration.text + '</span>' +
                '</div>';
        });

        var totalKm = Math.round(totalMeters / 1000);
        var totalMin = Math.round(totalSeconds / 60);
        var totalH = Math.round((totalMin / 60) * 100) / 100;

        document.getElementById('calc-km').value = totalKm;
        document.getElementById('calc-hours').value = totalH;

        info.innerHTML =
            '<div style="padding:10px 14px; background:#e8f5e9; border-radius:8px; color:#2e7d32;">' +
                '<span class="material-icons-round" style="vertical-align:middle;font-size:18px;">check_circle</span> ' +
                'Trasa: <strong>' + totalKm + ' km</strong> | ' +
                '<strong>' + Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'min</strong> ' +
                '(' + route.legs.length + ' odcinków)' +
            '</div>';
        info.style.display = 'block';

        legsDiv.innerHTML = legsHtml;
        legsDiv.style.display = 'block';

        showToast(totalKm + ' km, ' + Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'min', 'success');
    });
}

// ============================================================
// EDYCJA ZLECENIA (MODAL)
// ============================================================

var currentEditId = null;

async function openEditModal(orderId) {
    var modal = document.getElementById('edit-modal');
    var saveBtn = document.getElementById('edit-save-btn');
    document.getElementById('edit-order-id').textContent = orderId;
    currentEditId = orderId;

    // Pobierz dane zlecenia z API
    if (API_MODE === 'api') {
        var order = await apiGet({ action: 'getOrder', id: orderId });
        if (!order) {
            showToast('Nie znaleziono zlecenia', 'error');
            return;
        }
        fillEditModal(order);
    }

    // Autocomplete na polach adresowych w modalu
    attachAutocomplete(document.getElementById('edit-from'));
    attachAutocomplete(document.getElementById('edit-to'));

    modal.style.display = 'flex';
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';
}

function fillEditModal(o) {
    // Data i czas
    var dateVal = '';
    if (o.Data_Transportu) {
        try {
            var d = new Date(o.Data_Transportu);
            dateVal = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        } catch(e) { dateVal = String(o.Data_Transportu); }
    }
    document.getElementById('edit-date').value = dateVal;

    var timeVal = '';
    if (o.Godzina_Zaplanowana) {
        var t = String(o.Godzina_Zaplanowana);
        // Obsłuż format ISO z GAS (1899-12-30T...)
        if (t.indexOf('T') > -1) {
            var td = new Date(t);
            timeVal = String(td.getHours()).padStart(2, '0') + ':' + String(td.getMinutes()).padStart(2, '0');
        } else {
            timeVal = t;
        }
    }
    document.getElementById('edit-time').value = timeVal;

    // Status i pilność
    setSelectValue('edit-status', o.Status_Zlecenia || '');
    setSelectValue('edit-urgency', o.Pilnosc || 'Zaplanowane');

    // Pacjent
    document.getElementById('edit-patient-name').value = o.Imie_Nazwisko || '';
    document.getElementById('edit-pesel').value = o.PESEL || '';
    document.getElementById('edit-phone').value = o.Telefon || '';
    setSelectValue('edit-patient-type', o.Typ_Pacjenta || 'Siedzący');
    setSelectValue('edit-family-help', o.Rodzina_Pomoc || 'Nie');

    // Trasa
    document.getElementById('edit-from').value = o.Adres_Start || '';
    document.getElementById('edit-to').value = o.Adres_Koniec || '';

    // Przypisanie
    setSelectValue('edit-contractor', o.Kontrahent || '');
    setSelectValue('edit-transport-type', o.Typ_Transportu || '');
    setSelectValue('edit-vehicle', o.Karetka_Nr ? String(o.Karetka_Nr) : '');
    setSelectValue('edit-worker1', o.Pracownik_1 || '');
    setSelectValue('edit-worker2', o.Pracownik_2 || '');

    // Uwagi
    document.getElementById('edit-medical-notes').value = o.Uwagi_Medyczne || '';
    document.getElementById('edit-notes').value = o.Uwagi || '';
}

function setSelectValue(selectId, value) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            return;
        }
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditId = null;
}

async function saveOrder() {
    if (!currentEditId) return;

    var saveBtn = document.getElementById('edit-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Zapisywanie...';

    var data = {
        data_transportu: document.getElementById('edit-date').value,
        godzina_zaplanowana: document.getElementById('edit-time').value,
        status: document.getElementById('edit-status').value,
        pilnosc: document.getElementById('edit-urgency').value,
        imie_nazwisko: document.getElementById('edit-patient-name').value,
        pesel: document.getElementById('edit-pesel').value,
        telefon: document.getElementById('edit-phone').value,
        typ_pacjenta: document.getElementById('edit-patient-type').value,
        rodzina_pomoc: document.getElementById('edit-family-help').value,
        adres_start: document.getElementById('edit-from').value,
        adres_koniec: document.getElementById('edit-to').value,
        kontrahent: document.getElementById('edit-contractor').value,
        typ_transportu: document.getElementById('edit-transport-type').value,
        karetka_nr: document.getElementById('edit-vehicle').value,
        pracownik_1: document.getElementById('edit-worker1').value,
        pracownik_2: document.getElementById('edit-worker2').value,
        uwagi_medyczne: document.getElementById('edit-medical-notes').value,
        uwagi: document.getElementById('edit-notes').value
    };

    var result = await apiPost({ action: 'updateOrder', id: currentEditId, data: data });

    if (result) {
        showToast('Zlecenie zaktualizowane', 'success');
        closeEditModal();
        loadOrdersList();
        loadDashboard();
    } else {
        showToast('Błąd zapisu zlecenia', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';
    }
}

// Zamknij modal kliknięciem na overlay
document.addEventListener('click', function(e) {
    if (e.target.id === 'edit-modal') {
        closeEditModal();
    }
});

// ============================================================
// POMOCNICZE
// ============================================================

function statusBadge(status) {
    var cls = 'zaplanowane';
    if (status.indexOf('trasie') > -1) cls = 'w-trasie';
    else if (status.indexOf('pacjentem') > -1) cls = 'z-pacjentem';
    else if (status.indexOf('Zakończone') > -1 || status === 'completed') cls = 'zakonczone';
    else if (status.indexOf('rozliczenia') > -1) cls = 'do-rozliczenia';
    else if (status.indexOf('Rozliczone') > -1) cls = 'rozliczone';
    return '<span class="status-badge ' + cls + '"><span class="status-dot"></span>' + status + '</span>';
}

function mapStatusForDisplay(frontendStatus) {
    var map = {
        'available': 'Zaplanowane',
        'scheduled': 'Zaplanowane',
        'in_transit': 'W trasie do pacjenta',
        'with_patient': 'Z pacjentem',
        'completed': 'Zakończone'
    };
    return map[frontendStatus] || frontendStatus || '-';
}

function shortenAddr(addr) {
    if (!addr) return '-';
    var parts = addr.split(',');
    return parts[0].trim();
}

function formatDateShort(dateVal) {
    if (!dateVal) return '-';
    try {
        var d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return String(d.getDate()).padStart(2, '0') + '.' +
            String(d.getMonth() + 1).padStart(2, '0') + '.' +
            d.getFullYear();
    } catch (e) {
        return String(dateVal);
    }
}

function showToast(message, type) {
    var toast = document.getElementById('toast');
    var icon = document.getElementById('toast-icon');
    var msg = document.getElementById('toast-message');

    toast.className = 'toast ' + (type || 'success');
    icon.textContent = type === 'error' ? 'error' : 'check_circle';
    msg.textContent = message;

    toast.classList.add('show');
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3500);
}

// ============================================================
// AUTOCOMPLETE PACJENTÓW
// ============================================================

var patientSearchTimer = null;

function initPatientAutocomplete() {
    // Formularz nowego zlecenia
    var fName = document.getElementById('f-patient-name');
    if (fName) {
        fName.addEventListener('input', function() {
            handlePatientInput(this.value, 'patient-suggestions', 'f-');
        });
        fName.addEventListener('focus', function() {
            if (this.value.length >= 2) {
                handlePatientInput(this.value, 'patient-suggestions', 'f-');
            }
        });
    }

    // Modal edycji
    var eName = document.getElementById('edit-patient-name');
    if (eName) {
        eName.addEventListener('input', function() {
            handlePatientInput(this.value, 'edit-patient-suggestions', 'edit-');
        });
        eName.addEventListener('focus', function() {
            if (this.value.length >= 2) {
                handlePatientInput(this.value, 'edit-patient-suggestions', 'edit-');
            }
        });
    }

    // Zamknij dropdown na klik poza nim
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.patient-input-wrap')) {
            closeAllPatientSuggestions();
        }
    });
}

function handlePatientInput(query, dropdownId, prefix) {
    clearTimeout(patientSearchTimer);

    if (!query || query.length < 2) {
        closeSuggestions(dropdownId);
        return;
    }

    patientSearchTimer = setTimeout(function() {
        searchPatientAPI(query, dropdownId, prefix);
    }, 300);
}

async function searchPatientAPI(query, dropdownId, prefix) {
    if (API_MODE !== 'api') return;

    var results = await apiGet({ action: 'searchPatients', query: query });
    if (results && results.length > 0) {
        renderPatientSuggestions(results, dropdownId, prefix);
    } else {
        closeSuggestions(dropdownId);
    }
}

function renderPatientSuggestions(patients, dropdownId, prefix) {
    var dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    var html = '';
    patients.forEach(function(p) {
        var initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
        var details = [];
        if (p.pesel) details.push('PESEL: ' + p.pesel);
        if (p.phone) details.push(p.phone);
        if (p.address) details.push(p.address.length > 25 ? p.address.substring(0, 25) + '...' : p.address);
        if (p.orderCount > 0) details.push(p.orderCount + ' zlec.');

        html +=
            '<div class="patient-suggestion-item" ' +
                'data-name="' + escAttr(p.name) + '" ' +
                'data-pesel="' + escAttr(p.pesel) + '" ' +
                'data-phone="' + escAttr(p.phone) + '" ' +
                'data-type="' + escAttr(p.patientType) + '" ' +
                'data-family="' + escAttr(p.familyHelp) + '" ' +
                'data-medical="' + escAttr(p.medicalNotes) + '" ' +
                'data-address="' + escAttr(p.address || '') + '" ' +
                'data-prefix="' + prefix + '">' +
                '<div class="patient-suggestion-icon">' +
                    '<span class="material-icons-round">person</span>' +
                '</div>' +
                '<div class="patient-suggestion-info">' +
                    '<div class="patient-suggestion-name">' + escHtml(p.name) + '</div>' +
                    (details.length ? '<div class="patient-suggestion-details">' + escHtml(details.join(' · ')) + '</div>' : '') +
                '</div>' +
            '</div>';
    });

    dropdown.innerHTML = html;
    dropdown.classList.add('open');

    // Kliknięcie na sugestię
    dropdown.querySelectorAll('.patient-suggestion-item').forEach(function(item) {
        item.addEventListener('click', function() {
            selectPatient(this);
        });
    });
}

function selectPatient(el) {
    var prefix = el.dataset.prefix;
    var nameField = prefix === 'f-' ? 'f-patient-name' : 'edit-patient-name';
    var peselField = prefix === 'f-' ? 'f-pesel' : 'edit-pesel';
    var phoneField = prefix === 'f-' ? 'f-phone' : 'edit-phone';
    var typeField = prefix === 'f-' ? 'f-patient-type' : 'edit-patient-type';
    var familyField = prefix === 'f-' ? 'f-family-help' : 'edit-family-help';
    var medicalField = prefix === 'f-' ? 'f-medical-notes' : 'edit-medical-notes';

    document.getElementById(nameField).value = el.dataset.name || '';
    document.getElementById(peselField).value = el.dataset.pesel || '';
    document.getElementById(phoneField).value = el.dataset.phone || '';
    setSelectValue(typeField, el.dataset.type || 'Siedzący');
    setSelectValue(familyField, el.dataset.family || 'Nie');

    var medField = document.getElementById(medicalField);
    if (medField && el.dataset.medical) {
        medField.value = el.dataset.medical;
    }

    // Adres zamieszkania
    var addressField = prefix === 'f-' ? 'f-address' : 'edit-address';
    var addrEl = document.getElementById(addressField);
    if (addrEl) addrEl.value = el.dataset.address || '';

    // Auto-fill przystanek #1 adresem pacjenta (tylko nowe zlecenie, jesli pusty)
    if (prefix === 'f-' && el.dataset.address) {
        var firstStop = document.querySelector('#f-stops .f-stop-input');
        if (firstStop && !firstStop.value.trim()) {
            firstStop.value = el.dataset.address;
        }
    }

    closeAllPatientSuggestions();
    showToast('Dane pacjenta uzupełnione', 'success');
}

function closeSuggestions(dropdownId) {
    var d = document.getElementById(dropdownId);
    if (d) {
        d.classList.remove('open');
        d.innerHTML = '';
    }
}

function closeAllPatientSuggestions() {
    closeSuggestions('patient-suggestions');
    closeSuggestions('edit-patient-suggestions');
}

function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// AI: OPTYMALIZACJA TRAS (dla dyspozytora)
// ============================================================

/**
 * Optymalizuje trasę dla zleceń na wybrany dzień
 */
async function optimizeOrderRoute() {
    const date = document.getElementById('filter-date').value;
    const vehicle = document.getElementById('filter-vehicle') ? document.getElementById('filter-vehicle').value : '';

    if (!date) {
        showToast('Wybierz datę do optymalizacji', 'error');
        return;
    }

    if (API_MODE !== 'api') {
        showToast('Optymalizacja wymaga połączenia z API', 'error');
        return;
    }

    showToast('Optymalizuję trasę...', 'success');

    const result = await apiGet({
        action: 'optimizeRoute',
        date: date,
        vehicle: vehicle
    });

    if (result) {
        showRouteOptimizationModal(result);
    } else {
        showToast('Błąd optymalizacji trasy', 'error');
    }
}

/**
 * Wyświetla modal z wynikami optymalizacji trasy
 */
function showRouteOptimizationModal(data) {
    if (!data.success) {
        showToast(data.message || 'Brak zleceń do optymalizacji', 'error');
        return;
    }

    // Utwórz modal dynamicznie (jeśli nie istnieje)
    var modal = document.getElementById('route-optimization-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'route-optimization-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Optymalizacja Trasy</h2>
                    <button class="modal-close" onclick="closeRouteOptimizationModal()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body" id="route-optimization-body">
                    <!-- Treść dynamiczna -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeRouteOptimizationModal()">
                        <span class="material-icons-round">close</span>
                        Anuluj
                    </button>
                    <button class="btn btn-primary" onclick="applyOptimizedRoute()">
                        <span class="material-icons-round">done</span>
                        Zastosuj optymalizację
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    var body = document.getElementById('route-optimization-body');

    // Renderuj wyniki
    var savingsHtml = '';
    if (data.savings && data.savings.percentage > 0) {
        savingsHtml = `
            <div style="padding: 12px; background: #e8f5e9; border-radius: 8px; margin-bottom: 16px; color: #2e7d32;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span class="material-icons-round" style="margin-right: 8px;">savings</span>
                    <strong>Oszczędności:</strong>
                </div>
                <div style="font-size: 14px;">
                    <div>Dystans: <strong>-${data.savings.distance} m</strong></div>
                    <div>Czas: <strong>-${data.savings.time} min</strong></div>
                    <div>Efektywność: <strong>+${data.savings.percentage}%</strong></div>
                </div>
            </div>
        `;
    }

    var ordersList = '';
    if (data.optimizedOrder && data.optimizedOrder.length > 0) {
        ordersList = data.optimizedOrder.map(function(orderId, index) {
            return `
                <div style="display: flex; align-items: center; padding: 10px; background: #f5f5f5; border-radius: 6px; margin-bottom: 8px;">
                    <div style="width: 32px; height: 32px; background: #1976d2; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-weight: bold;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; color: #333;">${orderId}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    body.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                <strong>Algorytm:</strong> ${data.algorithm === 'nearest_neighbor' ? 'Najbliższy sąsiad' : 'Sortowanie czasowe'}
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                <strong>Start:</strong> ${data.startLocation || 'Baza'}
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                <strong>Całkowity dystans:</strong> ${data.totalDistance} km
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 16px;">
                <strong>Całkowity czas:</strong> ${data.totalDuration} min
            </div>
        </div>
        ${savingsHtml}
        <div style="margin-top: 16px;">
            <h3 style="font-size: 14px; color: #666; margin-bottom: 12px;">Optymalna kolejność zleceń:</h3>
            ${ordersList}
        </div>
    `;

    // Zapisz dane w global variable do zastosowania
    window.optimizedRouteData = data;

    modal.style.display = 'flex';
}

/**
 * Zamyka modal optymalizacji trasy
 */
function closeRouteOptimizationModal() {
    var modal = document.getElementById('route-optimization-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    window.optimizedRouteData = null;
}

/**
 * Zastosowuje zoptymalizowaną kolejność (aktualizuje godziny zaplanowane)
 * UWAGA: Ta funkcja wymaga backendowej metody updateOrder dla każdego zlecenia
 */
async function applyOptimizedRoute() {
    if (!window.optimizedRouteData || !window.optimizedRouteData.optimizedOrder) {
        showToast('Brak danych optymalizacji', 'error');
        return;
    }

    var optimizedOrder = window.optimizedRouteData.optimizedOrder;
    var startTime = new Date();
    startTime.setHours(8, 0, 0, 0); // Start o 8:00 (domyślnie)

    // Aktualizuj godziny zleceń zgodnie z optymalizacją
    var currentTime = startTime;
    var successCount = 0;

    for (var i = 0; i < optimizedOrder.length; i++) {
        var orderId = optimizedOrder[i];

        // Oblicz nową godzinę (każde zlecenie: +30 min bufora)
        var timeStr = String(currentTime.getHours()).padStart(2, '0') + ':' + String(currentTime.getMinutes()).padStart(2, '0');

        try {
            var result = await apiPost({
                action: 'updateOrder',
                id: orderId,
                data: { godzina_zaplanowana: timeStr }
            });

            if (result) {
                successCount++;
            }
        } catch (err) {
            console.error('Błąd aktualizacji zlecenia ' + orderId, err);
        }

        // Zwiększ czas o 30 min
        currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    closeRouteOptimizationModal();
    showToast('Zoptymalizowano ' + successCount + ' zleceń', 'success');

    // Odśwież listę zleceń
    loadOrdersList();
}

// ============================================================
// BAZA PACJENTÓW
// ============================================================

var allPatients = [];

async function loadPatientsView() {
    var tbody = document.getElementById('patients-tbody');
    var statsEl = document.getElementById('patients-stats');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary);">Ładowanie pacjentów...</td></tr>';

    if (API_MODE !== 'api') {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;">Tryb demo - brak danych</td></tr>';
        return;
    }

    var result = await apiGet({ action: 'getPatients' });
    if (!result) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--error);">Błąd ładowania</td></tr>';
        return;
    }

    allPatients = result;

    // Stats
    var total = allPatients.length;
    var lezacy = allPatients.filter(function(p) { return p.patientType === 'Leżący'; }).length;
    var siedzacy = total - lezacy;
    statsEl.innerHTML =
        '<div class="patients-stat"><span class="patients-stat-value">' + total + '</span><span class="patients-stat-label">Wszystkich</span></div>' +
        '<div class="patients-stat"><span class="patients-stat-value">' + lezacy + '</span><span class="patients-stat-label">Leżących</span></div>' +
        '<div class="patients-stat"><span class="patients-stat-value">' + siedzacy + '</span><span class="patients-stat-label">Siedzących</span></div>';

    renderPatientsTable(allPatients);

    // Search
    var searchInput = document.getElementById('patients-search');
    searchInput.oninput = function() {
        var q = this.value.toLowerCase();
        if (!q) {
            renderPatientsTable(allPatients);
            return;
        }
        var filtered = allPatients.filter(function(p) {
            return (p.name && p.name.toLowerCase().indexOf(q) > -1) ||
                   (p.pesel && p.pesel.indexOf(q) > -1) ||
                   (p.phone && p.phone.indexOf(q) > -1) ||
                   (p.address && p.address.toLowerCase().indexOf(q) > -1);
        });
        renderPatientsTable(filtered);
    };
}

function renderPatientsTable(patients) {
    var tbody = document.getElementById('patients-tbody');

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary);">Brak pacjentów</td></tr>';
        return;
    }

    // Sortuj: najwięcej zleceń na górze
    patients.sort(function(a, b) { return (b.orderCount || 0) - (a.orderCount || 0); });

    tbody.innerHTML = patients.map(function(p) {
        var typeBadge = p.patientType === 'Leżący'
            ? '<span class="patient-type-badge lezacy"><span class="material-icons-round">bed</span> Leżący</span>'
            : '<span class="patient-type-badge siedzacy"><span class="material-icons-round">accessible</span> Siedzący</span>';

        var notes = p.medicalNotes
            ? '<span class="patient-notes-preview" title="' + escAttr(p.medicalNotes) + '">' + escHtml(p.medicalNotes.substring(0, 40)) + (p.medicalNotes.length > 40 ? '...' : '') + '</span>'
            : '<span style="color:var(--text-secondary)">-</span>';

        return '<tr class="patient-row" data-patient-id="' + escAttr(p.id) + '" style="cursor:pointer;" title="Kliknij aby edytować">' +
            '<td><div class="patient-name-cell"><div class="patient-avatar">' + (p.name ? p.name.charAt(0) : '?') + '</div><span>' + escHtml(p.name) + '</span></div></td>' +
            '<td>' + (p.pesel || '-') + '</td>' +
            '<td>' + (p.phone ? '<a href="tel:' + p.phone + '" class="patient-phone">' + p.phone + '</a>' : '-') + '</td>' +
            '<td>' + (p.address ? '<span title="' + escAttr(p.address) + '">' + escHtml(p.address.length > 30 ? p.address.substring(0, 30) + '...' : p.address) + '</span>' : '-') + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '<td><strong>' + (p.orderCount || 0) + '</strong></td>' +
            '<td>' + (p.lastOrder || '-') + '</td>' +
            '<td>' + notes + '</td>' +
        '</tr>';
    }).join('');

    // Kliknięcie na wiersz pacjenta -> edycja
    tbody.querySelectorAll('.patient-row').forEach(function(row) {
        row.addEventListener('click', function(e) {
            if (e.target.closest('a')) return; // Nie otwieraj edycji przy kliknięciu w telefon
            var patientId = this.dataset.patientId;
            var patient = allPatients.find(function(p) { return p.id === patientId; });
            if (patient) openEditPatientModal(patient);
        });
    });
}

var editingPatientId = null;

function openEditPatientModal(patient) {
    editingPatientId = patient.id;
    document.getElementById('edit-patient-id').textContent = patient.id;
    document.getElementById('ep-name').value = patient.name || '';
    document.getElementById('ep-pesel').value = patient.pesel || '';
    document.getElementById('ep-phone').value = patient.phone || '';
    document.getElementById('ep-address').value = patient.address || '';
    setSelectValue('ep-type', patient.patientType || 'Siedzący');
    setSelectValue('ep-family', patient.familyHelp || 'Nie');
    document.getElementById('ep-medical').value = patient.medicalNotes || '';
    document.getElementById('edit-patient-modal').style.display = 'flex';

    // Google Places autocomplete na adresie
    var epAddr = document.getElementById('ep-address');
    if (epAddr && !epAddr._autocompleteInit) {
        attachAutocomplete(epAddr);
        epAddr._autocompleteInit = true;
    }
}

async function savePatient() {
    if (!editingPatientId) return;

    var btn = document.getElementById('save-patient-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round spin">sync</span> Zapisywanie...';

    var data = {
        imie_nazwisko: document.getElementById('ep-name').value.trim(),
        pesel: document.getElementById('ep-pesel').value.trim(),
        telefon: document.getElementById('ep-phone').value.trim(),
        adres_zamieszkania: document.getElementById('ep-address').value.trim(),
        typ_pacjenta: document.getElementById('ep-type').value,
        rodzina_pomoc: document.getElementById('ep-family').value,
        uwagi_medyczne: document.getElementById('ep-medical').value.trim()
    };

    if (!data.imie_nazwisko) {
        showToast('Imię i nazwisko jest wymagane', 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';
        return;
    }

    var result = await updatePatientAPI(editingPatientId, data);

    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">save</span> Zapisz zmiany';

    if (result.success) {
        showToast('Dane pacjenta zapisane', 'success');
        closeModal('edit-patient-modal');
        loadPatientsView(); // Odśwież listę
    } else {
        showToast(result.message || 'Błąd zapisu', 'error');
    }
}

// ============================================================
// MAPA KARETEK (Live Map)
// ============================================================

var ambulanceMap = null;
var ambulanceMarkers = [];
var mapRefreshInterval = null;
var mapInfoWindow = null;

/**
 * Ładuje widok mapy karetek
 */
function loadMapView() {
    // Mapa wymaga opóźnienia - kontener musi być widoczny (display:block)
    // zanim Google Maps obliczy wymiary
    setTimeout(async function() {
        try {
            // Sprawdź czy Google Maps API jest załadowane
            if (typeof google === 'undefined' || !google.maps) {
                console.error('Google Maps API nie załadowane');
                var listEl = document.getElementById('map-vehicle-list');
                if (listEl) listEl.innerHTML = '<div class="map-no-data">Google Maps API niedostępne. Odśwież stronę.</div>';
                return;
            }

            // Inicjalizuj mapę jeśli jeszcze nie istnieje
            if (!ambulanceMap) {
                initAmbulanceMap();
            } else {
                // Wymuś przerysowanie mapy po zmianie widoku
                google.maps.event.trigger(ambulanceMap, 'resize');
            }

            // Załaduj pozycje
            await refreshMapPositions();

            // Auto-odświeżanie
            var autoRefresh = document.getElementById('map-auto-refresh');
            clearInterval(mapRefreshInterval);
            if (autoRefresh && autoRefresh.checked) {
                mapRefreshInterval = setInterval(refreshMapPositions, 60000);
            }
            if (autoRefresh) {
                autoRefresh.onchange = function() {
                    clearInterval(mapRefreshInterval);
                    if (this.checked) {
                        mapRefreshInterval = setInterval(refreshMapPositions, 60000);
                    }
                };
            }
        } catch (err) {
            console.error('loadMapView error:', err);
        }
    }, 200);
}

/**
 * Inicjalizuje Google Map
 */
function initAmbulanceMap() {
    var mapEl = document.getElementById('ambulance-map');
    if (!mapEl) return;

    // Centrum: Racibórz (baza)
    var baseLocation = { lat: 50.0919, lng: 18.2196 };

    ambulanceMap = new google.maps.Map(mapEl, {
        center: baseLocation,
        zoom: 12,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
    });

    mapInfoWindow = new google.maps.InfoWindow();

    // Marker bazy
    new google.maps.Marker({
        position: baseLocation,
        map: ambulanceMap,
        title: 'Baza - Rudzka 14, Racibórz',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#b51c1c',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2
        }
    });
}

/**
 * Odświeża pozycje karetek na mapie
 */
async function refreshMapPositions() {
    var vehicleListEl = document.getElementById('map-vehicle-list');
    var BASE_LOCATION = { lat: 50.0919, lng: 18.2196 };

    try {
        // Pokaż loading
        if (vehicleListEl) {
            vehicleListEl.innerHTML = '<div class="map-no-data"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span> Ładowanie...</div>';
        }

        console.log('[Mapa] Pobieranie pozycji karetek...');
        var result = await apiGet({ action: 'getAmbulancePositions' });
        console.log('[Mapa] Odpowiedź API:', result);

        // Jeśli API zwróciło null (błąd)
        if (!result) {
            if (vehicleListEl) vehicleListEl.innerHTML = '<div class="map-no-data"><span class="material-icons-round">cloud_off</span><br>Nie udało się połączyć z API.<br><small style="color:#999;">Sprawdź konsolę (F12).</small></div>';
            console.error('[Mapa] API returned null - sprawdź czy GAS deployment jest aktualny');
            return;
        }

        // result = {vehicles: [...], debug: {...}} lub tablica (stary format)
        var positions = [];
        var debugInfo = null;
        if (result && Array.isArray(result.vehicles)) {
            positions = result.vehicles;
            debugInfo = result.debug || null;
        } else if (Array.isArray(result)) {
            positions = result;
        } else if (result && Array.isArray(result.data)) {
            positions = result.data;
        }

        console.log('[Mapa] Znaleziono pojazdów:', positions.length, debugInfo ? ('GPS: ' + debugInfo.gpsPositionsFound) : '');

        // Wyczyść stare markery
        ambulanceMarkers.forEach(function(m) { m.setMap(null); });
        ambulanceMarkers = [];

        if (!ambulanceMap || typeof google === 'undefined') {
            if (vehicleListEl) vehicleListEl.innerHTML = '<div class="map-no-data">Mapa niezainicjalizowana</div>';
            return;
        }

        if (positions.length === 0) {
            if (vehicleListEl) vehicleListEl.innerHTML = '<div class="map-no-data"><span class="material-icons-round">local_shipping</span><br>Brak karetek w systemie.<br><small>Sprawdź arkusz KARETKI w Google Sheets.</small></div>';
            return;
        }

        var listHtml = '';
        var bounds = new google.maps.LatLngBounds();
        var gpsActiveCount = 0;
        bounds.extend(BASE_LOCATION);

        // Info banner o GPS / auth
        var noGpsVehicles = positions.filter(function(p) { return !p.lat || !p.lng; });
        if (debugInfo && debugInfo.cartrackAuth === 'brak_username') {
            listHtml += '<div class="map-gps-banner" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b;">' +
                '<span class="material-icons-round" style="font-size:18px;color:#ef4444;">warning</span>' +
                '<div>' +
                    '<strong>Cartrack: brak loginu</strong><br>' +
                    '<small>Uruchom <code>setupCartrackCredentials()</code> w Apps Script z Twoim loginem Cartrack</small>' +
                '</div>' +
            '</div>';
        } else if (debugInfo && debugInfo.cartrackAuth === 'brak_credentials') {
            listHtml += '<div class="map-gps-banner" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b;">' +
                '<span class="material-icons-round" style="font-size:18px;color:#ef4444;">warning</span>' +
                '<div>' +
                    '<strong>Cartrack: brak danych logowania</strong><br>' +
                    '<small>Skonfiguruj username i API password w Apps Script</small>' +
                '</div>' +
            '</div>';
        } else if (noGpsVehicles.length > 0) {
            listHtml += '<div class="map-gps-banner">' +
                '<span class="material-icons-round" style="font-size:18px;color:#f59e0b;">info</span>' +
                '<div>' +
                    '<strong>' + noGpsVehicles.length + '/' + positions.length + ' bez GPS</strong><br>' +
                    '<small>Pojazdy bez ostatnich jazd w Cartrack - pozycja przybliżona (baza)</small>' +
                '</div>' +
            '</div>';
        }

        positions.forEach(function(pos) {
            var statusColor = getAmbulanceStatusColor(pos.workerStatus || pos.status);
            var statusLabel = pos.workerStatus || pos.status || 'Nieznany';
            var hasGps = pos.lat && pos.lng;

            // Sidebar list item
            listHtml += '<div class="map-vehicle-card' + (hasGps ? '' : ' no-gps') + '" data-nr="' + pos.nr + '" onclick="focusAmbulance(\'' + pos.nr + '\')">' +
                '<div class="map-vehicle-header">' +
                    '<span class="map-vehicle-nr">Karetka ' + pos.nr + '</span>' +
                    '<span class="map-vehicle-status" style="background:' + statusColor + '20; color:' + statusColor + ';">' +
                        '<span class="map-legend-dot" style="background:' + statusColor + ';"></span> ' + statusLabel +
                    '</span>' +
                '</div>' +
                '<div class="map-vehicle-info">' +
                    (pos.worker ? '<div><span class="material-icons-round" style="font-size:14px;vertical-align:middle;">person</span> ' + escHtml(pos.worker) + '</div>' : '<div style="color:#999;">Brak przypisanego pracownika</div>') +
                    (pos.registration ? '<div><span class="material-icons-round" style="font-size:14px;vertical-align:middle;">directions_car</span> ' + escHtml(pos.registration) + '</div>' : '') +
                    (hasGps ? '<div><span class="material-icons-round" style="font-size:14px;vertical-align:middle;color:#22c55e;">gps_fixed</span> GPS aktywny' + (pos.lastUpdate ? ' <small style="color:#999;">' + pos.lastUpdate.substring(0,16) + '</small>' : '') + '</div>' : '<div><span class="material-icons-round" style="font-size:14px;vertical-align:middle;color:#f59e0b;">gps_off</span> ' + (!pos.gpsId ? 'Brak GPS ID' : 'Brak ostatnich jazd') + '</div>') +
                    (pos.address ? '<div class="map-vehicle-address"><span class="material-icons-round" style="font-size:14px;vertical-align:middle;">location_on</span> ' + escHtml(pos.address) + '</div>' : '') +
                    (pos.speed > 0 ? '<div><span class="material-icons-round" style="font-size:14px;vertical-align:middle;">speed</span> ' + pos.speed + ' km/h</div>' : '') +
                '</div>' +
            '</div>';

            // Pozycja markera: GPS lub baza (z offsetem żeby markery się nie nakładały)
            var markerLat, markerLng;
            if (hasGps) {
                markerLat = parseFloat(pos.lat);
                markerLng = parseFloat(pos.lng);
                gpsActiveCount++;
            } else {
                // Pokaż przy bazie z lekkim offsetem
                markerLat = BASE_LOCATION.lat + (pos.nr - 2) * 0.002;
                markerLng = BASE_LOCATION.lng + 0.005;
            }

            var latLng = { lat: markerLat, lng: markerLng };
            bounds.extend(latLng);

            var marker = new google.maps.Marker({
                position: latLng,
                map: ambulanceMap,
                title: 'Karetka ' + pos.nr + (pos.worker ? ' - ' + pos.worker : '') + (hasGps ? '' : ' (baza)'),
                icon: hasGps ? createAmbulanceIcon(statusColor, pos.heading || 0) : createAmbulanceIconNoGps(statusColor),
                zIndex: hasGps ? 10 : 3,
                opacity: hasGps ? 1.0 : 0.7
            });

            marker._vehicleNr = pos.nr;
            marker._vehicleData = pos;
            var mStatusColor = statusColor;
            var mStatusLabel = statusLabel;
            var mHasGps = hasGps;

            marker.addListener('click', function() {
                var p = this._vehicleData;
                var content = '<div style="font-family:Inter,sans-serif;min-width:200px;padding:4px;">' +
                    '<div style="font-weight:700;font-size:15px;margin-bottom:8px;">Karetka ' + p.nr + '</div>' +
                    (!mHasGps ? '<div style="margin-bottom:8px;padding:6px 10px;background:#fff7ed;border-radius:6px;font-size:12px;color:#92400e;"><span class="material-icons-round" style="font-size:14px;vertical-align:middle;">gps_off</span> Pozycja przybliżona (baza)</div>' : '') +
                    (p.registration ? '<div style="margin-bottom:4px;color:#666;"><strong>Rejestracja:</strong> ' + p.registration + '</div>' : '') +
                    (p.worker ? '<div style="margin-bottom:4px;"><strong>Pracownik:</strong> ' + p.worker + '</div>' : '') +
                    '<div style="margin-bottom:4px;"><strong>Status:</strong> <span style="color:' + mStatusColor + ';font-weight:600;">' + mStatusLabel + '</span></div>' +
                    (p.address ? '<div style="margin-bottom:4px;"><strong>Lokalizacja:</strong> ' + p.address + '</div>' : '') +
                    (p.speed > 0 ? '<div style="margin-bottom:4px;"><strong>Prędkość:</strong> ' + p.speed + ' km/h</div>' : '') +
                    (p.lastUpdate ? '<div style="font-size:11px;color:#999;margin-top:6px;">Aktualizacja: ' + p.lastUpdate + '</div>' : '') +
                '</div>';
                mapInfoWindow.setContent(content);
                mapInfoWindow.open(ambulanceMap, this);
            });

            ambulanceMarkers.push(marker);
        });

        if (vehicleListEl) {
            vehicleListEl.innerHTML = listHtml;
        }

        // Dopasuj widok mapy
        if (ambulanceMap) {
            ambulanceMap.fitBounds(bounds, { padding: 60 });
            google.maps.event.addListenerOnce(ambulanceMap, 'idle', function() {
                if (ambulanceMap.getZoom() > 15) ambulanceMap.setZoom(15);
            });
        }

        console.log('[Mapa] Wyświetlono ' + positions.length + ' karetek (' + gpsActiveCount + ' z GPS)');

    } catch (error) {
        console.error('[Mapa] Błąd:', error);
        if (vehicleListEl) vehicleListEl.innerHTML = '<div class="map-no-data"><span class="material-icons-round">error</span><br>Błąd: ' + error.message + '</div>';
    }
}

/**
 * Fokus na konkretną karetkę na mapie
 */
function focusAmbulance(nr) {
    var marker = ambulanceMarkers.find(function(m) { return m._vehicleNr == nr; });
    if (marker && ambulanceMap) {
        ambulanceMap.panTo(marker.getPosition());
        ambulanceMap.setZoom(15);
        google.maps.event.trigger(marker, 'click');
    }

    // Podświetl kartę w sidebar
    document.querySelectorAll('.map-vehicle-card').forEach(function(c) {
        c.classList.toggle('active', c.dataset.nr == nr);
    });
}

/**
 * Tworzy ikonę karetki z kolorem statusu
 */
function createAmbulanceIcon(color, heading) {
    return {
        path: 'M17.402 0H5.643C2.526 0 0 2.526 0 5.643v11.759C0 20.519 2.526 23.045 5.643 23.045h11.759c3.117 0 5.643-2.526 5.643-5.643V5.643C23.045 2.526 20.519 0 17.402 0zM11.523 20.045l-4-5h2.5v-7h3v7h2.5l-4 5z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(11.5, 11.5),
        rotation: heading || 0
    };
}

/**
 * Tworzy ikonę karetki BEZ GPS (okrąg z ?)
 */
function createAmbulanceIconNoGps(color) {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: color,
        fillOpacity: 0.3,
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity: 0.6
    };
}

/**
 * Zwraca kolor statusu karetki
 */
function getAmbulanceStatusColor(status) {
    if (!status) return '#6b7280';
    var s = status.toLowerCase();
    if (s.indexOf('wolny') > -1 || s === 'aktywna') return '#22c55e';
    if (s.indexOf('tras') > -1) return '#f59e0b';
    if (s.indexOf('pacjent') > -1) return '#ef4444';
    return '#6b7280';
}
