const Parser = require('rss-parser');
const parser = new Parser();
const cors = require('cors');
const fs = require('fs');
const express = require('express');
const { resolve } = require('path');

const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 3010;

function leerPosts() {
  const datos = fs.readFileSync('posts.json', 'utf-8');
  return JSON.parse(datos);
}

let posts = leerPosts();
function guardarPosts() {
  fs.writeFileSync('posts.json', JSON.stringify(posts, null, 2));
}
async function importarNoticias() {
  const feed = await parser.parseURL('https://e00-marca.uecdn.es/rss/portada.xml');

  feed.items.slice(0, 5).forEach(item => {
    const yaExiste = posts.some(p => p.titulo === item.title);
    if (yaExiste) return;

    const imagen = item.enclosure ? item.enclosure.url : null;

    const nuevoPost = {
      id: Date.now() + Math.random(),
      categoria: 'noticias',
      titulo: item.title,
      cuerpo: item.contentSnippet || '',
      autor: 'Marca (automático)',
      imagen: imagen,
      votos: 0,
      comentarios: []
    };

    posts.push(nuevoPost);
  });

  guardarPosts();
}

app.get('/posts', (req, res) => {
  res.json(posts);
});

app.post('/posts', (req, res) => {
  const nuevoPost = {
    id: Date.now(),
    categoria: req.body.categoria,
    titulo: req.body.titulo,
    cuerpo: req.body.cuerpo,
    autor: req.body.autor || 'anónimo',
    votos: 0,
    comentarios: [],
  };

  posts.unshift(nuevoPost);
  guardarPosts();
  res.status(201).json(nuevoPost);
});

app.patch('/posts/:id/votos', (req, res) => {
  const post = posts.find((p) => p.id === Number(req.params.id));

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  post.votos += req.body.direccion;
  guardarPosts();
  res.json(post);
});
app.post('/importar-noticias', async (req, res) => {
  await importarNoticias();
  res.json({ mensaje: 'Noticias importadas', posts });
});
app.post('/posts/:id/comentarios', (req, res) => {
  const post = posts.find((p) => p.id === Number(req.params.id));

  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  const nuevoComentario = {
  autor: req.body.autor || 'anónimo',
  texto: req.body.texto
};

post.comentarios.push(nuevoComentario);
  guardarPosts();
  res.status(201).json(post);
});

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(resolve(__dirname, 'pages/index.html'));
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
