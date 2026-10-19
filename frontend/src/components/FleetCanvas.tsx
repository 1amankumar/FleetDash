
import { useEffect, useRef, useState } from "react";

export type CanvasVehicle = {
    vehicleId: string;
    latitude: number;
    longitude: number;
    speed?: number;
};

type FleetCanvasProps = {
    vehicles: CanvasVehicle[];
};

// Fixed display bounds for the sample Dhanbad dashboard.
// Coordinates outside this area are kept within the canvas edges.
const BOUNDS = {
    minLatitude: 23.79,
    maxLatitude: 23.84,
    minLongitude: 86.40,
    maxLongitude: 86.45,
};

function FleetCanvas({ vehicles }: FleetCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const vehiclesRef = useRef<CanvasVehicle[]>(vehicles);
    const [fps, setFps] = useState(0);

    useEffect(() => {
        vehiclesRef.current = vehicles;
    }, [vehicles]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) return;

        let animationFrameId = 0;
        //let previousFrameTime = 0;
        let frameCount = 0;
        let lastFpsUpdate = 0;

        const resizeCanvas = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            const pixelRatio = window.devicePixelRatio || 1;

            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);

            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        };

        resizeCanvas();

        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(canvas);

        const render = (timestamp: number) => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (width === 0 || height === 0) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            frameCount++;

            if (timestamp - lastFpsUpdate >= 1000) {
                setFps(
                    Math.round(
                        (frameCount * 1000) /
                        Math.max(timestamp - lastFpsUpdate, 1)
                    )
                );

                frameCount = 0;
                lastFpsUpdate = timestamp;
            }

            

            context.clearRect(0, 0, width, height);
            context.fillStyle = "#f4f7fb";
            context.fillRect(0, 0, width, height);

            // Draw the background grid.
            context.strokeStyle = "#e2e8f0";
            context.lineWidth = 1;

            for (let x = 0; x < width; x += 32) {
                context.beginPath();
                context.moveTo(x, 0);
                context.lineTo(x, height);
                context.stroke();
            }

            for (let y = 0; y < height; y += 32) {
                context.beginPath();
                context.moveTo(0, y);
                context.lineTo(width, y);
                context.stroke();
            }

            const padding = 28;
            const usableWidth = Math.max(width - padding * 2, 1);
            const usableHeight = Math.max(height - padding * 2, 1);

            const currentVehicles = vehiclesRef.current.filter(
                (vehicle) =>
                    Number.isFinite(vehicle.latitude) &&
                    Number.isFinite(vehicle.longitude) &&
                    vehicle.latitude >= -90 &&
                    vehicle.latitude <= 90 &&
                    vehicle.longitude >= -180 &&
                    vehicle.longitude <= 180
            );

            if (currentVehicles.length === 0) {
                context.fillStyle = "#64748b";
                context.font = "14px sans-serif";
                context.textAlign = "center";
                context.fillText(
                    "Waiting for vehicle telemetry...",
                    width / 2,
                    height / 2
                );
            }

            for (const vehicle of currentVehicles) {
                const longitudeRatio =
                    (vehicle.longitude - BOUNDS.minLongitude) /
                    (BOUNDS.maxLongitude - BOUNDS.minLongitude);

                const latitudeRatio =
                    (vehicle.latitude - BOUNDS.minLatitude) /
                    (BOUNDS.maxLatitude - BOUNDS.minLatitude);

                const x =
                    padding +
                    Math.min(1, Math.max(0, longitudeRatio)) * usableWidth;

                const y =
                    height -
                    padding -
                    Math.min(1, Math.max(0, latitudeRatio)) * usableHeight;

                // Vehicle marker.
                context.beginPath();
                context.arc(x, y, 7, 0, Math.PI * 2);
                context.fillStyle = "#2563eb";
                context.fill();

                context.beginPath();
                context.arc(x, y, 11, 0, Math.PI * 2);
                context.strokeStyle = "rgba(37, 99, 235, 0.25)";
                context.lineWidth = 2;
                context.stroke();

                // Vehicle ID and speed.
                context.fillStyle = "#1e293b";
                context.font = "12px sans-serif";
                context.textAlign = "left";
                context.fillText(vehicle.vehicleId, x + 14, y - 5);

                if (vehicle.speed !== undefined) {
                    context.fillStyle = "#64748b";
                    context.fillText(
                        `${vehicle.speed} km/h`,
                        x + 14,
                        y + 10
                    );
                }
            }

            // Keep using the browser's animation scheduler.
            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <section className="fleet-canvas-panel">
            <div className="fleet-canvas-heading">
                <h2>Fleet Canvas View</h2>
                <span>FPS: {fps}</span>
            </div>

            <canvas
                ref={canvasRef}
                className="fleet-canvas"
                aria-label="Canvas visualization of vehicle positions"
                role="img"
            />

            <p className="fleet-canvas-note">
                Fixed coordinate view for the sample Dhanbad area.
                Vehicles outside the configured bounds appear at the nearest edge.
            </p>
        </section>
    );
}

export default FleetCanvas;
