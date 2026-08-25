// ========================================
// DESAFÍO DE BÉISBOL
// script.js
// ========================================
const SUPABASE_URL = "https://cfwoxlodxknmlqpkbbyj.supabase.co";
const SUPABASE_KEY = "  sb_publishable_w56FRNn5u01uDjRsmajPJw_tsjxOToy";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Datos iniciales
let equipo = JSON.parse(localStorage.getItem("equipo")) || [];
let grupos = JSON.parse(localStorage.getItem("grupos")) || [];

// ----------------------------------------
// PUNTUACIÓN DEL DESAFÍO
// ----------------------------------------

const puntuacion = {
  hit: 1,
  doble: 2,
  triple: 3,
  homerun: 4,
  carreraImpulsada: 1,
  carreraAnotada: 1,
  baseRobada: 1,

  inningLanzado: 3,
  ponche: 1,
  victoria: 5,
  basePorBola: -1,
  carreraPermitida: -3
};

// ----------------------------------------
// GUARDAR DATOS
// ----------------------------------------

function guardarDatos() {
  localStorage.setItem("equipo", JSON.stringify(equipo));
  localStorage.setItem("grupos", JSON.stringify(grupos));
}

// ----------------------------------------
// SELECCIONAR JUGADORES
// ----------------------------------------
function seleccionarJugadores() {
  const contenedor = document.getElementById("equipo");


  const selectorAnterior = contenedor.querySelector(".selector-posiciones");
  
  if (selectorAnterior) {
    selectorAnterior.remove();
  }
  

  contenedor.insertAdjacentHTML("afterbegin", `
    <div class="selector-posiciones">
      <h3>Selecciona una posición</h3>

      <div class="posiciones-grid">
        <button onclick="cargarPosicion('C')">C</button>
        <button onclick="cargarPosicion('1B')">1B</button>
        <button onclick="cargarPosicion('2B')">2B</button>
        <button onclick="cargarPosicion('3B')">3B</button>
        <button onclick="cargarPosicion('SS')">SS</button>
        <button onclick="cargarPosicion('LF')">LF</button>
        <button onclick="cargarPosicion('CF')">CF</button>
        <button onclick="cargarPosicion('RF')">RF</button>
        <button onclick="cargarPosicion('DH')">DH</button>
        <button onclick="cargarPosicion('P')">P</button>
      </div>

      <div id="listaJugadores"></div>
    </div>
    `);
}
const cacheJugadores = {};
const cachePromedios = {};
async function cargarPosicion(posicion) {
  const lista = document.getElementById("listaJugadores");

  lista.innerHTML = `<p>⚾ Cargando ${posicion}...</p>`;

  try {

    // P = seleccionar equipo completo de pitcheo
    if (posicion === "P") {

      const respuesta = await fetch(
        "https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026"
      );

      const datos = await respuesta.json();

      const equipos = datos.teams.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      lista.innerHTML = `
        <h3>Selecciona equipo de pitcheo</h3>
        ${(await Promise.all(
          equipos.map(async (equipo) => {
            const salario = await calcularSalarioPitcheo(equipo.id);
        
            return `
              <button
                onclick="agregarPitching(${equipo.id}, '${equipo.name.replace(/'/g, "\\'")}')"
              >
                ⚾ ${equipo.name}
                <br>
                💰 Salario: $${salario.toFixed(1)} M
              </button>
            `;
          })
        )).join("")}
      `;

      return;
    }

    
  
    // Jugadores de posición
    const respuestaEquipos = await fetch(
      "https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026"
    );

    const datosEquipos = await respuestaEquipos.json();

    const resultados = [];
    const idsVistos = new Set();
    for (const equipoMLB of datosEquipos.teams) {

      try {

        const respuestaRoster = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${equipoMLB.id}/roster?rosterType=fullRoster&season=2026`
        );

        const datosRoster = await respuestaRoster.json();

        if (!datosRoster.roster) continue;

        datosRoster.roster.forEach(jugador => {

          if (
            jugador.position &&
            (
              jugador.position.abbreviation === posicion ||
              (posicion === "DH" && jugador.position.abbreviation === "TWP")
            ) &&
            !idsVistos.has(jugador.person.id)
          ) {
            idsVistos.add(jugador.person.id);
            resultados.push({
              id: jugador.person.id,
              nombre: jugador.person.fullName,
              equipo: equipoMLB.name,
              equipoId: equipoMLB.id,
              posicion: posicion,
              status: jugador.status ? jugador.status.description : "Activo"
            });

          }

        });

      } catch (errorEquipo) {
        console.log(
          "No se pudo cargar:",
          equipoMLB.name
        );
      }
    }
    await Promise.all(
      resultados.map(async (jugador) => {
        const puntosPromedio = await obtenerPromedioUltimos10(jugador.id);
        jugador.salario = calcularSalarioFantasy(puntosPromedio);
      })
    );
  

    resultados.sort((a, b) => b.salario - a.salario);
    cacheJugadores[posicion] = resultados;

    if (resultados.length === 0) {

      lista.innerHTML = `
        <p>No se encontraron jugadores para ${posicion}.</p>
      `;

      return;
    }


    lista.innerHTML = `
      <h3>${posicion} — Jugadores MLB</h3>
      <input
      type="text"
      placeholder="🔍 Buscar jugador..."
      oninput="filtrarJugadores(this.value, '${posicion}')"
      style="
        width: 100%;
        padding: 12px;
        margin: 10px 0 15px 0;
        border-radius: 10px;
        border: 1px solid #ccc;
        font-size: 16px;
        box-sizing: border-box;
      "
    >
    
    <div id="jugadores-${posicion}">
      ${resultados.map(jugador => `
        <button
          onclick="agregarJugadorMLB(
            ${jugador.id},
            '${jugador.nombre.replace(/'/g, "\\'")}',
            '${jugador.equipo.replace(/'/g, "\\'")}',
            '${jugador.posicion}'
          )"
        >
          <strong>${jugador.nombre}</strong>
          — ${jugador.equipo}
          <br>
<small>${jugador.status === "Active" ? "🟢 Activo" : "🔴 " + jugador.status}</small>
<br>
<small>💰 Salario: $${(jugador.salario || 0).toFixed(1)} M</small>
        </button>
        `).join("")}
        </div>
        `; 
      cacheJugadores[posicion] = resultados;

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <p>❌ No se pudieron cargar los datos de MLB.</p>
    `;

  }
}
function filtrarJugadores(texto, posicion) {
  const contenedor = document.getElementById(
    "jugadores-" + posicion
  );

  if (!contenedor) return;

  const botones = contenedor.querySelectorAll("button");
  const busqueda = texto.toLowerCase().trim();

  botones.forEach((boton) => {
    const nombre = boton.textContent.toLowerCase();

    boton.style.display = nombre.includes(busqueda)
      ? ""
      : "none";
  });
}
async function agregarPitching(id, nombre) {
  equipo = equipo.filter(
    jugador => jugador.posicion !== "P"
  );
  const salarioPitcheo = await calcularSalarioPitcheo(id);
  equipo.push({
    id: id,
    nombre: nombre,
    equipo: nombre,
    posicion: "P",
    salario: salarioPitcheo,
    puntos: 0
  });

  guardarDatos();
  mostrarEquipo();

  alert(nombre + " fue seleccionado como P");
}
async function agregarJugadorMLB(id, nombre, equipoNombre, posicion, salario) {
  const puntosPromedio = await obtenerPromedioUltimos10(id);
const salarioAutomatico = calcularSalarioFantasy(puntosPromedio);

  equipo = equipo.filter(
    jugador => jugador.posicion !== posicion
  );

  equipo.push({
    id: id,
    nombre: nombre,
    equipo: equipoNombre,
    posicion: posicion,
    salario: salarioAutomatico,
    puntos: 0
  });

  guardarDatos();
  mostrarEquipo();


  alert(
    nombre +
    " fue seleccionado como " +
    posicion
  );
}
  
function calcularSalarioFantasy(puntosPromedio) {
  let salario;
  if (puntosPromedio >= 8) {
    salario = 10.0;
  } else if (puntosPromedio >= 6) {
    salario = 8.5;
  } else if (puntosPromedio >= 5) {
    salario = 7.5;
  } else if (puntosPromedio >= 4) {
    salario = 6.5;
  } else if (puntosPromedio >= 3) {
    salario = 5.5;
  } else if (puntosPromedio >= 2) {
    salario = 4.0;
  } else if (puntosPromedio >= 1) {
    salario = 2.5;
  } else {
    salario = 1.5;
  }


  return salario;
}
function calcularPuntosBateador(stats) {
  let puntos = 0;

  puntos += (stats.hits || 0) * 1;
  puntos += (stats.runs || 0) * 1;
  puntos += (stats.rbi || 0) * 1;
  puntos += (stats.baseOnBalls || 0) * 1;

  puntos += (stats.doubles || 0) * 1;
  puntos += (stats.triples || 0) * 2;
  puntos += (stats.homeRuns || 0) * 3;

  return puntos;
}
function calcularPuntosPitcheo(stats, gano) {
  let puntos = 0;

  puntos += (stats.inningsPitched || 0) * 3;
  puntos += (stats.strikeOuts || 0) * 1;
  puntos -= (stats.hits || 0) * 1;
  puntos -= (stats.baseOnBalls || 0) * 1;
  puntos -= (stats.earnedRuns || 0) * 3;

  puntos += gano ? 5 : -5;

  return puntos;
}
function calcularPuntosEquipo(statsBateo, statsPitcheo, gano) {
  let puntos = 0;

  // Sumar puntos de todos los bateadores
  statsBateo.forEach(stats => {
    puntos += calcularPuntosBateador(stats);
  });

  // Sumar puntos del pitcheo completo del equipo
  puntos += calcularPuntosPitcheo(statsPitcheo, gano);

  return puntos;
}
async function obtenerPuntosBateador(playerId, fecha) {
  try {
    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
    );

    const datos = await respuesta.json();

    const splits = datos.stats?.[0]?.splits || [];

    const juego = splits.find(item => {
      return item.date === fecha;
    });

    if (!juego) {
      return 0;
    }

    return calcularPuntosBateador(juego.stat);

  } catch (error) {
    console.error("Error obteniendo puntos del bateador:", error);
    return 0;
  }
}
async function obtenerPromedioUltimos10(playerId) {
  if (cachePromedios[playerId] !== undefined) {
    return cachePromedios[playerId];
  }
  try {
    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
    );

    const datos = await respuesta.json();
    const juegos = datos.stats?.[0]?.splits || [];

    const ultimos10 = juegos.slice(-10);

    if (ultimos10.length === 0) {
      return 0;
    }

    let puntosTotales = 0;

    ultimos10.forEach(juego => {
      puntosTotales += calcularPuntosBateador(juego.stat);
    });

    const promedio = puntosTotales / ultimos10.length;

    cachePromedios[playerId] = promedio;
    
    return promedio;
  } catch (error) {
    console.error("Error calculando promedio últimos 10:", error);
    return 0;
  }
}

