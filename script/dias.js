// --- MÓDULO COMÚN DE DÍAS DE SERVICIO ---
const RUTA_DATOS = 'datos';

function esFeriado(fecha) {
    const ano = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate(); // <-- Esta es la línea que faltaba
    
    const fechaClave = `${dia}/${mes}`;

    const feriadosFijos = [
        "1/1", "24/3", "2/4", "1/5", "25/5", "20/6", "9/7",
        "17/8", "25/8", "24/9", "12/10", "20/11", "1/12", "8/12", "25/12"
    ];

    if (feriadosFijos.includes(fechaClave)) return true;

    const feriadosVariables = {
        2026: ["2/3", "3/3", "23/3", "2/4", "3/4", "7/12"]
    };

    return !!(feriadosVariables[ano] && feriadosVariables[ano].includes(fechaClave));
}

function resolverDiaDeServicio(fecha = new Date()) {
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const numeroDia = fecha.getDay();
    const feriado = esFeriado(fecha);

    if (feriado) {
        return { tipo: "Domingos", etiqueta: "Feriado (horarios de domingo)", feriado: true, estudianteActiva: false };
    }
    if (numeroDia === 0) {
        return { tipo: "Domingos", etiqueta: "Domingo", feriado: false, estudianteActiva: false };
    }
    if (numeroDia === 6) {
        return { tipo: "Sábados", etiqueta: "Sábado", feriado: false, estudianteActiva: false };
    }
    return { tipo: "Lunes a Viernes", etiqueta: diasSemana[numeroDia], feriado: false, estudianteActiva: true };
}

const CACHE_DATOS_LINEA = new Map();

// Carga el JSON unificado de horarios/coordenadas de la línea y el de sus paradas secundarias
async function cargarDatosLineaCompleta(idLinea, fecha = new Date()) {
    const dia = resolverDiaDeServicio(fecha);
    
    const fechaClave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
    const entradaCache = CACHE_DATOS_LINEA.get(idLinea);
    if (entradaCache && entradaCache.fechaClave === fechaClave) {
        return entradaCache.datos;
    }

    // Carga de archivo de horarios y trazado base
    const resLinea = await fetch(`${RUTA_DATOS}/${idLinea}_horarios.json`);
    if (!resLinea.ok) throw new Error(`Error al cargar datos de línea: ${idLinea}`);
    const dataLinea = await resLinea.json();

    // Carga de paradas secundarias
    let paradasSecundarias = [];
    try {
        const resSecundarias = await fetch(`${RUTA_DATOS}/coordenadas/paradas_secundarias_${idLinea}.json`);
        if (resSecundarias.ok) {
            const dataSec = await resSecundarias.json();
            paradasSecundarias = dataSec.paradas || dataSec;
        }
    } catch (e) {
        console.warn(`No se encontraron paradas secundarias para ${idLinea}`);
    }

    dataLinea.servicioHoy = {
        tipo: dia.tipo,
        etiqueta: dia.etiqueta,
        feriado: dia.feriado
    };

    dataLinea.estadoEstudianteHoy = dia.estudianteActiva
        ? { activa: true, razon: "es un día de semana hábil" }
        : { activa: false, razon: dia.feriado ? "hoy es día feriado" : "es fin de semana" };

    dataLinea.paradasSecundarias = paradasSecundarias;

    CACHE_DATOS_LINEA.set(idLinea, { fechaClave, datos: dataLinea });

    return dataLinea;
}

