/* eslint-disable quotes */
// Disable quotes as these will be ported to a separate JSON file in future.

// @SRC: https://developers.google.com/assistant/sdk/reference/rpc/languages
const supportedLanguages = {
  "de-DE": {
    langName: "Deutsch (Deutschland)",
    welcomeMessage: "Hallo! Wie kann ich helfen?",
    inputPlaceholder: "Frag mich was...",
    listeningMessage: "Hören...",
    initSuggestions: [
      { label: "Wetter", query: "Wie ist das Wetter heute?" },
      { label: "Wirf eine Münze", query: "Wirf eine Münze" },
      { label: "Was kannst du tun?", query: "Was kannst du tun?" },
    ],
    noSuggestionsText: "Keine Vorschläge.",
    settingsUpdatedText: "Einstellungen aktualisiert!",
  },
  "en-AU": {
    langName: "English (Australia)",
    welcomeMessage: "Hi! How can I help?",
    inputPlaceholder: "Ask me anything...",
    listeningMessage: "Listening...",
    initSuggestions: [
      { label: "Weather", query: "How\\'s the Weather today?" },
      { label: "Toss a coin", query: "Toss a coin" },
      { label: "What can you do?", query: "What can you do?" },
    ],
    noSuggestionsText: "No suggestions.",
    settingsUpdatedText: "Settings Updated!",
  },
  "en-CA": {
    langName: "English (Canada)",
    welcomeMessage: "Hi! How can I help?",
    inputPlaceholder: "Ask me anything...",
    listeningMessage: "Listening...",
    initSuggestions: [
      { label: "Weather", query: "How\\'s the Weather today?" },
      { label: "Toss a coin", query: "Toss a coin" },
      { label: "What can you do?", query: "What can you do?" },
    ],
    noSuggestionsText: "No suggestions.",
    settingsUpdatedText: "Settings Updated!",
  },
  "en-GB": {
    langName: "English (Great Britain)",
    welcomeMessage: "Hi! How can I help?",
    inputPlaceholder: "Ask me anything...",
    listeningMessage: "Listening...",
    initSuggestions: [
      { label: "Weather", query: "How\\'s the Weather today?" },
      { label: "Toss a coin", query: "Toss a coin" },
      { label: "What can you do?", query: "What can you do?" },
    ],
    noSuggestionsText: "No suggestions.",
    settingsUpdatedText: "Settings Updated!",
  },
  "en-IN": {
    langName: "English (India)",
    welcomeMessage: "Hi! How can I help?",
    inputPlaceholder: "Ask me anything...",
    listeningMessage: "Listening...",
    initSuggestions: [
      { label: "Weather", query: "How\\'s the Weather today?" },
      { label: "Toss a coin", query: "Toss a coin" },
      { label: "What can you do?", query: "What can you do?" },
    ],
    noSuggestionsText: "No suggestions.",
    settingsUpdatedText: "Settings Updated!",
  },
  "en-US": {
    langName: "English (United States)",
    welcomeMessage: "Hi! How can I help?",
    inputPlaceholder: "Ask me anything...",
    listeningMessage: "Listening...",
    initSuggestions: [
      { label: "Weather", query: "How\\'s the Weather today?" },
      { label: "Toss a coin", query: "Toss a coin" },
      { label: "What can you do?", query: "What can you do?" },
    ],
    noSuggestionsText: "No suggestions.",
    settingsUpdatedText: "Settings Updated!",
  },
  "es-ES": {
    langName: "Español (España)",
    welcomeMessage: "¡Hola! ¿Cómo puedo ayudar?",
    inputPlaceholder: "Pregúntame lo que sea...",
    listeningMessage: "Escuchando...",
    initSuggestions: [
      { label: "Clima", query: "¿Cómo está el clima hoy?" },
      { label: "Tirar una moneda", query: "Lanza una moneda" },
      { label: "¿Qué puedes hacer?", query: "¿Qué puedes hacer?" },
    ],
    noSuggestionsText: "Sin sugerencias.",
    settingsUpdatedText: "¡Configuración actualizada!",
  },
  "es-MX": {
    langName: "Español (México)",
    welcomeMessage: "¡Hola! ¿En qué te puedo ayudar?",
    inputPlaceholder: "Pregúntame lo que sea...",
    listeningMessage: "Escuchando...",
    initSuggestions: [
      { label: "Clima", query: "¿Cómo está el clima hoy?" },
      { label: "Tirar una moneda", query: "Tirar una moneda" },
      { label: "¿Qué puedes hacer?", query: "¿Qué puedes hacer?" },
    ],
    noSuggestionsText: "Sin sugerencias.",
    settingsUpdatedText: "¡Configuración actualizada!",
  },
  "fr-CA": {
    langName: "Français (Canada)",
    welcomeMessage: "Salut! Comment puis-je aider?",
    inputPlaceholder: "Demande-moi n'importe quoi...",
    listeningMessage: "Écoute...",
    initSuggestions: [
      { label: "Temps", query: "Quel temps fait-il aujourd\\'hui?" },
      { label: "Un tirage au sort", query: "Un tirage au sort" },
      {
        label: "Que pouvez-vous faire?",
        query: "Que pouvez-vous faire?",
      },
    ],
    noSuggestionsText: "Pas de suggestions.",
    settingsUpdatedText: "Réglages a Réussi!",
  },
  "fr-FR": {
    langName: "Français (France)",
    welcomeMessage: "Salut! Comment puis-je aider?",
    inputPlaceholder: "Demande-moi n'importe quoi...",
    listeningMessage: "Écoute...",
    initSuggestions: [
      { label: "Temps", query: "Quel temps fait-il aujourd\\'hui?" },
      { label: "Un tirage au sort", query: "Un tirage au sort" },
      {
        label: "Que pouvez-vous faire?",
        query: "Que pouvez-vous faire?",
      },
    ],
    noSuggestionsText: "Pas de suggestions.",
    settingsUpdatedText: "Réglages a Réussi!",
  },
  "it-IT": {
    langName: "Italiano (Italia)",
    welcomeMessage: "Ciao! Come posso aiutare?",
    inputPlaceholder: "Chiedimi qualunque cosa...",
    listeningMessage: "Ascoltando...",
    initSuggestions: [
      { label: "Tempo metereologico", query: "Com\\'è il tempo oggi?" },
      { label: "Lancia una moneta", query: "Lancia una moneta" },
      { label: "Cosa sai fare?", query: "Cosa sai fare?" },
    ],
    noSuggestionsText: "Nessun suggerimento.",
    settingsUpdatedText: "Impostazioni aggiornate!",
  },
  "ja-JP": {
    langName: "日本語（日本）",
    welcomeMessage: "こんにちは！ 手伝いましょうか？",
    inputPlaceholder: "何でも聞いてください...",
    listeningMessage: "聞いています...",
    initSuggestions: [
      { label: "天気", query: "今日の天気は？" },
      { label: "コインを投げて", query: "コインを投げて" },
      { label: "何ができる？", query: "何ができる？" },
    ],
    noSuggestionsText: "提案はありません。",
    settingsUpdatedText: "設定が更新されました！",
  },
  "ko-KR": {
    langName: "한국어 (대한민국)",
    welcomeMessage: "안녕하세요! 내가 어떻게 도움이 될 수 있습니다?",
    inputPlaceholder: "무엇이든 물어보세요...",
    listeningMessage: "청취...",
    initSuggestions: [
      { label: "날씨", query: "오늘의 날씨는 어떻습니까?" },
      { label: "동전을 던지세요", query: "동전을 던지세요" },
      {
        label: "당신은 무엇을 할 수 있나요?",
        query: "당신은 무엇을 할 수 있나요?",
      },
    ],
    noSuggestionsText: "제안이 없습니다.",
    settingsUpdatedText: "설정이 업데이트!",
  },
  "pt-BR": {
    langName: "Português (Brasil)",
    welcomeMessage: "Oi! Como posso ajudar?",
    inputPlaceholder: "Me pergunte qualquer coisa...",
    listeningMessage: "Ouvindo...",
    initSuggestions: [
      { label: "Clima", query: "Como está o tempo hoje?" },
      { label: "Lançar uma moeda", query: "Lançar uma moeda" },
      {
        label: "O que você pode fazer?",
        query: "O que você pode fazer?",
      },
    ],
    noSuggestionsText: "Nenhuma sugestão.",
    settingsUpdatedText: "Configurações Atualizadas!",
  },
};

module.exports = supportedLanguages;