async function obtenerPuntosPitcheoEquipo(teamId, fecha) {
  try {
    // 1. Buscar el juego del equipo en la fecha indicada
    const respuestaSchedule = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&date=${fecha}`
    );

    const datosSchedule = await respuestaSchedule.json();

    const juego = datosSchedule.dates?.[0]?.games?.[0];

    if (!juego) {
      return 0;
    }

    const gamePk = juego.gamePk;

    // 2. Obtener boxscore EN VIVO
    const respuestaBoxscore = await fetch(
      `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`
    );

    const boxscore = await respuestaBoxscore.json();

    // 3. Saber si nuestro equipo es local o visitante
    const esLocal =
      juego.teams?.home?.team?.id === Number(teamId);

    const lado = esLocal ? "home" : "away";

    // 4. Estadísticas acumuladas de TODO el pitcheo del equipo
    const stats =
      boxscore.teams?.[lado]?.teamStats?.pitching;

    if (!stats) {
      return 0;
    }

    // 5. La victoria solo se aplica cuando el juego terminó
    let gano = false;

    if (juego.status?.abstractGameState === "Final") {
      const carrerasLocal = juego.teams?.home?.score ?? 0;
      const carrerasVisitante = juego.teams?.away?.score ?? 0;

      gano = esLocal
        ? carrerasLocal > carrerasVisitante
        : carrerasVisitante > carrerasLocal;
    }

    return calcularPuntosPitcheo(stats, gano);

  } catch (error) {
    console.error("Error obteniendo puntos de pitcheo en vivo:", error);
    return 0;
  }
}
async function probarPitcheo() {
  const puntos = await obtenerPuntosPitcheoEquipo(
    138,
    "2026-08-15"
  );

  alert("PRUEBA PITCH EO: " + puntos);
}
// ----------------------------------------
// MOSTRAR EQUIPO
// ----------------------------------------

function mostrarEquipo() {
  const contenedor = document.getElementById("equipo");
  const presupuestoMaximo = 50;

  const gastado = equipo.reduce(
    (total, jugador) => total + (jugador.salario || 0),
    0
  );
  
  const disponible = presupuestoMaximo - gastado;
  if (!contenedor) {
    return;
  }

  if (equipo.length === 0) {
    contenedor.innerHTML = "Todavía no has seleccionado jugadores.";
    return;
  }

  contenedor.innerHTML = "";
  const ordenPosiciones = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "P"];
  equipo.sort((a, b) => ordenPosiciones.indexOf(a.posicion) - ordenPosiciones.indexOf(b.posicion));
  
  equipo.forEach((jugador) => {
    const jugadorElemento = document.createElement("div");

    jugadorElemento.innerHTML =
    "<strong>" +
    jugador.posicion +
    " — " + 
    jugador.nombre +
    "</strong> — " +
    jugador.puntos +
" puntos — $" +
(jugador.salario || 0).toFixed(1) +
" M";
jugadorElemento.onclick = () => cargarPosicion(jugador.posicion);

    contenedor.appendChild(jugadorElemento);
  });
  const presupuesto = document.getElementById("presupuesto");

  if (presupuesto) {
    presupuesto.innerHTML =
      "<strong>Presupuesto</strong><br>" +
      "Tope: $" + presupuestoMaximo.toFixed(1) + " M<br>" +
      "Gastado: $" + gastado.toFixed(1) + " M<br>" +
      "Disponible: $" + disponible.toFixed(1) + " M";
  }
  const botonGuardar = document.createElement("button");
botonGuardar.textContent = "💾 Guardar roster";
botonGuardar.onclick = guardarRoster;
botonGuardar.style.marginTop = "15px";

contenedor.appendChild(botonGuardar);
}
async function obtenerHoraCierreRoster() {
  try {
    // El roster que armamos hoy corresponde a los juegos de mañana.
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const fechaManana =
      manana.getFullYear() + "-" +
      String(manana.getMonth() + 1).padStart(2, "0") + "-" +
      String(manana.getDate()).padStart(2, "0");

    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${fechaManana}`
    );

    if (!respuesta.ok) {
      throw new Error("No se pudo obtener el calendario MLB");
    }

    const datos = await respuesta.json();
    const juegos = datos.dates?.[0]?.games || [];

    if (juegos.length === 0) {
      return null;
    }

    // Las horas de MLB vienen en UTC.
    // new Date(gameDate) las convierte correctamente a la hora del dispositivo.
    const horas = juegos
      .map(juego => new Date(juego.gameDate))
      .filter(fecha => !isNaN(fecha.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (horas.length === 0) {
      return null;
    }

    const primerJuego = horas[0];

    // Cierre exactamente 1 hora antes del primer juego.
    return new Date(
      primerJuego.getTime() - 60 * 60 * 1000
    );

  } catch (error) {
    console.error("Error obteniendo hora de cierre:", error);
    return null;
  }
}
async function guardarRoster() {
  const horaCierre = await obtenerHoraCierreRoster();
const ahora = new Date();

if (horaCierre && ahora >= horaCierre) {
  alert("🔒 El roster ya está cerrado. No puedes hacer más cambios.");
  return;
}
  const presupuestoMaximo = 50;

  const posicionesObligatorias = [
    "C", "1B", "2B", "3B", "SS",
    "LF", "CF", "RF", "DH", "P"
  ];

  const gastado = equipo.reduce(
    (total, jugador) => total + (jugador.salario || 0),
    0
  );

  const posicionesActuales = equipo.map(
    jugador => jugador.posicion
  );

  const faltantes = posicionesObligatorias.filter(
    posicion => !posicionesActuales.includes(posicion)
  );

  if (faltantes.length > 0) {
    alert(
      "❌ No puedes guardar el roster.\n" +
      "Faltan posiciones: " + faltantes.join(", ")
    );
    return;
  }

  if (gastado > presupuestoMaximo) {
    alert(
      "❌ Superaste el límite de $50 M.\n" +
      "Total: $" + gastado.toFixed(1) + " M"
    );
    return;
  }

  localStorage.setItem(
    "rosterOficial",
    JSON.stringify(equipo)
  );
  const fechaRosterObj = new Date();
fechaRosterObj.setDate(fechaRosterObj.getDate() + 1);
const fechaRoster = fechaRosterObj.toISOString().split("T")[0];

  localStorage.setItem(
    "fechaRosterOficial",
    fechaRoster
  );
  alert(
    "✅ Roster guardado correctamente.\n" +
    "Total: $" + gastado.toFixed(1) + " M"
  );
  mostrarAlineacionGuardada();
}
function mostrarAlineacionGuardada() {
  const bloque = document.getElementById("alineacionGuardada");
  const lista = document.getElementById("listaAlineacion");

  const rosterGuardado = JSON.parse(
    localStorage.getItem("rosterOficial") || "[]"
  );

  if (!bloque || !lista || rosterGuardado.length === 0) {
    return;
  }
  const fechaGuardada = localStorage.getItem("fechaRosterOficial");
  const titulo = document.getElementById("tituloAlineacion");

if (titulo && fechaGuardada) {
  const partes = fechaGuardada.split("-");
  titulo.textContent =
    "Mi alineación — " +
    partes[2] + "/" + partes[1] + "/" + partes[0];
}
  const fechaHoy = new Date().toISOString().split("T")[0];
  
  if (fechaGuardada !== fechaHoy) {
    bloque.style.display = "none";
    return;
  }
  const ordenPosiciones = [
    "C", "1B", "2B", "3B", "SS",
    "LF", "CF", "RF", "DH", "P"
  ];

  rosterGuardado.sort(
    (a, b) =>
      ordenPosiciones.indexOf(a.posicion) -
      ordenPosiciones.indexOf(b.posicion)
  );

  lista.innerHTML = rosterGuardado
    .map(jugador => `
      <div>
        <strong>${jugador.posicion}</strong> — ${jugador.nombre}
        — $${(jugador.salario || 0).toFixed(1)} M
      </div>
    `)
    .join("");

  bloque.style.display = "block";
}
async function editarAlineacion() {
  const horaCierre = await obtenerHoraCierreRoster();
const ahora = new Date();

if (horaCierre && ahora >= horaCierre) {
  alert("🔒 La alineación ya está cerrada y no puede editarse.");
  return;
}
  const rosterGuardado = JSON.parse(
    localStorage.getItem("rosterOficial") || "[]"
  );

  if (rosterGuardado.length === 0) {
    alert("No hay una alineación guardada.");
    return;
  }

  equipo = rosterGuardado;

  // Ocultar la alineación guardada
  const bloque = document.getElementById("alineacionGuardada");
  if (bloque) {
    bloque.style.display = "none";
  }

  // Mostrar nuevamente el equipo para editarlo
  mostrarEquipo();

  // Abrir la selección empezando por Catcher
  cargarPosicion("C");
}
async function actualizarPuntosEquipo(fecha) {
  let total = 0;

  for (const jugador of equipo) {
    let puntos = 0;

    if (jugador.posicion === "P") {
      puntos = await obtenerPuntosPitcheoEquipo(
        jugador.id,
        fecha
      );
    } else {
      puntos = await obtenerPuntosBateador(
        jugador.id,
        fecha
      );
    }

    jugador.puntos = puntos;
    total += puntos;
  }

  guardarDatos();
  mostrarEquipo();

  const puntuacion = document.getElementById("puntuacion-hoy");

  if (puntuacion) {
    puntuacion.textContent = total + " puntos";
  }

  return total;
}
// ----------------------------------------
// CREAR GRUPO
// ----------------------------------------

function crearGrupo() {
  const nombre = prompt("Nombre del grupo:");

  if (!nombre) {
    return;
  }

  const clave = Math.random()
  .toString(36)
  .substring(2, 8)
  .toUpperCase();

  const grupo = {
    nombre: nombre,
    clave: clave,
    participantes: [
      {
        nombre: "Yo",
        puntos: 0
      }
    ]
  };

  grupos.push(grupo);

  guardarDatos();
  mostrarGrupos();

  alert(
    "Grupo creado correctamente.\n\n" +
    "Grupo: " +
    nombre +
    "\nClave: " +
    clave
  );
}
async function mostrarGrupos() {
  const seccion = document.querySelector("section:nth-of-type(2)");

  if (!seccion) return;

  let contenedor = document.getElementById("listaGrupos");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "listaGrupos";
    contenedor.style.marginTop = "20px";
    seccion.appendChild(contenedor);
  }

  if (!grupos || grupos.length === 0) {
    contenedor.innerHTML = "";
    return;
  }

  const gruposActualizados = await Promise.all(
    grupos.map(async (grupo) => {
      const { data: participantes, error } = await supabaseClient
        .from("participantes")
        .select("id, nombre, puntos")
        .eq("grupo_id", grupo.id);

      if (error) {
        console.error("Error cargando participantes:", error);

        return {
          ...grupo,
          participantes: grupo.participantes || []
        };
      }

      return {
        ...grupo,
        participantes: participantes || []
      };
    })
  );

  grupos = gruposActualizados;
  guardarDatos();

  contenedor.innerHTML = gruposActualizados
    .map(
      (grupo) => `
        <div style="
          margin-top:15px;
          padding:15px;
          border:1px solid #2b4a68;
          border-radius:12px;
        ">
          <strong>${grupo.nombre}</strong><br>
          🔑 Clave: ${grupo.clave}<br>
          👥 Participantes: ${grupo.participantes.length}
        </div>
      `
    )
    .join("");
}
// ----------------------------------------
// UNIRSE A UN GRUPO
// ----------------------------------------

