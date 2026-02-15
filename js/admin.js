/**
 * Life RMiP - Panel Dyspozytorski
 * ================================
 */

// ============================================================
// NAWIGACJA
// ============================================================

const viewTitles = {
    'dashboard': 'Dashboard',
    'new-order': 'Nowe zlecenie',
    'orders': 'Wszystkie zlecenia',
    'calculator': 'Kalkulator cen',
    'reports': 'Rozliczenia',
    'workers': 'Pracownicy'
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

    // Załaduj dane widoku
    switch (viewId) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrdersList(); break;
        case 'workers': loadWorkersView(); break;
        case 'new-order': initOrderForm(); break;
    }

    // Zamknij sidebar na mobile
    document.getElementById('sidebar').classList.remove('open');
}

// ============================================================
// INICJALIZACJA
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
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
        });
    });

    // Menu toggle (mobile)
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
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
        if (confirm('Wylogować się?')) {
            session.clearSession();
            window.location.href = 'https://biuro-spec.github.io/life-rmip/';
        }
    });

    // Filtr daty - domyślnie dzisiaj
    document.getElementById('filter-date').value = formatDateISO(new Date());

    // Google Places Autocomplete na polach adresowych
    initAddressAutocomplete();

    // Auto-obliczanie trasy po zmianie adresów
    initAutoRouteCalc();

    // Załaduj dashboard
    loadDashboard();
});

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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#999; padding:40px;">Brak zleceń na dzisiaj</td></tr>';
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
}

