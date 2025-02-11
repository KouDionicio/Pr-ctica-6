import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from 'uuid';
import os from "os"
import cors from "cors"
import "./database.js"
import Sesion from "./models/Sesiones.js"
import MongoStore from 'connect-mongo';

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
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017/tu_base_de_datos",
        ttl: 5 * 60 // Expira en 5 minutos
    }),
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
const getClienteIP = (req) => {
    return req.headers["x-forwarded-for"]?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.connection?.socket?.remoteAddress || "IP desconocida";
};

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
    const now = moment.tz("America/Mexico_City"); // Usamos un objeto moment válido
    for (const sessionId in sessionStore) {
        const session = sessionStore[sessionId];
        const lastAccessed = moment(session.lastAccessed, "DD-MM-YYYY HH:mm:ss"); // Usamos el formato personalizado

        // Verificamos si lastAccessed es válido
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
app.post("/login", async (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Se esperan campos requeridos" });
    }

    const sessionId = uuidv4();  // Generamos un UUID único para la sesión
    const now = moment.tz('America/Mexico_City').format('DD-MM-YYYY HH:mm:ss'); 

    const session = new Sesion({
        sessionID: sessionId,
        email,
        nickname,
        status: "Activa",
        clientData: {
            ip: getClienteIP(req),
            macAddress
        },
        serverData: getServerNetworkInfo(),
        createdAt: now,
        lastAcces: now,
        inactivityTime: { hours: 0, minutes: 0, seconds: 0 }
    });

    try {
        await session.save();  // Guardamos la sesión en MongoDB
        res.status(200).json({
            message: "Se ha logeado de manera exitosa !!!",
            sessionId
        });
    } catch (error) {
        console.error('Error al guardar la sesión en MongoDB:', error);
        res.status(500).json({ message: "Error al guardar la sesión en la base de datos" });
    }
});


// Logout Endpoint
app.post("/logout", async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es requerido" });
    }

    try {
        const session = await Sesion.findOne({ sessionID: sessionId });

        if (!session) {
            return res.status(404).json({ message: "No se encuentra una sesión activa" });
        }

        session.status = "Inactiva";
        session.lastAcces = moment().toDate();

        await session.save();  // Guardamos los cambios

        res.status(200).json({ message: "Logout exitoso" });
    } catch (error) {
        console.error('Error al realizar el logout:', error);
        res.status(500).json({ message: "Error al realizar el logout" });
    }
});



// Actualización de la sesión
app.put("/update", async (req, res) => {
    const { sessionId, status, lastAccessed } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es requerido" });
    }

    try {
        const session = await Sesion.findOne({ sessionID: sessionId });

        if (!session) {
            return res.status(404).json({ message: "No existe una sesión activa" });
        }

        if (status) session.status = status;
        if (lastAccessed) session.lastAcces = moment(lastAccessed).toDate();

        await session.save();  // Guardamos los cambios

        res.status(200).json({
            message: "Sesión ha sido actualizada",
            session
        });
    } catch (error) {
        console.error('Error al actualizar la sesión:', error);
        res.status(500).json({ message: "Error al actualizar la sesión" });
    }
});

//? Endpoint para verificar el estado de la sesión
app.get("/status", async (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es requerido" });
    }

    try {
        const session = await Sesion.findOne({ sessionID: sessionId });

        if (!session) {
            return res.status(404).json({ message: "No existe una sesión activa" });
        }

        const now = moment.tz("America/Mexico_City");
        const createdAtMoment = moment(session.createdAt);
        const lastAccessedMoment = moment(session.lastAcces);

        const connectionTime = now.diff(createdAtMoment, 'seconds');
        const inactivityTime = now.diff(lastAccessedMoment, 'seconds');

        res.status(200).json({
            message: "Sesión activa",
            session: {
                ...session.toObject(),
                connectionTime: `${connectionTime} segundos`,
                inactivityTime: `${inactivityTime} segundos`
            }
        });
    } catch (error) {
        console.error('Error al obtener los datos de la sesión:', error);
        res.status(500).json({ message: "Error al obtener los datos de la sesión" });
    }
});

//Endpoint para las sesiones solamente activas
app.get("/allCurrentSessions", async (req, res) => {
    try {
        const activeSessions = await Sesion.find({ status: "Activa" });  // Filtramos por sesiones activas
        res.status(200).json({
            message: "Sesiones activas",
            activeSessions
        });
    } catch (error) {
        console.error('Error al obtener las sesiones activas:', error);
        res.status(500).json({ message: "Error al obtener las sesiones activas" });
    }
});


//Endpoint de todas las sesiones
app.get("/allSessions", async (req, res) => {
    try {
        const sessions = await Sesion.find();  // Obtener todas las sesiones
        res.status(200).json({
            message: "Todas las sesiones",
            sessions
        });
    } catch (error) {
        console.error('Error al obtener todas las sesiones:', error);
        res.status(500).json({ message: "Error al obtener todas las sesiones" });
    }
});

//endpoint para sesioines eliminadas
app.delete("/deleteAllSessions", async (req, res) => {
    try {
        await Sesion.deleteMany();  // Elimina todas las sesiones
        res.status(200).json({
            message: "Todas las sesiones han sido eliminadas"
        });
    } catch (error) {
        console.error('Error al eliminar todas las sesiones:', error);
        res.status(500).json({ message: "Error al eliminar las sesiones" });
    }
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