async function unirseGrupo() {
  const clave = prompt("Escribe la clave del grupo:");

  if (!clave) {
    return;
  }

  const claveLimpia = clave.trim().toUpperCase();

  // Buscar el grupo en Supabase
  const { data: grupoEncontrado, error: errorGrupo } =
    await supabaseClient
      .from("grupos")
      .select("*")
      .eq("clave", claveLimpia)
      .single();

  if (errorGrupo || !grupoEncontrado) {
    console.error(errorGrupo);
    alert("No existe ningún grupo con esa clave.");
    return;
  }

  const nombre = prompt("Escribe tu nombre:");

  if (!nombre) {
    return;
  }

  // Agregar participante en Supabase
  const { error: errorParticipante } = await supabaseClient
    .from("participantes")
    .insert({
      grupo_id: grupoEncontrado.id,
      nombre: nombre.trim(),
      puntos: 0
    });

  if (errorParticipante) {
    console.error(errorParticipante);
    alert("No se pudo unir al grupo.");
    return;
  }

  // Guardarlo localmente para mostrarlo en este dispositivo
  const grupoLocal = {
    id: grupoEncontrado.id,
    nombre: grupoEncontrado.nombre,
    clave: grupoEncontrado.clave,
    participantes: [
      {
        nombre: nombre.trim(),
        puntos: 0
      }
    ]
  };

  const yaExiste = grupos.some(
    (grupoActual) => grupoActual.id === grupoEncontrado.id
  );

  if (!yaExiste) {
    grupos.push(grupoLocal);
  }

  guardarDatos();
  mostrarGrupos();
  mostrarRanking();

  alert("Te uniste al grupo " + grupoEncontrado.nombre);
}

