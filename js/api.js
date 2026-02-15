/**
 * Life RMiP - Klient API
 * =======================
 * Komunikacja z Google Apps Script Web App
 * Zastępuje mockData.js w trybie produkcyjnym
 */

// ============================================================
// KONFIGURACJA
// ============================================================

// URL API Google Apps Script - UZUPEŁNIJ PO WDROŻENIU
// Po opublikowaniu Web App wklej tutaj URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwV78BCyi1d3Wdp3hwCU9v5tHjglcwHJi8LHmB01nIvD88Lf_WWoDqliqgZ3MQRGw3eqg/exec';

// Tryb pracy: 'api' (produkcja) lub 'mock' (lokalne testy)
// Automatycznie przełącza na 'mock' jeśli API_URL jest pusty
const API_MODE = API_URL ? 'api' : 'mock';

// ============================================================
// MAPOWANIE STATUSÓW
// Frontend (angielskie) <-> Backend (polskie)
// ============================================================

const STATUS_MAP = {
  // Frontend -> Backend
  toBackend: {
    'available': 'Zaplanowane',
    'scheduled': 'Zaplanowane',
    'in_transit': 'W trasie do pacjenta',
    'with_patient': 'Z pacjentem',
    'completed': 'Zakończone',
    'to_settle': 'Do rozliczenia',
    'settled': 'Rozliczone'
  },
  // Backend -> Frontend
  toFrontend: {
    'Zaplanowane': 'scheduled',
    'W trasie do pacjenta': 'in_transit',
    'Z pacjentem': 'with_patient',
    'Zakończone': 'completed',
    'Do rozliczenia': 'completed',
    'Rozliczone': 'completed'
  }
};

function statusToBackend(frontendStatus) {
  return STATUS_MAP.toBackend[frontendStatus] || frontendStatus;
}

function statusToFrontend(backendStatus) {
  return STATUS_MAP.toFrontend[backendStatus] || 'scheduled';
}

// ============================================================
// KOMUNIKACJA Z API
// ============================================================

/**
 * Wysyła żądanie GET do API
 */
async function apiGet(params) {
  if (API_MODE === 'mock') return null;

  const url = new URL(API_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    if (!data.success) {
      console.error('API Error (GET):', data.message);
      return null;
    }
    return data.data;
  } catch (error) {
    console.error('API Fetch Error (GET):', error);
    return null;
  }
}

/**
 * Wysyła żądanie POST do API
 */
async function apiPost(body) {
  if (API_MODE === 'mock') return null;

  try {
    // Content-Type: text/plain unika CORS preflight (OPTIONS)
    // GAS i tak parsuje body z e.postData.contents
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const data = await response.json();
    if (!data.success) {
      console.error('API Error (POST):', data.message);
      return null;
    }
    return data.data;
  } catch (error) {
    console.error('API Fetch Error (POST):', error);
    return null;
  }
}

// ============================================================
// FUNKCJE ZASTĘPUJĄCE mockData.js
// (Te same nazwy, teraz async z obsługą API + fallback mock)
// ============================================================

/**
 * Pobiera zlecenia dla daty i pracownika
 */
async function getOrdersForDate(date, workerId) {
  if (API_MODE === 'api') {
    // Format daty: YYYY-MM-DD
    const dateStr = formatDateISO(date);
    const result = await apiGet({
      action: 'getOrdersForWorker',
      worker: workerId,
      date: dateStr
    });

    if (result) {
      return result.map(mapOrderFromAPI);
    }
  }

  // Fallback: mock data
  return getOrdersForDateMock(date, workerId);
}

/**
 * Pobiera pojedyncze zlecenie po ID
 */
async function getOrderById(orderId) {
  if (API_MODE === 'api') {
    const result = await apiGet({
      action: 'getOrdersForWorker',
      worker: session.getCurrentWorker()?.id
    });

    if (result) {
      const order = result.find(o => o.id === orderId);
      if (order) return mapOrderFromAPI(order);
    }
  }

  // Fallback: mock data
  return getOrderByIdMock(orderId);
}

/**
 * Aktualizuje status zlecenia
 */
async function updateOrderStatus(orderId, newStatus, timestamp) {
  if (API_MODE === 'api') {
    const backendStatus = statusToBackend(newStatus);
    const result = await apiPost({
      action: 'updateOrderStatus',
      id: orderId,
      status: backendStatus,
      timestamp: timestamp
    });

    if (result) {
      // Aktualizuj też status pracownika
      const worker = session.getCurrentWorker();
      if (worker) {
        let workerStatus = 'Wolny';
        if (newStatus === 'in_transit') workerStatus = 'W trasie';
        else if (newStatus === 'with_patient') workerStatus = 'Z pacjentem';

        await apiPost({
          action: 'updateWorkerStatus',
          worker: worker.id,
          status: workerStatus
        });
      }

      return true;
    }
  }

  // Fallback: mock data
  return updateOrderStatusMock(orderId, newStatus, timestamp);
}

