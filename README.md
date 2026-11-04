# Nu Design Interview Lab 💜

Kit bilingüe para practicar la entrevista de Diseño en Nu, con grabación de voz y feedback de IA.

**Sitio:** https://davidgv-ux.github.io/nu-design-interview-lab/

## Cómo funciona

- `index.html` es la aplicación completa y se publica con GitHub Pages.
- `proxy/` es una función de Vercel que guarda la clave de Groq como variable de entorno y reenvía las peticiones de transcripción y análisis. La clave **no** está en este repositorio.
- El usuario final no configura nada: abre la página, graba o sube un audio y recibe el feedback.

## Variables de entorno

El proxy necesita `GROQ_API_KEY` en Vercel (Production). Para cambiarla:

```bash
cd proxy
vercel env rm GROQ_API_KEY production
printf '%s' 'gsk_...' | vercel env add GROQ_API_KEY production
```

Si Vercel bloquea el deploy por el autor de Git (el proyecto está en la cuenta de Liseth), despliega desde una copia temporal sin la carpeta `.git`:

```bash
rm -rf /tmp/nu-proxy-deploy && mkdir -p /tmp/nu-proxy-deploy/api
cp proxy/api/groq.js /tmp/nu-proxy-deploy/api/
cp proxy/package.json proxy/vercel.json /tmp/nu-proxy-deploy/
cd /tmp/nu-proxy-deploy
vercel link --yes --project nu-interview-lab-api
vercel --prod
```

## Nota de seguridad

El endpoint del proxy es público (con comprobación de origen y cabecera de la app), así que podría usarse fuera de la página. La clave de Groq no se expone, pero conviene revisar el consumo en la consola de Groq y rotar la clave si se detecta uso anómalo.
