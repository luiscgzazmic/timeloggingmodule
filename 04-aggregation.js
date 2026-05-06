function tlAggregate(logs) {
    const map = {};
    logs.forEach(l => {
        const key = `${l.userId}-${l.date}`;
        if (!map[key]) {
            map[key] = {
                user: l.user,
                userId: l.userId,
                date: l.date,
                totalHours: 0,
                status: 'Approved',
                projects: new Set(),
                items: []
            };
        }
        map[key].totalHours += parseFloat(l.hours || 0);
        map[key].projects.add(l.projectName);
        map[key].items.push(l);
        if (l.status !== 'Approved') map[key].status = 'Pending';
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}
