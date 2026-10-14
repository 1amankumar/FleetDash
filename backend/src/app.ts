import  express  from "express";
import cors from "cors";
import vehicleRoute from "./routes/vehicle.routes.js";
import telemetryRoute from "./routes/telemetry.routes.js"


const app=express();

app.use(cors());

app.use(express.json());
app.use("/api/vehicles",vehicleRoute)
app.use("/api/telemetry",telemetryRoute)


app.get("/api/health",(req,res)=>{
    res.status(200).json({
        success:true,
        message:"FleetDash Api is running",
        timestamp: new Date().toISOString(),
    })
})

export default app;