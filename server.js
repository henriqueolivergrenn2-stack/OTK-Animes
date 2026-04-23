const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== DB MANAGER (troca dinamica de banco) =====
const db = require('./db/manager');
const dbConfig = require('./db/config');

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(session({
  secret: 'otkanimes-secret-v3-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ===== INIT DB =====
(async () => {
  try {
    await db.initData();
    console.log('[DB] Provider ativo:', dbConfig.getActiveProvider());
  } catch (err) {
    console.error('[DB] Erro init:', err.message);
  }
})();

// ===== AUTH MIDDLEWARE =====
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.title = 'OTK ANIMES';
  next();
});

// ===== HELPERS =====
async function getAnimeEpisodes(animeId) {
  const eps = await db.readJSON('episodes');
  return eps.filter(e => e.animeId === animeId).sort((a, b) => (a.number || 0) - (b.number || 0));
}
async function getAllGenres() {
  const animes = await db.readJSON('animes');
  return [...new Set(animes.flatMap(a => a.genres || []))].sort();
}

// ===== PUBLIC ROUTES =====

// Home
app.get('/', async (req, res) => {
  try {
    const animes = await db.readJSON('animes');
    const episodes = await db.readJSON('episodes');
    const featured = [...animes].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
    const recentEpisodes = [...episodes]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 12)
      .map(ep => {
        const a = animes.find(x => x.id === ep.animeId);
        return { ...ep, animeTitle: a ? a.title : '', animeCover: a ? a.cover : '' };
      });
    const popularAnimes = [...animes].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    const recentAnimes = [...animes].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 10);
    res.render('index', { featured, recentEpisodes, popularAnimes, recentAnimes, title: 'OTK ANIMES' });
  } catch (err) {
    console.error('[Home] Erro:', err.message);
    res.render('index', { featured: [], recentEpisodes: [], popularAnimes: [], recentAnimes: [], title: 'OTK ANIMES' });
  }
});

// Search API
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const animes = await db.readJSON('animes');
    if (!q) return res.json([]);
    const term = q.toLowerCase();
    const results = animes.filter(a =>
      (a.title && a.title.toLowerCase().includes(term)) ||
      (a.genres || []).some(g => g.toLowerCase().includes(term))
    ).slice(0, 10);
    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

// Catalogo
app.get('/catalogo', async (req, res) => {
  try {
    const { q, genre, sort } = req.query;
    let animes = await db.readJSON('animes');
    if (q) {
      const term = q.toLowerCase();
      animes = animes.filter(a =>
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.synopsis && a.synopsis.toLowerCase().includes(term)) ||
        (a.genres || []).some(g => g.toLowerCase().includes(term))
      );
    }
    if (genre) animes = animes.filter(a => (a.genres || []).includes(genre));
    if (sort === 'popular') animes.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sort === 'recent') animes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sort === 'rating') animes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    res.render('catalog', { animes, allGenres: await getAllGenres(), query: req.query || {}, title: 'Catalogo - OTK ANIMES' });
  } catch (err) {
    console.error('[Catalogo] Erro:', err.message);
    res.render('catalog', { animes: [], allGenres: [], query: req.query || {}, title: 'Catalogo - OTK ANIMES' });
  }
});

// Anime detail
app.get('/anime/:id', async (req, res) => {
  try {
    const animes = await db.readJSON('animes');
    const anime = animes.find(a => a.id === req.params.id);
    if (!anime) return res.redirect('/');
    anime.views = (anime.views || 0) + 1;
    await db.writeJSON('animes', animes);
    const episodes = await getAnimeEpisodes(anime.id);
    res.render('anime', { anime, episodes, title: (anime.title || '') + ' - OTK ANIMES' });
  } catch (err) {
    res.redirect('/');
  }
});