// ----------------------------------------
// MOSTRAR RANKING
// ----------------------------------------

async function mostrarRanking() {
  const ranking = document.getElementById("ranking");

  if (!ranking) {
    return;
  }

  let participantes = [];

for (const grupo of grupos) {
  const { data, error } = await supabaseClient
    .from("participantes")
    .select("nombre, puntos")
    .eq("grupo_id", grupo.id);

  if (error) {
    console.error("Error cargando ranking:", error);
    continue;
  }

  participantes = participantes.concat(data || []);
}

  participantes.sort((a, b) => b.puntos - a.puntos);

  if (participantes.length === 0) {
    ranking.innerHTML = "Todavía no hay participantes.";
    return;
  }

  ranking.innerHTML = "";

  participantes.forEach((participante, posicion) => {
    const fila = document.createElement("div");

    fila.innerHTML =
      (posicion + 1) +
      ". <strong>" +
      participante.nombre +
      "</strong> — " +
      participante.puntos +
      " puntos";

    ranking.appendChild(fila);
  });
}

// ----------------------------------------
// CONECTAR LOS BOTONES
// ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  const botones = document.querySelectorAll("button");

  botones.forEach((boton) => {

    const texto = boton.textContent.toLowerCase();

    if (texto.includes("seleccionar jugadores")) {
      boton.addEventListener("click", seleccionarJugadores);
    }

    if (texto.includes("crear grupo")) {
      boton.addEventListener("click", crearGrupo);
    }

    if (texto.includes("unirme con una clave")) {
      boton.addEventListener("click", unirseGrupo);
    }

  });

  mostrarEquipo();
  mostrarRanking();

  const fechaRoster = localStorage.getItem("fechaRosterOficial");

