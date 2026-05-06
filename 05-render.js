function tlRender() {
    const feed = document.getElementById('tl-feed');
    if (!feed) return;

    if (TL.grouped.length === 0) {
        feed.innerHTML = `
            <div style="text-align:center; padding: 60px; color: #888;">
                <p>No hay registros pendientes para procesar en este lote.</p>
            </div>`;
        return;
    }

    feed.innerHTML = TL.grouped.map(g => {
        // Convertimos el Set de proyectos en tags individuales
        const projectTags = Array.from(g.projects)
            .map(p => `<span class="project-tag" title="${p}">${p}</span>`)
            .join('');

        return `
            <div class="audit-card">
                <div class="user-info">
                    <span class="name">${g.user}</span>
                    <span class="date">${tlFormatFriendlyDate(g.date)}</span>
                </div>
                
                <div class="hours-info">
                    <div class="hours-badge">${g.totalHours.toFixed(2)}<small>h</small></div>
                    <span class="status-pill">${g.status}</span>
                </div>

                <div class="project-list">
                    ${projectTags}
                </div>

                <div class="actions" style="text-align: right;">
                    ${g.status === 'Pending' ? 
                        `<button class="btn-approve" onclick="tlApproveGroup('${g.userId}', '${g.date}')">APPROVE DAY</button>` : 
                        `<span style="color: #24a148; font-weight:bold;">✓ APPROVED</span>`}
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
