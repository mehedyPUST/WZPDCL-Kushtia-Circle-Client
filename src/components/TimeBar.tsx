export default function TimeBar({ currentTime }) {
    return (
        <div className="bg-black text-white text-center py-1.5 text-xs font-medium flex-shrink-0">
            {currentTime || "Friday, July 3, 2026 04:22:59 PM"}
        </div>
    );
}