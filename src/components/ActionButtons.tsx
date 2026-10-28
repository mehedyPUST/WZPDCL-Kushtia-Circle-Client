export default function ActionButtons({ onCalculate }) {
    return (
        <div className="px-3 pb-4 grid grid-cols-2 gap-3 flex-shrink-0">
            <button
                onClick={onCalculate}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold h-11 rounded-2xl transition-all text-sm shadow"
            >
                Calculate
            </button>
            <button
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold h-11 rounded-2xl transition-all text-sm shadow"
            >
                Copy Total
            </button>
        </div>
    );
}