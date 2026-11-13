import MonthlyEnergyView from "@/components/MonthlyEnergyView";

export const metadata = {
  title: "Monthly Energy Reading | WZPDCL Bottail",
  description:
    "Admin sheet for monthly feeder energy readings, max load, and interruption data at Bottail SS.",
};

export default function MonthlyEnergyPage() {
  return <MonthlyEnergyView />;
}