/**
 * Zapisuje kilometry
 */
async function saveKilometers(orderId, kilometers, source) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'updateKilometers',
      id: orderId,
      kilometers: kilometers,
      source: source || 'Recznie'
    });

    if (result) return true;
  }

  // Fallback: mock data
  return saveKilometersMock(orderId, kilometers, source);
}

/**
 * Pobiera kilometry z GPS Cartrack dla zlecenia
 * @returns {Object|null} { km: number, source: string } lub null
 */
async function fetchGPSKilometers(orderId) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'getGPSKilometers',
      id: orderId
    });

    if (result && result.km) {
      return result;
    }
  }

  // Mock mode / fallback: brak GPS
  return null;
}

/**
 * Logowanie pracownika przez API
 */
async function loginWorkerAPI(login, pin, vehicle) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'loginWorker',
      worker: login,
      pin: pin,
      vehicle: vehicle
    });

    if (result) {
      return {
        success: true,
        data: {
          id: result.login,
          name: result.name,
          vehicleId: String(result.vehicle),
          vehicleName: 'Karetka ' + result.vehicle,
          startTime: result.loginTime
        }
      };
    }

    return { success: false, message: 'Błąd logowania - sprawdź PIN' };
  }

  // Fallback: mock - akceptuj dowolny PIN
  return {
    success: true,
    data: null // Login.js sam tworzy workerData
  };
}

/**
 * Wylogowanie pracownika
 */
async function logoutWorkerAPI() {
  if (API_MODE === 'api') {
    const worker = session.getCurrentWorker();
    if (worker) {
      await apiPost({
        action: 'logoutWorker',
        worker: worker.id
      });
    }
  }
}

// ============================================================
// ADMIN & WORKER MANAGEMENT API
// ============================================================

/**
 * Logowanie administratora (dyspozytor)
 */
async function loginAdminAPI(login, pin) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'loginAdmin',
      login: login,
      pin: pin
    });
    if (result) return { success: true, data: result };
    return { success: false, message: 'Nieprawidłowy PIN' };
  }
  // Mock: accept any PIN
  return { success: true, data: { login: login, name: login.charAt(0).toUpperCase() + login.slice(1) } };
}

/**
 * Pobiera listę pracowników
 */
async function getWorkersListAPI() {
  if (API_MODE === 'api') {
    const result = await apiGet({ action: 'getWorkersList' });
    if (result) return result;
  }
  // Mock fallback
  return [
    { name: 'Krzysztof', login: 'krzysztof', role: 'Kierownik Zespołu' },
    { name: 'Aleks', login: 'aleks', role: 'Logistyk Terenowy' },
    { name: 'Waldemar', login: 'waldemar', role: 'Ratownik Medyczny' },
    { name: 'Dawid', login: 'dawid', role: 'Kierowca Ambulansu' },
    { name: 'Piotrek', login: 'piotrek', role: 'Ratownik Medyczny' }
  ];
}

/**
 * Dodaje nowego pracownika
 */
async function addWorkerAPI(name, login, role) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'addWorker',
      name: name,
      login: login,
      role: role
    });
    if (result) return { success: true };
    return { success: false, message: 'Błąd dodawania pracownika' };
  }
  return { success: true };
}

/**
 * Usuwa pracownika
 */
async function removeWorkerAPI(login) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'removeWorker',
      login: login
    });
    if (result) return { success: true };
    return { success: false, message: 'Błąd usuwania pracownika' };
  }
  return { success: true };
}

/**
 * Ustawia PIN pracownika
 */
async function setWorkerPinAPI(login, pin) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'setWorkerPin',
      login: login,
      pin: pin
    });
    if (result) return { success: true };
    return { success: false, message: 'Błąd ustawiania PIN' };
  }
  return { success: true };
}

/**
 * Pobiera szczegóły pracownika (czas pracy, historia sesji)
 */
async function getWorkerDetailsAPI(login) {
  if (API_MODE === 'api') {
    const result = await apiGet({
      action: 'getWorkerDetails',
      worker: login
    });
    if (result) return result;
  }
  // Mock fallback
  return {
    name: login,
    todayHours: '0h 0m',
    weekHours: '0h 0m',
    monthHours: '0h 0m',
    sessions: []
  };
}

// ============================================================
// PACJENCI API
// ============================================================

/**
 * Aktualizuje dane pacjenta
 */
async function updatePatientAPI(id, data) {
  if (API_MODE === 'api') {
    const result = await apiPost({
      action: 'updatePatient',
      id: id,
      data: data
    });
    if (result) return { success: true };
    return { success: false, message: 'Błąd aktualizacji pacjenta' };
  }
  return { success: true };
}

