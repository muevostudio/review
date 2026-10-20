// Servidor do Muevo Review (Supabase). A sessão vai no cabeçalho Authorization, nunca no endereço.
window.MUEVO_API = "https://gfejhvmbdbepldgubrkl.supabase.co/functions/v1/api";
// Chave da API do Google (só leitura do Drive), travada para o domínio do site no Google Cloud.
window.MUEVO_GKEY = "AIzaSyCimZtm1XW-pavwp9Tz0XGlxErdNcRNJAo";
// Login do Google (só para escolher vídeos do Drive). Acesso apenas aos arquivos que a pessoa escolher.
window.MUEVO_GCLIENT = "276045456946-hbo9u7qggttd5tg23cdrlto26mqirjuv.apps.googleusercontent.com";
window.MUEVO_GAPPID = "276045456946";

// Endereço público do R2 (o mesmo que aparece nos links das prévias). As páginas do cliente leem daqui
// uma cópia da ficha e abrem na hora, sem esperar a planilha. Vazio = desligado.
window.MUEVO_R2_PUBLICO = "https://pub-7c7106d5e0644c66a3aa41fb8aea86bd.r2.dev";

