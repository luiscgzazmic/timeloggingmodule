/**
 * TIMELOGS — API WRAPPER (V3 Optimized)
 */

async function tlRequest(url, options = {}) {
    const details = {
        type: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' }
    };

    return new Promise((resolve, reject) => {
        if (typeof zohoprojects === 'undefined') return reject('Zoho SDK missing');
        
        zohoprojects.request(url, details, TL_CONNECTION).then((response) => {
            let data = response;
            
            // 1. Extraer 'result' si el SDK lo envuelve (Primer nivel)
            if (data && typeof data === 'object' && 'result' in data) {
                data = data.result;
            }
            
            // 2. RECOMENDACIÓN: Parseo de String robusto
            // Zoho V3 a veces devuelve el JSON stringificado dentro del campo 'result'
            if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                try { 
                    data = JSON.parse(data); 
                } catch (e) {
                    console.warn("[TL] Falló el parseo de data string, se mantiene como texto.");
                }
            }
            
            // 3. Segunda validación: si tras parsear el string volvió a quedar un objeto con 'result'
            if (data && typeof data === 'object' && 'result' in data) {
                data = data.result;
                if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                    try { data = JSON.parse(data); } catch (e) {}
                }
            }

            resolve(data);
        }).catch(reject);
    });
}

/**
 * Obtiene la lista de proyectos activos del portal
 */
async function tlListProjects() {
    const all = [];
    let index = 1;
    const range = 100; 

    // Bucle para iterar por todos los proyectos (hasta 5000 proyectos máximo)
    for (let i = 0; i < 50; i++) { 
        const url = `${TL_API_BASE}/api/v3/portal/${TL.portalId}/projects?status=active&index=${index}&range=${range}`;
        const data = await tlRequest(url);
        
        const items = Array.isArray(data) ? data : (data?.projects || []);
        if (!items || items.length === 0) break;
        
        all.push(...items);
        if (items.length < range) break; 
        
        index += range;
    }
    return all;
}

/**
 * Obtiene los reportes de tiempo por proyecto (Evita el error de "module missing")
 */
async function tlListLogsForProject(projectId) {
    const [year, month] = TL.selectedDate.split('-');
    const startDate = `${year}-${month}-01`;

    // Usamos el endpoint de REPORT para obtener datos consolidados (Task + Bug + General)
    // El parámetro report_type=user es clave para la estructura que recibes.
    const url = `${TL_API_BASE}/api/v3/portal/${TL.portalId}/projects/${projectId}/timesheet/report` + 
                `?report_type=user` + 
                `&view_type=month` + 
                `&start_date=${startDate}`;
    
    try {
        const data = await tlRequest(url);
        // Basado en tu captura, los datos vienen directamente como el array parseado o en .reports
        return data?.reports || data || [];
    } catch (e) {
        console.error(`[TL] Error fetching report for project ${projectId}:`, e);
        return [];
    }
}

/**
 * Aprueba un log individual
 * NOTA: Los reportes consolidados no suelen traer el ID del log. 
 * Para usar esto, necesitarás IDs reales obtenidos por el endpoint de lista.
 */
async function tlApproveLog(projectId, logId, kind) {
    const segment = kind === 'tasklog' ? 'tasklogs' : kind === 'buglog' ? 'buglogs' : 'general';
    const url = `${TL_API_BASE}/api/v3/portal/${TL.portalId}/projects/${projectId}/logs/${segment}/${logId}/approve`;
    return await tlRequest(url, { method: 'POST' });
}
