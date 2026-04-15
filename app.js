const STORAGE_FACTURAS = 'realphone_facturas';
const STORAGE_REPARACIONES = 'realphone_reparaciones';

// Migración inicial (opcional): si existe 'realphone_tickets', podemos separarlos
let legacyTickets = JSON.parse(localStorage.getItem('realphone_tickets'));
if (legacyTickets && legacyTickets.length > 0) {
    let factLegacy = legacyTickets.filter(t => t.type === 'Factura');
    let repLegacy = legacyTickets.filter(t => t.type === 'Reparación');
    
    // Guardar en las nuevas llaves si no existen
    if (!localStorage.getItem(STORAGE_FACTURAS)) localStorage.setItem(STORAGE_FACTURAS, JSON.stringify(factLegacy));
    if (!localStorage.getItem(STORAGE_REPARACIONES)) localStorage.setItem(STORAGE_REPARACIONES, JSON.stringify(repLegacy));
    
    // Eliminar llave vieja
    localStorage.removeItem('realphone_tickets');
}

let facturas = JSON.parse(localStorage.getItem(STORAGE_FACTURAS)) || [];
let reparaciones = JSON.parse(localStorage.getItem(STORAGE_REPARACIONES)) || [];

// DOM Elements - Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// DOM Elements - Facturas
const countPendingFacturas = document.getElementById('countPendingFacturas');
const countDoneFacturas = document.getElementById('countDoneFacturas');
const countCancelledFacturas = document.getElementById('countCancelledFacturas');
const formFactura = document.getElementById('ticketFormFactura');
const containerFacturas = document.getElementById('ticketsContainerFacturas');
const btnDeleteOldFacturas = document.getElementById('btnDeleteOldFacturas');

// DOM Elements - Reparaciones
const countPendingReparaciones = document.getElementById('countPendingReparaciones');
const countDoneReparaciones = document.getElementById('countDoneReparaciones');
const countCancelledReparaciones = document.getElementById('countCancelledReparaciones');
const formReparacion = document.getElementById('ticketFormReparacion');
const containerReparaciones = document.getElementById('ticketsContainerReparaciones');
const filterReparaciones = document.getElementById('filterStatusReparaciones');
const btnClearReparaciones = document.getElementById('btnClearCompletedReparaciones');

// Events - Tabs
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.style.display = 'none');
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).style.display = 'block';
    });
});

// Events - Facturas
formFactura.addEventListener('submit', handleCreateFactura);
btnDeleteOldFacturas.addEventListener('click', deleteOldFacturas);

// Events - Reparaciones
formReparacion.addEventListener('submit', handleCreateReparacion);
filterReparaciones.addEventListener('change', renderReparaciones);
btnClearReparaciones.addEventListener('click', () => clearCompleted('Reparación'));

function saveFacturas() {
    localStorage.setItem(STORAGE_FACTURAS, JSON.stringify(facturas));
    updateStatsFacturas();
}

function saveReparaciones() {
    localStorage.setItem(STORAGE_REPARACIONES, JSON.stringify(reparaciones));
    updateStatsReparaciones();
}

function handleCreateFactura(e) {
    e.preventDefault();
    
    let totalCost = parseFloat(document.getElementById('costTotalFactura').value).toFixed(2);
    let newTicket = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'Factura',
        client: document.getElementById('clientNameFactura').value,
        phone: document.getElementById('clientPhone').value,
        tienda: document.getElementById('tiendaFactura').value,
        atendio: document.getElementById('atendioFactura').value,
        totalCost: totalCost,
        advanceCost: totalCost, // El anticipo es igual al costo total porque se pagan de inmediato
        status: 'Realizado',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        completedAt: new Date().toLocaleString()
    };

    facturas.unshift(newTicket);
    saveFacturas();
    
    e.target.reset();
    renderFacturas();
}

function handleCreateReparacion(e) {
    e.preventDefault();
    
    let newTicket = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'Reparación',
        client: document.getElementById('clientNameReparacion').value,
        model: document.getElementById('deviceModel').value,
        repairType: document.getElementById('repairType').value,
        tienda: document.getElementById('tiendaReparacion').value,
        atendio: document.getElementById('atendioReparacion').value,
        totalCost: parseFloat(document.getElementById('costTotalReparacion').value).toFixed(2),
        advanceCost: parseFloat(document.getElementById('costAdvanceReparacion').value || '0').toFixed(2),
        status: 'Pendiente',
        createdAt: new Date().toLocaleString(),
        timestamp: Date.now(),
        completedAt: null
    };

    reparaciones.unshift(newTicket);
    saveReparaciones();
    
    e.target.reset();
    renderReparaciones();
}

function updateTicketStatus(id, newStatus, type) {
    let collection = type === 'Factura' ? facturas : reparaciones;
    const ticketIndex = collection.findIndex(t => t.id === id);
    if (ticketIndex !== -1) {
        collection[ticketIndex].status = newStatus;
        if (newStatus === 'Realizado' || newStatus === 'Cancelado') {
            collection[ticketIndex].completedAt = new Date().toLocaleString();
            if (newStatus === 'Realizado') {
                collection[ticketIndex].advanceCost = collection[ticketIndex].totalCost; // Auto liquidar deuda
            }
        } else {
            collection[ticketIndex].completedAt = null;
        }
        
        if (type === 'Factura') {
            saveFacturas();
            renderFacturas();
        } else {
            saveReparaciones();
            renderReparaciones();
        }
    }
}

function deleteTicket(id, type) {
    if (confirm('¿Estás seguro de eliminar este ticket? Esta acción no se puede deshacer.')) {
        if (type === 'Factura') {
            facturas = facturas.filter(t => t.id !== id);
            saveFacturas();
            renderFacturas();
        } else {
            reparaciones = reparaciones.filter(t => t.id !== id);
            saveReparaciones();
            renderReparaciones();
        }
    }
}

