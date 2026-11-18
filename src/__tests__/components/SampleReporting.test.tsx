import {render,screen} from "@testing-library/react";
import AdminDashboard from "@/app/(admin)/admin/dashboard/page";
import DoctorAnalytics from "@/app/(doctor)/doctor/analytics/page";
jest.mock("recharts",()=>{const React=jest.requireActual<typeof import("react")>("react");const Chart=({children}:{children:import("react").ReactNode})=>React.createElement("div",null,children);return Object.fromEntries(["BarChart","Bar","PieChart","Pie","Cell","LineChart","Line","XAxis","YAxis","CartesianGrid","Tooltip","ResponsiveContainer"].map(name=>[name,Chart]));});
test.each([["admin",AdminDashboard],["analytics",DoctorAnalytics]] as const)("%s makes sample reporting explicit immediately",(_name,Page)=>{
 render(<Page/>);expect(screen.getByRole("status")).toHaveTextContent(/Sample data/);
 expect(screen.getByText(/live reporting is unavailable/i)).toBeInTheDocument();
});
