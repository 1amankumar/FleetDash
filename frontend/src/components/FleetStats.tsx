
import { Truck, Activity, AlertTriangle, Wrench } from "lucide-react";

type Vehicle = {
  status: "active" | "inactive" | "maintenance";
};

type FleetStatsProps = {
  vehicles: Vehicle[];
};

function FleetStats({ vehicles }: FleetStatsProps) {
  const totalVehicles = vehicles.length;

  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "active"
  ).length;

  const maintenanceVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "maintenance"
  ).length;

  const stats = [
    {
      title: "Total Vehicles",
      value: totalVehicles,
      icon: Truck,
      color: "blue",
    },
    {
      title: "Active Vehicles",
      value: activeVehicles,
      icon: Activity,
      color: "green",
    },
    {
      title: "Alerts",
      value: 0,
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "In Maintenance",
      value: maintenanceVehicles,
      icon: Wrench,
      color: "purple",
    },
  ];

  return (
    <section className="fleet-stats">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article className="stat-card" key={stat.title}>
            <div className={`stat-icon ${stat.color}`}>
              <Icon size={22} />
            </div>

            <div>
              <p>{stat.title}</p>
              <h2>{stat.value}</h2>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default FleetStats;
