function tlRender() {
    const feed = document.getElementById('tl-feed');
    if (!feed) return;

    if (TL.grouped.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◷</div>
                <p>No hay registros pendientes</p>
                <small>No se encontraron timesheets para procesar en este lote.</small>
            </div>`;
        return;
    }

    feed.innerHTML = TL.grouped.map(g => {
        const projectTags = Array.from(g.projects)
            .map(p => `<span class="project-tag" title="${p}">${p}</span>`)
            .join('');

        const isApproved = g.status !== 'Pending';
        const statusClass = isApproved ? 'status-pill approved' : 'status-pill';
        const statusLabel = isApproved ? 'Aprobado' : 'Pendiente';

        return `
            <div class="audit-card">
                <div class="user-info">
                    <span class="name">${g.user}</span>
                    <span class="date">${tlFormatFriendlyDate(g.date)}</span>
                </div>

                <div class="hours-info">
                    <div class="hours-badge">${g.totalHours.toFixed(2)}<small>h</small></div>
                    <span class="${statusClass}">${statusLabel}</span>
                </div>

                <div class="project-list">
                    ${projectTags}
                </div>

                <div class="actions" style="text-align: right;">
                    ${!isApproved ?
                        `<button class="btn-approve" onclick="tlApproveGroup('${g.userId}', '${g.date}')">Approve day</button>` :
                        `<span class="approved-label">Approved</span>`}
                </div>
            </div>
        `;
    }).join('');
}

// Función auxiliar para que la fecha se vea mejor (Ej: 30 de abril)
function tlFormatFriendlyDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}
