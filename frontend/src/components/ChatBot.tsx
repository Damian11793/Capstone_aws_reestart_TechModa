import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Smile, Volume2, ImagePlus } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sentiment?: {
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
    score: number;
  };
  imageBase64?: string;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem('chat_history');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [{ role: 'assistant', content: '¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?' }];
      }
    }
    return [{ role: 'assistant', content: '¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?' }];
  });
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get URLs from runtime config
  const S8_URL = (window as any).__ENV?.VITE_S8_URL ||
    'https://7f6oiirakebphzw3ctqstxgf4e0zuust.lambda-url.us-east-1.on.aws';
  const S3_URL = (window as any).__ENV?.VITE_S3_URL ||
    'https://is74o5mes2qews6ev5ik35vbo40dofva.lambda-url.us-east-1.on.aws';
  const S5_URL = (window as any).__ENV?.VITE_S5_URL ||
    'https://sym67ldgv54aul3q7zsaqqgwwe0qhnbx.lambda-url.us-east-1.on.aws';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reproducir saludo inicial cuando abre el chat
  useEffect(() => {
    if (isOpen && messages.length === 1) {
      playText(messages[0].content);
    }
  }, [isOpen]);

  const playText = async (text: string) => {
    try {
      console.log('🔊 Solicitando audio para:', text);
      const response = await fetch(`${S5_URL.replace(/\/$/, '')}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'es' })
      });

      if (!response.ok) {
        console.error('❌ Error en respuesta S5:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.log('✅ Respuesta S5:', data);

      if (data.audioUrl) {
        console.log('🎵 Reproduciendo:', data.audioUrl);
        const audio = new Audio(data.audioUrl);

        audio.addEventListener('error', (e) => {
          console.error('❌ Error al cargar audio:', e);
        });

        audio.addEventListener('ended', () => {
          console.log('✅ Audio completado');
        });

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log('✅ Audio reproduciendo'))
            .catch(err => console.error('❌ Error al reproducir:', err));
        }
      } else {
        console.error('❌ No hay audioUrl en respuesta:', data);
      }
    } catch (error) {
      console.error('❌ Audio playback failed:', error);
    }
  };

  const analyzeSentiment = async (text: string) => {
    try {
      const response = await fetch(`${S3_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const data = await response.json();
        const sentimentResult = data.results?.[0];
        if (sentimentResult) {
          const scores = Object.values(sentimentResult.scores || {}) as number[];
          return {
            sentiment: sentimentResult.sentiment || 'NEUTRAL',
            score: scores.length > 0 ? Math.max(...scores) : 0
          };
        }
      }
    } catch (error) {
      console.log('Sentiment analysis failed:', error);
    }
    return undefined;
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        setSelectedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

    const userText = input;

    // Add user message with image if present
    const userMessage: Message = {
      role: 'user',
      content: userText || '📸 [Imagen enviada]',
      imageBase64: selectedImage || undefined
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      // Analyze sentiment of user message
      const sentiment = await analyzeSentiment(userText || 'imagen');

      // Build conversation history (exclude greeting for context)
      const conversationHistory = updatedMessages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call S8 ShoppingAssistant with full history and image if present
      const body: any = {
        message: userText || 'Analiza esta imagen de un producto',
        conversationHistory: conversationHistory
      };
      if (selectedImage) {
        body.image = selectedImage;
      }

      const response = await fetch(`${S8_URL.replace(/\/$/, '')}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || 'Lo siento, no pude procesar tu solicitud.'
      };

      // Update user message with sentiment
      setMessages(prev => {
        const updated = [...prev];
        const lastUserMsgIdx = updated.length - 1;
        if (updated[lastUserMsgIdx]?.role === 'user' && sentiment) {
          updated[lastUserMsgIdx].sentiment = sentiment;

          // Persist to localStorage for sentiment dashboard
          const sentimentHistory = JSON.parse(localStorage.getItem('sentiment_history') || '[]');
          sentimentHistory.push({
            timestamp: new Date().toISOString(),
            message: userText,
            sentiment: sentiment.sentiment,
            score: sentiment.score
          });
          localStorage.setItem('sentiment_history', JSON.stringify(sentimentHistory));
        }
        updated.push(assistantMessage);

        // Persist chat history to localStorage
        localStorage.setItem('chat_history', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Algo salió mal'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 z-40"
          aria-label="Abrir chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Asistente de Compras</h3>
              <p className="text-sm text-blue-100">Powered by Claude</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMessages([{ role: 'assistant', content: '¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?' }]);
                  localStorage.setItem('chat_history', JSON.stringify([{ role: 'assistant', content: '¡Hola! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?' }]));
                }}
                className="hover:bg-blue-700 p-1 rounded transition-colors text-xs"
                title="Limpiar conversación"
              >
                🔄
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
                aria-label="Cerrar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => {
              const sentimentEmoji = msg.sentiment ? (
                msg.sentiment.sentiment === 'POSITIVE' ? '😊' :
                msg.sentiment.sentiment === 'NEGATIVE' ? '😞' :
                msg.sentiment.sentiment === 'MIXED' ? '😐' :
                '😊'
              ) : null;

              return (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm break-words">{msg.content}</p>
                  </div>
                  {sentimentEmoji && msg.role === 'user' && (
                    <div className="flex items-end text-lg" title={`${msg.sentiment?.sentiment} (${(msg.sentiment?.score || 0).toFixed(2)})`}>
                      {sentimentEmoji}
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => playText(msg.content)}
                      className="flex items-end text-gray-600 hover:text-blue-600 transition-colors"
                      title="Reproducir en voz"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4 bg-white space-y-2">
            {selectedImage && (
              <div className="relative w-full h-24 bg-gray-100 rounded-lg p-2">
                <img
                  src={`data:image/jpeg;base64,${selectedImage}`}
                  alt="Selected"
                  className="w-full h-full object-cover rounded"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                placeholder="Escribe tu pregunta..."
                disabled={loading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg transition-colors"
                title="Subir imagen"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={loading || (!input.trim() && !selectedImage)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors"
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