// Watch episode
app.get('/watch/:animeId/:epId', async (req, res) => {
  try {
    const animes = await db.readJSON('animes');
    const episodes = await db.readJSON('episodes');
    const anime = animes.find(a => a.id === req.params.animeId);
    const episode = episodes.find(e => e.id === req.params.epId);
    if (!anime || !episode) return res.redirect('/');
    const animeEpisodes = await getAnimeEpisodes(anime.id);
    const idx = animeEpisodes.findIndex(e => e.id === episode.id);
    const prevEpisode = idx > 0 ? animeEpisodes[idx - 1] : null;
    const nextEpisode = idx < animeEpisodes.length - 1 ? animeEpisodes[idx + 1] : null;

    // Save history
    if (req.session && req.session.user) {
      const history = await db.readJSON('history');
      const existing = history.find(h => h.userId === req.session.user.id && h.animeId === anime.id);
      const entry = {
        userId: req.session.user.id, animeId: anime.id, animeTitle: anime.title || '', animeCover: anime.cover || '',
        episodeId: episode.id, episodeNumber: episode.number || 0, episodeTitle: episode.title || '', watchedAt: new Date().toISOString()
      };
      if (existing) Object.assign(existing, entry); else history.push(entry);
      await db.writeJSON('history', history);
    }

    const related = animes.filter(a =>
      a.id !== anime.id && a.genres && anime.genres && a.genres.some(g => anime.genres.includes(g))
    ).slice(0, 6);

    res.render('watch', {
      anime, episode, prevEpisode, nextEpisode, related, episodes: animeEpisodes,
      title: 'EP' + (episode.number || '') + ' - ' + (anime.title || '') + ' - OTK ANIMES'
    });
  } catch (err) {
    console.error('[Watch] Erro:', err.message);
    res.redirect('/');
  }
});

// Auth
app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  res.render('login', { title: 'Login - OTK ANIMES', error: null });
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('login', { title: 'Login - OTK ANIMES', error: 'Preencha todos os campos' });
  const users = await db.readJSON('users');
  const user = users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { title: 'Login - OTK ANIMES', error: 'Email ou senha incorretos' });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
  res.redirect('/');
});
app.get('/register', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  res.render('register', { title: 'Cadastro - OTK ANIMES', error: null });
});
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.render('register', { title: 'Cadastro - OTK ANIMES', error: 'Preencha todos os campos' });
  if (password.length < 6) return res.render('register', { title: 'Cadastro - OTK ANIMES', error: 'Senha minima 6 caracteres' });
  const users = await db.readJSON('users');
  if (users.find(u => u.email === email)) return res.render('register', { title: 'Cadastro - OTK ANIMES', error: 'Email ja cadastrado' });
  const newUser = { id: uuidv4(), name, email, password: bcrypt.hashSync(password, 10), role: 'user', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(email), createdAt: new Date().toISOString() };
  users.push(newUser);
  await db.writeJSON('users', users);
  req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, avatar: newUser.avatar };
  res.redirect('/');
});
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// Profile
app.get('/profile', requireAuth, async (req, res) => {
  const history = (await db.readJSON('history')).filter(h => h.userId === req.session.user.id).sort((a, b) => new Date(b.watchedAt || 0) - new Date(a.watchedAt || 0));
  res.render('profile', { user: req.session.user, history, title: 'Perfil - OTK ANIMES' });
});

// ===== ADMIN ROUTES =====
app.get('/admin', requireAdmin, async (req, res) => {
  const animes = await db.readJSON('animes');
  const episodes = await db.readJSON('episodes');
  const users = await db.readJSON('users');
  const activeProvider = dbConfig.getActiveProvider();
  const allProviders = dbConfig.getAllProviders();
  const providerInfo = allProviders[activeProvider] || { label: activeProvider };
  res.render('admin/dashboard', {
    animes, episodes, users,
    stats: { totalAnimes: animes.length, totalEpisodes: episodes.length, totalUsers: users.length, totalViews: animes.reduce((s, a) => s + (a.views || 0), 0) },
    dbStatus: { provider: activeProvider, label: providerInfo.label },
    title: 'Admin - OTK ANIMES'
  });
});