// ============================================================
// MAPOWANIE DANYCH Z API NA FORMAT FRONTEND
// ============================================================

/**
 * Mapuje zlecenie z formatu API na format frontendu
 */
function mapOrderFromAPI(apiOrder) {
  return {
    id: apiOrder.id,
    time: apiOrder.time || '',
    patientName: apiOrder.patientName || '',
    patientPESEL: apiOrder.patientPESEL || '',
    patientPhone: apiOrder.patientPhone || '',
    patientType: apiOrder.patientType ? apiOrder.patientType.toLowerCase() : 'siedzący',
    from: apiOrder.from || '',
    to: apiOrder.to || '',
    status: statusToFrontend(apiOrder.status),
    contractor: apiOrder.contractor || '',
    transportType: apiOrder.transportType || '',
    medicalNotes: apiOrder.medicalNotes || '',
    assignedWorker: apiOrder.worker1 || '',
    vehicle: apiOrder.vehicle || '',
    date: apiOrder.date || '',
    startTime: apiOrder.departureTime || null,
    arrivalTime: apiOrder.arrivalTime || null,
    endTime: apiOrder.completionTime || null,
    kilometers: apiOrder.kilometers || null
  };
}

// ============================================================
// HELPER: Format daty na YYYY-MM-DD
// ============================================================

function formatDateISO(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ============================================================
// MOCK DATA (wbudowane na wypadek braku API)
// ============================================================

const mockOrders = [
  {
    id: 'ZL-2026-001',
    time: '10:00',
    patientName: 'Jan Kowalski',
    patientPESEL: '80010112345',
    patientPhone: '+48 500 123 456',
    patientType: 'siedzący',
    from: 'Dom, Racibórz ul. Długa 15',
    to: 'Szpital Racibórz, Oddz. Neurologii',
    status: 'available',
    contractor: 'Szpital Racibórz',
    transportType: 'sanitarny',
    medicalNotes: 'Pacjent wymaga tlenu',
    assignedWorker: 'krzysztof',
    vehicle: '2',
    date: '2026-02-08'
  },
  {
    id: 'ZL-2026-002',
    time: '14:30',
    patientName: 'Anna Nowak',
    patientPESEL: '75050567890',
    patientPhone: '+48 600 234 567',
    patientType: 'leżący',
    from: 'Przychodnia ScanMed, Racibórz',
    to: 'Dom, Racibórz ul. Krótka 8',
    status: 'in_transit',
    contractor: 'ScanMed',
    transportType: '',
    medicalNotes: '',
    assignedWorker: 'krzysztof',
    vehicle: '2',
    date: '2026-02-08',
    startTime: '2026-02-08T14:25:00'
  },
  {
    id: 'ZL-2026-003',
    time: '16:00',
    patientName: 'Piotr Wiśniewski',
    patientPESEL: '90121298765',
    patientPhone: '+48 700 345 678',
    patientType: 'siedzący',
    from: 'Szpital Racibórz',
    to: 'Dom, Kietrz ul. Polna 12',
    status: 'scheduled',
    contractor: 'Kietrz',
    transportType: '',
    medicalNotes: 'Kontrola po zabiegu',
    assignedWorker: 'krzysztof',
    vehicle: '2',
    date: '2026-02-08'
  },
  {
    id: 'ZL-2026-004',
    time: '09:00',
    patientName: 'Maria Zielińska',
    patientPESEL: '55030145678',
    patientPhone: '+48 500 456 789',
    patientType: 'siedzący',
    from: 'Dom, Racibórz ul. Nowa 3',
    to: 'Przychodnia POZ Krzyżanowice',
    status: 'scheduled',
    contractor: 'POZ Krzyżanowice',
    transportType: '',
    medicalNotes: '',
    assignedWorker: 'krzysztof',
    vehicle: '2',
    date: '2026-02-09'
  }
];

function getOrdersForDateMock(date, workerId) {
  const dateStr = formatDateISO(date);
  return mockOrders.filter(order =>
    order.date === dateStr && order.assignedWorker === workerId
  );
}

function getOrderByIdMock(orderId) {
  return mockOrders.find(order => order.id === orderId) || null;
}

function updateOrderStatusMock(orderId, newStatus, timestamp) {
  const order = mockOrders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    if (newStatus === 'in_transit') order.startTime = timestamp;
    else if (newStatus === 'with_patient') order.arrivalTime = timestamp;
    else if (newStatus === 'completed') order.endTime = timestamp;
    return true;
  }
  return false;
}

function saveKilometersMock(orderId, kilometers, source) {
  const order = mockOrders.find(o => o.id === orderId);
  if (order) {
    order.kilometers = kilometers;
    order.kilometersSource = source || 'manual';
    return true;
  }
  return false;
}
