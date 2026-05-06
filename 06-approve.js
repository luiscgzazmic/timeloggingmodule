// ===== TIMELOGS — APPROVAL =====

function tlBindApproveHandlers() {
    document.querySelectorAll('.tl-btn-approve').forEach((btn) => {
        btn.addEventListener('click', () => tlOnApproveClick(btn.dataset.key));
    });
}

async function tlOnApproveClick(key) {
    const group = TL.grouped.find((g) => g.key === key);
    if (!group || !group.pendingLogs.length) return;

    if (group.hours < 8) {
        const ok = await tlConfirm(
            'Aprobar día incompleto',
            `${group.ownerName} solo registró ${tlFormatHours(group.hours)} (menos de 8h) el ${tlFormatDate(group.date)}. ¿Aprobar de todos modos?`
        );
        if (!ok) return;
    }

    const total = group.pendingLogs.length;
    const progressToast = tlToast(`Aprobando 0/${total}...`, 'info', 99999);

    let done = 0;
    const errors = [];
    const results = await tlPool(group.pendingLogs, TL_APPROVE_CONCURRENCY, async (log) => {
        try {
            await tlApproveLog(log.projectId, log.id, log.kind);
            log.approvalStatus = 'Approved';
            return true;
        } finally {
            done++;
            progressToast.textContent = `Aprobando ${done}/${total}...`;
        }
    });

    progressToast.remove();

    results.forEach((r, i) => {
        if (!r.ok) errors.push({
            log: group.pendingLogs[i],
            error: r.error
        });
    });

    // Re-aggregate from rawLogs (which were mutated via reference)
    TL.grouped = tlAggregate(TL.rawLogs);
    tlRender();

    if (errors.length === 0) {
        tlToast(`✓ ${total} log${total === 1 ? '' : 's'} aprobado${total === 1 ? '' : 's'} para ${group.ownerName}`, 'success');
    } else if (errors.length < total) {
        tlToast(`Aprobados ${total - errors.length}/${total}. ${errors.length} fallaron (ver consola).`, 'warning', 6000);
        console.warn('[TL] Errores de aprobación:', errors);
    } else {
        const sample = errors[0].error;
        tlToast(`Error al aprobar: ${sample.message || 'sin detalle'}`, 'error', 6000);
        console.error('[TL] Falla aprobación:', errors);
    }
}
