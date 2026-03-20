import React, { useState, useMemo } from 'react';
import { Calculator, Dna, Activity, DollarSign, Info, BookOpen, Layers, Target } from 'lucide-react';

const pricingData = [
  { platform: 'NextSeq2000', flowCell: 'P1', reads: 100e6, cycles: 100, price: 1241.16 },
  { platform: 'NextSeq2000', flowCell: 'P1', reads: 100e6, cycles: 300, price: 1475.66 },
  { platform: 'NextSeq2000', flowCell: 'P1', reads: 100e6, cycles: 600, price: 2064.91 },
  { platform: 'NextSeq2000', flowCell: 'P2', reads: 400e6, cycles: 100, price: 1567.35 },
  { platform: 'NextSeq2000', flowCell: 'P2', reads: 400e6, cycles: 300, price: 1859.56 },
  { platform: 'NextSeq2000', flowCell: 'P2', reads: 400e6, cycles: 600, price: 3593.41 },
  { platform: 'NextSeq2000', flowCell: 'P3', reads: 1.2e9, cycles: 100, price: 2165.00 },
  { platform: 'NextSeq2000', flowCell: 'P3', reads: 1.2e9, cycles: 300, price: 3173.55 },
  { platform: 'NextSeq2000', flowCell: 'P4', reads: 1.8e9, cycles: 100, price: 2869.91 },
  { platform: 'NextSeq2000', flowCell: 'P4', reads: 1.8e9, cycles: 300, price: 4345.01 },
  { platform: 'NovaSeq6000', flowCell: 'S4', reads: 8e9, cycles: 200, price: 16055.38 },
  { platform: 'NovaSeq6000', flowCell: 'S4', reads: 8e9, cycles: 300, price: 18225.38 },
  { platform: 'MiniSeq', flowCell: 'Mid Output', reads: 8e6, cycles: 300, price: 957.52 },
  { platform: 'MiniSeq', flowCell: 'High Output', reads: 25e6, cycles: 75, price: 1301.80 },
  { platform: 'MiniSeq', flowCell: 'High Output', reads: 25e6, cycles: 150, price: 1477.52 },
  { platform: 'MiniSeq', flowCell: 'High Output', reads: 25e6, cycles: 300, price: 2211.53 },
];

const availableCycles = [75, 100, 150, 200, 300, 600];

// Defined outside to prevent focus loss on re-render
const SliderInput = ({ label, value, setter, min, max, step, suffix = "" }) => (
  <div className="flex flex-col space-y-2 mb-4">
    <div className="flex justify-between items-center">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            setter(val === '' ? '' : Number(val));
          }}
          className="w-24 px-2 py-1 text-right border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <span className="text-sm text-slate-500 w-8">{suffix}</span>
      </div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value === '' ? min : value}
      onChange={(e) => setter(Number(e.target.value))}
      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
    />
  </div>
);

