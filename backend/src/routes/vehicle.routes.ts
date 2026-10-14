import { Router } from "express";

import {createVehicle,getVehicles}from "../controllers/vehicle.controller.js"

const route=Router();

route.post("/",createVehicle);
route.get("/",getVehicles)

export default route;