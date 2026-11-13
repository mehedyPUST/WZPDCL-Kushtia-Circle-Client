import UserDashboard from "@/components/UserDashboard";

export const metadata = {
  title: "Operator Dashboard | WZPDCL Bottail",
  description:
    "Operator activity ledger, shift overview, and account security for Bottail 33/11 kV substation.",
};

export default function DashboardPage() {
  return <UserDashboard />;
}