export default function App() {
  // States
  const [probeCount, setProbeCount] = useState(10000);
  const [probeLength, setProbeLength] = useState(120);
  const [desiredDepth, setDesiredDepth] = useState(200);
  const [numSamples, setNumSamples] = useState(96);
  const [offTargetRate, setOffTargetRate] = useState(30); 
  const [duplicateRate, setDuplicateRate] = useState(35);
  const [selectedCycles, setSelectedCycles] = useState(300);

  // Formatters
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(Math.round(num));
  const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  // --- MODEL 1: BASE-TO-CLUSTER RESOLUTION ---
  const lengthMetrics = useMemo(() => {
    const targetSizeBp = probeCount * probeLength;
    const effectiveBaseReq = targetSizeBp * desiredDepth;
    const onTargetFraction = 1 - (offTargetRate / 100);
    const rawBaseReq = effectiveBaseReq / (onTargetFraction * (1 - (duplicateRate / 100)));
    const totalReadsNeeded = (rawBaseReq * numSamples) / selectedCycles;
    return { targetSizeBp, totalReadsNeeded };
  }, [probeCount, probeLength, desiredDepth, numSamples, offTargetRate, duplicateRate, selectedCycles]);

  // --- MODEL 2: MULTIPLIER ESTIMATION ---
  const multiplierMetrics = useMemo(() => {
    const offTargetFraction = offTargetRate / 100;
    const dupFraction = duplicateRate / 100;
    // Probe Count * Off-target multiplier * Dup multiplier * Depth * Samples
    const totalReadsNeeded = probeCount * (1 + offTargetFraction) * (1 + dupFraction) * desiredDepth * numSamples;
    return { totalReadsNeeded };
  }, [probeCount, desiredDepth, numSamples, offTargetRate, duplicateRate]);

  // Cost Optimization Engine
  const getOptimizedOptions = (totalReadsNeeded) => {
    return pricingData
      .filter((kit) => kit.cycles === selectedCycles)
      .map((kit) => {
        const flowCellsNeeded = Math.ceil(totalReadsNeeded / kit.reads);
        const totalCost = flowCellsNeeded * kit.price;
        const wastePercentage = (((flowCellsNeeded * kit.reads) - totalReadsNeeded) / (flowCellsNeeded * kit.reads)) * 100;
        return { ...kit, flowCellsNeeded, totalCost, wastePercentage };
      })
      .sort((a, b) => a.totalCost - b.totalCost);
  };

  const lengthOptions = getOptimizedOptions(lengthMetrics.totalReadsNeeded);
  const multiplierOptions = getOptimizedOptions(multiplierMetrics.totalReadsNeeded);

  const CostTable = ({ options, highlightColor }) => {
    if (options.length === 0) return <p className="text-sm text-slate-500 italic p-4">No compatible flow cells found for selected cycles.</p>;
    
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 mt-4">
        <table className="w-full text-left border-collapse bg-white">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-3 font-semibold">Flow Cell</th>
              <th className="p-3 font-semibold text-center">Qty</th>
              <th className="p-3 font-semibold text-right">Waste</th>
              <th className="p-3 font-semibold text-right">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {options.slice(0, 3).map((opt, idx) => ( 
              <tr key={`${opt.platform}-${opt.flowCell}`} className={idx === 0 ? `${highlightColor} bg-opacity-20` : ""}>
                <td className="p-3 text-sm">
                  <div className="font-semibold text-slate-800">{opt.flowCell}</div>
                  <div className="text-xs text-slate-500">{opt.platform}</div>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${idx === 0 ? 'bg-white shadow-sm' : 'bg-slate-100 text-slate-800'}`}>
                    {opt.flowCellsNeeded}
                  </span>
                </td>
                <td className="p-3 text-right text-sm text-slate-600">
                  {opt.wastePercentage.toFixed(0)}%
                </td>
                <td className="p-3 text-right font-bold text-slate-900">
                  {formatMoney(opt.totalCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-4 bg-indigo-600 rounded-xl shadow-inner">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Targeted Methylation Sequencing Calculator</h1>
            <p className="text-sm text-slate-500">Compare projection models to establish operational sequencing budgets.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Panel (Left, 4 columns) */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold border-b pb-2 mb-4 flex items-center"><Dna className="w-5 h-5 mr-2 text-indigo-600"/> Parameters</h2>
            
            <SliderInput label="Probe Count" value={probeCount} setter={setProbeCount} min={0} max={20000} step={1} />
            <SliderInput label="Probe Length" value={probeLength} setter={setProbeLength} min={40} max={250} step={1} suffix="bp" />
            <SliderInput label="Num Samples" value={numSamples} setter={setNumSamples} min={1} max={200} step={1} />
            <SliderInput label="Desired Depth" value={desiredDepth} setter={setDesiredDepth} min={1} max={500} step={1} suffix="X" />
            
            <h2 className="text-lg font-bold border-b pb-2 mt-8 mb-4 flex items-center"><Activity className="w-5 h-5 mr-2 text-teal-600"/> Efficiency Metrics</h2>
            <SliderInput label="Off-Target Rate" value={offTargetRate} setter={setOffTargetRate} min={0} max={90} step={1} suffix="%" />
            <SliderInput label="Duplicate Rate" value={duplicateRate} setter={setDuplicateRate} min={0} max={80} step={1} suffix="%" />

            <div className="mt-6">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Sequencing Cycles (Run Mode)</label>
              <select 
                value={selectedCycles} 
                onChange={(e) => setSelectedCycles(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {availableCycles.map(c => (
                  <option key={c} value={c}>{c} Cycles {c===300 ? '(e.g., 2x150bp PE)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Panel (Right, 8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Split Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Length-Aware Math Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 overflow-hidden flex flex-col">
                <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between">
                  <h3 className="font-bold text-indigo-900 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-indigo-600" />
                    Base-to-Cluster Resolution
                  </h3>
                  <span className="text-xs font-semibold px-2 py-1 bg-indigo-200 text-indigo-800 rounded-full">Length Inclusive</span>
                </div>
                <div className="p-6 flex-grow">
                  <div className="mb-4">
                    <p className="text-sm text-slate-500 font-medium">Total Reads Required</p>
                    <p className="text-4xl font-extrabold text-indigo-600 mt-1">{formatNumber(lengthMetrics.totalReadsNeeded / 1e6)}M</p>
                  </div>
                  <CostTable options={lengthOptions} highlightColor="bg-indigo-100" />
                </div>
              </div>

              {/* Multiplier Math Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-teal-200 overflow-hidden flex flex-col">
                <div className="bg-teal-50 p-4 border-b border-teal-100 flex items-center justify-between">
                  <h3 className="font-bold text-teal-900 flex items-center">
                    <Layers className="w-5 h-5 mr-2 text-teal-600" />
                    Multiplier Estimation
                  </h3>
                  <span className="text-xs font-semibold px-2 py-1 bg-teal-200 text-teal-800 rounded-full">Standard Heuristic</span>
                </div>
                <div className="p-6 flex-grow">
                  <div className="mb-4">
                    <p className="text-sm text-slate-500 font-medium">Total Reads Required</p>
                    <p className="text-4xl font-extrabold text-teal-600 mt-1">{formatNumber(multiplierMetrics.totalReadsNeeded / 1e6)}M</p>
                  </div>
                  <CostTable options={multiplierOptions} highlightColor="bg-teal-100" />
                </div>
              </div>

            </div>

            {/* Explanation Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                <BookOpen className="w-6 h-6 mr-2 text-slate-600" />
                Biostatistical Models
              </h2>
              
              <div className="space-y-6 text-sm text-slate-700">
                
                {/* Length Logic */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-indigo-700 text-base mb-2">Base-to-Cluster Resolution (Considers Probe & Read Length)</h4>
                  <p className="mb-2"><strong>Formula:</strong> <code>Reads = (({formatNumber(probeCount)} × {probeLength}bp × {desiredDepth}X) / ((1 - {offTargetRate / 100}) × (1 - {duplicateRate / 100})) × {numSamples}) / {selectedCycles}</code></p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>Mechanism:</strong> Calculates the physical target footprint in base pairs, factors in efficiency loss inversely, and divides by the sequencer's base-pair output per cluster.</li>
                    <li><strong>Strengths:</strong> Highly specific to the physical dynamics of the sequencer. Often yields a highly optimized baseline for determining the minimum acceptable flow cell capacity.</li>
                    <li><strong>Limitations:</strong> Assumes a relatively even distribution of reads across the targeted loci.</li>
                  </ul>
                </div>

                {/* Multiplier Logic */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-teal-700 text-base mb-2">Multiplier Estimation (Without Probe & Read Length)</h4>
                  <p className="mb-2"><strong>Formula:</strong> <code>Reads = {formatNumber(probeCount)} × (1 + {offTargetRate / 100}) × (1 + {duplicateRate / 100}) × {desiredDepth} × {numSamples}</code></p>
                  <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>Mechanism:</strong> Applies categorical efficiency multipliers directly to the probe count and requested depth independently of sequencer read mode.</li>
                    <li><strong>Strengths:</strong> Widely used standard heuristic that provides a substantial, robust buffer against unmodeled experimental variables (like extreme GC bias or locus drop-out).</li>
                    <li><strong>Limitations:</strong> Tends to forecast significantly higher read requirements due to the absence of the base-pair translation step.</li>
                  </ul>
                </div>

                {/* Sparse CpG Edge Case Warning */}
                <div className="flex items-start p-4 bg-slate-100 text-slate-800 rounded-xl border border-slate-300">
                  <Info className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5 text-slate-600" />
                  <div>
                    <strong className="block mb-1">Methodological Note: Sparse vs. Continuous Targets</strong>
                    When targeting isolated, single CpGs rather than contiguous tiled regions, the physical library fragment (e.g., ~250bp) must be sequenced in its entirety to access the small target site. <br/><br/>
                    <strong>Application:</strong> In the Base-to-Cluster model, maintaining the <em>Probe Length</em> at {probeLength}bp mathematically reflects this broader capture footprint. Additionally, sparse target designs often display elevated duplicate rates (currently set to {duplicateRate}%) and off-target rates (currently set to {offTargetRate}%) due to reduced library complexity compared to densely tiled panels.
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}