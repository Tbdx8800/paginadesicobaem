import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAziX2ZYthQ6jMN9t5KoEk1qb88ZT29OMU",
    authDomain: "realphone-tickets.firebaseapp.com",
    projectId: "realphone-tickets",
    storageBucket: "realphone-tickets.firebasestorage.app",
    messagingSenderId: "461224250452",
    appId: "1:461224250452:web:9d2ed52a0e880c3e45f1c1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORAGE_STORE = 'realphone_current_store';

// ==================== STORE ADDRESSES ====================
const STORE_ADDRESSES = {
    "Matriz": "Lázaro Cárdenas 179 Col. Centro",
    "Sunny": "53 Príncipe Tacámba Col. Centro",
    "Hospital": "99 Álvaro Obregón Col. Centro",
    "David": "Av. Madero Oriente Col. Centro",
    "Portal": "34 Portal Nicolás de Regulés Col. Centro",
    "Coppel": "486 Lic. Isidro Favela Col. Los Pinos"
};

// ==================== CLOUD / DB ABSTRACTION ====================
const DB = {
    getStore: () => localStorage.getItem(STORAGE_STORE) || '',
    setStore: (store) => localStorage.setItem(STORAGE_STORE, store),
    removeStore: () => localStorage.removeItem(STORAGE_STORE),
    clearTickets: async () => {
        // Para borrar todo, en Firestore tendríamos que iterar cada documento
        // Por seguridad, esto ahora solo borra la tienda local.
        alert("La función de borrar base de datos completa se deshabilitó temporalmente por seguridad en la nube.");
    }
};

let users = [];
let facturas = [];
let reparaciones = [];
let currentStore = DB.getStore();
let currentUser1 = null;
let currentUser2 = null;

// ==================== FIREBASE REAL-TIME LISTENERS ====================
let dataLoaded = { users: false, facturas: false, reparaciones: false };

function checkAllDataLoaded() {
    if (dataLoaded.users && dataLoaded.facturas && dataLoaded.reparaciones) {
        initApp(); // Iniciar app solo cuando los datos estén listos
    }
}

onSnapshot(collection(db, "users"), (snapshot) => {
    users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Si no hay usuarios en la nube, creamos los por defecto
    if (users.length === 0) {
        const defaultUsers = [
            { id: '1', username: 'saul', password: '123', role: 'admin' },
            { id: '2', username: 'nicolas', password: '123', role: 'admin' },
            { id: '3', username: 'angel', password: '123', role: 'client' },
            { id: '4', username: 'karen', password: '123', role: 'client' },
            { id: '5', username: 'yatziri', password: '123', role: 'client' },
            { id: '6', username: 'eduardo', password: '123', role: 'client' },
            { id: '7', username: 'fernanda', password: '123', role: 'client' },
            { id: '8', username: 'yamileth', password: '123', role: 'client' },
            { id: '9', username: 'eden', password: '123', role: 'client' },
            { id: '10', username: 'baka emmanuel poni 67', password: '123', role: 'client' },
            { id: '11', username: 'joshua', password: '123', role: 'client' },
            { id: '12', username: 'nestor', password: '123', role: 'client' },
            { id: '13', username: 'mayra', password: '123', role: 'client' }
        ];
        defaultUsers.forEach(u => setDoc(doc(db, "users", u.id), u));
    }

    // Si hay alguien logueado, actualizar su data (por si le cambiaron la clave)
    if (currentUser1) {
        const updated1 = users.find(u => u.id === currentUser1.id);
        if (updated1) currentUser1 = updated1;
    }
    if (currentUser2) {
        const updated2 = users.find(u => u.id === currentUser2.id);
        if (updated2) currentUser2 = updated2;
    }

    if (currentUser1) applyRolesAndUI(); // Refrescar UI si ya estaban logueados

    if (!dataLoaded.users) { dataLoaded.users = true; checkAllDataLoaded(); }
});

onSnapshot(collection(db, "facturas"), (snapshot) => {
    facturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar de más reciente a más antiguo por timestamp
    facturas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (currentUser1) {
        updateStatsFacturas();
        renderFacturas();
    }

    if (!dataLoaded.facturas) { dataLoaded.facturas = true; checkAllDataLoaded(); }
});

