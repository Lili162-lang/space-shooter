# Space Shooter FE-001 — Frontend (Angular 19, Clean FE)

Frontend del minijuego **Space Shooter** para el reto FE-001. Implementado en **Angular 19** con **Standalone Components**, arquitectura **Clean en Frontend** (domain / infrastructure / presentation / core) y Canvas 2D a ~60 FPS. Consume el backend .NET 8 a través de los endpoints `/api/v1/scores`.

---

## 🎮 Funcionalidades

- **Menú** (`/`): selector de dificultad (**Fácil / Normal / Difícil**), botón **Jugar**, enlace a **Ranking**.
- **Juego** (`/play`): 
  - Canvas 480×720, loop `requestAnimationFrame` ~60 FPS.
  - Controles: **←/→ o A/D** (mover), **Espacio** (disparar), **P / Esc** (pausar).
  - Enemigos con *spawn* periódico, colisiones AABB (balas↔enemigo y jugador↔enemigo).
  - HUD: **score**, **life** (100 → 0 = Game Over), **combo**, **durationSec** (segundos jugados).
  - **Pausa** con overlay semitransparente.
  - **Game Over**: overlay con resumen + formulario **Alias** (mín. 3 caracteres) para enviar puntaje al backend.
- **Ranking** (`/ranking`): tabla Top N (por defecto 10) con alias, puntos y fecha. Búsqueda por alias.
- **Historial por alias** (`/alias/:alias`): tabla con puntos, maxCombo, duración y fecha.

---

## 🧱 Arquitectura en FE (Clean Frontend)

```
space-shooter-angular/
├─ src/
│  ├─ core/                      # providers y configuración global
│  ├─ domain/                    # modelos y tipos puros
│  │  └─ score.ts
│  ├─ infrastructure/            # adaptadores/servicios HTTP
│  │  └─ score-api.service.ts
│  ├─ presentation/              # UI (páginas + widgets)
│  │  └─ pages/
│  │     ├─ menu/
│  │     │  ├─ menu.component.ts
│  │     │  └─ menu.component.html
│  │     ├─ game/
│  │     │  ├─ game.component.ts
│  │     │  └─ game.component.html
│  │     ├─ ranking/
│  │     │  ├─ ranking.component.ts
│  │     │  └─ ranking.component.html
│  │     └─ alias-history/
│  │        ├─ alias-history.component.ts
│  │        └─ alias-history.component.html
│  ├─ app.config.ts              # provideRouter, provideHttpClient
│  ├─ app.routes.ts              # rutas ('', 'play', 'ranking', 'alias/:alias')
│  ├─ main.ts                    # bootstrap standalone <router-outlet>
│  ├─ environments/
│  │  ├─ environment.ts          # producción
│  │  └─ environment.development.ts
│  └─ styles.css                 # tema oscuro minimal
└─ package.json
```

> **Sin NgModules**: todo con **Standalone Components**.  
> **Señales o RxJS**: el juego usa estado local simple y eventos de teclado.

---

## 🔗 API Consumida

| Método | Endpoint                           | Uso en FE                         |
|-------:|------------------------------------|-----------------------------------|
|  POST | `/api/v1/scores`                   | Enviar puntaje tras **Game Over** |
|   GET | `/api/v1/scores/top?limit=10`      | Cargar **Ranking**                 |
|   GET | `/api/v1/scores/alias/{alias}`     | Cargar **Historial por alias**     |

> Orden de Ranking (servidor): **Points DESC**, empate por **DurationSec ASC**, luego **CreatedAt ASC**.

---

## ⚙️ Configuración de entorno

Ajusta la base URL del backend en los **environments**:

**`src/environments/environment.development.ts`** (por defecto):
```ts
export const environment = {
  production: false,
  apiBase: 'http://localhost:5187/api/v1' // backend local
};
```

**`src/environments/environment.ts`** (producción):
```ts
export const environment = {
  production: true,
  apiBase: '/api/v1' // detrás de reverse proxy
};
```

---

## ▶️ Ejecución

1) **Instalar dependencias**
```bash
npm install
```

2) **Desarrollo (HMR)**
```bash
npm start
# abre http://localhost:4200
```

3) **Build de producción**
```bash
npm run build
# artefactos en dist/space-shooter-angular
```

> Asegúrate de que el backend esté disponible (por defecto en `http://localhost:5187`).  
> Si ves errores CORS, habilita tu origen en el backend (`Program.cs`).

---

## 🎯 Controles del juego

- **Mover**: ←/→ o **A/D**  
- **Disparar**: **Barra Espaciadora**  
- **Pausa**: **P** o **Esc**  
- Finaliza cuando **life = 0**. Al terminar, ingresa un **Alias** (≥ 3 caracteres) y envía tu puntaje.

---

## 🧪 Pruebas Manuales Sugeridas

- Menú → seleccionar **Normal** y **Jugar**.
- Derribar varios enemigos seguidos: verifica **combo** y **maxCombo**.
- Dejar que un enemigo toque al jugador: **life -20** y `combo = 0`.
- Pausar con **P/Esc**: overlay, el loop sigue detenido.
- Game Over → ingresar **alias** y **Enviar**. Ir a **Ranking** y verificar que aparezca.
- Buscar en **Historial** por tu alias y validar fechas/valores.

---

## 🛠️ Detalles de Implementación

- **Canvas 2D** con bucle `requestAnimationFrame` (~60 FPS).
- **AABB collisions** (rectángulos): simple y eficiente para sprites rectangulares.
- **Cooldown** de disparo (200 ms) para evitar *spam*.
- **Dificultad** afecta `spawnInterval` y `enemySpeed`:
  - **Fácil**: `spawnInterval=700ms`, `enemySpeed=2.0`
  - **Normal**: `600ms`, `2.4`
  - **Difícil**: `450ms`, `3.0`
- **HUD**: tipografía monospace, color de alto contraste.
- **Accesibilidad**: foco visible, alto contraste, textos alternativos en botones/enlaces.

---

## 🧩 Troubleshooting

- **Pantalla negra / nada renderiza**: confirma que `<canvas>` está en el DOM y el contexto 2D no es `null`.
- **CORS**: habilita el origen del front en el backend o usa un reverse proxy.
- **404 en `/api/v1/...`**: revisa `environment.apiBase` según entorno (dev vs prod).
- **Latencia alta**: reduce cantidad de enemigos simultáneos o baja el tamaño del canvas.

---

## 🚀 Despliegue

- **Static hosting** (Nginx, Apache, Azure Static Web Apps, Vercel, etc.).
- Asegura que el **backend** esté accesible en la ruta que resolviste en `environment.apiBase` (o usa *rewrite* / *proxy pass*).

---

## 🧭 Roadmap (opcional)

- Controles táctiles (mobile).
- Power-ups y enemigos con patrones.
- Sonido (Web Audio).
- Sprites/animaciones (sprite sheets).
- Persistencia de sesión y anti-trampas básicas.

---

## 📄 Licencia

MIT — Ajusta según los lineamientos de tu institución si es necesario.