async function renderWorkersStatus() {
    const grid = document.getElementById('workers-status-grid');
    const workers = ['Krzysztof', 'Aleks', 'Waldemar', 'Dawid', 'Piotrek'];

    grid.innerHTML = workers.map(name => {
        const initial = name.charAt(0);
        return '<div class="worker-card">' +
            '<div class="worker-avatar offline">' + initial + '</div>' +
            '<div class="worker-details">' +
                '<div class="worker-name">' + name + '</div>' +
                '<div class="worker-status-text">Offline</div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Jeśli API, pobierz aktualne statusy
    if (API_MODE === 'api') {
        const result = await apiGet({ action: 'getWorkers' });
        if (result) {
            grid.innerHTML = result.map(w => {
                var statusClass = 'offline';
                var statusText = 'Offline';
                if (w.status === 'Wolny') { statusClass = 'available'; statusText = 'Wolny'; }
                else if (w.status === 'W trasie') { statusClass = 'in-transit'; statusText = 'W trasie'; }
                else if (w.status === 'Z pacjentem') { statusClass = 'with-patient'; statusText = 'Z pacjentem'; }

                return '<div class="worker-card">' +
                    '<div class="worker-avatar ' + statusClass + '">' + w.name.charAt(0) + '</div>' +
                    '<div class="worker-details">' +
                        '<div class="worker-name">' + w.name + '</div>' +
                        '<div class="worker-status-text">' + statusText + '</div>' +
                        (w.vehicle ? '<div class="worker-vehicle">Karetka ' + w.vehicle + '</div>' : '') +
                    '</div>' +
                '</div>';
            }).join('');
        }
    }
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

    // Ustaw tytuł
    document.getElementById('page-title').textContent = 'Nowe zlecenie — ' + contractor;

    // Podświetl toggle
    document.getElementById('nav-new-order-toggle').classList.add('active', 'open');
    document.getElementById('nav-new-order-sub').classList.add('open');
}

/**
 * Auto-obliczanie trasy z Google Maps po wpisaniu adresów
 */
var autoRouteTimeout = null;
var lastAutoRouteKey = '';

function initAutoRouteCalc() {
    var fromInput = document.getElementById('f-from');
    var toInput = document.getElementById('f-to');

    if (!fromInput || !toInput) return;

    function scheduleAutoCalc() {
        clearTimeout(autoRouteTimeout);
        autoRouteTimeout = setTimeout(function() {
            var key = fromInput.value.trim() + '|' + toInput.value.trim();
            if (key === lastAutoRouteKey) return;
            lastAutoRouteKey = key;
            autoCalcRoute();
        }, 600);
    }

    fromInput.addEventListener('change', scheduleAutoCalc);
    toInput.addEventListener('change', scheduleAutoCalc);
    fromInput.addEventListener('blur', scheduleAutoCalc);
    toInput.addEventListener('blur', scheduleAutoCalc);
}

function autoCalcRoute() {
    var from = document.getElementById('f-from').value.trim();
    var to = document.getElementById('f-to').value.trim();
    var infoDiv = document.getElementById('route-auto-info');

    if (!from || !to || from.length < 5 || to.length < 5) {
        infoDiv.style.display = 'none';
        return;
    }

    if (typeof google === 'undefined' || !google.maps) {
        return;
    }

    // Pokaż "obliczanie..."
    infoDiv.style.display = 'block';
    infoDiv.className = 'route-auto-info loading';
    infoDiv.querySelector('.route-auto-result').innerHTML =
        '<span class="material-icons-round">hourglass_top</span>' +
        '<span>Obliczanie trasy...</span>';

    var directionsService = new google.maps.DirectionsService();
    directionsService.route({
        origin: from,
        destination: to,
        travelMode: 'DRIVING',
        region: 'pl'
    }, function(response, status) {
        if (status !== 'OK') {
            infoDiv.style.display = 'none';
            return;
        }

        var route = response.routes[0];
        var totalMeters = 0;
        var totalSeconds = 0;

        route.legs.forEach(function(leg) {
            totalMeters += leg.distance.value;
            totalSeconds += leg.duration.value;
        });

        var totalKm = Math.round(totalMeters / 1000);
        var totalMin = Math.round(totalSeconds / 60);
        var hours = Math.floor(totalMin / 60);
        var mins = totalMin % 60;
        var timeStr = hours > 0 ? hours + 'h ' + mins + 'min' : mins + ' min';

        infoDiv.className = 'route-auto-info';
        infoDiv.querySelector('.route-auto-result').innerHTML =
            '<span class="material-icons-round">route</span>' +
            '<span>Trasa: <strong>' + totalKm + '</strong> km | <strong>' + timeStr + '</strong></span>';
        infoDiv.style.display = 'block';
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
        adres_start: document.getElementById('f-from').value,
        adres_koniec: document.getElementById('f-to').value,
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
    document.getElementById('f-date').value = formatDateISO(new Date());
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
            '<td>' + formatDateShort(o.Data_Transportu) + '</td>' +
            '<td>' + (o.Imie_Nazwisko || '-') + '</td>' +
            '<td style="font-size:12px;">' + (o.Adres_Start || '-') + ' → ' + (o.Adres_Koniec || '-') + '</td>' +
            '<td>' + (o.Laczny_Czas_Dziesietny || '-') + '</td>' +
            '<td>' + (o.Kilometry || '-') + '</td>' +
            '<td>' + (o.Obliczenie_Czas ? o.Obliczenie_Czas + ' zł' : '-') + '</td>' +
            '<td>' + (o.Obliczenie_Km ? o.Obliczenie_Km + ' zł' : '-') + '</td>' +
            '<td><strong>' + (o.Lacznie ? o.Lacznie + ' zł' : '-') + '</strong></td>';
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
    const grid = document.getElementById('workers-detail-grid');
    const workers = ['Krzysztof', 'Aleks', 'Waldemar', 'Dawid', 'Piotrek'];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    grid.innerHTML = workers.map(name => {
        return '<div class="worker-detail-card">' +
            '<div class="worker-detail-header">' +
                '<div class="worker-detail-avatar">' + name.charAt(0) + '</div>' +
                '<div>' +
                    '<div class="worker-detail-name">' + name + '</div>' +
                    '<div class="worker-detail-status">Ładowanie...</div>' +
                '</div>' +
            '</div>' +
            '<div class="worker-detail-stats">' +
                '<div class="worker-stat"><span class="worker-stat-value">-</span><span class="worker-stat-label">Zleceń</span></div>' +
                '<div class="worker-stat"><span class="worker-stat-value">-</span><span class="worker-stat-label">Godzin</span></div>' +
                '<div class="worker-stat"><span class="worker-stat-value">-</span><span class="worker-stat-label">Km</span></div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Pobierz dane z API
    if (API_MODE === 'api') {
        for (var i = 0; i < workers.length; i++) {
            const result = await apiGet({
                action: 'getWorkerReport',
                worker: workers[i],
                month: month,
                year: year
            });

            if (result) {
                const cards = grid.querySelectorAll('.worker-detail-card');
                const card = cards[i];
                if (card) {
                    card.querySelector('.worker-detail-status').textContent =
                        result.totalWorkDays + ' dni w tym miesiącu';
                    const stats = card.querySelectorAll('.worker-stat-value');
                    stats[0].textContent = result.totalOrders;
                    stats[1].textContent = result.totalWorkHours;
                    stats[2].textContent = result.totalKm;
                }
            }
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

    var fromInput = document.getElementById('f-from');
    var toInput = document.getElementById('f-to');

    if (fromInput) {
        var acFrom = new google.maps.places.Autocomplete(fromInput, options);
        acFrom.addListener('place_changed', function() {
            var place = acFrom.getPlace();
            if (place && place.formatted_address) {
                fromInput.value = place.formatted_address;
            }
            autoCalcRoute();
        });
    }

    if (toInput) {
        var acTo = new google.maps.places.Autocomplete(toInput, options);
        acTo.addListener('place_changed', function() {
            var place = acTo.getPlace();
            if (place && place.formatted_address) {
                toInput.value = place.formatted_address;
            }
            autoCalcRoute();
        });
    }

    // Autocomplete na polach kalkulatora
    var calcBase = document.getElementById('calc-base');
    if (calcBase) {
        new google.maps.places.Autocomplete(calcBase, options);
    }

    // Autocomplete na istniejących przystankach
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
    return '<span class="status-badge ' + cls + '">' + status + '</span>';
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
        return String(d.getDate()).padStart(2, '0') + '.' +
            String(d.getMonth() + 1).padStart(2, '0');
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
