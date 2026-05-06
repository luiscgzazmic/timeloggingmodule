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
            'Approve incomplete day',
            `${group.ownerName} only logged ${tlFormatHours(group.hours)} (less than 8h) on ${tlFormatDate(group.date)}. Approve anyway?`
        );
        if (!ok) return;
    }

    const total = group.pendingLogs.length;
    const progressToast = tlToast(`Approving 0/${total}...`, 'info', 99999);

    let done = 0;
    const errors = [];
    const results = await tlPool(group.pendingLogs, TL_APPROVE_CONCURRENCY, async (log) => {
        try {
            await tlApproveLog(log.projectId, log.id, log.kind);
            log.approvalStatus = 'Approved';
            return true;
        } finally {
            done++;
            progressToast.textContent = `Approving ${done}/${total}...`;
        }
    });

    progressToast.remove();

    results.forEach((r, i) => {
        if (!r.ok) errors.push({
            log: group.pendingLogs[i],
            error: r.error
        });
    });

    // Re-aggregate from rawLogs (mutated by reference)
    TL.grouped = tlAggregate(TL.rawLogs);
    tlRender();

    if (errors.length === 0) {
        tlToast(`✓ ${total} log${total === 1 ? '' : 's'} approved for ${group.ownerName}`, 'success');
    } else if (errors.length < total) {
        tlToast(`Approved ${total - errors.length}/${total}. ${errors.length} failed (see console).`, 'warning', 6000);
        console.warn('[TL] Approval errors:', errors);
    } else {
        const sample = errors[0].error;
        tlToast(`Approval error: ${sample.message || 'no detail'}`, 'error', 6000);
        console.error('[TL] Approval failure:', errors);
    }
}
