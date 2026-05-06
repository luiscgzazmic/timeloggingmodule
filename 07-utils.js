/**
 * Convierte formato "HH:mm" a decimal (ej: "01:30" -> 1.5)
 */
function tlTimeToDecimal(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs + (mins / 60);
}

function tlFlattenProjectLogs(projectId, projectName, raw) {
    // Si 'raw' es un string (porque Zoho lo envía doblemente codificado), lo parseamos
    let data = raw;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { return []; }
    }
    
    if (!Array.isArray(data)) return [];
    
    const flat = [];
    data.forEach(userReport => {
        const userName = userReport.name || 'Unknown';
        const userId = userReport.id || userReport.zuid || '0';
        
        // Entramos a la estructura: log_hours -> consolidated_report
        const dayEntries = userReport.log_hours?.consolidated_report || [];
        
        dayEntries.forEach(entry => {
            flat.push({
                // NOTA: Los reportes NO traen ID de log individual. 
                // Usamos un ID sintético para la tabla.
                id: `rep-${userId}-${entry.date}`, 
                projectId: projectId,
                projectName: projectName,
                user: userName,
                userId: userId,
                date: entry.date,
                hours: tlTimeToDecimal(entry.total), // <--- Conversión de HH:mm
                status: 'Pending', // El reporte consolidado no indica status por día
                kind: 'general'
            });
        });
    });
    
    return flat;
}
