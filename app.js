import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from 'uuid';
import os from "os"
import cors from "cors"
import "./database.js"
import Sesion from './models/Sesiones.js'; 

const app = express();
const PORT = 3500;

app.use(express.json());  // Asegúrate de usar este middleware
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configuración del middleware de sesión
app.use(session({
    secret: "p04-CPD#seiyakoulovers-SesionesPersistentes",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }
}));

// Función de utilidad que permitirá acceder a la información de la interfaz de red (LAN)
/*const getClienteIP = (req) => {
    return (
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddres
    );
};*/

// Función para obtener la IP del cliente
const getClienteIP =(req)=> req.ip.replace(/^.*:/, '');

// Endpoint para mensaje de bienvenida
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Bienvenida al API de Control de Sesiones",
        author: "Citlalli Perez Dionicio"
    });
});

// Función de utilidad que permitirá acceder a la información de la interfaz de red
const getServerNetworkInfo = () => {
    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return { serverIp: iface.address, serverMac: iface.mac };
            }
        }
    }
};

const sessionStore = {};

// Configuración del intervalo de inactividad (2 minutos = 120,000 ms)
const SESSION_TIMEOUT = 2 * 60 * 1000; // 2 minutos en milisegundos

// Función para eliminar sesiones inactivas
const cleanupInactiveSessions = () => {
    const now = moment.tz("America/Mexico_City"); 
    for (const sessionId in sessionStore) {
        const session = sessionStore[sessionId];
        const lastAccessed = moment(session.lastAccessed, "DD-MM-YYYY HH:mm:ss"); 
       
        if (!lastAccessed.isValid()) {
            console.error(`Fecha no válida para la sesión ${sessionId}`);
            continue;
        }

        const inactivityDuration = now.diff(lastAccessed);

        if (inactivityDuration > SESSION_TIMEOUT) {
            // Si la sesión ha estado inactiva por más de 2 minutos, eliminarla
            delete sessionStore[sessionId];
            console.log(`Sesión ${sessionId} eliminada por inactividad.`);
        }
    }
};

// Intervalo para limpiar sesiones inactivas
setInterval(cleanupInactiveSessions, 60 * 1000); // Revisa cada minuto

// Login Endpoint
app.post("/login", (req, res) => {
    console.log("Datos recibidos:", req.body);
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Se esperan campos requeridos" });
    }

    // Generar un ID de sesión único
    const sessionId = uuidv4();
    const now = moment.tz('America/Mexico_City').format('DD-MM-YYYY HH:mm:ss'); // Formato de hora personalizado

    // Obtener datos de IP y MAC del servidor
    const serverIp = '10.10.62.7'; 
    const serverMac = 'a0:e7:0b:f9:37:56'; 

    // Crear objeto para guardar en MongoDB
    const sessionData = {
        sessionID: sessionId,
        email,
        nickname,
        createdAt: moment().tz("America/Mexico_City").toDate(), 
        lastAcces: moment().tz("America/Mexico_City").toDate(), 
        status: 'Activa', 
        clientData: {
            ip: getClienteIP(req),  
            macAddress
        },
        serverData: {
            ip: serverIp,  // La IP del servidor
            macAddress: serverMac // La MAC del servidor
        },
        inactivityTime: {
            hours: 0,
            minutes: 0,
            seconds: 0
        }
    };

    // Guardar la sesión en la base de datos
    Sesion.create(sessionData)
        .then((session) => {
            res.status(200).json({
                message: "Se ha logeado de manera exitosa !!!",
                sessionId
            });
            
        })
        .catch((error) => {
            console.error("Error al guardar la sesión:", error);
            res.status(500).json({ message: "Hubo un error al guardar la sesión" });
        });
});


// Logout Endpoint
app.post("/logout", (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es obligatorio." });
    }

    
    Sesion.findOne({ sessionID: sessionId })
        .then(session => {
            if (!session) {
                return res.status(404).json({ message: "No existe una sesión activa con ese sessionId" });
            }

            
            session.status = "Finalizada por el Usuario";

            // Se guarda la sesión con el nuevo estado
            session.save()
                .then(() => {
                    res.status(200).json({ message: "Sesión finalizada correctamente." });
                })
                .catch(error => {
                    console.error("Error al guardar la sesión:", error);
                    res.status(500).json({ message: "Hubo un error al actualizar el estado de la sesión" });
                });
        })
        .catch(error => {
            console.error("Error al buscar la sesión:", error);
            res.status(500).json({ message: "Hubo un error al buscar la sesión en la base de datos" });
        });
});