// Admin Animes
app.get('/admin/animes', requireAdmin, async (req, res) => {
  let animes = await db.readJSON('animes');
  const { q } = req.query;
  if (q) {
    const term = q.toLowerCase();
    animes = animes.filter(a => (a.title && a.title.toLowerCase().includes(term)) || (a.genres || []).some(g => g.toLowerCase().includes(term)));
  }
  res.render('admin/animes', { animes, q: q || '', title: 'Animes - OTK ANIMES' });
});
app.get('/admin/animes/new', requireAdmin, (req, res) => { res.render('admin/anime-form', { anime: null, title: 'Novo Anime - OTK ANIMES' }); });
app.post('/admin/animes', requireAdmin, async (req, res) => {
  const animes = await db.readJSON('animes');
  const { title, synopsis, genres, status, rating, cover } = req.body;
  animes.push({
    id: uuidv4(), title: title || '', synopsis: synopsis || '', genres: genres ? genres.split(',').map(g => g.trim()).filter(Boolean) : [],
    status: status || 'ongoing', rating: parseFloat(rating) || 0, cover: cover || '', banner: cover || '', views: 0, createdAt: new Date().toISOString()
  });
  await db.writeJSON('animes', animes);
  res.redirect('/admin/animes');
});
app.get('/admin/animes/edit/:id', requireAdmin, async (req, res) => {
  const animes = await db.readJSON('animes');
  const anime = animes.find(a => a.id === req.params.id);
  if (!anime) return res.redirect('/admin/animes');
  res.render('admin/anime-form', { anime, title: 'Editar Anime - OTK ANIMES' });
});
app.post('/admin/animes/edit/:id', requireAdmin, async (req, res) => {
  const animes = await db.readJSON('animes');
  const idx = animes.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.redirect('/admin/animes');
  const { title, synopsis, genres, status, rating, cover } = req.body;
  animes[idx] = { ...animes[idx], title: title || animes[idx].title, synopsis: synopsis || '', genres: genres ? genres.split(',').map(g => g.trim()).filter(Boolean) : animes[idx].genres, status: status || animes[idx].status, rating: parseFloat(rating) || animes[idx].rating || 0, cover: cover || animes[idx].cover, banner: cover || animes[idx].banner };
  await db.writeJSON('animes', animes);
  res.redirect('/admin/animes');
});
app.get('/admin/animes/delete/:id', requireAdmin, async (req, res) => {
  let animes = await db.readJSON('animes');
  let episodes = await db.readJSON('episodes');
  animes = animes.filter(a => a.id !== req.params.id);
  episodes = episodes.filter(e => e.animeId !== req.params.id);
  await db.writeJSON('animes', animes);
  await db.writeJSON('episodes', episodes);
  res.redirect('/admin/animes');
});