onSnapshot(collection(db, "reparaciones"), (snapshot) => {
    reparaciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    reparaciones.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (currentUser1) {
        updateStatsReparaciones();
        renderReparaciones();
    }

    if (!dataLoaded.reparaciones) { dataLoaded.reparaciones = true; checkAllDataLoaded(); }
});

// ==================== DOM ELEMENTS ====================
// Modals & Auth
const setupModal = document.getElementById('setupModal');
const setupStoreSelect = document.getElementById('setupStoreSelect');
const btnSaveSetup = document.getElementById('btnSaveSetup');

const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

const activeUsersBar = document.getElementById('activeUsersBar');
const activeUsersContainer = document.getElementById('activeUsersContainer');
const btnAddCoworker = document.getElementById('btnAddCoworker');
const btnLogout = document.getElementById('btnLogout');

const addCoworkerModal = document.getElementById('addCoworkerModal');
const addCoworkerForm = document.getElementById('addCoworkerForm');
const coworkerError = document.getElementById('coworkerError');
const btnCancelCoworker = document.getElementById('btnCancelCoworker');

// Generales
const headerStoreName = document.getElementById('headerStoreName');
const tabAdminBtn = document.getElementById('tabAdminBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Change Password
const btnChangePassword = document.getElementById('btnChangePassword');
const changePasswordModal = document.getElementById('changePasswordModal');
const changePasswordForm = document.getElementById('changePasswordForm');
const passwordChangeError = document.getElementById('passwordChangeError');
const btnCancelChangePassword = document.getElementById('btnCancelChangePassword');

// Forms & Inputs
const atendioFactura = document.getElementById('atendioFactura');
const atendioReparacion = document.getElementById('atendioReparacion');
const tiendaFactura = document.getElementById('tiendaFactura');
const tiendaReparacion = document.getElementById('tiendaReparacion');

// Facturas Elements
const countPendingFacturas = document.getElementById('countPendingFacturas');
const countDoneFacturas = document.getElementById('countDoneFacturas');
const countCancelledFacturas = document.getElementById('countCancelledFacturas');
const formFactura = document.getElementById('ticketFormFactura');
const containerFacturas = document.getElementById('ticketsContainerFacturas');
const btnDeleteOldFacturas = document.getElementById('btnDeleteOldFacturas');

// Reparaciones Elements
const countPendingReparaciones = document.getElementById('countPendingReparaciones');
const countDoneReparaciones = document.getElementById('countDoneReparaciones');
const countCancelledReparaciones = document.getElementById('countCancelledReparaciones');
const formReparacion = document.getElementById('ticketFormReparacion');
const containerReparaciones = document.getElementById('ticketsContainerReparaciones');
const filterReparaciones = document.getElementById('filterStatusReparaciones');
const btnClearReparaciones = document.getElementById('btnClearCompletedReparaciones');

// Admin Elements
const usersContainer = document.getElementById('usersContainer');
const btnResetStore = document.getElementById('btnResetStore');
const btnResetDB = document.getElementById('btnResetDB');
const adminCurrentStore = document.getElementById('adminCurrentStore');


// ==================== INITIALIZATION ====================
function initApp() {
    if (!currentStore) {
        setupModal.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
    }
}

btnSaveSetup.addEventListener('click', () => {
    if (setupStoreSelect.value) {
        currentStore = setupStoreSelect.value;
        DB.setStore(currentStore);
        setupModal.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    } else {
        alert("Selecciona una tienda primero.");
    }
});

// ==================== AUTH / LOGIN ====================
function findUser(username, password) {
    return users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;

    const user = findUser(u, p);
    if (user) {
        currentUser1 = user;
        loginScreen.classList.add('hidden');
        loginError.style.display = 'none';
        loginForm.reset();

        applyRolesAndUI();
    } else {
        loginError.style.display = 'block';
    }
});

btnLogout.addEventListener('click', () => {
    currentUser1 = null;
    currentUser2 = null;
    loginScreen.classList.remove('hidden');
    activeUsersBar.style.display = 'none';
});

btnAddCoworker.addEventListener('click', () => {
    addCoworkerModal.classList.remove('hidden');
});
btnCancelCoworker.addEventListener('click', () => {
    addCoworkerModal.classList.add('hidden');
    addCoworkerForm.reset();
});

addCoworkerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('coworkerUsername').value;
    const p = document.getElementById('coworkerPassword').value;

    const user = findUser(u, p);
    if (user) {
        // No permitir que el mismo inicie dos veces
        if (user.id === currentUser1.id) {
            coworkerError.textContent = "Este usuario ya inició sesión.";
            coworkerError.style.display = 'block';
            return;
        }

        currentUser2 = user;
        addCoworkerModal.classList.add('hidden');
        coworkerError.style.display = 'none';
        addCoworkerForm.reset();

        applyRolesAndUI();
    } else {
        coworkerError.textContent = "Credenciales incorrectas.";
        coworkerError.style.display = 'block';
    }
});

// ==================== CHANGE PASSWORD ====================
btnChangePassword.addEventListener('click', () => {
    changePasswordModal.classList.remove('hidden');
});

btnCancelChangePassword.addEventListener('click', () => {
    changePasswordModal.classList.add('hidden');
    changePasswordForm.reset();
    passwordChangeError.style.display = 'none';
});

changePasswordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;

    if (currentUser1.password === currentPass) {
        currentUser1.password = newPass;
        setDoc(doc(db, "users", currentUser1.id), currentUser1);

        changePasswordModal.classList.add('hidden');
        changePasswordForm.reset();
        passwordChangeError.style.display = 'none';
        alert('Contraseña actualizada correctamente.');
    } else {
        passwordChangeError.textContent = 'La contraseña actual es incorrecta.';
        passwordChangeError.style.display = 'block';
    }
});

// ==================== ROLES & UI SETUP ====================
function isAdmin() {
    return (currentUser1 && currentUser1.role === 'admin') || (currentUser2 && currentUser2.role === 'admin');
}

function applyRolesAndUI() {
    headerStoreName.textContent = `- ${currentStore}`;
    adminCurrentStore.textContent = currentStore;

    // Active Users Bar UI
    activeUsersBar.style.display = 'flex';
    activeUsersContainer.innerHTML = '';

    const chip1 = document.createElement('div');
    chip1.className = 'user-chip';
    chip1.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser1.username} ${currentUser1.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}`;
    activeUsersContainer.appendChild(chip1);

    if (currentUser2) {
        const chip2 = document.createElement('div');
        chip2.className = 'user-chip';
        // Botón para cerrar sesión de coworker
        chip2.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser2.username} ${currentUser2.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}
                           <i class="fa-solid fa-xmark" style="cursor:pointer; margin-left:0.5rem; color:#ef4444;" id="btnRemoveCoworker"></i>`;
        activeUsersContainer.appendChild(chip2);
        btnAddCoworker.style.display = 'none'; // Max 2

        document.getElementById('btnRemoveCoworker').addEventListener('click', () => {
            currentUser2 = null;
            applyRolesAndUI();
        });
    } else {
        btnAddCoworker.style.display = 'inline-flex';
    }

    // Atendio Selects Configuration
    let atendioOptions = `<option value="">Seleccione personal</option>`;
    atendioOptions += `<option value="${currentUser1.username}">${currentUser1.username}</option>`;
    if (currentUser2) {
        atendioOptions += `<option value="${currentUser2.username}">${currentUser2.username}</option>`;
    }
    atendioFactura.innerHTML = atendioOptions;
    atendioReparacion.innerHTML = atendioOptions;

    // Auto-select if only 1 user
    if (!currentUser2) {
        atendioFactura.value = currentUser1.username;
        atendioReparacion.value = currentUser1.username;
    }

    // Permissions logic
    if (isAdmin()) {
        tabAdminBtn.classList.remove('hidden');
        btnDeleteOldFacturas.style.display = 'inline-flex';
        btnClearReparaciones.style.display = 'inline-flex';

        // Desbloquear tienda en formularios
        tiendaFactura.disabled = false;
        tiendaReparacion.disabled = false;

        renderAdminUsers();
    } else {
        tabAdminBtn.classList.add('hidden');
        btnDeleteOldFacturas.style.display = 'none';
        btnClearReparaciones.style.display = 'none';

        // Bloquear y autocompletar tienda predeterminada
        tiendaFactura.value = currentStore;
        tiendaFactura.disabled = true;

        tiendaReparacion.value = currentStore;
        tiendaReparacion.disabled = true;

        // Si estaba en la pestaña admin, moverlo a facturas
        if (tabAdminBtn.classList.contains('active')) {
            document.querySelector('[data-tab="tab-facturas"]').click();
        }
    }

    updateStatsFacturas();
    updateStatsReparaciones();
    renderFacturas();
    renderReparaciones();
}


