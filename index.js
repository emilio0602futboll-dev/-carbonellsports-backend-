const cheerio = require('cheerio');
const Parser = require('rss-parser');
const parser = new Parser();
const cors = require('cors');
const express = require('express');
const { resolve } = require('path');
const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 3010;

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((error) => console.error('Error al conectar a MongoDB:', error));

const comentarioSchema = new mongoose.Schema({
  autor: String,
  texto: String
});

const postSchema = new mongoose.Schema({
  categoria: String,
  titulo: String,
  cuerpo: String,
  autor: String,
  imagen: String,
  votos: { type: Number, default: 0 },
  comentarios: [comentarioSchema]
});

const Post = mongoose.model('Post', postSchema);

async function obtenerImagen(url) {
  try {
    const respuesta = await fetch(url);
    const html = await respuesta.text();
    const $ = cheerio.load(html);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch (error) {
    return null;
  }
}
async function importarNoticias() {
  const feed = await parser.parseURL('https://e00-marca.uecdn.es/rss/portada.xml');

  for (const item of feed.items.slice(0, 5)) {
    const yaExiste = await Post.findOne({ titulo: item.title });
    if (yaExiste) continue;

    const imagen = await obtenerImagen(item.link);

    const nuevoPost = new Post({
      categoria: 'noticias',
      titulo: item.title,
      cuerpo: item.contentSnippet || '',
      autor: 'Marca (automático)',
      imagen: imagen
    });

    await nuevoPost.save();
  }
}
app.get('/posts', async (req, res) => {
  const posts = await Post.find().sort({ _id: -1 });
  res.json(posts);
});

app.post('/posts', async (req, res) => {
  const nuevoPost = new Post({
    categoria: req.body.categoria,
    titulo: req.body.titulo,
    cuerpo: req.body.cuerpo,
    autor: req.body.autor || 'anónimo'
  });

  await nuevoPost.save();
  res.status(201).json(nuevoPost);
});

app.patch('/posts/:id/votos', async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  post.votos += req.body.direccion;
  await post.save();
  res.json(post);
});
app.post('/importar-noticias', async (req, res) => {
  await importarNoticias();
  const posts = await Post.find().sort({ _id: -1 });
  res.json({ mensaje: 'Noticias importadas', posts });
});
app.post('/posts/:id/comentarios', async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  post.comentarios.push({
    autor: req.body.autor || 'anónimo',
    texto: req.body.texto
  });

  await post.save();
  res.status(201).json(post);
});

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(resolve(__dirname, 'pages/index.html'));
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