// Admin Episodes
app.get('/admin/episodes', requireAdmin, async (req, res) => {
  let episodes = await db.readJSON('episodes');
  const animes = await db.readJSON('animes');
  const { q } = req.query;
  if (q) {
    const term = q.toLowerCase();
    episodes = episodes.filter(ep => {
      const a = animes.find(x => x.id === ep.animeId);
      return (ep.title && ep.title.toLowerCase().includes(term)) || (a && a.title.toLowerCase().includes(term));
    });
  }
  res.render('admin/episodes', { episodes, animes, q: q || '', title: 'Episodios - OTK ANIMES' });
});
app.get('/admin/episodes/new', requireAdmin, async (req, res) => {
  res.render('admin/episode-form', { episode: null, animes: await db.readJSON('animes'), title: 'Novo Episodio - OTK ANIMES' });
});
app.post('/admin/episodes', requireAdmin, async (req, res) => {
  const episodes = await db.readJSON('episodes');
  const { animeId, number, videoUrl, title, synopsis, thumbnail } = req.body;
  episodes.push({
    id: uuidv4(), animeId: animeId || '', title: title || ('Episodio ' + (number || '')), number: parseInt(number) || 1,
    videoUrl: videoUrl || '', synopsis: synopsis || '', thumbnail: thumbnail || '', createdAt: new Date().toISOString()
  });
  await db.writeJSON('episodes', episodes);
  res.redirect('/admin/episodes');
});
app.get('/admin/episodes/edit/:id', requireAdmin, async (req, res) => {
  const episodes = await db.readJSON('episodes');
  const animes = await db.readJSON('animes');
  const episode = episodes.find(e => e.id === req.params.id);
  if (!episode) return res.redirect('/admin/episodes');
  res.render('admin/episode-form', { episode, animes, title: 'Editar Episodio - OTK ANIMES' });
});
app.post('/admin/episodes/edit/:id', requireAdmin, async (req, res) => {
  const episodes = await db.readJSON('episodes');
  const idx = episodes.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.redirect('/admin/episodes');
  const { animeId, number, videoUrl, title, synopsis, thumbnail } = req.body;
  episodes[idx] = { ...episodes[idx], animeId: animeId || episodes[idx].animeId, title: title || episodes[idx].title, number: parseInt(number) || episodes[idx].number, videoUrl: videoUrl || episodes[idx].videoUrl, synopsis: synopsis || '', thumbnail: thumbnail || episodes[idx].thumbnail };
  await db.writeJSON('episodes', episodes);
  res.redirect('/admin/episodes');
});
app.get('/admin/episodes/delete/:id', requireAdmin, async (req, res) => {
  let episodes = await db.readJSON('episodes');
  episodes = episodes.filter(e => e.id !== req.params.id);
  await db.writeJSON('episodes', episodes);
  res.redirect('/admin/episodes');
});

// Admin Users
app.get('/admin/users', requireAdmin, async (req, res) => {
  res.render('admin/users', { users: await db.readJSON('users'), title: 'Usuarios - OTK ANIMES' });
});
app.get('/admin/users/promote/:id', requireAdmin, async (req, res) => {
  const users = await db.readJSON('users');
  const u = users.find(x => x.id === req.params.id);
  if (u) { u.role = u.role === 'admin' ? 'user' : 'admin'; await db.writeJSON('users', users); }
  res.redirect('/admin/users');
});

// Admin Settings
app.get('/admin/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { user: req.session.user, error: null, success: null, title: 'Configuracoes - OTK ANIMES' });
});
app.post('/admin/settings', requireAdmin, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const users = await db.readJSON('users');
  const idx = users.findIndex(u => u.id === req.session.user.id);
  if (idx === -1) return res.redirect('/login');
  if (!bcrypt.compareSync(currentPassword, users[idx].password)) {
    return res.render('admin/settings', { user: req.session.user, error: 'Senha atual incorreta', success: null, title: 'Configuracoes - OTK ANIMES' });
  }
  if (email && email !== users[idx].email) {
    if (users.find(u => u.email === email && u.id !== users[idx].id)) {
      return res.render('admin/settings', { user: req.session.user, error: 'Email ja em uso', success: null, title: 'Configuracoes - OTK ANIMES' });
    }
    users[idx].email = email;
    req.session.user.email = email;
  }
  if (newPassword && newPassword.length >= 6) {
    users[idx].password = bcrypt.hashSync(newPassword, 10);
  }
  await db.writeJSON('users', users);
  res.render('admin/settings', { user: req.session.user, error: null, success: 'Configuracoes salvas com sucesso!', title: 'Configuracoes - OTK ANIMES' });
});

// ===== DATABASE CONFIG ROUTES =====
app.get('/admin/database', requireAdmin, (req, res) => {
  const cfg = dbConfig.loadConfig();
  res.render('admin/database', {
    config: cfg,
    activeProvider: cfg.activeProvider,
    providers: cfg.providers,
    title: 'Banco de Dados - OTK ANIMES',
    error: null,
    success: null
  });
});

app.get('/admin/database/config/:provider', requireAdmin, (req, res) => {
  const cfg = dbConfig.loadConfig();
  const provider = req.params.provider;
  const providerCfg = cfg.providers[provider];
  if (!providerCfg) return res.redirect('/admin/database');

  const fields = getProviderFields(provider);
  res.render('admin/database-config', {
    provider,
    providerCfg,
    fields,
    title: providerCfg.label + ' - OTK ANIMES',
    error: null,
    success: null
  });
});