// ==================== TABS ====================
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => {
            c.classList.remove('active');
            c.style.display = ''; // Limpiar cualquier display inline que pueda dar problema
        });

        btn.classList.add('active');
        const content = document.getElementById(btn.dataset.tab);
        if (content) content.classList.add('active');
    });
});

// ==================== TICKETS LOGIC ====================
function getDisplayFacturas() {
    if (isAdmin()) return facturas;
    return facturas.filter(t => t.tienda === currentStore);
}

function getDisplayReparaciones() {
    let list = isAdmin() ? reparaciones : reparaciones.filter(t => t.tienda === currentStore);
    const filter = filterReparaciones.value;
    if (filter !== 'Todos') {
        list = list.filter(t => t.status === filter);
    }
    return list;
}

// Funciones saveFacturas y saveReparaciones eliminadas porque Firebase actualiza automáticamente
// a través de onSnapshot. Solo enviaremos los datos con setDoc.

formFactura.addEventListener('submit', (e) => {
    e.preventDefault();
    let totalCost = parseFloat(document.getElementById('costTotalFactura').value).toFixed(2);
    let newTicket = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'Factura',
        client: document.getElementById('clientNameFactura').value,
        phone: document.getElementById('clientPhone').value,
        tienda: isAdmin() ? document.getElementById('tiendaFactura').value : currentStore,
        atendio: document.getElementById('atendioFactura').value,
        totalCost: totalCost,
        advanceCost: totalCost,
        status: 'Realizado',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        completedAt: new Date().toLocaleString()
    };

    // Guardar en Firestore (la lista local se actualizará automáticamente por onSnapshot)
    setDoc(doc(db, "facturas", newTicket.id), newTicket);

    e.target.reset();
    applyRolesAndUI(); // reset selects
});

formReparacion.addEventListener('submit', (e) => {
    e.preventDefault();
    let newTicket = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'Reparación',
        client: document.getElementById('clientNameReparacion').value,
        model: document.getElementById('deviceModel').value,
        repairType: document.getElementById('repairType').value,
        tienda: isAdmin() ? document.getElementById('tiendaReparacion').value : currentStore,
        atendio: document.getElementById('atendioReparacion').value,
        totalCost: parseFloat(document.getElementById('costTotalReparacion').value).toFixed(2),
        advanceCost: parseFloat(document.getElementById('costAdvanceReparacion').value || '0').toFixed(2),
        status: 'Pendiente',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        completedAt: null
    };

    // Guardar en Firestore
    setDoc(doc(db, "reparaciones", newTicket.id), newTicket);

    e.target.reset();
    applyRolesAndUI(); // reset selects
});

window.updateTicketStatus = function (id, newStatus, type) {
    let collection = type === 'Factura' ? facturas : reparaciones;
    const ticketIndex = collection.findIndex(t => t.id === id);
    if (ticketIndex !== -1) {
        collection[ticketIndex].status = newStatus;
        if (newStatus === 'Realizado' || newStatus === 'Cancelado') {
            collection[ticketIndex].completedAt = new Date().toLocaleString();
            if (newStatus === 'Realizado') {
                collection[ticketIndex].advanceCost = collection[ticketIndex].totalCost;
            }
        } else {
            collection[ticketIndex].completedAt = null;
        }

        if (type === 'Factura') {
            setDoc(doc(db, "facturas", collection[ticketIndex].id), collection[ticketIndex]);
        } else {
            setDoc(doc(db, "reparaciones", collection[ticketIndex].id), collection[ticketIndex]);
        }
    }
}

window.deleteTicket = function (id, type) {
    if (!isAdmin()) return;
    if (confirm('¿Estás seguro de eliminar este ticket?')) {
        if (type === 'Factura') {
            deleteDoc(doc(db, "facturas", id));
        } else {
            deleteDoc(doc(db, "reparaciones", id));
        }
    }
}

filterReparaciones.addEventListener('change', renderReparaciones);

btnClearReparaciones.addEventListener('click', () => {
    if (!isAdmin()) return;
    if (confirm('¿Eliminar todos los tickets Realizados y Cancelados de Reparación?')) {
        const toDelete = reparaciones.filter(t => t.status !== 'Pendiente');
        toDelete.forEach(t => deleteDoc(doc(db, "reparaciones", t.id)));
    }
});

