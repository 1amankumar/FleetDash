import "dotenv/config"
import app from "./app.js"

const PORT=process.env.PORT || 8000

app.listen(PORT,()=>{
    console.log(`FleetDash API running on port ${PORT}`);
})