if (fechaRoster) {
  actualizarPuntosEquipo(fechaRoster);
}
});
async function calcularSalarioPitcheo(teamId) {
  try {
    const calidadAbridor = await obtenerCalidadAbridor(teamId);
    const calidadBullpen = await obtenerCalidadBullpen10Dias(teamId);

    const calidadTotal =
      (calidadAbridor * 0.60) +
      (calidadBullpen * 0.40);

    let salario;

    if (calidadTotal >= 8.5) {
      salario = 10.0;
    } else if (calidadTotal >= 7.5) {
      salario = 9.0;
    } else if (calidadTotal >= 6.5) {
      salario = 8.0;
    } else if (calidadTotal >= 5.5) {
      salario = 7.0;
    } else if (calidadTotal >= 4.5) {
      salario = 6.0;
    } else if (calidadTotal >= 3.5) {
      salario = 5.0;
    } else {
      salario = 4.0;
    }

    return salario;
  } catch (error) {
    console.error("Error calculando salario de pitcheo:", error);
    return 4.0;
  }
}
async function obtenerCalidadAbridor(teamId) {
  try {
    const hoy = new Date();
    const fecha = hoy.toISOString().split("T")[0];

    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&date=${fecha}&hydrate=probablePitcher`
    );

    const datos = await respuesta.json();

    const juego = datos.dates?.[0]?.games?.[0];

    if (!juego) return 5;

    const equipoLocal = juego.teams.home.team.id === teamId;
    const abridor = equipoLocal
      ? juego.teams.home.probablePitcher
      : juego.teams.away.probablePitcher;

    if (!abridor?.id) return 5;

    const statsRespuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${abridor.id}/stats?stats=season&group=pitching&season=2026`
    );

    const statsDatos = await statsRespuesta.json();
    const stats = statsDatos.stats?.[0]?.splits?.[0]?.stat;

    if (!stats) return 5;

    const era = parseFloat(stats.era || 5);
    const whip = parseFloat(stats.whip || 1.5);

    let calidad = 10;

    calidad -= Math.max(0, era - 2.5) * 1.2;
    calidad -= Math.max(0, whip - 1.0) * 4;

    calidad = Math.max(0, Math.min(10, calidad));

    return calidad;
  } catch (error) {
    console.error("Error calidad abridor:", error);
    return 5;
  }
}
async function obtenerCalidadBullpen10Dias(teamId) {
  try {
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(hoy.getDate() - 10);

    const startDate = inicio.toISOString().split("T")[0];
    const endDate = hoy.toISOString().split("T")[0];

    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=byDateRange&group=pitching&startDate=${startDate}&endDate=${endDate}&season=2026`
    );

    const datos = await respuesta.json();
    const stats = datos.stats?.[0]?.splits?.[0]?.stat;

    if (!stats) return 5;

    const era = parseFloat(stats.era || 5);
    const whip = parseFloat(stats.whip || 1.5);
    const k9 = parseFloat(stats.strikeoutsPer9Inn || 8);

    let calidad = 10;

    calidad -= Math.max(0, era - 3.0) * 1.1;
    calidad -= Math.max(0, whip - 1.10) * 3.5;

    if (k9 < 8) {
      calidad -= (8 - k9) * 0.4;
    }

    calidad = Math.max(0, Math.min(10, calidad));

    return calidad;
  } catch (error) {
    console.error("Error calidad bullpen:", error);
    return 5;
  }
}
async function obtenerHoraPrimerJuegoMLB() {
  const fechaHoy = new Date().toISOString().split("T")[0];

  try {
    const respuesta = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${fechaHoy}`
    );

    const datos = await respuesta.json();

    if (!datos.dates || datos.dates.length === 0) {
      return null;
    }

    const juegos = datos.dates[0].games;

    if (!juegos || juegos.length === 0) {
      return null;
    }

    const horas = juegos
      .map(juego => new Date(juego.gameDate))
      .sort((a, b) => a - b);

    return horas[0];
  } catch (error) {
    console.error("Error obteniendo primer juego MLB:", error);
    return null;
  }
}
async function obtenerHoraCierreRoster() {
  const primerJuego = await obtenerHoraPrimerJuegoMLB();

  if (!primerJuego) {
    return null;
  }

  const horaCierre = new Date(
    primerJuego.getTime() - 60 * 60 * 1000
  );

  return horaCierre;
}