btnDeleteOldFacturas.addEventListener('click', () => {
    if (!isAdmin()) return;
    if (confirm('¿Eliminar las facturas de hace más de 1 mes?')) {
        const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const toDelete = facturas.filter(t => {
            if (t.timestamp) return (now - t.timestamp) > ONE_MONTH_MS;
            return false;
        });
        toDelete.forEach(t => deleteDoc(doc(db, "facturas", t.id)));
    }
});

function updateStatsFacturas() {
    const list = getDisplayFacturas();
    if (countPendingFacturas) countPendingFacturas.textContent = list.filter(t => t.status === 'Pendiente').length;
    if (countDoneFacturas) countDoneFacturas.textContent = list.filter(t => t.status === 'Realizado').length;
    if (countCancelledFacturas) countCancelledFacturas.textContent = list.filter(t => t.status === 'Cancelado').length;
}

function updateStatsReparaciones() {
    const list = getDisplayReparaciones(); // esto sin filter extra
    const allRep = isAdmin() ? reparaciones : reparaciones.filter(t => t.tienda === currentStore);
    countPendingReparaciones.textContent = allRep.filter(t => t.status === 'Pendiente').length;
    countDoneReparaciones.textContent = allRep.filter(t => t.status === 'Realizado').length;
    countCancelledReparaciones.textContent = allRep.filter(t => t.status === 'Cancelado').length;
}

function renderTicketCard(ticket) {
    let statusIcon = '';
    if (ticket.status === 'Pendiente') statusIcon = '<i class="fa-solid fa-clock"></i>';
    if (ticket.status === 'Realizado') statusIcon = '<i class="fa-solid fa-check"></i>';
    if (ticket.status === 'Cancelado') statusIcon = '<i class="fa-solid fa-xmark"></i>';

    let pendingCost = (parseFloat(ticket.totalCost) - parseFloat(ticket.advanceCost)).toFixed(2);
    let creationDate = ticket.createdAt || ticket.date;

    const adminDeleteMarkup = isAdmin() ? `<button class="btn-delete" onclick="deleteTicket('${ticket.id}', '${ticket.type}')" title="Eliminar Ticket"><i class="fa-solid fa-trash"></i></button>` : '';

    return `
        <div class="ticket-card" data-status="${ticket.status}">
            <div class="ticket-top">
                <div class="ticket-info">
                    <h3>${ticket.type} - ${ticket.client}</h3>
                    <div style="display:flex; gap:1rem; margin-top: 0.5rem; flex-wrap:wrap; font-size:0.85rem;">
                        <span style="background:var(--bg-color); padding: 0.2rem 0.5rem; border-radius:4px;"><i class="fa-solid fa-store" style="color:var(--primary-light)"></i> <strong>${ticket.tienda || 'N/A'}</strong></span>
                        <span style="background:var(--bg-color); padding: 0.2rem 0.5rem; border-radius:4px;"><i class="fa-solid fa-user-tag" style="color:var(--primary-light)"></i> <strong>${ticket.atendio || 'N/A'}</strong></span>
                    </div>
                    <div class="ticket-details">
                        ${ticket.type === 'Factura' ? `
                            <div><i class="fa-solid fa-phone" style="width:20px"></i> Teléfono: <strong>${ticket.phone}</strong></div>
                        ` : `
                            <div><i class="fa-solid fa-mobile-button" style="width:20px"></i> Modelo: <strong>${ticket.model}</strong></div>
                            <div><i class="fa-solid fa-wrench" style="width:20px"></i> Falla/Reparación: <strong>${ticket.repairType}</strong></div>
                        `}
                    </div>
                    <div class="cobro-badge">
                        <div>Total: <strong>$${ticket.totalCost}</strong> &bull; Anticipo: <strong>$${ticket.advanceCost}</strong></div>
                        ${parseFloat(pendingCost) > 0 ? `<div style="margin-top: 0.25rem; font-size:0.8rem; color:#ef4444;">Por cobrar: $${pendingCost}</div>` : `<div style="margin-top: 0.25rem; font-size:0.8rem; color:#10b981;">Totalmente pagado</div>`}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="ticket-badge-status">${statusIcon} ${ticket.status}</div>
                </div>
            </div>
            
            <div class="ticket-bottom" style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div class="ticket-date-area">
                    <div class="ticket-date"><i class="fa-regular fa-calendar-plus"></i> Creado: <strong>${creationDate}</strong></div>
                    ${ticket.completedAt ? `<div class="ticket-date" style="margin-top:0.25rem; color: ${ticket.status === 'Realizado' ? 'var(--status-done)' : 'var(--status-cancelled)'}"><i class="fa-solid fa-flag-checkered"></i> Concluido: <strong>${ticket.completedAt}</strong></div>` : ''}
                </div>
                <div class="ticket-actions">
                    <button class="btn-status" onclick="printTicket('${ticket.id}', '${ticket.type}')" title="Imprimir Ticket"><i class="fa-solid fa-print" style="color:#475569"></i></button>
                    ${ticket.status !== 'Realizado' ? `<button class="btn-status" onclick="updateTicketStatus('${ticket.id}', 'Realizado', '${ticket.type}')" title="Marcar como Realizado"><i class="fa-solid fa-check" style="color:var(--status-done)"></i></button>` : ''}
                    ${ticket.status !== 'Cancelado' ? `<button class="btn-status" onclick="updateTicketStatus('${ticket.id}', 'Cancelado', '${ticket.type}')" title="Marcar como Cancelado"><i class="fa-solid fa-xmark" style="color:var(--status-cancelled)"></i></button>` : ''}
                    ${(ticket.status !== 'Pendiente' && ticket.type !== 'Factura') ? `<button class="btn-status" onclick="updateTicketStatus('${ticket.id}', 'Pendiente', '${ticket.type}')" title="Mover a Pendiente"><i class="fa-solid fa-clock" style="color:var(--status-pending)"></i></button>` : ''}
                    ${adminDeleteMarkup}
                </div>
            </div>
        </div>
    `;
}

