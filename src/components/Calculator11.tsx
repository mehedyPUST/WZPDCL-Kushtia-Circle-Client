// src/components/Calculator.jsx
"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import TimeBar from "./TimeBar";
import VoltageInputs from "./VoltageInputs";
import FeederTable from "./FeederTable";
import Results from "./Results";
import ActionButtons from "./ActionButtons";
import Footer from "./Footer";

// ---------- DATA ----------
const tableData = [
    { id: 1, name: "BRB", bus: 2 },
    { id: 2, name: "MRS", bus: 1 },
    { id: 3, name: "Mozompur", bus: 2 },
    { id: 4, name: "Housing", bus: 1 },
    { id: 5, name: "Rajbari", bus: 1 },
    { id: 6, name: "Campus / GIS", bus: 2 },
    { id: 7, name: "Koburhat", bus: 2 },
    { id: 8, name: "H-3", bus: 1 },
    { id: 9, name: "T-3", bus: 2 },
];

export default function Calculator() {
    const [busVoltages, setBusVoltages] = useState({ bus1: "", bus2: "" });
    const [amps, setAmps] = useState(() => {
        const initial = {};
        tableData.forEach(item => initial[item.id] = "0");
        return initial;
    });
    const [calculate, setCalculate] = useState(false);
    const [currentTime, setCurrentTime] = useState("");

    // Live Time
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
            const dateStr = now.toLocaleDateString('en-US', options);
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setCurrentTime(`${dateStr} ${timeStr}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleBusVoltageChange = (bus, value) => {
        setBusVoltages(prev => ({ ...prev, [bus]: value }));
        setCalculate(false);
    };

    const handleAmpChange = (id, value) => {
        setAmps(prev => ({ ...prev, [id]: value }));
        setCalculate(false);
    };

    const handleAmpBlur = (id) => {
        if (!amps[id] || amps[id].trim() === "") {
            setAmps(prev => ({ ...prev, [id]: "0" }));
        }
    };

    const handleCalculate = () => {
        if (!busVoltages.bus1.trim() || !busVoltages.bus2.trim()) {
            alert("Please enter voltages for both BUS-1 and BUS-2 before calculating.");
            return;
        }
        setCalculate(true);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.blur();
        setTimeout(() => e.target.focus(), 0);
        return false;
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const calculateMW = (id) => {
        if (!calculate) return null;
        const item = tableData.find(i => i.id === id);
        if (!item) return null;

        const amp = parseFloat(amps[id]) || 0;
        if (amp <= 0) return null;

        const voltage = item.bus === 1 ? parseFloat(busVoltages.bus1) : parseFloat(busVoltages.bus2);
        if (!voltage || voltage <= 0) return null;

        return (Math.sqrt(3) * voltage * 0.95 * amp) / 1000;
    };

    const totalMW = tableData.reduce((sum, item) => sum + (calculateMW(item.id) || 0), 0);
    const bottail11kV = (calculateMW(8) || 0) + (calculateMW(9) || 0);

    return (
        <div className="h-screen bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 flex items-center justify-center p-2 overflow-hidden">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden h-[98vh] flex flex-col">

                <Header />
                <TimeBar currentTime={currentTime} />

                <VoltageInputs
                    busVoltages={busVoltages}
                    onVoltageChange={handleBusVoltageChange}
                    handleWheel={handleWheel}
                    handleKeyDown={handleKeyDown}
                />

                <FeederTable
                    tableData={tableData}
                    amps={amps}
                    calculateMW={calculateMW}
                    onAmpChange={handleAmpChange}
                    onAmpBlur={handleAmpBlur}
                    handleWheel={handleWheel}
                    handleKeyDown={handleKeyDown}
                />

                <Results
                    bottail11kV={bottail11kV}
                    totalMW={totalMW}
                    calculate={calculate}
                />

                <ActionButtons
                    onCalculate={handleCalculate}
                />

                <Footer />
            </div>
        </div>
    );
}