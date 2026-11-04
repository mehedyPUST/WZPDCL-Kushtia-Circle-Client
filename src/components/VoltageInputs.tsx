export default function VoltageInputs({ busVoltages, onVoltageChange, handleWheel, handleKeyDown }) {
    return (
        <div className="p-3 grid grid-cols-2 gap-3 bg-white flex-shrink-0">
            <div>
                <label className="text-[10px] font-medium text-muted">BUS-2 VOLTAGE (kV) *</label>
                <input
                    type="number"
                    value={busVoltages.bus2}
                    onChange={(e) => onVoltageChange("bus2", e.target.value)}
                    placeholder="33"
                    onWheel={handleWheel}
                    onKeyDown={handleKeyDown}
                    className="w-full mt-1 px-3 py-2 border border-app rounded-xl text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
            </div>
            <div>
                <label className="text-[10px] font-medium text-muted">BUS-1 VOLTAGE (kV) *</label>
                <input
                    type="number"
                    value={busVoltages.bus1}
                    onChange={(e) => onVoltageChange("bus1", e.target.value)}
                    placeholder="11"
                    onWheel={handleWheel}
                    onKeyDown={handleKeyDown}
                    className="w-full mt-1 px-3 py-2 border border-app rounded-xl text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
            </div>
        </div>
    );
}