function renderFacturas() {
    const list = getDisplayFacturas();
    if (list.length === 0) {
        containerFacturas.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No hay facturas para mostrar.</p></div>`;
        return;
    }
    containerFacturas.innerHTML = list.map(renderTicketCard).join('');
}

function renderReparaciones() {
    const list = getDisplayReparaciones();
    if (list.length === 0) {
        containerReparaciones.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No hay reparaciones para mostrar.</p></div>`;
        return;
    }
    containerReparaciones.innerHTML = list.map(renderTicketCard).join('');
}

// ==================== ADMIN PANEL LOGIC ====================
function saveUsers() {
    // Ya no se usa localmente. Se envía directo a Firebase con setDoc.
}

function renderAdminUsers() {
    usersContainer.innerHTML = '';
    users.forEach(u => {
        const isSelf = (currentUser1 && currentUser1.id === u.id) || (currentUser2 && currentUser2.id === u.id);
        usersContainer.innerHTML += `
            <div class="user-list-item">
                <div>
                    <h3 style="font-size:1rem;">${u.username} ${u.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}</h3>
                    <div style="font-size:0.8rem; color:#666; font-family:monospace;">Pass: ${u.password}</div>
                </div>
                <div>
                    <button class="btn btn-outline" style="color:#666; border-color:#ccc; padding:0.4rem 0.6rem; font-size:0.85rem;" onclick="promptResetPassword('${u.id}')">Cambiar Clave</button>
                    ${!isSelf ? `<button class="btn btn-delete" style="padding:0.4rem 0.6rem; font-size:0.85rem;" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    });
    // Add new user btn
    usersContainer.innerHTML += `
        <div style="margin-top:1rem;">
            <button class="btn btn-outline" style="color:var(--primary-dark); border-color:var(--primary-dark); padding:0.4rem 0.8rem;" onclick="promptNewUser()">+ Añadir Empleado</button>
        </div>
    `;
}

window.promptResetPassword = function (id) {
    const newPass = prompt("Ingresa la nueva contraseña:");
    if (newPass) {
        let userIdx = users.findIndex(u => u.id === id);
        if (userIdx > -1) {
            users[userIdx].password = newPass;
            setDoc(doc(db, "users", id), users[userIdx]);
            alert("Contraseña actualizada. Los cambios se reflejarán en breve.");
        }
    }
}
window.promptNewUser = function () {
    const username = prompt("Nombre del empleado:");
    if (!username) return;
    const password = prompt("Contraseña temporal (ej: 123):");
    if (!password) return;
    const newUser = { id: Date.now().toString(), username, password, role: 'client' };
    setDoc(doc(db, "users", newUser.id), newUser);
}
window.deleteUser = function (id) {
    if (confirm("¿Eliminar usuario?")) {
        deleteDoc(doc(db, "users", id));
    }
}