app.put("/update", (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId) {
        return res.status(404).json({ message: "No se proporcionó sessionId" });
    }

    
    Sesion.findOne({ sessionID: sessionId })
        .then(session => {
            if (!session) {
                return res.status(404).json({ message: "No existe una sesión activa en la base de datos" });
            }

            const now = moment.tz("America/Mexico_City");  // Obtener la fecha actual en la zona horaria de México

            // Actualizar los campos si es necesario
            if (email) session.email = email;
            if (nickname) session.nickname = nickname;
            session.lastAcces = now.toDate();  // Guardar la fecha actual como objeto Date en UTC

            // Validar si las fechas de creación y último acceso son válidas
            const createdAtMoment = moment(session.createdAt);  
            const lastAccessedMoment = moment(session.lastAcces);

            if (!createdAtMoment.isValid() || !lastAccessedMoment.isValid()) {
                console.error(`Fechas no válidas: createdAt ${session.createdAt}, lastAcces ${session.lastAcces}`);
                return res.status(500).json({ message: "Error: Fechas no válidas." });
            }

            // Calcula la diferencia en segundos para la inactividad
            const inactivityTimeInSeconds = now.diff(lastAccessedMoment, 'seconds'); // Diferencia en segundos

            // Convertir el tiempo de inactividad a horas, minutos y segundos
            const inactivityHours = Math.floor(inactivityTimeInSeconds / 3600); // horas
            const inactivityMinutes = Math.floor((inactivityTimeInSeconds % 3600) / 60); // minutos
            const inactivitySeconds = inactivityTimeInSeconds % 60; // segundos

            const inactivityTime = {
                hours: inactivityHours,
                minutes: inactivityMinutes,
                seconds: inactivitySeconds
            };

            // Calcular la diferencia en segundos para la conexión
            const connectionTimeInSeconds = now.diff(createdAtMoment, 'seconds');  // Diferencia en segundos

            // Convertir el tiempo de conexión a horas, minutos y segundos
            const connectionHours = Math.floor(connectionTimeInSeconds / 3600); // horas
            const connectionMinutes = Math.floor((connectionTimeInSeconds % 3600) / 60); // minutos
            const connectionSeconds = connectionTimeInSeconds % 60; // segundos

            const connectionTime = {
                hours: connectionHours,
                minutes: connectionMinutes,
                seconds: connectionSeconds
            };

            // Guardar la sesión actualizada en la base de datos
            session.save()
                .then(updatedSession => {
                    res.status(200).json({
                        message: "Sesión ha sido actualizada",
                        session: {
                            ...updatedSession._doc, 
                            inactivityTime,  // Tiempo de inactividad (horas, minutos, segundos)
                            connectionTime   // Tiempo de conexión (horas, minutos, segundos)
                        }
                    });
                })
                .catch(error => {
                    console.error("Error al guardar la sesión:", error);
                    res.status(500).json({ message: "Hubo un error al guardar la sesión" });
                });
        })
        .catch(error => {
            console.error("Error al buscar la sesión:", error);
            res.status(500).json({ message: "Hubo un error al buscar la sesión en la base de datos" });
        });
});




//? Endpoint para verificar el estado de la sesión
app.get("/status", (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es obligatorio." });
    }

    // Buscar la sesión en la base de datos usando el sessionId
    Sesion.findOne({ sessionID: sessionId })
        .then(session => {
            if (!session) {
                return res.status(404).json({ message: "No existe una sesión activa con ese sessionId" });
            }

            const now = moment.tz("America/Mexico_City");

            const createdAtMoment = moment(session.createdAt);
            const lastAccessedMoment = moment(session.lastAcces);

            if (!createdAtMoment.isValid() || !lastAccessedMoment.isValid()) {
                console.error(`Fechas no válidas: createdAt ${session.createdAt}, lastAcces ${session.lastAcces}`);
                return res.status(500).json({ message: "Error: Fechas no válidas." });
            }

            // Tiempo de conexión (diferencia entre createdAt y la hora actual)
            const connectionTimeInSeconds = now.diff(createdAtMoment, 'seconds');  

            // Tiempo de inactividad (diferencia entre lastAccessed y la hora actual)
            const inactivityTimeInSeconds = now.diff(lastAccessedMoment, 'seconds');  

            // Convercíon del tiempo de conexión a horas, minutos y segundos
            const connectionHours = Math.floor(connectionTimeInSeconds / 3600);
            const connectionMinutes = Math.floor((connectionTimeInSeconds % 3600) / 60);
            const connectionSeconds = connectionTimeInSeconds % 60;

            // Converción del tiempo de inactividad a horas, minutos y segundos
            const inactivityHours = Math.floor(inactivityTimeInSeconds / 3600);
            const inactivityMinutes = Math.floor((inactivityTimeInSeconds % 3600) / 60);
            const inactivitySeconds = inactivityTimeInSeconds % 60;

            // Estructura para los tiempos de conexión e inactividad
            const connectionTime = {
                hours: connectionHours,
                minutes: connectionMinutes,
                seconds: connectionSeconds
            };

            const inactivityTime = {
                hours: inactivityHours,
                minutes: inactivityMinutes,
                seconds: inactivitySeconds
            };

            
            res.status(200).json({
                message: "Sesión activa",
                session: {
                    ...session._doc,  
                    connectionTime, 
                    inactivityTime  
                }
            });
        })
        .catch(error => {
            console.error("Error al buscar la sesión:", error);
            res.status(500).json({ message: "Hubo un error al buscar la sesión en la base de datos" });
        });
});



