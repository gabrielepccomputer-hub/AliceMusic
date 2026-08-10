// ============================================
// AliceMusic — Configurazione
// ============================================
// Qui dentro c'è la tua API key di YouTube Data API v3.
// ATTENZIONE (leggi anche il messaggio che ti ho scritto in chat):
// una API key dentro un file .js è comunque visibile a chiunque
// apra il "Visualizza sorgente" della pagina o gli strumenti sviluppatore.
// Metterla in un file separato NON la nasconde, serve solo a tenere
// il codice più pulito. Per proteggerla davvero vai su
// Google Cloud Console > Credenziali > (la tua chiave) > "Restrizioni
// applicazione" e impostala su "App Android" con il tuo package name
// e l'impronta SHA-1, oppure su "Referrer HTTP" se la usi solo sul web.

const ALICE_CONFIG = {
  YOUTUBE_API_KEY: "AIzaSyCk9mko_M8eELEk8DDyQmT8IviyrQuclyI",
  MAX_RESULTS: 20
};
