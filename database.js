//? Aqui va la conexión a la BD de MongoDB

import mongoose  from "mongoose";

mongoose.connect('mongodb+srv://KouDionicio:Dionicio130713+@clusterdionicio.y9zsu.mongodb.net/session_db?retryWrites=true&w=majority&appName=ClusterDionicio')
.then((db)=>console.log('MongoDB Atlas Connected'))
.catch((error)=>console.error(error));

export default mongoose;