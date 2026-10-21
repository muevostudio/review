// Muevo Review · línguas do painel (português, inglês e espanhol)
// O painel é escrito em português. Com outra língua escolhida, cada texto que aparece na tela é trocado
// pela tradução daqui: textos inteiros pelo dicionário e textos com números (3 pastas, há 2 dias) pelas regras.
// A escolha fica no navegador (muevo-lingua) e só vale para o painel da equipe.
(function(){
  "use strict";
  let L = "pt";
  try { const v = localStorage.getItem("muevo-lingua"); if (v === "en" || v === "es") L = v; } catch(e){}

  // português → [inglês, espanhol]
  const D = {
    "Clientes":["Clients","Clientes"], "Cliente":["Client","Cliente"], "Equipe":["Team","Equipo"], "Armazenamento":["Storage","Almacenamiento"],
    "Configurações":["Settings","Configuración"], "Linguagem":["Language","Idioma"], "Sair":["Log out","Cerrar sesión"], "Minha conta":["My account","Mi cuenta"],
    "Sua conta":["Your account","Tu cuenta"], "Início":["Home","Inicio"], "Buscar cliente, pasta ou arquivo":["Search client, folder or file","Buscar cliente, carpeta o archivo"],
    "Buscar":["Search","Buscar"], "Selecionar":["Select","Seleccionar"], "Nova pasta":["New folder","Nueva carpeta"], "Novo arquivo":["New file","Nuevo archivo"],
    "Novo cliente":["New client","Nuevo cliente"], "Modo claro ou escuro":["Light or dark mode","Modo claro u oscuro"], "Alternar modo claro ou escuro":["Toggle light or dark mode","Cambiar modo claro u oscuro"],
    "Ordem das pastas":["Folder order","Orden de las carpetas"], "Ordem alfabética":["Alphabetical order","Orden alfabético"], "Ordem alfabética (A–Z)":["Alphabetical (A–Z)","Alfabético (A–Z)"],
    "Data de criação":["Date created","Fecha de creación"], "Data de criação (mais recentes primeiro)":["Date created (newest first)","Fecha de creación (más recientes primero)"],
    "Ordem personalizada":["Custom order","Orden personalizado"], "Ordem personalizada (a que você arrastou)":["Custom order (the one you dragged)","Orden personalizado (el que arrastraste)"],
    "Arraste para mudar a ordem":["Drag to reorder","Arrastra para cambiar el orden"], "Visualização":["View","Vista"],
    "Selecionar vários arquivos (ou use Cmd/Ctrl + clique)":["Select several files (or use Cmd/Ctrl + click)","Seleccionar varios archivos (o usa Cmd/Ctrl + clic)"],
    "Aguardando revisão":["Awaiting review","Esperando revisión"], "Abrir":["Open","Abrir"], "Abrir pasta":["Open folder","Abrir carpeta"], "Abrir revisão":["Open review","Abrir revisión"],
    "Copiar link":["Copy link","Copiar enlace"], "Copiar link da pasta":["Copy folder link","Copiar enlace de la carpeta"], "Copiar link e senha":["Copy link and password","Copiar enlace y contraseña"],
    "Copiar todos":["Copy all","Copiar todos"], "Copiar todos os links":["Copy all links","Copiar todos los enlaces"], "Compartilhar pasta":["Share folder","Compartir carpeta"],
    "Renomear":["Rename","Renombrar"], "Renomear arquivo":["Rename file","Renombrar archivo"], "Renomear pasta":["Rename folder","Renombrar carpeta"],
    "Renomear ou excluir":["Rename or delete","Renombrar o eliminar"], "Renomear ou excluir a pasta":["Rename or delete the folder","Renombrar o eliminar la carpeta"], "Renomear ou excluir arquivo":["Rename or delete file","Renombrar o eliminar archivo"],
    "Excluir":["Delete","Eliminar"], "Excluir pasta":["Delete folder","Eliminar carpeta"], "Excluir arquivo":["Delete file","Eliminar archivo"], "Excluir cliente":["Delete client","Eliminar cliente"],
    "Pasta interna":["Subfolder","Subcarpeta"], "Mover para…":["Move to…","Mover a…"], "Mover":["Move","Mover"], "Mover para outra pasta":["Move to another folder","Mover a otra carpeta"],
    "Cancelar":["Cancel","Cancelar"], "Confirmar":["Confirm","Confirmar"], "Fechar":["Close","Cerrar"], "Salvar":["Save","Guardar"], "Remover":["Remove","Quitar"],
    "Desativar":["Deactivate","Desactivar"], "Ativar":["Activate","Activar"], "Desativar link":["Deactivate link","Desactivar enlace"], "Ativar link":["Activate link","Activar enlace"],
    "Desativar todos os links":["Deactivate all links","Desactivar todos los enlaces"], "Ativar todos os links":["Activate all links","Activar todos los enlaces"],
    "Bloquear download":["Block download","Bloquear descarga"], "Permitir download":["Allow download","Permitir descarga"], "Bloquear download de todos":["Block download for all","Bloquear descarga de todos"],
    "Permitir download de todos":["Allow download for all","Permitir descarga de todos"], "Colocar senha":["Add password","Poner contraseña"], "Colocar senha na pasta":["Add password to folder","Poner contraseña a la carpeta"],
    "Ver ou trocar a senha":["View or change password","Ver o cambiar la contraseña"], "Ver ou trocar a senha da pasta":["View or change folder password","Ver o cambiar la contraseña de la carpeta"],
    "Senha":["Password","Contraseña"], "Senha da pasta":["Folder password","Contraseña de la carpeta"], "Tirar a senha":["Remove password","Quitar la contraseña"],
    "Selecionar tudo":["Select all","Seleccionar todo"], "Limpar seleção":["Clear selection","Limpiar selección"], "Sair da seleção":["Exit selection","Salir de la selección"], "Sair da seleção (Esc)":["Exit selection (Esc)","Salir de la selección (Esc)"],
    "Nenhum selecionado":["None selected","Ninguno seleccionado"], "vazia":["empty","vacía"], "sem atividade":["no activity","sin actividad"], "agora":["now","ahora"],
    "Sem data":["No date","Sin fecha"], "Sem projeto":["No project","Sin proyecto"], "Sem cliente":["No client","Sin cliente"], "Sem título":["Untitled","Sin título"],
    "Nada encontrado":["Nothing found","No se encontró nada"], "Tente outro nome.":["Try another name.","Prueba otro nombre."], "Nenhuma pasta ainda":["No folders yet","Aún no hay carpetas"],
    "Crie uma pasta para cada projeto deste cliente.":["Create a folder for each project of this client.","Crea una carpeta para cada proyecto de este cliente."],
    "Nenhum cliente ainda":["No clients yet","Aún no hay clientes"], "Nenhum cliente ainda.":["No clients yet.","Aún no hay clientes."], "Nenhum cliente com esse nome.":["No client with that name.","Ningún cliente con ese nombre."],
    "Crie a pasta de um cliente ou envie o primeiro arquivo.":["Create a client folder or upload the first file.","Crea la carpeta de un cliente o sube el primer archivo."],
    "Nenhum arquivo nesta pasta.":["No files in this folder.","No hay archivos en esta carpeta."], "Nenhum arquivo nesta pasta ainda":["No files in this folder yet","Aún no hay archivos en esta carpeta"],
    "Enviar o primeiro":["Upload the first one","Sube el primero"], "Pasta criada":["Folder created","Carpeta creada"], "Essa pasta já existe":["That folder already exists","Esa carpeta ya existe"],
    "Esse cliente já existe":["That client already exists","Ese cliente ya existe"], "Criar pasta":["Create folder","Crear carpeta"], "Nome da pasta":["Folder name","Nombre de la carpeta"],
    "Nome do cliente":["Client name","Nombre del cliente"], "Digite o nome da pasta.":["Type the folder name.","Escribe el nombre de la carpeta."], "Digite o nome do cliente.":["Type the client name.","Escribe el nombre del cliente."],
    "Nova pasta em":["New folder in","Nueva carpeta en"], "Link copiado":["Link copied","Enlace copiado"], "Links copiados":["Links copied","Enlaces copiados"], "Link da pasta copiado":["Folder link copied","Enlace de la carpeta copiado"],
    "Link da pasta e senha copiados":["Folder link and password copied","Enlace de la carpeta y contraseña copiados"], "Link e senha copiados.":["Link and password copied.","Enlace y contraseña copiados."],
    "Link ativado":["Link activated","Enlace activado"], "Link desativado":["Link deactivated","Enlace desactivado"], "Download bloqueado":["Download blocked","Descarga bloqueada"], "Download liberado":["Download allowed","Descarga permitida"],
    "Arquivo excluído":["File deleted","Archivo eliminado"], "Pasta excluída":["Folder deleted","Carpeta eliminada"], "Itens excluídos":["Items deleted","Elementos eliminados"],
    "Arquivo movido":["File moved","Archivo movido"], "Pasta movida":["Folder moved","Carpeta movida"], "Já estavam nessa pasta":["They were already in that folder","Ya estaban en esa carpeta"],
    "Não há outra pasta para onde mover.":["There's no other folder to move to.","No hay otra carpeta a donde mover."],
    "Arquivos precisam estar numa pasta. Escolha uma pasta de destino.":["Files must be inside a folder. Choose a destination folder.","Los archivos deben estar en una carpeta. Elige una carpeta de destino."],
    "Para mover juntos, selecione itens de um cliente só.":["To move them together, select items from a single client.","Para moverlos juntos, selecciona elementos de un solo cliente."],
    "Os links continuam funcionando.":["The links keep working.","Los enlaces siguen funcionando."], "A pasta está vazia.":["The folder is empty.","La carpeta está vacía."],
    "Não foi possível mover tudo. Recarregando o painel…":["Couldn't move everything. Reloading the panel…","No se pudo mover todo. Recargando el panel…"],
    "Não foi possível mover. Tente de novo.":["Couldn't move. Try again.","No se pudo mover. Inténtalo de nuevo."], "Não foi possível salvar. Tente de novo.":["Couldn't save. Try again.","No se pudo guardar. Inténtalo de nuevo."],
    "Não foi possível copiar.":["Couldn't copy.","No se pudo copiar."], "Não consegui agora. Tente de novo.":["Couldn't do it now. Try again.","No pude ahora. Inténtalo de nuevo."],
    "Não consegui abrir agora. Tente de novo.":["Couldn't open it now. Try again.","No pude abrirlo ahora. Inténtalo de nuevo."], "Carregando o painel…":["Loading the panel…","Cargando el panel…"],
    "O servidor está demorando mais que o normal…":["The server is taking longer than usual…","El servidor está tardando más de lo normal…"],
    "Não foi possível carregar o painel. Verifique a conexão e tente de novo.":["Couldn't load the panel. Check your connection and try again.","No se pudo cargar el panel. Revisa la conexión e inténtalo de nuevo."],
    "Sua sessão expirou. Entre de novo.":["Your session expired. Log in again.","Tu sesión expiró. Vuelve a entrar."],
    // novo arquivo
    "Novo arquivo para revisão":["New file for review","Nuevo archivo para revisión"], "Escolher do Google Drive":["Choose from Google Drive","Elegir de Google Drive"], "ou cole o link":["or paste the link","o pega el enlace"],
    "Link do arquivo no Google Drive":["Google Drive file link","Enlace del archivo en Google Drive"], "Projeto":["Project","Proyecto"], "Pasta":["Folder","Carpeta"], "Preencha a pasta.":["Fill in the folder.","Completa la carpeta."], "Nome do arquivo":["File name","Nombre del archivo"],
    "Criar link de revisão":["Create review link","Crear enlace de revisión"], "Link pronto":["Link ready","Enlace listo"], "Adicionar outro":["Add another","Agregar otro"], "Link da revisão":["Review link","Enlace de revisión"],
    "Enviar arquivo":["Upload file","Subir archivo"], "Enviando o vídeo…":["Uploading the video…","Subiendo el video…"], "Cancelar envio":["Cancel upload","Cancelar envío"], "Envio cancelado.":["Upload canceled.","Envío cancelado."],
    "Não feche esta página até terminar o envio.":["Don't close this page until the upload finishes.","No cierres esta página hasta que termine el envío."],
    "Arraste o vídeo aqui ou clique para escolher":["Drag the video here or click to choose","Arrastra el video aquí o haz clic para elegir"],
    "MP4 ou MOV. O vídeo é convertido para tocar rápido em qualquer lugar.":["MP4 or MOV. The video is converted to play fast anywhere.","MP4 o MOV. El video se convierte para reproducirse rápido en cualquier lugar."],
    "Não consegui ver os arquivos dentro dessa pasta. Entre nela na janela do Google e marque os arquivos.":["I couldn't see the files inside that folder. Open it in the Google window and select the files.","No pude ver los archivos dentro de esa carpeta. Ábrela en la ventana de Google y marca los archivos."],
    "Essa pasta não tem vídeos, áudios, imagens ou PDFs.":["That folder has no videos, audio, images or PDFs.","Esa carpeta no tiene videos, audios, imágenes ni PDF."], "Abrindo a pasta…":["Opening the folder…","Abriendo la carpeta…"], "Marque os arquivos na janela do Google":["Select the files in the Google window","Marca los archivos en la ventana de Google"],
    "Conecte o Google Drive do estúdio em Configurações para escolher arquivos.":["Connect the studio Google Drive in Settings to pick files.","Conecta el Google Drive del estudio en Configuración para elegir archivos."],
    "Conecte o Google Drive do estúdio em Configurações para enviar arquivos.":["Connect the studio Google Drive in Settings to send files.","Conecta el Google Drive del estudio en Configuración para enviar archivos."],
    "O arquivo não foi confirmado na janela do Google. Clique em Criar link de revisão para tentar de novo.":["The file wasn't confirmed in the Google window. Click Create review link to try again.","El archivo no se confirmó en la ventana de Google. Haz clic en Crear enlace de revisión para intentarlo de nuevo."],
    "Não consegui liberar o link desse arquivo no Drive do estúdio. Confira se ele está numa pasta da conta conectada.":["I couldn't open the link for this file in the studio Drive. Check that it's in a folder of the connected account.","No pude liberar el enlace de este archivo en el Drive del estudio. Verifica que esté en una carpeta de la cuenta conectada."],
    "Não consegui abrir a janela do Google. Confira a internet e tente de novo.":["I couldn't open the Google window. Check your connection and try again.","No pude abrir la ventana de Google. Revisa tu conexión e inténtalo de nuevo."],
    "Confirme na janela do Google…":["Confirm in the Google window…","Confirma en la ventana de Google…"],
    "Escolha o arquivo para revisão":["Choose the file for review","Elige el archivo para revisión"], "Buscar no Drive":["Search Drive","Buscar en Drive"], "Compartilhados comigo":["Shared with me","Compartidos conmigo"],
    "Drives compartilhados":["Shared drives","Unidades compartidas"], "Abrindo o Google Drive…":["Opening Google Drive…","Abriendo Google Drive…"], "Preencha o cliente.":["Fill in the client.","Completa el cliente."], "Preencha o projeto.":["Fill in the project.","Completa el proyecto."],
    "Na fila":["Queued","En cola"], "na fila":["queued","en cola"], "Prévia pronta":["Preview ready","Vista previa lista"], "Erro na conversão":["Conversion error","Error en la conversión"], "Erro no vídeo":["Video error","Error en el video"],
    "Erro na conversão · tentar de novo":["Conversion error · try again","Error en la conversión · intentar de nuevo"], "Upload concluído":["Upload complete","Carga completa"], "Vídeo enviado":["Video uploaded","Video subido"],
    "Últimos envios":["Recent uploads","Últimos envíos"], "Abrir envios":["Open uploads","Abrir envíos"], "Nenhum arquivo enviado ainda.":["No files uploaded yet.","Aún no se subieron archivos."], "Hoje":["Today","Hoy"], "Ontem":["Yesterday","Ayer"],
    "Ir para a pasta":["Go to folder","Ir a la carpeta"], "Tirar da lista":["Remove from list","Quitar de la lista"], "Minimizar":["Minimize","Minimizar"], "Fechar (tira da lista o que já terminou)":["Close (clears finished items)","Cerrar (quita lo que ya terminó)"],
    "Última pasta usada":["Last folder used","Última carpeta usada"], "Notificações":["Notifications","Notificaciones"], "Marcar tudo como lido":["Mark all as read","Marcar todo como leído"],
    "Nenhum comentário de cliente ainda.":["No client comments yet.","Aún no hay comentarios de clientes."], "Alguém":["Someone","Alguien"], "um vídeo":["a video","un video"],
    // equipe
    "Quem está nesta lista entra no painel com o próprio e-mail e vê o botão Painel nas páginas de revisão.":["People on this list log in to the panel with their own e-mail and see the Panel button on review pages.","Quienes están en esta lista entran al panel con su propio e-mail y ven el botón Panel en las páginas de revisión."],
    "Pessoas com acesso ao painel. Só administradores podem liberar ou remover acessos.":["People with access to the panel. Only admins can grant or remove access.","Personas con acceso al panel. Solo los administradores pueden dar o quitar accesos."],
    "Para alguém pedir acesso sozinho, envie o link":["For someone to request access on their own, send the link","Para que alguien pida acceso por su cuenta, envía el enlace"], "da página de entrar":["to the login page","de la página de entrada"],
    ". O pedido aparece aqui para aprovar.":[". The request shows up here for approval.",". La solicitud aparece aquí para aprobar."], "Nome":["Name","Nombre"], "Papel":["Role","Rol"], "Admin":["Admin","Admin"], "Liberar acesso":["Grant access","Dar acceso"],
    "Aprovar":["Approve","Aprobar"], "Recusar":["Decline","Rechazar"], "Confirmar remoção":["Confirm removal","Confirmar eliminación"], "Acesso liberado":["Access granted","Acceso concedido"], "Acesso removido":["Access removed","Acceso eliminado"],
    "Só administradores podem mudar a equipe.":["Only admins can change the team.","Solo los administradores pueden cambiar el equipo."], "Confira o e-mail digitado.":["Check the e-mail you typed.","Revisa el e-mail que escribiste."],
    "Digite um e-mail válido.":["Type a valid e-mail.","Escribe un e-mail válido."], "Não foi possível carregar a equipe.":["Couldn't load the team.","No se pudo cargar el equipo."],
    "pessoa com acesso":["person with access","persona con acceso"], "pessoas com acesso":["people with access","personas con acceso"], "1 pedido de acesso":["1 access request","1 solicitud de acceso"], "pedidos de acesso":["access requests","solicitudes de acceso"],
    // armazenamento
    "Upload na plataforma":["Uploaded to the platform","Subido a la plataforma"], "Enviado este mês":["Uploaded this month","Subido este mes"], "Média por arquivo":["Average per file","Promedio por archivo"],
    "Arquivo mais pesado":["Largest file","Archivo más pesado"], "Por cliente":["By client","Por cliente"], "Maiores arquivos":["Largest files","Archivos más grandes"], "Nenhum upload ainda":["No uploads yet","Aún no hay cargas"],
    "Nenhum upload medido ainda.":["No uploads measured yet.","Aún no hay cargas medidas."], "nenhum arquivo ainda":["no files yet","aún no hay archivos"], "Vídeos":["Videos","Videos"], "Áudios":["Audio","Audios"], "Imagens":["Images","Imágenes"], "PDF":["PDF","PDF"],
    "em":["in","en"], "na plataforma":["on the platform","en la plataforma"], "Medindo":["Measuring","Midiendo"], "no Drive. Os números vão subir sozinhos.":["in Drive. The numbers will update on their own.","en Drive. Los números subirán solos."],
    "arquivo antigo":["old file","archivo antiguo"], "arquivos antigos":["old files","archivos antiguos"], "vídeos":["videos","videos"], "do upload":["of uploads","de lo subido"],
    "de versões leves":["of light versions","de versiones livianas"], "versões leves, capas e páginas de PDF":["light versions, covers and PDF pages","versiones livianas, portadas y páginas de PDF"],
    "de originais em conversão":["of originals being converted","de originales en conversión"], "de envios interrompidos":["of interrupted uploads","de envíos interrumpidos"], "de 10 GB grátis no Cloudflare":["of 10 GB free on Cloudflare","de 10 GB gratis en Cloudflare"],
    "Arquivo":["File","Archivo"], "Ver em lista":["List view","Ver en lista"], "Ver em pastas":["Folder view","Ver en carpetas"], "Atividade":["Activity","Actividad"], "Arquivos":["Files","Archivos"],
    "Renomear, mover ou selecionar":["Rename, move or select","Renombrar, mover o seleccionar"], "enviados":["uploaded","subidos"], "enviado":["uploaded","subido"],
    // configurações
    "Perfil":["Profile","Perfil"], "Trocar foto":["Change photo","Cambiar foto"], "JPG, PNG ou WebP. A foto é reduzida antes de enviar.":["JPG, PNG or WebP. The photo is resized before uploading.","JPG, PNG o WebP. La foto se reduce antes de subirla."],
    "Nome (aparece nos comentários)":["Name (shown on comments)","Nombre (aparece en los comentarios)"], "E-mail":["E-mail","E-mail"], "E-mail atual":["Current e-mail","E-mail actual"], "Novo e-mail":["New e-mail","Nuevo e-mail"],
    "Enviar código":["Send code","Enviar código"], "Mandamos um código para o e-mail novo. Ele só troca depois que você confirmar.":["We'll send a code to the new e-mail. It only changes after you confirm.","Enviamos un código al nuevo e-mail. Solo cambia después de que confirmes."],
    "Código enviado para":["Code sent to","Código enviado a"], "Vale por 10 minutos.":["Valid for 10 minutes.","Vale por 10 minutos."], "Usar outro e-mail":["Use another e-mail","Usar otro e-mail"],
    "Senha atual":["Current password","Contraseña actual"], "Nova senha":["New password","Nueva contraseña"], "Repita a nova senha":["Repeat the new password","Repite la nueva contraseña"], "Pelo menos 10 caracteres.":["At least 10 characters.","Al menos 10 caracteres."],
    "Salvar senha":["Save password","Guardar contraseña"], "Criar senha":["Create password","Crear contraseña"], "Trocar senha":["Change password","Cambiar contraseña"], "Aparelhos":["Devices","Dispositivos"],
    "Sai da sua conta em todos os outros computadores e celulares. Este continua conectado.":["Logs you out on every other computer and phone. This one stays logged in.","Cierra tu sesión en todas las demás computadoras y celulares. Esta sigue conectada."],
    "Ver planos":["See plans","Ver planes"], "Seu plano":["Your plan","Tu plan"], "pessoas ilimitadas":["unlimited people","personas ilimitadas"],
    "pessoa":["person","persona"], "pessoas":["people","personas"], "por mês":["per month","al mes"], "Espaço sem limite":["Unlimited space","Espacio sin límite"],
    "usados":["used","usados"], "sem limite":["no limit","sin límite"], "Grátis":["Free","Gratis"], "Sem custo":["No cost","Sin costo"],
    "O espaço do plano":["The space on the","El espacio del plan"], "está cheio":["plan is full","está lleno"], "do espaço do plano":["of the space on the","del espacio del plan"],
    "Você já usou":["You've used","Ya usaste"], "Novos envios estão pausados; os links que já existem continuam abertos.":["New uploads are paused; existing links stay open.","Los nuevos envíos están pausados; los enlaces existentes siguen abiertos."],
    "A assinatura pelo painel chega na próxima etapa. Para mudar de plano agora, fale com a Muevo.":["Subscribing from the panel is coming next. To change plans now, contact Muevo.","La suscripción desde el panel llega en la próxima etapa. Para cambiar de plan ahora, habla con Muevo."],
    "O espaço do seu plano está cheio. Exclua arquivos antigos ou mude de plano em Armazenamento.":["Your plan's space is full. Delete old files or change plans in Storage.","El espacio de tu plan está lleno. Borra archivos antiguos o cambia de plan en Almacenamiento."],
    "Estúdio":["Studio","Estudio"], "Não foi possível trocar de estúdio. Tente de novo.":["Couldn't switch studios. Try again.","No se pudo cambiar de estudio. Inténtalo de nuevo."],
    "Seu estúdio está pronto":["Your studio is ready","Tu estudio está listo"], "Primeiros passos":["First steps","Primeros pasos"],
    "Três passos até o primeiro link de revisão para o seu cliente.":["Three steps to your first review link for a client.","Tres pasos hasta el primer enlace de revisión para tu cliente."],
    "Conecte o Google Drive do estúdio":["Connect the studio Google Drive","Conecta el Google Drive del estudio"],
    "Os arquivos continuam no seu Drive. O Review só acessa os que vocês escolherem.":["Your files stay in your Drive. Review only accesses the ones you pick.","Los archivos siguen en tu Drive. Review solo accede a los que elijan."],
    "Peça para um administrador do estúdio conectar, em Configurações.":["Ask a studio admin to connect it in Settings.","Pide a un administrador del estudio que lo conecte en Configuración."],
    "Conectar":["Connect","Conectar"], "Crie o primeiro cliente":["Create your first client","Crea tu primer cliente"],
    "Cada cliente tem as próprias pastas, como no seu Drive.":["Each client has its own folders, like in your Drive.","Cada cliente tiene sus propias carpetas, como en tu Drive."],
    "Envie o primeiro arquivo":["Send your first file","Envía tu primer archivo"],
    "Dentro do cliente, clique em Novo arquivo e escolha o vídeo no Drive. O link de revisão sai pronto para mandar.":["Inside the client, click New file and pick the video from Drive. The review link comes out ready to send.","Dentro del cliente, haz clic en Nuevo archivo y elige el video en Drive. El enlace de revisión sale listo para enviar."],
    "Google Drive do estúdio":["Studio Google Drive","Google Drive del estudio"], "Conectado":["Connected","Conectado"], "Não conectado":["Not connected","No conectado"],
    "Conexão desfeita no Google":["Disconnected in Google","Conexión deshecha en Google"], "Conectar o Google Drive":["Connect Google Drive","Conectar Google Drive"],
    "Conectar de novo":["Connect again","Conectar de nuevo"], "Desconectar":["Disconnect","Desconectar"], "Clique de novo para desconectar":["Click again to disconnect","Haz clic de nuevo para desconectar"],
    "O Review só acessa os arquivos que vocês escolherem na janela do Google.":["Review only accesses the files you pick in the Google window.","Review solo accede a los archivos que elijan en la ventana de Google."],
    "O acesso foi tirado pela conta Google. Conecte de novo para continuar enviando arquivos.":["Access was removed from the Google account. Connect again to keep sending files.","Se quitó el acceso desde la cuenta de Google. Conecta de nuevo para seguir enviando archivos."],
    "Conecte a conta Google onde ficam os arquivos do estúdio. O Review só vai acessar os arquivos que vocês escolherem.":["Connect the Google account where the studio's files live. Review will only access the files you pick.","Conecta la cuenta de Google donde están los archivos del estudio. Review solo accederá a los archivos que elijan."],
    "Peça para um administrador do estúdio conectar.":["Ask a studio admin to connect it.","Pide a un administrador del estudio que lo conecte."],
    "Google Drive conectado":["Google Drive connected","Google Drive conectado"], "Google Drive desconectado":["Google Drive disconnected","Google Drive desconectado"],
    "Só administradores do estúdio podem mudar a conexão.":["Only studio admins can change the connection.","Solo los administradores del estudio pueden cambiar la conexión."],
    "A conexão com o Google ainda não está ligada no servidor.":["The Google connection isn't enabled on the server yet.","La conexión con Google aún no está activada en el servidor."],
    "Conexão cancelada na tela do Google.":["Connection canceled on the Google screen.","Conexión cancelada en la pantalla de Google."],
    "Marque a permissão do Google Drive na tela do Google para conectar.":["Check the Google Drive permission on the Google screen to connect.","Marca el permiso de Google Drive en la pantalla de Google para conectar."],
    "A conexão demorou demais. Tente de novo.":["The connection took too long. Try again.","La conexión tardó demasiado. Inténtalo de nuevo."],
    "Não foi possível confirmar a conexão. Tente de novo.":["Couldn't confirm the connection. Try again.","No se pudo confirmar la conexión. Inténtalo de nuevo."],
    "O Google recusou a conexão. Tente de novo.":["Google refused the connection. Try again.","Google rechazó la conexión. Inténtalo de nuevo."],
    "O Google não mandou tudo o que precisamos. Tente de novo.":["Google didn't send everything we need. Try again.","Google no envió todo lo que necesitamos. Inténtalo de nuevo."],
    "Não foi possível conectar agora. Tente de novo.":["Couldn't connect right now. Try again.","No se pudo conectar ahora. Inténtalo de nuevo."],
    "Sair dos outros aparelhos":["Log out of other devices","Cerrar sesión en otros dispositivos"], "Nome salvo":["Name saved","Nombre guardado"], "Foto salva":["Photo saved","Foto guardada"], "Foto removida":["Photo removed","Foto eliminada"],
    "Código enviado":["Code sent","Código enviado"], "E-mail trocado":["E-mail changed","E-mail cambiado"], "Senha trocada":["Password changed","Contraseña cambiada"], "Senha criada":["Password created","Contraseña creada"],
    "Senha salva. Os outros aparelhos saíram da conta.":["Password saved. Other devices were logged out.","Contraseña guardada. Los demás dispositivos cerraron sesión."],
    "Senha removida. Você entra com o código por e-mail.":["Password removed. You'll log in with the e-mail code.","Contraseña eliminada. Entrarás con el código por e-mail."],
    "Confirmar: tirar a senha":["Confirm: remove password","Confirmar: quitar la contraseña"], "Digite a senha atual para tirar a senha.":["Type your current password to remove it.","Escribe la contraseña actual para quitarla."],
    "As duas senhas não são iguais.":["The two passwords don't match.","Las dos contraseñas no coinciden."], "A senha atual não confere.":["The current password is wrong.","La contraseña actual no coincide."],
    "A senha precisa ter pelo menos 10 caracteres.":["The password must be at least 10 characters.","La contraseña debe tener al menos 10 caracteres."],
    "Você pode entrar com esta senha ou com o código enviado por e-mail.":["You can log in with this password or with the code sent by e-mail.","Puedes entrar con esta contraseña o con el código enviado por e-mail."],
    "Sem senha: você entra com o código enviado por e-mail. Se quiser, crie uma senha para entrar mais rápido.":["No password: you log in with the code sent by e-mail. If you want, create a password to log in faster.","Sin contraseña: entras con el código enviado por e-mail. Si quieres, crea una contraseña para entrar más rápido."],
    "Muitas tentativas. Espere alguns minutos e tente de novo.":["Too many attempts. Wait a few minutes and try again.","Demasiados intentos. Espera unos minutos e inténtalo de nuevo."],
    "Esse já é o seu e-mail.":["That's already your e-mail.","Ese ya es tu e-mail."], "Esse e-mail já está em uso por outra pessoa.":["That e-mail is already used by someone else.","Ese e-mail ya lo usa otra persona."],
    "Espere um minuto para pedir outro código.":["Wait a minute to request another code.","Espera un minuto para pedir otro código."], "Não consegui mandar o e-mail agora. Tente de novo.":["Couldn't send the e-mail now. Try again.","No pude enviar el e-mail ahora. Inténtalo de nuevo."],
    "Código incorreto.":["Wrong code.","Código incorrecto."], "O código expirou. Peça outro.":["The code expired. Request another.","El código expiró. Pide otro."], "Essa imagem não pode ser usada. Tente um JPG ou PNG.":["That image can't be used. Try a JPG or PNG.","Esa imagen no se puede usar. Prueba un JPG o PNG."],
    "O servidor ainda está sendo atualizado. Tente de novo em alguns minutos.":["The server is still being updated. Try again in a few minutes.","El servidor aún se está actualizando. Inténtalo en unos minutos."],
    "Não havia outros aparelhos conectados":["There were no other devices logged in","No había otros dispositivos conectados"], "outro aparelho saiu da conta":["other device was logged out","otro dispositivo cerró sesión"], "outros aparelhos saíram da conta":["other devices were logged out","otros dispositivos cerraron sesión"],
  };
  // palavras que aparecem com número na frente (3 pastas, 1 ajuste…)
  const P = {
    "pasta":["folder","carpeta"], "pastas":["folders","carpetas"], "peça":["piece","pieza"], "peças":["pieces","piezas"], "arquivo":["file","archivo"], "arquivos":["files","archivos"],
    "ajuste":["revision","ajuste"], "ajustes":["revisions","ajustes"], "ajuste aberto":["open revision","ajuste abierto"], "ajustes abertos":["open revisions","ajustes abiertos"],
    "ajuste em aberto":["open revision","ajuste pendiente"], "ajustes em aberto":["open revisions","ajustes pendientes"], "projeto":["project","proyecto"], "projetos":["projects","proyectos"],
    "imagem":["image","imagen"], "imagens":["images","imágenes"], "página":["page","página"], "páginas":["pages","páginas"], "cliente":["client","cliente"], "clientes":["clients","clientes"],
    "link ativo":["active link","enlace activo"], "links ativos":["active links","enlaces activos"], "em revisão":["in review","en revisión"], "item":["item","elemento"], "itens":["items","elementos"],
    "selecionado":["selected","seleccionado"], "selecionados":["selected","seleccionados"], "itens movidos":["items moved","elementos movidos"], "item movido":["item moved","elemento movido"],
    "pessoa com acesso":["person with access","persona con acceso"], "pessoas com acesso":["people with access","personas con acceso"], "links copiados":["links copied","enlaces copiados"],
  };
  // as mesmas palavras sem número (quando o painel monta a frase em partes)
  Object.keys(P).forEach(k => { if (!Object.prototype.hasOwnProperty.call(D, k)) D[k] = P[k]; });
  const MES = { janeiro:["January","enero"], fevereiro:["February","febrero"], "março":["March","marzo"], abril:["April","abril"], maio:["May","mayo"], junho:["June","junio"], julho:["July","julio"],
    agosto:["August","agosto"], setembro:["September","septiembre"], outubro:["October","octubre"], novembro:["November","noviembre"], dezembro:["December","diciembre"] };
  const MES3 = { jan:["Jan","ene"], fev:["Feb","feb"], mar:["Mar","mar"], abr:["Apr","abr"], mai:["May","may"], jun:["Jun","jun"], jul:["Jul","jul"], ago:["Aug","ago"], set:["Sep","sep"], out:["Oct","oct"], nov:["Nov","nov"], dez:["Dec","dic"] };
  const i = () => L === "en" ? 0 : 1;
  const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function frase(s){
    if (tem(D, s)) return D[s][i()];
    let m;
    if ((m = /^(\d+) (.+)$/.exec(s)) && tem(P, m[2])) return m[1] + " " + P[m[2]][i()];
    if ((m = /^há (\d+) (min|h|dia|dias)$/.exec(s))) { const n = m[1], u = m[2];
      if (L === "en") return n + " " + (u === "min" ? "min" : u === "h" ? "h" : u === "dia" ? "day" : "days") + " ago";
      return "hace " + n + " " + (u === "min" ? "min" : u === "h" ? "h" : u === "dia" ? "día" : "días"); }
    if ((m = /^Novo arquivo para (.+)$/.exec(s))) return (L === "en" ? "New file for " : "Nuevo archivo para ") + m[1];
    if ((m = /^atividade (.+)$/.exec(s))) { const r = frase(m[1]); return (L === "en" ? "activity " : "actividad ") + r; }
    if ((m = /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) (\d{4})$/i.exec(s))) return MES[m[1].toLowerCase()][i()] + " " + m[2];
    if ((m = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i.exec(s))) { const r = MES3[m[1].toLowerCase()][i()]; return m[1] === m[1].toUpperCase() ? r.toUpperCase() : r; }
    if ((m = /^(\d{1,2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)( \d{4})?$/.exec(s))) return L === "en" ? MES3[m[2]][0] + " " + m[1] + (m[3] || "") : m[1] + " " + MES3[m[2]][1] + (m[3] || "");
    if ((m = /^(.+?)(…|:)$/.exec(s)) && tem(D, m[1])) return D[m[1]][i()] + m[2];
    if ((m = /^· (.+)$/.exec(s))) { const r = frase(m[1]); if (r !== m[1]) return "· " + r; }
    // pedaços separados por " · " (resumos e linhas de informação)
    if (s.includes(" · ")) { const ps = s.split(" · "), t = ps.map(frase); if (t.some((x, k) => x !== ps[k])) return t.join(" · "); }
    return s;
  }
  function tr(s){
    if (L === "pt" || !s) return s;
    const a = s.match(/^\s*/)[0], z = s.match(/\s*$/)[0], meio = s.slice(a.length, s.length - z.length);
    if (!meio) return s;
    const t = frase(meio);
    return t === meio ? s : a + t + z;
  }
  const ATR = ["title", "aria-label", "placeholder"];
  function traduz(n){
    if (L === "pt" || !n) return;
    if (n.nodeType === 3){ const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || n.tagName === "SCRIPT" || n.tagName === "STYLE" || n.tagName === "TEXTAREA" || n.isContentEditable) return;
    ATR.forEach(a => { const v = n.getAttribute(a); if (v){ const t = tr(v); if (t !== v) n.setAttribute(a, t); } });
    for (let c = n.firstChild; c; c = c.nextSibling) traduz(c);
  }
  function liga(raiz){
    if (L === "pt") return;
    document.documentElement.lang = L === "en" ? "en" : "es";
    traduz(raiz);
    new MutationObserver(ms => { for (const m of ms){
      if (m.type === "characterData") traduz(m.target);
      else if (m.type === "attributes") traduz(m.target);
      else m.addedNodes.forEach(traduz);
    } }).observe(raiz, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATR });
  }
  window.MuevoLingua = {
    atual: () => L,
    t: tr,
    local: () => L === "en" ? "en-US" : L === "es" ? "es-ES" : "pt-BR",
    nome: l => ({ pt:"Português", en:"English", es:"Español" })[l || L],
    liga,
    troca(l){ if (!["pt","en","es"].includes(l) || l === L) return; try { localStorage.setItem("muevo-lingua", l); } catch(e){} location.reload(); },
  };
})();