function clearCompleted(type) {
    if (confirm(`¿Deseas eliminar todos los tickets Realizados y Cancelados de la sección ${type}?`)) {
        if (type === 'Factura') {
            facturas = facturas.filter(t => t.status === 'Pendiente');
            saveFacturas();
            renderFacturas();
        } else {
            reparaciones = reparaciones.filter(t => t.status === 'Pendiente');
            saveReparaciones();
            renderReparaciones();
        }
    }
}

function deleteOldFacturas() {
    if (confirm('¿Estás seguro de que deseas eliminar todas las facturas que lleven más de 1 mes desde su creación?')) {
        const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        let beforeCount = facturas.length;
        facturas = facturas.filter(t => {
            // Si tiene timestamp, usamos eso
            if (t.timestamp) {
                return (now - t.timestamp) <= ONE_MONTH_MS;
            }
            // Fallback en caso de migración y el timestamp no exista
            if (t.date) {
                // el date original venía de toLocaleString() el cual a veces es difícil de parsear en todos los navegadores
                // asumiendo que es reciente, lo guardamos si falla el parseo
                let parsed = Date.parse(t.date);
                if (!isNaN(parsed)) {
                    return (now - parsed) <= ONE_MONTH_MS;
                }
            }
            // Si por alguna razón no se puede calcular, la conservamos por seguridad
            return true;
        });

        let removed = beforeCount - facturas.length;
        saveFacturas();
        renderFacturas();
        alert(`Operación completada. Se eliminaron ${removed} facturas antiguas.`);
    }
}

function updateStatsFacturas() {
    if (countPendingFacturas) countPendingFacturas.textContent = facturas.filter(t => t.status === 'Pendiente').length;
    if (countDoneFacturas) countDoneFacturas.textContent = facturas.filter(t => t.status === 'Realizado').length;
    if (countCancelledFacturas) countCancelledFacturas.textContent = facturas.filter(t => t.status === 'Cancelado').length;
}

function updateStatsReparaciones() {
    countPendingReparaciones.textContent = reparaciones.filter(t => t.status === 'Pendiente').length;
    countDoneReparaciones.textContent = reparaciones.filter(t => t.status === 'Realizado').length;
    countCancelledReparaciones.textContent = reparaciones.filter(t => t.status === 'Cancelado').length;
}

function renderTicketCard(ticket) {
    let statusIcon = '';
    if(ticket.status === 'Pendiente') statusIcon = '<i class="fa-solid fa-clock"></i>';
    if(ticket.status === 'Realizado') statusIcon = '<i class="fa-solid fa-check"></i>';
    if(ticket.status === 'Cancelado') statusIcon = '<i class="fa-solid fa-xmark"></i>';

    let pendingCost = (parseFloat(ticket.totalCost) - parseFloat(ticket.advanceCost)).toFixed(2);
    
    // Retrocompatibilidad con la prop "date" de los tickets existentes
    let creationDate = ticket.createdAt || ticket.date;
    
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
                    <button class="btn-delete" onclick="deleteTicket('${ticket.id}', '${ticket.type}')" title="Eliminar Ticket"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

function renderFacturas() {
    const filtered = facturas; // Mostrar todas de forma general
        
    if (filtered.length === 0) {
        containerFacturas.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>No hay facturas para mostrar.</p>
            </div>
        `;
        return;
    }
    
    containerFacturas.innerHTML = filtered.map(renderTicketCard).join('');
}

function renderReparaciones() {
    const filter = filterReparaciones.value;
    const filtered = filter === 'Todos' ? reparaciones : reparaciones.filter(t => t.status === filter);
        
    if (filtered.length === 0) {
        containerReparaciones.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>No hay reparaciones para mostrar.</p>
            </div>
        `;
        return;
    }
    
    containerReparaciones.innerHTML = filtered.map(renderTicketCard).join('');
}

// Initial render
updateStatsFacturas();
updateStatsReparaciones();
renderFacturas();
renderReparaciones();

// Validación de Teléfono (Máximo 10 dígitos, sin letras)
const clientPhoneFacturaInput = document.getElementById('clientPhone');
if (clientPhoneFacturaInput) {
    clientPhoneFacturaInput.addEventListener('input', function(e) {
        // Eliminar cualquier caracter que no sea número o espacio
        let value = this.value.replace(/[^0-9\s]/g, '');
        
        let numCount = 0;
        let limitIndex = value.length;
        
        for (let i = 0; i < value.length; i++) {
            if (/[0-9]/.test(value[i])) {
                numCount++;
                if (numCount === 10) {
                    // Si ya llegamos a 10 dígitos, todo lo que esté después (hasta el siguiente espacio o lo que sea) se corta
                    limitIndex = i + 1;
                    break;
                }
            }
        }
        
        if (numCount >= 10) {
            value = value.substring(0, limitIndex);
        }
        
        this.value = value;
    });
}

// Impresión de ticket en modo POS / Blanco y negro (80mm)
window.printTicket = function(id, type) {
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
            <p>Ticket de ${ticket.type.toUpperCase()}</p>
            <p>Fecha: ${ticket.createdAt}</p>
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
        
        <div class="footer">
            <p>*** Gracias por su preferencia ***</p>
        </div>
    </body>
    </html>
    `;

    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);
    
    printIframe.contentDocument.open();
    printIframe.contentDocument.write(receiptHTML);
    printIframe.contentDocument.close();

    const clearIframe = () => {
        if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
        }
    };
    
    // Fallback cleanup
    setTimeout(clearIframe, 3000);
};
