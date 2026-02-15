// Utility functions for Life RMiP app

// Format date and time
function formatDateTime(date) {
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('pl-PL', options).format(date);
}

// Format time only
function formatTime(date) {
  const options = {
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Intl.DateTimeFormat('pl-PL', options).format(date);
}

// Format date only
function formatDate(date) {
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('pl-PL', options).format(date);
}

// Convert time to decimal format (for billing)
function timeToDecimal(hours, minutes) {
  return hours + (minutes / 60);
}

// Calculate time difference in hours (decimal)
function calculateHours(startTime, endTime) {
  const diff = endTime - startTime;
  const hours = diff / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100; // Round to 2 decimals
}

// Local storage helpers
const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }
};

// Session management
const session = {
  getCurrentWorker: () => storage.get('currentWorker'),
  setCurrentWorker: (worker) => storage.set('currentWorker', worker),
  clearSession: () => {
    storage.remove('currentWorker');
    storage.remove('currentVehicle');
    storage.remove('workStartTime');
  },
  isLoggedIn: () => !!storage.get('currentWorker'),

  // Admin session
  getAdminSession: () => storage.get('adminSession'),
  setAdminSession: (obj) => storage.set('adminSession', obj),
  clearAdminSession: () => storage.remove('adminSession'),
  isAdminLoggedIn: () => !!storage.get('adminSession'),
  getSession: function() { return this.getAdminSession(); }
};

// Status helpers
const statusConfig = {
  available: {
    label: 'Wolny/Dostępny',
    class: 'status-available',
    icon: '🟢'
  },
  in_transit: {
    label: 'W trasie do pacjenta',
    class: 'status-in-transit',
    icon: '🚗'
  },
  with_patient: {
    label: 'Z pacjentem',
    class: 'status-in-transit',
    icon: '🚑'
  },
  scheduled: {
    label: 'Zaplanowane',
    class: 'status-scheduled',
    icon: '📋'
  },
  completed: {
    label: 'Zakończone',
    class: 'status-completed',
    icon: '✅'
  }
};

function getStatusLabel(status) {
  return statusConfig[status]?.label || status;
}

function getStatusClass(status) {
  return statusConfig[status]?.class || 'status-scheduled';
}

function getStatusIcon(status) {
  return statusConfig[status]?.icon || '⏺';
}

// Show simple notification (you can enhance this later)
function showNotification(message, type = 'info') {
  // For now, just console log
  // Later, implement toast notifications
  console.log(`[${type.toUpperCase()}]`, message);
  
  // Simple alert for MVP
  if (type === 'error') {
    alert(message);
  }
}

// Validate form fields
function validateRequired(fields) {
  for (const field of fields) {
    if (!field.value || field.value.trim() === '') {
      return false;
    }
  }
  return true;
}