app.post('/admin/database/config/:provider', requireAdmin, async (req, res) => {
  const provider = req.params.provider;
  const cfg = dbConfig.loadConfig();
  const providerCfg = cfg.providers[provider];
  if (!providerCfg) return res.redirect('/admin/database');

  // Salva as configuracoes
  dbConfig.updateProviderConfig(provider, { ...req.body, enabled: true });

  const fields = getProviderFields(provider);
  res.render('admin/database-config', {
    provider,
    providerCfg: { ...providerCfg, ...req.body },
    fields,
    title: providerCfg.label + ' - OTK ANIMES',
    error: null,
    success: 'Configuracao salva! Teste a conexao para ativar.'
  });
});

app.post('/admin/database/test/:provider', requireAdmin, async (req, res) => {
  const provider = req.params.provider;
  const cfg = dbConfig.loadConfig();
  const providerCfg = cfg.providers[provider];

  const result = await db.testConnection(provider, providerCfg);
  res.json(result);
});

app.post('/admin/database/activate/:provider', requireAdmin, async (req, res) => {
  const provider = req.params.provider;
  const cfg = dbConfig.loadConfig();

  if (!cfg.providers[provider]) {
    return res.json({ success: false, message: 'Provider invalido' });
  }

  // Testa primeiro
  const testResult = await db.testConnection(provider, cfg.providers[provider]);
  if (!testResult.success) {
    return res.json({ success: false, message: 'Teste falhou: ' + testResult.message });
  }

  // Migra dados se nao for JSON
  if (provider !== 'json') {
    try {
      const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
      for (const table of tables) {
        const data = await db.readJSON(table);
        // Escreve diretamente usando o novo adapter
        const adapterPath = './db/adapters/' + provider + '.js';
        const AdapterClass = require(adapterPath);
        const newAdapter = new AdapterClass(cfg.providers[provider]);
        await newAdapter.write(table, data);
      }
    } catch (err) {
      return res.json({ success: false, message: 'Erro na migracao: ' + err.message });
    }
  }

  // Ativa
  dbConfig.setActiveProvider(provider);
  db.reloadAdapter();

  res.json({ success: true, message: 'Banco "' + cfg.providers[provider].label + '" ativado com sucesso!' });
});

