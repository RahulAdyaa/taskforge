import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Send, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VoiceAgentController({ onVoiceSubmit, isParsing }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied. Click the keyboard icon to type voice command.');
        setShowManualInput(true);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      setShowManualInput(true);
      toast.error('Browser Web Speech API not supported. You can type spoken commands directly!');
      return;
    }

    if (isListening) {
      stopListeningAndSubmit();
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.success('🎙️ Voice Agent listening... Speak your task assignments and deadlines!');
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const stopListeningAndSubmit = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    if (transcript.trim()) {
      handleSubmitTranscript(transcript);
    }
  };

  const handleSubmitTranscript = (textToSubmit) => {
    if (!textToSubmit.trim()) return;
    
    onVoiceSubmit(textToSubmit, () => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance("Applied your spoken task updates.");
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Voice Control Toolbar Bar */}
      <div className="flex items-center gap-2 bg-[#1A1A1A] p-2 rounded-xl border border-[#E8E4DD]/10">
        <button
          type="button"
          onClick={toggleListening}
          disabled={isParsing}
          className={`relative p-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
            isListening
              ? 'bg-[#E63B2E] text-white shadow-[0_0_20px_rgba(230,59,46,0.6)] animate-pulse'
              : 'bg-[#222225] hover:bg-[#2C2C30] text-[#E8E4DD] border border-[#E8E4DD]/15'
          }`}
          title={isListening ? "Click to Stop & Parse" : "Start Voice Agent"}
        >
          {isListening ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <MicOff className="w-4 h-4 text-white" />
              <span>Stop & Update</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-[#E63B2E]" />
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
              <span>Voice Agent</span>
            </>
          )}
        </button>

        {/* Live Transcript Display */}
        {isListening && (
          <div className="flex-1 bg-black/60 px-3 py-1.5 rounded-lg border border-[#E63B2E]/30 flex items-center gap-2 overflow-hidden">
            <span className="font-mono text-[10px] text-[#E63B2E] font-bold uppercase tracking-wider shrink-0 animate-pulse">
              Listening:
            </span>
            <span className="font-mono text-xs text-white/90 truncate italic">
              {transcript || "Say e.g. 'Task 1 assign to Rahul due tomorrow 5pm'..."}
            </span>
          </div>
        )}

        {!isListening && transcript && (
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmitTranscript(transcript)}
              disabled={isParsing}
              className="bg-[#E63B2E]/20 hover:bg-[#E63B2E]/30 text-[#E63B2E] px-3 py-1.5 rounded-lg font-mono text-xs font-medium border border-[#E63B2E]/40 flex items-center gap-1.5 transition-colors"
            >
              {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Apply Voice Command</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="p-2 text-[#E8E4DD]/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors font-mono text-xs"
          title="Type spoken instruction"
        >
          💬
        </button>
      </div>

      {/* Manual Input Drawer / Toggle */}
      {showManualInput && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualText.trim()) {
              handleSubmitTranscript(manualText);
              setManualText('');
            }
          }}
          className="flex items-center gap-2 bg-black border border-[#E8E4DD]/20 p-2 rounded-xl animate-[fadeIn_0.2s_ease-out]"
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Type voice command e.g. 'Task 1 to Rahul tomorrow 5pm, Task 2 to Sarah urgent'"
            className="flex-1 bg-transparent text-xs text-white font-mono outline-none px-2 placeholder-[#E8E4DD]/30"
          />
          <button
            type="submit"
            disabled={isParsing || !manualText.trim()}
            className="bg-[#E63B2E] text-white px-3 py-1.5 rounded-lg font-mono text-xs hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Run'}
          </button>
        </form>
      )}
    </div>
  );
}
