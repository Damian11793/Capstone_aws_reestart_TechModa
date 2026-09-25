import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Trash2, Download, RefreshCw } from 'lucide-react';

interface SentimentEntry {
  timestamp: string;
  message: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  score: number;
}

export function SentimentAnalysis() {
  const [history, setHistory] = useState<SentimentEntry[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
    avgScore: 0
  });

  useEffect(() => {
    loadHistory();

    // Polling para recargar datos cada 2 segundos (mientras pestaña está activa)
    const interval = setInterval(() => {
      loadHistory();
    }, 2000);

    // Escuchar cambios en localStorage desde otras pestañas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sentiment_history') {
        loadHistory();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadHistory = () => {
    const stored = localStorage.getItem('sentiment_history');
    if (stored) {
      const data: SentimentEntry[] = JSON.parse(stored);
      setHistory(data);
      calculateStats(data);
    }
  };

  const calculateStats = (data: SentimentEntry[]) => {
    const counts = {
      POSITIVE: 0,
      NEGATIVE: 0,
      NEUTRAL: 0,
      MIXED: 0
    };

    let totalScore = 0;

    data.forEach(entry => {
      counts[entry.sentiment]++;
      totalScore += entry.score;
    });

    setStats({
      total: data.length,
      positive: counts.POSITIVE,
      negative: counts.NEGATIVE,
      neutral: counts.NEUTRAL,
      mixed: counts.MIXED,
      avgScore: data.length > 0 ? totalScore / data.length : 0
    });
  };

  const handleClear = () => {
    if (confirm('¿Estás seguro de que deseas borrar todo el historial?')) {
      localStorage.removeItem('sentiment_history');
      setHistory([]);
      setStats({
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
        avgScore: 0
      });
    }
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentiment-analysis-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sentimentDistribution = [
    { name: 'Positivo', value: stats.positive, color: '#10b981' },
    { name: 'Negativo', value: stats.negative, color: '#ef4444' },
    { name: 'Neutral', value: stats.neutral, color: '#6b7280' },
    { name: 'Mixto', value: stats.mixed, color: '#f59e0b' }
  ];

  const timelineData = history.slice(-20).map((entry, idx) => ({
    id: idx,
    time: new Date(entry.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    score: Math.round(entry.score * 100)
  }));

  const getSentimentEmoji = (sentiment: string) => {
    switch(sentiment) {
      case 'POSITIVE': return '😊';
      case 'NEGATIVE': return '😞';
      case 'MIXED': return '😐';
      default: return '😊';
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">📊 Análisis de Sentimientos</h2>
          <p className="text-gray-600 mt-1">Powered by AWS Comprehend</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Cargar Métricas
          </button>
          <button
            onClick={handleDownload}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar JSON
          </button>
          <button
            onClick={handleClear}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 text-lg">No hay datos de sentimiento aún.</p>
          <p className="text-gray-400 text-sm mt-2">Envía mensajes en el ChatBot para comenzar el análisis.</p>
        </div>
      ) : (
        <>
          {/* Estadísticas Generales */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium">Total Mensajes</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm">
              <p className="text-green-700 text-sm font-medium">😊 Positivos</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.positive}</p>
              <p className="text-xs text-green-600 mt-1">{stats.total > 0 ? ((stats.positive/stats.total)*100).toFixed(0) : 0}%</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
              <p className="text-red-700 text-sm font-medium">😞 Negativos</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.negative}</p>
              <p className="text-xs text-red-600 mt-1">{stats.total > 0 ? ((stats.negative/stats.total)*100).toFixed(0) : 0}%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-gray-700 text-sm font-medium">😐 Neutral</p>
              <p className="text-3xl font-bold text-gray-600 mt-2">{stats.neutral}</p>
              <p className="text-xs text-gray-600 mt-1">{stats.total > 0 ? ((stats.neutral/stats.total)*100).toFixed(0) : 0}%</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 shadow-sm">
              <p className="text-amber-700 text-sm font-medium">⭐ Score Avg</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{(stats.avgScore * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución Pie Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Sentimientos</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Timeline Score Bar Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Scores (últimos 20)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" name="Confianza (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historial Detallado */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Historial Detallado</h3>
              <p className="text-sm text-gray-600 mt-1">Últimos 50 mensajes analizados</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Sentimiento</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Mensaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...history].reverse().slice(0, 50).map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: entry.sentiment === 'POSITIVE' ? '#d1fae5' :
                                           entry.sentiment === 'NEGATIVE' ? '#fee2e2' :
                                           entry.sentiment === 'MIXED' ? '#fef3c7' :
                                           '#f3f4f6',
                            color: entry.sentiment === 'POSITIVE' ? '#059669' :
                                  entry.sentiment === 'NEGATIVE' ? '#dc2626' :
                                  entry.sentiment === 'MIXED' ? '#d97706' :
                                  '#374151'
                          }}
                        >
                          {getSentimentEmoji(entry.sentiment)} {entry.sentiment}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${entry.score * 100}%` }}
                            />
                          </div>
                          <span className="text-gray-600 font-medium text-xs">{(entry.score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                        {entry.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SentimentAnalysis;
