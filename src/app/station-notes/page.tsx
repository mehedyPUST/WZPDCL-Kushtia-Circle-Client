import ShiftMessagesView from "@/components/ShiftMessagesView";

export const metadata = {
  title: "Station Notes | WZPDCL Bottail",
  description:
    "Operational station notes between duty shifts at Bottail 33/11 kV substation.",
};

export default function StationNotesPage() {
  return <ShiftMessagesView />;
}
