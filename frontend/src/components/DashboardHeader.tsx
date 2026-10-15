
import { Activity, Truck } from "lucide-react";

function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="brand">
        <Truck size={28} />
        <div>
          <h1>FleetDash</h1>
          <p>Real-time fleet monitoring</p>
        </div>
      </div>

      <div className="system-status">
        <Activity size={18} />
        <span>System Online</span>
      </div>
    </header>
  );
}

export default DashboardHeader;
