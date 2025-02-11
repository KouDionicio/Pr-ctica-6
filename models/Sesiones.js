import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid"; 
import moment from "moment-timezone"; 

const SesionSchema = new Schema({
    sessionID: {
        default: uuidv4, 
        unique: true,
        type: String
    },
    email: {
        type: String,
        required: true
    },
    nickname: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: () => moment().tz("America/Mexico_City").toDate(), 
        required: true
    },
    lastAcces: {
        type: Date,
        default: () => moment().tz("America/Mexico_City").toDate(), 
    },
    status: {
        type: String,
        enum: ["Activa", "Inactiva", "Finalizada por el Usuario", "Finalizada por Error"],
        required: true
    },
    clientData: {
        ip: { type: String, required: true },
        macAddress: { type: String, required: true }
    },
    serverData: {
        ip: { type: String, required: true },
        macAddress: { type: String, required: true }
    },
    inactivityTime: {
        hours: { type: Number, required: true, min: 0 },
        minutes: { type: Number, required: true, min: 0, max: 59 },
        seconds: { type: Number, required: true, min: 0, max: 59 }
    }
}, { collection: 'Sesion' });

const Sesion = model("Sesion", SesionSchema);

export default Sesion;