btnResetStore.addEventListener('click', () => {
    if (confirm("ESTO BORRARÁ LA TIENDA DE ESTE EQUIPO.\nLa computadora se reiniciará a la configuración inicial y requerirá volver a seleccionar a qué tienda pertenece.\n¿Continuar?")) {
        DB.removeStore();
        location.reload();
    }
});

btnResetDB.addEventListener('click', () => {
    if (prompt("Escribe CONFIRMAR para borrar todos los tickets.") === "CONFIRMAR") {
        DB.clearTickets();
        location.reload();
    }
});

// ==================== PHONE VALIDATION ====================
const clientPhoneFacturaInput = document.getElementById('clientPhone');
if (clientPhoneFacturaInput) {
    clientPhoneFacturaInput.addEventListener('input', function (e) {
        let value = this.value.replace(/[^0-9\s]/g, '');
        let numCount = 0;
        let limitIndex = value.length;
        for (let i = 0; i < value.length; i++) {
            if (/[0-9]/.test(value[i])) { numCount++; if (numCount === 10) { limitIndex = i + 1; break; } }
        }
        if (numCount >= 10) value = value.substring(0, limitIndex);
        this.value = value;
    });
}

// ==================== IMPRESIÓN ====================
window.printTicket = function (id, type) {
    let collection = type === 'Factura' ? facturas : reparaciones;
    const ticket = collection.find(t => t.id === id);
    if (!ticket) return;

    let pendingCost = (parseFloat(ticket.totalCost) - parseFloat(ticket.advanceCost)).toFixed(2);
    let receiptHTML = `
    <html>
    <head>
        <title>Ticket ${ticket.id}</title>
        <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; color: #000; background: #fff; font-size: 14px; padding: 10px; box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 10px; }
            .header h1 { font-size: 18px; margin: 0; font-weight: bold;}
            .header p { margin: 2px 0; font-size: 12px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .flex-row { display: flex; justify-content: space-between; margin-bottom: 5px;}
            .item { text-align: left; margin-bottom: 5px; word-wrap: break-word;}
            .total { font-weight: bold; font-size: 16px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px;}
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 200);">
        <div class="header">
            <h1>REALPHONE</h1>
            <p>by Telcel</p>
            <p>Sucursal: ${ticket.tienda || 'N/A'}</p>
            <p style="font-size: 10px;">${ticket.tienda ? (STORE_ADDRESSES[ticket.tienda] || '') : ''}</p>
            <p>Ticket de ${ticket.type.toUpperCase()}</p>
            <p>Fecha: ${ticket.createdAt || ticket.date}</p>
        </div>
        <div class="divider"></div>
        <div class="item"><strong>Cliente:</strong> ${ticket.client}</div>
        ${ticket.type === 'Factura' ? `<div class="item"><strong>Teléfono:</strong> ${ticket.phone}</div>` : ''}
        ${ticket.type === 'Reparación' ? `
            <div class="item"><strong>Modelo:</strong> ${ticket.model}</div>
            <div class="item"><strong>Detalle:</strong> ${ticket.repairType}</div>
        ` : ''}
        <div class="item"><strong>Atendió:</strong> ${ticket.atendio || 'N/A'}</div>
        <div class="item"><strong>Estado:</strong> ${ticket.status}</div>
        <div class="divider"></div>
        <div class="flex-row"><span>Costo Total:</span> <span>$${ticket.totalCost}</span></div>
        <div class="flex-row"><span>Anticipo:</span> <span>$${ticket.advanceCost}</span></div>
        <div class="flex-row total"><span>Restante:</span> <span>$${parseFloat(pendingCost) > 0 ? pendingCost : '0.00'}</span></div>
        <div class="footer"><p>*** Gracias por su preferencia ***</p></div>
    </body>
    </html>`;

    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute'; printIframe.style.width = '0'; printIframe.style.height = '0'; printIframe.style.border = 'none';
    document.body.appendChild(printIframe);
    printIframe.contentDocument.open(); printIframe.contentDocument.write(receiptHTML); printIframe.contentDocument.close();
    setTimeout(() => { if (document.body.contains(printIframe)) document.body.removeChild(printIframe); }, 3000);
};

// INITIAL CALL eliminado de aquí. Se llama ahora desde checkAllDataLoaded()
// initApp();