app.post('/admin/database/migrate-to/:provider', requireAdmin, async (req, res) => {
  const provider = req.params.provider;
  const cfg = dbConfig.loadConfig();
  try {
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    let migrated = 0;
    for (const table of tables) {
      const data = await db.readJSON(table);
      const adapterPath = './db/adapters/' + provider + '.js';
      const AdapterClass = require(adapterPath);
      const newAdapter = new AdapterClass(cfg.providers[provider]);
      await newAdapter.write(table, data);
      migrated += data.length;
    }
    res.json({ success: true, message: 'Migracao concluida! ' + migrated + ' registros migrados.' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Campos de cada provider
function getProviderFields(provider) {
  const fields = {
    json: [],
    mongodb: [
      { name: 'connectionString', label: 'Connection String', type: 'text', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority', hint: 'Copie do MongoDB Atlas > Database > Connect > Drivers > Node.js' },
      { name: 'database', label: 'Nome do Database', type: 'text', placeholder: 'otkanimes', hint: 'Opcional, padrao: otkanimes' }
    ],
    firebase: [
      { name: 'serviceAccountJson', label: 'Service Account JSON', type: 'textarea', placeholder: '{\n  "type": "service_account",\n  ...\n}', hint: 'Firebase Console > Project Settings > Service Accounts > Generate New Private Key. Cole o JSON inteiro aqui.' },
      { name: 'databaseURL', label: 'Database URL', type: 'text', placeholder: 'https://seu-projeto.firebaseio.com', hint: 'Encontrado no mesmo lugar do Service Account' }
    ],
    supabase: [
      { name: 'url', label: 'Project URL', type: 'text', placeholder: 'https://abcdefgh12345678.supabase.co', hint: 'Supabase > Settings > API > Project URL' },
      { name: 'anonKey', label: 'Anon/Public Key', type: 'text', placeholder: 'eyJhbGciOiJIUzI1NiIs...', hint: 'Supabase > Settings > API > Project API Keys > anon public' }
    ],
    planetscale: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'aws.connect.psdb.cloud', hint: 'PlanetScale > Connect > @planetscale/database' },
      { name: 'username', label: 'Username', type: 'text', placeholder: 'seu-usuario', hint: 'Gerado pelo PlanetScale' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'sua-senha', hint: 'Gerado pelo PlanetScale' }
    ],
    neon: [
      { name: 'connectionString', label: 'Connection String', type: 'text', placeholder: 'postgresql://user:pass@host.neon.tech/db?sslmode=require', hint: 'Neon Console > Connection String > Node.js' }
    ],
    mysql: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost ou seu-host.com', hint: 'IP ou hostname do servidor MySQL' },
      { name: 'port', label: 'Porta', type: 'number', placeholder: '3306', hint: 'Padrao: 3306' },
      { name: 'user', label: 'Usuario', type: 'text', placeholder: 'root', hint: 'Usuario do MySQL' },
      { name: 'password', label: 'Senha', type: 'password', placeholder: 'sua-senha', hint: 'Senha do MySQL' },
      { name: 'database', label: 'Database', type: 'text', placeholder: 'otkanimes', hint: 'Nome do database' }
    ],
    postgres: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost ou seu-host.com', hint: 'IP ou hostname do servidor PostgreSQL' },
      { name: 'port', label: 'Porta', type: 'number', placeholder: '5432', hint: 'Padrao: 5432' },
      { name: 'user', label: 'Usuario', type: 'text', placeholder: 'postgres', hint: 'Usuario do PostgreSQL' },
      { name: 'password', label: 'Senha', type: 'password', placeholder: 'sua-senha', hint: 'Senha do PostgreSQL' },
      { name: 'database', label: 'Database', type: 'text', placeholder: 'otkanimes', hint: 'Nome do database' }
    ],
    sqlite: [
      { name: 'filePath', label: 'Caminho do arquivo .db', type: 'text', placeholder: './data/otkanimes.db', hint: 'Caminho onde o SQLite vai salvar o arquivo. Padrao: ./data/otkanimes.db' }
    ],
    redis: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'redis-12345.c239.us-east-1-2.ec2.cloud.redislabs.com', hint: 'Redis Cloud > Configuration > Endpoint' },
      { name: 'port', label: 'Porta', type: 'number', placeholder: '12345', hint: 'Porta do Redis Cloud' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'sua-senha-redis', hint: 'Redis Cloud > Configuration > Password' }
    ],
    dynamodb: [
      { name: 'accessKeyId', label: 'AWS Access Key ID', type: 'text', placeholder: 'AKIA...', hint: 'AWS IAM > Create Access Key' },
      { name: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password', placeholder: 'secret...', hint: 'Gerado junto com o Access Key' },
      { name: 'region', label: 'AWS Region', type: 'text', placeholder: 'us-east-1', hint: 'Ex: us-east-1, sa-east-1' }
    ],
    cockroachdb: [
      { name: 'connectionString', label: 'Connection String', type: 'text', placeholder: 'postgresql://user:pass@host.cockroachlabs.cloud:26257/db?sslmode=verify-full', hint: 'CockroachCloud > Connect > Connection String' }
    ]
  };
  return fields[provider] || [];
}

// APIs
app.get('/api/animes', async (req, res) => res.json(await db.readJSON('animes')));
app.get('/api/episodes', async (req, res) => res.json(await db.readJSON('episodes')));

// Start (so roda se nao for serverless)
if (require.main === module) {
  app.listen(PORT, () => console.log('OTK ANIMES on port ' + PORT));
}

module.exports = app;
