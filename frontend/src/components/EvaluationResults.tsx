import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Upload, Download, AlertCircle } from 'lucide-react';

interface EvalMetrics {
  context_precision: number;
  faithfulness: number;
  answer_relevance: number;
  context_recall: number;
}

interface EvalResult {
  timestamp: string;
  total_questions: number;
  metrics: EvalMetrics;
  average_score: number;
  case_details: Array<{
    id: number;
    category: string;
    difficulty: string;
    tokens_used: number;
    num_contexts: number;
  }>;
}

export function EvaluationResults() {
  const [results, setResults] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setResults(data);
        setError(null);
      } catch (err) {
        setError('Error al parsear el JSON');
      }
    };
    reader.readAsText(file);
  };

  const downloadResults = () => {
    if (!results) return;
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ragas_results_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return '#10b981'; // green
    if (score >= 0.7) return '#f59e0b';  // amber
    return '#ef4444'; // red
  };

  const chartData = results
    ? [
        { name: 'Context Precision', value: results.metrics.context_precision },
        { name: 'Faithfulness', value: results.metrics.faithfulness },
        { name: 'Answer Relevance', value: results.metrics.answer_relevance },
        { name: 'Context Recall', value: results.metrics.context_recall },
      ]
    : [];

  const categoryStats = results
    ? results.case_details.reduce((acc, item) => {
        const existing = acc.find((x) => x.category === item.category);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ category: item.category, count: 1 });
        }
        return acc;
      }, [] as Array<{ category: string; count: number }>)
    : [];

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 Evaluación RAGAS del ChatBot</h2>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-500 transition">
          <label className="flex items-center justify-center cursor-pointer">
            <div className="text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Carga el JSON de resultados RAGAS</p>
              <p className="text-xs text-gray-500 mt-1">ragas_results.json</p>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </div>

      {results && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Puntuación General</h3>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-bold" style={{ color: getScoreColor(results.average_score) }}>
                  {(results.average_score * 100).toFixed(1)}%
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${results.average_score * 100}%`,
                    backgroundColor: getScoreColor(results.average_score),
                  }}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Preguntas Evaluadas</h3>
              <div className="text-4xl font-bold text-blue-600">{results.total_questions}</div>
              <p className="text-sm text-gray-500 mt-1">Timestamp: {new Date(results.timestamp).toLocaleString('es-MX')}</p>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(results.metrics).map(([key, value]) => (
              <div key={key} className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                  {key.replace(/_/g, ' ')}
                </h4>
                <div className="text-3xl font-bold" style={{ color: getScoreColor(value) }}>
                  {(value * 100).toFixed(1)}%
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${value * 100}%`,
                      backgroundColor: getScoreColor(value),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Métricas Detalladas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 1]} />
                <Tooltip formatter={(value) => `${(value as number * 100).toFixed(1)}%`} />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getScoreColor(entry.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Distribución por Categoría</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categoryStats.map((cat) => (
                <div key={cat.category} className="p-4 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-600">{cat.category}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{cat.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-end">
            <button
              onClick={downloadResults}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download className="w-4 h-4" />
              Descargar Resultados JSON
            </button>
          </div>

          {/* Case Details Table */}
          <div className="bg-white p-6 rounded-lg shadow-sm overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Detalles por Caso</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Categoría</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Dificultad</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Tokens</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Contextos</th>
                </tr>
              </thead>
              <tbody>
                {results.case_details.slice(0, 10).map((detail) => (
                  <tr key={detail.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{detail.id}</td>
                    <td className="px-4 py-2 text-gray-600">{detail.category}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        detail.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        detail.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {detail.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-2">{detail.tokens_used}</td>
                    <td className="px-4 py-2">{detail.num_contexts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.case_details.length > 10 && (
              <p className="text-xs text-gray-500 mt-2">... y {results.case_details.length - 10} más casos</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
