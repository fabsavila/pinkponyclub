# Pink Pony Club 🦄🌈

App web del club: catálogo de series, películas, libros, cómics y música sáficos, con ponis, mini reseñas, spoilers, etiquetas, avisos de contenido y rankings.

## Qué hay en la carpeta
- `index.html`: toda la app (diseño y lógica).
- `netlify/functions/api.mjs`: el "servidor" (guarda datos en Netlify Blobs y valida el código del club).
- `netlify.toml` y `package.json`: configuración.

## Cómo publicarla en Netlify (paso a paso)
1. Crea un repositorio en GitHub y sube **el contenido de esta carpeta** (no la carpeta dentro de otra carpeta).
2. En Netlify: **Add new site → Import an existing project** y elige ese repositorio. No cambies nada en la configuración de build y pulsa Deploy.
3. En **Site configuration → Environment variables** crea dos variables:
   - `CLUB_CODE`: el código que usarán las integrantes para entrar.
   - `ADMIN_CODE`: tu contraseña de administradora (distinta a la anterior).
4. En **Deploys**, pulsa **Trigger deploy → Deploy site** para que tome las variables.
5. Abre tu sitio, escribe el código del club y listo. Para borrar títulos o reseñas, ve a **Guía → Soy la administradora** y escribe tu contraseña.

Para cambiar el código, edita la variable `CLUB_CODE` y haz un nuevo deploy.

## Notas
- Arrastrar y soltar la carpeta en Netlify Drop **no** sirve, porque necesita instalar `@netlify/blobs`. Usa GitHub o la CLI (`npm i -g netlify-cli`, luego `netlify deploy --prod`).
- Para probarla en tu computadora: `netlify dev`, con las variables en un archivo `.env`.
- La búsqueda de portadas usa TVMaze (series), iTunes (películas y música) y Google Books (libros y cómics). Las sinopsis solo se muestran en español: si la fuente viene en inglés, se busca en Wikipedia en español y, si no aparece, queda vacía para que la escribas tú.
- Las imágenes subidas se reducen y se guardan en Netlify Blobs. Las portadas encontradas con la búsqueda se enlazan desde su fuente.