app.get("/allCurrentSessions", (req, res) => {
   
    Sesion.find({ status: "Activa" })
        .then(activeSessions => {
            const now = moment.tz("America/Mexico_City");

            
            const sessionsWithTimes = activeSessions.map(session => {
                const createdAtMoment = moment(session.createdAt);
                const lastAccessedMoment = moment(session.lastAcces);

                // Calcular el tiempo de conexión en segundos
                const connectionTimeInSeconds = now.diff(createdAtMoment, 'seconds');
                const inactivityTimeInSeconds = now.diff(lastAccessedMoment, 'seconds');

                // Convertir el tiempo de conexión a horas, minutos y segundos
                const connectionHours = Math.floor(connectionTimeInSeconds / 3600); // horas
                const connectionMinutes = Math.floor((connectionTimeInSeconds % 3600) / 60); // minutos
                const connectionSeconds = connectionTimeInSeconds % 60; // segundos

                const connectionTime = {
                    hours: connectionHours,
                    minutes: connectionMinutes,
                    seconds: connectionSeconds
                };

                // Convertir el tiempo de inactividad a horas, minutos y segundos
                const inactivityHours = Math.floor(inactivityTimeInSeconds / 3600); // horas
                const inactivityMinutes = Math.floor((inactivityTimeInSeconds % 3600) / 60); // minutos
                const inactivitySeconds = inactivityTimeInSeconds % 60; // segundos

                const inactivityTime = {
                    hours: inactivityHours,
                    minutes: inactivityMinutes,
                    seconds: inactivitySeconds
                };

                return {
                    ...session.toObject(),
                    connectionTime, // Tiempo de conexión (horas, minutos, segundos)
                    inactivityTime  // Tiempo de inactividad (horas, minutos, segundos)
                };
            });

            res.status(200).json({
                message: "Sesiones activas",
                activeSessions: sessionsWithTimes
            });
        })
        .catch(error => {
            console.error("Error al obtener las sesiones activas:", error);
            res.status(500).json({ message: "Hubo un error al recuperar las sesiones activas." });
        });
});



//Endpoint para el registro de todas las sesiones
app.get("/allSessions", (req, res) => {
    const now = moment.tz("America/Mexico_City");

    // Buscar todas las sesiones en la base de datos
    Sesion.find()
        .then(sessions => {
            const sessionsWithTimes = sessions.map(session => {
                const createdAtMoment = moment(session.createdAt);
                const lastAccessedMoment = moment(session.lastAcces);

                // Calculamos el tiempo de conexión en segundos
                const connectionTimeInSeconds = now.diff(createdAtMoment, 'seconds');
                const inactivityTimeInSeconds = now.diff(lastAccessedMoment, 'seconds');

                // Converción del tiempo de conexión a horas, minutos y segundos
                const connectionHours = Math.floor(connectionTimeInSeconds / 3600); // horas
                const connectionMinutes = Math.floor((connectionTimeInSeconds % 3600) / 60); // minutos
                const connectionSeconds = connectionTimeInSeconds % 60; // segundos

                const connectionTime = {
                    hours: connectionHours,
                    minutes: connectionMinutes,
                    seconds: connectionSeconds
                };

                // Converción del tiempo de inactividad a horas, minutos y segundos
                const inactivityHours = Math.floor(inactivityTimeInSeconds / 3600); // horas
                const inactivityMinutes = Math.floor((inactivityTimeInSeconds % 3600) / 60); // minutos
                const inactivitySeconds = inactivityTimeInSeconds % 60; // segundos

                const inactivityTime = {
                    hours: inactivityHours,
                    minutes: inactivityMinutes,
                    seconds: inactivitySeconds
                };

                return {
                    ...session.toObject(),
                    connectionTime, // Tiempo de conexión (horas, minutos, segundos)
                    inactivityTime, // Tiempo de inactividad (horas, minutos, segundos)
                };
            });

            res.status(200).json({
                message: "Registro de todas las sesiones",
                sessions: sessionsWithTimes
            });
        })
        .catch(error => {
            console.error("Error al obtener las sesiones:", error);
            res.status(500).json({ message: "Hubo un error al recuperar las sesiones." });
        });
});




app.delete("/deleteAllSessions", (req, res) => {
    
    // Utilizamos el método deleteMany() para eliminar todas las sesiones
    Sesion.deleteMany({})
        .then(result => {
            res.status(200).json({
                message: "Todas las sesiones han sido eliminadas exitosamente.",
                deletedCount: result.deletedCount  // Número de documentos eliminados
            });
        })
        .catch(error => {
            console.error("Error al eliminar las sesiones:", error);
            res.status(500).json({ message: "Hubo un error al eliminar las sesiones." });
        });
});


// Inicializamos el servicio
app.listen(PORT, () => {
    console.log(`Servicio iniciando en http://localhost:${PORT}`);
});



//? Sesiones almacenadas en Memoria RAM
/*app.get("/sessions", (req, res) => {
    res.status(200).json({
        message: "Sesiones activas",
        activeSessions: Object.values(sessionStore).filter(s => s.isActive)
    });
});*/


//? Sesiones almacenadas en Memoria RAM